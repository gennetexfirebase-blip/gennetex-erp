const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// GramJS (telegram) → React Native дээр ажиллуулахад шаардлагатай
// Node built-in модулиудыг цэвэр-JS шим руу mapping хийнэ.
const shimDir = path.resolve(__dirname, 'src/lib/telegram/shims');

// Жинхэнэ суулгасан пакетууд (buffer/process/events) — энгийн resolution ашиглана,
// resolveRequest-ээр барихгүй (Metro hashing-д асуудал үүсгэдэг).
const INSTALLED_SHIMS = {
  buffer: require.resolve('buffer'),
  process: require.resolve('process'),
  events: require.resolve('events'),
};

// Зөвхөн Node built-in нэрс → өөрсдийн шим файл руу албадан mapping.
const NODE_SHIMS = {
  crypto: path.resolve(__dirname, 'src/lib/telegram/cryptoShim.js'),
  os: path.resolve(shimDir, 'os.js'),
  util: path.resolve(shimDir, 'util.js'),
  path: path.resolve(shimDir, 'empty.js'),
  net: path.resolve(shimDir, 'empty.js'),
  tls: path.resolve(shimDir, 'empty.js'),
  fs: path.resolve(shimDir, 'empty.js'),
  http: path.resolve(shimDir, 'empty.js'),
  https: path.resolve(shimDir, 'empty.js'),
  zlib: path.resolve(shimDir, 'empty.js'),
  stream: path.resolve(shimDir, 'empty.js'),
  constants: path.resolve(shimDir, 'empty.js'),
  'node-localstorage': path.resolve(shimDir, 'node-localstorage.js'),
};

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  ...INSTALLED_SHIMS,
  ...NODE_SHIMS,
};

// ---------------------------------------------------------------------------
// Урьдчилан бэлдсэн (compiled) оролт албадах багцууд
// ---------------------------------------------------------------------------
// `react-native-webrtc` нь package.json дотроо `"react-native": "src/index.ts"`
// гэж БИЧИГДСЭН ЭХ КОД руу заадаг. Metro нь `main`-аас өмнө `react-native`
// талбарыг үздэг тул TypeScript эх кодыг ачаалахыг оролдоно. Тэр нь:
//   • Metro-гийн файлын жагсаалт хуучирсан үед "src\index.ts олдсонгүй"
//     гэсэн алдаа өгнө (багц нь өөрөө байгаа мөртлөө),
//   • нэмэлт TypeScript хөрвүүлэлт шаардаж bundle-ийг удаашруулна.
//
// Тиймээс шууд хөрвүүлсэн CommonJS хувилбар руу заана — API нь ижил,
// npm дээр нийтлэгдсэн `main` талбар мөн үүн рүү заадаг.
const PREBUILT_PACKAGES = {};
try {
  PREBUILT_PACKAGES['react-native-webrtc'] = path.resolve(
    __dirname,
    'node_modules/react-native-webrtc/lib/commonjs/index.js'
  );
  require.resolve(PREBUILT_PACKAGES['react-native-webrtc']);
} catch (e) {
  // Багц суулгаагүй бол (Expo Go-д шаардлагагүй) энгийн resolution үлдээнэ.
  delete PREBUILT_PACKAGES['react-native-webrtc'];
}

// Expo-гийн node-stdlib "stub" resolver-аас түрүүлж барихын тулд
// custom resolveRequest ашиглана (extraNodeModules хангалтгүй тохиолдолд).
const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const shim = NODE_SHIMS[moduleName];
  if (shim) {
    return { type: 'sourceFile', filePath: shim };
  }
  const prebuilt = PREBUILT_PACKAGES[moduleName];
  if (prebuilt) {
    return { type: 'sourceFile', filePath: prebuilt };
  }
  if (upstreamResolveRequest) {
    return upstreamResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// "browser" талбарыг хүндэтгэнэ (websocket → lib/browser.js).
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

module.exports = config;
