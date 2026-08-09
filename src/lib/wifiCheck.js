/** IPv4 /24 subnet — эхний 3 octet таарна */
export function sameIPv4Subnet(ip1, ip2) {
  const p1 = String(ip1 || '').trim().split('.');
  const p2 = String(ip2 || '').trim().split('.');
  if (p1.length !== 4 || p2.length !== 4) return false;
  return p1[0] === p2[0] && p1[1] === p2[1] && p1[2] === p2[2];
}

export function isValidIPv4(ip) {
  const p = String(ip || '').trim().split('.');
  if (p.length !== 4) return false;
  return p.every((o) => /^\d{1,3}$/.test(o) && Number(o) >= 0 && Number(o) <= 255);
}

export function matchesOfficeWifi(deviceIp, gatewayIp) {
  const gw = String(gatewayIp || '').trim();
  if (!gw) return true;
  if (!deviceIp) return false;
  return sameIPv4Subnet(deviceIp, gw);
}
