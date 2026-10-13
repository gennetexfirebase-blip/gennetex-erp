/**
 * iPhone-ийн ирцийн widget (нүүр + түгжээтэй дэлгэц).
 *
 * Interactive товч (App Intent) нь iOS 17-оос дэмжигддэг тул widget-ийн
 * доод хувилбар 17.0. Апп өөрөө хуучин iOS дээр хэвээр ажиллана.
 * Апп ↔ widget өгөгдлийг App Group-ээр хуваалцана
 * (src/services/attendanceWidgetService.js).
 */
/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'AttendanceWidget',
  displayName: 'Gennetex ирц',
  bundleIdentifier: '.attendancewidget',
  deploymentTarget: '17.0',
  frameworks: ['SwiftUI', 'WidgetKit', 'AppIntents', 'CoreLocation'],
  colors: {
    $accent: { color: '#0B6E4F', darkColor: '#3FCB7C' },
    $widgetBackground: { color: '#FFFFFF', darkColor: '#171B22' },
  },
  images: {
    gxlogo: '../../assets/logo-mark.png',
  },
  entitlements: {
    'com.apple.security.application-groups': config.ios.entitlements['com.apple.security.application-groups'],
  },
});
