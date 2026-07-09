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
      <button class="nav-cta" style="font-size:0.85rem;padding:10px 24px;" onclick="downloadPDF('${cert.number}')">Скачать PDF</button>
    `;
    resultsEl.appendChild(div);
  }

  // Собирает разметку полного диплома — используется ТОЛЬКО в скрытой области для генерации PDF
  function buildCertificateMarkup(cert){
    return `
      <div class="certificate" id="pdf-cert-${cert.number}">
        <div class="cert-overlay cert-overlay-name">${cert.name}</div>
        <div class="cert-overlay cert-overlay-course">«${cert.course}»</div>
        <div class="cert-overlay cert-overlay-date">${cert.date}</div>
        <div class="cert-overlay cert-overlay-regnum">${cert.number}</div>
        <div class="cert-overlay cert-overlay-qr" id="qr-pdf-${cert.number}"></div>
      </div>
    `;
  }

  // Генерация PDF: диплом собирается и рисуется в скрытой области, никогда не показывается на странице
  async function downloadPDF(certNumber) {
    const cert = certificates.find(c => c.number === certNumber);
    if(!cert) return;

    const container = document.getElementById('pdf-render-area');
    container.innerHTML = buildCertificateMarkup(cert);

    new QRCode(document.getElementById(`qr-pdf-${cert.number}`), {
      text: `https://imedinstitute.kz/verify/${cert.number}`,
      width: 110, height: 110,
      colorDark:"#16305A", colorLight:"#FDFBF9",
      correctLevel: QRCode.CorrectLevel.M
    });

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
