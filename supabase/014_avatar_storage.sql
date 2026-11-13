-- sirgaZ 014: profile photo storage (PRD V2 §3A requires a photo).
-- Replaces the random i.pravatar.cc stock faces that were saved as real users' avatars.
-- Public-read bucket; each user can only write inside their own <user_id>/ folder.
-- Skips itself when the Supabase storage schema is absent (e.g. plain Postgres in CI).
begin;
do $outer$
begin
  if to_regclass('storage.objects') is null or to_regclass('storage.buckets') is null then
    raise notice 'storage schema not found; skipping 014';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp'])
  on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
                                 allowed_mime_types = excluded.allowed_mime_types;

  execute $p$drop policy if exists avatars_owner_insert on storage.objects$p$;
  execute $p$drop policy if exists avatars_owner_update on storage.objects$p$;
  execute $p$drop policy if exists avatars_owner_delete on storage.objects$p$;
  execute $p$create policy avatars_owner_insert on storage.objects for insert to authenticated
    with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;
  execute $p$create policy avatars_owner_update on storage.objects for update to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
    with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;
  execute $p$create policy avatars_owner_delete on storage.objects for delete to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;
end $outer$;
commit;
