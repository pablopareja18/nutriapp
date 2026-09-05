import * as C from './calc.js';
import * as S from './store.js';
import { $, esc, fmt, toast, porque, activarPorque, OPCIONES, opciones, PERFIL_DEFECTO, perfilCompleto } from './ui.js';

export async function renderPerfil(root, ctx) {
  const p = { ...PERFIL_DEFECTO, ...(ctx.perfil || {}) };
  const ritmoPct = ((p.ritmo || 0) * 100).toFixed(2);
  root.innerHTML = `
  <h1>Perfil</h1>
  <form id="form-perfil" novalidate>
    <h2>Cuerpo</h2>
    <div class="fila">
      <div><label for="sexo">Sexo biológico</label><select id="sexo" name="sexo">${opciones(OPCIONES.sexo, p.sexo)}</select></div>
      <div><label for="edad">Edad</label><input id="edad" name="edad" type="number" inputmode="numeric" min="10" max="100" value="${p.edad ?? ''}" required></div>
    </div>
    <div class="fila">
      <div><label for="altura">Altura (cm)</label><input id="altura" name="altura" type="number" inputmode="decimal" step="0.5" min="120" max="230" value="${p.altura ?? ''}" required></div>
      <div><label for="peso">Peso (kg)</label><input id="peso" name="peso" type="number" inputmode="decimal" step="0.1" min="30" max="300" value="${p.peso ?? ''}" required></div>
    </div>
    <label for="grasaPct">Grasa corporal (%) — opcional</label>
    <input id="grasaPct" name="grasaPct" type="number" inputmode="decimal" step="0.1" min="3" max="60" value="${p.grasaPct ?? ''}" placeholder="Si lo sabes, mejora la precisión">
    <details>
      <summary>No lo sé: estimar con cinta métrica (método Navy)</summary>
      <p class="muted">Mide en cm con la cinta ajustada sin apretar. Estimación con ±3–4 % de error; una báscula de bioimpedancia no es más fiable.</p>
      <div class="fila-3">
        <div><label for="nv-cuello">Cuello</label><input id="nv-cuello" type="number" inputmode="decimal" step="0.5"></div>
        <div><label for="nv-cintura">Cintura (ombligo)</label><input id="nv-cintura" type="number" inputmode="decimal" step="0.5"></div>
        <div id="nv-cadera-wrap" ${p.sexo === 'mujer' ? '' : 'hidden'}><label for="nv-cadera">Cadera</label><input id="nv-cadera" type="number" inputmode="decimal" step="0.5"></div>
      </div>
      <button type="button" class="btn" id="btn-navy" style="margin-top:10px">Calcular estimación</button>
      <p id="nv-resultado" class="muted"></p>
    </details>
    <label class="check" style="margin-top:12px"><input type="checkbox" name="embarazo" ${p.embarazo ? 'checked' : ''}> Embarazo o lactancia</label>

    <h2>Actividad</h2>
    <label for="actividad">Actividad diaria fuera del entrenamiento</label>
    <select id="actividad" name="actividad">${opciones(OPCIONES.actividad, p.actividad)}</select>
    <div class="fila">
      <div><label for="entreno">Tipo de entrenamiento</label><select id="entreno" name="entreno">${opciones(OPCIONES.entreno, p.entreno)}</select></div>
      <div><label for="frecuencia">Días por semana</label><input id="frecuencia" name="frecuencia" type="number" inputmode="numeric" min="0" max="14" value="${p.frecuencia ?? 3}"></div>
    </div>

    <h2>Objetivo</h2>
    <label for="objetivo">Objetivo</label>
    <select id="objetivo" name="objetivo">${opciones(OPCIONES.objetivo, p.objetivo)}</select>
    <div id="ritmo-wrap">
      <label for="ritmo">Ritmo de cambio (% del peso por semana)</label>
      <input id="ritmo" name="ritmo" type="number" inputmode="decimal" step="0.05" min="0" max="1" value="${ritmoPct}">
      <small id="ritmo-ayuda"></small>
    </div>
    <label for="pesoObjetivo">Peso objetivo (kg) — opcional</label>
    <input id="pesoObjetivo" name="pesoObjetivo" type="number" inputmode="decimal" step="0.1" value="${p.pesoObjetivo ?? ''}" placeholder="Para comprobar que el IMC final es saludable">

    <h2>Preferencias</h2>
    <div class="fila">
      <div><label for="dieta">Dieta</label><select id="dieta" name="dieta">${opciones(OPCIONES.dieta, p.dieta)}</select></div>
      <div><label for="comidas">Comidas al día</label><input id="comidas" name="comidas" type="number" inputmode="numeric" min="1" max="8" value="${p.comidas ?? 4}"></div>
    </div>
    <label for="reparto">Reparto entre hidratos y grasas</label>
    <select id="reparto" name="reparto">${opciones(OPCIONES.reparto, p.reparto)}</select>
    <label for="alergias">Alergias e intolerancias</label>
    <input id="alergias" name="alergias" type="text" value="${esc(p.alergias)}" placeholder="p. ej. lactosa, frutos secos">
    <label for="evitar">Alimentos que no quieres ver en las recetas</label>
    <input id="evitar" name="evitar" type="text" value="${esc(p.evitar)}" placeholder="p. ej. cilantro, hígado">

    <button type="submit" class="btn btn-primario btn-bloque">Guardar perfil</button>
  </form>
  <div id="perfil-resultado"></div>
  <p class="muted" style="margin-top:20px">Herramienta educativa. No diagnostica ni trata ninguna patología y no sustituye a un dietista-nutricionista ni a un médico. Si tomas medicación o tienes alguna enfermedad, consulta antes de cambiar tu alimentación.</p>`;

  const form = $('#form-perfil', root);
  const leer = () => {
    const d = Object.fromEntries(new FormData(form).entries());
    const num = (v) => (v === '' || v == null ? null : Number(v));
    return {
      ...PERFIL_DEFECTO, ...(ctx.perfil || {}),
      sexo: d.sexo, edad: num(d.edad), altura: num(d.altura), peso: num(d.peso), grasaPct: num(d.grasaPct),
      embarazo: form.embarazo.checked, actividad: d.actividad, entreno: d.entreno, frecuencia: num(d.frecuencia) ?? 0,
      objetivo: d.objetivo, ritmo: Math.max(0, num(d.ritmo) ?? 0) / 100, pesoObjetivo: num(d.pesoObjetivo),
      dieta: d.dieta, comidas: num(d.comidas) ?? 4, reparto: d.reparto, alergias: d.alergias || '', evitar: d.evitar || '',
    };
  };

  const actualizarRitmo = () => {
    const obj = form.objetivo.value; const wrap = $('#ritmo-wrap', root); const r = form.ritmo; const ayuda = $('#ritmo-ayuda', root);
    const peso = Number(form.peso.value) || 0;
    if (obj === 'mantener' || obj === 'recomposicion') { wrap.hidden = true; return; }
    wrap.hidden = false;
    if (obj === 'perder') {
      r.max = '1'; if (Number(r.value) > 1) r.value = '1';
      ayuda.textContent = `Recomendado 0,5–1 % (${peso ? `${(peso * 0.005).toFixed(2)}–${(peso * 0.01).toFixed(2)} kg/semana` : 'según tu peso'}). El 1 % es el máximo permitido: por encima se pierde más masa magra.`;
    } else {
      r.max = '0.5'; if (Number(r.value) > 0.5) r.value = '0.35';
      ayuda.textContent = `Recomendado 0,25–0,5 % en principiantes e intermedios${peso ? ` (${(peso * 0.0025).toFixed(2)}–${(peso * 0.005).toFixed(2)} kg/semana)` : ''}; menos en avanzados. Más rápido solo añade grasa.`;
    }
  };
  form.objetivo.addEventListener('change', () => { if (form.objetivo.value === 'ganar' && Number(form.ritmo.value) > 0.5) form.ritmo.value = '0.35'; if (form.objetivo.value === 'perder' && Number(form.ritmo.value) < 0.3) form.ritmo.value = '0.75'; actualizarRitmo(); });
  form.peso.addEventListener('input', actualizarRitmo);
  form.ritmo.addEventListener('input', () => {
    const lim = form.objetivo.value === 'perder' ? 1 : 0.5;
    form.ritmo.style.borderColor = Number(form.ritmo.value) > lim ? 'var(--peligro)' : '';
  });
  form.sexo.addEventListener('change', () => { $('#nv-cadera-wrap', root).hidden = form.sexo.value !== 'mujer'; });
  actualizarRitmo();

  $('#btn-navy', root).addEventListener('click', () => {
    const r = C.navy({ sexo: form.sexo.value, altura: Number(form.altura.value), cuello: Number($('#nv-cuello', root).value), cintura: Number($('#nv-cintura', root).value), cadera: Number($('#nv-cadera', root).value) });
    const out = $('#nv-resultado', root);
    if (!r || !form.altura.value) { out.textContent = 'Faltan medidas (y la altura arriba).'; return; }
    form.grasaPct.value = r.pct;
    out.textContent = `Estimación: ${fmt(r.pct, 1)} % (${r.error}). Se ha copiado al campo de grasa corporal.`;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const perfil = leer();
    if (!perfilCompleto(perfil)) { toast('Faltan edad, altura o peso.'); return; }
    await S.setPerfil(perfil);
    ctx.perfil = perfil;
    toast('Perfil guardado');
    mostrarResultado(perfil, ctx, $('#perfil-resultado', root));
  });

  if (perfilCompleto(p)) mostrarResultado(p, ctx, $('#perfil-resultado', root));
}

function mostrarResultado(perfil, ctx, el) {
  const plan = C.plan(perfil, ctx.registros || []);
  if (plan.bloqueado) {
    el.innerHTML = `<div class="aviso aviso-bloqueo"><strong>No se genera el plan</strong>${esc(plan.motivo)}${plan.alternativa ? `<p>Ritmo alternativo: ${fmt(plan.alternativa.ritmo * 100, 2)} %/semana (${fmt(plan.alternativa.kgSemana, 2)} kg/semana).</p>` : ''}</div>`;
    return;
  }
  const t = plan.tdee; const o = plan.objetivo; const m = plan.macros;
  const rango = (x, u = 'g') => `${fmt(x.min)}–${fmt(x.max)} ${u}`;
  el.innerHTML = `
  <h2>Tu plan</h2>
  <dl class="datos">
    <dt>TMB (${esc(C.tmb(perfil).metodo)})</dt><dd>${fmt(t.tmb)} kcal</dd>
    <dt>Gasto total ${t.metodo === 'medido' ? '(medido)' : '(estimación)'}</dt><dd>${fmt(t.valor)} kcal</dd>
    <dt>Objetivo diario</dt><dd>${fmt(o.kcal)} kcal${o.deficitPct ? ` (${o.deficitPct > 0 ? '−' : '+'}${fmt(Math.abs(o.deficitPct), 1)} %)` : ''}</dd>
    <dt>Proteína</dt><dd>${rango(m.proteina)}</dd>
    <dt>Grasa</dt><dd>${rango(m.grasa)}</dd>
    <dt>Hidratos</dt><dd>${rango(m.hidratos)}</dd>
    <dt>Fibra</dt><dd>≈ ${fmt(m.fibra.g)} g</dd>
    <dt>Agua</dt><dd>${fmt(m.agua.min / 1000, 1)}–${fmt(m.agua.max / 1000, 1)} l</dd>
  </dl>
  ${[...(o.notas || []), ...(m.notas || [])].map((n) => `<div class="aviso aviso-atencion">${esc(n)}</div>`).join('')}
  <p class="muted">Los detalles y el porqué de cada número están en Hoy.</p>`;
  activarPorque(el);
}
