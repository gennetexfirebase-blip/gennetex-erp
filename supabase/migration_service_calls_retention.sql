-- Дуудлага 24 цагийн дараа устгах эрх (инженерийн апп автоматаар цэвэрлэнэ)

grant delete on public.service_calls to anon, authenticated;

notify pgrst, 'reload schema';
