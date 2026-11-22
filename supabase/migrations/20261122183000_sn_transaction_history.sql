-- Extend existing records without resetting dates or deleting any history.
alter table public.sn_transactions drop constraint if exists sn_transactions_retain_ge_5y;
alter table public.sn_transactions alter column retain_until set default (now() + interval '6 years');
update public.sn_transactions
  set retain_until = greatest(retain_until, created_at + interval '6 years')
  where retain_until < created_at + interval '6 years';
alter table public.sn_transactions add constraint sn_transactions_retain_ge_6y
  check (retain_until >= created_at + interval '6 years');
create unique index if not exists sn_transactions_user_client_full_uidx
  on public.sn_transactions (user_id, client_id);
drop index if exists public.sn_transactions_user_client_uidx;

create or replace function public.sn_transactions_guard_retain() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.retain_until > now() then raise exception 'Transaction retention period has not elapsed'; end if;
    return old;
  end if;
  if tg_op = 'UPDATE' then
    new.created_at := old.created_at;
    new.retain_until := greatest(new.retain_until, old.retain_until);
  end if;
  new.retain_until := greatest(new.retain_until, new.created_at + interval '6 years');
  return new;
end;
$$;

drop trigger if exists sn_transactions_guard_retain_trg on public.sn_transactions;
create trigger sn_transactions_guard_retain_trg before insert or update or delete on public.sn_transactions
for each row execute function public.sn_transactions_guard_retain();

create or replace function public.sn_transactions_purge_expired(p_limit int default 500) returns integer
language plpgsql security definer set search_path = '' as $$
declare affected integer;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'service_role only'; end if;
  with doomed as (
    select id from public.sn_transactions
    where retain_until < now() and retain_until >= created_at + interval '6 years'
    order by retain_until
    limit greatest(1, least(coalesce(p_limit, 500), 5000)) for update skip locked
  )
  delete from public.sn_transactions t using doomed d where t.id = d.id;
  get diagnostics affected = row_count;
  return affected;
end;
$$;
revoke all on function public.sn_transactions_purge_expired(int) from public;
grant execute on function public.sn_transactions_purge_expired(int) to service_role;
comment on table public.sn_transactions is 'Account activity retained for at least six years. Client-reported rows are distinct from financial ledger and invoice records.';
comment on column public.sn_transactions.retain_until is 'Earliest purge instant, at least six years after creation.';

-- Invoice issuance already uses the trusted marketplace function. Browser users can read
-- their documents through the history RPC, and cannot issue one for another account.
drop policy if exists "Auth insert invoices" on public.invoices;
revoke insert, update, delete on public.invoices from anon, authenticated;

create function public.sn_guard_six_year_source() returns trigger
language plpgsql set search_path = '' as $$
declare
  recorded_at timestamptz := (to_jsonb(old)->>tg_argv[0])::timestamptz;
begin
  if tg_op = 'DELETE' then
    if recorded_at + interval '6 years' > now() then raise exception 'Transaction retention period has not elapsed'; end if;
    return old;
  end if;
  if (to_jsonb(new)->>tg_argv[0])::timestamptz is distinct from recorded_at then
    raise exception 'Transaction date is immutable';
  end if;
  return new;
end;
$$;
create trigger sn_invoice_six_year_guard before update or delete on public.invoices
for each row execute function public.sn_guard_six_year_source('issued_at');
create trigger sn_ledger_six_year_guard before update or delete on public.avc_ledger
for each row execute function public.sn_guard_six_year_source('created_at');
create trigger sn_test_order_six_year_guard before update or delete on public.sn_test_orders
for each row execute function public.sn_guard_six_year_source('created_at');

-- Snapshot participant access from server-issued orders. Do not authorize invoice
-- reads using mutable driver or vendor fields on a browser-written order.
create table public.sn_invoice_participants (
  invoice_id text not null references public.invoices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('vendor','driver')),
  primary key (invoice_id, user_id, role)
);
alter table public.sn_invoice_participants enable row level security;
revoke all on public.sn_invoice_participants from public, anon, authenticated;
create index sn_invoice_participants_user_idx on public.sn_invoice_participants(user_id, invoice_id);

-- The service-only order writer receives the server's payment decision as a
-- separate argument. Invoice issuance never trusts flags in browser quotes.
create function public.sn_create_marketplace_order(order_payload jsonb, issue_invoice boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  placed public.orders%rowtype;
  identifier text;
  buyer uuid;
  debit numeric;
  remaining numeric;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'service_role only' using errcode = '42501'; end if;
  if issue_invoice then
    buyer := (order_payload->>'customer_id')::uuid;
    debit := (order_payload->'calc'->>'total_avc')::numeric;
    if buyer is null or debit is null or debit <= 0 then
      raise exception 'Invalid order payment' using errcode = '22023';
    end if;
    insert into public.balance_ledger(user_id,balance)
      values(buyer,0)
      on conflict (user_id) do nothing;
    update public.balance_ledger l set balance = l.balance - debit, updated_at = now()
      where l.user_id = buyer and l.balance >= debit returning l.balance into remaining;
    if not found then
      return jsonb_build_object('error','insufficient_balance','needed',debit,
        'balance',(select l.balance from public.balance_ledger l where l.user_id = buyer));
    end if;
    order_payload := jsonb_set(order_payload,'{calc,balance_after}',to_jsonb(remaining));
  end if;
  insert into public.orders (
    vendor_id,vendor_lat,vendor_lng,vendor_name,customer_id,items,calc,status,driver_id,driver_name,driver_emoji,
    delivery_lat,delivery_lng,delivery_address,notes,channel,pay_on_delivery,driver_accepted_at
  )
  select o.vendor_id,o.vendor_lat,o.vendor_lng,o.vendor_name,o.customer_id,o.items,o.calc,o.status,o.driver_id,o.driver_name,
    coalesce(o.driver_emoji,'🚴'),o.delivery_lat,o.delivery_lng,o.delivery_address,o.notes,o.channel,o.pay_on_delivery,o.driver_accepted_at
  from jsonb_populate_record(null::public.orders,order_payload) o returning * into placed;
  if not coalesce(issue_invoice,false) then return to_jsonb(placed); end if;
  if placed.customer_id is null or placed.calc->'paid' is distinct from 'true'::jsonb then
    raise exception 'Invoice requires a paid account order';
  end if;
  identifier := 'INV-' || placed.id::text;
  insert into public.invoices (id, mark, order_id, vendor_name, buyer_id, items,
      subtotal, delivery_fee, platform_fee, total, currency, issued_at, period_month, status)
  values (identifier, identifier, placed.id::text, placed.vendor_name, placed.customer_id, placed.items,
      (placed.calc->>'subtotal_eur')::numeric, (placed.calc->>'delivery_eur')::numeric,
      (placed.calc->>'platform_fee_eur')::numeric, (placed.calc->>'total_avc')::numeric,
      'AVC', placed.created_at, to_char(placed.created_at at time zone 'Europe/Athens','YYYY-MM'), 'issued');
  insert into public.sn_invoice_participants (invoice_id,user_id,role)
    select identifier, v.owner_id, 'vendor' from public.vendors v
    where v.id = placed.vendor_id and v.owner_id is not null on conflict do nothing;
  if placed.driver_id is not null then
    insert into public.sn_invoice_participants values (identifier, placed.driver_id, 'driver') on conflict do nothing;
  end if;
  return to_jsonb(placed) || jsonb_build_object('invoice_id',identifier);
end;
$$;
revoke all on function public.sn_create_marketplace_order(jsonb,boolean) from public, anon, authenticated;
grant execute on function public.sn_create_marketplace_order(jsonb,boolean) to service_role;

create function public.sn_refresh_invoice_driver() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() is distinct from 'service_role' or new.driver_id is not distinct from old.driver_id then return new; end if;
  delete from public.sn_invoice_participants p
    using public.invoices i where p.invoice_id = i.id and i.order_id = new.id::text and p.role = 'driver';
  if new.driver_id is not null then
    insert into public.sn_invoice_participants (invoice_id,user_id,role)
      select i.id,new.driver_id,'driver' from public.invoices i where i.order_id = new.id::text on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger sn_refresh_invoice_driver after update of driver_id on public.orders
for each row execute function public.sn_refresh_invoice_driver();

create table public.sn_marketplace_movements (
  order_id uuid not null,
  user_id uuid not null references auth.users(id) on delete restrict,
  kind text not null check (kind in ('vendor_payout','driver_payout','delivery_collection')),
  amount numeric(14,2) not null,
  created_at timestamptz not null default now(),
  primary key (order_id,kind)
);
alter table public.sn_marketplace_movements enable row level security;
revoke all on public.sn_marketplace_movements from public, anon, authenticated;
create index sn_marketplace_movements_user_idx on public.sn_marketplace_movements(user_id,created_at);
create trigger sn_marketplace_movement_six_year_guard before update or delete on public.sn_marketplace_movements
for each row execute function public.sn_guard_six_year_source('created_at');

create function public.sn_record_marketplace_movement(order_ref uuid, account uuid, amount numeric, movement_kind text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  placed public.orders%rowtype;
  signed_amount numeric := round(amount,2);
  existing public.sn_marketplace_movements%rowtype;
  identifier text;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'service_role only' using errcode = '42501'; end if;
  select * into placed from public.orders o where o.id = order_ref for update;
  if not found or account is null or signed_amount is null or signed_amount = 0
    or (movement_kind = 'delivery_collection' and (signed_amount >= 0 or not placed.pay_on_delivery or account is distinct from placed.customer_id))
    or (movement_kind in ('vendor_payout','driver_payout') and signed_amount <= 0) then
    raise exception 'Invalid order settlement';
  end if;
  select * into existing from public.sn_marketplace_movements m where m.order_id = order_ref and m.kind = movement_kind;
  if found then
    if existing.user_id <> account or existing.amount <> signed_amount then raise exception 'Settlement already recorded'; end if;
    return;
  end if;
  insert into public.balance_ledger (user_id,balance)
    values (account,0)
    on conflict (user_id) do nothing;
  update public.balance_ledger l set balance = l.balance + signed_amount, updated_at = now()
    where l.user_id = account and l.balance + signed_amount >= 0;
  if not found then raise exception 'Insufficient balance'; end if;
  insert into public.sn_marketplace_movements(order_id,user_id,kind,amount)
    values(order_ref,account,movement_kind,signed_amount);
  if movement_kind = 'delivery_collection' then
    identifier := 'INV-' || order_ref::text;
    insert into public.invoices (id,mark,order_id,vendor_name,buyer_id,items,
      subtotal,delivery_fee,platform_fee,total,currency,issued_at,period_month,status)
    values(identifier,identifier,order_ref::text,placed.vendor_name,account,placed.items,
      (placed.calc->>'subtotal_eur')::numeric,(placed.calc->>'delivery_eur')::numeric,
      (placed.calc->>'platform_fee_eur')::numeric,-signed_amount,'AVC',now(),
      to_char(now() at time zone 'Europe/Athens','YYYY-MM'),'issued')
    on conflict (id) do nothing;
    insert into public.sn_invoice_participants (invoice_id,user_id,role)
      select identifier,v.owner_id,'vendor' from public.vendors v
      where v.id=placed.vendor_id and v.owner_id is not null on conflict do nothing;
    if placed.driver_id is not null then
      insert into public.sn_invoice_participants values(identifier,placed.driver_id,'driver') on conflict do nothing;
    end if;
  end if;
end;
$$;
revoke all on function public.sn_record_marketplace_movement(uuid,uuid,numeric,text) from public, anon, authenticated;
grant execute on function public.sn_record_marketplace_movement(uuid,uuid,numeric,text) to service_role;

create function public.sn_transaction_history(
  scope_all boolean default false, date_from date default null, date_to date default null,
  filter_kind text default null, page_size int default 50, page_offset int default 0,
  descending boolean default true
) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  account uuid := auth.uid();
  admin boolean;
  all_accounts boolean;
  max_rows integer := greatest(1, least(coalesce(page_size, 50), 250));
  skip_rows integer := greatest(0, coalesce(page_offset, 0));
  result jsonb;
begin
  if account is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  select
    coalesce(u.raw_app_meta_data->>'role' in ('admin','super_admin','owner'), false)
    or coalesce((u.raw_app_meta_data->'roles') ?| array['admin','super_admin','owner'], false)
    or (lower(u.email) = 'notisastranov@gmail.com' and u.email_confirmed_at is not null)
  into admin from auth.users u where u.id = account;
  admin := coalesce(admin, false);
  if scope_all and not admin then raise exception 'Admin access required' using errcode = '42501'; end if;
  all_accounts := scope_all and admin;

  with history as (
    select 'activity:' || t.id::text as id, t.user_id as account_id, t.created_at as event_at,
      t.kind, t.status, t.summary, t.amount_avc::numeric as amount, 'AVC'::text as currency,
      'client_recorded'::text as source, 'account'::text as access_role,
      jsonb_build_object('platform_fee', t.payload->'platform_fee') as document, t.retain_until
    from public.sn_transactions t where all_accounts or t.user_id = account
    union all
    select 'ledger:' || l.id::text, l.user_id, l.created_at, 'wallet:' || coalesce(l.work_type,'movement'),
      'recorded', coalesce(l.public_note,''), l.delta_avc::numeric, 'AVC', 'wallet_ledger', 'account',
      null::jsonb, l.created_at + interval '6 years'
    from public.avc_ledger l where all_accounts or l.user_id = account
    union all
    select 'settlement:' || m.order_id::text || ':' || m.kind, m.user_id, m.created_at,
      m.kind, 'recorded', 'Order ' || m.order_id::text, m.amount::numeric, 'AVC', 'marketplace_settlement',
      case m.kind when 'vendor_payout' then 'vendor' when 'driver_payout' then 'driver' else 'client' end,
      null::jsonb, m.created_at + interval '6 years'
    from public.sn_marketplace_movements m where all_accounts or m.user_id = account
    union all
    select 'invoice:' || i.id, i.buyer_id, i.issued_at, 'invoice', coalesce(i.status,'issued'), coalesce(i.vendor_name,''),
      i.total::numeric, coalesce(i.currency,'AVC'), 'marketplace',
      case when i.buyer_id = account then 'client' else coalesce(member.role,'admin') end,
      jsonb_build_object('id', i.id, 'mark', i.mark, 'mydata_mark', i.mydata_mark, 'order_id', i.order_id,
        'vendor', i.vendor_name, 'items', i.items, 'subtotal', i.subtotal,
        'delivery_fee', i.delivery_fee, 'platform_fee', i.platform_fee, 'total', i.total),
      i.issued_at + interval '6 years'
    from public.invoices i
    left join lateral (
      select p.role from public.sn_invoice_participants p
      where p.invoice_id = i.id and p.user_id = account order by p.role limit 1
    ) member on true
    where all_accounts or i.buyer_id = account or member.role is not null
    union all
    select 'test:' || t.id::text, t.user_id, t.created_at, 'test_order', 'recorded',
      coalesce(t.order_data->'vendor'->>'name','Test order'), t.charged_cents / 100.0, 'TEST AVC', 'test_wallet', 'client',
      jsonb_build_object('id', t.id,'vendor',t.order_data->'vendor'->>'name','items',t.order_data->'items',
        'delivery_fee',(t.order_data->>'delivery_cents')::numeric / 100,'total',t.charged_cents / 100.0),
      t.created_at + interval '6 years'
    from public.sn_test_orders t where all_accounts or t.user_id = account
  ), filtered as (
    select * from history h where (date_from is null or h.event_at >= date_from::timestamp at time zone 'Europe/Athens')
      and (date_to is null or h.event_at < (date_to + 1)::timestamp at time zone 'Europe/Athens')
      and (filter_kind is null or h.kind = filter_kind)
  ), page as (
    select * from filtered
    order by case when descending then event_at end desc, case when not descending then event_at end asc, id
    limit max_rows offset skip_rows
  ), totals as (
    select kind, currency, source, count(*) as count, sum(amount) as total
    from filtered group by kind, currency, source
  )
  select jsonb_build_object(
    'admin', admin, 'scope_all', all_accounts,
    'count', (select count(*) from filtered),
    'types', (select coalesce(jsonb_agg(kind order by kind),'[]') from (select distinct kind from history) kinds),
    'totals', (select coalesce(jsonb_agg(to_jsonb(t) order by t.kind, t.currency, t.source),'[]') from totals t),
    'items', (select coalesce(jsonb_agg(
      case when all_accounts then to_jsonb(p) else to_jsonb(p) - 'account_id' end
      order by case when descending then p.event_at end desc, case when not descending then p.event_at end asc, p.id
    ),'[]') from page p)
  ) into result;
  return result;
end;
$$;
revoke all on function public.sn_transaction_history(boolean,date,date,text,int,int,boolean) from public, anon;
grant execute on function public.sn_transaction_history(boolean,date,date,text,int,int,boolean) to authenticated;

-- Apply the same 3% order fee as production checkout. Old recorded charges stay unchanged.
create or replace function public.sn_submit_test_order(order_id uuid, payload jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  account uuid := auth.uid();
  current_balance integer;
  previous public.sn_test_orders%rowtype;
  item jsonb;
  qty integer;
  unit_cents integer;
  subtotal bigint := 0;
  delivery integer;
  charge bigint;
begin
  if account is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  if order_id is null or payload is null or jsonb_typeof(payload) <> 'object' or pg_column_size(payload) > 16000
     or jsonb_typeof(payload->'vendor') is distinct from 'object'
     or jsonb_typeof(payload->'drop') is distinct from 'object'
     or jsonb_typeof(payload->'items') is distinct from 'array'
     or coalesce(payload->>'delivery_cents', '') !~ '^[0-9]{1,6}$' then
    raise exception 'Invalid test order' using errcode = '22023';
  end if;
  if jsonb_array_length(payload->'items') not between 1 and 50 then
    raise exception 'Invalid cart' using errcode = '22023';
  end if;
  delivery := (payload->>'delivery_cents')::integer;
  for item in select value from jsonb_array_elements(payload->'items') loop
    if length(btrim(coalesce(item->>'name', ''))) not between 1 and 80
       or coalesce(item->>'qty', '') !~ '^[1-9][0-9]?$'
       or coalesce(item->>'unit_cents', '') !~ '^[1-9][0-9]{0,5}$' then
      raise exception 'Invalid item' using errcode = '22023';
    end if;
    qty := (item->>'qty')::integer;
    unit_cents := (item->>'unit_cents')::integer;
    subtotal := subtotal + qty * unit_cents;
  end loop;
  charge := subtotal + round((subtotal + delivery)::numeric * 0.03)::bigint + delivery;
  perform public.sn_test_balance();
  select w.balance_cents into current_balance from public.sn_test_wallets w where w.user_id = account for update;

  select o.* into previous from public.sn_test_orders o where o.user_id = account and o.id = order_id;
  if found then
    if previous.order_data <> payload then
      raise exception 'Order ID already used' using errcode = '23505';
    end if;
    return jsonb_build_object('id', order_id, 'balance_cents', current_balance, 'charged_cents', previous.charged_cents);
  end if;

  if current_balance < charge then
    return jsonb_build_object('error', 'insufficient_test_credit', 'balance_cents', current_balance, 'charged_cents', charge);
  end if;

  update public.sn_test_wallets w set balance_cents = w.balance_cents - charge where w.user_id = account
  returning w.balance_cents into current_balance;
  insert into public.sn_test_orders (user_id, id, order_data, charged_cents) values (account, order_id, payload, charge);
  return jsonb_build_object('id', order_id, 'balance_cents', current_balance, 'charged_cents', charge);
end;
$$;
