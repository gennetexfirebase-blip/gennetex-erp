# Gennetex ERP — Админ веб хяналт

Ажилчдын **байршил, ирц, очсон лог, аялал**-ыг хөтчөөс хянах нэг файлтай самбар.
Build хийх шаардлагагүй — Supabase болон Leaflet-ийг CDN-ээс ачаална.

## Ажиллуулах

### Арга 1 — Локал сервер (зөвлөж байна)
```bash
cd admin-web
python3 -m http.server 5500
```
Дараа нь хөтчөөр нээ: http://localhost:5500

> `file://`-ээр шууд нээхэд зарим хөтөч Supabase хүсэлтийг блоклодог тул серверээр нээх нь найдвартай.

### Арга 2 — Vercel (production)

> **Чухал:** Vercel дээр зөвхөн `admin-web/` (админ самбар) байршуулна.  
> Утасны апп (`index.js`, Expo) Vercel дээр ажиллахгүй — Expo Go эсвэл EAS build ашиглана.

Репозитори: https://github.com/ModulesoftLLC/gennetex

Төслийн root дээр `vercel.json` байгаа — `admin-web` хавтсыг static гэж serve хийнэ.

**Vercel тохиргоо (Import project):**

| Талбар | Утга |
|--------|------|
| Root Directory | *(хоосон — repo root)* эсвэл `admin-web` |
| Framework Preset | Other |
| Build Command | *(хоосон)* |
| Output Directory | `admin-web` *(root-оос deploy хийвэл `vercel.json` автоматаар)* |

`registerRootComponent` алдаа гарвал: Vercel буруу Expo аппыг build хийж байна. Дээрх тохиргоогоор **зөвхөн admin-web** deploy хийнэ.

Deploy дууссаны дараа:

1. **Supabase** → Authentication → URL Configuration:
   - **Site URL:** `https://ТАНЫ-АПП.vercel.app`
   - **Redirect URLs:** `https://ТАНЫ-АПП.vercel.app/**`
2. Хөтчөөр Vercel URL нээгээд админаар нэвтэрнэ (`admin@gennetex.mn` эсвэл `superadmin@gennetex.mn`).
3. Зураг/лого харагдахгүй бол Root Directory `admin-web` гэж зөв сонгосон эсэхээ шалгана.

### Арга 3 — GitHub Pages / бусад hosting

## Нэвтрэх
- Зөвхөн **admin эрхтэй** хэрэглэгч нэвтэрнэ (ж: `admin@gennetex.mn`).
- Админ биш бол автоматаар гарна.

## Боломжууд
- 📊 Статистик: ажилтан, online, өнөөдрийн ирц, машины тоо
- 🗺️ Газрын зураг (OpenStreetMap) дээр ажилчдын real-time байршил (15 сек тутам шинэчлэгдэнэ)
- 👥 Ажилчид — online/offline төлөв, сүүлд идэвхтэй байсан хугацаа
- 📸 Ирц — selfie зурагтай
- 🏠 Очсон лог — хэн хэзээ айлд очсон
- 🚗 Аялал — машин, зам (км), түлш, зардал

## Лого

| Файл | Зориулалт |
|------|-----------|
| `assets/logo.png` | Үндсэн эх сурвалж (апп + вэб) |
| `admin-web/logo.png` | Админ самбар — нэвтрэх, sidebar, favicon |
| `admin-web/report-logo.png` | Тайлан, PDF modal дээрх лого |

Deploy хийхэд `npm run build` (`scripts/build-web.js`) автоматаар `assets/logo.png`-ийг `admin-web/` болон `dist-web/gennetex/admin/` руу хуулна.

Production URL: `https://adiya.site/gennetex/admin/logo.png`

## Гэрэл / Харанхуй горим

Баруун дээд буланд 🌙/☀️ товч — нэвтрэх хуудас болон самбар хоёуланд ажиллана. Сонголт `localStorage.theme`-д хадгалагдана.

## Тохиргоо
`index.html` доторх `SUPABASE_URL`, `SUPABASE_ANON_KEY` нь аппын `.env`-тэй ижил байна.
Төслөө сольвол эдгээрийг шинэчил.
