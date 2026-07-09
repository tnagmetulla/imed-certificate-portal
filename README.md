# Imed Institute — портал проверки сертификатов

Статический сайт ТОО «Imed Institute» для поиска и проверки сертификатов о прохождении
обучения, с генерацией PDF-сертификата на стороне браузера.

## 🌐 GitHub Pages

Сайт публикуется из папки [`docs/`](docs/) (Settings → Pages → Branch: `main`, Folder: `/docs`).

## Структура

| Файл | Назначение |
|------|-----------|
| `docs/index.html` | Разметка страницы |
| `docs/styles.css` | Все стили (включает base64-фон сертификата) |
| `docs/app.js` | Логика: поиск, загрузка данных, генерация PDF, QR, навигация |
| `docs/fonts.css` | Локально вшитые шрифты (woff2, base64) — Great Vibes, Fraunces, IBM Plex Sans/Mono, PT Serif |

## Как это работает

- Данные сертификатов загружаются из Google Sheets через [SheetDB](https://sheetdb.io) (`SHEET_API_URL` в `app.js`).
- PDF собирается из фонового изображения диплома (1308×924) с наложением динамического текста,
  захватывается `html2canvas` и сохраняется через `html2pdf.js` как A4 landscape.
- QR-код генерируется библиотекой `qrcode.js`.
- Шрифты вшиты локально, поэтому вид сертификата **идентичен на телефоне, планшете и компьютере**.

## Локальный запуск

```bash
cd docs
python3 -m http.server 8000
# открыть http://localhost:8000
```

## Зависимости (подключаются с CDN)

- [html2pdf.js](https://github.com/eKoopmans/html2pdf.js) 0.9.3
- [qrcode.js](https://github.com/davidshimjs/qrcodejs) 1.0.0
