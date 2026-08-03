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
- Caja de Herramientas con enlaces resueltos por la API hacia SharePoint.
- Generación de PDF en el navegador con `jspdf`.
- Manual Interactivo servido desde `/tutorial-videos`.

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
