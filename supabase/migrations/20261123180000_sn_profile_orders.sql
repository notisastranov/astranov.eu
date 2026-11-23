create function public.sn_profile_orders(vendor_ref text default null, page_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  account uuid := auth.uid();
  admin boolean;
  today timestamptz := date_trunc('day', now(), 'Europe/Athens');
  result jsonb;
begin
  if account is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  select coalesce(u.raw_app_meta_data->>'role' in ('admin','super_admin','owner'), false)
    or coalesce((u.raw_app_meta_data->'roles') ?| array['admin','super_admin','owner'], false)
    or (lower(u.email) = 'notisastranov@gmail.com' and u.email_confirmed_at is not null)
  into admin from auth.users u where u.id = account;
  if vendor_ref is not null and not coalesce(admin,false) and not exists (
    select 1 from public.vendors v where v.id::text = vendor_ref and v.owner_id = account
  ) then raise exception 'Vendor access required' using errcode = '42501'; end if;

  with orders as (
    select o.id::text, o.created_at, o.status::text, o.vendor_name, false as test
    from public.orders o
    where case when vendor_ref is null then o.customer_id = account or o.driver_id = account
      else o.vendor_id::text = vendor_ref end
    union all
    select o.id::text, o.created_at, 'placed', o.order_data #>> '{vendor,name}', true
    from public.sn_test_orders o
    where case when vendor_ref is null then o.user_id = account
      else admin and o.order_data #>> '{vendor,id}' = vendor_ref end
  ), page as (
    select * from orders order by created_at desc, id limit 30 offset greatest(0, coalesce(page_offset,0))
  )
  select jsonb_build_object('today', (select count(*) from orders where created_at >= today),
    'count', (select count(*) from orders),
    'can_manage_menu', vendor_ref is not null and exists (
      select 1 from public.vendors v where v.id = vendor_ref and v.owner_id = account),
    'items', (select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id),'[]') from page p))
  into result;
  return result;
end;
$$;
revoke all on function public.sn_profile_orders(text,integer) from public, anon;
grant execute on function public.sn_profile_orders(text,integer) to authenticated;

create function public.sn_submit_test_order_batch(batch jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  request jsonb;
  placed jsonb;
  results jsonb := '[]';
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  if jsonb_typeof(batch) is distinct from 'array' or jsonb_array_length(batch) not between 2 and 8
     or (select count(distinct value->>'order_id') from jsonb_array_elements(batch)) <> jsonb_array_length(batch) then
    raise exception 'Invalid delivery batch' using errcode = '22023';
  end if;
  for request in select value from jsonb_array_elements(batch) loop
    placed := public.sn_submit_test_order((request->>'order_id')::uuid, request->'payload');
    if placed->>'error' = 'insufficient_test_credit' then
      raise exception 'Insufficient test credit for batch' using errcode = 'P0002';
    end if;
    results := results || jsonb_build_array(placed);
  end loop;
  return jsonb_build_object('orders',results,'balance_cents',placed->'balance_cents');
exception when no_data_found then
  return jsonb_build_object('error','insufficient_test_credit');
end;
$$;
revoke all on function public.sn_submit_test_order_batch(jsonb) from public, anon;
grant execute on function public.sn_submit_test_order_batch(jsonb) to authenticated;

create function public.sn_append_vendor_menu(vendor_ref text, products jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  updated jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  if jsonb_typeof(products) is distinct from 'array' or jsonb_array_length(products) not between 1 and 200
    or pg_column_size(products) > 512000 then
    raise exception 'Invalid menu' using errcode = '22023';
  end if;
  update public.vendors v set items = coalesce(v.items, '[]') || products
    where v.id = vendor_ref and v.owner_id = auth.uid() and jsonb_typeof(coalesce(v.items,'[]')) = 'array'
    and jsonb_array_length(coalesce(v.items,'[]')) + jsonb_array_length(products) <= 500
    returning v.items into updated;
  if not found then raise exception 'Menu unavailable or item limit exceeded' using errcode = '42501'; end if;
  return updated;
end;
$$;
revoke all on function public.sn_append_vendor_menu(text,jsonb) from public, anon;
grant execute on function public.sn_append_vendor_menu(text,jsonb) to authenticated;
