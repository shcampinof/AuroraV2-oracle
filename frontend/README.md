# Frontend Aurora

Aplicacion cliente construida con React + Vite.

Fecha de actualización técnica: 2026-07-30.

## Scripts

```bash
npm run dev
npm run build
npm run preview
npm run lint
npm run test
```

## Entorno

Por defecto, el servidor de desarrollo usa `http://localhost:5174` y proxy hacia el backend en `http://localhost:7860`.
Para cambiarlo localmente, crear `frontend/.env.local` con:

```env
VITE_DEV_PORT=5174
VITE_DEV_API_TARGET=http://localhost:7860
```

## Feature Flags

Las banderas funcionales simples del frontend se centralizan en:

```text
frontend/src/config/featureFlags.js
```

Para esta versión `manualInteractivo` está en `true`, por lo que la pestaña **Manual Interactivo** aparece en el menú y la ruta `#/manual` muestra el video institucional configurado.

El catálogo se define en `src/config/externalAssets.js`. En desarrollo, Vite proxifica `/tutorial-videos` al backend; en producción los archivos versionados en `backend/tutorial-videos/` se sirven desde el mismo origen.

## Integraciones del cliente

- Microsoft Entra ID mediante `@azure/msal-browser`; la Redirect URI usada es `window.location.origin`.
- API Aurora bajo `/api`, con token de sesión emitido por el backend.
- Caja de Herramientas con enlaces resueltos por la API. Los administradores pueden crear ítems y editar título, color y enlace desde «Editar caja de herramientas». El formulario muestra la URL generada: los enlaces de SharePoint y OneDrive (`onedrive.live.com`) reciben `download=1`; otros enlaces HTTP(S) se conservan. La descarga sigue dependiendo de los permisos del archivo de origen.
- El catálogo inicial se conserva hasta el primer guardado. Los cambios se almacenan en `backend/storage/formatos/catalogo.json` (configurable con `AURORA_FORMATOS_STORE_PATH`), con volumen persistente `aurora_formatos` en Docker. Incluir ese almacenamiento en los respaldos.
- Los ítems se crean y editan con una paleta fija de cinco colores: azul, rosa, verde, morado y naranja. La interfaz y la API comparten `shared/formato-colors.json`.
- Desde «Editar caja de herramientas», el administrador puede crear carpetas, cambiar sus nombres y seleccionar los formularios o documentos que contienen. Cada ítem pertenece a una carpeta o queda en «Sin carpeta»; también puede moverse desde su editor. Los demás usuarios pueden navegar por las carpetas y descargar su contenido. Eliminar una carpeta conserva sus ítems en «Sin carpeta». Carpetas y agrupaciones se guardan juntas en el catálogo; los catálogos anteriores se leen y migran automáticamente al guardar.
- Generación de PDF en el navegador con `jspdf`.
- Manual Interactivo servido desde `/tutorial-videos`.

## Asignación de gestiones vacías desde PAG

En PAG, eliminar la asignación de una gestión sin respuestas retira su defensor
y conserva esa misma gestión disponible para asignación. Reasignarla también
reutiliza esa gestión vacía. Se consideran vacíos NULL, espacios, guiones
(incluidos «--», «–» y «—»), `null`/`undefined` textuales, «Seleccione», «Todos»,
«Sin información», «Sin dato(s)», «Sin respuesta» y listas sin respuestas.
La identidad del defensor, las fechas técnicas y el estado calculado no son
avances; cero insistencias tampoco. Cualquier respuesta real, incluso «No»,
«No aplica» o «Ninguna», una fecha diligenciada o un texto parcial conserva la
gestión y su autor: al desasignar se prepara otra gestión vacía. El historial
de asignaciones se conserva. La desasignación y la preparación de la gestión
se guardan en una sola transacción.

## Revisión automática del análisis jurídico

Cuando las procedencias 30 a 34 son negativas (utilidad pública puede quedar vacía) y la pregunta 36 es «Ninguna», se muestra «Nueva fecha de análisis». El usuario debe seleccionarla obligatoriamente entre hoy y seis meses calendario adelante, incluidos ambos límites, usando el día de Bogotá. El límite se ajusta al último día del mes cuando sea necesario. El formulario y el servidor validan el rango, también en el autoguardado. Se guarda en `GESTION_JURIDICA.NUEVA_FECHA_ANALISIS`.

El backend comprueba cada minuto las fechas vencidas, usando el día de Bogotá, y también al iniciar. Crea una gestión vacía con el mismo defensor y asignación, vinculada al caso cerrado mediante `ID_GESTION_ORIGEN`. Conserva el análisis original y evita duplicados. No crea revisiones si la persona está fuera de prisión, la asignación dejó de estar vigente o ya existe una gestión posterior. Repetir la asignación al mismo defensor no adelanta la revisión.

Antes de desplegar esta versión en otro entorno, revisar y aplicar la migración con `npm --prefix backend run db:install-analysis-review` y `npm --prefix backend run db:install-analysis-review -- --apply`. La migración agrega las columnas e índices faltantes y calcula fechas para cierres anteriores aplicables. Las pruebas de Oracle se ejecutan con `npm --prefix backend run test:oracle:analysis-review` y revierten los registros sintéticos al finalizar.

## Funcionamiento sin conexión

El service worker precarga el shell compilado y puede encolar únicamente estas escrituras:

- actualización de un PPL;
- creación de una actuación;
- asignación de defensor;
- creación de defensor.

La cola tiene límites de cantidad y tamaño, no almacena el encabezado `Authorization` y vincula cada entrada con la identidad que la originó. Al cerrar sesión o cambiar de usuario se descartan escrituras autenticadas pendientes de otra identidad. Las respuestas HTTP 4xx se consideran definitivas y no se reintentan.

## Validación

```bash
npm ci
npm run lint
npm run test
npm run build
npm audit
```

El build ejecuta `scripts/inject-pwa-assets.mjs` para incorporar al precache los archivos generados por Vite. La advertencia de tamaño de un chunk no bloquea la compilación, pero debe vigilarse si se agregan dependencias o pantallas pesadas.
