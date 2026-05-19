# AURORA - API Endpoints

## 1. Base URL

- Default local: `http://localhost:7860/api`
- Fuente: `backend/index.js` y `frontend/src/services/api.js`

## 2. Salud

| Metodo | Path | Descripcion |
|---|---|---|
| GET | `/health` | Verificacion operativa del backend |

Respuesta actual: `{ ok: true, message: "Backend AURORA operativo (modo ORACLE v2 híbrido)" }`.

## 3. Autenticacion

| Metodo | Path | Uso |
|---|---|---|
| GET | `/auth/config` | Publica si login local y Azure AD estan habilitados |
| POST | `/auth/login` | Login local temporal. Body: `{ "username": "...", "password": "..." }` |
| POST | `/auth/azure-ad` | Valida `idToken` de Microsoft identity platform y emite JWT de AURORA |
| GET | `/auth/me` | Devuelve usuario autenticado |

Notas de seguridad:

- `/ppl`, `/formatos` y `/defensores` requieren `Authorization: Bearer <token>`.
- En `NODE_ENV=production`, el login local queda deshabilitado por defecto si `AUTH_LOCAL_ADMIN_ENABLED` no esta definido.
- En produccion, `AUTH_JWT_SECRET` debe estar configurado con un secreto fuerte; no se acepta el placeholder del ejemplo.

## 4. PPL

| Metodo | Path | Uso |
|---|---|---|
| GET | `/ppl` | Listado de registros. Query opcional `tipo=condenado|sindicado` |
| GET | `/ppl/condenados` | Listado mapeado para tablas de asignacion. Query opcional `tipo=condenado|sindicado|all` (default: `condenado`) |
| GET | `/ppl/condenados/filter-options` | Opciones para filtros de asignacion: departamentos, municipios, lugares y defensores |
| GET | `/ppl/:documento` | Consulta unificada por documento |
| PUT | `/ppl/:documento` | Actualiza registro (body libre o `{ data }`) |
| GET | `/ppl/:documento/actuaciones` | Historial de actuaciones por documento |
| POST | `/ppl/:documento/actuaciones` | Crea nueva actuacion persistida |

Errores observables:

- `404` cuando documento no existe.
- `400` en creacion de actuacion si backend no puede construir la nueva fila.

Regla funcional (blindaje):

- `GET /api/ppl/condenados` sin query `tipo` debe excluir registros de tipo `sindicado`.
- `PAG - Asignacion de casos de condenados` debe consumir esta ruta sin `tipo` para mantener contrato estricto (solo `condenado`).
- `Usuarios asignados` puede consumir la misma ruta con `tipo=all` para mostrar `condenado` + `sindicado` sin afectar PAG.

Filtros relevantes de `/ppl/condenados`:

- `documento`, `departamento`, `municipio`, `lugar`, `defensor`, `estadoAccion`, `estado`.
- `potencialSubrogado=potenciales_beneficiarios`: usa `SITUACION_CARCELARIA.CATEGORIZACION` y agrupa `Prision Domiciliaria y Libertad condicional`, `Prision Domiciliaria`, `Revisar por pena`, `Libertad condicional` y `Utilidad Publica`.
- `potencialSubrogado=proximos_requisito_temporal`: agrupa `Preliminar Prision Domiciliaria` y `Preliminar Libertad condicional`.
- `potencialSubrogado=no_reunen_requisitos`: excluye las categorias anteriores.

Notas de estado:

- `estadoSource` resume campos usados por frontend para derivar la etiqueta de estado con `getEstadoDisplayInfo`.
- `accionImpulsar` puede venir vacío o con valor histórico; la UI debe preferir el estado derivado para mostrar "Acción a impulsar".
- `PUT /ppl/:documento` con `actuacionId` actualiza esa actuación. Sin `actuacionId`, el backend usa la actuación más reciente como fallback.

## 5. Defensores

| Metodo | Path | Uso |
|---|---|---|
| GET | `/defensores` | Lista desde `DNDP.DEFENSORES` |
| GET | `/defensores?source=condenados` | Lista deduplicada desde asignaciones vigentes de PPL condenadas en Oracle |
| POST | `/defensores` | Crea defensor en `DNDP.DEFENSORES` (body: `{ "cedula": "123", "nombre": "NOMBRE COMPLETO" }`) |

Errores observables:

- `400` si `nombre` no viene o contiene caracteres diferentes a letras y espacios.
- `409` si el defensor ya existe en el catalogo Oracle o en asignaciones vigentes de condenados.
- `500` para errores no controlados de persistencia.

## 6. Formatos

| Metodo | Path | Uso |
|---|---|---|
| GET | `/formatos` | Lista de formatos mock |
| GET | `/formatos/:id/download` | Descarga archivo por id |

Errores observables:

- `404` si `id` no existe en mock.
- `404` si el formato no existe.

## 7. Notas de contrato actuales

- La API responde JSON para rutas `/api/*`.
- El endpoint de descarga redirige al `downloadUrl` configurado para cada formato.

## 8. Administración de cargas staging/ETL

Base: `/api/admin/cargas`.

Todas las rutas requieren token y rol autorizado (`admin`, `carguebd` o `cargas_bd`, configurable con `CARGUEBD_ADMIN_ROLES`).

| Metodo | Path | Uso |
|---|---|---|
| GET | `/admin/cargas/fuentes` | Lista fuentes habilitadas: PONAL, SISIPEC y Aurora 1.0 |
| GET | `/admin/cargas` | Lista registros de carga y estado |
| GET | `/admin/cargas/:id` | Consulta una carga puntual |
| GET | `/admin/cargas/:id/log` | Descarga/consulta el log plano de la carga |
| POST | `/admin/cargas` | Recibe `multipart/form-data` con `fuente` y `archivo` `.xlsx` |
| POST | `/admin/cargas/:id/retry` | Reintenta una carga fallida o interrumpida |

Estados devueltos:

- `recibido`
- `en_ejecucion`
- `exitoso`
- `fallido`

Errores observables:

- `400` si falta archivo, la fuente no es válida o el archivo no es `.xlsx`.
- `403` si el usuario no tiene rol autorizado.
- `404` si la carga no existe.
- `409` si una fuente está deshabilitada por configuración.

Más detalle: [Cargas mensuales de staging y ETL a Oracle](./16_cargas_staging_etl_bd.md).

## 9. Pendientes de contrato API

- Definir contrato formal OpenAPI con esquemas de request/response.
- Documentar codigos de error por endpoint con ejemplos reales.
- Definir politica de versionado (`/api/v1`, compatibilidad y deprecaciones).
