# Lineamientos de seguridad Aurora

Fecha de generación: 2026-05-12

## Introducción

Este documento reúne lineamientos técnicos de seguridad observados y recomendados para Aurora. No reemplaza políticas institucionales de seguridad de la información.

## Tipo de información que podría manejar el sistema

Por el código y los documentos revisados, Aurora puede manejar:

- Información de personas privadas de la libertad.
- Números de documento.
- Situación jurídica y carcelaria.
- Actuaciones jurídicas.
- Asignación de defensores.
- Datos de PAG y defensores.
- Documentos o formatos de trámite.

Esta información debe tratarse como sensible. No se debe compartir por fuera de los canales autorizados.

## Riesgos principales

| Riesgo | Descripción |
|---|---|
| Exposición de credenciales | Publicar `.env`, cadenas Oracle o secretos JWT. |
| Acceso no autorizado | Uso de credenciales locales débiles o mala configuración de SSO. |
| Exposición de datos personales | Versionar CSV o archivos con datos sensibles. |
| Escrituras sobre producción | Ejecutar pruebas de escritura contra el esquema operativo. |
| CORS amplio | Permitir orígenes no controlados en producción. |
| Falta de trazabilidad | No registrar despliegues, errores o acciones críticas. |

## Manejo de credenciales

- No almacenar contraseñas ni secretos en el repositorio.
- Usar `.env` local o variables del entorno del servidor.
- Mantener `.env.example` sin valores reales.
- Rotar credenciales si hay sospecha de exposición.
- Usar `AUTH_JWT_SECRET` fuerte y diferente por ambiente.
- En producción, mantener `AUTH_LOCAL_ADMIN_ENABLED=false` salvo excepción temporal autorizada.

## Uso de `.env` y `.env.example`

El archivo `.env` real no debe versionarse. El repositorio debe conservar únicamente plantillas sin secretos:

- `.env.example`
- `backend/.env.example`

Durante la revisión se ajustó el patrón de `.gitignore` para ignorar:

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

## Datos sensibles en CSV, JSON u otros archivos

Se identificaron CSV en `backend/data/`. Se recomienda:

- Validar si deben permanecer versionados.
- Anonimizar datos si se usan para desarrollo o pruebas.
- No cargar respaldos productivos al repositorio.
- No publicar muestras con documentos reales en documentación.

No se pudo validar en esta revisión si todos los CSV corresponden a datos reales o anonimizados.

## Usuarios y roles

El sistema usa JWT y puede integrarse con Azure AD. Se recomienda:

- Preferir autenticación institucional con Azure AD.
- Usar grupos o roles de aplicación para autorización.
- Revisar periódicamente usuarios autorizados.
- No compartir credenciales.
- Cerrar sesión en equipos compartidos.

## Recomendaciones para producción

- `NODE_ENV=production`.
- `AUTH_JWT_SECRET` obligatorio y fuerte.
- `AUTH_LOCAL_ADMIN_ENABLED=false`.
- `CORS_ORIGIN` limitado a los orígenes necesarios.
- `ORACLE_SCHEMA` explícito.
- Acceso Oracle limitado por mínimos privilegios.
- Logs centralizados y revisables.
- Backups administrados por el equipo de base de datos.

## Backups y recuperación

No se pudo validar en esta revisión la política real de backup. Se recomienda definir:

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
- Agregar trazabilidad funcional para escrituras críticas si la política institucional lo exige.

## Checklist antes de compartir código

- [ ] Confirmar que no se incluye `.env`.
- [ ] Confirmar que no se incluye `.env.test` con credenciales.
- [ ] Revisar `git status`.
- [ ] Revisar archivos CSV con datos personales.
- [ ] Confirmar que `.env.example` no tiene valores reales.
- [ ] Ejecutar pruebas disponibles.
- [ ] Revisar que no haya tokens en documentación o logs.
- [ ] Compartir solo mediante repositorio privado.

## Recomendaciones finales

- Tratar el repositorio como privado.
- Separar datos reales de datos de prueba.
- Documentar excepciones de seguridad.
- Validar SSO y roles antes de habilitar el acceso a usuarios finales.
