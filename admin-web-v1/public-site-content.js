/**
 * Public вэбсайтын текст — админ засварлах (CMS)
 */
(function (global) {
  var DEFAULT_PUBLIC_SITE_CONTENT = {
    navbar: {
      brand: 'ЖЕННЕТЕКС',
      ctaCareers: 'Ажилд орох',
      links: [
        { to: '/about', label: 'Бидний тухай' },
        { to: '/services', label: 'Үйлчилгээ' },
        { to: '/projects', label: 'Төслүүд' },
        { to: '/careers', label: 'Ажлын байр' },
        { to: '/contact', label: 'Холбоо барих' },
      ],
    },
    hero: {
      stat1: '10+ жилийн туршлага',
      stat2: '500+ төсөл',
      stat3: '24/7 дэмжлэг',
      badge: 'ЖЕННЕТЕКС ХХК',
      title1: 'Илүү ухаалгаар.',
      title2: 'Илүү хурдан.',
      description:
        'Сүлжээ, шилэн кабель, CCTV болон IT дэд бүтцийн иж бүрэн шийдлийг Монголын бизнесүүдэд хүргэдэг инженерингийн компани.',
      tagline: '«Холбоо — итгэлцлийн суурь»',
      btnServices: 'Үйлчилгээ үзэх',
      btnAbout: 'Дэлгэрэнгүй',
      btnContact: 'Холбогдох',
      btnCareers: 'Ажилд орох',
    },
    home: {
      label: 'Хуудаснууд',
      title: 'Манай вэбсайтын хэсгүүд',
      linkOpen: 'Нээх',
      links: [
        { to: '/about', title: 'Бидний тухай', text: 'Зорилго, үнэт зүйлс, мэргэжлийн багийн танилцуулга.' },
        { to: '/services', title: 'Үйлчилгээ', text: 'Сүлжээ, шилэн кабель, CCTV, сервер өрөөний шийдэл.' },
        { to: '/projects', title: 'Төслүүд', text: 'Хэрэгжүүлсэн ажлууд, харилцагчдын итгэл.' },
        { to: '/careers', title: 'Ажлын байр', text: 'Ажилд орох албан ёсны анкет бөглөх.' },
        { to: '/contact', title: 'Холбоо барих', text: 'Утас, имэйл, хаяг, холбоо барих маягт.' },
      ],
    },
    about: {
      label: 'Бидний тухай',
      title: 'Найдвартай технологийн түнш',
      intro:
        'Бид орчин үеийн технологи, туршлагатай инженерүүдийн багаараа дамжуулан байгууллагуудын дижитал шилжилтийг дэмжиж, тасралтгүй аюулгүй үйл ажиллагааг хангадаг.',
      items: [
        { title: 'Эрхэм зорилго', text: 'Чанартай, найдвартай технологийн шийдлээр харилцагчдынхаа өсөлтөд хувь нэмэр оруулах.' },
        { title: 'Мэргэжлийн баг', text: 'Гэрчилгээжсэн, тасралтгүй хөгжиж буй инженерүүдийн туршлагатай хамт олон.' },
        { title: 'Хариуцлага', text: 'Төслийн эхнээс дуустал, дараах засвар үйлчилгээ хүртэл бүрэн хариуцлага.' },
      ],
    },
    services: {
      label: 'Үйлчилгээ',
      title: 'Бидний санал болгодог шийдлүүд',
      items: [
        { title: 'Сүлжээний шийдэл', text: 'LAN/WAN, өгөгдлийн төв, wireless сүлжээний зураг төсөл, суурилуулалт.' },
        { title: 'Шилэн кабель', text: 'Fiber optic татах, гагнах, хэмжилт, терминаци болон бүрэн шинжилгээ.' },
        { title: 'Хяналтын систем', text: 'CCTV, хяналт-камер, хандалт удирдлагын иж бүрэн систем.' },
        { title: 'Аюулгүй байдал', text: 'Гал хамгаалалт, дохиолол, мэдээллийн аюулгүй байдлын шийдэл.' },
        { title: 'IT дэд бүтэц', text: 'Сервер, өгөгдлийн төв, виртуалчлал, дэд бүтцийн зөвлөгөө.' },
        { title: 'Техник үйлчилгээ', text: '24/7 хяналт, урьдчилан сэргийлэх засвар, шуурхай дэмжлэг.' },
      ],
    },
    projects: {
      label: 'Төслүүд',
      title: 'Бидний хүрсэн үр дүн',
      highlightsTitle: 'Гол чиглэлүүд',
      stats: [
        { value: '10+', label: 'Жилийн туршлага' },
        { value: '500+', label: 'Хэрэгжүүлсэн төсөл' },
        { value: '50+', label: 'Мэргэжлийн инженер' },
        { value: '24/7', label: 'Техник дэмжлэг' },
      ],
      highlights: [
        'Байгууллагын сүлжээний бүрэн шинэчлэл, өндөр хурдны шилэн холболт',
        'Оффис, агуулах, үйлдвэрлэлийн талбайн CCTV болон хяналтын систем',
        'Төслийн эхнээс дуустал инженерийн хяналт, гүйцэтгэлийн баталгаа',
      ],
    },
    contact: {
      label: 'Холбоо барих',
      title: 'Бидэнтэй холбогдоорой',
      address: 'Улаанбаатар хот, Монгол улс',
      phone: '+976 0000-0000',
      phoneHref: 'tel:+97600000000',
      email: 'info@adiya.site',
      emailHref: 'mailto:info@adiya.site',
      website: 'adiya.site',
      hoursTitle: 'Ажлын цаг',
      hoursWeekday: 'Даваа – Баасан: 09:00 – 18:00',
      hoursSaturday: 'Бямба: 10:00 – 14:00',
      hoursSunday: 'Ням: Амарна',
      hoursNote: 'Яаралтай техник дэмжлэг 24/7 ажиллана.',
    },
    careers: {
      label: 'Ажлын байр',
      title: 'Ажилд орох анкет',
      intro:
        '"ЖЕННЕТЕКС" ХХК-ийн албан ёсны ажилд орох анкетыг доор бөглөн илгээнэ үү. Бөглөсөн мэдээлэл шууд хүний нөөцийн багт очно.',
      pageIntro: 'ЖЕННЕТЕКС ХХК-ийн албан ёсны анкетыг бөглөнө үү. Бүх талбарыг үнэн зөв бөглөнө.',
      perksTitle: 'Мэдээлэл',
      perks: ['Инженерийн мэргэжлийн баг', 'Тогтвортой ажлын байр', 'Нийгмийн даатгал'],
      sidebarNote:
        'Анкет илгээсний дараа HR баг хянаж, утсаар холбогдоно. Хувийн мэдээллийг зөвхөн ажилд авах зорилгоор ашиглана.',
      footer: '© {year} ЖЕННЕТЕКС ХХК',
      backHome: 'Нүүр',
      backShort: 'Буцах',
    },
    footer: {
      brand: 'ЖЕННЕТЕКС',
      copyright: '© {year} Gennetex. Бүх эрх хуулиар хамгаалагдсан.',
    },
  };

  var TAB_META = {
    hero: { label: 'Нүүр хэсэг', icon: 'home', preview: '/', desc: 'Үндсэн гарчиг, тайлбар, товчлуурууд' },
    home: { label: 'Хуудаснууд', icon: 'dashboard', preview: '/', desc: 'Нүүр дээрх хуудасны жагсаалт' },
    about: { label: 'Бидний тухай', icon: 'groups', preview: '/about', desc: 'Компанийн танилцуулга' },
    services: { label: 'Үйлчилгээ', icon: 'handyman', preview: '/services', desc: 'Үйлчилгээний жагсаалт' },
    projects: { label: 'Төслүүд', icon: 'architecture', preview: '/projects', desc: 'Статистик, гол чиглэл' },
    contact: { label: 'Холбоо барих', icon: 'call', preview: '/contact', desc: 'Хаяг, утас, ажлын цаг' },
    careers: { label: 'Ажлын байр', icon: 'work', preview: '/careers', desc: 'Анкет хуудасны текст' },
    navbar: { label: 'Дээд цэс', icon: 'menu', preview: '/', desc: 'Навигацийн холбоосууд' },
    footer: { label: 'Footer', icon: 'bottom_panel_close', preview: '/', desc: 'Доод хэсгийн текст' },
  };

  function deepMerge(base, patch) {
    if (!patch || typeof patch !== 'object') return base;
    if (Array.isArray(patch)) {
      return patch.map(function (item, i) {
        return typeof item === 'object' && item && base && base[i] ? deepMerge(base[i], item) : item;
      });
    }
    var out = Object.assign({}, base);
    Object.keys(patch).forEach(function (key) {
      var value = patch[key];
      if (value === undefined) return;
      if (Array.isArray(value)) out[key] = value;
      else if (value && typeof value === 'object' && out[key] && typeof out[key] === 'object' && !Array.isArray(out[key])) {
        out[key] = deepMerge(out[key], value);
      } else out[key] = value;
    });
    return out;
  }

  function mergePublicSiteContent(partial) {
    if (!partial || typeof partial !== 'object' || Array.isArray(partial)) {
      return deepMerge(DEFAULT_PUBLIC_SITE_CONTENT, {});
    }
    return deepMerge(DEFAULT_PUBLIC_SITE_CONTENT, partial);
  }

  function esc(v) {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function field(label, id, value, opts) {
    opts = opts || {};
    var val = esc(value);
    var hint = opts.hint ? '<span class="psc-hint">' + esc(opts.hint) + '</span>' : '';
    var wide = opts.wide ? ' psc-field-wide' : '';
    if (opts.area) {
      return (
        '<label class="psc-field' +
        wide +
        '"><span class="psc-label">' +
        esc(label) +
        '</span><textarea id="' +
        id +
        '" rows="' +
        (opts.rows || 4) +
        '">' +
        val +
        '</textarea>' +
        hint +
        '</label>'
      );
    }
    return (
      '<label class="psc-field' +
      wide +
      '"><span class="psc-label">' +
      esc(label) +
      '</span><input id="' +
      id +
      '" type="text" value="' +
      val +
      '"/>' +
      hint +
      '</label>'
    );
  }

  function block(title, inner) {
    return '<div class="psc-block"><div class="psc-block-title">' + esc(title) + '</div>' + inner + '</div>';
  }

  function itemPairFields(prefix, title, text, i, pathLabel) {
    title = title == null ? '' : title;
    text = text == null ? '' : text;
    return (
      '<div class="psc-item"><div class="psc-item-head"><span class="psc-item-title">#' +
      (i + 1) +
      '</span>' +
      (pathLabel ? '<span class="psc-item-path">' + esc(pathLabel) + '</span>' : '') +
      '</div><div class="psc-grid">' +
      field('Гарчиг', prefix + '_title_' + i, title) +
      field('Тайлбар', prefix + '_text_' + i, text, { area: true, rows: 3, wide: true }) +
      '</div></div>'
    );
  }

  function panelHeader(tabId) {
    var meta = TAB_META[tabId] || { label: tabId, desc: '' };
    return (
      '<div class="psc-toolbar" data-psc-toolbar="' +
      tabId +
      '"><div><h4>' +
      esc(meta.label) +
      '</h4><p>' +
      esc(meta.desc) +
      '</p></div>' +
      (meta.preview
        ? '<a class="psc-preview-link" href="' +
          esc(meta.preview) +
          '" target="_blank" rel="noopener"><span class="material-symbols-outlined" style="font-size:18px">open_in_new</span> Хуудас харах</a>'
        : '') +
      '</div>'
    );
  }

  function renderPublicSiteEditorHtml(content, updatedAt) {
    var c = mergePublicSiteContent(content && !Array.isArray(content) ? content : null);
    var h = c.hero || {};
    var hm = c.home || {};
    var ab = c.about || {};
    var sv = c.services || {};
    var pj = c.projects || {};
    var ct = c.contact || {};
    var cr = c.careers || {};
    var ft = c.footer || {};
    var nb = c.navbar || {};
    var updated = updatedAt ? new Date(updatedAt).toLocaleString('mn-MN') : 'Хэзээ ч хадгалаагүй';

    var aboutItems = (ab.items || []).map(function (it, i) {
      if (!it || typeof it !== 'object') it = {};
      return itemPairFields('about', it.title, it.text, i);
    }).join('');
    var serviceItems = (sv.items || []).map(function (it, i) {
      if (!it || typeof it !== 'object') it = {};
      return itemPairFields('service', it.title, it.text, i);
    }).join('');
    var homeLinks = (hm.links || []).map(function (it, i) {
      if (!it || typeof it !== 'object') it = {};
      return itemPairFields('home_link', it.title, it.text, i, it.to || '');
    }).join('');
    var stats = (pj.stats || []).map(function (s, i) {
      if (!s || typeof s !== 'object') s = {};
      return (
        '<div class="psc-item"><div class="psc-item-head"><span class="psc-item-title">Статистик #' +
        (i + 1) +
        '</span></div><div class="psc-grid">' +
        field('Тоо / утга', 'proj_stat_value_' + i, s.value) +
        field('Шошго', 'proj_stat_label_' + i, s.label) +
        '</div></div>'
      );
    }).join('');
    var highlights = (pj.highlights || [])
      .map(function (line, i) {
        return field('Мөр #' + (i + 1), 'proj_highlight_' + i, line == null ? '' : line, { area: true, rows: 3, wide: true });
      })
      .join('');
    var navLinks = (nb.links || [])
      .map(function (l, i) {
        if (!l || typeof l !== 'object') l = {};
        return (
          '<div class="psc-item"><div class="psc-item-head"><span class="psc-item-title">Цэс #' +
          (i + 1) +
          '</span><span class="psc-item-path">' +
          esc(l.to || '') +
          '</span></div>' +
          field('Харагдах нэр', 'nav_link_' + i, l.label) +
          '</div>'
        );
      })
      .join('');
    var perks = (cr.perks || [])
      .map(function (p, i) {
        return field('Мөр #' + (i + 1), 'career_perk_' + i, p == null ? '' : p);
      })
      .join('');

    var navHtml = Object.keys(TAB_META)
      .map(function (id, i) {
        var m = TAB_META[id];
        return (
          '<button type="button" class="psc-nav-btn' +
          (i === 0 ? ' active' : '') +
          '" data-psc-tab="' +
          id +
          '"><span class="material-symbols-outlined">' +
          m.icon +
          '</span><span>' +
          esc(m.label) +
          '</span></button>'
        );
      })
      .join('');

    var panels =
      '<div class="psc-panel active" data-psc-panel="hero">' +
      block(
        'Үндсэн мэдээлэл',
        '<div class="psc-grid">' +
          field('Тэмдэг (badge)', 'hero_badge', h.badge) +
          field('Уриа', 'hero_tagline', h.tagline) +
          '</div>',
      ) +
      block(
        'Статистик мөр',
        '<div class="psc-grid">' +
          field('1-р мөр', 'hero_stat1', h.stat1) +
          field('2-р мөр', 'hero_stat2', h.stat2) +
          field('3-р мөр', 'hero_stat3', h.stat3) +
          '</div>',
      ) +
      block(
        'Гарчиг ба тайлбар',
        '<div class="psc-grid">' +
          field('Гарчиг — эхний мөр', 'hero_title1', h.title1) +
          field('Гарчиг — хоёр дахь мөр', 'hero_title2', h.title2) +
          field('Тайлбар', 'hero_description', h.description, { area: true, rows: 5, wide: true }) +
          '</div>',
      ) +
      block(
        'Товчлуурууд',
        '<div class="psc-grid">' +
          field('Үйлчилгээ', 'hero_btnServices', h.btnServices) +
          field('Дэлгэрэнгүй', 'hero_btnAbout', h.btnAbout) +
          field('Холбогдох', 'hero_btnContact', h.btnContact) +
          field('Ажилд орох', 'hero_btnCareers', h.btnCareers) +
          '</div>',
      ) +
      '</div>' +
      '<div class="psc-panel" data-psc-panel="home">' +
      block(
        'Толгой хэсэг',
        '<div class="psc-grid">' +
          field('Дээд шошго', 'home_label', hm.label) +
          field('Гарчиг', 'home_title', hm.title) +
          field('«Нээх» товч', 'home_linkOpen', hm.linkOpen) +
          '</div>',
      ) +
      block('Хуудасны картууд', homeLinks) +
      '</div>' +
      '<div class="psc-panel" data-psc-panel="about">' +
      block(
        'Толгой хэсэг',
        '<div class="psc-grid">' +
          field('Дээд шошго', 'about_label', ab.label) +
          field('Гарчиг', 'about_title', ab.title) +
          field('Танилцуулга', 'about_intro', ab.intro, { area: true, rows: 5, wide: true }) +
          '</div>',
      ) +
      block('Гол цэгүүд', aboutItems) +
      '</div>' +
      '<div class="psc-panel" data-psc-panel="services">' +
      block(
        'Толгой хэсэг',
        '<div class="psc-grid">' +
          field('Дээд шошго', 'services_label', sv.label) +
          field('Гарчиг', 'services_title', sv.title) +
          '</div>',
      ) +
      block('Үйлчилгээнүүд', serviceItems) +
      '</div>' +
      '<div class="psc-panel" data-psc-panel="projects">' +
      block(
        'Толгой хэсэг',
        '<div class="psc-grid">' +
          field('Дээд шошго', 'projects_label', pj.label) +
          field('Гарчиг', 'projects_title', pj.title) +
          field('Гол чиглэлийн гарчиг', 'projects_highlightsTitle', pj.highlightsTitle) +
          '</div>',
      ) +
      block('Статистик', stats) +
      block('Гол чиглэлүүд', '<div class="psc-grid">' + highlights + '</div>') +
      '</div>' +
      '<div class="psc-panel" data-psc-panel="contact">' +
      block(
        'Толгой хэсэг',
        '<div class="psc-grid">' +
          field('Дээд шошго', 'contact_label', ct.label) +
          field('Гарчиг', 'contact_title', ct.title) +
          '</div>',
      ) +
      block(
        'Холбоо',
        '<div class="psc-grid">' +
          field('Хаяг', 'contact_address', ct.address, { area: true, rows: 3, wide: true }) +
          field('Утас', 'contact_phone', ct.phone, { hint: 'Жишээ: +976 9911-2233' }) +
          field('Имэйл', 'contact_email', ct.email) +
          field('Вэбсайт', 'contact_website', ct.website, { hint: 'Жишээ: adiya.site' }) +
          '</div>',
      ) +
      block(
        'Ажлын цаг',
        '<div class="psc-grid">' +
          field('Гарчиг', 'contact_hoursTitle', ct.hoursTitle) +
          field('Даваа – Баасан', 'contact_hoursWeekday', ct.hoursWeekday) +
          field('Бямба', 'contact_hoursSaturday', ct.hoursSaturday) +
          field('Ням', 'contact_hoursSunday', ct.hoursSunday) +
          field('Тэмдэглэл', 'contact_hoursNote', ct.hoursNote, { area: true, rows: 3, wide: true }) +
          '</div>',
      ) +
      '</div>' +
      '<div class="psc-panel" data-psc-panel="careers">' +
      block(
        'Толгой хэсэг',
        '<div class="psc-grid">' +
          field('Дээд шошго', 'careers_label', cr.label) +
          field('Гарчиг', 'careers_title', cr.title) +
          field('Танилцуулга (нүүр)', 'careers_intro', cr.intro, { area: true, rows: 4, wide: true }) +
          field('Танилцуулга (анкет)', 'careers_pageIntro', cr.pageIntro, { area: true, rows: 4, wide: true }) +
          '</div>',
      ) +
      block('Хажуугийн мэдээлэл', '<div class="psc-grid">' + field('Гарчиг', 'careers_perksTitle', cr.perksTitle) + perks + field('Тэмдэглэл', 'careers_sidebarNote', cr.sidebarNote, { area: true, rows: 4, wide: true }) + '</div>') +
      block(
        'Бусад',
        '<div class="psc-grid">' +
          field('Footer мөр', 'careers_footer', cr.footer, { hint: '{year} → одоогийн он' }) +
          field('Буцах (урт)', 'careers_backHome', cr.backHome) +
          field('Буцах (товч)', 'careers_backShort', cr.backShort) +
          '</div>',
      ) +
      '</div>' +
      '<div class="psc-panel" data-psc-panel="navbar">' +
      block(
        'Ерөнхий',
        '<div class="psc-grid">' +
          field('Брэнд нэр', 'navbar_brand', nb.brand) +
          field('«Ажилд орох» товч', 'navbar_ctaCareers', nb.ctaCareers) +
          '</div>',
      ) +
      block('Цэсний холбоосууд', navLinks) +
      '</div>' +
      '<div class="psc-panel" data-psc-panel="footer">' +
      block(
        'Доод хэсэг',
        '<div class="psc-grid">' +
          field('Брэнд', 'footer_brand', ft.brand) +
          field('Зохиогчийн эрх', 'footer_copyright', ft.copyright, {
            area: true,
            rows: 3,
            wide: true,
            hint: '{year} гэж бичвэл автоматаар солигдоно',
          }) +
          '</div>',
      ) +
      '</div>';

    return (
      '<div class="psc-editor">' +
      '<aside class="psc-sidebar" id="pscTabs"><div class="psc-sidebar-title">Хуудас</div>' +
      navHtml +
      '</aside>' +
      '<div class="psc-main">' +
      panelHeader('hero') +
      '<div class="psc-body">' +
      '<p class="psc-updated" style="margin:0 0 16px">Сүүлд хадгалсан: <b>' +
      esc(updated) +
      '</b></p>' +
      panels +
      '</div>' +
      '<div class="psc-actions">' +
      '<button class="btn btn-primary" type="button" id="pscSaveBtn"><span class="material-symbols-outlined" style="font-size:18px;vertical-align:middle">save</span> Хадгалах</button>' +
      '<button class="btn btn-ghost" type="button" id="pscResetBtn">Анхны утга</button>' +
      '<a class="btn btn-ghost" href="/" target="_blank" rel="noopener"><span class="material-symbols-outlined" style="font-size:17px;vertical-align:middle">language</span> Вэб нээх</a>' +
      '<span class="muted" style="font-size:12px;margin-left:auto">Хадгалсны дараа public вэб дээр шууд харагдана</span>' +
      '</div></div></div>'
    );
  }

  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function phoneHrefFrom(phone) {
    var digits = String(phone || '').replace(/[^\d+]/g, '');
    return digits ? 'tel:' + digits : '';
  }

  function emailHrefFrom(email) {
    var e = String(email || '').trim();
    return e ? 'mailto:' + e : '';
  }

  function collectPublicSiteContentFromForm(base) {
    base = base || DEFAULT_PUBLIC_SITE_CONTENT;
    var aboutItems = (base.about.items || []).map(function (_, i) {
      return { title: val('about_title_' + i), text: val('about_text_' + i) };
    });
    var serviceItems = (base.services.items || []).map(function (_, i) {
      return { title: val('service_title_' + i), text: val('service_text_' + i) };
    });
    var homeLinks = (base.home.links || []).map(function (link, i) {
      return Object.assign({}, link, { title: val('home_link_title_' + i), text: val('home_link_text_' + i) });
    });
    var stats = (base.projects.stats || []).map(function (_, i) {
      return { value: val('proj_stat_value_' + i), label: val('proj_stat_label_' + i) };
    });
    var highlights = (base.projects.highlights || []).map(function (_, i) {
      return val('proj_highlight_' + i);
    });
    var navLinks = (base.navbar.links || []).map(function (link, i) {
      return Object.assign({}, link, { label: val('nav_link_' + i) });
    });
    var perks = (base.careers.perks || []).map(function (_, i) {
      return val('career_perk_' + i);
    });
    var phone = val('contact_phone');
    var email = val('contact_email');

    return {
      navbar: {
        brand: val('navbar_brand'),
        ctaCareers: val('navbar_ctaCareers'),
        links: navLinks,
      },
      hero: {
        stat1: val('hero_stat1'),
        stat2: val('hero_stat2'),
        stat3: val('hero_stat3'),
        badge: val('hero_badge'),
        title1: val('hero_title1'),
        title2: val('hero_title2'),
        description: val('hero_description'),
        tagline: val('hero_tagline'),
        btnServices: val('hero_btnServices'),
        btnAbout: val('hero_btnAbout'),
        btnContact: val('hero_btnContact'),
        btnCareers: val('hero_btnCareers'),
      },
      home: {
        label: val('home_label'),
        title: val('home_title'),
        linkOpen: val('home_linkOpen'),
        links: homeLinks,
      },
      about: {
        label: val('about_label'),
        title: val('about_title'),
        intro: val('about_intro'),
        items: aboutItems,
      },
      services: {
        label: val('services_label'),
        title: val('services_title'),
        items: serviceItems,
      },
      projects: {
        label: val('projects_label'),
        title: val('projects_title'),
        highlightsTitle: val('projects_highlightsTitle'),
        stats: stats,
        highlights: highlights,
      },
      contact: {
        label: val('contact_label'),
        title: val('contact_title'),
        address: val('contact_address'),
        phone: phone,
        phoneHref: phoneHrefFrom(phone),
        email: email,
        emailHref: emailHrefFrom(email),
        website: val('contact_website'),
        hoursTitle: val('contact_hoursTitle'),
        hoursWeekday: val('contact_hoursWeekday'),
        hoursSaturday: val('contact_hoursSaturday'),
        hoursSunday: val('contact_hoursSunday'),
        hoursNote: val('contact_hoursNote'),
      },
      careers: {
        label: val('careers_label'),
        title: val('careers_title'),
        intro: val('careers_intro'),
        pageIntro: val('careers_pageIntro'),
        perksTitle: val('careers_perksTitle'),
        perks: perks,
        sidebarNote: val('careers_sidebarNote'),
        footer: val('careers_footer'),
        backHome: val('careers_backHome'),
        backShort: val('careers_backShort'),
      },
      footer: {
        brand: val('footer_brand'),
        copyright: val('footer_copyright'),
      },
    };
  }

  function updatePanelToolbar(tabId) {
    var meta = TAB_META[tabId];
    if (!meta) return;
    var toolbar = document.querySelector('.psc-toolbar');
    if (!toolbar) return;
    toolbar.setAttribute('data-psc-toolbar', tabId);
    toolbar.innerHTML =
      '<div><h4>' +
      esc(meta.label) +
      '</h4><p>' +
      esc(meta.desc) +
      '</p></div>' +
      (meta.preview
        ? '<a class="psc-preview-link" href="' +
          esc(meta.preview) +
          '" target="_blank" rel="noopener"><span class="material-symbols-outlined" style="font-size:18px">open_in_new</span> Хуудас харах</a>'
        : '');
  }

  function initPublicSiteEditorTabs() {
    var body = document.querySelector('.psc-body');
    if (body) body.classList.add('psc-ready');
    document.querySelectorAll('[data-psc-tab]').forEach(function (btn) {
      btn.onclick = function () {
        var tab = btn.getAttribute('data-psc-tab');
        document.querySelectorAll('.psc-nav-btn').forEach(function (b) {
          b.classList.toggle('active', b === btn);
        });
        document.querySelectorAll('.psc-panel').forEach(function (p) {
          p.classList.toggle('active', p.getAttribute('data-psc-panel') === tab);
        });
        updatePanelToolbar(tab);
      };
    });
  }

  global.DEFAULT_PUBLIC_SITE_CONTENT = DEFAULT_PUBLIC_SITE_CONTENT;
  global.mergePublicSiteContent = mergePublicSiteContent;
  global.renderPublicSiteEditorHtml = renderPublicSiteEditorHtml;
  global.collectPublicSiteContentFromForm = collectPublicSiteContentFromForm;
  global.initPublicSiteEditorTabs = initPublicSiteEditorTabs;
})(typeof window !== 'undefined' ? window : globalThis);
