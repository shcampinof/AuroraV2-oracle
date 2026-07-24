# Frontend Aurora

Aplicacion cliente construida con React + Vite.

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
