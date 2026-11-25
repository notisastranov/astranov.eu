create or replace function public.sn_dispatch(action text, details jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
 me uuid := auth.uid(); r public.sn_driver_dispatch%rowtype; candidate uuid;
 lat0 float8; lng0 float8; id0 uuid; result jsonb; payload0 jsonb; entry jsonb;
begin
 if me is null then raise insufficient_privilege; end if;
 -- Serialize assignment and response transitions, including two simultaneous checkouts.
 perform pg_advisory_xact_lock(86114465);
 if action='presence' then
   lat0 := (details->>'lat')::float8; lng0 := (details->>'lng')::float8;
   if details->>'active'='true' and abs(lat0)<=90 and abs(lng0)<=180 then
     insert into sn_driver_presence values(me,lat0,lng0,clock_timestamp(),null)
       on conflict(account) do update set lat=excluded.lat,lng=excluded.lng,seen=excluded.seen;
   else
     update sn_driver_presence set seen='-infinity' where account=me;
     update sn_driver_dispatch set state='waiting',driver=null where driver=me and state='offered';
   end if;
 elsif action='create' then
   if jsonb_typeof(details->'orders') is distinct from 'array' or jsonb_array_length(details->'orders') not between 1 and 8 then raise invalid_parameter_value; end if;
   for entry in select value from jsonb_array_elements(details->'orders') loop
     id0 := (entry->>'order_id')::uuid; payload0 := entry->'payload';
     if pg_column_size(payload0)>16000 or jsonb_typeof(payload0->'items') is distinct from 'array'
       or coalesce(payload0->>'delivery_cents','') !~ '^[0-9]{1,6}$'
       or coalesce(abs((payload0#>>'{vendor,lat}')::float8)<=90 and abs((payload0#>>'{vendor,lng}')::float8)<=180
       and abs((payload0#>>'{drop,lat}')::float8)<=90 and abs((payload0#>>'{drop,lng}')::float8)<=180,false)=false then raise invalid_parameter_value; end if;
     insert into sn_driver_dispatch(id,buyer,payload) values(id0,me,payload0) on conflict(id) do nothing;
     if not exists(select 1 from sn_driver_dispatch where id=id0 and buyer=me and payload=payload0) then raise unique_violation; end if;
   end loop;
 elsif action in ('accept','decline','complete','pickup','settle') then
   select * into r from sn_driver_dispatch where id=(details->>'id')::uuid;
   if action in ('accept','decline') and r.driver=me and r.state='offered' and r.deadline>clock_timestamp() then
     update sn_driver_dispatch set state=case when action='accept' then 'accepted' else 'waiting' end,
       driver=case when action='accept' then me end, deadline=clock_timestamp()+interval '2 minutes' where id=r.id;
   elsif action='complete' and r.driver=me and r.state='paid' then
     update sn_driver_dispatch set state='done',completed=clock_timestamp() where id=r.id;
     if (select sum((payload->>'delivery_cents')::int) from sn_driver_dispatch where driver=me and completed>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=30000 then
       update sn_driver_presence set resting_until=clock_timestamp()+interval '6 hours' where account=me;
     end if;
   elsif r.buyer=me and ((action='pickup' and r.state='pickup') or (action='settle' and r.state='accepted')) then
     payload0 := r.payload;
     if action='pickup' then payload0 := payload0 || jsonb_build_object('drop',payload0->'vendor','delivery_cents',0,'method','pickup'); end if;
     result := sn_submit_test_order(r.id,payload0);
     if result ? 'error' then
       if action='settle' then update sn_driver_dispatch set state='payment_failed',driver=null where id=r.id; end if;
       return result;
     end if;
     update sn_driver_dispatch set state=case when action='pickup' then 'collected_order' else 'paid' end where id=r.id;
   elsif action='pickup' and r.buyer=me and r.state='collected_order' then
     null; -- Safe retry after a lost confirmation.
   else
     return jsonb_build_object('error','assignment_changed');
   end if;
 elsif action <> 'poll' then raise invalid_parameter_value;
 end if;
 update sn_driver_dispatch set state='pickup',driver=null where state='accepted' and deadline<=clock_timestamp();
 for r in select * from sn_driver_dispatch where state='waiting' or (state='offered' and deadline<=clock_timestamp()) order by created loop
   lat0 := (r.payload#>>'{vendor,lat}')::float8; lng0 := (r.payload#>>'{vendor,lng}')::float8;
   select p.account into candidate from sn_driver_presence p
     cross join lateral (select sin(radians(p.lat-lat0)/2)^2 + cos(radians(lat0))*cos(radians(p.lat))*sin(radians(p.lng-lng0)/2)^2 as distance) d
     where p.seen>clock_timestamp()-interval '30 seconds' and (p.resting_until is null or p.resting_until<=clock_timestamp())
     and not(p.account=any(r.tried)) and d.distance<=sin(25.0/12742)^2
     and not exists(select 1 from sn_driver_dispatch busy where busy.driver=p.account and busy.state in ('offered','accepted','paid'))
     order by d.distance,p.account limit 1;
   -- Give offline drivers a chance to switch on before falling back to pickup.
   if candidate is null and cardinality(r.tried)=0 and r.created > clock_timestamp()-interval '2 minutes' then
     continue;
   end if;
   update sn_driver_dispatch set driver=candidate,state=case when candidate is null then 'pickup' else 'offered' end,
     tried=case when candidate is null then tried else array_append(tried,candidate) end,deadline=clock_timestamp()+interval '13 seconds' where id=r.id;
 end loop;
 select * into r from sn_driver_dispatch where driver=me and state in ('offered','accepted','paid') limit 1;
 return jsonb_build_object('ok',true,'assignment',case when r.id is null then null else jsonb_build_object('id',r.id,'state',r.state,'payload',r.payload,'deadline',r.deadline) end,
 'pending_count',(select count(*) from sn_driver_dispatch q where q.state='waiting' and
   (q.buyer=me or (action='presence' and abs((details->>'lat')::float8)<=90 and abs((details->>'lng')::float8)<=180 and
   sin(radians((q.payload#>>'{vendor,lat}')::float8-(details->>'lat')::float8)/2)^2 +
   cos(radians((details->>'lat')::float8))*cos(radians((q.payload#>>'{vendor,lat}')::float8))*
   sin(radians((q.payload#>>'{vendor,lng}')::float8-(details->>'lng')::float8)/2)^2<=sin(25.0/12742)^2))),
 'checkout',(select jsonb_agg(jsonb_build_object('id',id,'state',state,'vendor',payload->'vendor','items',payload->'items')) from sn_driver_dispatch
 where buyer=me and state in ('pickup','accepted') and created>now()-interval '1 day'));
end $$;
revoke all on function public.sn_dispatch(text,jsonb) from public,anon;
grant execute on function public.sn_dispatch(text,jsonb) to authenticated;
