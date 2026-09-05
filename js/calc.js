// calc.js — motor de cálculo puro. Sin DOM, sin imports. Todo en kg, cm, g, kcal.
// Cada función devuelve datos y, cuando procede, un texto `porque` con el razonamiento.

export const KCAL_POR_KG_GRASA = 7700;
export const ALPHA_EMA = 0.25;
export const DIAS_MIN_ADAPTATIVO = 14;
export const SUELO_KCAL = { hombre: 1500, mujer: 1200 };
export const SUELO_GRASA_G_KG = 0.5;
export const DEFICIT_MAX = 0.25;
export const RITMO_PERDIDA_MAX = 0.01; // 1 % del peso/semana
export const IMC_MIN_OBJETIVO = 18.5;
export const SEMANAS_DEFICIT_AVISO = 12;

export const FACTOR_ACTIVIDAD = {
  sedentario: 1.2, ligero: 1.375, moderado: 1.55, activo: 1.725, muy_activo: 1.9,
};

// ---------- utilidades ----------
export const redondear = (x, m = 1) => Math.round(x / m) * m;
export const imc = (peso, alturaCm) => peso / ((alturaCm / 100) ** 2);
export const masaMagra = (peso, grasaPct) => peso * (1 - grasaPct / 100);

// Peso ajustado para obesidad (IMC ≥ 30): ideal + 0.25 · (real − ideal), ideal a IMC 25.
export function pesoParaProteina(perfil) {
  if (perfil.grasaPct != null) return { kg: masaMagra(perfil.peso, perfil.grasaPct), base: 'masa libre de grasa' };
  if (imc(perfil.peso, perfil.altura) >= 30) {
    const ideal = 25 * (perfil.altura / 100) ** 2;
    return { kg: ideal + 0.25 * (perfil.peso - ideal), base: 'peso ajustado (IMC ≥ 30)' };
  }
  return { kg: perfil.peso, base: 'peso corporal' };
}

// ---------- grasa corporal (Navy) ----------
export function navy({ sexo, altura, cuello, cintura, cadera }) {
  const log10 = Math.log10;
  let pct;
  if (sexo === 'hombre') {
    pct = 495 / (1.0324 - 0.19077 * log10(cintura - cuello) + 0.15456 * log10(altura)) - 450;
  } else {
    pct = 495 / (1.29579 - 0.35004 * log10(cintura + cadera - cuello) + 0.221 * log10(altura)) - 450;
  }
  if (!isFinite(pct)) return null;
  return { pct: Math.round(pct * 10) / 10, error: '±3–4 %' };
}

// ---------- TMB ----------
export function tmb(perfil) {
  const { sexo, edad, altura, peso, grasaPct } = perfil;
  if (grasaPct != null && grasaPct > 0) {
    const mlg = masaMagra(peso, grasaPct);
    return {
      valor: Math.round(370 + 21.6 * mlg),
      metodo: 'Katch-McArdle',
      porque: `Con tu % de grasa (${grasaPct} %) tu masa libre de grasa es ${mlg.toFixed(1)} kg. Katch-McArdle (370 + 21,6 × MLG) es más precisa que las fórmulas por peso total porque el tejido magro es el que consume energía.`,
    };
  }
  const base = 10 * peso + 6.25 * altura - 5 * edad;
  const valor = Math.round(sexo === 'hombre' ? base + 5 : base - 161);
  return {
    valor,
    metodo: 'Mifflin-St Jeor',
    porque: `Sin dato de grasa corporal se usa Mifflin-St Jeor (10 × peso + 6,25 × altura − 5 × edad ${sexo === 'hombre' ? '+ 5' : '− 161'}), la fórmula con menor error medio en población general. Si añades tu % de grasa, la app pasará a Katch-McArdle.`,
  };
}

// ---------- TDEE por fórmula ----------
export function tdeeFormula(tmbValor, actividad) {
  const f = FACTOR_ACTIVIDAD[actividad] ?? 1.55;
  return {
    valor: Math.round(tmbValor * f),
    metodo: 'estimacion',
    factor: f,
    porque: `TMB × ${f} por tu nivel de actividad. Es una estimación provisional: los multiplicadores sobrestiman con frecuencia. En cuanto tengas 14 días de peso e ingesta registrados, el gasto se medirá con tus propios datos.`,
  };
}

// ---------- tendencia de peso (EMA) ----------
// registros: [{fecha:'YYYY-MM-DD', peso, kcal}] ordenados por fecha. Devuelve [{fecha, peso, tendencia}]
export function tendenciaPeso(registros, alpha = ALPHA_EMA) {
  const out = [];
  let ema = null;
  for (const r of registros) {
    if (r.peso == null) continue;
    ema = ema == null ? r.peso : alpha * r.peso + (1 - alpha) * ema;
    out.push({ fecha: r.fecha, peso: r.peso, tendencia: Math.round(ema * 100) / 100 });
  }
  return out;
}

// ---------- TDEE adaptativo ----------
// Usa los últimos `ventana` días completos (peso e ingesta). TDEE ≈ ingesta media − Δtendencia·7700/días
export function tdeeAdaptativo(registros, ventana = 28) {
  const completos = registros.filter((r) => r.peso != null && r.kcal != null).slice(-ventana);
  if (completos.length < DIAS_MIN_ADAPTATIVO) return null;
  const t = tendenciaPeso(registros).filter((x) => completos.some((c) => c.fecha === x.fecha));
  const dias = completos.length;
  const mediaKcal = completos.reduce((s, r) => s + r.kcal, 0) / dias;
  const deltaKg = t[t.length - 1].tendencia - t[0].tendencia;
  const valor = Math.round(mediaKcal - (deltaKg * KCAL_POR_KG_GRASA) / dias);
  return {
    valor,
    metodo: 'medido',
    dias,
    semanas: Math.floor(dias / 7),
    mediaKcal: Math.round(mediaKcal),
    deltaKg: Math.round(deltaKg * 100) / 100,
    porque: `En los últimos ${dias} días has comido de media ${Math.round(mediaKcal)} kcal y tu peso de tendencia ha cambiado ${deltaKg.toFixed(2)} kg. Cada kg de tejido equivale a ≈7700 kcal, así que tu gasto real ≈ ${Math.round(mediaKcal)} − (${deltaKg.toFixed(2)} × 7700 / ${dias}) = ${valor} kcal/día. Si subregistras tu ingesta, este número saldrá bajo.`,
  };
}

// Historial semanal del TDEE medido (para el gráfico). Una entrada por semana desde que hay 14 días.
export function historialTdee(registros) {
  const out = [];
  for (let i = DIAS_MIN_ADAPTATIVO; i <= registros.length; i += 7) {
    const r = tdeeAdaptativo(registros.slice(0, i));
    if (r) out.push({ fecha: registros[i - 1].fecha, tdee: r.valor });
  }
  return out;
}

export function tdeeActual(perfil, registros) {
  const t = tmb(perfil);
  const a = tdeeAdaptativo(registros || []);
  if (a) return { ...a, tmb: t.valor };
  const f = tdeeFormula(t.valor, perfil.actividad);
  return { ...f, tmb: t.valor };
}

// ---------- objetivo calórico ----------
// perfil.ritmo: fracción del peso/semana (0.0075 = 0,75 %). Devuelve {kcal, deficitPct, ...} o {bloqueado, motivo, alternativa}
export function objetivoKcal(perfil, tdee) {
  const { sexo, edad, peso, altura, objetivo, embarazo } = perfil;
  const t = tmb(perfil).valor;
  if (edad < 18) return { bloqueado: true, motivo: 'Esta app no está pensada para menores de 18 años. En esa etapa las necesidades cambian rápido y conviene acudir a un profesional sanitario.' };
  if (embarazo) return { bloqueado: true, motivo: 'Durante el embarazo o la lactancia no se generan objetivos calóricos: las necesidades son distintas y deben supervisarse por un profesional.' };

  let ritmo = perfil.ritmo ?? (objetivo === 'perder' ? 0.0075 : objetivo === 'ganar' ? 0.0035 : 0);
  if (objetivo === 'mantener') ritmo = 0;

  if (objetivo === 'perder' && ritmo > RITMO_PERDIDA_MAX + 1e-9) {
    return {
      bloqueado: true,
      motivo: `Perder ${(ritmo * 100).toFixed(2)} % del peso por semana (${(ritmo * peso).toFixed(2)} kg) supera el 1 % (${(RITMO_PERDIDA_MAX * peso).toFixed(2)} kg/semana). Por encima de ese ritmo aumenta la pérdida de masa magra y baja la adherencia.`,
      alternativa: { ritmo: RITMO_PERDIDA_MAX, kgSemana: Math.round(RITMO_PERDIDA_MAX * peso * 100) / 100 },
    };
  }

  const kgSemana = ritmo * peso;
  let deltaDia = (kgSemana * KCAL_POR_KG_GRASA) / 7;
  let kcal;
  let notas = [];

  if (objetivo === 'perder') {
    kcal = tdee - deltaDia;
    if (deltaDia > tdee * DEFICIT_MAX) {
      kcal = Math.round(tdee * (1 - DEFICIT_MAX));
      notas.push(`El déficit se ha limitado al 25 % del gasto (${kcal} kcal); el ritmo real será algo menor del pedido.`);
    }
  } else if (objetivo === 'ganar') {
    kcal = tdee + deltaDia;
  } else if (objetivo === 'recomposicion') {
    kcal = tdee * 0.97;
    notas.push('Recomposición: mantenimiento con un déficit muy leve (−3 %) y proteína en la parte alta del rango.');
  } else {
    kcal = tdee;
  }
  kcal = Math.round(kcal);

  const suelo = Math.max(t, SUELO_KCAL[sexo]);
  if (kcal < suelo) {
    const maxDeficitDia = tdee - suelo;
    const ritmoAlt = Math.max(0, (maxDeficitDia * 7) / KCAL_POR_KG_GRASA / peso);
    return {
      bloqueado: true,
      motivo: `Ese ritmo obligaría a comer ${kcal} kcal/día, por debajo del suelo de seguridad (${suelo} kcal: el mayor entre tu TMB de ${t} y ${SUELO_KCAL[sexo]} kcal). No se genera el plan.`,
      alternativa: { ritmo: Math.floor(ritmoAlt * 10000) / 10000, kgSemana: Math.round(ritmoAlt * peso * 100) / 100 },
    };
  }

  // IMC objetivo: solo tiene sentido si hay peso objetivo declarado
  if (perfil.pesoObjetivo && imc(perfil.pesoObjetivo, altura) < IMC_MIN_OBJETIVO) {
    return { bloqueado: true, motivo: `Un peso objetivo de ${perfil.pesoObjetivo} kg supone un IMC de ${imc(perfil.pesoObjetivo, altura).toFixed(1)}, por debajo de 18,5. No se genera el plan; consulta con un profesional sanitario.` };
  }

  const deficitPct = Math.round(((tdee - kcal) / tdee) * 1000) / 10;
  return {
    kcal, ritmo, kgSemana: Math.round(kgSemana * 100) / 100, deficitPct, tdee, notas,
    porque: objetivo === 'perder'
      ? `Perder ${(ritmo * 100).toFixed(2)} %/semana son ${kgSemana.toFixed(2)} kg; a 7700 kcal/kg eso es un déficit de ${Math.round(deltaDia)} kcal/día sobre tu gasto de ${tdee}. Entre 0,5 y 1 % se conserva mejor la masa magra.`
      : objetivo === 'ganar'
        ? `Ganar ${(ritmo * 100).toFixed(2)} %/semana son ${kgSemana.toFixed(2)} kg; un superávit de ${Math.round(deltaDia)} kcal/día. Más rápido solo añade grasa: la síntesis de músculo tiene un techo.`
        : objetivo === 'recomposicion'
          ? 'Mantenimiento con déficit leve: permite ganar músculo y perder grasa a la vez si eres principiante o vuelves tras un parón.'
          : 'Igual a tu gasto: mantienes peso.',
  };
}

// ---------- macros ----------
export function rangoProteinaGkg(perfil) {
  const enDeficit = perfil.objetivo === 'perder' || perfil.objetivo === 'recomposicion';
  const delgado = perfil.grasaPct != null && (perfil.sexo === 'hombre' ? perfil.grasaPct <= 15 : perfil.grasaPct <= 23);
  switch (perfil.entreno) {
    case 'ninguno':
      return { min: 1.0, max: 1.2, porque: 'Sin entrenamiento: 1,0–1,2 g/kg. La RDA (0,8) es un mínimo para no tener deficiencia, no un óptimo.' };
    case 'cardio':
      return { min: 1.2, max: 1.6, porque: 'Solo resistencia: 1,2–1,6 g/kg cubren la reparación muscular y la adaptación al entrenamiento.' };
    default:
      if (perfil.grasaPct != null && (enDeficit || delgado)) {
        return { min: 2.3, max: 3.1, sobreMLG: true, porque: 'En déficit o ya delgado: 2,3–3,1 g por kg de masa libre de grasa (Helms y col.). Preserva masa magra y sacia.' };
      }
      if (enDeficit) return { min: 2.0, max: 2.2, porque: 'Fuerza en déficit: parte alta del rango 1,6–2,2 g/kg para conservar masa magra y saciar.' };
      return { min: 1.6, max: 2.2, porque: 'Fuerza: 1,6–2,2 g/kg. A partir de 1,6 la mayoría de estudios deja de mostrar beneficio adicional para hipertrofia; por encima no hay perjuicio.' };
  }
}

export const RANGO_GRASA_PCT = { mas_hidratos: [0.2, 0.25], equilibrado: [0.25, 0.3], mas_grasas: [0.3, 0.35] };

export function macros(perfil, kcalObjetivo) {
  const peso = perfil.peso;
  const rp = rangoProteinaGkg(perfil);
  const base = rp.sobreMLG ? { kg: masaMagra(peso, perfil.grasaPct), base: 'masa libre de grasa' } : pesoParaProteina(perfil);
  let protMin = Math.round(rp.min * base.kg);
  let protMax = Math.round(rp.max * base.kg);

  const [gMin, gMax] = RANGO_GRASA_PCT[perfil.reparto] ?? RANGO_GRASA_PCT.equilibrado;
  const grasaSuelo = Math.round(SUELO_GRASA_G_KG * peso);
  let grasaMin = Math.max(grasaSuelo, Math.round((kcalObjetivo * gMin) / 9));
  let grasaMax = Math.max(grasaMin, Math.round((kcalObjetivo * gMax) / 9));

  const notas = [];
  // Comprobación de calorías muy bajas: grasa al suelo → proteína al mínimo → hidratos
  const kcalFijas = (p, g) => p * 4 + g * 9;
  let protC = Math.round((protMin + protMax) / 2);
  let grasaC = Math.round((grasaMin + grasaMax) / 2);
  if (kcalFijas(protC, grasaC) > kcalObjetivo) {
    grasaC = grasaMin;
    if (kcalFijas(protC, grasaC) > kcalObjetivo) {
      grasaC = grasaSuelo; grasaMin = grasaSuelo; grasaMax = grasaSuelo;
      notas.push('Calorías muy bajas: la grasa se fija en el suelo de 0,5 g/kg.');
      if (kcalFijas(protC, grasaC) > kcalObjetivo) {
        protC = protMin; protMax = protMin;
        notas.push('Proteína fijada en el mínimo de su rango; los hidratos absorben lo que queda.');
      }
    }
  }
  const hidratosC = Math.max(0, Math.round((kcalObjetivo - kcalFijas(protC, grasaC)) / 4));
  const hidratosMin = Math.max(0, Math.round((kcalObjetivo - kcalFijas(protMax, grasaMax)) / 4));
  const hidratosMax = Math.max(hidratosMin, Math.round((kcalObjetivo - kcalFijas(protMin, grasaMin)) / 4));
  const kcalCentral = kcalFijas(protC, grasaC) + hidratosC * 4;

  const volumen = perfil.entreno === 'ninguno' ? [3, 5] : perfil.entreno === 'cardio' && perfil.frecuencia >= 5 ? [6, 10] : [5, 7];

  return {
    kcal: kcalObjetivo,
    kcalCentral,
    proteina: {
      min: protMin, max: protMax, central: protC, gkg: [rp.min, rp.max], base: base.base,
      porque: `${rp.porque} Calculado sobre ${base.base} (${base.kg.toFixed(1)} kg). Repártela en 3–5 tomas de 0,3–0,4 g/kg; es una optimización menor frente al total diario. Evidencia: metaanálisis de ensayos controlados.`,
    },
    grasa: {
      min: grasaMin, max: grasaMax, central: grasaC, pct: [gMin, gMax], suelo: grasaSuelo,
      porque: `${Math.round(gMin * 100)}–${Math.round(gMax * 100)} % de las calorías según tu preferencia de reparto, nunca por debajo de 0,5 g/kg (${grasaSuelo} g): salud hormonal y absorción de vitaminas liposolubles. Evidencia: consenso de posición (ISSN, ACSM).`,
    },
    hidratos: {
      min: hidratosMin, max: hidratosMax, central: hidratosC, gkgReferencia: volumen,
      porque: `Absorben las calorías que quedan tras proteína y grasa. Referencia por volumen de entrenamiento: ${volumen[0]}–${volumen[1]} g/kg (${Math.round(volumen[0] * peso)}–${Math.round(volumen[1] * peso)} g). Son el combustible del entrenamiento de alta intensidad; no hay motivo fisiológico para evitarlos.`,
    },
    fibra: { g: Math.round((kcalObjetivo / 1000) * 14), porque: '14 g por cada 1000 kcal (referencia del Institute of Medicine).' },
    agua: { min: Math.round(30 * peso), max: Math.round(35 * peso), porque: '30–35 ml/kg más lo que pierdas sudando al entrenar (0,5–1 l por hora).' },
    notas,
  };
}

// Plan completo con bloqueos
export function plan(perfil, registros = []) {
  const t = tdeeActual(perfil, registros);
  const o = objetivoKcal(perfil, t.valor);
  if (o.bloqueado) return { bloqueado: true, motivo: o.motivo, alternativa: o.alternativa, tdee: t };
  return { bloqueado: false, tdee: t, objetivo: o, macros: macros(perfil, o.kcal) };
}

// ---------- adherencia y ritmo real ----------
export function resumenSemana(registros, kcalObjetivo, kgSemanaObjetivo) {
  const ult = registros.slice(-7);
  const conKcal = ult.filter((r) => r.kcal != null);
  const dentro = conKcal.filter((r) => Math.abs(r.kcal - kcalObjetivo) <= kcalObjetivo * 0.1).length;
  const t = tendenciaPeso(registros);
  let ritmoReal = null;
  if (t.length >= 8) {
    ritmoReal = Math.round((t[t.length - 1].tendencia - t[t.length - 8].tendencia) * 100) / 100;
  }
  return {
    diasRegistrados: conKcal.length,
    diasDentro: dentro,
    adherencia: conKcal.length ? Math.round((dentro / conKcal.length) * 100) : null,
    mediaKcal: conKcal.length ? Math.round(conKcal.reduce((s, r) => s + r.kcal, 0) / conKcal.length) : null,
    ritmoReal,
    ritmoObjetivo: kgSemanaObjetivo,
  };
}

// Semanas seguidas en déficit (ingesta media semanal < TDEE − 100) hasta hoy
export function semanasEnDeficit(registros, tdee) {
  let semanas = 0;
  for (let fin = registros.length; fin - 7 >= 0; fin -= 7) {
    const sem = registros.slice(fin - 7, fin).filter((r) => r.kcal != null);
    if (sem.length < 4) break;
    const media = sem.reduce((s, r) => s + r.kcal, 0) / sem.length;
    if (media < tdee - 100) semanas++; else break;
  }
  return semanas;
}

// ---------- recetas: totales y reescalado ----------
// receta.ingredientes: [{nombre, gramos, por100:{kcal,proteina,hidratos,grasa}, rol?: 'proteina'|'hidratos'|'otro'}]
export function totalesReceta(receta) {
  const t = { kcal: 0, proteina: 0, hidratos: 0, grasa: 0 };
  for (const i of receta.ingredientes) {
    const f = (i.gramos || 0) / 100;
    t.kcal += (i.por100?.kcal || 0) * f;
    t.proteina += (i.por100?.proteina || 0) * f;
    t.hidratos += (i.por100?.hidratos || 0) * f;
    t.grasa += (i.por100?.grasa || 0) * f;
  }
  const r = (x) => Math.round(x);
  const rac = Math.max(1, receta.raciones || 1);
  return {
    total: { kcal: r(t.kcal), proteina: r(t.proteina), hidratos: r(t.hidratos), grasa: r(t.grasa) },
    porRacion: { kcal: r(t.kcal / rac), proteina: r(t.proteina / rac), hidratos: r(t.hidratos / rac), grasa: r(t.grasa / rac) },
  };
}

// Clasifica el rol de cada ingrediente si el modelo no lo indicó
export function rolIngrediente(i) {
  if (i.rol) return i.rol;
  const p = i.por100 || {};
  const kcal = p.kcal || 1;
  if ((p.proteina * 4) / kcal > 0.45 && p.proteina >= 10) return 'proteina';
  if ((p.hidratos * 4) / kcal > 0.6 && p.hidratos >= 15) return 'hidratos';
  return 'otro';
}

const MIN_COCINA = { proteina: 80, hidratos: 40 };

// Escala por separado la fuente de proteína y la de hidratos para encajar en el hueco (por ración).
export function reescalarReceta(receta, hueco) {
  const rac = Math.max(1, receta.raciones || 1);
  const ing = receta.ingredientes.map((i) => ({ ...i, rol: rolIngrediente(i) }));
  const suma = (rol, clave) => ing.filter((i) => i.rol === rol).reduce((s, i) => s + ((i.por100?.[clave] || 0) * i.gramos) / 100, 0);
  const otrosProt = suma('otro', 'proteina') + suma('hidratos', 'proteina');
  const otrosHid = suma('otro', 'hidratos') + suma('proteina', 'hidratos');

  const escalar = (rol, clave, objetivoTotal, otros) => {
    const actual = suma(rol, clave);
    if (actual <= 0 || objetivoTotal == null) return 1;
    const necesario = objetivoTotal * rac - otros;
    return Math.max(0.25, Math.min(4, necesario / actual));
  };
  const fp = escalar('proteina', 'proteina', hueco.proteina, otrosProt);
  const fh = escalar('hidratos', 'hidratos', hueco.hidratos, otrosHid);

  const nuevos = ing.map((i) => {
    const f = i.rol === 'proteina' ? fp : i.rol === 'hidratos' ? fh : 1;
    let g = redondear(i.gramos * f, 5);
    if (i.rol in MIN_COCINA) g = Math.max(MIN_COCINA[i.rol] * rac, g);
    return { ...i, gramos: g, gramosOriginal: i.gramos };
  });
  const out = { ...receta, ingredientes: nuevos, reescalada: true, factores: { proteina: Math.round(fp * 100) / 100, hidratos: Math.round(fh * 100) / 100 } };
  return { ...out, totales: totalesReceta(out) };
}

// Hueco de macros que quedan hoy (registro parcial): objetivo central − consumido
export function huecoRestante(macrosPlan, consumido) {
  const c = consumido || { kcal: 0, proteina: 0, hidratos: 0, grasa: 0 };
  return {
    kcal: Math.max(0, macrosPlan.kcal - (c.kcal || 0)),
    proteina: Math.max(0, macrosPlan.proteina.central - (c.proteina || 0)),
    hidratos: Math.max(0, macrosPlan.hidratos.central - (c.hidratos || 0)),
    grasa: Math.max(0, macrosPlan.grasa.central - (c.grasa || 0)),
  };
}
