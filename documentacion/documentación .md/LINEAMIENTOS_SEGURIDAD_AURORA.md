# Lineamientos de seguridad de Aurora

> Estado documental: vigente al 2026-07-30.

![Ilustración 1 de Lineamientos de seguridad de Aurora](assets/identidad_defensoria.png)

![Ilustración 2 de Lineamientos de seguridad de Aurora](assets/visual_derechos_humanos.png)

![Ilustración 3 de Lineamientos de seguridad de Aurora](assets/fondo_institucional.png)

## Control de cambios

| Versión | Fecha | Responsable | Descripción del cambio | Aprobación |
| --- | --- | --- | --- | --- |
| 1.0 | 2026-05-19 | Dirección Nacional de Defensoría Pública (DNDP) - Grupo de Transformación Digital | Versión inicial de entrega técnica. | Equipo DNDP |
| 1.1 | 2026-05-28 | Dirección Nacional de Defensoría Pública (DNDP) - Grupo de Transformación Digital | Ajuste de formato institucional, control documental, índice, repositorio institucional, despliegue, roles, URL de ambiente y pruebas. | Pendiente aprobación institucional |
| 1.2 | 2026-07-30 | Dirección Nacional de Defensoría Pública (DNDP) - Grupo de Transformación Digital | Incorporación de controles vigentes de sesión, LDAP, usuarios administrados, errores, cargas, PWA y datos personales. | Pendiente aprobación institucional |

## Tabla de contenido

Índice generado con la estructura de títulos del documento.

Objeto

Autenticación y autorización

Custodia de código y secretos

Trazabilidad

Diagramas de apoyo

Diagrama de autenticación y roles de Aurora


## Objeto

Este documento establece lineamientos de seguridad para autenticación, autorización, custodia del código, secretos, datos personales y operación de Aurora.

## Autenticación y autorización

| Elemento | Configuración / comportamiento |
| --- | --- |
| Autenticación institucional | Microsoft Entra ID / Azure AD mediante App Registration y MSAL. |
| Rol usuario | Consulta, diligenciamiento de formularios, descarga de formatos y operación ordinaria. |
| Rol admin | Acceso a módulos administrativos como Cargas mensuales y actividades de soporte. |
| Variables | AZURE_AD_REQUIRED_APP_ROLES, AZURE_AD_REQUIRED_GROUP_IDS y CARGUEBD_ADMIN_ROLES. |
| Azure DevOps | Repositorio institucional de código; no administra el ingreso funcional de usuarios finales. |

La entidad define los grupos o roles en Microsoft Entra ID. Azure DevOps se usa para repositorio y control de código; no reemplaza el directorio institucional de autenticación de usuarios finales.

Los roles vigentes son `user`, `pag`, `admin`, `carguebd` y `cargas_bd`. `pag` protege asignaciones y creación de defensores; `admin` protege la administración de usuarios; los roles configurados en `CARGUEBD_ADMIN_ROLES` habilitan cargas y depuración controlada. Las rutas verifican privilegios en el backend aunque el menú no se muestre.

En producción se usa `AUTH_USER_ACCESS_MODE=managed` cuando la política exige lista cerrada. `AUTH_BOOTSTRAP_ADMIN_EMAILS` se limita a la puesta en marcha y se retira al existir administradores estables. Deshabilitar un usuario o modificar sus roles surte efecto en las peticiones posteriores.

LDAP es una alternativa de bind directo y no un inicio transparente. Solo se habilita con URL, dominio y dominios de correo permitidos. LDAPS es el protocolo indicado cuando la infraestructura lo soporta. La contraseña se usa para el bind y no se almacena.

## Custodia de código y secretos

- La versión cero se entrega en SharePoint.

- El repositorio institucional posterior será Azure DevOps.

- No versionar .env ni credenciales.

- No versionar Excel con datos personales.

- Usar cuentas nominales y permisos mínimos necesarios.

- Mantener `AUTH_JWT_SECRET`, credenciales Oracle, certificados y valores sensibles en el mecanismo institucional de secretos.

- Montar certificados privados en solo lectura y excluir `backend/storage/` del repositorio y de las capas de imagen.

## Trazabilidad

La aplicación mantiene identidad y roles de sesión. El módulo de cargas conserva usuario asociado a la carga. La auditoría de edición de formularios requiere definición de campos o tabla de auditoría en Oracle si la entidad exige trazabilidad nominal por registro modificado.

## Seguridad de aplicación

- Helmet establece cabeceras HTTP defensivas.
- El cuerpo JSON se limita a 256 KB y cargas e importaciones tienen límites propios.
- Los endpoints de login aplican rate limiting.
- Los JWT verifican algoritmo, firma, emisor, audiencia y expiración.
- Las consultas usan binds Oracle; esquema y secuencia pasan por validación de identificadores.
- Las respuestas de error productivas no publican stack, SQL, valores enlazados ni detalles de infraestructura.
- Los errores de cargas se sanejan y se truncan mediante `CARGUEBD_PUBLIC_ERROR_MAX_LENGTH`.
- La limpieza administrativa exige rol, vista previa, confirmación, defensor permitido y transacción.

## Seguridad de PWA y trabajo sin conexión

El service worker no reemplaza autorización. Las rutas protegidas requieren JWT al recuperar conectividad. La cola offline solo admite escrituras previstas, registra la identidad propietaria y se vacía al cerrar sesión o cambiar de cuenta. No reproduce una operación creada por otra identidad.

## Protección de datos personales

Aurora trata datos jurídicos y personales. El usuario acepta el aviso de tratamiento después de autenticarse; rechazarlo termina la sesión. Capturas, PDF, Excel, logs y evidencias se comparten únicamente por canales autorizados y con la mínima información necesaria.

Los ambientes de desarrollo y prueba usan datos sintéticos o anonimizados. Las pruebas de escritura se ejecutan exclusivamente sobre esquemas temporales.

## Gestión de vulnerabilidades

Antes de una entrega se ejecutan lint, pruebas, build, auditorías de dependencias y construcción Docker. Las actualizaciones conservan los archivos de bloqueo y pasan por regresión funcional. La imagen se reconstruye para incorporar correcciones de su base y los tutoriales incluidos se verifican con `SHA256SUMS`.

## Respuesta a incidentes

Ante acceso indebido, filtración de secreto o comportamiento anómalo se preservan logs, se identifica la versión, se revocan sesiones y credenciales, se contiene el acceso y se activa el proceso institucional. La recuperación utiliza artefactos y respaldos conocidos.

## Lista de comprobación

- HTTPS válido y origen de Entra ID exacto.
- Login local deshabilitado salvo excepción temporal documentada.
- Proveedor, dominios, grupos y roles validados.
- Modo administrado y administrador inicial comprobados.
- Secretos fuera del repositorio.
- Volúmenes con permisos mínimos y respaldo probado.
- Auditorías de dependencias atendidas.
- Logs sin tokens, contraseñas ni trazas expuestas al cliente.

## Diagramas de apoyo

### Diagrama de autenticación y roles de Aurora

![Ilustración 4 de Lineamientos de seguridad de Aurora](assets/diagrama_autenticacion_roles_aurora.png)

Figura. Diagrama de autenticación y roles de Aurora.
