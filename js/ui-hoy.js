import * as C from './calc.js';
import * as S from './store.js';
import { lineas, barraRango } from './charts.js';
import { $, esc, fmt, toast, porque, activarPorque, pillMetodo, perfilCompleto } from './ui.js';

const fechaCorta = (iso) => { const [, m, d] = iso.split('-'); return `${Number(d)}/${Number(m)}`; };

export async function renderHoy(root, ctx) {
  const hoy = S.hoy();
  const reg = ctx.registros.find((r) => r.fecha === hoy) || {};
  const perfil = ctx.perfil;

  let html = `<h1>Hoy <small class="muted">${fechaCorta(hoy)}</small></h1>
  <form id="form-rapido" class="rapido">
    <div><label for="r-peso">Peso (kg)</label><input id="r-peso" type="number" inputmode="decimal" step="0.1" min="30" max="300" value="${reg.peso ?? ''}" placeholder="—" autocomplete="off"></div>
    <div><label for="r-kcal">Ingesta (kcal)</label><input id="r-kcal" type="number" inputmode="numeric" step="10" min="0" max="10000" value="${reg.kcal ?? ''}" placeholder="—" autocomplete="off"></div>
    <button type="submit" class="btn btn-primario">Guardar</button>
  </form>
  <small class="muted">Peso de la mañana, en ayunas. La ingesta puedes actualizarla varias veces al día.</small>`;

  if (!perfilCompleto(perfil)) {
    html += `<div class="aviso" style="margin-top:20px"><strong>Falta el perfil</strong>Rellena edad, altura, peso y objetivo en la pestaña Perfil para ver tus objetivos aquí. El registro de peso e ingesta ya se guarda.</div>`;
    root.innerHTML = html; enlazarRapido(root, ctx); return;
  }

  const plan = C.plan(perfil, ctx.registros);
  if (plan.bloqueado) {
    html += `<div class="aviso aviso-bloqueo" style="margin-top:20px"><strong>Plan bloqueado</strong>${esc(plan.motivo)}${plan.alternativa ? `<p>Cambia el ritmo en Perfil a ${fmt(plan.alternativa.ritmo * 100, 2)} %/semana o menos.</p>` : ''}</div>`;
    html += seccionTendencia(ctx, plan.tdee);
    root.innerHTML = html; enlazarRapido(root, ctx); activarPorque(root); return;
  }

  const { tdee, objetivo, macros } = plan;
  const consumido = reg.consumido || {};
  const kcalHoy = reg.kcal ?? 0;
  const hueco = C.huecoRestante(macros, { kcal: kcalHoy, ...consumido });
  ctx.hueco = hueco; // lo usa Recetas

  html += `
  <h2>Objetivo de hoy</h2>
  <div class="cifra"><span class="num">${fmt(objetivo.kcal)}</span><span class="unidad">kcal</span>
    ${kcalHoy ? (kcalHoy > objetivo.kcal ? `<span class="pill pill-estimado">+${fmt(kcalHoy - objetivo.kcal)} sobre el objetivo</span>` : `<span class="pill pill-medido">quedan ${fmt(hueco.kcal)}</span>`) : ''}</div>
  ${barraRango({ consumido: kcalHoy, min: objetivo.kcal * 0.95, max: objetivo.kcal * 1.05, escalaMax: objetivo.kcal * 1.25 })}
  ${porque(`${objetivo.porque} ${objetivo.notas.join(' ')}`.trim())}

  ${macroFila('Proteína', macros.proteina, consumido.proteina, hueco.proteina)}
  ${macroFila('Grasa', macros.grasa, consumido.grasa, hueco.grasa)}
  ${macroFila('Hidratos', macros.hidratos, consumido.hidratos, hueco.hidratos)}
  <div class="macro"><span class="nombre">Fibra</span><span class="rango">≈ ${fmt(macros.fibra.g)} g</span><span class="resto"><span>Agua ${fmt(macros.agua.min / 1000, 1)}–${fmt(macros.agua.max / 1000, 1)} l</span></span></div>
  ${porque(`${macros.fibra.porque} ${macros.agua.porque}`, '¿por qué fibra y agua?')}
  ${macros.notas.map((n) => `<div class="aviso aviso-atencion">${esc(n)}</div>`).join('')}
  <p class="muted">Se muestran rangos porque clavar un gramo exacto no aporta nada frente a mantenerse en el rango de forma consistente. Registra la ingesta de cada macro tocando una receta o desde el desglose de abajo.</p>
  <details><summary>Registrar macros de hoy (opcional)</summary>
    <div class="fila-3">
      <div><label for="c-prot">Proteína (g)</label><input id="c-prot" type="number" inputmode="numeric" value="${consumido.proteina ?? ''}"></div>
      <div><label for="c-hid">Hidratos (g)</label><input id="c-hid" type="number" inputmode="numeric" value="${consumido.hidratos ?? ''}"></div>
      <div><label for="c-gra">Grasa (g)</label><input id="c-gra" type="number" inputmode="numeric" value="${consumido.grasa ?? ''}"></div>
    </div>
    <button type="button" class="btn btn-bloque" id="btn-macros">Guardar macros</button>
  </details>`;

  html += seccionTendencia(ctx, tdee, objetivo);
  root.innerHTML = html;
  enlazarRapido(root, ctx);
  activarPorque(root);
  $('#btn-macros', root)?.addEventListener('click', async () => {
    const n = (id) => { const v = $(id, root).value; return v === '' ? null : Number(v); };
    await S.guardarRegistro(hoy, { consumido: { proteina: n('#c-prot'), hidratos: n('#c-hid'), grasa: n('#c-gra') } });
    await ctx.recargar(); toast('Macros guardados'); renderHoy(root, ctx);
  });
}

function macroFila(nombre, m, consumido, resto) {
  const c = consumido ?? 0;
  return `<div class="macro"><span class="nombre">${nombre}</span><span class="rango">${fmt(m.min)}–${fmt(m.max)} g</span>
    ${barraRango({ consumido: c, min: m.min, max: m.max })}
    <span class="resto"><span>${consumido != null ? `llevas ${fmt(c)} g` : 'sin registrar'}</span><span>quedan ≈ ${fmt(resto)} g</span></span></div>${porque(m.porque)}`;
}

function seccionTendencia(ctx, tdee, objetivo) {
  const regs = ctx.registros;
  const tend = C.tendenciaPeso(regs);
  let html = `<h2>Gasto energético</h2>
  <div class="cifra"><span class="num">${fmt(tdee.valor)}</span><span class="unidad">kcal/día</span>${pillMetodo(tdee.metodo, tdee.semanas)}</div>
  ${porque(tdee.porque)}`;

  if (tdee.metodo !== 'medido') {
    const completos = regs.filter((r) => r.peso != null && r.kcal != null).length;
    html += `<p class="muted">Con ${C.DIAS_MIN_ADAPTATIVO} días de peso e ingesta el gasto se medirá con tus datos (llevas ${completos}). Las fórmulas se desvían con facilidad 200–400 kcal/día en una persona concreta.</p>`;
  } else {
    const hist = C.historialTdee(regs);
    if (hist.length >= 2) {
      html += lineas({ series: [{ valores: hist.map((h) => h.tdee), clase: 'l3', puntos: true }], etiquetas: hist.map((h) => fechaCorta(h.fecha)), unidad: '' });
      const caida = hist[0].tdee - hist[hist.length - 1].tdee;
      if (objetivo && objetivo.deficitPct > 0 && caida > 100) {
        html += `<div class="aviso aviso-atencion"><strong>Tu gasto ha bajado ${fmt(caida)} kcal desde la primera medición</strong>Es adaptación metabólica: en déficit el cuerpo reduce el gasto (menos movimiento espontáneo, menos masa, menor termogénesis). No es un fallo tuyo. El objetivo ya se ha recalculado con el gasto actual; si el ritmo se estanca, valora una fase de mantenimiento.</div>`;
      }
    }
  }

  if (tend.length >= 2) {
    const ult = tend.slice(-42);
    html += `<h2>Peso</h2>
    <div class="cifra"><span class="num">${fmt(ult[ult.length - 1].tendencia, 1)}</span><span class="unidad">kg tendencia</span><span class="muted">báscula ${fmt(ult[ult.length - 1].peso, 1)}</span></div>
    ${lineas({ series: [{ valores: ult.map((r) => r.peso), clase: 'l2', puntos: true }, { valores: ult.map((r) => r.tendencia), clase: 'l1' }], etiquetas: ult.map((r) => fechaCorta(r.fecha)) })}
    <div class="leyenda"><span><i></i>tendencia</span><span><i class="l2"></i>báscula</span></div>
    ${porque('La tendencia es una media móvil exponencial (α = 0,25) del peso diario. Una pesada suelta puede desviarse 1–3 kg del peso real por agua, glucógeno y contenido digestivo; la tendencia elimina ese ruido. Fíate de la línea, no del punto.', '¿qué es la tendencia?')}`;
  }

  if (objetivo) {
    const res = C.resumenSemana(regs, objetivo.kcal, objetivo.kgSemana);
    const signo = objetivo.ritmo && objetivo.tdee ? (objetivo.kcal < objetivo.tdee ? -1 : 1) : 0;
    html += `<h2>Última semana</h2><dl class="datos">
      <dt>Días registrados</dt><dd>${res.diasRegistrados}/7</dd>
      <dt>Días dentro del ±10 % del objetivo</dt><dd>${res.diasDentro} ${res.adherencia != null ? `(${res.adherencia} %)` : ''}</dd>
      <dt>Ingesta media</dt><dd>${res.mediaKcal != null ? `${fmt(res.mediaKcal)} kcal` : '—'}</dd>
      <dt>Ritmo real (tendencia)</dt><dd>${res.ritmoReal != null ? `${res.ritmoReal > 0 ? '+' : res.ritmoReal < 0 ? '−' : ''}${fmt(Math.abs(res.ritmoReal), 2)} kg/sem` : 'faltan datos'}</dd>
      <dt>Ritmo objetivo</dt><dd>${signo ? `${signo < 0 ? '−' : '+'}${fmt(objetivo.kgSemana, 2)} kg/sem` : '0 kg/sem'}</dd>
    </dl>`;
    const sem = C.semanasEnDeficit(regs, tdee.valor);
    if (sem >= C.SEMANAS_DEFICIT_AVISO) {
      html += `<div class="aviso aviso-atencion"><strong>Llevas ${sem} semanas seguidas en déficit</strong>La literatura respalda intercalar 1–2 semanas de mantenimiento (diet break): mejora la adherencia, recupera parte del gasto perdido por adaptación y no frena el resultado a medio plazo. Cambia el objetivo a "Mantener" en Perfil y vuelve al déficit después.</div>`;
    }
  }

  html += `<details><summary>Registrar bien la ingesta</summary><p class="muted">Si subregistras de forma sistemática, el gasto medido saldrá bajo y los objetivos también. Para que el número sea fiable: pesa los alimentos en crudo; registra el aceite, las salsas y las bebidas (son las omisiones más frecuentes); no te saltes los fines de semana; y registra los días malos igual que los buenos, porque lo que se mide es la media.</p></details>`;
  return html;
}

function enlazarRapido(root, ctx) {
  $('#form-rapido', root).addEventListener('submit', async (e) => {
    e.preventDefault();
    const peso = $('#r-peso', root).value; const kcal = $('#r-kcal', root).value;
    if (peso === '' && kcal === '') { toast('Introduce peso o ingesta'); return; }
    const datos = {};
    if (peso !== '') datos.peso = Number(peso);
    if (kcal !== '') datos.kcal = Number(kcal);
    await S.guardarRegistro(S.hoy(), datos);
    if (datos.peso && ctx.perfil) { ctx.perfil.peso = datos.peso; await S.setPerfil(ctx.perfil); }
    await ctx.recargar();
    toast('Registro guardado');
    renderHoy(root, ctx);
  });
}
