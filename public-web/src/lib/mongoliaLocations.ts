import rawUnits from '../data/mongoliaAdministrativeUnits.json';

/**
 * Монгол Улсын засаг захиргааны нэгжийн сонголт.
 * Source snapshot: https://github.com/manlaingelo/ha-ds-hb (2025-04-04)
 * Dataset нь аймаг/нийслэл → сум/дүүрэг → баг/хорооны нэр, код агуулна.
 */
interface ThirdLevelUnit {
  bag_code: string;
  bag_name_mn: string;
}

interface SecondLevelUnit {
  duureg_code: string;
  duureg_name: string;
  khoroos: ThirdLevelUnit[];
}

interface ProvinceUnit {
  aimag_code: string;
  aimag_name_mn: string;
  duurguud: SecondLevelUnit[];
}

export interface LocationOption {
  code: string;
  name: string;
}

const units = rawUnits as ProvinceUnit[];

export const PROVINCE_OPTIONS: LocationOption[] = units.map((unit) => ({
  code: unit.aimag_code,
  name: unit.aimag_name_mn,
}));

export function getDistrictOptions(provinceName: string): LocationOption[] {
  const province = units.find((unit) => unit.aimag_name_mn === provinceName);
  return (province?.duurguud || []).map((unit) => ({
    code: unit.duureg_code,
    name: unit.duureg_name,
  }));
}

export function getSubdistrictOptions(provinceName: string, districtName: string): LocationOption[] {
  const province = units.find((unit) => unit.aimag_name_mn === provinceName);
  const district = province?.duurguud.find((unit) => unit.duureg_name === districtName);
  return (district?.khoroos || []).map((unit) => ({
    code: unit.bag_code,
    name: unit.bag_name_mn,
  }));
}

export function isCapital(provinceName: string) {
  return provinceName === 'Улаанбаатар';
}
