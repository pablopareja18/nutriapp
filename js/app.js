import * as S from './store.js';
import { $, $$, toast } from './ui.js';
import { renderHoy } from './ui-hoy.js';
import { renderPerfil } from './ui-perfil.js';
import { renderRecetas } from './ui-recetas.js';
import { renderSuplementos } from './ui-suplementos.js';
import { renderAjustes } from './ui-ajustes.js';

const ctx = {
  perfil: null, registros: [], hueco: null, installPrompt: null,
  async recargar() { ctx.perfil = (await S.getPerfil()) || null; ctx.registros = await S.getRegistros(); },
  aplicarTema(t) {
    const html = document.documentElement;
    if (t === 'claro' || t === 'oscuro') html.dataset.tema = t; else delete html.dataset.tema;
    const oscuro = t === 'oscuro' || (t !== 'claro' && matchMedia('(prefers-color-scheme: dark)').matches);
    $$('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', oscuro ? '#10191c' : '#f6f7f5'));
  },
};

const VISTAS = { hoy: renderHoy, perfil: renderPerfil, recetas: renderRecetas, suplementos: renderSuplementos, ajustes: renderAjustes };

async function mostrar(nombre) {
  if (!VISTAS[nombre]) nombre = 'hoy';
  $$('.vista').forEach((v) => (v.hidden = v.dataset.vista !== nombre));
  $$('#tabs button').forEach((b) => (b.dataset.tab === nombre ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
  window.scrollTo(0, 0);
  if (nombre !== 'hoy' && ctx.hueco == null && ctx.perfil) await renderHoy($('#vista-hoy'), ctx); // calcula el hueco para Recetas
  await VISTAS[nombre]($(`#vista-${nombre}`), ctx);
  history.replaceState(null, '', `#${nombre}`);
}

async function init() {
  await ctx.recargar();
  ctx.aplicarTema((await S.getAjuste('tema')) || 'sistema');
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async () => ctx.aplicarTema((await S.getAjuste('tema')) || 'sistema'));

  $$('#tabs button').forEach((b) => b.addEventListener('click', () => mostrar(b.dataset.tab)));
  await mostrar(location.hash.replace('#', '') || 'hoy');

  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); ctx.installPrompt = e; const b = $('#btn-instalar'); if (b) b.hidden = false; });
  window.addEventListener('online', () => toast('Conexión recuperada'));
  window.addEventListener('offline', () => toast('Sin conexión: todo funciona salvo generar recetas'));

  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');
      reg.addEventListener('updatefound', () => {
        const nuevo = reg.installing;
        nuevo?.addEventListener('statechange', () => {
          if (nuevo.state === 'installed' && navigator.serviceWorker.controller) toast('Nueva versión disponible: cierra y vuelve a abrir la app', 5000);
        });
      });
    } catch (e) { console.warn('SW no registrado', e); }
  }
}

init();
