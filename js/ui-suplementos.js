import { recomendar, NIVELES, MAX_RECOMENDADOS } from './suplementos-data.js';
import { esc } from './ui.js';

export function renderSuplementos(root, ctx) {
  const p = ctx.perfil || {};
  const ctxSup = { objetivo: p.objetivo || 'mantener', entreno: p.entreno || 'fuerza', dieta: p.dieta || 'omnivoro', frecuencia: p.frecuencia || 3, enDeficit: p.objetivo === 'perder' };
  const { principales, opcionales, resto } = recomendar(ctxSup);
  const item = (s) => `<article class="sup">
    <h3><span class="pill pill-${s.nivel}">Nivel ${s.nivel}</span>${esc(s.nombre)}</h3>
    ${s.condicion ? `<p class="muted">${esc(s.condicion)}</p>` : ''}
    <dl><dt>Dosis y momento</dt><dd>${esc(s.dosis)}</dd><dt>Para qué sirve realmente</dt><dd>${esc(s.sirve)}</dd><dt>Qué no hace</dt><dd>${esc(s.noHace)}</dd></dl>
  </article>`;

  root.innerHTML = `<h1>Suplementos</h1>
  <p class="muted">Según tu objetivo (${esc(p.objetivo || 'sin perfil')}), tu entrenamiento (${esc(p.entreno || '—')}) y tu dieta (${esc(p.dieta || '—')}). Nunca más de ${MAX_RECOMENDADOS} a la vez: si la lista sale larga, el resto es opcional.</p>
  <div class="aviso"><strong>Antes de nada</strong>Los suplementos aportan, como mucho, un pequeño porcentaje frente a comer y dormir bien. Ninguno compensa un déficit mal llevado ni un entrenamiento flojo.</div>
  <p class="muted"><b>Nivel A</b>: ${NIVELES.A}. <b>Nivel B</b>: ${NIVELES.B}. <b>Nivel C</b>: ${NIVELES.C}.</p>

  <h2>Recomendados para ti</h2>
  ${principales.length ? principales.map(item).join('') : '<p class="muted">Sin recomendaciones claras con tu perfil actual.</p>'}
  ${opcionales.length ? `<h2>Opcionales</h2>${opcionales.map(item).join('')}` : ''}
  <details><summary>Todos los demás, incluidos los que no funcionan</summary>${resto.map(item).join('')}</details>

  <div class="aviso" style="margin-top:18px"><strong>Si compites</strong>Usa solo productos con certificación antidopaje de terceros (Informed Sport, NSF Certified for Sport). La contaminación cruzada en suplementos sin certificar es una causa real de positivos.</div>
  <div class="aviso"><strong>Si tomas medicación o tienes alguna patología</strong>Consulta con tu médico antes de tomar cualquier suplemento. Esta app no diagnostica ni trata enfermedades.</div>`;
}
