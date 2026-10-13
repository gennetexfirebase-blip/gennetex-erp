/**
 * Вэб (компьютерийн өргөн браузер) дээр аппыг prototype шиг утасны хүрээнд
 * харуулна — эс бөгөөс бүх дэлгэц 1440px өргөнөөр сунаж огт өөр харагддаг.
 *
 * Апп өөрөө iframe дотор (390×844) ажиллана, тиймээс useWindowDimensions,
 * хавтангийн өргөн зэрэг бүх тооцоо утасных шиг зөв гарна. Утас, нарийн
 * цонх эсвэл native дээр юу ч хийхгүй.
 *
 * @returns {boolean} true бол энэ хуудас зөвхөн хүрээ — апп mount хийхгүй.
 */
export function mountWebPhoneFrame() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  if (window.self !== window.top) return false; // iframe дотор — жинхэнэ апп
  if (window.innerWidth <= 520) return false; // утас, нарийн цонх

  const src = window.location.href;
  document.title = 'Gennetex ERP';
  document.body.style.cssText =
    'margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#E7EAEE;font-family:system-ui,sans-serif';
  const root = document.getElementById('root');
  if (root) root.style.display = 'none';

  const phone = document.createElement('div');
  phone.style.cssText = [
    'position:relative',
    'width:390px',
    'height:min(844px, calc(100vh - 48px))',
    'border-radius:48px',
    'overflow:hidden',
    'background:#fff',
    'box-shadow:0 0 0 11px #16191D, 0 30px 60px -20px rgba(0,0,0,.35)',
  ].join(';');
  const island = document.createElement('div');
  island.style.cssText =
    'position:absolute;top:11px;left:50%;transform:translateX(-50%);width:120px;height:34px;border-radius:20px;background:#000;z-index:2;pointer-events:none';
  const frame = document.createElement('iframe');
  frame.src = src;
  frame.title = 'Gennetex ERP';
  frame.style.cssText = 'border:0;width:100%;height:100%;display:block;padding-top:50px;box-sizing:border-box;background:#fff';
  phone.appendChild(island);
  phone.appendChild(frame);
  document.body.appendChild(phone);
  return true;
}
