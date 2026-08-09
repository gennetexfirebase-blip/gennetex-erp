-- Ирц бүртгэл — байршлын зураг (царайны дараа)

alter table public.attendance add column if not exists site_photo_url text;

notify pgrst, 'reload schema';
