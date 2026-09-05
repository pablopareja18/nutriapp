// suplementos-data.js — catálogo con nivel de evidencia y reglas de personalización.
// `aplica(ctx)` devuelve una puntuación 0–3 (0 = no recomendar). ctx: {objetivo, entreno, dieta, frecuencia, enDeficit}

export const NIVELES = {
  A: 'Evidencia sólida y consistente',
  B: 'Evidencia moderada o condicionada a un déficit',
  C: 'Evidencia insuficiente, nula o solo marketing',
};

const fuerza = (c) => c.entreno === 'fuerza' || c.entreno === 'mixto';
const cardio = (c) => c.entreno === 'cardio' || c.entreno === 'mixto';

export const SUPLEMENTOS = [
  // ---------- A ----------
  {
    id: 'creatina', nivel: 'A', nombre: 'Creatina monohidrato',
    dosis: '3–5 g/día, cualquier momento, indefinidamente. Carga opcional: 20 g/día repartidos durante 5–7 días.',
    sirve: 'Aumenta las reservas de fosfocreatina: más repeticiones a alta intensidad, mayor fuerza e hipertrofia a medio plazo. Es el suplemento con mejor relación evidencia/precio que existe.',
    noHace: 'No quema grasa, no daña el riñón sano, no necesita ciclos. Las versiones "avanzadas" (HCl, etil éster, tamponada) no superan al monohidrato y cuestan más.',
    aplica: (c) => (fuerza(c) ? 3 : cardio(c) ? 1 : 0),
  },
  {
    id: 'cafeina', nivel: 'A', nombre: 'Cafeína',
    dosis: '3–6 mg/kg, 30–60 min antes de entrenar. Empieza por la parte baja.',
    sirve: 'Reduce la percepción de esfuerzo y mejora el rendimiento en fuerza y resistencia.',
    noHace: 'Se genera tolerancia con el uso diario. Vida media de 5–6 h: tomada por la tarde empeora el sueño, y dormir mal cuesta más rendimiento del que la cafeína aporta.',
    aplica: (c) => (c.entreno === 'ninguno' ? 0 : 2),
  },
  {
    id: 'proteina', nivel: 'A', nombre: 'Proteína en polvo (whey, caseína, soja, guisante)',
    dosis: '20–40 g por toma, solo para completar lo que no llegas a comer.',
    sirve: 'Es comida en formato cómodo y barato por gramo de proteína. Sirve para alcanzar el objetivo diario, nada más.',
    noHace: 'No es mejor que el pollo, los huevos o las legumbres. Si ya llegas a tu proteína con comida real, no aporta nada.',
    aplica: (c) => (fuerza(c) ? 2 : 1),
    condicion: 'Recomendada solo si no llegas al objetivo de proteína con comida. En dieta vegana, soja o mezcla guisante+arroz.',
  },
  {
    id: 'beta_alanina', nivel: 'A', nombre: 'Beta-alanina',
    dosis: '3,2–6,4 g/día repartidos en tomas de ≤1,6 g. Efecto tras 4+ semanas de acumulación.',
    sirve: 'Aumenta la carnosina muscular y amortigua la acidez: útil en esfuerzos de 1–4 minutos (series largas, 400–1500 m, crossfit).',
    noHace: 'No hace nada en series cortas de fuerza ni en resistencia larga. La parestesia (hormigueo) es frecuente e inocua.',
    aplica: (c) => (c.entreno === 'mixto' ? 2 : cardio(c) ? 1 : fuerza(c) ? 1 : 0),
  },
  {
    id: 'bicarbonato', nivel: 'A', nombre: 'Bicarbonato sódico',
    dosis: '0,2–0,3 g/kg, 60–150 min antes, esfuerzos de 1–10 min.',
    sirve: 'Tampón extracelular: mejora el rendimiento en esfuerzos intensos de 1–10 minutos.',
    noHace: 'Las molestias gastrointestinales son habituales; prueba en entrenamientos antes de competir. Sin utilidad en fuerza pura ni en sesiones largas suaves.',
    aplica: (c) => (cardio(c) ? 1 : 0),
  },
  {
    id: 'nitratos', nivel: 'A', nombre: 'Nitratos (zumo de remolacha)',
    dosis: '6–13 mmol de nitrato (≈ 300–600 ml de zumo o 1–2 concentrados), 2–3 h antes.',
    sirve: 'Mejora la eficiencia del oxígeno y el rendimiento en resistencia, más en no élite.',
    noHace: 'Efecto pequeño en deportistas muy entrenados. Evita el enjuague bucal antibacteriano ese día: bloquea la conversión a nitrito.',
    aplica: (c) => (cardio(c) ? 2 : 0),
  },
  // ---------- B ----------
  {
    id: 'vitamina_d', nivel: 'B', nombre: 'Vitamina D3',
    dosis: '1000–2000 UI/día con una comida con grasa.',
    sirve: 'Corrige el déficit, muy frecuente en invierno o con poca exposición solar. Con niveles normales no mejora nada.',
    noHace: 'No es ergogénica por sí misma. Lo razonable es una analítica antes de suplementar.',
    aplica: () => 1,
    condicion: 'Si hay déficit analítico o poca exposición solar.',
  },
  {
    id: 'omega3', nivel: 'B', nombre: 'Omega-3 (EPA + DHA)',
    dosis: '1–3 g/día de EPA+DHA combinados.',
    sirve: 'Cubre la ingesta si no comes pescado azul 2–3 veces por semana. Beneficio cardiovascular y antiinflamatorio modesto.',
    noHace: 'No aumenta la fuerza ni la hipertrofia de forma relevante.',
    aplica: (c) => (c.dieta !== 'omnivoro' ? 2 : 1),
    condicion: 'Especialmente si no comes pescado azul. En dieta vegana, aceite de microalgas.',
  },
  {
    id: 'hierro', nivel: 'B', nombre: 'Hierro',
    dosis: 'Solo con ferropenia confirmada por analítica, a la dosis que indique el médico.',
    sirve: 'Corrige la anemia ferropénica, frecuente en mujeres que entrenan resistencia y en dietas sin carne.',
    noHace: 'Suplementar sin déficit es contraproducente: el exceso se acumula y da problemas digestivos y oxidativos.',
    aplica: (c) => (c.dieta !== 'omnivoro' || cardio(c) ? 1 : 0),
    condicion: 'Solo con analítica que confirme déficit.',
  },
  {
    id: 'citrulina', nivel: 'B', nombre: 'Citrulina malato',
    dosis: '6–8 g, 30–60 min antes de entrenar.',
    sirve: 'Efecto pequeño sobre el volumen de trabajo y las agujetas.',
    noHace: 'Los "pre-entrenos" comerciales suelen llevar dosis inferiores a la eficaz.',
    aplica: (c) => (fuerza(c) ? 1 : 0),
  },
  {
    id: 'b12', nivel: 'B', nombre: 'Vitamina B12',
    dosis: '25–100 µg/día o 2000 µg/semana.',
    sirve: 'Obligatoria en dieta vegana: no hay fuente vegetal fiable. Valorar también yodo, zinc y calcio.',
    noHace: 'En omnívoros con dieta variada no aporta nada.',
    aplica: (c) => (c.dieta === 'vegano' ? 3 : c.dieta === 'vegetariano' ? 1 : 0),
  },
  {
    id: 'multivitaminico', nivel: 'B', nombre: 'Multivitamínico',
    dosis: 'Una dosis diaria de un producto básico, sin megadosis.',
    sirve: 'Red de seguridad en dietas hipocalóricas prolongadas o muy restrictivas, donde es fácil quedarse corto en micronutrientes.',
    noHace: 'No sustituye a comer variado ni mejora el rendimiento si no hay déficit.',
    aplica: (c) => (c.enDeficit ? 1 : 0),
  },
  {
    id: 'ashwagandha', nivel: 'B', nombre: 'Ashwagandha',
    dosis: '300–600 mg/día de extracto estandarizado.',
    sirve: 'Evidencia moderada sobre estrés percibido y calidad del sueño.',
    noHace: 'No es ergogénica. Los efectos sobre testosterona son pequeños e inconsistentes.',
    aplica: () => 0,
  },
  {
    id: 'melatonina', nivel: 'B', nombre: 'Melatonina',
    dosis: '0,5–3 mg, 30–60 min antes de acostarse, para desajustes puntuales.',
    sirve: 'Útil para jet lag y turnos; acorta un poco el tiempo hasta dormirse.',
    noHace: 'No mejora el sueño en quien ya duerme bien ni sustituye a la higiene de sueño.',
    aplica: () => 0,
  },
  // ---------- C ----------
  { id: 'bcaa', nivel: 'C', nombre: 'BCAA y aminoácidos aislados', dosis: '—', sirve: 'Nada si la proteína total es suficiente: ya vienen en cualquier fuente de proteína completa.', noHace: 'No preservan músculo ni mejoran la recuperación por encima de la proteína dietética. Son redundantes.', aplica: () => 0 },
  { id: 'glutamina', nivel: 'C', nombre: 'Glutamina, arginina, tribulus, ZMA, "potenciadores de testosterona"', dosis: '—', sirve: 'Sin efecto demostrado sobre fuerza, masa muscular o testosterona en personas sanas.', noHace: 'El ZMA solo tiene sentido si hay déficit de zinc o magnesio, y entonces basta con el mineral.', aplica: () => 0 },
  { id: 'quemagrasas', nivel: 'C', nombre: 'Quemagrasas: L-carnitina, CLA, garcinia, cetonas de frambuesa', dosis: '—', sirve: 'Nada relevante. La pérdida de grasa la produce el déficit calórico.', noHace: 'Ninguno acelera la oxidación de grasa de forma medible en humanos. Marketing.', aplica: () => 0 },
  { id: 'ecdisterona', nivel: 'C', nombre: 'Ecdisterona', dosis: '—', sirve: 'Evidencia muy limitada, con estudios de baja calidad.', noHace: 'Los análisis de producto muestran con frecuencia que el contenido real no coincide con la etiqueta.', aplica: () => 0 },
  { id: 'hmb', nivel: 'C', nombre: 'HMB', dosis: '—', sirve: 'Algún efecto en principiantes absolutos o mayores con sarcopenia.', noHace: 'En personas ya entrenadas los efectos son nulos o mínimos; los estudios espectaculares no se han replicado.', aplica: () => 0 },
];

export const MAX_RECOMENDADOS = 5;

export function recomendar(ctx) {
  const puntuados = SUPLEMENTOS.map((s) => ({ ...s, puntos: s.aplica(ctx) }));
  const orden = { A: 0, B: 1, C: 2 };
  const rec = puntuados.filter((s) => s.puntos > 0).sort((a, b) => b.puntos - a.puntos || orden[a.nivel] - orden[b.nivel]);
  return {
    principales: rec.slice(0, MAX_RECOMENDADOS),
    opcionales: rec.slice(MAX_RECOMENDADOS),
    resto: puntuados.filter((s) => s.puntos === 0).sort((a, b) => orden[a.nivel] - orden[b.nivel]),
  };
}
