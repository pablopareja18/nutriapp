import * as S from './store.js';
import { probarClave } from './recetas-api.js';
import { $, esc, toast } from './ui.js';

export const VERSION_APP = '1.0.0';

export async function renderAjustes(root, ctx) {
  const apiKey = (await S.getAjuste('apiKey')) || '';
  const tema = (await S.getAjuste('tema')) || 'sistema';
  const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  root.innerHTML = `<h1>Ajustes</h1>
  <h2>Clave de API de Anthropic</h2>
  <p class="muted">Solo se usa para generar recetas. Se guarda en la base de datos local de este dispositivo y no se envía a ningún otro sitio; no se incluye en las exportaciones. Consíguela en console.anthropic.com → API keys.</p>
  <label for="apiKey">Clave</label>
  <input id="apiKey" type="password" autocomplete="off" value="${esc(apiKey)}" placeholder="sk-ant-…">
  <div class="acciones">
    <button type="button" class="btn btn-primario" id="btn-guardar-clave">Guardar clave</button>
    <button type="button" class="btn" id="btn-probar-clave">Probar conexión</button>
  </div>
  <p id="clave-estado" class="muted"></p>

  <h2>Tema</h2>
  <div class="chips">${[['sistema', 'Sistema'], ['claro', 'Claro'], ['oscuro', 'Oscuro']].map(([v, t]) => `<button type="button" class="chip" data-tema="${v}" aria-pressed="${v === tema}">${t}</button>`).join('')}</div>

  <h2>Instalar en el móvil</h2>
  ${standalone ? '<p class="aviso aviso-ok">La app ya está instalada y abierta en modo independiente.</p>' : ''}
  <button type="button" class="btn btn-bloque" id="btn-instalar" hidden>Instalar en este dispositivo</button>
  <div class="${esIOS ? 'aviso' : ''}">
    <p><b>iPhone / iPad (Safari)</b>: toca el botón Compartir (cuadrado con flecha) → «Añadir a pantalla de inicio» → Añadir. Safari no muestra ningún aviso automático; hay que hacerlo a mano. Abre luego la app desde el icono, no desde Safari, para que funcione sin barra del navegador.</p>
    <p><b>Android (Chrome)</b>: usa el botón de arriba si aparece, o menú ⋮ → «Instalar aplicación» / «Añadir a pantalla de inicio».</p>
  </div>

  <h2>Datos</h2>
  <div class="acciones">
    <button type="button" class="btn" id="btn-exportar">Exportar JSON</button>
    <button type="button" class="btn" id="btn-importar">Importar JSON</button>
    <input type="file" id="file-importar" accept="application/json,.json" hidden>
  </div>
  <button type="button" class="btn btn-peligro btn-bloque" id="btn-borrar">Borrar todos los datos</button>

  <h2>Acerca de</h2>
  <dl class="datos">
    <dt>Versión</dt><dd>${VERSION_APP}</dd>
    <dt>Caché offline</dt><dd id="sw-estado">comprobando…</dd>
    <dt>Registros guardados</dt><dd>${ctx.registros.length}</dd>
  </dl>
  <p class="muted">Herramienta educativa. No sustituye a un dietista-nutricionista ni a un médico. No usar con menores de 18 años, en embarazo o lactancia.</p>
  <p class="muted">Preparado para futuras versiones (no implementado): recordatorios push, sincronización con Apple Health / Google Fit y básculas, registro por foto.</p>`;

  $('#btn-guardar-clave', root).addEventListener('click', async () => {
    await S.setAjuste('apiKey', $('#apiKey', root).value.trim());
    toast('Clave guardada en este dispositivo');
  });
  $('#btn-probar-clave', root).addEventListener('click', async () => {
    const k = $('#apiKey', root).value.trim(); const est = $('#clave-estado', root);
    if (!k) { est.textContent = 'Introduce una clave primero.'; return; }
    if (!navigator.onLine) { est.textContent = 'Sin conexión: no se puede probar ahora.'; return; }
    est.textContent = 'Probando…';
    try { await probarClave(k); est.textContent = 'Conexión correcta: la clave funciona.'; }
    catch (e) { est.textContent = e.message; }
  });
  root.querySelectorAll('[data-tema]').forEach((b) => b.addEventListener('click', async () => {
    await S.setAjuste('tema', b.dataset.tema); ctx.aplicarTema(b.dataset.tema);
    root.querySelectorAll('[data-tema]').forEach((x) => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true');
  }));

  const btnInst = $('#btn-instalar', root);
  if (ctx.installPrompt) btnInst.hidden = false;
  btnInst.addEventListener('click', async () => {
    if (!ctx.installPrompt) return;
    ctx.installPrompt.prompt();
    const { outcome } = await ctx.installPrompt.userChoice;
    if (outcome === 'accepted') { toast('Instalada'); btnInst.hidden = true; ctx.installPrompt = null; }
  });

  $('#btn-exportar', root).addEventListener('click', async () => {
    const data = await S.exportarTodo();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `nutriapp-${S.hoy()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  $('#btn-importar', root).addEventListener('click', () => $('#file-importar', root).click());
  $('#file-importar', root).addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { await S.importarTodo(JSON.parse(await f.text())); await ctx.recargar(); toast('Datos importados'); renderAjustes(root, ctx); }
    catch (err) { toast(err.message); }
  });
  $('#btn-borrar', root).addEventListener('click', async () => {
    if (!confirm('Se borrarán perfil, registros, recetas y clave de API de este dispositivo. ¿Continuar?')) return;
    await S.borrarTodo(); await ctx.recargar(); toast('Datos borrados'); renderAjustes(root, ctx);
  });

  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.getRegistration();
    $('#sw-estado', root).textContent = reg?.active ? 'activa' : 'no disponible';
  } else $('#sw-estado', root).textContent = 'no compatible';
}
