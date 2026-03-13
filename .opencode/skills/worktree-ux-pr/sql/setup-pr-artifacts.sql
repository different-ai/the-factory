create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public)
values ('pr-artifacts', 'pr-artifacts', true)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public;

create table if not exists public.pr_artifacts (
  id uuid primary key default gen_random_uuid(),
  repo text not null,
  pr_number integer not null,
  pr_title text,
  artifact_kind text not null check (artifact_kind in ('image', 'video')),
  label text not null,
  original_filename text not null,
  object_path text not null unique,
  public_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists pr_artifacts_repo_pr_number_created_at_idx
  on public.pr_artifacts (repo, pr_number, created_at desc);

alter table public.pr_artifacts enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.pr_artifacts to anon, authenticated;

drop policy if exists "public can read pr artifacts" on public.pr_artifacts;
create policy "public can read pr artifacts"
on public.pr_artifacts
for select
to anon, authenticated
using (true);
