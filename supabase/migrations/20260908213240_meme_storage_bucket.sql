insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('memes', 'memes', true, 5242880, array['image/jpeg','image/png','image/gif','image/webp'])
on conflict (id) do nothing;

-- Public read (memes need to actually display), public insert (same
-- wallet-gated-client-side-only precedent as the memes table itself — no
-- real server-side identity check exists in this project). No update/delete
-- policy at all: uploads are immutable once posted, matching "publish
-- instantly, report to flag" rather than allowing silent edits.
drop policy if exists "meme_images_public_read" on storage.objects;
create policy "meme_images_public_read" on storage.objects for select
  using (bucket_id = 'memes');

drop policy if exists "meme_images_insert" on storage.objects;
create policy "meme_images_insert" on storage.objects for insert
  with check (bucket_id = 'memes');
