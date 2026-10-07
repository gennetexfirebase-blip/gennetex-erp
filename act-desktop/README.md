# Gennetex Акт — Windows desktop

`https://akt.gennetex.com`-ийг аюулгүй Electron shell дотор ажиллуулах Windows desktop хувилбар.

## Development

```powershell
npm install
npm start
```

## Windows build

```powershell
npm run dist:win
```

Build дуусахад `release/` дотор installer болон portable `.exe` үүснэ.

Desktop app нь веб системийн одоогийн production хувилбарыг ачаалдаг тул актын шинэчлэлт бүрийг app дахин суулгахгүйгээр шууд авна. Татсан PDF/DOCX файл Windows-ийн `Downloads` хавтсанд хадгалагдана.
