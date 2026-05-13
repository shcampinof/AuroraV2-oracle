# Aurora Docker

La guia principal de despliegue esta en `GUIA_DESPLIEGUE_AURORA.md`.

Resumen de arquitectura:

- `frontend/` (Vite + React) se compila en build de produccion.
- `backend/` (Node.js + Express) sirve API REST y archivos estaticos del frontend.
- El servicio web unico escucha en `PORT` (por defecto `7860`).

## Docker Compose

```bash
cp .env.example .env
docker compose up --build -d
```

Verificacion:

```bash
curl http://localhost:7860/api/health
curl http://localhost:7860/api/health/db
```

## Docker directo

```bash
docker build -t aurora-app .
docker run --env-file .env -p 7860:7860 aurora-app
```

## Variables de entorno

Usar `.env.example` como plantilla y crear un `.env` local con valores reales. No versionar `.env`, `backend/.env` ni `backend/.env.test`.

## Uso en Hugging Face Spaces (Docker)

1. Sube el repositorio con este `Dockerfile` en la raiz.
2. Crea un Space tipo **Docker**.
3. Hugging Face construira la imagen y expondra el servicio web unico.
4. Asegura que el contenedor escuche en `PORT` (ya configurado en backend).
