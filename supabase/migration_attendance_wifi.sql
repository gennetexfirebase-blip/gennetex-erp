-- Ирц бүртгэх байршил бүрт офисын WiFi роутерийн IP (ж: 192.168.1.1)
-- Ажилтан зөвхөн GPS geofence + ижил WiFi subnet дээр байхад л шууд ирц бүртгүүлнэ.

alter table public.attendance_locations
  add column if not exists wifi_gateway_ip text;

comment on column public.attendance_locations.wifi_gateway_ip is
  'Офисын WiFi роутерийн IP. Төхөөрөмжийн локал IP ижил /24 subnet-д байвал onsite гэж тооцно.';
