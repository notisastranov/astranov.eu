create function public.sn_owner_roles(data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  target uuid; u auth.users%rowtype; meta jsonb; names jsonb; role_name text:=data->>'role';
  enabled boolean; founder boolean; all_roles text[]:=array['client','vendor','driver','support','ambassador','partner','admin','owner'];
  alias_name text;
begin
  if not exists(select 1 from auth.users where id=auth.uid() and (
    (email_confirmed_at is not null and lower(email)='notisastranov@gmail.com') or
    raw_app_meta_data->>'role'='owner' or (raw_app_meta_data->'roles') ? 'owner')) then raise insufficient_privilege; end if;
  if data->>'vendor' is not null then select owner_id into target from public.vendors where id=data->>'vendor';
  elsif data->>'account' ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then target:=(data->>'account')::uuid; end if;
  select * into u from auth.users where id=target for update;
  if not found then return jsonb_build_object('ok',true,'linked',false); end if;
  founder:=coalesce(u.email_confirmed_at is not null and lower(u.email)='notisastranov@gmail.com',false);
  meta:=coalesce(u.raw_app_meta_data,'{}');
  names:=coalesce(meta->'roles','[]');
  if data->>'kind'='owner-role-set' then
    if role_name is null or not role_name=any(all_roles) or jsonb_typeof(data->'enabled') is distinct from 'boolean' then raise invalid_parameter_value; end if;
    enabled:=(data->>'enabled')::boolean;
    alias_name:=case role_name when 'driver' then 'delivery_driver' when 'client' then 'user' when 'admin' then 'super_admin' else role_name end;
    names:=names-role_name-alias_name;
    if enabled then names:=names||jsonb_build_array(role_name);
    elsif meta->>'role' in (role_name,alias_name) then meta:=meta-'role'; end if;
    meta:=meta||jsonb_build_object('roles',names,'role_switches',coalesce(meta->'role_switches','{}')||jsonb_build_object(role_name,enabled));
    update auth.users set raw_app_meta_data=meta where id=target;
  end if;
  return jsonb_build_object('ok',true,'linked',true,'name',u.raw_user_meta_data->>'full_name','id',u.id,'email',u.email,'phone',u.phone,
    'switches',(select jsonb_object_agg(r,coalesce((meta->'role_switches'->>r)::boolean,founder or names ? r or coalesce(meta->>'role'=r,false)
    or (r='admin' and (names ? 'super_admin' or coalesce(meta->>'role'='super_admin',false))) or (r='driver' and (names ? 'delivery_driver' or coalesce(meta->>'role'='delivery_driver',false))) or r='client')) from unnest(all_roles) r));
end $$;
revoke all on function public.sn_owner_roles(jsonb) from public,anon;
grant execute on function public.sn_owner_roles(jsonb) to authenticated;
-- The verified creator starts with every ecosystem role. Preserve unrelated metadata.
update auth.users set raw_app_meta_data=coalesce(raw_app_meta_data,'{}')||jsonb_build_object('roles',
 (select jsonb_agg(distinct r) from jsonb_array_elements_text(coalesce(raw_app_meta_data->'roles','[]')||
 '["client","vendor","driver","support","ambassador","partner","admin","owner"]'::jsonb) r))
where email_confirmed_at is not null and lower(email)='notisastranov@gmail.com';
