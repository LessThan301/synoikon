// "Share map" cards: a PNG with the word, language, the current network render,
// the shareable URL and the text attribution. Also used (headless) for Open Graph images.
const BG = '#0f1220', PANEL = '#161a2e', TEXT = '#e9ecf7', MUTED = '#9aa3c7', ACCENT = '#ff6b4a';
export const ATTRIBUTION = 'Text: Wikipedia/Wikiquote, CC BY-SA';
export const FORMATS = {
  og: { w: 1200, h: 630, label: 'Landscape 1200×630' },
  square: { w: 1080, h: 1080, label: 'Square 1080×1080' },
};
const RTL = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;

function logo(c, x, y, s) {
  const dots = [[0.5, 0.5, 0.22, ACCENT], [0.19, 0.22, 0.11, '#5b8def'], [0.81, 0.28, 0.14, '#38c6a8'], [0.75, 0.81, 0.09, '#f2b134']];
  c.strokeStyle = 'rgba(143,163,224,.45)'; c.lineWidth = s * 0.03;
  for (const [dx, dy] of [[0.19, 0.22], [0.81, 0.28], [0.75, 0.81]]) { c.beginPath(); c.moveTo(x + s / 2, y + s / 2); c.lineTo(x + dx * s, y + dy * s); c.stroke(); }
  for (const [dx, dy, r, col] of dots) { c.fillStyle = col; c.beginPath(); c.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2); c.fill(); }
}

/** Largest font size ≤ max at which `text` fits in `width`. */
function fitFont(c, text, weight, max, min, width, stack) {
  let size = max;
  for (; size > min; size -= 2) { c.font = `${weight} ${size}px ${stack}`; if (c.measureText(text).width <= width) break; }
  c.font = `${weight} ${size}px ${stack}`;
  return size;
}
function text(c, s, x, y, { size = 20, weight = 400, color = TEXT, stack, maxWidth, align = 'left' } = {}) {
  c.font = `${weight} ${size}px ${stack}`;
  c.fillStyle = color; c.textAlign = align; c.textBaseline = 'alphabetic';
  c.direction = RTL.test(s) ? 'rtl' : 'ltr';
  let out = s;
  if (maxWidth) while (out.length > 1 && c.measureText(out).width > maxWidth) out = out.slice(0, -2) + '…';
  c.fillText(out, x, y);
  c.direction = 'ltr';
}
function roundRect(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

/**
 * Render a card. info = { word, langLine, neighbors: [labels], url, rankLabel, fontStack }.
 * Returns an HTMLCanvasElement (or OffscreenCanvas-like) of the format's size.
 */
export function renderCard(graph, info, format = 'og') {
  const { w, h } = FORMATS[format];
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  const stack = info.fontStack;
  c.fillStyle = BG; c.fillRect(0, 0, w, h); // flat: gradients bloat PNGs
  let shortUrl = info.url.replace(/^https?:\/\//, '');
  try { shortUrl = decodeURI(shortUrl); } catch { /* keep encoded */ }

  if (format === 'og') {
    const L = 56, colW = 380;
    logo(c, L, 48, 44);
    text(c, 'Synoikon', L + 58, 80, { size: 28, weight: 700, stack });
    const size = fitFont(c, info.word, 800, 96, 34, colW, stack);
    text(c, info.word, L, 150 + size * 0.75, { size, weight: 800, stack, color: '#ffffff' });
    let y = 150 + size * 0.75 + 46;
    text(c, info.langLine, L, y, { size: 24, color: MUTED, stack, maxWidth: colW }); y += 50;
    text(c, info.rankLabel, L, y, { size: 18, weight: 600, color: ACCENT, stack }); y += 34;
    for (const n of info.neighbors.slice(0, 6)) { text(c, n, L, y, { size: 24, stack, maxWidth: colW }); y += 34; }
    text(c, shortUrl, L, h - 72, { size: 18, color: TEXT, stack, maxWidth: colW + 20 });
    text(c, ATTRIBUTION, L, h - 44, { size: 16, color: MUTED, stack });
    const gx = 470, gy = 28, gw = w - gx - 28, gh = h - 56;
    c.fillStyle = PANEL; roundRect(c, gx, gy, gw, gh, 22); c.fill();
    graph.renderInto(c, gx + 6, gy + 6, gw - 12, gh - 12, { maxK: 2.4 });
  } else {
    const L = 64;
    logo(c, L, 52, 48);
    text(c, 'Synoikon', L + 64, 88, { size: 30, weight: 700, stack });
    text(c, info.langLine, w - L, 88, { size: 26, color: MUTED, stack, align: 'right', maxWidth: 520 });
    const size = fitFont(c, info.word, 800, 110, 40, w - 2 * L, stack);
    text(c, info.word, L, 150 + size * 0.8, { size, weight: 800, stack, color: '#ffffff' });
    const gy = 150 + size + 30, gh = h - gy - 140;
    c.fillStyle = PANEL; roundRect(c, 32, gy, w - 64, gh, 26); c.fill();
    graph.renderInto(c, 40, gy + 8, w - 80, gh - 16, { maxK: 2.6 });
    text(c, `${info.rankLabel}: ${info.neighbors.slice(0, 5).join(' · ')}`, L, h - 92, { size: 22, stack, maxWidth: w - 2 * L });
    text(c, shortUrl, L, h - 54, { size: 20, color: TEXT, stack, maxWidth: w - 2 * L - 380 });
    text(c, ATTRIBUTION, w - L, h - 54, { size: 18, color: MUTED, stack, align: 'right' });
  }
  return cv;
}

export const cardBlob = (cv) => new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('PNG encoding failed'))), 'image/png'));
