# Manual técnico de Aurora

> Estado documental: vigente al 2026-07-30.

## Manual técnico Aurora

Fecha: 2026-07-30

## Introducción

Este manual integra el conocimiento técnico de Aurora requerido para instalación, despliegue, mantenimiento y validación. La estructura, rutas, variables y comportamientos corresponden al código vigente.

## Objetivo del sistema

Aurora apoya la gestión de atención jurídica de personas privadas de la libertad. Desde el código se observan funciones de consulta, formulario de atención, gestión de actuaciones, asignación de defensores, validación PAG y descarga de formatos.

## Tecnologías utilizadas

| Capa | Tecnología |
| --- | --- |
| Frontend | React, Vite, JavaScript/TypeScript, PWA |
| Backend | Node.js, Express |
| Autenticación | JWT Aurora, Microsoft Entra ID, LDAP/LDAPS y login local temporal |
| Base de datos | Oracle mediante oracledb |
| Datos complementarios | Catálogo local de formatos |
| Cargas ETL | Python (pandas, openpyxl, oracledb) orquestado desde backend |
| Pruebas | Vitest, scripts Node |
| Despliegue | Docker Compose como camino principal |

## Arquitectura general

Usuario -> Frontend React -> Backend Express /api -> Oracle

En producción, el backend puede servir el frontend compilado. El despliegue Docker usa un contenedor único que compila frontend/ y copia dist a backend/public/app.

### Flujo técnico de alto nivel

1. El usuario ingresa al frontend React y obtiene la configuración de autenticación desde /api/auth/config.

2. El usuario inicia sesión mediante Microsoft Entra ID, LDAP/LDAPS o, en una contingencia habilitada, usuario local administrativo.

3. El backend valida la identidad y emite un JWT propio de Aurora. Ese token se usa como Bearer en las rutas protegidas.

4. El frontend consulta personas privadas de la libertad, registros asignados, formatos y defensores a través de /api.

5. El backend accede a Oracle mediante repositorios especializados y normaliza datos de origen para exponer una respuesta estable al frontend.

6. El formulario de atención aplica reglas de negocio en cliente para visibilidad, obligatoriedad, dependencias, estado del trámite y cierre del caso.

7. Al guardar, el backend persiste los cambios funcionales y el historial de actuaciones en Oracle.

8. El módulo administrativo de cargas almacena archivos Excel en un directorio controlado, ejecuta la carga Python en segundo plano y registra estado/logs para seguimiento operativo.

### Componentes principales

| Componente | Ruta | Responsabilidad |
| --- | --- | --- |
| Entrada backend | backend/index.js | Configura Express, seguridad HTTP, CORS, rutas, frontend estático y cierre ordenado. |
| Autenticación | backend/services/authService.js, backend/middleware/auth.js | Valida Azure AD o usuario local, firma JWT interno y protege rutas. |
| API funcional PPL | backend/routes/ppl.js | Consulta, filtros, detalle, actuaciones, asignación de defensor y validación PAG. |
| API defensores | backend/routes/defensores.js | Lista y registra defensores. |
| API formatos | backend/routes/formatos.js | Lista formatos y resuelve URLs de descarga. |
| API cargas BD | backend/routes/adminCargas.js, backend/services/cargaBdService.js | Recibe archivos, controla trabajos, historial y logs de cargas. |
| Repositorios Oracle | backend/repositories/oracle/, backend/db/ | Encapsulan SQL, pool Oracle y normalización de resultados. |
| Formulario atención | frontend/src/pages/FormularioAtencion.jsx | Renderiza flujo de atención y guarda actuaciones. |
| Reglas Aurora | frontend/src/config/formRules.aurora.ts, frontend/src/utils/evaluateAuroraRules.ts | Define reglas de condenados: bloques, dependencias, estados y cierre. |
| Reglas Sindicados | frontend/src/config/formRules.celeste.ts, frontend/src/utils/evaluateCelesteRules.ts | Define reglas de sindicados: bloques, estados y cierre. |
| Estado actuaciones | frontend/src/config/estadoActuaciones.rules.ts | Unifica etiqueta visual, semáforo y estado lógico mostrado en listados/historial. |
| PWA | frontend/public/service-worker.js, frontend/public/manifest.json | Cache del shell, soporte offline acotado y reintentos de escrituras permitidas. |
| Usuarios autorizados | backend/routes/adminUsers.js, backend/services/userDirectoryService.js, frontend/src/pages/AdminUsuarios.jsx | Directorio interno, roles, estado e importación CSV. |
| Autenticación LDAP | backend/services/ldapAuthService.js | Bind directo contra Active Directory y validación de dominios. |
| Depuración controlada | backend/services/actuacionCleanupService.js, backend/repositories/oracle/actuacionCleanupRepository.js | Vista previa, transacción y auditoría de datos ficticios acotados. |
| Manual interactivo | backend/tutorial-videos/, frontend/src/pages/ManualInteractivo.jsx | Tres tutoriales locales con verificación SHA-256 durante el build. |

## Estructura del proyecto

| Ruta | Uso |
| --- | --- |
| frontend/ | Interfaz de usuario. |
| backend/ | API y acceso a datos. |
| scripts/cargas_bd/ | Servicios de carga Excel hacia staging Oracle y ejecución ETL. |
| documentacion/documentacion_word/ | Entregables de origen en formato Word. |
| documentacion/documentación .md/ | Equivalentes Markdown actualizados y recursos gráficos. |
| documentacion/documentacion_tecnica/ | Guía técnica local complementaria. |
| VALIDACION_DESPLIEGUE_TICS.md | Lista operativa de validación institucional. |

## Configuración del backend

El backend se inicia desde backend/index.js. Carga variables con dotenv, usando DOTENV_CONFIG_PATH si se define o backend/.env por defecto.

Funciones principales:

- Configuración de Helmet.

- Configuración de CORS.

- Límite JSON de 256kb.

- Rutas públicas de salud y autenticación.

- Rutas protegidas de negocio.

- Rutas administrativas para carga mensual de archivos Excel a staging/ETL.

- Servicio estático de frontend compilado.

- Cierre ordenado del pool Oracle.

### Seguridad HTTP y CORS

El backend aplica helmet y deshabilita x-powered-by. La política CSP restringe carga de scripts y estilos al mismo origen, permite conexión a Microsoft para autenticación y bloquea frame-ancestors. El CORS se resuelve por solicitud:

- Si no existe encabezado Origin, la solicitud se acepta.

- Si el origen coincide con el mismo host calculado por proxy, se acepta.

- Si el origen aparece en CORS_ORIGIN, se acepta.

- En desarrollo, si no se configuró lista explícita, se permite el origen.

- En producción, los orígenes no autorizados se rechazan.

El tamaño máximo del cuerpo JSON está limitado a 256kb, lo cual reduce riesgo de cargas accidentales por rutas transaccionales.

### Autenticación y roles

Aurora usa dos niveles de autenticación:

1. Validación de identidad externa o local.

2. Emisión de token interno de aplicación.

En Azure AD, el backend valida el idToken con JWKS de Microsoft, verifica tenant, audience e issuer, y opcionalmente valida dominios, grupos o roles requeridos. En autenticación local, el usuario administrativo solo se permite si AUTH_LOCAL_ADMIN_ENABLED lo habilita; en producción no se admiten credenciales por defecto.

El token interno se firma con AUTH_JWT_SECRET, algoritmo HS256, issuer y audience configurables. La duración estándar se controla con AUTH_TOKEN_TTL y la sesión recordada con AUTH_REMEMBER_TOKEN_TTL.

Roles funcionales:

| Rol | Uso técnico |
| --- | --- |
| user | Consulta, formularios, historial, PDF, formatos y operación ordinaria. |
| pag | Validación PAG, asignación/reasignación y creación de defensores. |
| admin | Administración del directorio interno y accesos PAG. |
| carguebd / cargas_bd | Operación de cargas y depuración cuando están incluidos en `CARGUEBD_ADMIN_ROLES`. |

Las rutas administrativas y PAG aplican validación específica de rol. La ocultación de una pantalla no sustituye esta autorización.

`AUTH_USER_ACCESS_MODE=open` registra cuentas válidas aceptadas por el proveedor; `managed` exige que estén habilitadas en el directorio interno. El middleware vuelve a consultar estado y roles, de modo que una deshabilitación administrativa no espera a que expire el JWT.

## Configuración del frontend

El frontend está en frontend/ y se compila con Vite.

Variables relevantes:

- VITE_API_BASE_URL

- VITE_DEV_API_TARGET

- VITE_DEV_PORT

En desarrollo, Vite usa proxy para /api. En producción con el backend como servidor único, se recomienda VITE_API_BASE_URL=/api.

### Organización funcional del frontend

| Pantalla | Ruta fuente | Descripción técnica |
| --- | --- | --- |
| Inicio | frontend/src/pages/Home.jsx | Panel de entrada a módulos principales. |
| Login | frontend/src/pages/LoginPage.jsx | Obtiene configuración de autenticación, invoca Azure AD o login local y almacena sesión. |
| Registros asignados | frontend/src/pages/RegistrosAsignados.jsx | Consulta listados, filtros y estados de actuación. |
| Formulario de atención | frontend/src/pages/FormularioAtencion.jsx | Orquesta captura progresiva, reglas de negocio, validación y guardado. |
| Asignación defensores | frontend/src/pages/AsignacionDefensores.jsx | Gestiona asignación y usa estado derivado para acción a impulsar. |
| Cargas BD | frontend/src/pages/AdminCargasBD.jsx | UI administrativa para subir archivos, consultar estado, logs y reintentar trabajos. |
| Caja de herramientas | frontend/src/pages/CajaHerramientas.jsx | Acceso a formatos y recursos de apoyo. |
| Manual interactivo | frontend/src/pages/ManualInteractivo.jsx | Consulta de ayuda funcional dentro de la aplicación. |

### Estados e historial de actuaciones

- frontend/src/config/estadoActuaciones.rules.ts es el punto común para derivar la Acción a impulsar.

- FormularioAtencion.jsx sincroniza la Acción a impulsar al guardar. El backend la persiste en `DNDP.GESTION_JURIDICA.ACCION_REALIZAR`; los nombres Estado del trámite y Estado del caso se conservan únicamente como compatibilidad interna con datos legados.

- HistorialActuacionesPPL.jsx recalcula la fila activa con el registro vivo del formulario, por lo que la UI puede mostrar cambios de estado antes de guardar o recargar.

- AsignacionDefensores.jsx usa el mismo derivador para Acción a impulsar.

- RegistrosAsignados.jsx no presenta un campo separado de Estado de reclusión. Una situación vigente inactiva se expresa como `Caso cerrado` en Acción a impulsar y se conserva en modo de solo lectura.

- La procedencia de utilidad pública es opcional y su ausencia no bloquea el guardado ni el cálculo de la acción. Ante una decisión negativa con la respuesta de recurso aún vacía, la acción es `Presentar recurso`; solo una respuesta explícita `No` cierra el caso.

### PWA y operacion offline

Aurora incluye manifest y service worker de produccion. El build de frontend ejecuta frontend/scripts/inject-pwa-assets.mjs para precachear los assets hash generados por Vite en dist/assets.

El service worker cachea el shell de la aplicacion y excluye las consultas /api para evitar datos de negocio obsoletos. Las escrituras criticas se pueden guardar en una cola IndexedDB acotada y reintentar con Background Sync o cuando el navegador emite online.

Escrituras cubiertas:

- PUT /api/ppl/:documento

- POST /api/ppl/:documento/actuaciones

- POST /api/ppl/asignar-defensor

- POST /api/defensores

Limites de la cola:

- Maximo 75 solicitudes pendientes.

- Maximo 256 KB por cuerpo.

- El token de autenticacion se mantiene en memoria del service worker y no se persiste en IndexedDB.

Cada elemento de cola conserva un identificador de propietario derivado de la sesión. El logout o cambio de identidad elimina operaciones pendientes ajenas, lo que impide reutilizar escrituras entre usuarios del mismo navegador.

## Configuración de base de datos

La conexión Oracle se configura en backend/config/oracle.js y backend/db/oraclePool.js.

Variables requeridas:

- ORACLE_USER

- ORACLE_PASSWORD

- ORACLE_HOST

- ORACLE_PORT

- ORACLE_SERVICE_NAME

- ORACLE_SCHEMA

El backend reemplaza referencias DNDP. por el esquema configurado en ORACLE_SCHEMA. Si no se define, usa ORACLE_USER.

### Acceso a datos y normalización

El acceso a Oracle está separado en repositorios para evitar SQL disperso en las rutas:

- oraclePool.js: creación, reutilización y cierre del pool.

- oracleConsolidado.repo.js: consulta consolidada y utilidades de normalización de columnas.

- personaRepository.js: detalle y persistencia de datos asociados a persona/documento.

- gestionRepository.js: actuaciones e historial.

- asignacionRepository.js: asignación de defensores.

- pagRepository.js: validación contra PAG.

- defensoresRepository.js: catálogo y alta de defensores.

- calificacionConductaRepository.js y situacionRepository.js: datos complementarios usados en el formulario.

El backend trabaja con datos heredados que pueden llegar con nombres de columnas, acentos o codificaciones diferentes. Por esa razón varias capas aplican normalización tolerante de texto, fallback entre nombres equivalentes y mapeo a nombres canónicos antes de exponer datos al frontend.

### Modelo lógico usado por la aplicación

Aunque el modelo físico reside en Oracle, Aurora opera sobre estos conceptos funcionales:

| Concepto | Uso en Aurora |
| --- | --- |
| Persona privada de la libertad | Registro principal consultado por documento, nombre, ubicación, situación jurídica y proceso. |
| Situación jurídica | Define si el flujo funcional es de condenados (Aurora) o sindicados. |
| Actuación | Unidad de seguimiento jurídico asociada a una persona y a un formulario diligenciado. |
| Defensor asignado | Responsable funcional de tramitar la solicitud o hacer seguimiento. |
| Estado del trámite/caso | Resultado derivado de reglas de negocio y persistido para consulta operativa. |
| Cargas staging | Datos mensuales de fuentes externas usados para alimentar tablas intermedias y procesos ETL. |

Los documentos específicos del modelo se mantienen en documentacion/documentacion_tecnica/DESCRIPCION_MODELO_DATOS_AURORA.md y documentacion/documentacion_tecnica/base_datos/.

## API principal

Todas las rutas de negocio bajo /api devuelven JSON en UTF-8. Las rutas funcionales están protegidas por requireAuth, salvo salud y autenticación.

| Método | Ruta | Protección | Uso |
| --- | --- | --- | --- |
| GET | /api/health | Pública | Verifica que el backend esté operativo. |
| GET | /api/health/db | Pública | Verifica conectividad con Oracle. |
| GET | /api/auth/config | Pública | Informa si login local/Azure AD están disponibles. |
| POST | /api/auth/login | Pública con rate limit | Login local administrativo. |
| POST | /api/auth/azure-ad | Pública con rate limit | Intercambia idToken Azure AD por JWT Aurora. |
| GET | /api/auth/me | JWT | Retorna usuario autenticado. |
| GET | /api/ppl | JWT | Lista registros base. |
| GET | /api/ppl/condenados | JWT | Lista condenados con filtros y paginación acotada. |
| GET | /api/ppl/condenados/filter-options | JWT | Obtiene opciones cacheadas de filtros. |
| GET | /api/ppl/condenados/homologation-audit | JWT + rol PAG | Audita cobertura de catálogos y prioriza valores históricos sin escribir en Oracle. |
| GET | /api/ppl/pag/:cedula/validar | JWT | Valida información PAG por cédula. |
| GET | /api/ppl/:documento | JWT | Consulta detalle de persona. |
| PUT | /api/ppl/:documento | JWT | Actualiza datos/formulario asociado a una persona. |
| GET | /api/ppl/:documento/actuaciones | JWT | Lista historial de actuaciones. |
| POST | /api/ppl/:documento/actuaciones | JWT | Crea o actualiza una actuación. |
| POST | /api/ppl/asignar-defensor | JWT | Asigna defensor a registros. |
| GET | /api/defensores | JWT | Lista defensores. |
| POST | /api/defensores | JWT | Registra defensor. |
| GET | /api/formatos | JWT | Lista formatos disponibles. |
| GET | /api/formatos/:id/download-url | JWT | Devuelve URL de descarga. |
| GET | /api/formatos/:id/download | JWT | Redirige/descarga formato. |
| GET/POST | /api/admin/cargas | JWT + rol admin | Consulta, crea y reintenta cargas mensuales. |

### Cache y límites operativos

Para mejorar tiempos de respuesta, backend/routes/ppl.js usa caches en memoria para variantes de listados, opciones de filtros y filas normalizadas. Los límites principales son:

- Listado general: DEFAULT_LIST_LIMIT = 5000, máximo 10000.

- Listado filtrado de condenados: límite por defecto y máximo 200.

- Opciones de filtros: TTL de 5 minutos.

- Variantes cacheadas por ruta: máximo 12 antes de limpiar el mapa.

Estos caches son locales al proceso Node.js; al reiniciar el contenedor se recalculan.

## Reglas de negocio

Las reglas de negocio viven en frontend para dar respuesta inmediata a la UI y se validan con pruebas unitarias. La persistencia se realiza en backend, pero la lógica de visibilidad, estado derivado y bloqueo está concentrada en:

- frontend/src/config/formRules.aurora.ts

- frontend/src/utils/evaluateAuroraRules.ts

- frontend/src/config/formRules.celeste.ts

- frontend/src/utils/evaluateCelesteRules.ts

- frontend/src/config/estadoActuaciones.rules.ts

Las matrices ejecutables se encuentran en los archivos de reglas y en sus pruebas dentro de `frontend/src/config/` y `frontend/src/utils/`.

### Principios técnicos de evaluación

- Las reglas aceptan claves textuales y, en Aurora, también algunos IDs estables definidos en auroraFieldIds.ts.

- La lectura de respuestas es tolerante a acentos, mayúsculas, espacios y casos de mojibake UTF-8/Latin-1.

- Valores como vacío, -, --, null, undefined, seleccione y equivalentes no cuentan como diligenciados.

- La UI evalúa reglas cada vez que cambian las respuestas para recalcular bloques visibles, campos deshabilitados, estado y bloqueo.

- Las reglas de habilitación pueden retirar campos de la lista de deshabilitados cuando una condición posterior los vuelve válidos.

### Flujo Aurora para condenados

El flujo Aurora se organiza en bloques:

| Bloque | Contenido | Regla de avance |
| --- | --- | --- |
| bloque1 | Identificación y datos base. | Visible siempre. |
| bloque2Aurora | Datos jurídicos de condena, proceso, pena, conducta y avance temporal. | Visible siempre para condenados. |
| bloque3 | Análisis jurídico, procedencias y otras solicitudes. | Visible si no hay bloqueo. |
| bloque4 | Entrevista, decisión del usuario, actuación y poder/pruebas. | Requiere bloque 3 completo, Q36 válida y al menos una procedencia/solicitud positiva. |
| bloque5UtilidadPublica | Trámite especial de utilidad pública. | Se usa cuando la actuación a adelantar corresponde a utilidad pública. |
| bloque5TramiteNormal | Trámite general ante autoridad. | Variante por defecto para actuaciones diferentes de utilidad pública. |

Obligatoriedad relevante:

- En bloque 2 son obligatorios autoridad, proceso, delitos, captura, pena, tiempo privado de libertad, redención, tiempo efectivo, porcentaje, fase, requerimientos, fecha de última calificación y calificación de conducta.

- En bloque 3 son obligatorios defensor, fecha de análisis, procedencias Q30/Q31/Q33/Q34, Q36 y resumen del análisis Q37. Q32 es opcional porque aplica solo para mujeres.

- Q36 es multiselección; las marcas automáticas de "más de una opción" no cuentan como respuesta válida.

- En bloque 4 son obligatorias decisión del usuario y actuación a adelantar; fecha de entrevista, requiere pruebas y poder son opcionales en la matriz técnica actual.

- En bloque 5, las fechas y sentidos de decisión determinan el estado y el cierre del caso.

### Dependencias y campos deshabilitados en Aurora

| Condición | Efecto |
| --- | --- |
| En trámite normal, Q41 diferente de Sí | Deshabilita fecha de recepción de pruebas aportadas por el usuario. |
| En trámite normal, Q41 igual a Sí | Habilita fecha de recepción de pruebas aportadas por el usuario. |
| En utilidad pública, Q46 igual a No | Deshabilita fecha de solicitud de misión de trabajo y fecha de asignación de investigador. |
| En utilidad pública, Q52 diferente de Niega utilidad pública | Deshabilita motivo de decisión negativa, recurso y campos de decisión de recurso. |
| En utilidad pública, Q52 igual a Niega utilidad pública | Habilita motivo de decisión negativa y recurso. |
| En utilidad pública, Q54 igual a Sí y Q52 negativa | Habilita fecha de recurso y sentido de decisión de recurso. |
| En trámite normal, sentido de decisión negativo | Habilita motivo de decisión negativa y recurso. |
| En trámite normal, sentido de decisión no negativo | Deshabilita motivo, recurso y decisión de recurso. |
| En trámite normal, recurso diferente de Sí | Deshabilita fecha de recurso y sentido final que resuelve la solicitud. |
| En trámite normal, recurso igual a Sí | Habilita fecha de recurso y sentido final que resuelve la solicitud. |

### Cierre de caso en Aurora

El caso se considera cerrado cuando se cumple alguna de estas condiciones:

- Q30 a Q34 están diligenciadas sin procedencia positiva y Q36 no tiene solicitud positiva.

- La decisión del usuario no permite continuar con la solicitud.

- La actuación a adelantar indica Ninguna o No procede nada.

- En utilidad pública, no se cumple marginalidad o jefatura de hogar.

- Hay decisión negativa y no se presenta recurso.

- Hay decisión negativa, se presenta recurso y ya existe decisión del recurso.

- En trámite normal existe sentido de decisión favorable o diferente de no conceder.

- En utilidad pública existe sentido favorable o diferente de negación.

- Existe decisión final de recurso.

### Estado derivado en Aurora

El estado se calcula en orden de prioridad:

| Prioridad | Estado | Condición resumida |
| --- | --- | --- |
| 1 | Caso cerrado | Cumple cualquier regla de cierre. |
| 2 | Pendiente decisión | Decisión negativa con recurso presentado y sin decisión del recurso. |
| 3 | Pendiente decisión | Existe fecha de decisión pero falta sentido de decisión. |
| 4 | Pendiente decisión | Existe radicación/presentación ante autoridad y falta decisión. |
| 5 | Presentar solicitud | Hay datos de bloque 5 pero falta radicación/presentación. |
| 6 | Presentar solicitud | Análisis, entrevista y actuación completas, sin radicación/presentación. |
| 7 | Entrevistar al usuario | Análisis jurídico completo, pero falta entrevista o actuación. |
| 8 | Analizar el caso | Estado por defecto. |

### Flujo Sindicados

El flujo de sindicados usa la configuración Celeste, aunque la interfaz lo presenta como flujo de sindicados.

| Bloque | Contenido | Regla de avance |
| --- | --- | --- |
| bloque1 | Datos base. | Visible siempre. |
| bloque2Celeste | Datos jurídicos mínimos del proceso. | Visible siempre. |
| bloque3Celeste | Defensor, análisis jurídico, procedencia de vencimiento de términos y resumen. | Visible siempre. |
| bloque4Celeste | Fecha de entrevista para informar al usuario. | Requiere bloque 3 completo y que Q21 no cierre el caso. |
| bloque5Celeste | Solicitud de audiencia, audiencia, decisión y recurso. | Requiere Q23 diligenciada. |

Reglas principales:

- Si Q21 inicia con No se avanzará, el caso queda cerrado y no se muestran bloques posteriores.

- Si Q21 indica que se avanzará y Q23 está vacía, el estado es Entrevistar al usuario.

- Si Q23 está diligenciada y aún no existe resultado posterior, el estado es Presentar solicitud.

- Si Q24 está diligenciada y Q25 vacía, el estado es Pendiente audiencia.

- Si Q25 está diligenciada y Q26 vacía, el estado es Pendiente decisión de audiencia.

- Si Q26 revoca o sustituye la medida, el caso se cierra.

- Si Q26 niega la solicitud y no se presenta recurso, el caso se cierra.

- Si se presenta recurso, el estado queda Pendiente decisión hasta que exista decisión o sentido del recurso.

- Si Q30 o Q31 están diligenciadas, el caso queda cerrado.

### Semáforo de estados

estadoActuaciones.rules.ts convierte el estado lógico en etiqueta y clase visual:

| Estado | Clase base | Referencia temporal para semáforo |
| --- | --- | --- |
| Analizar el caso | Verde | Fecha de asignación del PAG o fecha de creación. |
| Entrevistar al usuario | Amarillo | Fecha de análisis jurídico. |
| Presentar solicitud | Rojo | Fecha de entrevista. |
| Pendiente audiencia | Azul | Sin semáforo por días. |
| Pendiente decisión de audiencia | Azul | Sin semáforo por días. |
| Pendiente decisión | Azul | Sin semáforo por días. |
| Caso cerrado | Gris | Sin semáforo por días. |

Cuando aplica semáforo por días:

- 0 a 15 días: verde.

- 16 a 30 días: amarillo.

- Más de 30 días: rojo.

### Historial de actuaciones

El historial permite crear o actualizar actuaciones asociadas al documento de la persona. Técnicamente:

- Una actuación existente se actualiza si se guarda con actuacionId.

- Si no hay actuacionId, se actualiza la última actuación del documento o se crea una nueva según el flujo de la pantalla.

- La fila activa del historial se recalcula con los datos vivos del formulario para mostrar estado actualizado antes de una recarga completa.

- En flujo condenado, la creación de una nueva actuación se bloquea si no existen datos mínimos desde el análisis jurídico.

### Validaciones temporales del formulario

El formulario aplica validaciones de fechas en bloque 5:

- La secuencia cronológica debe conservar el orden esperado: recepción de pruebas, radicación/presentación, decisión y recurso cuando aplique.

- No se aceptan fechas futuras superiores a la fecha actual más 5 días.

- Las fechas usadas por reglas aceptan formatos ISO y día/mes/año cuando el dato proviene de fuentes heterogéneas.

### Cargas mensuales staging/ETL

Aurora incorpora una vista administrativa Cargas mensuales para subir archivos Excel de PONAL, SISIPEC y Aurora 1.0, cargarlos a tablas staging y ejecutar los procedimientos ETL de Oracle.

Componentes:

- frontend/src/pages/AdminCargasBD.jsx: UI de carga, historial, log y reintento.

- backend/routes/adminCargas.js: endpoints /api/admin/cargas.

- backend/services/cargaBdService.js: almacenamiento, registro y ejecución en segundo plano.

- scripts/cargas_bd/loader_service.py: lectura de Excel, validación, carga Oracle y llamada a procedimiento ETL.

Variables relevantes:

- AURORA_CARGAS_DIR

- CARGUEBD_ADMIN_ROLES

- CARGUEBD_PYTHON

- CARGUEBD_AURORA10_ENABLED

- CARGUEBD_SISIPEC_PROCEDURE

- CARGUEBD_SKIP_ETL

- CARGUEBD_MAX_FILE_MB

El registro de cargas puede repararse al inicio con respaldo mediante `CARGUEBD_REPAIR_REGISTRY_ON_START`. `CARGUEBD_CLEAR_REGISTRY_ON_START` realiza una limpieza única del historial visual y debe volver a `false`. Los errores públicos se sanejan y se limitan con `CARGUEBD_PUBLIC_ERROR_MAX_LENGTH`.

## Variables de entorno

Mantener las variables reales fuera del repositorio. Usar .env.example como plantilla canónica.

No incluir en documentación:

- Contraseñas.

- Tokens.

- Cadenas completas de conexión.

- Hosts sensibles si la política interna lo restringe.

## Ejecución local

Instalar dependencias:

```bash
npm ci
npm --prefix backend ci
npm --prefix frontend ci
pip install -r scripts/cargas_bd/requirements.txt
```

Backend:

npm --prefix backend run dev

Frontend:

npm --prefix frontend run dev

## Despliegue

El despliegue recomendado para Aurora es mediante Docker Compose, usando el archivo .env creado manualmente en el servidor.

Despliegue principal:

```bash
cp .env.example .env
docker compose up --build -d
docker compose ps
docker compose logs -f aurora
docker compose restart aurora
```

Despliegue alternativo tradicional:

```dotenv
npm --prefix frontend run build
NODE_ENV=production npm --prefix backend run start:prod
```

El build Docker debe validarse en un equipo o servidor con Docker disponible antes de publicar la imagen.

El contexto Docker excluye .cleanup-backups/, documentación pesada y secretos. Si se generan respaldos locales por limpiezas controladas, no deben subirse al repositorio ni copiarse a la imagen.

## Validaciones posteriores al despliegue

Validar:

```bash
curl http://localhost:7860/api/health
curl http://localhost:7860/api/health/db
```

También se debe validar:

- Login.

- Consulta de registros.

- Filtros.

- Formulario de atención.

- Descarga de formatos.

- Logs sin errores críticos.

- Usuarios autorizados, aviso de tratamiento y Manual Interactivo.

- Búsqueda de defensores con tildes y datos heredados.

- Cola offline ligada a identidad y persistencia de volúmenes.

## Pruebas disponibles

| Alcance | Comando |
| --- | --- |
| QA general | npm run qa:smoke |
| Backend | npm --prefix backend test |
| Oracle smoke | npm --prefix backend run smoke:oracle |
| API lectura | npm --prefix backend run test:api |
| API escritura controlada | npm --prefix backend run test:api:write |
| Frontend lint | npm --prefix frontend run lint |
| Frontend tests | npm --prefix frontend run test |
| PWA | npm --prefix frontend run test -- pwaConfig.test.ts |
| Reglas de estado | npm --prefix frontend run test -- estadoActuaciones.rules.test.ts evaluateAuroraRules.test.ts |
| Frontend build | npm --prefix frontend run build |
| Python cargas | python -m py_compile scripts/cargas_bd/*.py |
| Codificación | npm run qa:encoding |
| Dependencias | npm audit && npm --prefix backend audit && npm --prefix frontend audit |
| Docker | docker compose config && docker compose build aurora |

Las pruebas de escritura deben ejecutarse únicamente contra un esquema temporal distinto a DNDP.

## Logs y solución de problemas

| Situación | Acción sugerida |
| --- | --- |
| Backend no inicia | Revisar PORT, variables obligatorias y logs. |
| Oracle no responde | Revisar red, service name y credenciales. |
| Carga mensual falla | Revisar log en Cargas mensuales, variables ORACLE_*, dependencias Python y formato del Excel. |
| Login local falla | Revisar estado de AUTH_LOCAL_ADMIN_ENABLED. |
| Azure AD falla | Revisar tenant, client ID, grupos y roles. |
| Frontend muestra errores de API | Revisar VITE_API_BASE_URL, CORS y backend. |

## Mantenimiento básico

- Mantener dependencias actualizadas con validación previa.

- Ejecutar pruebas antes de desplegar.

- Actualizar documentación cuando cambien rutas o variables.

- Revisar periódicamente datos sensibles versionados.

- Mantener respaldos de base de datos gestionados por DBA.

## Recomendaciones técnicas

- Usar Docker para despliegues repetibles.

- Evitar escrituras de prueba sobre producción.

- Configurar Azure AD para acceso institucional.

- Registrar evidencias de cada despliegue.

- Mantener `VALIDACION_POST_DESPLIEGUE_AURORA.md` como matriz de aceptación y enlazar las evidencias institucionales.

## Endpoints administrativos vigentes

| Método | Ruta | Protección | Uso |
| --- | --- | --- | --- |
| GET/POST | `/api/admin/users` | `admin` | Lista y crea usuarios internos. |
| PATCH/DELETE | `/api/admin/users/:id` | `admin` | Actualiza o elimina un usuario. |
| POST | `/api/admin/users/import/preview` | `admin` | Valida un CSV sin aplicar cambios. |
| POST | `/api/admin/users/import` | `admin` | Importa registros válidos. |
| GET | `/api/admin/cargas/actuaciones/preview` | rol de cargas | Cuenta datos ficticios permitidos. |
| DELETE | `/api/admin/cargas/actuaciones` | rol de cargas + confirmación | Ejecuta depuración transaccional acotada. |

## Tratamiento de texto heredado

Los nombres provenientes de Oracle pueden presentar mojibake. `sqlFragments.js` y los repositorios de personas y defensores construyen variantes controladas del término de búsqueda y las enlazan como parámetros. El catálogo `DEFENSORES` tiene prioridad cuando la cédula permite resolver el nombre canónico. El comportamiento está cubierto por `backend/scripts/mojibake-search.test.js`.

Este blindaje es de consulta y presentación: no reescribe Oracle. Una corrección masiva exige respaldo, análisis de origen, script reversible y autorización DBA.

## Manejo de errores y cierre

El middleware final de API registra el detalle técnico en servidor y responde un mensaje genérico en producción. Los errores de Oracle se clasifican sin devolver SQL ni binds. El cierre por `SIGTERM` o `SIGINT` deja de aceptar conexiones y cierra el pool de forma ordenada.

## Actualización 2026-06-01 - Operación del servicio Aurora

El despliegue institucional recomendado usa Docker Compose. En este modo, Docker Compose es el mecanismo para subir, bajar, reiniciar y validar Aurora. PM2 no se ejecuta dentro del contenedor y solo aplica como alternativa Node.js tradicional cuando el servidor no usará Docker.

### Operación recomendada con Docker Compose

#### Subir Aurora con Docker Compose

```bash
cd /opt/aurora/<carpeta-del-proyecto>
docker compose up -d
docker compose ps
curl http://127.0.0.1:7860/api/health
```

#### Bajar Aurora con Docker Compose

```bash
cd /opt/aurora/<carpeta-del-proyecto>
docker compose down
docker compose ps
ss -ltnp | grep ':7860' || true
```

#### Pausar sin remover contenedor

docker compose stop aurora

#### Volver a iniciar contenedor pausado

docker compose start aurora

#### Reiniciar Aurora

```bash
docker compose restart aurora
docker compose logs --tail=100 aurora
curl http://127.0.0.1:7860/api/health
```

#### Reconstruir después de cambios

docker compose up --build -d

#### Reconstrucción limpia

```bash
docker compose build --no-cache aurora
docker compose up -d
```

El archivo docker-compose.yml define restart: unless-stopped. Por eso, si Docker queda habilitado al arranque del sistema operativo, Aurora debe volver a levantarse después de reiniciar el servidor.

```bash
sudo systemctl is-enabled docker
sudo systemctl status docker --no-pager
sudo systemctl enable --now docker
```

### Uso alternativo de PM2

PM2 es válido únicamente para operación Node.js directa, sin Docker. Este camino puede usarse para diagnóstico, pruebas controladas o por decisión explícita de Infraestructura. En operación PM2, ecosystem.config.cjs inicia backend/index.js con PORT=7860 y carga variables desde el .env de la raíz mediante DOTENV_CONFIG_PATH=../.env.

| Acción | Comando |
| --- | --- |
| Subir servicio Node.js con PM2 | npm run service:start |
| Ver estado | npm run service:status |
| Ver logs | npm run service:logs |
| Reiniciar servicio | npm run service:restart |
| Detener servicio | npm run service:stop |
| Eliminar proceso PM2 | npm run service:delete |

Para persistir PM2 después de reiniciar el servidor:

```bash
npx pm2 startup
npx pm2 save
```

La salida de npx pm2 startup puede pedir ejecutar un comando con sudo. Ese comando debe revisarlo y ejecutarlo la persona administradora del servidor.
