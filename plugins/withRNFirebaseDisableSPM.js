const { withPodfile } = require('@expo/config-plugins');

/**
 * iOS: react-native-firebase-ийг SPM-ээр биш CocoaPods-оор татна.
 *
 * АСУУДАЛ (EAS iOS build, 2026-10-07):
 *   `pod install` дээр зогсов:
 *     [!] [react-native-firebase] SPM + static linkage is not supported
 *   firebase-ios-sdk-ийн Swift Package зөвхөн dynamic сан өгдөг тул static
 *   холболттой үед pod бүр Firebase-ийн өөрийн хуулбарыг оруулж linker
 *   давхар symbol-оор унана — react-native-firebase үүнийг урьдчилан
 *   хориглодог.
 *
 * ШИЙДЭЛ:
 *   Podfile-ийн эхэнд `$RNFirebaseDisableSPM = true` тавина (алдааны
 *   мессежийн санал болгосон хоёр дахь хувилбар). Холболтын төрлийг
 *   өөрчлөхгүй тул бусад native сангуудад нөлөөлөхгүй.
 *
 * ЯАГААД CONFIG PLUGIN ВЭ:
 *   `ios/` фолдер generated (.easignore-д) — Podfile-ийг гараар засвал
 *   дараагийн prebuild дээр устана.
 */
// Static framework-тэй үед react-native-firebase-ийн баримт
// `$RNFirebaseAsStaticFramework`-ийг мөн шаарддаг.
const LINES = ['$RNFirebaseDisableSPM = true', '$RNFirebaseAsStaticFramework = true'];

/**
 * Дараагийн алхам (2-р build): CocoaPods-оор татахад Firebase-ийн Swift
 * pod-ууд static сан болж холбогдохдоо хамааралтай Objective-C pod-уудын
 * module map шаардана:
 *   [!] The Swift pod `FirebaseCoreInternal` depends upon `GoogleUtilities`,
 *       which does not define modules.
 * Глобал `use_modular_headers!` бусад native сангуудыг эвдэж болзошгүй тул
 * зөвхөн Firebase-ийн хамааралтай pod-уудад нь асаана.
 */
const MODULAR_PODS = [
  'GoogleUtilities',
  'FirebaseCore',
  'FirebaseCoreInternal',
  'FirebaseCoreExtension',
  'FirebaseInstallations',
  'GoogleDataTransport',
  'nanopb',
  'PromisesObjC',
];
const MODULAR_MARK = '# gennetex: firebase modular headers';

module.exports = function withRNFirebaseDisableSPM(config) {
  return withPodfile(config, (cfg) => {
    let src = cfg.modResults.contents;
    const missing = LINES.filter((line) => !src.includes(line));
    if (missing.length) {
      src = `${missing.join('\n')}\n${src}`;
    }
    if (!src.includes(MODULAR_MARK)) {
      const anchor = /^(\s*)use_expo_modules!.*$/m;
      const m = src.match(anchor);
      if (!m) throw new Error('[withRNFirebaseDisableSPM] Podfile-д use_expo_modules! олдсонгүй');
      const indent = m[1];
      const pods = MODULAR_PODS.map((p) => `${indent}pod '${p}', :modular_headers => true`).join('\n');
      src = src.replace(anchor, `${m[0]}\n${indent}${MODULAR_MARK}\n${pods}`);
    }
    cfg.modResults.contents = src;
    return cfg;
  });
};
