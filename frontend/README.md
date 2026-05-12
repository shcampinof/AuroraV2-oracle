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
