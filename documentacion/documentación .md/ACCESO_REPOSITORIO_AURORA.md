# Acceso y gestión del repositorio de Aurora

> Estado documental: vigente al 2026-07-30.

![Ilustración 1 de Acceso y gestión del repositorio de Aurora](assets/identidad_defensoria.png)

![Ilustración 2 de Acceso y gestión del repositorio de Aurora](assets/visual_derechos_humanos.png)

![Ilustración 3 de Acceso y gestión del repositorio de Aurora](assets/fondo_institucional.png)

## Control de cambios

| Versión | Fecha | Responsable | Descripción del cambio | Aprobación |
| --- | --- | --- | --- | --- |
| 1.0 | 2026-05-19 | Dirección Nacional de Defensoría Pública (DNDP) - Grupo de Transformación Digital | Versión inicial de entrega técnica. | Equipo DNDP |
| 1.1 | 2026-05-28 | Dirección Nacional de Defensoría Pública (DNDP) - Grupo de Transformación Digital | Ajuste de formato institucional, control documental, índice, repositorio institucional, despliegue, roles, URL de ambiente y pruebas. | Pendiente aprobación institucional |
| 1.2 | 2026-07-30 | Dirección Nacional de Defensoría Pública (DNDP) - Grupo de Transformación Digital | Actualización de custodia, preparación de entregables, ramas, controles de integridad, secretos y recuperación. | Pendiente aprobación institucional |

## Tabla de contenido

Índice generado con la estructura de títulos del documento.

Objeto

Ubicación de la versión cero en SharePoint

Repositorio institucional en Azure DevOps

Procedimiento de entrega

Diagramas de apoyo

Diagrama de contexto de Aurora


## Objeto

Este documento define el canal institucional de entrega, custodia y versionamiento del código fuente de Aurora para la gestión de preproducción y posterior despliegue en el repositorio institucional.

## Ubicación de la versión cero en SharePoint

La versión cero del código fuente será entregada por el equipo de Transformación Digital de la DNDP en SharePoint.

| Elemento | Detalle |
| --- | --- |
| Biblioteca | Documentos |
| Carpeta | Aurora |
| Archivo | codigo_fuente_Aurora.zip |
| Ruta funcional | Documentos > Aurora > codigo_fuente_Aurora.zip |
| Uso | Insumo oficial para preproducción y cargue inicial al repositorio institucional. |

El archivo comprimido entregado en SharePoint debe considerarse la línea base de código fuente para la gestión institucional inicial.

## Repositorio institucional en Azure DevOps

Una vez recibida la versión cero en SharePoint, la entidad podrá crear o actualizar el repositorio institucional en Azure DevOps, aplicando sus políticas de ramas, permisos, revisiones y trazabilidad.

- Azure DevOps se usará para control de versiones institucional posterior a la entrega cero.

- SharePoint conserva el soporte formal de entrega de la versión cero.

- No se deben cargar secretos, archivos .env, Excel con datos personales ni respaldos operativos.

## Procedimiento de entrega

1. Consolidar el código fuente sin dependencias generadas, secretos ni archivos sensibles.

2. Comprimir la carpeta de código como codigo_fuente_Aurora.zip.

3. Subir el archivo a Documentos > Aurora > codigo_fuente_Aurora.zip.

4. Registrar fecha, responsable y versión documental.

5. Entregar a la entidad para cargue o sincronización en Azure DevOps.

## Contenido mínimo del repositorio

La entrega debe permitir reconstruir y validar Aurora sin depender de archivos generados en una estación de trabajo. El paquete incluye `frontend/`, `backend/`, `scripts/cargas_bd/`, `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `.gitignore`, `.env.example`, los archivos `package.json` y sus respectivos bloqueos de versiones. También incluye los tutoriales institucionales de `backend/tutorial-videos/` junto con `SHA256SUMS`, porque el Dockerfile comprueba su integridad durante la construcción.

No forman parte del código fuente: `node_modules/`, compilados `dist/`, `backend/public/app/`, archivos `.env` reales, certificados privados, datos de `backend/storage/`, cargas Excel, logs, copias de seguridad, resultados de prueba con datos personales ni credenciales de acceso. El catálogo funcional de Caja de Herramientas sí pertenece al código y está ubicado en `backend/data/formatos.js`.

Antes de empacar o publicar una versión se ejecutan:

```bash
npm ci
npm --prefix backend ci
npm --prefix frontend ci
npm run qa:smoke
npm run qa:encoding
npm audit
npm --prefix backend audit
npm --prefix frontend audit
docker compose config
docker compose build aurora
```

La conexión Oracle se comprueba aparte, desde un ambiente autorizado, con `npm --prefix backend run smoke:oracle`. Las pruebas de escritura nunca se dirigen al esquema productivo.

## Estrategia de versionamiento

El repositorio institucional conserva una rama principal protegida que representa código desplegable. Los cambios se integran mediante ramas de trabajo y solicitud de incorporación con revisión técnica. La entidad define los nombres concretos de ramas, pero cada incorporación debe identificar alcance, riesgo, pruebas ejecutadas, variables nuevas, cambios de base de datos y procedimiento de reversión.

Una versión candidata se etiqueta con un identificador inmutable. El acta o registro de despliegue relaciona esa etiqueta o el hash completo del commit con la imagen construida, el ambiente, la fecha y el responsable. No se reutiliza una etiqueta para contenido diferente.

Los archivos de bloqueo `package-lock.json` se conservan. La instalación automatizada usa `npm ci`; esto evita resolver versiones diferentes a las verificadas. Las dependencias no se copian al repositorio y la imagen se construye desde el código y los bloqueos.

## Protección del repositorio

- La rama principal requiere revisión y ejecución satisfactoria de las validaciones disponibles.
- Los permisos siguen el principio de mínimo privilegio y se revisan cuando cambia el equipo.
- El historial no contiene contraseñas, llaves, tokens, cadenas de conexión ni archivos con información personal.
- La plantilla `.env.example` documenta nombres y valores no sensibles; el `.env` de cada ambiente se custodia en el servidor o mecanismo institucional de secretos.
- Las alertas de dependencias se atienden con pruebas de regresión y no mediante actualizaciones directas sin validación.
- Los archivos binarios operativos se almacenan en el canal documental o volumen designado, no en Git.

Si un secreto llega al historial, eliminar el texto de la versión visible no lo invalida. El responsable debe revocar o rotar inmediatamente el secreto, revisar accesos, sanear el historial conforme a la política institucional y documentar el incidente.

## Integridad y trazabilidad de la entrega

El paquete comprimido se acompaña de una suma SHA-256:

```bash
sha256sum codigo_fuente_Aurora.zip > codigo_fuente_Aurora.zip.sha256
sha256sum --check codigo_fuente_Aurora.zip.sha256
```

Después de recibirlo se verifica el hash, se inspecciona que no contenga secretos ni dependencias generadas y se registra el resultado. Cuando el origen es Azure DevOps, el hash del commit cumple la función de identidad del código, pero la imagen desplegada debe seguir vinculada a ese commit.

## Recuperación y reversión

La reversión de aplicación consiste en desplegar la última etiqueta aprobada y conservar los mismos volúmenes persistentes. Antes de un cambio incompatible de datos, el DBA define respaldo, migración y reversión de Oracle. Los volúmenes `aurora_auth_users` y `aurora_cargas_bd` no se eliminan al sustituir el contenedor; contienen estado operativo que no está en Git.

La recuperación se ensaya en un ambiente controlado. Una entrega se considera reproducible cuando un responsable distinto puede construir la imagen, iniciar el servicio con variables válidas y obtener respuesta satisfactoria en `/api/health` y `/api/health/db`.

## Diagramas de apoyo

### Diagrama de contexto de Aurora

![Ilustración 4 de Acceso y gestión del repositorio de Aurora](assets/diagrama_contexto_aurora.png)

Figura. Diagrama de contexto de Aurora.
