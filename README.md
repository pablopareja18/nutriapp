# nutriapp

PWA de nutrición basada en evidencia. Calcula calorías y macros, mide tu gasto energético real a partir de la tendencia de peso y la ingesta registrada (como MacroFactor), genera recetas ajustadas a lo que te queda del día y clasifica suplementos por nivel de evidencia. Sin frameworks, sin build, funciona offline.

## Desplegar en GitHub Pages

1. Crea un repositorio llamado `nutriapp` y sube todos los archivos a la rama `main` (carpeta raíz).
2. En el repositorio: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)` → Save**.
3. En un par de minutos la app estará en `https://TU-USUARIO.github.io/nutriapp/`.

Todas las rutas son relativas (`./`), así que funciona igual en la raíz de un dominio o en una subcarpeta.

Para probarla en local: `python3 -m http.server 8000` en la carpeta del proyecto y abre `http://localhost:8000/`. (Abrir `index.html` directamente con `file://` no sirve: el service worker y los módulos ES necesitan un servidor.)

## Clave de API para las recetas

La pestaña Recetas llama a la API de Anthropic desde el navegador con tu propia clave. Nada más necesita red.

1. Entra en <https://console.anthropic.com/> → **API keys** → **Create key**.
2. En la app: **Ajustes → Clave de API** → pega la clave → **Guardar clave** → **Probar conexión**.

La clave se guarda solo en IndexedDB de tu dispositivo, no va en el repositorio ni en las exportaciones de datos. Cada par de recetas cuesta una fracción de céntimo.

## Instalar en el móvil

- **Android (Chrome):** abre la URL, toca el botón «Instalar en este dispositivo» en Ajustes, o menú ⋮ → «Instalar aplicación».
- **iPhone / iPad (Safari):** abre la URL en Safari → botón Compartir → «Añadir a pantalla de inicio» → Añadir. Safari no muestra ningún aviso automático. Ábrela después desde el icono para que funcione a pantalla completa.

## Actualizar la app (versión de la caché)

El service worker cachea todo el shell con estrategia *cache-first*, así que los cambios no llegan a los usuarios hasta que cambia la versión de la caché.

Cada vez que modifiques cualquier archivo:

1. En `sw.js`, sube `CACHE_VERSION` (`nutriapp-v1` → `nutriapp-v2`).
2. Si añades archivos nuevos, inclúyelos en la lista `SHELL` de `sw.js`.
3. Opcionalmente sube `VERSION_APP` en `js/ui-ajustes.js` para que se vea en Ajustes.
4. Haz commit y push.

Al abrir la app, el nuevo service worker se instala, borra la caché antigua y muestra el aviso «Nueva versión disponible». Se aplica al cerrar y volver a abrir.

## Pruebas del motor

```
node tests/calc.test.js
```

Cubre el caso de referencia (hombre 35 a, 80 kg, 18 %), los bloqueos de seguridad (ritmo > 1 %, suelo calórico, IMC objetivo < 18,5, menores), el motor adaptativo con 3 semanas simuladas y el reescalado de recetas.

## Estructura

```
index.html                shell con las cinco vistas
styles.css                móvil primero, tema claro/oscuro
manifest.webmanifest      start_url y scope relativos
sw.js                     service worker cache-first versionado
js/calc.js                motor de cálculo puro (sin DOM)
js/store.js               wrapper IndexedDB
js/recetas-api.js         llamada a Anthropic y parseo
js/suplementos-data.js    catálogo por nivel de evidencia
js/charts.js              gráficos SVG sin librerías
js/ui-*.js                una vista por archivo
tests/calc.test.js        pruebas ejecutables
icons/                    iconos 192, 512 y maskable
```

## Preparado pero no implementado

El almacenamiento ya reserva los campos, así que añadirlos no exige migrar datos:

- Recordatorios push (`ajustes.recordatorios`; necesita servidor).
- Sincronización con Apple Health / Google Fit o básculas (`registros.fuente`; necesita envoltorio nativo con Capacitor).
- Registro por foto (`registros.foto`).

## Aviso

Herramienta educativa. No diagnostica ni trata ninguna patología y no sustituye a un dietista-nutricionista ni a un médico. No apta para menores de 18 años ni durante el embarazo o la lactancia.
