# Set de pruebas - Aurora

## 1. Introducción

Este documento registra la validación técnica y funcional básica de la aplicación Aurora. El alcance incluyó lectura de estructura, identificación de scripts, rutas API, variables de entorno, fuentes de datos, ejecución de comandos disponibles y validación manual de endpoints principales.

No se cambió la lógica funcional del sistema. Se ejecutó `npm install` en raíz, `backend/` y `frontend/`; ese comando dejó cambios en `backend/package-lock.json` y `frontend/package-lock.json`. También se ejecutó `npm run build` en `frontend/`, que regeneró el contenido de `frontend/dist`.

Después de la primera ejecución se ajustaron dos scripts de prueba: `backend/scripts/oracle-smoke.js` para cargar `backend/.env` y `backend/scripts/api-regression.js` para autenticarse antes de consultar rutas protegidas. Estos cambios no modifican reglas de negocio ni persistencia.

Actualización 2026-05-12: se hizo `git pull` y se incorporó la carpeta `documentacion/documentacion_tecnica/base_datos/`. Con esa documentación se dejó preparado un flujo de base Oracle de pruebas mediante `ORACLE_SCHEMA`, `backend/scripts/test-db/setup-test-db.js` y `backend/scripts/api-write-regression.js`. No se ejecutaron escrituras reales porque `.env.test` apuntaba efectivamente al esquema `DNDP`.

## 2. Ambiente de validación

| Elemento | Valor |
|---|---|
| Fecha de validación | 2026-05-12 |
| Sistema operativo | Linux localhost.localdomain 5.15.0-314.193.5.5.el9uek.x86_64 |
| Node.js | v20.19.6 |
| npm | 10.8.2 |
| Carpeta raíz | `/home/dndp/proyectos_dndp/aurora` |
| Carpetas incluidas | raíz, `backend/`, `frontend/`, `documentacion/soporte/`, `scripts/` |

Comandos de apoyo usados para inspección: `rg --files`, `find`, `sed`, `rg`, `git status`, `git check-ignore`, `git ls-files`, `ss`, `curl`, `node -v`, `npm -v`.

## 3. Estructura general del proyecto

El proyecto cuenta con una aplicación frontend en React + Vite y un backend en Node.js + Express.

| Carpeta / archivo | Descripción |
|---|---|
| `package.json` | Scripts generales de codificación y QA (`encoding:check`, `qa:smoke`). |
| `backend/` | API Express, rutas, servicios, middleware de autenticación y repositorios Oracle. |
| `backend/package.json` | Scripts `test`, `start`, `dev`, `smoke:oracle`, `test:api`. |
| `backend/index.js` | Configura Express, Helmet, CORS, rutas `/api`, frontend estático si existe build y puerto `PORT` o `7860`. |
| `backend/routes/` | Rutas `auth`, `health`, `ppl`, `defensores`, `formatos`. |
| `backend/db/oraclePool.js` | Pool Oracle y endpoint de salud DB mediante `SELECT 1 AS DB_OK FROM dual`. |
| `backend/data/` | Catálogo local de formatos: `formatos.mock.js`. |
| `frontend/` | Cliente React con páginas, componentes, servicios API y pruebas unitarias. |
| `frontend/package.json` | Scripts `dev`, `build`, `lint`, `preview`, `test`. |
| `frontend/vite.config.js` | Puerto por defecto `5174`, proxy `/api` y `/downloads` hacia `http://localhost:7860`. |
| `documentacion/soporte/` | Documentación técnica existente, incluyendo endpoints, estrategia de pruebas, Oracle y SSO. |

Variables de entorno usadas por el código: `PORT`, `NODE_ENV`, `ENABLE_STARTUP_WARMUP`, `CORS_ORIGIN`, `FORMATOS_BASE_URL`, `AUTH_*`, `AZURE_AD_*`, `AZURE_*`, `ORACLE_*`, `VITE_API_BASE_URL`, `VITE_DEV_API_TARGET`, `VITE_DEV_PORT`, `API_BASE_URL`.

## 4. Comandos ejecutados

| Carpeta | Comando | Resultado | Observación |
|---|---|---|---|
| raíz | `npm install` | Exitoso | Sin vulnerabilidades reportadas. |
| `backend/` | `npm install` | Exitoso | Sin vulnerabilidades reportadas. |
| `frontend/` | `npm install` | Exitoso | Sin vulnerabilidades reportadas; agregó 1 paquete según salida npm. |
| raíz | `npm run encoding:check` | Exitoso | 101 archivos UTF-8 sin patrón mojibake. |
| raíz | `npm run qa:smoke` | Exitoso | Ejecutó lint, tests, build frontend y test backend. |
| `backend/` | `npm test` | Exitoso | `auth-config checks passed`. |
| `backend/` | `npm run smoke:oracle` | Exitoso | Después del ajuste, carga `backend/.env` y valida Oracle con `DB_OK: 1`. |
| `backend/` | `npm start` | Exitoso | Backend levantó en `7860`; se validaron endpoints y luego se cerró el proceso iniciado. |
| `backend/` | `PORT=7861 npm run dev` | Exitoso | Nodemon levantó backend en `7861`; se validó `/api/health` y se cerró con `Ctrl+C`. |
| `backend/` | `API_BASE_URL=http://localhost:7861/api npm run test:api` | Exitoso | Después del ajuste, hace login local o usa `API_AUTH_TOKEN` y valida rutas protegidas de lectura. |
| raíz | `git pull --ff-only origin master` | Exitoso | Incorporó `documentacion/documentacion_tecnica/base_datos/` con diccionario, diagrama, log, documento explicativo y manual PDF del modelo. |
| `backend/` | `npm test` | Exitoso | Revalidado después del pull; `auth-config checks passed`. |
| `backend/` | `DOTENV_CONFIG_PATH=/home/dndp/proyectos_dndp/aurora/backend/.env.test npm --prefix backend run test-db:setup` | Fallido controlado | El script se negó a ejecutarse porque el esquema efectivo era `DNDP`; no se modificaron datos. |
| `backend/` | `DOTENV_CONFIG_PATH=/home/dndp/proyectos_dndp/aurora/backend/.env.test npm --prefix backend run smoke:oracle` | Exitoso | Validó conectividad Oracle con `DB_OK: 1` usando `.env.test`; no realiza escrituras. |
| `backend/` | `DOTENV_CONFIG_PATH=/home/dndp/proyectos_dndp/aurora/backend/.env.test npm --prefix backend start` | Exitoso | Backend levantó en `7862` con `.env.test`; al cerrar con `Ctrl+C` se observó un aviso `NJS-064: connection pool is closing`. |
| `backend/` | `DOTENV_CONFIG_PATH=/home/dndp/proyectos_dndp/aurora/backend/.env.test npm --prefix backend run test:api` | Exitoso | Validó `health`, `health/db`, listado PPL, detalle e historial con `.env.test`; solo lectura. |
| `backend/` | `node --check backend/scripts/test-db/setup-test-db.js` | Exitoso | Validación sintáctica del script de creación de base de pruebas. |
| `backend/` | `node --check backend/scripts/api-write-regression.js` | Exitoso | Validación sintáctica del script de regresión de escrituras. |
| `frontend/` | `npm run lint` | Exitoso | Sin errores reportados. |
| `frontend/` | `npm run test` | Exitoso | 4 archivos de prueba, 79 pruebas pasadas. |
| `frontend/` | `npm run build` | Exitoso con advertencia | Build generado; advertencia por chunk JS mayor a 500 kB. |
| `frontend/` | `npm run dev -- --host 127.0.0.1` | Fallido | Puerto `5174` ocupado por otro proceso Node. |
| `frontend/` | `VITE_DEV_PORT=5175 npm run dev -- --host 127.0.0.1` | Exitoso | Vite levantó en `http://127.0.0.1:5175/`; se validó HTML y proxy `/api/health`. |

## 5. Matriz de casos de prueba

| ID | Módulo | Tipo de prueba | Descripción | Pasos | Resultado esperado | Resultado obtenido | Estado | Observación |
|---|---|---|---|---|---|---|---|---|
| AUR-001 | Dependencias | Técnica | Instalar dependencias raíz | Ejecutar `npm install` | Instalación sin error | Exitoso, 0 vulnerabilidades | Aprobado | No hay dependencias directas en raíz. |
| AUR-002 | Dependencias backend | Técnica | Instalar dependencias backend | Ejecutar `npm install` en `backend/` | Instalación sin error | Exitoso, 0 vulnerabilidades | Aprobado | Lockfile quedó modificado por npm. |
| AUR-003 | Dependencias frontend | Técnica | Instalar dependencias frontend | Ejecutar `npm install` en `frontend/` | Instalación sin error | Exitoso, 0 vulnerabilidades | Aprobado | Lockfile quedó modificado por npm. |
| AUR-004 | Backend | Técnica | Ejecutar prueba automatizada backend | `npm test` | Checks de autenticación pasan | `auth-config checks passed` | Aprobado | Cubre configuración segura básica de auth. |
| AUR-005 | Frontend | Técnica | Ejecutar lint | `npm run lint` | Sin errores ESLint | Sin errores | Aprobado | Ejecutado también dentro de `qa:smoke`. |
| AUR-006 | Frontend | Técnica | Ejecutar pruebas unitarias | `npm run test` | Suite Vitest pasa | 4 archivos, 79 pruebas pasadas | Aprobado | Pruebas de reglas Aurora/Celeste y estados. |
| AUR-007 | Frontend | Técnica | Compilar aplicación | `npm run build` | Build generado | Build exitoso con advertencia de chunk > 500 kB | Aprobado con observación | Conviene revisar code splitting. |
| AUR-008 | Backend | Técnica | Levantar backend | `npm start` | Servidor escuchando | Servidor levantó en `7860` | Aprobado | Se cerró el proceso iniciado al finalizar. |
| AUR-009 | Backend | Técnica | Levantar backend en modo dev | `PORT=7861 npm run dev` | Nodemon ejecuta API | `/api/health` respondió 200 | Aprobado | Se usó `7861` para no depender de `7860`. |
| AUR-010 | Frontend | Técnica | Levantar frontend con puerto por defecto | `npm run dev -- --host 127.0.0.1` | Vite en `5174` | Falló: puerto ocupado | Fallido | Hay un proceso Node escuchando en `5174`. |
| AUR-011 | Frontend | Técnica | Levantar frontend en puerto alterno | `VITE_DEV_PORT=5175 npm run dev -- --host 127.0.0.1` | Vite responde HTML | HTTP 200 en `/` | Aprobado | Proxy `/api/health` también respondió 200. |
| AUR-012 | API | Funcional | Salud backend | `curl /api/health` | HTTP 200 con `ok: true` | HTTP 200, backend operativo | Aprobado | Ruta pública. |
| AUR-013 | API/DB | Técnica | Salud Oracle | `curl /api/health/db` | HTTP 200 si Oracle disponible | HTTP 200 con `DB_OK: 1` | Aprobado | Validado con backend cargando `.env`. |
| AUR-014 | API/Auth | Funcional | Configuración de auth | `curl /api/auth/config` | JSON de configuración | Local admin habilitado, Azure AD no configurado | Aprobado con observación | En desarrollo se aceptaron credenciales por defecto. |
| AUR-015 | API/Auth | Seguridad | Acceso sin token a ruta protegida | `curl /api/ppl/condenados?limit=1` sin token | HTTP 401 | HTTP 401 `AUTH_REQUIRED` | Aprobado | Confirma protección de rutas de negocio. |
| AUR-016 | API/PPL | Funcional | Listado de condenados autenticado | Login local, luego `GET /api/ppl/condenados?limit=2` | HTTP 200 con filas | HTTP 200, 2 filas, `totalAvailable: 85327` | Aprobado | No se incluye token en este documento. |
| AUR-017 | API/PPL | Funcional | Consulta por documento | `GET /api/ppl/1000000256` con token | Registro encontrado | HTTP 200, tipo `condenado` | Aprobado | Documento usado solo para prueba de lectura. |
| AUR-018 | API/PPL | Funcional | Registro no encontrado | `GET /api/ppl/000000000000000000` con token | HTTP 404 | HTTP 404 `No encontrado` | Aprobado | Manejo básico correcto. |
| AUR-019 | API/PPL | Funcional | Historial de actuaciones | `GET /api/ppl/1000000256/actuaciones` con token | HTTP 200 con historial | HTTP 200 con arreglo de actuaciones | Aprobado | Prueba de lectura. |
| AUR-020 | API/PAG | Funcional | Validar cédula PAG | `GET /api/ppl/pag/12693216/validar` con token | PAG válido o error controlado | HTTP 200 con `ok: true` | Aprobado | Valida consulta contra fuente Oracle. |
| AUR-021 | API/Defensores | Funcional | Listar defensores | `GET /api/defensores` con token | HTTP 200 | HTTP 200 con catálogo grande | Aprobado | Respuesta extensa desde Oracle. |
| AUR-022 | API/Defensores | Funcional | Listar defensores desde condenados | `GET /api/defensores?source=condenados` con token | HTTP 200 | HTTP 200 con lista vacía | Aprobado con observación | No se validó si la lista vacía es esperada por datos actuales. |
| AUR-023 | API/Formatos | Funcional | Listar formatos | `GET /api/formatos` con token | HTTP 200 con formatos | HTTP 200 con 10 formatos | Aprobado | Fuente `formatos.mock.js`. |
| AUR-024 | API/Formatos | Funcional | Descargar formato existente | `GET /api/formatos/f1/download` con token | Redirección o archivo | HTTP 302 a `FORMATOS_BASE_URL` | Aprobado | No se descargó el archivo final. |
| AUR-025 | API/Formatos | Funcional | Formato inexistente | `GET /api/formatos/no-existe/download` con token | HTTP 404 | HTTP 404 `Formato no encontrado` | Aprobado | Manejo correcto. |
| AUR-026 | API | Técnica | Script de regresión API | `API_BASE_URL=http://localhost:7861/api npm run test:api` | Todos los checks pasan | Checks HTTP 200 para `health`, `health/db`, listado PPL, documento e historial | Aprobado | El script ahora autentica solicitudes protegidas. |
| AUR-027 | Formularios | Funcional | Edición de información | PUT/POST de negocio | Persistencia controlada | No ejecutado | No ejecutado | No se hicieron escrituras sobre Oracle para no alterar datos. |
| AUR-028 | Seguridad | Técnica | Revisión básica de archivos sensibles | `git check-ignore`, `git ls-files`, búsqueda de `.env` | `.env` no versionado | `backend/.env` ignorado; solo `.env.example` versionado | Aprobado | No se deben versionar exportaciones con datos personales. |
| AUR-029 | Base de datos | Técnica | Revisar documentación nueva de BD | Revisar `documentacion/documentacion_tecnica/base_datos/` | Identificar tablas y objetos relevantes | Se identificaron 12 tablas principales, vista y procedimientos mencionados en manual/documento | Aprobado | No se encontró `BD.sql` ejecutable en la carpeta recibida. |
| AUR-030 | Base de datos | Técnica | Preparar esquema Oracle de pruebas | Crear script con tablas y semilla controlada | Script disponible sin tocar producción | Se creó `backend/scripts/test-db/setup-test-db.js` | Aprobado | Crea las 12 tablas del diccionario y una semilla pequeña para pruebas de integración. |
| AUR-031 | Base de datos | Seguridad | Evitar escrituras sobre esquema operativo | Ejecutar `test-db:setup` con `.env.test` actual | Debe bloquearse si el destino es `DNDP` | Falló de forma controlada con `TEST_DB_REFUSED_DNDP_SCHEMA` | Aprobado | No se modificaron datos. |
| AUR-032 | API/DB | Funcional | Preparar regresión de escrituras | Crear script de prueba para `PUT`, `POST actuaciones`, `POST defensores` y asignación | Script disponible para base temporal | Se creó `backend/scripts/api-write-regression.js` | Pendiente de ejecución | Requiere `ORACLE_SCHEMA` distinto a `DNDP` y backend levantado con `.env.test`. |
| AUR-033 | Configuración | Técnica | Validar variables de `.env.test` sin exponer valores | Revisar presencia de variables | Variables críticas configuradas | `PORT`, `ORACLE_*`, `AUTH_*` presentes; `ORACLE_SCHEMA` ausente | Aprobado con observación | Al faltar `ORACLE_SCHEMA`, el esquema efectivo queda como `ORACLE_USER`. |

## 6. Pruebas de backend y API

Endpoints incluidos:

| Método | Ruta | Protección | Resultado |
|---|---|---|---|
| GET | `/api/health` | Pública | Validada, HTTP 200. |
| GET | `/api/health/db` | Pública | Validada, HTTP 200 con Oracle disponible. |
| GET | `/api/auth/config` | Pública | Validada, HTTP 200. |
| POST | `/api/auth/login` | Pública con rate limit | Validada con login local de desarrollo. |
| POST | `/api/auth/azure-ad` | Pública con rate limit | Pendiente de validación con Azure AD configurado. |
| GET | `/api/auth/me` | Requiere token | Validada con token local. |
| GET | `/api/ppl` | Requiere token | Detectada; no se ejecutó listado general por volumen de datos. |
| GET | `/api/ppl/condenados` | Requiere token | Validada con `limit=2`. |
| GET | `/api/ppl/condenados/filter-options` | Requiere token | Validada; respuesta extensa. |
| GET | `/api/ppl/pag/:cedula/validar` | Requiere token | Validada con una cédula presente en datos. |
| POST | `/api/ppl/asignar-defensor` | Requiere token | No ejecutada para evitar escritura. |
| GET | `/api/ppl/:documento` | Requiere token | Validada para encontrado y no encontrado. |
| PUT | `/api/ppl/:documento` | Requiere token | No ejecutada para evitar escritura. |
| GET | `/api/ppl/:documento/actuaciones` | Requiere token | Validada. |
| POST | `/api/ppl/:documento/actuaciones` | Requiere token | No ejecutada para evitar escritura. |
| GET | `/api/defensores` | Requiere token | Validada. |
| POST | `/api/defensores` | Requiere token | No ejecutada para evitar escritura. |
| GET | `/api/formatos` | Requiere token | Validada. |
| GET | `/api/formatos/:id/download` | Requiere token | Validada para existente e inexistente. |

El script `npm run test:api` inicialmente falló porque consultaba `/ppl/condenados` sin token. Se ajustó `backend/scripts/api-regression.js` para obtener un token mediante `/auth/login` o aceptar `API_AUTH_TOKEN` desde el entorno. Después del ajuste, la regresión API pasó contra el backend levantado en `7861`.

Para pruebas de escritura no se recomienda usar la base Oracle operativa. La alternativa técnica más limpia es un esquema Oracle temporal con las mismas tablas mínimas y variables `ORACLE_*` apuntando a ese esquema.

Después del pull se dejó implementado el soporte para esa alternativa de esquema temporal. El backend ahora puede reemplazar las referencias `DNDP.` por el valor de `ORACLE_SCHEMA` al ejecutar SQL. El script `npm --prefix backend run test-db:setup` crea las 12 tablas documentadas, valida columnas esperadas y carga datos semilla de prueba, pero se bloquea si el destino efectivo es `DNDP`. El bloqueo se activó correctamente porque `.env.test` no tenía `ORACLE_SCHEMA` y por tanto el destino era `DNDP`.

Comandos preparados para ejecutar cuando exista un esquema temporal, por ejemplo `DNDP_TEST`:

```bash
DOTENV_CONFIG_PATH=/home/dndp/proyectos_dndp/aurora/backend/.env.test npm --prefix backend run test-db:setup
DOTENV_CONFIG_PATH=/home/dndp/proyectos_dndp/aurora/backend/.env.test npm --prefix backend run test:api
DOTENV_CONFIG_PATH=/home/dndp/proyectos_dndp/aurora/backend/.env.test npm --prefix backend run test:api:write
```

## 7. Pruebas de frontend

El frontend cuenta con React 19, Vite 7 y Vitest. Se identificaron páginas principales: `Home`, `LoginPage`, `AsignacionDefensores`, `RegistrosAsignados`, `FormularioAtencion`, `CajaHerramientas` y `ManualInteractivo`.

Las pruebas automatizadas frontend pasaron: 4 archivos y 79 pruebas. La cobertura se concentra en reglas de formulario Aurora/Celeste y reglas de estado de actuaciones.

El build fue satisfactorio para esta etapa. La única observación fue la advertencia de Vite por un chunk JavaScript de 607.35 kB después de minificación. No bloquea el build, pero conviene revisar carga diferida de rutas o separación de chunks antes de despliegues con mayor tráfico.

La ejecución de `npm run dev` con el puerto por defecto falló porque `5174` ya estaba ocupado. Al usar `VITE_DEV_PORT=5175`, Vite respondió correctamente y el proxy `/api/health` devolvió la respuesta del backend.

## 8. Revisión básica de seguridad

- Existe `.env.example`.
- `backend/.env` está incluido en `backend/.gitignore`; `git check-ignore` confirmó que se ignora.
- `git ls-files` mostró versionado `.env.example`, pero no `backend/.env`.
- No hay `.gitignore` en la raíz; existen `.gitignore` en `backend/` y `frontend/`.
- Existe un archivo real `backend/.env` en el entorno local. No se publican sus valores en este documento.
- Existe `backend/.env.test`. Se validó solo la presencia de variables, sin publicar valores.
- `backend/.env.test` no define `ORACLE_SCHEMA`; con la configuración actual el esquema efectivo de prueba queda como `DNDP`, por lo que no se ejecutaron escrituras.
- El `.env` local contiene variables Oracle y de puerto, pero no contiene variables `AUTH_*`. En modo desarrollo eso permitió login local con credenciales por defecto del servicio.
- El código usa Helmet, deshabilita `x-powered-by`, aplica CORS configurable, limita JSON a `256kb`, protege rutas de negocio con JWT y aplica rate limit en login.
- No se deben versionar exportaciones con datos personales o institucionales. Cualquier insumo de prueba debe ser anónimo y controlado.
- `.env.example` contiene valores de ejemplo para autenticación y Oracle. Antes de compartir o desplegar, se deben reemplazar secretos, evitar credenciales por defecto y validar que el archivo de ejemplo no contenga datos operativos reales.
- La validación SSO Azure AD requiere configurar `AZURE_AD_TENANT_ID` y `AZURE_AD_CLIENT_ID`.
- El análisis completo de exposición histórica de secretos en Git debe ejecutarse como una actividad específica de seguridad.

Recomendaciones antes de compartir el repositorio privado:

1. Confirmar que `backend/.env` nunca se agregue al control de versiones.
2. Mantener fuera del repositorio exportaciones o respaldos con datos personales.
3. Definir `AUTH_JWT_SECRET`, `AUTH_LOCAL_ADMIN_ENABLED=false` o credenciales no predeterminadas para ambientes no locales.
4. Configurar Azure AD si el ingreso institucional es obligatorio.
5. Revisar el estado de `node_modules` y lockfiles antes de entregar el repositorio; el working tree ya tenía múltiples cambios previos.

## 9. Hallazgos

- El proyecto tiene frontend y backend separados, con scripts independientes y un script de humo general en raíz.
- La conexión Oracle fue validada por `/api/health/db` con respuesta `DB_OK: 1`.
- `npm run smoke:oracle` fue ajustado y valida Oracle cargando `backend/.env`.
- `npm run test:api` fue ajustado y valida rutas protegidas de lectura con autenticación.
- El frontend compila y prueba correctamente, con advertencia de tamaño de bundle.
- El puerto frontend por defecto `5174` estaba ocupado durante la validación.
- Los datos operativos deben mantenerse en Oracle y fuera del repositorio.
- No se ejecutaron operaciones de escritura sobre Oracle.
- La carpeta `documentacion/documentacion_tecnica/base_datos/` documenta el modelo DNDP, pero no incluye un script `BD.sql` listo para crear todos los objetos.
- Se dejó preparado un setup de base de pruebas y una regresión de escrituras, pendientes de ejecución contra un esquema temporal distinto a `DNDP`.

## 10. Recomendaciones

1. Crear un ambiente de datos temporal para pruebas de escritura: preferiblemente un esquema Oracle de pruebas; como alternativa local, repositorios mock con fixtures.
2. Definir `ORACLE_SCHEMA` en `backend/.env.test` con un esquema temporal, por ejemplo `DNDP_TEST`, antes de ejecutar `test-db:setup` o `test:api:write`.
3. Agregar pruebas de integración para rutas Express con autenticación, incluyendo casos 401, 404 y errores de validación.
4. Ejecutar `test:api:write` solo después de confirmar que el backend está levantado con `.env.test` y que el esquema efectivo no es `DNDP`.
5. Revisar el tamaño del bundle frontend y considerar `import()` por rutas o `manualChunks`.
6. Definir un `.env.example` de frontend si se espera configurar `VITE_API_BASE_URL`, `VITE_DEV_API_TARGET` o `VITE_DEV_PORT`.
7. Revisar la política de versionamiento de datos antes de compartir el repositorio.
8. Resolver o documentar los cambios existentes del working tree, especialmente `node_modules`, lockfiles y archivos de documentación.

## 11. Conclusión

El resultado fue satisfactorio para esta etapa técnica: instalación, lint, pruebas frontend, build, prueba backend, arranque de servicios y endpoints principales de lectura respondieron correctamente. Las fallas encontradas en scripts auxiliares fueron ajustadas y validadas. Las operaciones de escritura no se ejecutaron porque el ambiente de prueba aún apunta al esquema `DNDP`; quedó preparado el flujo para repetirlas cuando exista un esquema temporal aislado.

## 12. Actualización 2026-05-14 - estados, historial y documentación

Cambios validados:

- `HistorialActuacionesPPL.jsx` recalcula la actuación activa con el registro vivo del formulario.
- `AsignacionDefensores.jsx` muestra `Acción a impulsar` usando el derivador central `getEstadoDisplayInfo`.
- `.gitignore` y `.dockerignore` excluyen `.cleanup-backups/` para evitar versionar o empaquetar respaldos operativos locales.
- Documentación técnica y de despliegue actualizada para reflejar el cálculo centralizado de estados y la dockerización vigente.

Comandos ejecutados:

```bash
npm --prefix frontend run test -- estadoActuaciones.rules.test.ts evaluateAuroraRules.test.ts
npm --prefix frontend run build
```

Resultado:

- Pruebas frontend focalizadas: 2 archivos, 62 pruebas aprobadas.
- Build frontend: exitoso. Se mantiene advertencia no bloqueante de bundle principal mayor a 500 kB.

## 13. Actualización 2026-05-15 - PWA y cola offline

Cambios validados:

- Manifest PWA con `id`, `scope`, `lang`, `display: standalone` e iconos `any maskable`.
- Service worker `aurora-shell-v2` con precache de shell y assets hash de Vite inyectados al finalizar `npm run build`.
- Cola offline en IndexedDB para escrituras controladas: `PUT /api/ppl/:documento`, `POST /api/ppl/:documento/actuaciones`, `POST /api/ppl/asignar-defensor` y `POST /api/defensores`.
- Reintentos diferidos con Background Sync cuando el navegador lo soporte y respaldo por evento `online`.
- Limites de carga: 75 solicitudes pendientes y 256 KB maximos por cuerpo; las consultas `GET /api` siguen fuera de cache.
- Documentacion agregada en `documentacion/soporte/operacion/15_pwa_operacion_offline.md` y manual tecnico actualizado.

Comandos ejecutados:

```bash
npm --prefix frontend run test -- pwaConfig.test.ts
npm --prefix frontend run lint
npm --prefix frontend run test
npm --prefix frontend run build
npm --prefix backend test
npm run qa:smoke
node --check frontend/public/service-worker.js
node --check frontend/dist/service-worker.js
```

Resultado:

- Prueba PWA focalizada: 1 archivo, 3 pruebas aprobadas.
- Suite frontend completa: 5 archivos, 84 pruebas aprobadas.
- Lint frontend: exitoso.
- Build frontend: exitoso; `[pwa] Assets precacheados en service-worker.js: 2`.
- Test backend: `auth-config checks passed`.
- Smoke general: exitoso. Se mantiene advertencia no bloqueante de Vite por bundle principal mayor a 500 kB.
