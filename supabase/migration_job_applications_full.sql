-- Ажилд орох бүрэн анкет — structured JSON + зураг + гарын үсэг

alter table public.job_applications add column if not exists form_data jsonb;
alter table public.job_applications add column if not exists photo_url text;
alter table public.job_applications add column if not exists signature_svg text;
alter table public.job_applications add column if not exists signed_at timestamptz;
alter table public.job_applications add column if not exists pdf_url text;

create index if not exists job_applications_form_data_idx
  on public.job_applications using gin (form_data);

notify pgrst, 'reload schema';
