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

module.exports = function withRNFirebaseDisableSPM(config) {
  return withPodfile(config, (cfg) => {
    const src = cfg.modResults.contents;
    const missing = LINES.filter((line) => !src.includes(line));
    if (missing.length) {
      cfg.modResults.contents = `${missing.join('\n')}\n${src}`;
    }
    return cfg;
  });
};
