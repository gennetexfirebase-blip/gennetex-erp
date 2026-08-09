/**
 * Аппын хувилбар — шинэчлэлт бүрт patch +1 (10 хүртэл),
 * 10 болсны дараа minor +1, patch 0; minor 10 бол major +1.
 *
 * Шинэчлэлт гаргах: npm run version:bump
 */
export const VERSION_SEGMENT_MAX = 10;

export const APP_VERSION = {
  major: 1,
  minor: 0,
  patch: 4,
};

export function formatAppVersion(v = APP_VERSION) {
  return `${v.major}.${v.minor}.${v.patch}`;
}

export const APP_VERSION_STRING = formatAppVersion();
export const APP_VERSION_LABEL = `v${APP_VERSION_STRING}`;

export function getNextVersion(v = APP_VERSION) {
  let { major, minor, patch } = v;
  if (patch < VERSION_SEGMENT_MAX) {
    return { major, minor, patch: patch + 1 };
  }
  patch = 0;
  if (minor < VERSION_SEGMENT_MAX) {
    return { major, minor: minor + 1, patch };
  }
  return { major: major + 1, minor: 0, patch: 0 };
}
