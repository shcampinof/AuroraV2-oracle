# Validación post despliegue Aurora

Fecha: 2026-05-19

## Introducción

Esta lista de chequeo permite validar que Aurora quedó funcionando después de un despliegue. Debe ejecutarse en el ambiente real y conservar evidencia mínima.

## Datos del despliegue

- [ ] Fecha y hora del despliegue registradas.
- [ ] Responsable técnico registrado.
- [ ] Rama o tag desplegado registrado.
- [ ] Commit desplegado registrado.
- [ ] Ambiente identificado: desarrollo, pruebas, preproducción o producción.
- [ ] Método de despliegue registrado: Docker Compose.

## Variables de entorno

- [ ] Existe `.env` creado manualmente en el servidor.
- [ ] `.env` no está versionado.
- [ ] `NODE_ENV=production` en ambiente productivo.
- [ ] `PORT` definido o confirmado en `7860`.
- [ ] `AUTH_JWT_SECRET` definido con valor fuerte.
- [ ] `AUTH_LOCAL_ADMIN_ENABLED=false` en producción, salvo excepción autorizada.
- [ ] Variables `AZURE_AD_*` configuradas si se usa SSO.
- [ ] Variables `ORACLE_*` configuradas.
- [ ] `ORACLE_SCHEMA` apunta al esquema correcto.
- [ ] `AURORA_CARGAS_DIR` definido si se usarán cargas mensuales.
- [ ] `CARGUEBD_PYTHON` definido o confirmado como `python3`.
- [ ] `CARGUEBD_ADMIN_ROLES` revisado.
- [ ] `CARGUEBD_AURORA10_ENABLED` definido según operación vigente de Aurora 1.0.

## Backend

- [ ] El proceso backend inicia correctamente.
- [ ] No se observan errores críticos en logs de inicio.
- [ ] El puerto esperado queda escuchando.
- [ ] El endpoint de salud responde:

```bash
curl http://localhost:7860/api/health
```

- [ ] La respuesta de `/api/health` indica `ok: true`.

## Base de datos o fuente de datos

- [ ] Oracle es accesible desde el servidor o contenedor.
- [ ] El endpoint de salud de base de datos responde:

```bash
curl http://localhost:7860/api/health/db
```

- [ ] La respuesta de `/api/health/db` indica conexión exitosa.
- [ ] Si falla, se revisan host, puerto, service name, usuario, password, VPN o firewall.

## Frontend

- [ ] La URL principal carga correctamente.
- [ ] No se observan errores críticos en consola del navegador.
- [ ] Los assets CSS y JS cargan sin 404.
- [ ] El logo y elementos principales se visualizan.
- [ ] La navegación lateral muestra los módulos esperados.

## Autenticación

- [ ] La pantalla de login carga.
- [ ] `/api/auth/config` responde correctamente.
- [ ] El ingreso local está deshabilitado en producción o autorizado temporalmente.
- [ ] El ingreso Azure AD funciona si está configurado.
- [ ] La sesión se mantiene después de autenticar.
- [ ] Cerrar sesión funciona.

## Consulta principal de datos

- [ ] El módulo `Usuarios asignados` carga.
- [ ] Se visualizan registros o mensaje controlado si no hay datos.
- [ ] Se puede consultar un documento existente.
- [ ] Un documento inexistente devuelve mensaje controlado.
- [ ] No aparecen errores 500 en una consulta normal.

## Carga de tablas y filtros

- [ ] La tabla de usuarios asignados carga columnas esperadas.
- [ ] Filtro por documento funciona.
- [ ] Filtro por departamento funciona si hay datos.
- [ ] Filtro por municipio funciona si hay datos.
- [ ] Filtro por defensor funciona si hay datos.
- [ ] Filtro por estado funciona si hay datos.
- [ ] No se bloquea la interfaz con volúmenes normales de datos.

## Formularios

- [ ] El formulario de atención abre desde un documento.
- [ ] Los datos base se visualizan.
- [ ] Las validaciones obligatorias se muestran cuando corresponde.
- [ ] Al diligenciar la actuación activa, el historial actualiza `Acción a impulsar` sin recargar la aplicación.
- [ ] Guardar cambios funciona en ambiente autorizado.
- [ ] Crear actuación funciona en ambiente autorizado.
- [ ] No ejecutar escrituras en producción si la validación no fue aprobada.

## Asignación de defensores

- [ ] El módulo de asignación carga.
- [ ] La validación de cédula PAG responde.
- [ ] El catálogo de defensores carga.
- [ ] La lista de condenados carga.
- [ ] La columna `Acción a impulsar` coincide con el estado derivado usado en Usuarios asignados.
- [ ] La asignación o reasignación funciona en ambiente autorizado.
- [ ] Se valida que los cambios queden persistidos.

## Descarga de documentos

- [ ] La Caja de Herramientas carga formatos.
- [ ] Se puede solicitar descarga de un formato existente.
- [ ] Un formato inexistente responde error controlado.
- [ ] Cada formato descargable tiene `downloadUrl` configurado.

## Cargas mensuales staging/ETL

- [ ] El módulo `Cargas mensuales` aparece solo para usuarios con rol autorizado.
- [ ] Un usuario sin rol autorizado recibe `403` al consultar `/api/admin/cargas`.
- [ ] `/api/admin/cargas/fuentes` lista PONAL, SISIPEC y Aurora 1.0 según configuración.
- [ ] `AURORA_CARGAS_DIR` existe y tiene permisos de escritura para el backend.
- [ ] El ambiente tiene instaladas las dependencias de `CargueBD/requirements.txt`.
- [ ] Se validó `python -m py_compile CargueBD/*.py`.
- [ ] Para una carga real autorizada, el estado final queda `exitoso` o el error queda documentado.
- [ ] El log de la carga no imprime credenciales.
- [ ] Se contrastó el resultado con `LOG_CARGA` o consulta Oracle definida por DBA/funcional.

## Logs

- [ ] Revisar logs del backend.
- [ ] Revisar logs del contenedor si aplica.
- [ ] Confirmar que no se imprimen credenciales.
- [ ] Confirmar que no hay errores repetitivos de Oracle.
- [ ] Confirmar que no hay errores repetitivos de autenticación.
- [ ] Confirmar que no hay errores repetitivos del proceso Python de cargas.

## Docker, si aplica

- [ ] `docker compose ps` muestra el servicio `aurora` activo.
- [ ] `docker compose logs aurora` no muestra errores críticos.
- [ ] El `HEALTHCHECK` de la imagen está saludable.
- [ ] El puerto publicado coincide con `HOST_PORT`.
- [ ] El contexto de build no incluye `.env`, `backend/.env`, `frontend/dist`, `backend/public/app` ni `.cleanup-backups/`.

## Evidencias mínimas

- [ ] Captura o salida de `/api/health`.
- [ ] Captura o salida de `/api/health/db`.
- [ ] Captura de login exitoso o confirmación de SSO.
- [ ] Captura de tabla principal cargada.
- [ ] Registro de prueba de consulta por documento.
- [ ] Registro de prueba de descarga de formato, si aplica.
- [ ] Registro de prueba o validación del módulo de cargas mensuales, si aplica.
- [ ] Registro de errores encontrados y acciones tomadas.

## Cierre

- [ ] Validación aprobada por responsable técnico.
- [ ] Validación funcional básica aprobada por usuario autorizado, si aplica.
- [ ] Incidencias pendientes documentadas.
- [ ] Fecha y hora de cierre registradas.

## Recomendaciones finales

- Ejecutar esta lista después de cada despliegue.
- No omitir la validación de `/api/health/db`.
- Mantener evidencia en el repositorio documental o sistema interno definido por OTI.
