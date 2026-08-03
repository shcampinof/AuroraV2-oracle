# Documentación Markdown de Aurora

> Conjunto documental vigente al 2026-07-30.

Esta carpeta es hermana de `documentacion_word` y contiene un archivo Markdown actualizado por cada Word de origen. Los documentos conservan el propósito, las tablas, los procedimientos y las ilustraciones originales, y amplían la información con el comportamiento de la versión final del código.

## Inventario

| Documento | Finalidad |
| --- | --- |
| [ACCESO_REPOSITORIO_AURORA.md](ACCESO_REPOSITORIO_AURORA.md) | Entrega, custodia, versionamiento, integridad y reversión del código. |
| [ARQUITECTURA_SISTEMA_AURORA.md](ARQUITECTURA_SISTEMA_AURORA.md) | Contexto, componentes, límites de confianza y flujos técnicos. |
| [DESCRIPCION_CODIGO_FUENTE_AURORA.md](DESCRIPCION_CODIGO_FUENTE_AURORA.md) | Estructura del repositorio, responsabilidades, convenciones y pruebas. |
| [DESCRIPCION_MODELO_DATOS_AURORA.md](DESCRIPCION_MODELO_DATOS_AURORA.md) | Objetos Oracle, relaciones usadas, staging, persistencia auxiliar e integridad. |
| [GUIA_DESPLIEGUE_AURORA.md](GUIA_DESPLIEGUE_AURORA.md) | Instalación y operación mediante Docker Compose, con alternativa PM2. |
| [INFRAESTRUCTURA_AURORA.md](INFRAESTRUCTURA_AURORA.md) | Servidor, red, TLS, volúmenes, monitoreo, respaldo y continuidad. |
| [LINEAMIENTOS_SEGURIDAD_AURORA.md](LINEAMIENTOS_SEGURIDAD_AURORA.md) | Identidad, autorización, secretos, PWA, datos personales e incidentes. |
| [LINEA_BASE_CASO_NEGOCIO_AURORA.md](LINEA_BASE_CASO_NEGOCIO_AURORA.md) | Necesidad, alcance, actores, historias, aceptación, riesgos e indicadores. |
| [MANUAL_TECNICO_AURORA.md](MANUAL_TECNICO_AURORA.md) | Referencia técnica integral de aplicación, datos, reglas, API y operación. |
| [MANUAL_USUARIO_AURORA.md](MANUAL_USUARIO_AURORA.md) | Uso funcional por perfil, solución de problemas y capturas de apoyo. |
| [Plantilla-Documento-Word-Diseño-1-2025-2.md](Plantilla-Documento-Word-Diseño-1-2025-2.md) | Plantilla semántica reutilizable para nuevos documentos Markdown. |
| [VALIDACION_POST_DESPLIEGUE_AURORA.md](VALIDACION_POST_DESPLIEGUE_AURORA.md) | Matriz de aceptación, evidencias, cierre y reversión. |

## Criterios de mantenimiento

- El código vigente es la referencia para rutas, variables, roles y comandos.
- El DBA gobierna MER, diccionario, restricciones, índices y objetos productivos.
- Infraestructura confirma DNS, IP, TLS, puertos y capacidad de cada ambiente.
- Los valores pendientes se mantienen como campos explícitos; no se inventan datos institucionales.
- Las credenciales, llaves, tokens, datos personales y evidencias operativas no se incorporan.
- Las imágenes se sirven desde `assets/` mediante rutas relativas.
- Todo cambio material actualiza fecha, versión documental y control de cambios.

## Relación con los Word

Los Word permanecen como fuentes históricas e institucionales. Los Markdown incorporan las integraciones vigentes que no estaban completas en esos archivos: LDAP, directorio de usuarios autorizados, roles `pag` y administrativos separados, aviso de tratamiento de datos, Manual Interactivo, cola offline vinculada a identidad, depuración controlada, saneamiento de errores y búsqueda compatible con nombres almacenados con mojibake.

La aprobación institucional, las URLs definitivas y los datos de ambiente se completan por sus responsables. Una frase marcada como pendiente no representa un resultado ejecutado.
