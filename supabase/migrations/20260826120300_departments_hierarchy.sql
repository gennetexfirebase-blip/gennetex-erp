-- ============================================================================
-- ХЭЛТСИЙН МОД (parent_id) — Admin "Алба хэлтэс" tree харагдац
-- ============================================================================
-- Нэмэлт багана л нэмнэ (одоо байгаа `departments`-ийг ашигладаг бусад
-- дэлгэц/query бүгд `id`/`name`-ээр ажилладаг тул нөлөөлөхгүй).
-- ============================================================================

alter table public.departments
  add column if not exists parent_id uuid references public.departments(id) on delete set null;

create index if not exists departments_parent_idx on public.departments (parent_id);

notify pgrst, 'reload schema';
