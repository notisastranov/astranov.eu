-- Only server-issued prepaid purchases create a hold. Keep the original debit,
-- invoice and hold in one transaction and snapshot the amounts and payees.
create table public.sn_order_holds (
 id uuid primary key, buyer uuid not null, vendor uuid, driver uuid, name text not null,
 goods numeric(14,2) not null check(goods>=0), delivery numeric(14,2) not null check(delivery>=0),
 total numeric(14,2) not null check(total>=goods+delivery),
 state text not null default 'held', votes jsonb not null default '{}',
 origin jsonb, destination jsonb, created timestamptz not null default now()
);
create table public.sn_order_statements (
 id bigint generated always as identity primary key, order_id uuid not null references public.sn_order_holds,
 author uuid not null, role text not null, decision text not null, explanation text not null,
 created timestamptz not null default now()
);
alter table public.sn_order_holds enable row level security;
alter table public.sn_order_statements enable row level security;
revoke all on public.sn_order_holds,public.sn_order_statements from public,anon,authenticated;
create index sn_order_statements_order on public.sn_order_statements(order_id,id);
alter function public.sn_create_marketplace_order(jsonb,boolean) rename to sn_create_marketplace_order_before_holds;
revoke all on function public.sn_create_marketplace_order_before_holds(jsonb,boolean) from public,anon,authenticated,service_role;
create function public.sn_create_marketplace_order(order_payload jsonb,issue_invoice boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare placed jsonb; calc jsonb; merchant uuid;
begin
 if auth.role() is distinct from 'service_role' then raise insufficient_privilege; end if;
 if issue_invoice then
  select owner_id into merchant from public.vendors where id=order_payload->>'vendor_id';
  if exists(select 1 from public.sn_order_holds where state='review' and
    ((order_payload->>'customer_id')::uuid in (buyer,vendor,driver) or merchant in (buyer,vendor,driver))) then
   return jsonb_build_object('error','order_dispute_under_review');
  end if;
  if merchant is null then return jsonb_build_object('error','vendor_payment_account_required'); end if;
 end if;
 placed:=public.sn_create_marketplace_order_before_holds(order_payload,issue_invoice);
 if issue_invoice and not placed ? 'error' then
  calc:=placed->'calc';
  insert into public.sn_order_holds(id,buyer,vendor,name,goods,delivery,total,origin,destination)
  values((placed->>'id')::uuid,(placed->>'customer_id')::uuid,merchant,coalesce(placed->>'vendor_name','Vendor'),
   (calc->>'subtotal_eur')::numeric,(calc->>'delivery_eur')::numeric,(calc->>'total_avc')::numeric,
   jsonb_build_array(placed->'vendor_lat',placed->'vendor_lng'),jsonb_build_array(placed->'delivery_lat',placed->'delivery_lng'));
 end if;
 return placed;
end $$;
revoke all on function public.sn_create_marketplace_order(jsonb,boolean) from public,anon,authenticated;
grant execute on function public.sn_create_marketplace_order(jsonb,boolean) to service_role;

create function public.sn_hold_driver() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.role()='service_role' and new.driver_accepted_at is not null then
  if exists(select 1 from public.sn_order_holds where id=new.id and driver is null)
   and exists(select 1 from public.sn_order_holds where state='review' and new.driver_id in(buyer,vendor,driver))
   then raise exception 'Driver has an order under review'; end if;
  update public.sn_order_holds set driver=new.driver_id where id=new.id and driver is null;
 end if;
 return new;
end $$;
create trigger sn_hold_driver after update of driver_accepted_at on public.orders for each row execute function public.sn_hold_driver();

create function public.sn_hold_action(details jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); h public.sn_order_holds%rowtype; role0 text:=details->>'role';
 decision text:=details->>'decision'; note text:=coalesce(details->>'note',''); admin0 boolean; final0 text;
begin
 if me is null then raise insufficient_privilege; end if;
 select coalesce(raw_app_meta_data->>'role' in ('admin','super_admin','owner') or
  raw_app_meta_data->'roles' ?| array['admin','super_admin','owner'] or
  (email_confirmed_at is not null and lower(email)='notisastranov@gmail.com'),false)
 into admin0 from auth.users where id=me;
 if details->>'id' is null then
  return jsonb_build_object('orders',coalesce((select jsonb_agg(to_jsonb(q)) from
   (select id,name,state,origin,destination,goods,delivery,total,votes,created,
    array_remove(array[case when buyer=me then 'buyer' end,case when vendor=me then 'vendor' end,
    case when driver=me then 'driver' end,case when admin0 and state='review' then 'admin' end],null) roles
    from public.sn_order_holds where me in (buyer,vendor,driver) or (admin0 and state='review')
    order by created desc limit 100) q),'[]'));
 end if;
 select * into h from public.sn_order_holds where id=(details->>'id')::uuid for update;
 if not found or not coalesce(me in(h.buyer,h.vendor,h.driver) or (admin0 and h.state='review'),false) then raise insufficient_privilege; end if;
 if decision is not null then
  if h.state not in ('held','disputed','review') or length(note)>1500 then raise invalid_parameter_value; end if;
  if not coalesce(case role0 when 'buyer' then me=h.buyer when 'driver' then me=h.driver when 'vendor' then me=h.vendor
   when 'admin' then admin0 and h.state='review' else false end,false) then raise insufficient_privilege; end if;
  if decision not in ('delivered','refund','driver_damage','review','note') then raise invalid_parameter_value; end if;
  if h.state='review' and role0<>'admin' and decision<>'note' then raise insufficient_privilege; end if;
  if decision='review' then h.state:='review';
  elsif decision<>'note' then
   h.votes:=jsonb_set(h.votes,array[role0],to_jsonb(decision));
   if decision<>'delivered' then h.state:='disputed'; end if;
   if role0='admin' or (h.votes->>'buyer'=decision and h.votes->>'vendor'=decision and h.votes->>'driver'=decision) then final0:=decision; end if;
  end if;
  if final0='driver_damage' then
   if h.driver is null then raise invalid_parameter_value; end if;
   update public.balance_ledger set balance=balance-h.goods,updated_at=now() where user_id=h.driver and balance>=h.goods;
   if not found then final0:=null; h.state:='review'; end if;
  end if;
  if final0 in ('refund','driver_damage') then
   update public.balance_ledger set balance=balance+h.total,updated_at=now() where user_id=h.buyer;
   if not found then raise exception 'Buyer wallet missing'; end if;
  end if;
  if final0 in ('delivered','driver_damage') then
   insert into public.balance_ledger(user_id,balance) values(h.vendor,h.goods)
   on conflict(user_id) do update set balance=public.balance_ledger.balance+excluded.balance,updated_at=now();
  end if;
  if final0='delivered' then
   insert into public.balance_ledger(user_id,balance) values(h.driver,h.delivery)
   on conflict(user_id) do update set balance=public.balance_ledger.balance+excluded.balance,updated_at=now();
  end if;
  insert into public.sn_order_statements(order_id,author,role,decision,explanation) values(h.id,me,role0,decision,note);
  update public.sn_order_holds set state=coalesce(final0,h.state),votes=h.votes where id=h.id;
 end if;
 return jsonb_build_object('ok',true,'history',(select coalesce(jsonb_agg(jsonb_build_object('role',role,'decision',s.decision,'note',explanation,'at',created) order by id),'[]') from public.sn_order_statements s where order_id=h.id));
end $$;
revoke all on function public.sn_hold_action(jsonb) from public,anon;
grant execute on function public.sn_hold_action(jsonb) to authenticated;

-- Older service clients must also respect the hold.
create function public.sn_guard_held_movement() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.sn_order_holds where id=new.order_id) then raise exception 'Order requires verified settlement'; end if;
 return new;
end $$;
create trigger sn_guard_held_movement before insert on public.sn_marketplace_movements for each row execute function public.sn_guard_held_movement();
grant select on public.sn_order_holds to service_role;
