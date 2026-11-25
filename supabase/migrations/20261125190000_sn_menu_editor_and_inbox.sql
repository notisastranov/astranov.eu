create function public.sn_can_edit_menu(vendor_ref text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.vendors v join auth.users u on u.id=auth.uid()
 where v.id=vendor_ref and (v.owner_id=u.id or u.raw_app_meta_data->>'role' in ('admin','super_admin','owner','ambassador')
 or (u.raw_app_meta_data->'roles') ?| array['admin','super_admin','owner','ambassador']
 or (u.email_confirmed_at is not null and lower(u.email)='notisastranov@gmail.com')))
$$;
create or replace function public.sn_append_vendor_menu(vendor_ref text,products jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare updated jsonb;
begin
 if not public.sn_can_edit_menu(vendor_ref) then raise insufficient_privilege; end if;
 if jsonb_typeof(products) is distinct from 'array' or jsonb_array_length(products) not between 1 and 200 or pg_column_size(products)>512000 then raise exception 'Invalid menu'; end if;
 update public.vendors set items=coalesce(items,'[]')||products where id=vendor_ref and jsonb_array_length(coalesce(items,'[]'))+jsonb_array_length(products)<=500 returning items into strict updated;
 return updated;
end;
$$;
alter table public.orders add column if not exists vendor_seen_at timestamptz, add column if not exists delivery_deadline timestamptz;
create function public.sn_vendor_inbox(data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 if data->>'seen' is not null then
   update public.orders o set vendor_seen_at=now() from public.vendors v where o.id=(data->>'seen')::uuid and v.id=o.vendor_id and v.owner_id=auth.uid();
 end if;
 return jsonb_build_object('ok',true,'items',(select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc),'[]') from
 (select o.id,o.created_at,v.id as vendor_id,v.name,o.items,o.delivery_deadline,o.vendor_seen_at
 from public.orders o join public.vendors v on v.id=o.vendor_id where v.owner_id=auth.uid() and o.channel='listing_request'
 and (case when data->>'vendor' is null then o.vendor_seen_at is null else v.id=data->>'vendor' end)
 order by o.created_at desc limit 40) r));
end;
$$;
create function public.sn_order_freshness() returns trigger language plpgsql set search_path='' as $$
declare deadline timestamptz;
begin
 if new.channel='listing_request' and tg_op='INSERT' then
   select min((m->>'produced_at')::timestamptz + make_interval(mins=>(m->>'lifetime_minutes')::integer)) into deadline
   from public.vendors v cross join lateral jsonb_array_elements(v.items) m where v.id=new.vendor_id
   and m ? 'produced_at' and exists(select 1 from jsonb_array_elements(new.items) i where i->>'name'=m->>'name');
   if deadline <= now() then raise exception 'Product shelf life exceeded'; end if;
   new.delivery_deadline:=deadline;
 end if;
 if new.delivery_deadline <= now() and new.status in ('delivered','completed') then new.status:='spoiled'; end if;
 return new;
end;
$$;
create trigger sn_order_freshness before insert or update of status on public.orders for each row execute function public.sn_order_freshness();
revoke all on function public.sn_can_edit_menu(text),public.sn_vendor_inbox(jsonb) from public,anon;
grant execute on function public.sn_can_edit_menu(text),public.sn_vendor_inbox(jsonb) to authenticated;

create table public.sn_direct_messages(
 id uuid primary key default gen_random_uuid(), sender uuid not null references auth.users(id),
 recipient uuid not null references auth.users(id), body text not null check(length(body) between 1 and 1000),
 created_at timestamptz not null default now(), read_at timestamptz
);
alter table public.sn_direct_messages enable row level security;
revoke all on public.sn_direct_messages from public,anon,authenticated;
create index sn_direct_unread on public.sn_direct_messages(recipient,created_at desc) where read_at is null;
create function public.sn_notifications(data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); admin boolean; who uuid; team text; updates integer;
begin
 if actor is null then raise insufficient_privilege; end if;
 select coalesce(raw_app_meta_data->>'role' in ('admin','super_admin','owner'),false)
 or coalesce((raw_app_meta_data->'roles') ?| array['admin','super_admin','owner'],false)
 or (email_confirmed_at is not null and lower(email)='notisastranov@gmail.com') into admin from auth.users where id=actor;
 if data->>'kind'='message' then
   team:=data->>'team';
   if team is not null and team not in ('ambassador','admin','owner') then raise exception 'Unknown role'; end if;
   if team is null then
     if data->>'vendor' is not null then select owner_id into who from public.vendors where id=data->>'vendor';
     else who:=(data->>'recipient')::uuid; end if;
     if who is null then raise exception 'Recipient has not joined'; end if;
   end if;
   insert into public.sn_direct_messages(sender,recipient,body)
   select actor,id,btrim(data->>'text') from auth.users where id=who or
    (team is not null and (raw_app_meta_data->>'role'=team or (raw_app_meta_data->'roles') ? team
    or team='admin' and (raw_app_meta_data->>'role'='super_admin' or (raw_app_meta_data->'roles') ? 'super_admin')
    or team='owner' and lower(email)='notisastranov@gmail.com' and email_confirmed_at is not null));
   get diagnostics updates=row_count;
   if updates=0 then raise exception 'Recipient unavailable'; end if;
   return '{"ok":true}';
 elsif data->>'kind'='message-read' then
   update public.sn_direct_messages set read_at=now() where id=(data->>'id')::uuid and recipient=actor;
 elsif data->>'kind'='order-status' then
   if data->>'status' not in ('accepted','declined') then raise exception 'Invalid status'; end if;
   update public.orders o set status=case when o.delivery_deadline<=now() then 'spoiled' else data->>'status' end
   from public.vendors v where o.id=(data->>'id')::uuid and o.vendor_id=v.id and o.status='pending'
   and o.channel='listing_request' and (v.owner_id=actor or admin);
   if not found then raise insufficient_privilege; end if;
 end if;
 return jsonb_build_object('ok',true,'messages',(select coalesce(jsonb_agg(to_jsonb(m)),'[]') from
  (select d.id,d.sender,d.body,d.created_at,coalesce(nullif(u.raw_user_meta_data->>'full_name',''),'SpaceNet user') as name
   from public.sn_direct_messages d join auth.users u on u.id=d.sender where recipient=actor and read_at is null order by d.created_at desc limit 50) m),
  'thread',(select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc),'[]') from
   (select id,body,created_at,sender=actor as outgoing from public.sn_direct_messages
    where (sender=actor and recipient=(select owner_id from public.vendors where id=data->>'vendor')) or
    (recipient=actor and sender=(select owner_id from public.vendors where id=data->>'vendor'))
    or (sender=actor and recipient::text=data->>'peer') or (recipient=actor and sender::text=data->>'peer')
    order by created_at desc limit 40) t),
  'counts',(select coalesce(jsonb_object_agg(vendor_id,n),'{}') from
   (select o.vendor_id,count(*) n from public.orders o join public.vendors v on v.id=o.vendor_id where (admin or v.owner_id=actor)
    and o.status='pending' group by o.vendor_id) c),
  'pending',(select coalesce(jsonb_agg(to_jsonb(p)),'[]') from
   (select o.id,o.created_at,o.items,o.channel,o.delivery_deadline from public.orders o join public.vendors v on v.id=o.vendor_id
   where o.vendor_id=data->>'vendor' and o.status='pending' and (admin or v.owner_id=actor) order by o.created_at desc limit 100) p));
end;
$$;
revoke all on function public.sn_notifications(jsonb) from public,anon;
grant execute on function public.sn_notifications(jsonb) to authenticated;
create function public.sn_replace_menu_item(vendor_ref text,position_idx int,previous jsonb,product jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare updated jsonb;
begin
 if not public.sn_can_edit_menu(vendor_ref) then raise insufficient_privilege; end if;
 if position_idx<0 or jsonb_typeof(product) is distinct from 'object' or pg_column_size(product)>16000 then raise exception 'Invalid product'; end if;
 update public.vendors set items=jsonb_set(items,array[position_idx::text],product,false) where id=vendor_ref and items->position_idx=previous returning items into strict updated;
 return updated;
end;
$$;
revoke all on function public.sn_replace_menu_item(text,int,jsonb,jsonb) from public,anon;
grant execute on function public.sn_replace_menu_item(text,int,jsonb,jsonb) to authenticated;
