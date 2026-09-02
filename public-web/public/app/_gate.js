/**
 * Хөгжүүлэгчийн хаалт — `/app/uplaod` ба `/app/time` хуудсуудад.
 *
 * ⚠️ ХЯЗГААР: энэ бол клиент талын хаалт. Хуудасны эх кодыг үзэж
 *    чаддаг хүн онолын хувьд тойрч гарах боломжтой (иймд нууц үгийг
 *    ил бичихгүй, ЗӨВХӨН SHA-256 хураангуйг хадгална). Бодит
 *    хамгаалалт нь сервер тал дээр: цаг өөрчлөх нь PIN шалгадаг
 *    `set_upload_countdown` RPC-ээр л явагдах бөгөөд `app_upload_countdown`
 *    хүснэгт дээр `update` эрх ХЭНД Ч алга. Энэ хаалт нь хуудсыг
 *    санамсаргүй хүнээс нуух зорилготой.
 *
 * Хэрэглэх: <script src="../_gate.js"></script> — <body>-ийн эхэнд.
 */
(function () {
  // Нууц үг: Gennetex@2026 (2026-09-02-нд шинэчлэв — хуучныг мартсан).
  // Зөвхөн SHA-256 хураангуйг хадгална; жинхэнэ үг эх кодод байхгүй.
  var PASS_SHA256 = '0eaf5e42a06900eef817152ad1277fdedb71117283e052cca7682440c3fe9ebc';
  var KEY = 'gx_dev_gate_v1';

  // Нэг удаа нэвтэрсэн бол дахин асуухгүй.
  try {
    if (localStorage.getItem(KEY) === PASS_SHA256) return;
  } catch (e) {
    /* хувийн горимд localStorage хаалттай — доорх хаалт ажиллана */
  }

  // Агуулгыг ХЭЗЭЭ Ч гялсхийж харуулахгүй.
  var hide = document.createElement('style');
  hide.id = 'gx-gate-hide';
  hide.textContent = 'body > *:not(#gx-gate) { display: none !important; }';
  document.head.appendChild(hide);

  function sha256(text) {
    var bytes = new TextEncoder().encode(text);
    return crypto.subtle.digest('SHA-256', bytes).then(function (buf) {
      return Array.prototype.map
        .call(new Uint8Array(buf), function (b) {
          return b.toString(16).padStart(2, '0');
        })
        .join('');
    });
  }

  function mount() {
    var gate = document.createElement('div');
    gate.id = 'gx-gate';
    gate.innerHTML = [
      '<style>',
      '  #gx-gate{position:fixed;inset:0;z-index:2147483647;display:flex;',
      '    align-items:center;justify-content:center;padding:20px;',
      '    background:#0d1117;color:#e8eef6;',
      '    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}',
      '  #gx-gate .box{width:min(360px,100%);padding:26px 22px;background:#161b22;',
      '    border:1px solid #2b323c;border-radius:14px;text-align:center}',
      '  #gx-gate .lock{font-size:34px;line-height:1}',
      '  #gx-gate h2{margin:12px 0 6px;font-size:18px;font-weight:800}',
      '  #gx-gate p{margin:0 0 18px;font-size:13.5px;line-height:1.6;color:#8b98a5}',
      '  #gx-gate input{width:100%;padding:12px 13px;font-size:15px;font-family:inherit;',
      '    color:#e8eef6;background:#0d1117;border:1.5px solid #2b323c;border-radius:9px;',
      '    text-align:center;letter-spacing:.08em}',
      '  #gx-gate input:focus{outline:2px solid #0099db;outline-offset:-1px;border-color:#0099db}',
      '  #gx-gate button{width:100%;margin-top:11px;padding:12px;font-size:15px;',
      '    font-weight:700;font-family:inherit;color:#fff;background:#0099db;border:0;',
      '    border-radius:9px;cursor:pointer}',
      '  #gx-gate .err{margin-top:11px;font-size:13px;color:#ff6b61;min-height:18px}',
      '  #gx-gate .shake{animation:gxshake .32s}',
      '  @keyframes gxshake{0%,100%{transform:translateX(0)}25%{transform:translateX(-7px)}',
      '    75%{transform:translateX(7px)}}',
      '</style>',
      '<form class="box" autocomplete="off">',
      '  <div class="lock">🔒</div>',
      '  <h2>Хөгжүүлэгчийн хэсэг</h2>',
      '  <p>Энэ хуудсанд зөвхөн хөгжүүлэгч нэвтэрнэ.</p>',
      '  <input type="password" placeholder="Нууц үг" autofocus />',
      '  <button type="submit">Нэвтрэх</button>',
      '  <div class="err"></div>',
      '</form>',
    ].join('\n');
    document.body.appendChild(gate);

    var form = gate.querySelector('form');
    var input = gate.querySelector('input');
    var err = gate.querySelector('.err');

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      sha256(input.value)
        .then(function (h) {
          if (h !== PASS_SHA256) {
            err.textContent = 'Нууц үг буруу байна.';
            gate.querySelector('.box').classList.remove('shake');
            void gate.querySelector('.box').offsetWidth; // reflow — анимацийг дахин асаана
            gate.querySelector('.box').classList.add('shake');
            input.select();
            return;
          }
          try {
            localStorage.setItem(KEY, PASS_SHA256);
          } catch (e) {
            /* хувийн горим — энэ удаад л нэвтэрнэ */
          }
          gate.remove();
          var s = document.getElementById('gx-gate-hide');
          if (s) s.remove();
        })
        .catch(function () {
          // `crypto.subtle` нь ЗӨВХӨН HTTPS (эсвэл localhost) дээр
          // ажилладаг. HTTP-ээр нээвэл энд орно.
          err.textContent = 'Хамгаалалттай холболт (HTTPS) шаардлагатай.';
        });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
