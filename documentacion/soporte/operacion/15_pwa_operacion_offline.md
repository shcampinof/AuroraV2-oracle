# PWA y operacion offline

## Alcance

Aurora incluye una PWA basica de produccion orientada a:

- Instalacion desde navegador compatible.
- Cache del shell de aplicacion y assets compilados de Vite.
- Navegacion del frontend cuando la red no esta disponible.
- Cola local acotada para escrituras criticas sobre `/api`.
- Reintento diferido mediante Background Sync cuando el navegador lo soporte, con respaldo por evento `online`.

La PWA no convierte a Oracle ni al backend en datos offline completos. Las consultas (`GET /api/...`) siguen dependiendo del backend para evitar mostrar informacion operativa obsoleta como si fuera vigente.

## Archivos principales

| Ruta | Uso |
|---|---|
| `frontend/public/manifest.json` | Metadata de instalacion, alcance, colores e iconos. |
| `frontend/public/service-worker.js` | Cache de shell/assets y cola offline. |
| `frontend/scripts/inject-pwa-assets.mjs` | Inyecta assets hash de `dist/assets` al service worker despues del build. |
| `frontend/src/main.jsx` | Registra el service worker en produccion y dispara reintentos al volver la conexion. |
| `frontend/src/services/api.js` | Distingue respuestas `202` en cola y evita tratarlas como error. |
| `frontend/src/services/authStorage.js` | Entrega el token activo al service worker sin persistirlo en IndexedDB. |

## Cache

El service worker usa `aurora-shell-v2` y precachea:

- `/`
- `/index.html`
- `/manifest.json`
- iconos PWA
- assets compilados bajo `/assets/*`, inyectados por `npm run build`

Las rutas de API se excluyen del cache:

```text
/api
/api/*
```

## Cola offline

La cola usa IndexedDB (`aurora-pwa-v1`, store `offlineRequests`) y solo acepta escrituras controladas:

- `PUT /api/ppl/:documento`
- `POST /api/ppl/:documento/actuaciones`
- `POST /api/ppl/asignar-defensor`
- `POST /api/defensores`

El service worker solo encola cuando la red falla. Si el backend responde `400`, `409`, `500` u otro estado HTTP, esa respuesta se conserva y el frontend muestra el error normal.

Limites para no sobrecargar el cliente:

- Maximo 75 solicitudes pendientes.
- Maximo 256 KB por cuerpo de solicitud.
- Sin cache de consultas de negocio.
- Sin dependencias adicionales de PWA/Workbox.

## Autenticacion y seguridad

El encabezado `Authorization` no se guarda en IndexedDB. El frontend envia el token activo al service worker en memoria mediante `postMessage`. Si no hay token activo, la cola queda pendiente hasta que la aplicacion vuelva a abrirse con sesion valida.

## Comportamiento para el usuario

Cuando una escritura queda en cola, el backend simulado por el service worker responde `202` con:

```json
{
  "queued": true,
  "message": "Operacion guardada localmente. Se sincronizara cuando vuelva la conexion."
}
```

Las pantallas de formulario, asignacion y defensores muestran mensajes de guardado en cola. Al recuperar conectividad, el service worker reintenta en orden de creacion.

## Limitaciones conocidas

- Las consultas offline no se responden desde cache para evitar datos desactualizados.
- Si una operacion en cola ya no es valida al sincronizarse, por ejemplo por validacion de negocio, el backend puede rechazarla; las respuestas `4xx` se eliminan de la cola para evitar reintentos infinitos.
- Background Sync no esta disponible en todos los navegadores; por eso tambien se dispara reintento con el evento `online`.
- La creacion de una nueva actuacion puede quedar en cola, pero no se abre una actuacion editable hasta que el servidor la cree y la informacion se vuelva a consultar.

## Validacion

Comandos recomendados:

```bash
npm --prefix frontend run test -- pwaConfig.test.ts
npm --prefix frontend run build
```

Validacion manual sugerida en `npm run preview` o despliegue HTTPS:

1. Abrir la app en produccion y confirmar que el service worker queda registrado.
2. Instalar la app desde el navegador.
3. Cargar la app una vez en linea.
4. Cortar red y validar que el shell abre.
5. Intentar guardar un formulario o asignacion sin red y confirmar mensaje de cola.
6. Restaurar red y validar que la operacion se sincroniza contra el backend.
