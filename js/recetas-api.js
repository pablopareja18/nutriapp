// recetas-api.js — generación de recetas con la API de Anthropic desde el navegador.
// La app calcula los totales; el modelo solo devuelve ingredientes con macros por 100 g.
import { totalesReceta } from './calc.js';

export class ErrorRecetas extends Error {
  constructor(tipo, mensaje) { super(mensaje); this.tipo = tipo; }
}

const COMIDAS = { desayuno: 'desayuno', comida: 'comida (almuerzo)', cena: 'cena', snack: 'snack o tentempié' };

export function construirPrompt({ ingredientes, comida, hueco, perfil, variante }) {
  const pref = perfil?.dieta || 'omnívoro';
  const alergias = perfil?.alergias?.trim() || 'ninguna';
  const evitar = perfil?.evitar?.trim() || 'ninguno';
  const varianteTxt = variante ? `\nVARIANTE PEDIDA: ${variante}. Aplica esta variación a ambas recetas.` : '';
  return `Eres dietista-nutricionista deportivo y cocinero. Genera DOS recetas para ${COMIDAS[comida] || comida} usando como base estos ingredientes que pide el usuario: "${ingredientes}".

Receta 1 "sencilla": máximo 15 minutos, pocos ingredientes, técnica básica, con verduras incluidas.
Receta 2 "elaborada": misma base de ingredientes, más técnica y sabor, 30–45 minutos.

Contexto del usuario:
- Dieta: ${pref}. Alergias e intolerancias: ${alergias}. Alimentos que no quiere ver: ${evitar}.
- Le quedan hoy aproximadamente: ${hueco.kcal} kcal, ${hueco.proteina} g proteína, ${hueco.hidratos} g hidratos, ${hueco.grasa} g grasa. Acércate a ese hueco, pero la app reescalará después las cantidades, así que prioriza proporciones sensatas.
- Ingredientes y medidas de supermercado español. Cantidades de cereales, pasta, arroz y legumbres en PESO CRUDO.${varianteTxt}

Responde SOLO con JSON válido, sin preámbulo, sin explicación y sin vallas de código. Estructura exacta:
{"recetas":[{"tipo":"sencilla","nombre":"...","raciones":1,"tiempo_min":15,"dificultad":"baja","ingredientes":[{"nombre":"Pechuga de pollo","gramos":150,"rol":"proteina","por100":{"kcal":110,"proteina":23,"hidratos":0,"grasa":1.5}}],"pasos":["..."]},{"tipo":"elaborada", ...}]}
Reglas: "rol" es "proteina" para la fuente principal de proteína, "hidratos" para la fuente principal de hidratos, "otro" para el resto. Los valores por100 deben ser realistas (tablas BEDCA/USDA). Incluye siempre el aceite y las salsas con sus gramos. Entre 4 y 10 ingredientes por receta. Pasos numerados como lista de strings, concretos y breves.`;
}

export function parsearRespuesta(texto) {
  const limpio = texto.replace(/```json|```/g, '').trim();
  const inicio = limpio.indexOf('{');
  const fin = limpio.lastIndexOf('}');
  if (inicio < 0 || fin < 0) throw new ErrorRecetas('parseo', 'La respuesta no contiene JSON.');
  let data;
  try { data = JSON.parse(limpio.slice(inicio, fin + 1)); } catch { throw new ErrorRecetas('parseo', 'La respuesta no es JSON válido. Vuelve a intentarlo.'); }
  if (!Array.isArray(data.recetas) || data.recetas.length < 1) throw new ErrorRecetas('parseo', 'La respuesta no trae recetas.');
  return data.recetas.map((r, i) => {
    const receta = {
      id: `${Date.now()}-${i}`,
      tipo: r.tipo || (i === 0 ? 'sencilla' : 'elaborada'),
      nombre: r.nombre || 'Receta',
      raciones: Math.max(1, Number(r.raciones) || 1),
      tiempo_min: Number(r.tiempo_min) || null,
      dificultad: r.dificultad || null,
      ingredientes: (r.ingredientes || []).map((x) => ({
        nombre: String(x.nombre || ''),
        gramos: Math.max(0, Number(x.gramos) || 0),
        rol: ['proteina', 'hidratos', 'otro'].includes(x.rol) ? x.rol : undefined,
        por100: {
          kcal: Number(x.por100?.kcal) || 0, proteina: Number(x.por100?.proteina) || 0,
          hidratos: Number(x.por100?.hidratos) || 0, grasa: Number(x.por100?.grasa) || 0,
        },
      })),
      pasos: (r.pasos || []).map(String),
      creada: new Date().toISOString(),
    };
    receta.totales = totalesReceta(receta);
    return receta;
  });
}

export async function generarRecetas(opts, apiKey) {
  if (!apiKey) throw new ErrorRecetas('sin_clave', 'No hay clave de API configurada. Añádela en Ajustes.');
  if (!navigator.onLine) throw new ErrorRecetas('red', 'Sin conexión. Generar recetas necesita internet; el resto de la app funciona offline.');
  let response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        messages: [{ role: 'user', content: construirPrompt(opts) }],
      }),
    });
  } catch {
    throw new ErrorRecetas('red', 'No se pudo contactar con la API. Comprueba tu conexión.');
  }
  if (response.status === 401) throw new ErrorRecetas('clave', 'Clave de API no válida (401). Revísala en Ajustes.');
  if (response.status === 429) throw new ErrorRecetas('limite', 'Límite de peticiones alcanzado (429). Espera un minuto y vuelve a intentarlo.');
  if (!response.ok) {
    let detalle = '';
    try { detalle = (await response.json()).error?.message || ''; } catch { /* vacío */ }
    throw new ErrorRecetas('api', `Error de la API (${response.status}). ${detalle}`);
  }
  const data = await response.json();
  const texto = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  return parsearRespuesta(texto);
}

export async function probarClave(apiKey) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 5, messages: [{ role: 'user', content: 'ok' }] }),
  });
  if (r.status === 401) throw new ErrorRecetas('clave', 'Clave no válida (401).');
  if (!r.ok) throw new ErrorRecetas('api', `La API respondió ${r.status}.`);
  return true;
}
