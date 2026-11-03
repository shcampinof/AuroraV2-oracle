# Ampliación de revisión: acceso, guardado y estados

Revisión solicitada el 30 de octubre de 2026, después de las correcciones de sesiones eliminadas, autorización administrada y `estadoAccion`. Complementa el informe inicial. Primero se ampliaron las pruebas; estas reprodujeron una pérdida de cambios sin conexión. El usuario autorizó expresamente corregirla y esa corrección se incluye aquí. No se desplegó código en el servicio HTTPS existente.

## Explicación de las tres correcciones

### 1. Sesiones de usuarios eliminados

Antes, al eliminar un usuario del directorio local, se borraba su entrada. Si presentaba un token institucional todavía válido, la API no encontraba una restricción local y podía aceptar la petición. El token no necesita volver a pasar por la pantalla de ingreso para consultar o guardar.

Ahora se conserva una marca mínima de revocación —identificador y correo— y el middleware rechaza con HTTP 403 la siguiente petición protegida de esa identidad. La revocación queda en el archivo del directorio y funciona tanto en modo abierto como administrado, con LDAP y Azure AD. No elimina expedientes, asignaciones ni actuaciones del usuario.

Esto no borra el token del navegador, no elimina información ya cargada en pantalla y no cancela una operación que ya hubiera superado la autenticación antes de eliminar al usuario. El efecto se aplica a las peticiones posteriores. Si se vuelve a autorizar el mismo correo, un token anterior que no haya vencido puede volver a funcionar, con los roles actuales del directorio. La prueba comprueba expresamente ese comportamiento; no se implementó una invalidación permanente por generación de sesión.

Implementación: `backend/services/userDirectoryService.js`, búsqueda de identidad revocada, registro al eliminar y limpieza de esa marca al reautorizar/importar. El directorio y sus revocaciones deben conservarse en el volumen persistente del despliegue.

### 2. Autorización en modo administrado

El modo administrado ya exigía autorización al ingresar. La comprobación de cada petición ya actualizaba roles y rechazaba usuarios deshabilitados, pero aceptaba el token cuando la identidad no aparecía en el directorio.

Ahora una identidad institucional ausente se rechaza con HTTP 403 y código `AUTH_USER_NOT_ALLOWED` si está activo `AUTH_USER_ACCESS_MODE=managed` o el indicador legado equivalente. Esto cubre también tokens emitidos antes de activar el modo administrado o un directorio nuevo que todavía no incluya al usuario.

No se activó ese modo en el entorno actual ni se cambiaron los roles de usuarios reales. En modo abierto, una identidad institucional desconocida conserva el acceso anterior, salvo que esté deshabilitada o revocada. Los roles vigentes siguen prevaleciendo sobre los roles antiguos del token. No se agregó una consulta Oracle por petición: la verificación usa el directorio local que ya se consultaba.

Implementación: `backend/middleware/auth.js`. Afecta a todos los módulos protegidos, porque comparten ese middleware. Salud, configuración de ingreso y archivos estáticos conservan su política existente.

### 3. Filtro `estadoAccion`

El filtro anterior buscaba coincidencias parciales dentro de un texto que reunía estado y acciones. Por ejemplo, `PENDIENTE_DECISION` podía coincidir con `PENDIENTE_DECISION_AUDIENCIA`. También podía coincidir información de la gestión anterior cuando la persona ya no tenía asignación vigente.

Ahora, cuando el valor corresponde a uno de los nueve códigos o etiquetas reconocidos, se compara por igualdad contra el estado actual calculado. Una persona sin asignación vigente se filtra por `SIN_ASIGNACION`; no por el estado histórico de su atención. Las búsquedas libres, por ejemplo `entrevistar`, siguen buscando coincidencias parciales.

La corrección afecta a qué filas devuelve ese filtro. No cambia las respuestas del formulario, las reglas que calculan los estados, los vínculos de asignación ni la autoría histórica. Los reportes mantienen su consulta propia y se prueban aparte para comprobar conservación de sus resultados.

Implementación: `backend/repositories/oracle/personaRepository.js` y el comparador equivalente de `backend/routes/ppl.js`.

## Pruebas de esta ampliación

Los resultados finales y sus comprobaciones individuales se registran en [regresion-resultados.json](regresion-resultados.json). [regresion-fuentes.sha256.json](regresion-fuentes.sha256.json) identifica las fuentes y el frontend compilado; el manifiesto del informe inicial corresponde a la revisión anterior y se conserva como evidencia histórica.

- Matriz HTTP con los routers reales: 546 comprobaciones sobre 36 rutas, dos proveedores y dos modos. Incluye falta de token, token inválido, usuario deshabilitado/eliminado, usuario desconocido, cambio de roles, reautorización e importación. Cero llamadas Oracle durante los rechazos.
- Formulario de condenado y sindicado: guardado manual y automático rechazados por 401/403 conservan texto y borrador; el reintento después de recuperar acceso guarda los cambios. Las seis pruebas nuevas y las cuatro del aviso forman parte de 401 pruebas frontend en 29 archivos; el archivo de autoguardado tiene 60 pruebas aprobadas.
- Estados: nueve estados por código y etiqueta, 162 combinaciones de coincidencia en memoria con texto histórico contradictorio, predicado SQL exacto, filtros combinados y filtrado anterior a la paginación. Se conserva la búsqueda libre.
- Oracle: se repiten los 459 escenarios de estados, los 48 filtros, prioridad, atribución de reportes, historial de cierres y reasignación con rollback.
- API y navegador: se repiten alta y edición PAG, creación de defensor, asignación DNDP, formularios, autoguardado real, borradores, cierres, ciclos AURORA/CELESTE, reportes regionales y PDF. Se agregan guardado con sesión eliminada, lectura/escritura denegada de distintos módulos, recuperación al reautorizar, filtros exactos/paginación y comparación de Oracle, asignaciones y reportes antes/después de los rechazos.
- Flujos adicionales: reasignación PAG A → B → A → B, persistencia tras recargar, edición histórica sin cambiar al defensor actual y atribución del reporte; historial visible de traslado anterior; catálogo/enlaces de formatos; tres tutoriales; consulta del módulo de cargas. Los tests finales indican sus resultados y limpieza.
- Cargador Python: 28 pruebas descubiertas, 23 aprobadas y cinco integraciones omitidas en la ejecución ordinaria; esas cinco se ejecutan aparte contra Oracle con rollback. No se ejecuta la carga mensual real.

Los scripts de integración usan identidades y expedientes sintéticos. Las escrituras se limitan a sus fixtures, con rollback o eliminación comprobada. La candidata usa un directorio de usuarios, cargas y reportes propio en memoria, accesible solo por loopback. Los tokens de prueba ejercitan los permisos de la aplicación; no acreditan el ingreso real por LDAP/Entra ID.

## Hallazgo nuevo: cola sin conexión

**Fallo reproducido y corregido con autorización del usuario.** El service worker anterior eliminaba de la cola un envío que recibía cualquier respuesta 4xx al reconectar. La reproducción inicial comprobó sesión inválida (401) y usuario eliminado (403): en ambos casos el envío pasaba de una entrada pendiente a cero sin guardarse en Oracle. El formulario podía haber retirado ya su borrador al recibir el 202 de guardado local. El JSON de esa reproducción se conserva separado del resultado corregido.

La conservación del borrador ante un rechazo recibido estando en línea sí pasaba las pruebas. La cola del service worker era un camino diferente. Las pruebas de navegador anteriores usaban `serviceWorkers: 'block'`; comprobaban la API y el formulario real, pero no esta cola. Las pruebas unitarias de autoguardado también simulaban la respuesta API, sin ejecutar la reconexión del service worker. Por ello no detectaron la combinación guardar sin conexión → perder acceso → reconectar. Fue una carencia de cobertura de la revisión anterior. El fallo de descarte existía antes de las tres correcciones; reforzar el rechazo de usuarios eliminados hace especialmente relevante probarlo.

La corrección en `frontend/public/service-worker.js` conserva el envío al recibir 401/403, registra el rechazo y detiene ese reintento. Los roles y la autorización siguen verificándose en el servidor. Cerrar sesión o entrar con otra identidad ya no elimina el pendiente; una identidad distinta tampoco lo reenvía. Solo se comunica a la cuenta activa el estado de sus propias entradas. El nuevo aviso `OfflineSyncNotice` informa que el cambio todavía no se ha enviado y permite reintentar; una nueva sesión de la misma identidad también activa la sincronización automática.

Se conserva el máximo de 75 entradas: cuando se alcanza, se rechaza un envío nuevo sin eliminar los anteriores. Los cambios de la misma actuación siguen compactándose. La transacción IndexedDB evita superar ese límite con dos envíos concurrentes. Un intento solicitado durante otro envío queda pendiente para ejecutarse cuando termine el anterior; no se pierde el aviso de reconexión o renovación de permisos. Se incrementa la versión de la caché del service worker a v9; la cola existente conserva su base y formato.

La prueba corregida tiene nueve comprobaciones integrales con service worker activo: retención y aviso ante usuario eliminado (403) y sesión realmente vencida (401); conservación al cerrar sesión; aislamiento entre identidades; recuperación manual que persiste el valor en Oracle; reconexión automática; botón Salir y recarga; límite de 75, compactación y dos envíos concurrentes al alcanzar el límite. También prueba una desasignación pendiente al perder el rol DNDP: mantiene intacta la asignación, conserva el envío y solo desasigna cuando vuelve el permiso, sin alterar la gestión histórica. Se fuerza una respuesta 403 retenida mientras llega el nuevo intento para comprobar la carrera de reintentos. La limpieza del expediente sintético se verifica al finalizar. La corrección se limita a rechazos de autenticación/autorización; conserva la política anterior para otros errores 4xx.

Una ejecución de pruebas en paralelo compartió indebidamente el directorio temporal y falló la comprobación de aislamiento. Sus siete expedientes sintéticos se retiraron con verificación; no se modificaron usuarios reales. No se contabiliza esa ejecución como aprobada. La repetición final ejecuta las cuatro integraciones secuencialmente mediante el comando de publicación. La limpieza de Oracle del test se independizó de la comparación del directorio para que una discrepancia no deje fixtures pendientes.

Para evitar repetir la omisión, `npm run qa:browser` ejecuta secuencialmente las cuatro integraciones de navegador, incluida la cola sin conexión. Exige entorno explícito y no devuelve una aprobación con pruebas omitidas:

```sh
RUN_RELEASE_BROWSER_INTEGRATION=true \
VERSION_QA_BASE_URL=http://127.0.0.1:18460 \
DOTENV_CONFIG_PATH=/ruta/privada/candidata.env \
PLAYWRIGHT_MODULE_PATH=/ruta/playwright \
npm run qa:browser
```

Usar únicamente una candidata con directorio de usuarios aislado y base de pruebas. `qa:release` conserva las verificaciones que no requieren un servidor ni Oracle; ambas baterías forman parte de la revisión de publicación. En esta sesión se ejecutaron individualmente las integraciones y después se repitieron con este comando, que registra el estado de cada una en `browser-release-results.json`.

## SISIPEC y nuevo destino

**Actualización del 3 de noviembre de 2026:** el usuario confirma que el responsable de Oracle ya tiene actualizado el procedimiento en pruebas. Ese responsable ejecuta los cambios de base de datos y dará las instrucciones para implementarlos en producción tal como están en pruebas. Esta aclaración sustituye la previsión anterior de actualizar el procedimiento como parte del despliegue del código.

La revisión previa encontró una variante instalada que el transformador `install-sisipec-reassignment.js` no reconoce. Ese resultado identifica una incompatibilidad del transformador y no demuestra por sí solo que el procedimiento esté desactualizado. Se conserva la evidencia histórica de esa comprobación. No se aplicó DDL ni se ejecutó el ETL real durante estas pruebas o la publicación.

La aplicación ya está desplegada en el entorno de pruebas `docker-443`, según el [registro de publicación](../../PUBLICACION_DOCKER_443_2026-11-03.md). Se mantiene el procedimiento actual por indicación del usuario; no se requiere solicitar la ubicación del SQL ni preparar una actualización adicional desde este despliegue de la aplicación.

El destino productivo será distinto del entorno probado. Para ese futuro destino corresponde validar la imagen y configuración, conexión/permisos Oracle, SSO institucional, certificados, respaldo/restauración y capacidad con concurrencia representativa, siguiendo las instrucciones del responsable de Oracle para la base de datos. Las pruebas en desarrollo no sustituyen esas verificaciones. Los campos abiertos de los bloques 1 y 2 continúan fuera de esta entrega, como solicitó el usuario.
