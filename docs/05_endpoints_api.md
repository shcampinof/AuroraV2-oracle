# AURORA - API Endpoints

## 1. Base URL

- Default local: `http://localhost:4000/api`
- Fuente: `backend/index.js` y `frontend/src/services/api.js`

## 2. Salud

| Metodo | Path | Descripcion |
|---|---|---|
| GET | `/health` | Verificacion operativa del backend |

Respuesta actual: `{ ok: true, message: "Backend AURORA operativo (modo MOCK)" }`.

## 3. PPL

| Metodo | Path | Uso |
|---|---|---|
| GET | `/ppl` | Listado de registros. Query opcional `tipo=condenado|sindicado` |
| GET | `/ppl/condenados` | Listado mapeado para tablas de asignacion. Query opcional `tipo=condenado|sindicado|all` (default: `condenado`) |
| GET | `/ppl/:documento` | Consulta unificada por documento |
| PUT | `/ppl/:documento` | Actualiza registro (body libre o `{ data }`) |
| GET | `/ppl/:documento/actuaciones` | Historial de actuaciones por documento |
| POST | `/ppl/:documento/actuaciones` | Crea nueva actuacion persistida |

Errores observables:

- `404` cuando documento no existe.
- `400` en creacion de actuacion si backend no puede construir la nueva fila.

Regla funcional (blindaje):

- `GET /api/ppl/condenados` sin query `tipo` debe excluir registros de tipo `sindicado`.
- `PAG - Asignacion de Casos` debe consumir esta ruta sin `tipo` para mantener contrato estricto (solo `condenado`).
- `Usuarios asignados` puede consumir la misma ruta con `tipo=all` para mostrar `condenado` + `sindicado` sin afectar PAG.

## 4. Defensores

| Metodo | Path | Uso |
|---|---|---|
| GET | `/defensores` | Lista desde `defensores.csv` |
| GET | `/defensores?source=condenados` | Lista deduplicada desde consolidado (solo condenados) |
| POST | `/defensores` | Crea defensor en `defensores.csv` (body: `{ "nombre": "NOMBRE COMPLETO" }`) |

Errores observables:

- `400` si `nombre` no viene o contiene caracteres diferentes a letras y espacios.
- `409` si el defensor ya existe (en `defensores.csv` o en el consolidado de condenados).
- `500` para errores no controlados de persistencia.

## 5. Formatos

| Metodo | Path | Uso |
|---|---|---|
| GET | `/formatos` | Lista de formatos mock |
| GET | `/formatos/:id/download` | Descarga archivo por id |

Errores observables:

- `404` si `id` no existe en mock.
- `500` si el archivo esperado no existe en `backend/public/formatos/`.

## 6. Notas de contrato actuales

- La API no implementa autenticacion/autorizacion.
- La API responde JSON para rutas `/api/*`.
- El endpoint de descarga usa `res.download` (respuesta de archivo).

## 7. TODO de contrato API

- TODO: definir contrato formal OpenAPI con esquemas de request/response.
- TODO: documentar codigos de error por endpoint con ejemplos reales.
- TODO: definir politica de versionado (`/api/v1`, compatibilidad y deprecaciones).
