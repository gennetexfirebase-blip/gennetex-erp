// Сүлжээний бараа материал болон багаж бүрт тохирох зурагны түлхүүр
export const INVENTORY_IMAGE_RULES = [
  [/router|чиглүүлэгч/i, 'router'],
  [/switch/i, 'switch'],
  [/оптик кабель(?!.*патч)(?!.*адаптер)/i, 'fiber-cable'],
  [/utp|cat6/i, 'utp-cable'],
  [/кримп/i, 'crimp-tool'],
  [/rj45/i, 'rj45'],
  [/\bonu\b/i, 'onu'],
  [/access point|wifi/i, 'access-point'],
  [/медиа конвертер/i, 'media-converter'],
  [/патч панель/i, 'patch-panel'],
  [/оптик патч/i, 'fiber-patch'],
  [/кабелийн суваг|кабель канал/i, 'cable-tray'],
  [/тэжээлийн адаптер|адаптер 12v/i, 'power-adapter'],
  [/кабель боолт|стяжка/i, 'cable-tie'],
  [/дюбель|шураг багц/i, 'wall-anchor'],
  [/оптик адаптер/i, 'fiber-adapter'],
  [/кабель тестер|lan.*тестер/i, 'cable-tester'],
  [/fusion splicer|splicer/i, 'fusion-splicer'],
  [/cleaver/i, 'cleaver'],
  [/otdr/i, 'otdr'],
  [/power meter|хэмжигч.*оптик/i, 'power-meter'],
  [/хусагч|stripper/i, 'stripper'],
  [/шураг эргүүлэгч/i, 'screwdriver'],
  [/өрөм/i, 'drill'],
  [/шат/i, 'ladder'],
];

export function getInventoryImageKey(name = '', category = 'material') {
  for (const [re, key] of INVENTORY_IMAGE_RULES) {
    if (re.test(name)) return key;
  }
  return category === 'tool' ? 'default-tool' : 'default-material';
}

export function getInventoryImagePath(name, category = 'material') {
  return `images/inventory/${getInventoryImageKey(name, category)}.svg`;
}
