  const SHEET_API_URL = "https://sheetdb.io/api/v1/6l9hinj4sdwbb";
  let certificates = [];

  async function loadCertificatesFromSheet(){
    if(!SHEET_API_URL){ return; }
    try{
      const res = await fetch(SHEET_API_URL);
      if(!res.ok) throw new Error('Ошибка загрузки таблицы');
      const rows = await res.json();
      const parsed = rows
        .map(r => ({
          name: String(r['ФИО'] || '').trim(),
          course: String(r['Курс'] || '').trim(),
          date: String(r['Дата'] || '').trim(),
          number: String(r['Номер'] || '').trim()
        }))
        .filter(c => c.name);
      if(parsed.length){ certificates = parsed; }
    }catch(e){
      console.warn('Не удалось загрузить таблицу:', e);
    }
    countEl.textContent = certificates.length;
    renderResults(certificates, SHEET_API_URL ? undefined : 'no-source');
  }

  const resultsEl = document.getElementById('results');
  const countEl = document.getElementById('res-count');

  function norm(s){ return (s||"").toLowerCase().trim(); }

  // Строка результата поиска — показывает только ФИО и статус, ничего больше
  function makeCard(cert){
    const div = document.createElement('div');
    div.className = 'cert-row';
    div.innerHTML = `
      <div>
        <span class="status-badge">Подтверждено</span>
        <div class="cert-row-name">${cert.name}</div>
      </div>
      <button class="nav-cta" style="font-size:0.85rem;padding:10px 24px;" onclick="showCertPreview('${cert.number}')">Скачать PDF</button>
    `;
    resultsEl.appendChild(div);
  }

  // Собирает разметку полного диплома. mode='pdf' — для скрытой генерации, mode='preview' — для модалки.
  // Разные префиксы id, чтобы превью и PDF-копия могли существовать одновременно без дублей id.
  function buildCertificateMarkup(cert, mode){
    const p = mode === 'preview' ? 'preview' : 'pdf';
    return `
      <div class="certificate" id="${p}-cert-${cert.number}">
        <div class="cert-overlay cert-overlay-name">${cert.name}</div>
        <div class="cert-overlay cert-overlay-course">«${cert.course}»</div>
        <div class="cert-overlay cert-overlay-date">${cert.date}</div>
        <div class="cert-overlay cert-overlay-regnum">${cert.number}</div>
        <div class="cert-overlay cert-overlay-qr" id="qr-${p}-${cert.number}"></div>
      </div>
    `;
  }

  function makeQR(elId, certNumber){
    new QRCode(document.getElementById(elId), {
      text: `https://imedinstitute.kz/verify/${certNumber}`,
      width: 110, height: 110,
      colorDark:"#16305A", colorLight:"#FDFBF9",
      correctLevel: QRCode.CorrectLevel.M
    });
  }

  // Клик по «Скачать PDF» в результатах: сначала показываем предпросмотр в модалке,
  // файл скачивается только по кнопке внутри модалки.
  function showCertPreview(certNumber){
    const cert = certificates.find(c => c.number === certNumber);
    if(!cert) return;

    const modal = document.getElementById('cert-modal');
    const wrap  = document.getElementById('cert-preview-wrap');
    document.getElementById('cert-modal-sub').textContent = `${cert.name} · ${cert.number}`;

    // строим полноразмерный диплом (1308×924) и масштабируем под ширину экрана
    wrap.innerHTML = buildCertificateMarkup(cert, 'preview');
    makeQR(`qr-preview-${cert.number}`, cert.number);

    const certEl = wrap.querySelector('.certificate');
    const scaleToFit = () => {
      const avail = Math.min(window.innerWidth * 0.9, 992);
      const s = Math.min(1, avail / 1308);
      certEl.style.transform = `scale(${s})`;
      wrap.style.width  = (1308 * s) + 'px';
      wrap.style.height = (924 * s) + 'px';
    };
    scaleToFit();
    modal._scaleToFit = scaleToFit;
    window.addEventListener('resize', scaleToFit);

    document.getElementById('cert-download-btn').onclick = function(){ downloadPDF(cert.number, this); };

    modal.classList.add('open');
    modal.setAttribute('aria-hidden','false');
    document.body.style.overflow = 'hidden';
  }

  function closeCertModal(){
    const modal = document.getElementById('cert-modal');
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden','true');
    document.body.style.overflow = '';
    document.getElementById('cert-preview-wrap').innerHTML = '';
    if(modal._scaleToFit){ window.removeEventListener('resize', modal._scaleToFit); modal._scaleToFit = null; }
  }

  // Генерация PDF: диплом собирается и рисуется в скрытой области, никогда не показывается на странице.
  // Вызывается из кнопки в модалке предпросмотра (btn — эта кнопка, для индикатора загрузки).
  async function downloadPDF(certNumber, btn) {
    const cert = certificates.find(c => c.number === certNumber);
    if(!cert) return;

    if(btn){ btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = 'Готовим PDF…'; }

    const container = document.getElementById('pdf-render-area');
    container.innerHTML = buildCertificateMarkup(cert, 'pdf');

    makeQR(`qr-pdf-${cert.number}`, cert.number);

    // ждём, чтобы шрифты (курсив) точно успели загрузиться перед захватом
    try{ await document.fonts.ready; }catch(e){ /* ignore */ }
    await new Promise(r => setTimeout(r, 150));

    const element = document.getElementById(`pdf-cert-${cert.number}`);
    const opt = {
      margin:       0,
      filename:     `Сертификат_${cert.number}_${cert.name.replace(/\s+/g, '_')}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      // width/height/windowWidth/windowHeight фиксируют полный размер диплома (1308×924),
      // иначе html2canvas снимает только видимую часть окна и обрезает сертификат справа
      html2canvas:  { scale: 2, useCORS: true, letterRendering: true, backgroundColor: '#FDFBF9',
                      width: 1308, height: 924, windowWidth: 1308, windowHeight: 924 },
      // avoid-all запрещает разбиение узкого/высокого холста на вторую страницу (обрезка снизу)
      pagebreak:    { mode: 'avoid-all' },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };
    try{
      await html2pdf().set(opt).from(element).save();
    }catch(err){
      console.error('Ошибка при создании PDF:', err);
      alert('Не удалось создать PDF. Откройте консоль браузера (Cmd+Option+J) и пришлите скриншот ошибки.');
    }

    container.innerHTML = ''; // очищаем скрытую область после скачивания

    if(btn){ btn.disabled = false; btn.textContent = btn.dataset.label || 'Скачать PDF'; }
  }

  function renderResults(list, emptyReason){
    resultsEl.innerHTML = '';
    if(list.length === 0){
      const message = emptyReason === 'no-source'
        ? { title:'Реестр пока пуст', text:'Проверьте подключение таблицы (SHEET_API_URL), чтобы сертификаты появились здесь.' }
        : { title:'Ничего не найдено', text:'Проверьте написание ФИО, курса или номера сертификата.' };
      resultsEl.innerHTML = `<div class="no-results"><strong>${message.title}</strong>${message.text}</div>`;
      return;
    }
    list.forEach(makeCard);
  }

  function runSearch(){
    const name = norm(document.getElementById('q-name').value);

    const filtered = certificates.filter(c =>
      !name || norm(c.name).includes(name)
    );
    countEl.textContent = filtered.length;
    renderResults(filtered);
  }

  document.getElementById('q-name').addEventListener('keydown', e=>{
    if(e.key === 'Enter') runSearch();
  });

  countEl.textContent = certificates.length;
  renderResults(certificates, 'no-source');
  loadCertificatesFromSheet();

  // закрытие модалки предпросмотра: клик по фону/крестику/«Закрыть» или Esc
  const certModal = document.getElementById('cert-modal');
  certModal.addEventListener('click', e => { if(e.target.hasAttribute('data-close')) closeCertModal(); });
  document.addEventListener('keydown', e => { if(e.key === 'Escape' && certModal.classList.contains('open')) closeCertModal(); });

  // mobile menu
  const burger = document.getElementById('burger');
  const mobileMenu = document.getElementById('mobile-menu');
  burger.addEventListener('click', () => {
    const isOpen = mobileMenu.classList.toggle('open');
    burger.classList.toggle('open', isOpen);
    burger.setAttribute('aria-expanded', isOpen);
  });

  // Переключение разделов как отдельных "страниц" (без прокрутки вниз по одной длинной странице)
  const pages = document.querySelectorAll('.page');
  const navLinks = document.querySelectorAll('[data-nav]');

  function showPage(id){
    pages.forEach(p => p.classList.toggle('active', p.dataset.page === id));
    navLinks.forEach(a => a.classList.toggle('active-link', a.dataset.nav === id));
    window.scrollTo({ top: 0, behavior: 'auto' });
    history.replaceState(null, '', '#' + id);
  }

  navLinks.forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      showPage(a.dataset.nav);
      mobileMenu.classList.remove('open');
      burger.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
    });
  });

  // При открытии сайта по ссылке с якорем (например, #kursy) — сразу открыть нужную страницу
  const initialPage = ['poisk','kursy','ob-institute','kontakty'].includes(location.hash.replace('#',''))
    ? location.hash.replace('#','')
    : 'poisk';
  showPage(initialPage);

  // site QR
  new QRCode(document.getElementById('site-qr'), {
    text: "https://imedinstitute.kz",
    width: 120, height: 120,
    colorDark:"#0B3D3B", colorLight:"#ffffff",
    correctLevel: QRCode.CorrectLevel.M
  });
