-- Separate test credits from the production AV€ and payment rails.
create table public.sn_test_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance_cents integer not null default 30000 check (balance_cents >= 0)
);

create table public.sn_test_orders (
  user_id uuid not null references public.sn_test_wallets(user_id) on delete cascade,
  id uuid not null,
  order_data jsonb not null,
  charged_cents integer not null check (charged_cents > 0),
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.sn_test_wallets enable row level security;
alter table public.sn_test_orders enable row level security;
revoke all on public.sn_test_wallets, public.sn_test_orders from public, anon, authenticated;

create function public.sn_test_balance() returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  account uuid := auth.uid();
  current_balance integer;
begin
  if account is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  insert into public.sn_test_wallets (user_id) values (account) on conflict (user_id) do nothing;
  select w.balance_cents into current_balance from public.sn_test_wallets w where w.user_id = account;
  return current_balance;
end;
$$;

create function public.sn_submit_test_order(order_id uuid, payload jsonb) returns jsonb
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
  charge := subtotal + round(subtotal::numeric * 0.03)::bigint + delivery;
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

revoke all on function public.sn_test_balance() from public, anon;
revoke all on function public.sn_submit_test_order(uuid, jsonb) from public, anon;
grant execute on function public.sn_test_balance() to authenticated;
grant execute on function public.sn_submit_test_order(uuid, jsonb) to authenticated;
