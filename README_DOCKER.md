# Aurora Docker (Hugging Face Spaces)

Este proyecto se ejecuta en un unico contenedor Docker:

- `frontend/` (Vite + React) se compila en build de produccion.
- `backend/` (Node.js + Express) sirve API REST y archivos estaticos del frontend.
- El servicio web unico escucha en `PORT` (por defecto `7860`).

## Construir imagen

```bash
docker build -t aurora-app .
```

Opcional (si quieres cambiar la base de API en build del frontend):

```bash
docker build -t aurora-app --build-arg VITE_API_BASE_URL=/api .
```

## Ejecutar en local

```bash
docker run -p 7860:7860 aurora-app
```

Con puerto configurable:

```bash
docker run -e PORT=7860 -p 7860:7860 aurora-app
```

## Verificacion rapida

- Frontend: `http://localhost:7860`
- Health API: `http://localhost:7860/api/health`

## Variables de entorno

Minimas para ejecucion:

- `PORT` (opcional): puerto HTTP del servidor Express. Default: `7860`.

Opcionales de build frontend:

- `VITE_API_BASE_URL` (build arg): URL base para API en el bundle frontend. Default: `/api`.

No se incluyen credenciales ni archivos `.env` dentro de la imagen. Si agregas integraciones sensibles (tokens, DB URI, etc.), inyectalas como variables de entorno al desplegar.

## Uso en Hugging Face Spaces (Docker)

1. Sube el repositorio con este `Dockerfile` en la raiz.
2. Crea un Space tipo **Docker**.
3. Hugging Face construira la imagen y expondra el servicio web unico.
4. Asegura que el contenedor escuche en `PORT` (ya configurado en backend).
