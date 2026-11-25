create or replace function public.sn_profile_chat(data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); peer uuid; rows jsonb; unread bigint;
begin
 if me is null then raise insufficient_privilege; end if;
 if data->>'kind'='chat-list' then
   return jsonb_build_object('ok',true,'threads',(select coalesce(jsonb_agg(to_jsonb(t) order by recent desc),'[]') from (
     select case when d.sender=me then d.recipient else d.sender end as peer,
       coalesce(nullif(u.raw_user_meta_data->>'full_name',''),'SpaceNet user') as name,
       max(d.created_at) as recent,count(*) filter(where d.recipient=me and d.read_at is null) as unread
     from public.sn_direct_messages d join auth.users u on u.id=case when d.sender=me then d.recipient else d.sender end
     where d.sender=me or d.recipient=me group by 1,2) t));
 end if;
 if data->>'vendor' is not null then
   select owner_id into peer from public.vendors where id=data->>'vendor';
 elsif data->>'peer' ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then
   select id into peer from auth.users where id=(data->>'peer')::uuid;
 end if;
 if peer is null then return jsonb_build_object('ok',true,'linked',false); end if;
 if data->>'kind'='chat-send' then
   if length(btrim(coalesce(data->>'text',''))) not between 1 and 1000 then raise invalid_parameter_value; end if;
   insert into public.sn_direct_messages(sender,recipient,body) values(me,peer,btrim(data->>'text'));
 end if;
 select count(*) into unread from public.sn_direct_messages where sender=peer and recipient=me and read_at is null;
 if data->>'kind'<>'chat-count' then
   select coalesce(jsonb_agg(to_jsonb(t) order by created_at,id),'[]') into rows from (
     select id,body,created_at,sender=me as outgoing from public.sn_direct_messages
     where ((sender=peer and recipient=me) or (sender=me and recipient=peer))
     and (data->>'before_time' is null or (created_at,id)<((data->>'before_time')::timestamptz,(data->>'before_id')::uuid))
     order by created_at desc,id desc limit 50) t;
   update public.sn_direct_messages set read_at=now() where sender=peer and recipient=me and read_at is null
   and id in (select (v->>'id')::uuid from jsonb_array_elements(rows) v);
 end if;
 return jsonb_build_object('ok',true,'linked',true,'unread',unread,'rows',rows);
end $$;
revoke all on function public.sn_profile_chat(jsonb) from public,anon;
grant execute on function public.sn_profile_chat(jsonb) to authenticated;
