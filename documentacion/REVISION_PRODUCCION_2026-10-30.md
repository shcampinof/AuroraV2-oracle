# Revisión funcional y técnica para producción — 30 de octubre de 2026

**Aclaración del 3 de noviembre de 2026:** la aplicación ya fue desplegada en el entorno de pruebas `docker-443`; véase el [registro de publicación](../PUBLICACION_DOCKER_443_2026-11-03.md). El usuario confirma que el responsable de Oracle ya tiene actualizado SISIPEC y que él ejecutará los cambios e indicará cómo implementarlos en producción. Se mantiene el procedimiento actual en pruebas. Esta aclaración sustituye la conciliación o actualización de SISIPEC prevista anteriormente como pendiente de este despliegue. El dictamen histórico que sigue corresponde a la revisión del 30 de octubre; las verificaciones de la futura infraestructura productiva conservan su alcance.

**Ampliación posterior solicitada por el usuario:** explicación de las tres correcciones, nueva regresión integral y corrección autorizada de la cola sin conexión en [regresion-acceso-estados.md](revision-2026-10-30/regresion-acceso-estados.md). Esa ampliación incluye la aclaración vigente sobre SISIPEC y prevalece para el dictamen actualizado.

**Dictamen: salida condicionada.** La aplicación pasa las pruebas descritas abajo, pero no se autoriza técnicamente la publicación en el nuevo destino hasta conciliar la versión de SISIPEC, preparar la imagen final y validar la infraestructura y Oracle de producción. La corrección de edición de los bloques 1 y 2 se retiró de esta entrega por decisión del usuario.

La revisión se ejecutó sobre el espacio de trabajo actual, que contiene cambios previos sin confirmar en Git. El manifiesto adjunto identifica los archivos revisados por SHA256. No se desplegó una nueva versión en el servicio HTTPS existente.

**Correcciones realizadas**

| Hallazgo | Corrección y comprobación |
| --- | --- |
| Un usuario eliminado conservaba acceso con su token vigente. | Se conserva una revocación mínima de identidad; la sesión se rechaza aunque el acceso institucional esté en modo abierto. Reautorizar el correo toma los roles actuales. Pruebas para LDAP y Azure AD. |
| El modo administrado no comprobaba en cada petición que el usuario siguiera autorizado. | El middleware devuelve 403 para identidades ausentes del directorio. Se conservan las comprobaciones de usuario deshabilitado y de roles actuales. |
| Se confiaba siempre en un salto de proxy, incluso con HTTPS directo. | `TRUST_PROXY=false` por defecto; un proxy debe configurarse explícitamente. Se prueban IP y origen con encabezados reenviados falsificados y con un proxy confiable. Esto evita que el cliente elija la IP que usa el limitador de ingreso. |
| El filtro legado `estadoAccion` podía incluir otro estado por coincidencia parcial o por el estado anterior de una gestión. | Un código o etiqueta canónica filtra por igualdad sobre el estado actual. La búsqueda libre conserva su comportamiento. La validación real de los 48 filtros quedó aprobada. |
| Auditoría npm: 5 paquetes afectados en backend y 9 en frontend, incluidas dependencias críticas. | Se actualizaron los archivos de bloqueo dentro de los rangos compatibles, sin `--force`. Resultado final: 0 vulnerabilidades reportadas en ambas auditorías. Es una auditoría npm; no equivale a un análisis del sistema operativo. |
| Docker usaba Node 20, fuera de soporte. | Docker y `.nvmrc` pasan a Node 24.22.2. Se verificó el binario oficial por SHA256 y se ejecutaron lint, pruebas, compilación y consultas Oracle con ese runtime. Node recomienda versiones LTS soportadas para producción: [ciclo oficial de versiones](https://nodejs.org/en/about/previous-releases). |
| Las dependencias Python podían cambiar en cada construcción. | `requirements.production.txt` fija las 11 distribuciones verificadas con Python 3.11. Docker usa ese archivo; la instalación fuera de Docker conserva `requirements.txt`. Las pruebas del cargador y `pip check` aprobaron en el contenedor. |
| Algunas pruebas de integración estaban desactualizadas. | Se corrigieron la aceptación del aviso inicial, apertura del modal PAG, etiquetas vigentes de reportes, alcance regional y espera del guardado manual completo. La prueba de estados distingue la atención asignada de la bandeja sin asignación. No se modificaron las reglas para acomodar expectativas antiguas de reportes. |

**Resultados y alcance**

| Área | Evidencia |
| --- | --- |
| Frontend con Node 24.22.2 | 391 pruebas aprobadas en 28 archivos; lint y compilación aprobados. |
| Backend | 21 suites aprobadas, incluidas revocación de sesiones, permisos, configuración HTTP, asignación, cierres, reportes y depuración selectiva. También se probaron dentro de la candidata. |
| Estados en Oracle | 65 escenarios de AURORA/CELESTE y 459 comprobaciones aprobadas, sin fallos. Se usan SELECT con datos sintéticos. Incluye vacío, espacios, guiones, ausencia de asignación e inactividad. |
| Filtros en Oracle | 48 filtros aprobados: identidad, ubicación, defensor, estados, acciones, categorías, combinaciones y entradas inválidas. Cuatro opciones de audiencia no tenían muestra en los datos reales; están cubiertas por los escenarios sintéticos y los ciclos de CELESTE. |
| Ciclos persistidos | Condenado normal, utilidad pública y sindicado: análisis, entrevista, presentación o audiencia, decisión negativa, recurso, resultado y cierre. Se comprueba respuesta, nueva consulta, autor y conservación de la actuación anterior. |
| API y navegador | 62 comprobaciones aprobadas tanto en la candidata inicial como con servidor Node 24.22.2: alta PAG, permisos vigentes, asignación DNDP, formularios, autoguardado real de 30 s, borradores incompletos, cierre motivado, exclusión por inactividad, reportes regionales y descarga de PDF. Cero errores JavaScript; limpieza verificada. Las dos ejecuciones y su limpieza están registradas en el archivo de resultados adjunto. |
| Reasignación SQL real | A → B → A → C, autoría de hitos, repetición sin duplicados, desasignación y nueva gestión aprobados. Rollback de los datos sintéticos verificado. |
| Reportes e historial SQL | Aislamiento por defensor, regional y ERON, alias históricos, fechas, autoría, cierres anteriores y casos sin regional aprobados con CTE de solo lectura. |
| Prioridad de gestión | 20 escenarios Oracle aprobados. |
| Cargador Python | 28 pruebas descubiertas: 23 aprobadas y 5 de integración omitidas en la ejecución ordinaria. Las 5 del bot se ejecutaron aparte contra Oracle y aprobaron con rollback. No se ejecutó el ETL mensual. |
| Integridad de datos | Cero documentos duplicados, asignaciones vigentes duplicadas, gestiones enlazadas a la asignación de otra persona, gestiones sin situación y asignaciones sin persona en las consultas realizadas. |
| Calidad de catálogos | Cobertura de establecimientos por ocurrencias: 98,33 %. Quedan 309 identidades y 2.338 ocurrencias fuera de homologación; pueden incluir CDT u otras ubicaciones admitidas y requieren clasificación, no eliminación automática. |
| Comprobaciones estáticas | UTF-8 y `git diff --check` aprobados. |

Las pruebas de navegador usaron una candidata accesible solo por `127.0.0.1:18460`, con código y frontend montados, y directorios propios de usuarios, cargas y reportes en memoria. No utilizaron los archivos de usuarios del servicio publicado. Oracle fue el servicio de desarrollo disponible, `DNDPDEV.defensoria.gov.co`; no la nueva base de producción.

Los datos de expedientes empleados en las escrituras fueron sintéticos. Se comprobaron su eliminación o rollback y la conservación del directorio previo de usuarios de la candidata. No se ejecutaron depuraciones de expedientes reales, cargas mensuales, DDL ni publicaciones.

**Bloqueos antes de publicar**

1. **Conciliar SISIPEC con el responsable de Oracle.** `PRC_CARGA_SISIPEC` está `VALID`, con última modificación registrada el 28 de octubre. La fuente instalada usa una implementación con una tercera fase de traslado regional y no contiene el bloque que reconoce la migración del repositorio. La prueba `oracle-sisipec-regional.integration.js` falla con «No se encontró el bloque regional instalado» y el diagnóstico de `install-sisipec-reassignment.js`, sin `--apply`, falla con «No se encontro el ancla deteccion de cambios». Esto es una incompatibilidad de validación y migración comprobada; no una demostración de fallo de una carga mensual real, que no se ejecutó. No debe aplicarse automáticamente la migración sobre esta variante.
2. **Validar el nuevo destino.** Faltan la comprobación de conectividad, estructura, objetos, permisos, catálogos y respaldo/restauración en la base de producción; HTTPS y confianza del certificado; ingreso institucional real, URI de retorno de Entra ID y asignación de roles. Los tokens de prueba no sustituyen una prueba de SSO real.
3. **Construir y verificar la imagen final.** Se probó una candidata con montajes de código y runtime; todavía no una imagen nueva construida íntegramente con el Dockerfile actualizado. Construirla en el servidor de destino o CI, revisar sus dependencias del sistema operativo, repetir salud/Oracle y publicar por digest. El servidor actual tenía unos 200 MB libres al iniciar; solo se limpió la caché descargable de npm. No se eliminaron imágenes de respaldo ni volúmenes.
4. **Medir capacidad en el destino.** Los 48 filtros, ejecutados por lotes concurrentes en desarrollo, tuvieron mediana de 9,54 s, percentil 95 de 10,13 s y máximo de 13,46 s. No son un ensayo de carga ni un SLA. Antes de abrir a todos los usuarios se necesita medir consultas y reportes con concurrencia representativa y definir tiempos aceptables.

Fuente instalada de SISIPEC revisada, SHA256:
`4835d42244e06e413fa97f26212e79dfe6e904f00c9305761d7715d0416cc427`.

**Preparación del destino y repetición**

Usar una configuración propia del destino a partir de `.env.example`: `NODE_ENV=production`, administrador local deshabilitado, secreto JWT propio y persistente, directorio autorizado persistente, conexión Oracle de producción y certificados correspondientes al nombre público. Si solo deben entrar usuarios autorizados, configurar `AUTH_USER_ACCESS_MODE=managed` y `AUTH_USER_SYNC_REQUIRED=true`. Inicializar el administrador institucional antes de abrir el acceso.

Configurar `TRUST_PROXY=false` para HTTPS directo. Si existe un proxy, indicar sus direcciones o redes de confianza y configurar el origen público en `CORS_ORIGIN`. Conservar volúmenes separados para usuarios, cargas y reportes. La validación realizada corresponde a una instancia de aplicación; no acredita ejecución distribuida de cargas ni edición concurrente del directorio entre réplicas.

En el checkout exacto que se vaya a publicar, con Node 24.22.2 y dependencias instaladas desde sus archivos de bloqueo:

```sh
npm ci
npm --prefix frontend ci
npm --prefix backend ci
npm run qa:release
python3 -m unittest discover -s scripts/cargas_bd -p 'test_*.py'
```

Ejecutar Python con las dependencias verificadas del contenedor. Para Oracle, señalar mediante `DOTENV_CONFIG_PATH` un archivo privado del entorno y habilitar las integraciones de forma explícita. Repetir estados, filtros, prioridad, reportes, historial y reasignación. Ejecutar el navegador integral sobre una candidata con directorios aislados y comprobar `ok: true` y `cleanupVerified: true` en sus resultados. La prueba SISIPEC queda pendiente de conciliar la versión instalada.

Para el pase final se requieren respaldo comprobado, imagen anterior disponible, configuración y volúmenes conservados, prueba de restauración y un procedimiento de reversión que distinga el código de los cambios de base de datos. El rollback de los fixtures de esta revisión no demuestra la restauración de un respaldo productivo.

Resultados consolidados: [revision-2026-10-30/resultados.json](revision-2026-10-30/resultados.json).
Manifiesto del código revisado: [revision-2026-10-30/fuentes.sha256.json](revision-2026-10-30/fuentes.sha256.json).
Logs detallados de esta sesión: `/tmp/aurora-revision-produccion-20261030-*`.
