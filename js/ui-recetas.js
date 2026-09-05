import * as C from './calc.js';
import * as S from './store.js';
import { generarRecetas } from './recetas-api.js';
import { $, $$, esc, fmt, toast, perfilCompleto } from './ui.js';

const VARIANTES = { barata: 'más barata (ingredientes económicos de supermercado)', rapida: 'menos tiempo de preparación', volumen: 'más volumen y saciedad con las mismas calorías (más verdura, más fibra)' };

export async function renderRecetas(root, ctx) {
  const apiKey = await S.getAjuste('apiKey');
  const guardadas = (await S.todos('recetas')).sort((a, b) => (a.creada < b.creada ? 1 : -1));
  const favoritas = guardadas.filter((r) => r.favorita);
  const recientes = guardadas.filter((r) => !r.favorita).slice(0, 10);
  const hueco = ctx.hueco;

  root.innerHTML = `<h1>Recetas</h1>
  ${!apiKey ? `<div class="aviso"><strong>Falta la clave de API</strong>Generar recetas usa la API de Anthropic con tu propia clave. Añádela en Ajustes: se guarda solo en este dispositivo. El resto de la app funciona sin ella, y las recetas ya generadas se consultan offline.</div>` : ''}
  ${!navigator.onLine ? `<div class="aviso aviso-atencion">Sin conexión: puedes consultar las recetas guardadas, pero no generar nuevas.</div>` : ''}
  <form id="form-recetas">
    <label for="ingredientes">¿Qué te apetece comer?</label>
    <input id="ingredientes" type="text" placeholder="p. ej. pechuga de pollo y arroz" autocomplete="off" required>
    <div class="chips" role="radiogroup" aria-label="Comida">
      ${['desayuno', 'comida', 'cena', 'snack'].map((c, i) => `<button type="button" class="chip" data-comida="${c}" aria-pressed="${i === 1}">${c[0].toUpperCase() + c.slice(1)}</button>`).join('')}
    </div>
    ${hueco ? `<small class="muted">Hueco de hoy: ${fmt(hueco.kcal)} kcal · ${fmt(hueco.proteina)} g prot · ${fmt(hueco.hidratos)} g hid · ${fmt(hueco.grasa)} g grasa. Las cantidades se ajustarán a ese hueco.</small>` : `<small class="muted">Rellena el perfil para que las recetas se ajusten a lo que te queda hoy.</small>`}
    <button type="submit" class="btn btn-primario btn-bloque" ${!apiKey ? 'disabled' : ''}>Generar dos recetas</button>
  </form>
  <div id="recetas-estado"></div>
  <div id="recetas-resultado"></div>
  ${favoritas.length ? `<h2>Favoritas</h2><div id="recetas-fav">${favoritas.map(tarjeta).join('')}</div>` : ''}
  ${recientes.length ? `<h2>Recientes (offline)</h2><div id="recetas-rec">${recientes.map(tarjeta).join('')}</div>` : ''}`;

  $$('.chip', root).forEach((b) => b.addEventListener('click', () => { $$('.chip', root).forEach((x) => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); }));
  enlazarAcciones(root, ctx);

  $('#form-recetas', root).addEventListener('submit', (e) => { e.preventDefault(); generar(root, ctx, null); });
}

async function generar(root, ctx, variante, base) {
  const estado = $('#recetas-estado', root); const out = $('#recetas-resultado', root);
  const ingredientes = base?.ingredientesPedidos || $('#ingredientes', root).value.trim();
  const comida = base?.comida || $('.chip[aria-pressed="true"]', root)?.dataset.comida || 'comida';
  if (!ingredientes) { toast('Escribe qué te apetece'); return; }
  const apiKey = await S.getAjuste('apiKey');
  const hueco = ctx.hueco || { kcal: 600, proteina: 40, hidratos: 60, grasa: 20 };
  estado.innerHTML = '<p class="muted">Generando… (10–20 s)</p>';
  $$('button', root).forEach((b) => (b.disabled = true));
  try {
    const recetas = await generarRecetas({ ingredientes, comida, hueco, perfil: ctx.perfil, variante: variante ? VARIANTES[variante] : null }, apiKey);
    const ajustadas = recetas.map((r) => {
      const re = ctx.hueco ? C.reescalarReceta(r, hueco) : { ...r, totales: C.totalesReceta(r) };
      return { ...re, ingredientesPedidos: ingredientes, comida, variante: variante || null, favorita: false };
    });
    for (const r of ajustadas) await S.set('recetas', r.id, r);
    estado.innerHTML = '';
    out.innerHTML = ajustadas.map(tarjeta).join('');
    enlazarAcciones(root, ctx);
  } catch (err) {
    estado.innerHTML = `<div class="aviso aviso-bloqueo"><strong>No se han podido generar</strong>${esc(err.message)}</div>`;
  } finally {
    $$('button', root).forEach((b) => (b.disabled = false));
    if (!apiKey) $('#form-recetas button[type=submit]', root).disabled = true;
  }
}

function tarjeta(r) {
  const t = r.totales || C.totalesReceta(r);
  return `<article class="receta tarjeta" data-id="${esc(r.id)}">
    <h3><span>${esc(r.nombre)}</span><span class="pill ${r.tipo === 'sencilla' ? 'pill-medido' : 'pill-estimado'}">${esc(r.tipo)}</span></h3>
    <div class="meta">${r.tiempo_min ? `${r.tiempo_min} min · ` : ''}${r.dificultad ? `dificultad ${esc(r.dificultad)} · ` : ''}${r.raciones} ración${r.raciones > 1 ? 'es' : ''}${r.variante ? ` · variante: ${esc(r.variante)}` : ''}${r.reescalada ? ' · cantidades ajustadas a tu hueco' : ''}</div>
    <div class="totales">
      <div><b>${fmt(t.porRacion.kcal)}</b><small>kcal</small></div>
      <div><b>${fmt(t.porRacion.proteina)} g</b><small>proteína</small></div>
      <div><b>${fmt(t.porRacion.hidratos)} g</b><small>hidratos</small></div>
      <div><b>${fmt(t.porRacion.grasa)} g</b><small>grasa</small></div>
    </div>
    ${r.raciones > 1 ? `<small class="muted">Por ración. Plato completo: ${fmt(t.total.kcal)} kcal, ${fmt(t.total.proteina)} g prot, ${fmt(t.total.hidratos)} g hid, ${fmt(t.total.grasa)} g grasa.</small>` : ''}
    <table><tbody>${r.ingredientes.map((i) => `<tr><td>${esc(i.nombre)}</td><td>${i.gramosOriginal != null && i.gramosOriginal !== i.gramos ? `<span class="orig">${i.gramosOriginal}</span>` : ''}${fmt(i.gramos)} g</td></tr>`).join('')}</tbody></table>
    <ol>${r.pasos.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>
    <div class="acciones">
      <button type="button" class="btn" data-accion="fav">${r.favorita ? '★ Quitar de favoritas' : '☆ Favorita'}</button>
      <button type="button" class="btn" data-accion="registrar">Registrar en hoy</button>
    </div>
    <div class="acciones">
      <button type="button" class="btn" data-accion="variante" data-variante="barata">Más barata</button>
      <button type="button" class="btn" data-accion="variante" data-variante="rapida">Menos tiempo</button>
      <button type="button" class="btn" data-accion="variante" data-variante="volumen">Más volumen</button>
    </div>
  </article>`;
}

function enlazarAcciones(root, ctx) {
  $$('[data-accion]', root).forEach((b) => {
    if (b.dataset.enlazado) return; b.dataset.enlazado = '1';
    b.addEventListener('click', async () => {
      const art = b.closest('article'); const r = await S.get('recetas', art.dataset.id);
      if (!r) return;
      if (b.dataset.accion === 'fav') {
        r.favorita = !r.favorita; await S.set('recetas', r.id, r); toast(r.favorita ? 'Guardada en favoritas' : 'Quitada de favoritas'); renderRecetas(root, ctx);
      } else if (b.dataset.accion === 'registrar') {
        const t = (r.totales || C.totalesReceta(r)).porRacion;
        const hoy = S.hoy(); const reg = ctx.registros.find((x) => x.fecha === hoy) || {};
        const c = reg.consumido || {};
        await S.guardarRegistro(hoy, { kcal: (reg.kcal || 0) + t.kcal, consumido: { proteina: (c.proteina || 0) + t.proteina, hidratos: (c.hidratos || 0) + t.hidratos, grasa: (c.grasa || 0) + t.grasa } });
        await ctx.recargar(); toast(`Registrados ${t.kcal} kcal en hoy`);
      } else if (b.dataset.accion === 'variante') {
        if (!navigator.onLine) { toast('Sin conexión'); return; }
        generar(root, ctx, b.dataset.variante, r);
      }
    });
  });
}
