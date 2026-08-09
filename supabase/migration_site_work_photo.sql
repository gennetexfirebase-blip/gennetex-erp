-- Ажлын тайлангийн зураг (админ харна)
alter table public.field_site_sessions
  add column if not exists photo_url text;

notify pgrst, 'reload schema';
