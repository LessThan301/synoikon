// D3 force-directed rendering of the network built in analysis.js.
/* global d3 */

const TARGET_ID = '__target__';

export function renderGraph(svgEl, net, { onSelect, onFocus } = {}) {
  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();
  const { width, height } = svgEl.getBoundingClientRect();
  const W = Math.max(width, 320);
  const H = Math.max(height, 320);
  svg.attr('viewBox', [-W / 2, -H / 2, W, H]);

  const nodes = net.nodes.map((d) => ({ ...d }));
  const links = net.links.map((d) => ({ ...d }));
  const neighbors = nodes.filter((d) => !d.target);
  const target = nodes.find((d) => d.target);

  // ---- scales -------------------------------------------------------------
  // Node AREA is proportional to frequency  =>  radius = sqrt scale.
  const n = Math.max(neighbors.length, 1);
  const rMax = Math.max(16, Math.min(56, Math.min(W, H) / (4 + Math.sqrt(n) * 1.6)));
  const maxF = d3.max(neighbors, (d) => d.freq) || 1;
  const r = d3.scaleSqrt().domain([0, maxF]).range([0, rMax]);
  for (const d of neighbors) d.r = Math.max(2.5, r(d.freq));
  // The search word is (by construction) more frequent than any neighbor; same
  // scale, but capped so it doesn't swallow the screen.
  target.r = Math.min(r(target.freq), rMax * 1.3);
  target.capped = r(target.freq) > rMax * 1.3;

  // Link strength: co-occurrence count normalised to [0, 1] on ONE scale for
  // all lines (sqrt keeps weak links distinguishable from each other).
  const maxW = d3.max(links, (l) => l.weight) || 1;
  const s = (w) => Math.sqrt(w / maxW);
  for (const l of links) l.s = s(l.weight);
  // More co-occurrence => SHORTER line. Distance is the visible gap between
  // circle edges, so circle size does not distort it.
  const gapMin = 4;
  const gapMax = Math.min(W, H) * 0.42;
  const byId = new Map(nodes.map((d) => [d.id, d]));
  const dist = (l) => {
    const a = byId.get(typeof l.source === 'object' ? l.source.id : l.source);
    const b = byId.get(typeof l.target === 'object' ? l.target.id : l.target);
    return a.r + b.r + gapMin + (gapMax - gapMin) * (1 - l.s);
  };

  const tColor = d3.scaleSequential(d3.interpolateRgbBasis(['#7f8fd6', '#5b8def', '#38c6a8', '#9be15d']))
    .domain([0, 1]);
  const targetShare = new Map(links.filter((l) => l.kind === 'target').map((l) => [l.target, l.s]));
  const fill = (d) => (d.target ? '#ff6b4a' : tColor(targetShare.get(d.id) ?? 0));

  // adjacency for hover
  const adj = new Map(nodes.map((d) => [d.id, new Map()]));
  for (const l of links) {
    adj.get(l.source).set(l.target, l.weight);
    adj.get(l.target).set(l.source, l.weight);
  }

  // ---- layers -------------------------------------------------------------
  const root = svg.append('g');
  const gLinks = root.append('g').attr('class', 'links');
  const gNodes = root.append('g').attr('class', 'nodes');

  const link = gLinks.selectAll('line').data(links).join('line')
    .attr('class', 'link')
    .attr('stroke', (l) => (l.kind === 'target' ? '#ff9a80' : '#8fa3e0'))
    .attr('stroke-opacity', (l) => 0.12 + 0.6 * l.s)
    .attr('stroke-width', (l) => 0.5 + 5 * l.s ** 1.6)
    .attr('stroke-linecap', 'round');

  const node = gNodes.selectAll('g').data(nodes, (d) => d.id).join('g')
    .attr('class', (d) => `node${d.target ? ' target' : ''}`)
    .style('cursor', (d) => (d.target ? 'grab' : 'pointer'));

  // Target gets a soft halo so it is visually distinct (still no border).
  node.filter((d) => d.target).append('circle')
    .attr('r', (d) => d.r + 10).attr('fill', '#ff6b4a').attr('opacity', 0.16);
  node.append('circle')
    .attr('class', 'body')
    .attr('r', (d) => d.r)
    .attr('fill', fill)
    .attr('fill-opacity', (d) => (d.target ? 1 : 0.88));

  const fontSize = (d) => (d.target ? Math.max(14, Math.min(22, d.r * 0.42)) : Math.max(10, Math.min(17, d.r * 0.42)));
  node.append('text')
    .text((d) => d.label)
    .attr('text-anchor', 'middle')
    .attr('font-size', fontSize)
    .attr('dy', (d) => (d.r >= 18 || d.target ? '0.35em' : d.r + fontSize(d) + 1));

  // ---- simulation ---------------------------------------------------------
  target.fx = 0; target.fy = 0; // the search word sits in the centre
  const sim = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id((d) => d.id).distance(dist)
      .strength((l) => (l.kind === 'target' ? 0.7 : 0.03 + 0.3 * l.s)))
    .force('charge', d3.forceManyBody().strength((d) => -10 - d.r * 1.5).distanceMax(gapMax))
    .force('collide', d3.forceCollide((d) => d.r + 3).iterations(2))
    .force('x', d3.forceX(0).strength(0.01))
    .force('y', d3.forceY(0).strength(0.015))
    .stop();
  for (let i = 0; i < 300; i++) sim.tick();

  function ticked() {
    link.attr('x1', (l) => l.source.x).attr('y1', (l) => l.source.y)
      .attr('x2', (l) => l.target.x).attr('y2', (l) => l.target.y);
    node.attr('transform', (d) => `translate(${d.x},${d.y})`);
  }
  ticked();
  sim.on('tick', ticked).alpha(0.05).restart();

  // ---- zoom / pan ---------------------------------------------------------
  const zoom = d3.zoom().scaleExtent([0.2, 6]).on('zoom', (e) => root.attr('transform', e.transform));
  svg.call(zoom).on('dblclick.zoom', null);

  function fit(animate = true) {
    const pad = 30;
    const x0 = d3.min(nodes, (d) => d.x - d.r - 40), x1 = d3.max(nodes, (d) => d.x + d.r + 40);
    const y0 = d3.min(nodes, (d) => d.y - d.r - 10), y1 = d3.max(nodes, (d) => d.y + d.r + 24);
    const k = Math.min(2, 0.95 * Math.min((W - pad) / (x1 - x0), (H - pad) / (y1 - y0)));
    const t = d3.zoomIdentity.scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
    (animate ? svg.transition().duration(600) : svg).call(zoom.transform, t);
  }
  fit(false);

  // ---- drag ---------------------------------------------------------------
  node.call(d3.drag()
    .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.25).restart(); d.fx = d.x; d.fy = d.y; })
    .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
    .on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); if (!d.target) { d.fx = null; d.fy = null; } }));

  // ---- hover highlight + tooltip -------------------------------------------
  const tip = d3.select(svgEl.parentNode).select('.tooltip');
  function highlight(d) {
    const nb = adj.get(d.id);
    node.classed('dim', (o) => o.id !== d.id && !nb.has(o.id));
    link.classed('dim', (l) => l.source.id !== d.id && l.target.id !== d.id);
  }
  function clear() { node.classed('dim', false); link.classed('dim', false); tip.classed('hidden', true); }
  function showTip(event, d) {
    const nb = [...adj.get(d.id).entries()].filter(([id]) => id !== TARGET_ID)
      .sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([id, w]) => `${byId.get(id).label} <span class="muted">×${w}</span>`).join(', ');
    const html = d.target
      ? `<b>${esc(d.label)}</b><br><span class="muted">${d.freq} occurrences found · ${d.cooc} context windows${d.capped ? ' · circle capped for display' : ''}</span>`
      : `<b>${esc(d.label)}</b> <span class="muted">#${d.rank}</span><br>${d.freq}× near <i>${esc(target.label)}</i> <span class="muted">(in ${d.cooc} of ${target.cooc} windows)</span>`
        + (d.lr != null ? `<br>Distinctiveness <b>${d.lr.toFixed(1)}</b> <span class="muted">(≈${fmtX(d.lr)} more often than in general text; LL ${Math.round(d.g2)})</span>` : '')
        + (nb ? `<br><span class="muted">Often with:</span> ${nb}` : '')
        + `<br><span class="muted">Click to map “${esc(d.label)}”</span>`;
    const [x, y] = d3.pointer(event, svgEl.parentNode);
    const box = svgEl.parentNode.getBoundingClientRect();
    tip.html(html).classed('hidden', false)
      .style('left', `${Math.min(x + 14, box.width - 270)}px`)
      .style('top', `${Math.min(y + 14, box.height - 120)}px`);
  }
  node.on('pointerenter', (e, d) => { highlight(d); showTip(e, d); onFocus?.(d); })
    .on('pointermove', showTip)
    .on('pointerleave', clear)
    .on('click', (e, d) => { if (!d.target && !e.defaultPrevented) onSelect?.(d.label); });

  return {
    fit,
    zoomBy: (f) => svg.transition().duration(250).call(zoom.scaleBy, f),
    stop: () => sim.stop(),
    focus: (id) => { const d = byId.get(id); if (d) highlight(d); },
    clear,
  };
}

function fmtX(lr) {
  const x = 2 ** lr;
  return x >= 10 ? `${Math.round(x)}×` : `${x.toFixed(1)}×`;
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
