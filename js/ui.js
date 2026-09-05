// ui.js — utilidades de interfaz compartidas
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmt = (n, dec = 0) => (n == null || isNaN(n) ? '—' : Number(n).toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec }));

let toastTimer;
export function toast(msg, ms = 2600) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

// Botón "¿por qué?" + explicación desplegable
let contadorPorque = 0;
export function porque(texto, etiqueta = '¿por qué este número?') {
  const id = `exp-${++contadorPorque}`;
  return `<button type="button" class="porque" aria-expanded="false" aria-controls="${id}" data-porque>${esc(etiqueta)}</button><div id="${id}" class="explicacion" hidden>${esc(texto)}</div>`;
}
export function activarPorque(root) {
  $$('[data-porque]', root).forEach((b) => {
    b.addEventListener('click', () => {
      const exp = document.getElementById(b.getAttribute('aria-controls'));
      const abierto = b.getAttribute('aria-expanded') === 'true';
      b.setAttribute('aria-expanded', String(!abierto));
      exp.hidden = abierto;
    });
  });
}

export function pillMetodo(metodo, semanas) {
  return metodo === 'medido'
    ? `<span class="pill pill-medido">medido con tus datos (${semanas} sem)</span>`
    : '<span class="pill pill-estimado">estimación por fórmula</span>';
}

export const OPCIONES = {
  sexo: [['hombre', 'Hombre'], ['mujer', 'Mujer']],
  actividad: [['sedentario', 'Sedentario (oficina, poco movimiento)'], ['ligero', 'Ligero (de pie parte del día)'], ['moderado', 'Moderado (te mueves bastante)'], ['activo', 'Activo (trabajo físico)'], ['muy_activo', 'Muy activo (trabajo físico duro)']],
  entreno: [['ninguno', 'Ninguno'], ['cardio', 'Solo resistencia (cardio)'], ['fuerza', 'Solo fuerza'], ['mixto', 'Fuerza + cardio']],
  objetivo: [['perder', 'Perder grasa'], ['mantener', 'Mantener'], ['ganar', 'Ganar músculo'], ['recomposicion', 'Recomposición']],
  dieta: [['omnivoro', 'Omnívoro'], ['vegetariano', 'Vegetariano'], ['vegano', 'Vegano']],
  reparto: [['mas_hidratos', 'Más hidratos'], ['equilibrado', 'Equilibrado'], ['mas_grasas', 'Más grasas']],
};
export const opciones = (lista, actual) => lista.map(([v, t]) => `<option value="${v}" ${v === actual ? 'selected' : ''}>${esc(t)}</option>`).join('');

export const PERFIL_DEFECTO = {
  sexo: 'hombre', edad: null, altura: null, peso: null, grasaPct: null, embarazo: false,
  actividad: 'ligero', entreno: 'fuerza', frecuencia: 3, objetivo: 'perder', ritmo: 0.0075,
  dieta: 'omnivoro', alergias: '', evitar: '', comidas: 4, reparto: 'equilibrado', pesoObjetivo: null,
};

export const perfilCompleto = (p) => p && p.edad && p.altura && p.peso;
