-- KOYAL AI profile photo storage.
-- Stores image files in Supabase Storage and the public image URL in auth.users metadata.
-- The first folder segment must match the authenticated user's UUID.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'koyal-profile-photos',
  'koyal-profile-photos',
  true,
  900000,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can upload their own KOYAL profile photo" on storage.objects;
create policy "Users can upload their own KOYAL profile photo"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'koyal-profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can view their own KOYAL profile photo objects" on storage.objects;
create policy "Users can view their own KOYAL profile photo objects"
on storage.objects for select to authenticated
using (
  bucket_id = 'koyal-profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can update their own KOYAL profile photo" on storage.objects;
create policy "Users can update their own KOYAL profile photo"
on storage.objects for update to authenticated
using (
  bucket_id = 'koyal-profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'koyal-profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can delete their own KOYAL profile photo" on storage.objects;
create policy "Users can delete their own KOYAL profile photo"
on storage.objects for delete to authenticated
using (
  bucket_id = 'koyal-profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
