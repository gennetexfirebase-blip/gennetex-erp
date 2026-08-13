-- Дуудлага realtime шинэчлэлт (инженер апп дээр шууд харагдана)
do $$
begin
  execute 'alter publication supabase_realtime add table public.service_calls';
exception when others then null;
end $$;

notify pgrst, 'reload schema';
