create function public.sn_save_ai_key(provider_id text, credential text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare ref uuid;
begin
  if provider_id not in ('groq','openrouter','gemini') or length(credential) not between 1 and 4096 then
    raise exception 'Invalid provider configuration';
  end if;
  perform pg_advisory_xact_lock(hashtext('sn_ai_' || provider_id));
  select id into ref from vault.secrets where name = 'sn_ai_' || provider_id;
  if ref is null then perform vault.create_secret(credential,'sn_ai_' || provider_id);
  else perform vault.update_secret(ref,credential); end if;
  return true;
end;
$$;
create function public.sn_ai_keys() returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(substr(name,7),decrypted_secret),'{}'::jsonb)
  from vault.decrypted_secrets where name in ('sn_ai_groq','sn_ai_openrouter','sn_ai_gemini');
$$;
revoke all on function public.sn_save_ai_key(text,text), public.sn_ai_keys() from public, anon, authenticated;
grant execute on function public.sn_save_ai_key(text,text), public.sn_ai_keys() to service_role;
