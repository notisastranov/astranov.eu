-- Fix Supabase ERROR rls_disabled_in_public for 3 tables (advisor observed 2026-09-25 15:24 UTC).
-- Server writers (edge fn aicycle) use the service role, which bypasses RLS, so metering/transcripts keep working.

-- 1) avc_constitution: signed-in read; owner-only write.
alter table public.avc_constitution enable row level security;
drop policy if exists avc_constitution_read_auth on public.avc_constitution;
create policy avc_constitution_read_auth on public.avc_constitution
  for select to authenticated using (true);
drop policy if exists avc_constitution_owner_write on public.avc_constitution;
create policy avc_constitution_owner_write on public.avc_constitution
  for all to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email','')) = 'notisastranov@gmail.com')
  with check (lower(coalesce(auth.jwt() ->> 'email','')) = 'notisastranov@gmail.com');

-- 2) ai_transcripts: user reads/writes own rows only (profile_id = auth.uid()).
alter table public.ai_transcripts enable row level security;
drop policy if exists ai_transcripts_own_select on public.ai_transcripts;
create policy ai_transcripts_own_select on public.ai_transcripts
  for select to authenticated using (profile_id = auth.uid());
drop policy if exists ai_transcripts_own_insert on public.ai_transcripts;
create policy ai_transcripts_own_insert on public.ai_transcripts
  for insert to authenticated with check (profile_id = auth.uid());

-- 3) ai_subscriptions: user reads/writes own rows only.
alter table public.ai_subscriptions enable row level security;
drop policy if exists ai_subscriptions_own_select on public.ai_subscriptions;
create policy ai_subscriptions_own_select on public.ai_subscriptions
  for select to authenticated using (profile_id = auth.uid());
drop policy if exists ai_subscriptions_own_write on public.ai_subscriptions;
create policy ai_subscriptions_own_write on public.ai_subscriptions
  for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- No anon grants. Remove any blanket anon select.
revoke all on public.ai_transcripts from anon;
revoke all on public.ai_subscriptions from anon;
revoke all on public.avc_constitution from anon;

-- NOTE (not changed here, deliberate): booker_match_config, fs_profiles, fs_settings, sn_sms already have
-- RLS on with no policy = deny-all to anon/authenticated. Leave until a real policy is needed.
-- NOTE: SECURITY DEFINER RPCs / astranov_profiles view left untouched to avoid breaking login/jobs.
