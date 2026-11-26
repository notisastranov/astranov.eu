-- Register the ordering driver's fresh location before the nearest-driver search.
alter table public.sn_driver_dispatch add column picked_up_at timestamptz;
alter function public.sn_dispatch(text,jsonb) rename to sn_dispatch_before_tracking;
revoke all on function public.sn_dispatch_before_tracking(text,jsonb) from public,anon,authenticated;
create function public.sn_dispatch(action text,details jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare me uuid:=auth.uid(); result jsonb; fix jsonb:=details->'driver_position';
begin
 if me is null then raise insufficient_privilege; end if;
 if action='create' and abs((fix->>'lat')::float8)<=90 and abs((fix->>'lng')::float8)<=180 then
  perform pg_advisory_xact_lock(86114465);
  insert into sn_driver_presence(account,lat,lng,seen) values(me,(fix->>'lat')::float8,(fix->>'lng')::float8,clock_timestamp())
  on conflict(account) do update set lat=excluded.lat,lng=excluded.lng,seen=excluded.seen;
 end if;
 if action='collect' then
  perform pg_advisory_xact_lock(86114465);
  update sn_driver_dispatch set picked_up_at=coalesce(picked_up_at,now()) where id=(details->>'id')::uuid and driver=me and state='paid';
  if not found then return jsonb_build_object('error','assignment_changed'); end if;
  result:=sn_dispatch_before_tracking('poll','{}');
 else
  result:=sn_dispatch_before_tracking(action,details);
 end if;
 if result ? 'error' then return result; end if;
 return result || jsonb_build_object('tracking',(select coalesce(jsonb_agg(to_jsonb(t) order by t.created desc),'[]') from
  (select d.id,d.state,d.created,d.picked_up_at,d.buyer=me as mine,d.payload->'vendor' as vendor,d.payload->'drop' as drop,
   case when d.state in ('accepted','paid') and p.seen>now()-interval '30 seconds' then jsonb_build_object('lat',p.lat,'lng',p.lng) end as driver
   from sn_driver_dispatch d left join sn_driver_presence p on p.account=d.driver
   where (d.buyer=me or d.driver=me) and (d.state in ('waiting','offered','accepted','paid') or d.created>now()-interval '1 day')
   order by d.created desc limit 30) t));
end $$;
revoke all on function public.sn_dispatch(text,jsonb) from public,anon;
grant execute on function public.sn_dispatch(text,jsonb) to authenticated;
