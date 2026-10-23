// Canvas renderer for the Synoikon network (D3 force layout + d3-zoom/drag).
//
// Why canvas: with 80 neighbors and several hundred lines, the SVG version
// updated ~1000 DOM attributes per simulation tick and restyled every element
// on hover. Here one draw call paints everything, draws are coalesced with
// requestAnimationFrame, and nothing is drawn while the layout is at rest.
/* global d3 */
import { t as tr } from './i18n.js';

const TARGET_ID = '__target__';
const TARGET_COLOR = '#ff6b4a';
const MAX_DPR = 2;          // sharper than this costs fill-rate without visible gain
const LABEL_MIN_PX = 7;     // labels smaller than this on screen are skipped (level of detail)
const SCRIPT_FONTS = '"Noto Sans SC", "Noto Sans Devanagari", "Noto Sans Bengali", "Noto Naskh Arabic", "Noto Nastaliq Urdu"';
const RTL_RE = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;

export function createGraph(canvas, tooltip, { onSelect, onFocus } = {}) {
  const ctx = canvas.getContext('2d');
  const sel = d3.select(canvas);
  let W = 0, H = 0, dpr = 1;
  let nodes = [], links = [], byId = new Map(), adj = new Map(), target = null;
  let buckets = [];          // links grouped by identical stroke style
  let labelOrder = [];       // nodes grouped by font size
  let gapMax = 200, rMax = 30;
  let t = d3.zoomIdentity;   // world -> screen
  let hovered = null, dragging = null, pinned = null, suppressClick = false, pressTimer = 0;
  let userMoved = false;     // the user zoomed/panned: don't auto-fit any more
  let frame = 0;
  let pointer = null, pointerFrame = 0;
  let fontStack = `Inter, ui-sans-serif, system-ui, ${SCRIPT_FONTS}, sans-serif`;

  const sim = d3.forceSimulation()
    .alphaMin(0.004)
    .alphaDecay(0.03)
    .velocityDecay(0.45)
    .on('tick', requestDraw)
    .on('end', () => { if (!userMoved) fit(true); })
    .stop();

  // ---- sizing -------------------------------------------------------------
  function resize() {
    const r = canvas.getBoundingClientRect();
    const nw = Math.max(1, Math.round(r.width)), nh = Math.max(1, Math.round(r.height));
    const nd = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    if (nw === W && nh === H && nd === dpr) return false;
    const first = W === 0;
    // keep the same world point in the centre
    if (!first) t = d3.zoomIdentity.translate(t.x + (nw - W) / 2, t.y + (nh - H) / 2).scale(t.k);
    W = nw; H = nh; dpr = nd;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    sel.property('__zoom', t);
    requestDraw();
    return true;
  }
  new ResizeObserver(() => { if (resize() && nodes.length && !userMoved) fit(false); }).observe(canvas);

  // ---- data -------------------------------------------------------------
  function setData(net, { resetView = false } = {}) {
    resize();
    if (resetView) { nodes = []; hovered = null; }
    const old = new Map(nodes.map((d) => [d.id, d]));
    const keepView = nodes.length > 0 && userMoved;
    nodes = net.nodes.map((d) => {
      const o = old.get(d.id);
      return o ? { ...d, x: o.x, y: o.y, vx: 0, vy: 0 } : { ...d };
    });
    links = net.links.map((l) => ({ ...l }));
    byId = new Map(nodes.map((d) => [d.id, d]));
    target = byId.get(TARGET_ID);
    const neighbors = nodes.filter((d) => !d.target);

    // Node AREA ∝ frequency (sqrt radius scale).
    const n = Math.max(neighbors.length, 1);
    const S = Math.max(320, Math.min(W, H));
    rMax = Math.max(16, Math.min(56, S / (4 + Math.sqrt(n) * 1.6)));
    const maxF = d3.max(neighbors, (d) => d.freq) || 1;
    const r = d3.scaleSqrt().domain([0, maxF]).range([0, rMax]);
    for (const d of neighbors) d.r = Math.max(2.5, r(d.freq));
    target.r = Math.min(r(target.freq), rMax * 1.3);
    target.capped = r(target.freq) > rMax * 1.3;

    // One strength scale for all lines; more co-occurrence => shorter line.
    const maxW = d3.max(links, (l) => l.weight) || 1;
    for (const l of links) l.s = Math.sqrt(l.weight / maxW);
    const gapMin = 4;
    gapMax = S * 0.42;
    const dist = (l) => {
      const a = typeof l.source === 'object' ? l.source : byId.get(l.source);
      const b = typeof l.target === 'object' ? l.target : byId.get(l.target);
      return a.r + b.r + gapMin + (gapMax - gapMin) * (1 - l.s);
    };

    const tColor = d3.scaleSequential(d3.interpolateRgbBasis(['#7f8fd6', '#5b8def', '#38c6a8', '#9be15d'])).domain([0, 1]);
    const share = new Map(links.filter((l) => l.kind === 'target').map((l) => [l.target, l]));
    for (const d of nodes) {
      d.color = d.target ? TARGET_COLOR : tColor(share.get(d.id)?.s ?? 0);
      d.font = d.target ? Math.round(Math.max(14, Math.min(22, d.r * 0.42))) : Math.round(Math.max(10, Math.min(17, d.r * 0.42)));
      d.inside = d.target || d.r >= 18;
      d.rtl = RTL_RE.test(d.label);
    }

    adj = new Map(nodes.map((d) => [d.id, new Map()]));
    for (const l of links) { adj.get(l.source).set(l.target, l.weight); adj.get(l.target).set(l.source, l.weight); }

    // Seed new nodes near where their line to the centre wants them, so the
    // layout settles fast and smoothly instead of exploding from one point.
    target.fx = 0; target.fy = 0; target.x = 0; target.y = 0;
    let i = 0;
    for (const d of neighbors) {
      i++;
      if (old.has(d.id)) continue;
      const l = share.get(d.id);
      const a = i * 2.39996; // golden angle
      const rad = l ? dist(l) : gapMax;
      d.x = Math.cos(a) * rad; d.y = Math.sin(a) * rad;
    }

    // stroke buckets: quantise width/alpha so links are drawn in a few paths
    const bmap = new Map();
    for (const l of links) {
      const q = Math.round(l.s * 12);
      const key = `${l.kind}|${q}`;
      if (!bmap.has(key)) {
        const s = q / 12;
        bmap.set(key, { color: l.kind === 'target' ? '255,154,128' : '143,163,224', width: 0.5 + 5 * s ** 1.6, alpha: 0.12 + 0.6 * s, links: [] });
      }
      bmap.get(key).links.push(l);
    }
    buckets = [...bmap.values()].sort((a, b) => a.width - b.width);
    labelOrder = [...nodes].sort((a, b) => a.font - b.font);
    hovered = hovered && byId.get(hovered.id) ? byId.get(hovered.id) : null;
    if (!hovered && !pinned) hideTip();

    sim.nodes(nodes)
      .force('link', d3.forceLink(links).id((d) => d.id).distance(dist)
        .strength((l) => (l.kind === 'target' ? 0.7 : 0.03 + 0.3 * l.s)))
      .force('charge', d3.forceManyBody().strength((d) => -10 - d.r * 1.5).distanceMax(gapMax).theta(0.9))
      .force('collide', d3.forceCollide((d) => d.r + 3).iterations(2))
      .force('x', d3.forceX(0).strength(0.01))
      .force('y', d3.forceY(0).strength(0.015));

    const fresh = nodes.filter((d) => !old.has(d.id)).length / nodes.length;
    sim.alpha(fresh > 0.5 ? 0.6 : 0.3).restart();
    if (!keepView) { userMoved = false; fit(old.size > 0); }
    canvas.setAttribute('aria-label', `Semantic network of “${target.label}”: ${neighbors.slice(0, 12).map((d) => d.label).join(', ')}…`);
    requestDraw();
  }

  // ---- drawing --------------------------------------------------------------
  function requestDraw() {
    if (!frame) frame = requestAnimationFrame(draw);
  }

  function draw() {
    frame = 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!nodes.length) return;
    paint(ctx, t, W, H, dpr, hovered, LABEL_MIN_PX);
  }

  /**
   * Paint the network with world→screen transform `tr` into a w×h (CSS px) area of
   * context `ctx` scaled by `pr`. Shared by the live canvas and the share card.
   */
  function paint(ctx, tr, W, H, pr, hovered, labelMin) {
    ctx.setTransform(pr * tr.k, 0, 0, pr * tr.k, pr * tr.x, pr * tr.y);
    const nb = hovered ? adj.get(hovered.id) : null;
    const incident = (l) => l.source === hovered || l.target === hovered;
    const k = tr.k;
    // visible world rectangle (for culling)
    const x0 = -tr.x / k, y0 = -tr.y / k, x1 = (W - tr.x) / k, y1 = (H - tr.y) / k;

    // links. Stroked one by one: in software-rasterised canvases one huge
    // multi-segment path builds a full-screen coverage mask and is several
    // times slower than many short strokes. Off-screen lines are culled.
    ctx.lineCap = 'round';
    const off = (l, pad) => {
      const ax = l.source.x, ay = l.source.y, bx = l.target.x, by = l.target.y;
      return (ax < x0 - pad && bx < x0 - pad) || (ax > x1 + pad && bx > x1 + pad)
        || (ay < y0 - pad && by < y0 - pad) || (ay > y1 + pad && by > y1 + pad);
    };
    for (let pass = 0; pass < (hovered ? 2 : 1); pass++) {
      for (const b of buckets) {
        ctx.lineWidth = b.width;
        ctx.strokeStyle = `rgba(${b.color},${!hovered ? b.alpha : pass === 0 ? b.alpha * 0.15 : Math.min(1, b.alpha + 0.25)})`;
        for (const l of b.links) {
          if (hovered && incident(l) !== (pass === 1)) continue;
          if (off(l, b.width)) continue;
          ctx.beginPath(); ctx.moveTo(l.source.x, l.source.y); ctx.lineTo(l.target.x, l.target.y); ctx.stroke();
        }
      }
    }

    // nodes (borderless discs)
    const visible = (d, pad = 0) => d.x + d.r + pad > x0 && d.x - d.r - pad < x1 && d.y + d.r + pad > y0 && d.y - d.r - pad < y1;
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = TARGET_COLOR;
    ctx.beginPath(); ctx.arc(target.x, target.y, target.r + 10, 0, 2 * Math.PI); ctx.fill();
    for (const d of nodes) {
      if (!visible(d)) continue;
      const dim = hovered && d !== hovered && !nb.has(d.id);
      ctx.globalAlpha = (dim ? 0.12 : 1) * (d.target ? 1 : 0.88);
      ctx.fillStyle = d.color;
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 2 * Math.PI); ctx.fill();
    }

    // labels, with level of detail: skip tiny ones unless they matter right now
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(15,18,32,0.85)';
    ctx.fillStyle = '#e9ecf7';
    let font = 0;
    for (const d of labelOrder) {
      const focus = d.target || d === hovered || (nb && nb.has(d.id));
      if (!focus && d.font * k < labelMin) continue;
      if (!visible(d, 60)) continue;
      const dim = hovered && !focus;
      if (d.font !== font || d.target) {
        font = d.font;
        ctx.font = `${d.target ? 700 : 400} ${font}px ${fontStack}`;
      }
      ctx.globalAlpha = dim ? 0.12 : 1;
      ctx.direction = d.rtl ? 'rtl' : 'ltr';
      const y = d.inside ? d.y : d.y + d.r + font * 0.75 + 1;
      ctx.strokeText(d.label, d.x, y);
      ctx.fillText(d.label, d.x, y);
      if (d.target) font = 0; // force font reset after the bold one
    }
    ctx.globalAlpha = 1;
  }

  // ---- zoom / pan / pinch ------------------------------------------------
  const zoom = d3.zoom().scaleExtent([0.2, 6])
    .on('zoom', (e) => { t = e.transform; if (e.sourceEvent) userMoved = true; requestDraw(); moveTip(); });

  function fit(animate = true) {
    if (!nodes.length || !W) return;
    const nt = fitTransform(W, H, 30, 2);
    if (animate) sel.transition().duration(600).call(zoom.transform, nt);
    else sel.call(zoom.transform, nt);
  }

  /** Transform that fits the whole network into a w×h box (world bounds include labels). */
  function fitTransform(w, h, pad, maxK) {
    let xa = Infinity, xb = -Infinity, ya = Infinity, yb = -Infinity;
    for (const d of nodes) {
      xa = Math.min(xa, d.x - d.r - 40); xb = Math.max(xb, d.x + d.r + 40);
      ya = Math.min(ya, d.y - d.r - 10); yb = Math.max(yb, d.y + d.r + 24);
    }
    const k = Math.min(maxK, 0.95 * Math.min((w - pad) / (xb - xa), (h - pad) / (yb - ya)));
    return d3.zoomIdentity.translate(w / 2, h / 2).scale(k).translate(-(xa + xb) / 2, -(ya + yb) / 2);
  }

  /** Draw the current network, fitted, into a box of another canvas (share card, OG image). */
  function renderInto(c, x, y, w, h, { pr = 1, maxK = 2.2, labelMin = 5 } = {}) {
    if (!nodes.length) return false;
    const f = fitTransform(w, h, 10, maxK);
    c.save();
    c.beginPath(); c.rect(x * pr, y * pr, w * pr, h * pr); c.clip();
    paint(c, d3.zoomIdentity.translate(x + f.x, y + f.y).scale(f.k), w + x, h + y, pr, null, labelMin);
    c.restore();
    return true;
  }

  /** Run the layout to rest synchronously (used before rendering images). */
  function settleNow(maxTicks = 600) {
    if (!nodes.length) return;
    sim.stop();
    for (let i = 0; i < maxTicks && sim.alpha() >= sim.alphaMin(); i++) sim.tick();
    sim.alpha(0);
    if (!userMoved) fit(false);
    requestDraw();
  }

  // ---- hit testing ------------------------------------------------------
  // ≤ 81 nodes: a linear scan is a few microseconds, cheaper than maintaining
  // a quadtree that would have to be rebuilt on every tick.
  function hit(px, py) {
    const [x, y] = t.invert([px, py]);
    const slop = 4 / t.k;
    let best = null, bestD = Infinity;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const d = nodes[i];
      const dx = x - d.x, dy = y - d.y;
      const dd = Math.sqrt(dx * dx + dy * dy) - d.r;
      if (dd <= slop && dd < bestD) { best = d; bestD = dd; }
    }
    return best;
  }
  const local = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  // ---- drag (only when the gesture starts on a node; otherwise zoom pans) ----
  sel.call(d3.drag()
    .container(canvas)
    .subject((e) => { const d = hit(e.x, e.y); return d ? { node: d, x: e.x, y: e.y } : null; })
    .on('start', (e) => {
      dragging = e.subject.node;
      userMoved = true;
      if (!e.active) sim.alphaTarget(0.12).restart();
      dragging.fx = dragging.x; dragging.fy = dragging.y;
    })
    .on('drag', (e) => {
      const [x, y] = t.invert([e.x, e.y]);
      dragging.fx = x; dragging.fy = y;
      requestDraw();
    })
    .on('end', (e) => {
      if (!e.active) sim.alphaTarget(0);
      if (!dragging.target) { dragging.fx = null; dragging.fy = null; }
      dragging = null;
    }));
  // zoom must be registered after drag so drag can claim node gestures first
  sel.call(zoom).on('dblclick.zoom', null);

  // ---- hover (coalesced to one update per frame) ---------------------------
  canvas.addEventListener('pointermove', (e) => {
    pointer = local(e);
    if (!pointerFrame) pointerFrame = requestAnimationFrame(processPointer);
  });
  canvas.addEventListener('pointerleave', () => { pointer = null; if (!dragging) setHover(null); });
  function processPointer() {
    pointerFrame = 0;
    if (!pointer) return;
    const d = dragging || hit(pointer[0], pointer[1]);
    setHover(d);
    moveTip();
  }
  function setHover(d) {
    if (d === hovered) return;
    hovered = d;
    canvas.style.cursor = d ? (d.target ? 'grab' : 'pointer') : '';
    if (d) { if (!pinned) showTip(d); onFocus?.(d); } else if (!pinned) hideTip();
    requestDraw();
  }
  canvas.addEventListener('click', (e) => {
    if (suppressClick) { suppressClick = false; return; }
    if (e.defaultPrevented) return;
    const [x, y] = local(e);
    const d = hit(x, y);
    if (d && (e.ctrlKey || e.metaKey)) { pointer = [x, y]; togglePin(d); return; } // Ctrl/⌘+click pins the info panel
    if (d && !d.target) onSelect?.(d.label);
  });
  // touch: long-press a circle to pin its info panel
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    const p0 = local(e); clearTimeout(pressTimer);
    const d = hit(p0[0], p0[1]); if (!d) return;
    pressTimer = setTimeout(() => { pointer = p0; suppressClick = true; pin(d); }, 550);
    const cancel = (ev) => { if (ev.type !== 'pointermove' || Math.hypot(local(ev)[0] - p0[0], local(ev)[1] - p0[1]) > 10) { clearTimeout(pressTimer); off(); } };
    const off = () => { for (const t of ['pointermove', 'pointerup', 'pointercancel']) canvas.removeEventListener(t, cancel); };
    for (const t of ['pointermove', 'pointerup', 'pointercancel']) canvas.addEventListener(t, cancel);
  });
  canvas.addEventListener('contextmenu', (e) => { if (pinned || suppressClick) e.preventDefault(); });
  function pin(d) {
    pinned = d; showTip(d, true); tooltip.classList.add('pinned');
    const x = Math.max(4, Math.min((pointer?.[0] ?? 20) + 14, W - tooltip._w - 4)), y = Math.max(4, Math.min((pointer?.[1] ?? 20) + 14, H - tooltip._h - 4));
    tooltip.style.transform = `translate(${x}px, ${y}px)`;
  }
  function unpin() { pinned = null; tooltip.classList.remove('pinned'); if (hovered) showTip(hovered); else hideTip(); }
  function togglePin(d) { if (pinned && pinned.label === d.label) unpin(); else pin(d); }
  tooltip.addEventListener('click', (e) => { if (e.target.closest('[data-unpin]')) unpin(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && pinned && !e.defaultPrevented) unpin(); });

  // ---- tooltip -----------------------------------------------------------
  function showTip(d, isPinned = false) {
    const nb = [...adj.get(d.id).entries()].filter(([id]) => id !== TARGET_ID)
      .sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([id, w]) => `${esc(byId.get(id).label)} <span class="muted">×${w}</span>`).join(', ');
    const head = isPinned ? `<button type="button" class="tip-x" data-unpin title="${esc(tr('Unpin'))}" aria-label="${esc(tr('Unpin'))}">×</button><span class="tip-pin" aria-hidden="true">📌</span> ` : '';
    tooltip.innerHTML = head + (d.target
      ? `<b>${esc(d.label)}</b><br><span class="muted">${esc(tr('{0} occurrences found · {1} context windows', d.freq, d.cooc))}${d.capped ? ' · circle capped for display' : ''}</span>`
      : `<b>${esc(d.label)}</b> <span class="muted">#${d.rank}</span><br>${esc(tr('{0}× near {1}', d.freq, '\u0000')).replace('\u0000', `<i>${esc(target.label)}</i>`)} <span class="muted">(${esc(tr('in {0} of {1} windows', d.cooc, target.cooc))})</span>`
        + (d.lr != null ? `<br>${esc(tr('Distinctiveness'))} <b>${d.lr.toFixed(1)}</b> <span class="muted">(${esc(tr('≈{0} more often than in general text', fmtX(d.lr)))}; LL ${Math.round(d.g2)})</span>` : '')
        + (nb ? `<br><span class="muted">${esc(tr('Often with'))}:</span> ${nb}` : '')
        + (d.target ? '' : `<br><span class="muted">${esc(tr('Click to map “{0}”', d.label))}</span>`));
    tooltip.classList.remove('hidden');
    tooltip._w = tooltip.offsetWidth; tooltip._h = tooltip.offsetHeight; // measure once per node
  }
  function moveTip() {
    if (!hovered || !pointer || pinned) return;
    const x = Math.max(4, Math.min(pointer[0] + 14, W - (tooltip._w || 260) - 4));
    const y = Math.max(4, Math.min(pointer[1] + 14, H - (tooltip._h || 120) - 4));
    tooltip.style.transform = `translate(${x}px, ${y}px)`;
  }
  function hideTip() { tooltip.classList.add('hidden'); }

  // ---- SVG export (built on demand from current positions) -----------------
  function toSVG() {
    if (!nodes.length) return null;
    let xa = Infinity, xb = -Infinity, ya = Infinity, yb = -Infinity;
    for (const d of nodes) {
      xa = Math.min(xa, d.x - d.r - 50); xb = Math.max(xb, d.x + d.r + 50);
      ya = Math.min(ya, d.y - d.r - 20); yb = Math.max(yb, d.y + d.r + 30);
    }
    const f = (v) => Math.round(v * 10) / 10;
    const out = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(xa)} ${f(ya)} ${f(xb - xa)} ${f(yb - ya)}" width="${Math.round(xb - xa)}" height="${Math.round(yb - ya)}">`,
      `<style>text{font-family:${fontStack.replace(/"/g, "'")};fill:#e9ecf7;paint-order:stroke;stroke:rgba(15,18,32,.85);stroke-width:3px;stroke-linejoin:round;text-anchor:middle}</style>`,
      `<rect x="${f(xa)}" y="${f(ya)}" width="${f(xb - xa)}" height="${f(yb - ya)}" fill="#0f1220"/>`, '<g stroke-linecap="round">'];
    for (const b of buckets) {
      for (const l of b.links) out.push(`<line x1="${f(l.source.x)}" y1="${f(l.source.y)}" x2="${f(l.target.x)}" y2="${f(l.target.y)}" stroke="rgb(${b.color})" stroke-opacity="${f(b.alpha * 100) / 100}" stroke-width="${f(b.width)}"/>`);
    }
    out.push('</g>', `<circle cx="${f(target.x)}" cy="${f(target.y)}" r="${f(target.r + 10)}" fill="${TARGET_COLOR}" opacity="0.16"/>`);
    for (const d of nodes) out.push(`<circle cx="${f(d.x)}" cy="${f(d.y)}" r="${f(d.r)}" fill="${d.color}"${d.target ? '' : ' fill-opacity="0.88"'}/>`);
    for (const d of nodes) {
      const y = d.inside ? d.y : d.y + d.r + d.font * 0.75 + 1;
      out.push(`<text x="${f(d.x)}" y="${f(y)}" dy="0.35em" font-size="${d.font}"${d.target ? ' font-weight="700"' : ''}${d.rtl ? ' direction="rtl" unicode-bidi="embed"' : ''}>${esc(d.label)}</text>`);
    }
    out.push('</svg>');
    return out.join('\n');
  }

  function clear() {
    sim.stop(); nodes = []; links = []; buckets = []; labelOrder = []; hovered = null; pinned = null; tooltip.classList.remove('pinned'); hideTip(); requestDraw();
  }

  return {
    setData, fit, clear, toSVG, renderInto, settleNow,
    hasData: () => nodes.length > 0,
    redraw: requestDraw,
    /** Prefer the language's own web font (e.g. Nastaliq for Urdu) ahead of the generic stack. */
    setLanguage: (lang) => {
      const own = lang.font ? `"${lang.font.family}", ` : '';
      fontStack = `Inter, ${own}ui-sans-serif, system-ui, ${SCRIPT_FONTS}, sans-serif`;
    },
    zoomBy: (f) => { userMoved = true; sel.transition().duration(250).call(zoom.scaleBy, f); },
    // small read-only hooks used by the automated tests
    debug: {
      count: () => ({ nodes: nodes.length, links: links.length, buckets: buckets.length }),
      labels: () => nodes.filter((d) => !d.target).map((d) => d.label),
      targetLabel: () => target?.label,
      fontStack: () => fontStack,
      screenPos: (i) => { const d = nodes[i]; if (!d) return null; const r = canvas.getBoundingClientRect(); const [x, y] = t.apply([d.x, d.y]); return { x: r.left + x, y: r.top + y, label: d.label }; },
      hovered: () => hovered?.label ?? null,
      pinned: () => pinned?.label ?? null,
      settled: () => sim.alpha() < sim.alphaMin(),
      benchDraw: (n = 20) => { const t0 = performance.now(); for (let i = 0; i < n; i++) draw(); return (performance.now() - t0) / n; },
      zoomTo: (k) => sel.call(zoom.scaleTo, k),
    },
  };
}

function fmtX(lr) {
  const x = 2 ** lr;
  return x >= 10 ? `${Math.round(x)}×` : `${x.toFixed(1)}×`;
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
