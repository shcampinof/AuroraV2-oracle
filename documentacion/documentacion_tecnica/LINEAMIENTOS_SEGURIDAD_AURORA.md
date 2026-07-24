# Lineamientos de seguridad Aurora

Fecha de actualización: 2026-07-24

## Introducción

Este documento reúne lineamientos técnicos de seguridad aplicables a Aurora. No reemplaza políticas institucionales de seguridad de la información.

## Tipo de información que podría manejar el sistema

Por el código y los documentos revisados, Aurora puede manejar:

- Información de personas privadas de la libertad.
- Números de documento.
- Situación jurídica y carcelaria.
- Actuaciones jurídicas.
- Asignación de defensores.
- Datos de PAG y defensores.
- Documentos o formatos de trámite.
- Archivos Excel mensuales de PONAL, SISIPEC y Aurora 1.0 cargados por administradores.

Esta información debe tratarse como sensible. No se debe compartir por fuera de los canales autorizados.

## Riesgos principales

| Riesgo | Descripción |
|---|---|
| Exposición de credenciales | Publicar `.env`, cadenas Oracle o secretos JWT. |
| Acceso no autorizado | Uso de credenciales locales débiles o mala configuración de SSO. |
| Exposición de datos personales | Versionar exportaciones, respaldos o archivos con datos sensibles. |
| Escrituras sobre producción | Ejecutar pruebas de escritura contra el esquema operativo. |
| Cargas ETL no autorizadas | Subir archivos incorrectos o ejecutar cargas mensuales sin aprobación funcional. |
| CORS amplio | Permitir orígenes no controlados en producción. |
| Falta de trazabilidad | No registrar despliegues, errores o acciones críticas. |
| Datos locales en imágenes | Incorporar `backend/storage`, `.env`, logs o archivos de carga dentro de capas Docker. |

## Manejo de credenciales

- No almacenar contraseñas ni secretos en el repositorio.
- No almacenar certificados reales, llaves privadas ni paquetes TLS en el repositorio (`.key`, `.pem`, `.crt`, `.pfx`, `.p12`).
- Usar `.env` local o variables del entorno del servidor.
- Mantener `.env.example` sin valores reales.
- Rotar credenciales si hay sospecha de exposición.
- Usar `AUTH_JWT_SECRET` fuerte y diferente por ambiente.
- En producción, mantener `AUTH_LOCAL_ADMIN_ENABLED=false` salvo excepción temporal autorizada.

## Uso de `.env` y `.env.example`

El archivo `.env` real no debe versionarse. El repositorio debe conservar únicamente plantillas sin secretos:

- `.env.example`

El patrón de `.gitignore` debe ignorar:

- `.env`
- `.env.*`
- `backend/.env`
- `backend/.env.*`
- `frontend/.env`
- `frontend/.env.*`

## Control de acceso al repositorio privado

- Conceder acceso solo a personas autorizadas.
- Usar cuentas nominales, no cuentas compartidas.
- Revocar accesos cuando cambien funciones o contratos.
- Evitar enviar ZIP del repositorio por correo.
- Revisar cambios antes de hacer merge a la rama principal.

## Datos sensibles en archivos locales

Se recomienda:

- No cargar respaldos productivos al repositorio.
- No publicar muestras con documentos reales en documentación.
- Mantener datos de prueba anonimizados y controlados.
- Tratar exportaciones operativas como información sensible.
- Guardar `AURORA_CARGAS_DIR` en una ruta persistente, fuera de Git y con permisos restringidos.
- No compartir logs de carga si contienen rutas, conteos o datos operativos sensibles.

## Usuarios y roles

El sistema usa JWT y puede integrarse con Azure AD. Se recomienda:

- Preferir autenticación institucional con Azure AD.
- Usar grupos o roles de aplicación para autorización.
- Revisar periódicamente usuarios autorizados.
- No compartir credenciales.
- Cerrar sesión en equipos compartidos.
- Usar `AUTH_USER_ACCESS_MODE=managed` cuando la política exija aprobación previa.
- Revisar por separado ingreso general y roles `pag`, `admin` y cargas.
- La API debe aplicar el directorio vigente en cada petición para que deshabilitaciones y retiros de rol tengan efecto inmediato.
- Limitar las importaciones con `AUTH_USER_IMPORT_MAX_MB` y `AUTH_USER_IMPORT_MAX_ROWS`; los existentes no deben modificarse por importación.

## Recomendaciones para producción

- `NODE_ENV=production`.
- `AUTH_JWT_SECRET` obligatorio y fuerte.
- `AUTH_LOCAL_ADMIN_ENABLED=false`.
- `CORS_ORIGIN` limitado a los orígenes necesarios.
- `ORACLE_SCHEMA` explícito.
- Acceso Oracle limitado por mínimos privilegios.
- `CARGUEBD_ADMIN_ROLES` limitado a perfiles autorizados.
- `CARGUEBD_SKIP_ETL=false` para operación normal.
- `AURORA_VIDEOS_DIR=/app/backend/tutorial-videos` salvo catálogo externo aprobado y montado en solo lectura.
- Construir con `.dockerignore` que excluya `backend/storage`, secretos, certificados y logs anidados.
- Logs centralizados y revisables.
- Backups administrados por el equipo de base de datos.

## Backups y recuperación

La política de backup debe quedar definida por el equipo responsable de operación. Se recomienda incluir:

- Frecuencia de backups Oracle.
- Tiempo objetivo de recuperación.
- Procedimiento de restauración.
- Responsable DBA.
- Evidencia periódica de pruebas de restauración.

## Trazabilidad y logs

El backend registra errores en consola para operaciones principales. Se recomienda:

- Centralizar logs en el ambiente de despliegue.
- Evitar imprimir credenciales o tokens.
- Registrar fecha, versión desplegada y resultado de validaciones.
- Conservar logs de cargas mensuales según política institucional de auditoría.
- Agregar trazabilidad funcional para escrituras críticas si la política institucional lo exige.

## Checklist antes de compartir código

- [ ] Confirmar que no se incluye `.env`.
- [ ] Confirmar que no se incluye `.env.test` con credenciales.
- [ ] Revisar `git status`.
- [ ] Revisar que no existan archivos locales con datos personales.
- [ ] Confirmar que `.env.example` no tiene valores reales.
- [ ] Ejecutar pruebas disponibles.
- [ ] Revisar que no haya tokens en documentación o logs.
- [ ] Confirmar que no se incluyen archivos de `backend/storage/` ni Excel mensuales.
- [ ] Confirmar que `scripts/cargas_bd/` contiene solo código Python, dependencias y documentación técnica.
- [ ] Verificar que la imagen no contiene `.env*`, logs, Excel ni archivos de `backend/storage/`.
- [ ] Ejecutar `npm audit` en raíz, frontend y backend y resolver hallazgos de severidad alta.
- [ ] Validar `backend/tutorial-videos/SHA256SUMS`.
- [ ] Compartir solo mediante repositorio privado.

## Recomendaciones finales

- Tratar el repositorio como privado.
- Separar datos reales de datos de prueba.
- Documentar excepciones de seguridad.
- Validar SSO y roles antes de habilitar el acceso a usuarios finales.
