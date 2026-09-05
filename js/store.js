// store.js — wrapper mínimo de IndexedDB. Base "nutriapp", versión 1.
// Almacenes: perfil (clave fija 'perfil'), registros (clave fecha), recetas (id), ajustes (clave), historial_tdee (fecha).
// Campos reservados para el futuro sin migración: registros.fuente ('manual'|'healthkit'|'googlefit'|'bascula'),
// registros.foto (null), ajustes.recordatorios (null).

const DB = 'nutriapp';
const VERSION = 1;
const STORES = ['perfil', 'registros', 'recetas', 'ajustes', 'historial_tdee'];

let dbPromise = null;

function abrir() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((res, rej) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
  return dbPromise;
}

function tx(store, modo, fn) {
  return abrir().then((db) => new Promise((res, rej) => {
    const t = db.transaction(store, modo);
    const r = fn(t.objectStore(store));
    t.oncomplete = () => res(r.result);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  }));
}

export const get = (store, key) => tx(store, 'readonly', (s) => s.get(key));
export const set = (store, key, value) => tx(store, 'readwrite', (s) => s.put(value, key));
export const del = (store, key) => tx(store, 'readwrite', (s) => s.delete(key));
export const claves = (store) => tx(store, 'readonly', (s) => s.getAllKeys());
export const todos = (store) => tx(store, 'readonly', (s) => s.getAll());
export const vaciar = (store) => tx(store, 'readwrite', (s) => s.clear());

// Atajos de dominio
export const getPerfil = () => get('perfil', 'perfil');
export const setPerfil = (p) => set('perfil', 'perfil', p);
export const getAjuste = (k) => get('ajustes', k);
export const setAjuste = (k, v) => set('ajustes', k, v);

export async function getRegistros() {
  const claves_ = await claves('registros');
  const vals = await todos('registros');
  return claves_.map((k, i) => ({ fecha: k, ...vals[i] })).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
}
export async function guardarRegistro(fecha, datos) {
  const prev = (await get('registros', fecha)) || { fuente: 'manual', foto: null };
  const nuevo = { ...prev, ...datos, fuente: datos.fuente || prev.fuente || 'manual' };
  await set('registros', fecha, nuevo);
  return nuevo;
}

export async function exportarTodo() {
  const out = { app: 'nutriapp', version: 1, exportado: new Date().toISOString() };
  for (const s of STORES) {
    const ks = await claves(s);
    const vs = await todos(s);
    out[s] = ks.map((k, i) => [k, vs[i]]);
  }
  // La clave de API no se exporta
  out.ajustes = out.ajustes.filter(([k]) => k !== 'apiKey');
  return out;
}

export async function importarTodo(json) {
  if (!json || json.app !== 'nutriapp') throw new Error('El archivo no es una exportación de nutriapp.');
  for (const s of STORES) {
    if (!Array.isArray(json[s])) continue;
    for (const [k, v] of json[s]) await set(s, k, v);
  }
}

export async function borrarTodo() {
  for (const s of STORES) await vaciar(s);
}

export const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
