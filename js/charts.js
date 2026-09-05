// charts.js — gráficos SVG mínimos, sin librerías. Devuelven strings SVG.

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function escala(valores, hMin, hMax) {
  const min = Math.min(...valores), max = Math.max(...valores);
  const pad = (max - min) * 0.15 || 0.5;
  const lo = min - pad, hi = max + pad;
  return { lo, hi, y: (v) => hMax - ((v - lo) / (hi - lo)) * (hMax - hMin) };
}

// series: [{valores:[], clase, puntos?:bool}], etiquetas: strings del eje X
export function lineas({ series, etiquetas = [], ancho = 340, alto = 140, unidad = '' }) {
  const ml = 38, mr = 8, mt = 8, mb = 22;
  const todos = series.flatMap((s) => s.valores.filter((v) => v != null));
  if (!todos.length) return '';
  const n = Math.max(...series.map((s) => s.valores.length));
  const { lo, hi, y } = escala(todos, mt, alto - mb);
  const x = (i) => ml + (n <= 1 ? 0 : (i / (n - 1)) * (ancho - ml - mr));
  const dec = hi - lo > 20 ? 1 : 10; // kcal sin decimales, kg con uno
  const ticks = [lo, (lo + hi) / 2, hi].map((v) => Math.round(v * dec) / dec);
  let out = `<svg viewBox="0 0 ${ancho} ${alto}" class="chart" role="img" aria-label="gráfico">`;
  for (const t of ticks) {
    out += `<line x1="${ml}" x2="${ancho - mr}" y1="${y(t)}" y2="${y(t)}" class="grid"/>`;
    out += `<text x="${ml - 4}" y="${y(t) + 3}" class="tick" text-anchor="end">${t}${esc(unidad)}</text>`;
  }
  for (const s of series) {
    const pts = s.valores.map((v, i) => (v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`)).filter(Boolean);
    if (pts.length > 1) out += `<polyline points="${pts.join(' ')}" class="${esc(s.clase || 'l1')}" fill="none"/>`;
    if (s.puntos) s.valores.forEach((v, i) => { if (v != null) out += `<circle cx="${x(i)}" cy="${y(v)}" r="2" class="${esc(s.clase || 'l1')}-pt"/>`; });
  }
  const idx = [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i);
  for (const i of idx) if (etiquetas[i]) out += `<text x="${x(i)}" y="${alto - 6}" class="tick" text-anchor="${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}">${esc(etiquetas[i])}</text>`;
  out += '</svg>';
  return out;
}

// Barra de progreso con rango objetivo: consumido, min, max
export function barraRango({ consumido, min, max, escalaMax }) {
  const top = Math.max(escalaMax || max * 1.25, consumido, max);
  const pct = (v) => Math.min(100, (v / top) * 100);
  const estado = consumido < min ? 'bajo' : consumido > max ? 'alto' : 'ok';
  return `<div class="bar" data-estado="${estado}"><div class="bar-rango" style="left:${pct(min)}%;width:${pct(max) - pct(min)}%"></div><div class="bar-fill" style="width:${pct(consumido)}%"></div></div>`;
}
