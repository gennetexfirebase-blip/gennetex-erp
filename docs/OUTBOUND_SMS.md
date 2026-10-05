# Outbound SMS (sendsms.mn)

Энэ нь verify.mn-ийн MO баталгаажуулалтаас тусдаа, серверээс хэрэглэгч рүү
шууд илгээдэг MT SMS интеграц юм.

## Environment

Vercel server runtime-д дараах secret-үүдийг тохируулна:

```env
SMS_PROVIDER=sendsms
SMS_API_URL=https://api.sendsms.mn/api/user/send
SMS_API_KEY=...
SMS_API_TOKEN=...
SMS_SENDER_ID=
SMS_ENABLED=true
```

Secret-үүдийг `EXPO_PUBLIC_` эсвэл `VITE_` нэрээр тавьж болохгүй. Browser болон
mobile bundle-д ил гарна. Credential-ийг source control-д commit хийхгүй.

`20260923093000_outbound_sms.sql` migration-ийг ажиллуулсны дараа админ web-ийн
**SMS илгээх** цэс ажиллана. API нь зөвхөн `admin/superadmin` хэрэглэгчийг
нэвтрүүлж, зөвшөөрөл баталгаажуулсан хүсэлтийг илгээнэ.

## Provider дүрэм

- Endpoint: `POST https://api.sendsms.mn/api/user/send`
- Дугаар: Монголын 8 оронтой нэг дугаар
- Мессеж: ASCII хамгийн ихдээ 159, кирилл/Unicode мессеж provider-ийн бодит
  хязгаарлалтаар 70 тэмдэгт (нэг SMS)
- Credential: JSON body дотор `apiKey`, `apiToken`
- `sent` төлөв нь provider хүсэлтийг хүлээн авсныг илэрхийлнэ. Delivery webhook
  баримтжуулагдаагүй тул утсанд хүрснийг хуурамчаар `delivered` гэж тэмдэглэхгүй.
- Provider idempotency key баримтжуулаагүй учраас timeout үед автоматаар дахин
  илгээдэггүй. Ингэснээр давхар SMS, давхар төлбөрөөс хамгаална.

Development-д `SMS_PROVIDER=mock` ашиглаж болно. Production орчинд mock provider
шууд алдаа өгнө; тестүүд бодит төлбөртэй SMS хэзээ ч илгээхгүй.

## Машины үзлэг, даатгалын автомат сануулга

`vehicle-compliance-sms` Edge Function нь өдөр бүр 09:05 (Asia/Ulaanbaatar) цагт
Autobox-оос идэвхтэй машинуудын техникийн үзлэг болон даатгалын дуусах огноог шалгана.
14 хоногийн дотор дуусах болон аль хэдийн дууссан үзлэг, даатгалын тохиолдол бүрийг
тусдаа мэдэгдэл болгон илгээнэ. Тайлбар болон даатгалын төрөл нь латинаар,
зөвхөн улсын дугаарын арын үсэг бүртгэлд байгаагаар монгол үсгээр байна.
Серийн дугаар SMS-д орохгүй.

sendsms.mn нь ASCII хэсгийг 159, кирилл тэмдэг орсон хэсгийг 70 тэмдэгтээр хязгаарладаг.
Иймээс гарчиг → улсын дугаар/төрөл → огноо/хоног/зөвлөмж гэсэн дарааллыг хадгалан
хэд хэдэн SMS хэсэгт автоматаар хуваана. Хэсэг бүрийн provider хариуг шууд хадгалдаг тул
дараагийн хэсэг алдахад өмнө амжилттай явсан төлбөртэй хэсгийг автоматаар давтахгүй.

Supabase Edge Function-д дараах server-only secret-үүд нэмэгдэнэ:

```env
VEHICLE_ALERT_PHONE_NUMBERS=88000000,99000000
CRON_SECRET=...
SMS_ENABLED=true
```

`vehicle_compliance_notifications` хүснэгтийн unique түлхүүр нь машин, төрөл, дуусах огноо,
босго тус бүрээр давхар илгээлтийг зогсооно. Дуусах огноо өөрчлөгдвөл шинэ сануулга гэж үзнэ.
Туршилтын хүсэлт нь production dedup бүртгэлийг `sent` болгодоггүй.
