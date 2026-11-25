create table public.sn_radar_players (
 account uuid not null, kind text not null, room text not null, team text not null,
 label text not null, discoverable boolean not null, lat float8 not null, lng float8 not null,
 expires timestamptz not null, primary key(account,kind)
);
alter table public.sn_radar_players enable row level security;
revoke all on public.sn_radar_players from public,anon,authenticated;
create function public.sn_radar_game(data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); room_key text:=lower(trim(data->>'room')); pos_lat float8:=(data->>'lat')::float8; pos_lng float8:=(data->>'lng')::float8;
begin
 if me is null then raise insufficient_privilege; end if;
 delete from public.sn_radar_players where expires<=now();
 if data->>'kind'='radar-leave' then
   delete from public.sn_radar_players where account=me;
   return jsonb_build_object('ok',true,'points','[]'::jsonb);
 end if;
 if length(room_key) not between 8 and 80 or room_key is null or not coalesce(abs(pos_lat)<=90 and abs(pos_lng)<=180,false) then raise invalid_parameter_value; end if;
 if data->>'kind'='radar-share' then
   if data->>'marker' not in ('player','drone') then raise invalid_parameter_value; end if;
   delete from public.sn_radar_players where account=me and room<>room_key;
   insert into public.sn_radar_players values(me,data->>'marker',room_key,left(trim(data->>'team'),40),left(trim(data->>'label'),60),
   coalesce((data->>'discoverable')::boolean,false),pos_lat,pos_lng,now()+interval '15 minutes')
   on conflict(account,kind) do update set room=excluded.room,team=excluded.team,label=excluded.label,discoverable=excluded.discoverable,
    lat=excluded.lat,lng=excluded.lng,expires=excluded.expires;
 end if;
 return jsonb_build_object('ok',true,'points',(select coalesce(jsonb_agg(to_jsonb(p)),'[]') from
 (select team,label,kind,lat,lng from public.sn_radar_players where expires>now() and
 (room=room_key or (discoverable and coalesce((data->>'nearby')::boolean,false) and
 sin(radians(lat-pos_lat)/2)^2+cos(radians(lat))*cos(radians(pos_lat))*sin(radians(lng-pos_lng)/2)^2<=sin(5.0/12742)^2))
 order by team,label limit 100) p));
end $$;
revoke all on function public.sn_radar_game(jsonb) from public,anon;
grant execute on function public.sn_radar_game(jsonb) to authenticated;
