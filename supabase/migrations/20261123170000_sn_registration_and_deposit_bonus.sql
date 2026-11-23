-- Registration and deposit incentives are separate from spendable real funds.
create function public.sn_open_signup_test_wallet() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.sn_test_wallets(user_id,balance_cents) values(new.id,30000)
  on conflict (user_id) do nothing;
  return new;
end;
$$;
create trigger sn_open_signup_test_wallet after insert on auth.users
for each row execute function public.sn_open_signup_test_wallet();

alter table public.sn_test_wallets add column first_deposit_bonus_at timestamptz;

create table public.sn_confirmed_deposits (
  capture_id text primary key,
  provider_order_id text not null unique,
  user_id uuid not null references auth.users(id) on delete restrict,
  deposit_cents integer not null check (deposit_cents between 100 and 5000000),
  bonus_cents integer not null check (bonus_cents in (0,300000)),
  created_at timestamptz not null default now()
);
alter table public.sn_confirmed_deposits enable row level security;
revoke all on public.sn_confirmed_deposits from public, anon, authenticated;
create index sn_confirmed_deposits_user_idx on public.sn_confirmed_deposits(user_id,created_at);
create unique index sn_first_deposit_bonus_idx on public.sn_confirmed_deposits(user_id) where bonus_cents > 0;
create trigger sn_confirmed_deposit_six_year_guard before update or delete on public.sn_confirmed_deposits
for each row execute function public.sn_guard_six_year_source('created_at');

create function public.sn_paypal_wallet_ready() returns boolean
language sql stable security definer set search_path = ''
as $$ select auth.role() is not distinct from 'service_role' $$;
revoke all on function public.sn_paypal_wallet_ready() from public, anon, authenticated;
grant execute on function public.sn_paypal_wallet_ready() to service_role;

create function public.sn_credit_verified_paypal_deposit(account uuid, order_ref text, capture_ref text, paid_cents int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  existing public.sn_confirmed_deposits%rowtype;
  award int;
  test_balance int;
  bonus_at timestamptz;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'service_role only' using errcode = '42501'; end if;
  if account is null or not coalesce(order_ref ~ '^[a-zA-Z0-9-]{8,64}$',false) or
    not coalesce(capture_ref ~ '^[a-zA-Z0-9-]{8,64}$',false) or not coalesce(paid_cents between 100 and 5000000,false)
    then raise exception 'Invalid confirmed deposit' using errcode = '22023'; end if;
  insert into public.sn_test_wallets(user_id) values(account) on conflict (user_id) do nothing;
  select w.balance_cents,w.first_deposit_bonus_at into test_balance,bonus_at
    from public.sn_test_wallets w where w.user_id=account for update;
  select * into existing from public.sn_confirmed_deposits d where d.capture_id=capture_ref or d.provider_order_id=order_ref;
  if found then
    if existing.user_id <> account or existing.capture_id <> capture_ref or
      existing.provider_order_id <> order_ref or existing.deposit_cents <> paid_cents then
      raise exception 'Deposit reference already used' using errcode = '23505';
    end if;
    return jsonb_build_object('applied',false,'bonus_cents',existing.bonus_cents,'test_balance_cents',test_balance);
  end if;
  award := case when paid_cents >= 3300 and bonus_at is null then 300000 else 0 end;
  insert into public.sn_confirmed_deposits(capture_id,provider_order_id,user_id,deposit_cents,bonus_cents)
    values(capture_ref,order_ref,account,paid_cents,award);
  insert into public.balance_ledger(user_id,balance,updated_at) values(account,paid_cents/100.0,now())
    on conflict (user_id) do update set balance=coalesce(public.balance_ledger.balance,0)+excluded.balance,updated_at=now();
  update public.sn_test_wallets w set balance_cents=w.balance_cents+award,
    first_deposit_bonus_at=case when award>0 then now() else w.first_deposit_bonus_at end where w.user_id=account
    returning w.balance_cents into test_balance;
  return jsonb_build_object('applied',true,'bonus_cents',award,'test_balance_cents',test_balance);
end;
$$;
revoke all on function public.sn_credit_verified_paypal_deposit(uuid,text,text,int) from public, anon, authenticated;
grant execute on function public.sn_credit_verified_paypal_deposit(uuid,text,text,int) to service_role;

create or replace function public.sn_transaction_history(
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
    select 'deposit:' || d.capture_id, d.user_id, d.created_at, 'wallet_deposit', 'confirmed',
      'PayPal wallet top-up', d.deposit_cents/100.0, 'EUR', 'payment_provider', 'account',
      null::jsonb, d.created_at + interval '6 years'
    from public.sn_confirmed_deposits d where all_accounts or d.user_id = account
    union all
    select 'deposit-bonus:' || d.capture_id, d.user_id, d.created_at, 'deposit_bonus', 'credited',
      'First qualifying deposit bonus', d.bonus_cents/100.0, 'TEST AVC', 'test_wallet', 'account',
      null::jsonb, d.created_at + interval '6 years'
    from public.sn_confirmed_deposits d where d.bonus_cents > 0 and (all_accounts or d.user_id = account)
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
