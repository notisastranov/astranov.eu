create table public.sn_listing_requests (
  id uuid primary key default gen_random_uuid(),
  account uuid not null references auth.users(id),
  vendor_ref text not null references public.vendors(id),
  kind text not null,
  note text,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);
alter table public.sn_listing_requests enable row level security;
revoke all on public.sn_listing_requests from anon,authenticated;
create function public.sn_listing_action(data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 actor uuid := auth.uid();
 shop public.vendors%rowtype;
 stop jsonb;
 line jsonb;
 ticket public.sn_listing_requests%rowtype;
 admin boolean;
begin
 if actor is null then raise insufficient_privilege; end if;
 select * into strict shop from public.vendors where id=data->>'vendor_ref' and is_active for update;
 select coalesce(raw_app_meta_data->>'role' in ('admin','owner','super_admin'),false)
   or coalesce((raw_app_meta_data->'roles') ?| array['owner','admin','super_admin'],false)
   or (email_confirmed_at is not null and lower(email)='notisastranov@gmail.com')
 into admin from auth.users where id=actor;
 case data->>'kind'
 when 'review' then
   if not coalesce(admin,false) and actor is distinct from shop.owner_id then raise insufficient_privilege; end if;
   return jsonb_build_object('ok',true,'requests',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from
     (select id,kind,note from public.sn_listing_requests where vendor_ref=shop.id and approved_at is null and kind in ('menu','claim')
      and (kind='menu' or admin) order by created_at) r));
 when 'approve' then
   select * into strict ticket from public.sn_listing_requests where id=(data->>'id')::uuid and vendor_ref=shop.id and approved_at is null and kind in ('menu','claim') for update;
   if ticket.kind='claim' then
     if not coalesce(admin,false) or shop.owner_id is not null then raise insufficient_privilege; end if;
     update public.vendors set owner_id=ticket.account where id=shop.id;
   else
     if not coalesce(admin,false) and actor is distinct from shop.owner_id then raise insufficient_privilege; end if;
     update public.vendors set items=coalesce(items,'[]') || jsonb_build_array(ticket.note::jsonb) where id=shop.id;
   end if;
   update public.sn_listing_requests set approved_at=now() where id=ticket.id;
 when 'claim','menu' then
   if length(trim(coalesce(data->>'note',''))) not between 1 and 1200 then raise exception 'Invalid submission'; end if;
   if data->>'kind'='menu' and (coalesce((data->>'note')::jsonb->>'price','') !~ '^[0-9]{1,5}(\.[0-9]{1,2})?$'
     or length(coalesce((data->>'note')::jsonb->>'name','')) not between 1 and 80) then raise exception 'Invalid item'; end if;
   insert into public.sn_listing_requests(account,vendor_ref,kind,note) values(actor,shop.id,data->>'kind',data->>'note');
 when 'order' then
   if jsonb_typeof(data->'drops') is distinct from 'array' or jsonb_array_length(data->'drops') not between 1 and 8
    or jsonb_typeof(data->'items') is distinct from 'array' or jsonb_array_length(data->'items') not between 1 and 50 then raise exception 'Invalid order'; end if;
   for line in select value from jsonb_array_elements(data->'items') loop
     if coalesce(line->>'qty','') !~ '^[1-9][0-9]?$' or length(coalesce(line->>'name','')) not between 1 and 150 then raise exception 'Invalid order item'; end if;
   end loop;
   insert into public.sn_listing_requests(id,account,vendor_ref,kind) values((data->>'request_id')::uuid,actor,shop.id,'order')
    on conflict(id) do nothing;
   if not found then
     if not exists(select 1 from public.sn_listing_requests where id=(data->>'request_id')::uuid and account=actor and vendor_ref=shop.id and kind='order') then raise insufficient_privilege; end if;
     return '{"ok":true}'::jsonb;
   end if;
   for stop in select value from jsonb_array_elements(data->'drops') loop
     if not coalesce((stop->>'lat')::float between -90 and 90 and (stop->>'lng')::float between -180 and 180,false) then raise exception 'Invalid destination'; end if;
     insert into public.orders(vendor_id,vendor_name,customer_id,items,status,delivery_address,delivery_lat,delivery_lng,channel)
     values(shop.id,shop.name,actor,data->'items','pending',left(stop->>'name',100),(stop->>'lat')::float,(stop->>'lng')::float,'listing_request');
   end loop;
 else raise exception 'Unknown action';
 end case;
 return '{"ok":true}'::jsonb;
end;
$$;
revoke all on function public.sn_listing_action(jsonb) from public,anon;
grant execute on function public.sn_listing_action(jsonb) to authenticated;
