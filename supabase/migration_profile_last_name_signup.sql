-- Шинэ хэрэглэгч бүртгэхэд овог (last_name) profiles руу хадгалах

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, last_name, email, role, position, phone, must_change_password)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    nullif(trim(new.raw_user_meta_data->>'last_name'), ''),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'employee'),
    new.raw_user_meta_data->>'position',
    new.raw_user_meta_data->>'phone',
    coalesce((new.raw_user_meta_data->>'must_change_password')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

notify pgrst, 'reload schema';
