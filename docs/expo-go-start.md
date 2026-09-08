# Expo Go асаах

`npm start` эсвэл `npm run start:go` нь Expo Go tunnel горимыг асаана. Ngrok authtoken өмнөх тохиргооноос уншигдана; token код эсвэл Git-д хадгалагдахгүй. Tunnel нь утас/компьютер өөр сүлжээнд байхад ч холбогдоно.

Ижил Wi-Fi дээр tunnel хэрэггүй бол `npm run start:go:lan`. Native development build-д `npm run start:dev` ашиглана.

Metro бэлэн болмогц terminal дээр `[Expo Go] exp://...` холбоос болон SDK хувилбар гарна. Expo Go дотор **тухайн шинэ холбоосыг** нээнэ. Өмнөх QR / Recent project нь зогссон хуучин серверийг зааж байж болно.

Төсөл SDK 57 ашигладаг. Утасны Expo Go тухайн SDK-г дэмжих ёстой; version incompatible гэсэн алдаанд [Expo Go татах хуудас](https://expo.dev/go)-аас таарах хувилбарыг шалгана. Expo Go дотор Android background GPS ажиллахгүй; үүнд native APK/development build шаардлагатай.

Энэ засварт Metro хуучин checkout, public-web, native build болон tmp артефактуудыг mobile source мэт дахин скан хийхээс хамгаалсан. File-map cache тусдаа `.expo/metro-file-map` хавтсанд хадгалагдана. Ачааллыг 2 worker-оор хязгаарласан. Auto-port болон Go холбоосыг хэвлэх нь хуучин Metro сервертэй андуурахыг багасгана.

Терминалын процессийг хаавал tunnel зогсоно. SDK mismatch, утасны native crash эсвэл runtime улаан алдааг зөвхөн серверийн HTTP шалгалтаар баталж болохгүй; алдааны текстийг ашиглаж оношилно.
