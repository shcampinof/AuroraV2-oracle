# Validación posterior al despliegue de Aurora

> Estado documental: vigente al 2026-07-30.

![Ilustración 1 de Validación posterior al despliegue de Aurora](assets/identidad_defensoria.png)

![Ilustración 2 de Validación posterior al despliegue de Aurora](assets/visual_derechos_humanos.png)

![Ilustración 3 de Validación posterior al despliegue de Aurora](assets/fondo_institucional.png)

## Control de cambios

| Versión | Fecha | Responsable | Descripción del cambio | Aprobación |
| --- | --- | --- | --- | --- |
| 1.0 | 2026-05-19 | Dirección Nacional de Defensoría Pública (DNDP) - Grupo de Transformación Digital | Versión inicial de entrega técnica. | Equipo DNDP |
| 1.1 | 2026-05-28 | Dirección Nacional de Defensoría Pública (DNDP) - Grupo de Transformación Digital | Ajuste de formato institucional, control documental, índice, repositorio institucional, despliegue, roles, URL de ambiente y pruebas. | Pendiente aprobación institucional |
| 1.2 | 2026-07-30 | Dirección Nacional de Defensoría Pública (DNDP) - Grupo de Transformación Digital | Ampliación de pruebas automatizadas, seguridad, usuarios, LDAP, PWA, codificación, reversión y criterios de cierre. | Pendiente aprobación institucional |

## Tabla de contenido

Índice generado con la estructura de títulos del documento.

Objeto

Datos de ambiente

Alcance de pruebas

Matriz de casos de prueba

Registro de evidencias

Diagramas de apoyo

Diagrama de despliegue de Aurora

Diagrama de cargas Excel, staging y ETL de Aurora


## Objeto

Este documento formaliza el plan de pruebas funcionales y técnicas para el ambiente de pruebas/preproducción de Aurora. Los resultados y evidencias se completarán durante la jornada de ejecución definida por el equipo responsable.

## Datos de ambiente

| Elemento | Detalle |
| --- | --- |
| URL interna servidor | http://127.0.0.1:7860 |
| URL temporal IP privada | http://172.31.64.7:7860 |
| URL túnel de prueba | http://localhost:8787 |
| URL institucional definitiva | Pendiente de asignación por Infraestructura |
| Método de despliegue esperado | Docker Compose |

## Alcance de pruebas

- Cargue de archivos .xlsx para staging de base de datos.

- Asignación de 10 a 20 usuarios por parte de PAG.

- Reasignación de defensor.

- Diligenciamiento de 10 casos condenados y 5 casos sindicados.

- Validación de cambio de estado o acción a impulsar según avance del formulario.

- Generación de 15 PDF de consolidación de atención.

- Prueba de filtros de PAG - Asignación de usuarios.

- Prueba de filtros de Usuarios asignados.

- Descarga de todos los formatos disponibles.

## Matriz de casos de prueba

| ID | Módulo | Caso | Resultado esperado | Estado |
| --- | --- | --- | --- | --- |
| AUR-001 | Despliegue | Validar /api/health | Servicio operativo | Pendiente ejecución |
| AUR-002 | Base de datos | Validar /api/health/db | Conexión Oracle exitosa | Pendiente ejecución |
| AUR-003 | Autenticación | Ingreso usuario funcional | Acceso a módulos autorizados | Pendiente ejecución |
| AUR-004 | Autenticación | Ingreso usuario admin | Acceso a Cargas mensuales | Pendiente ejecución |
| AUR-005 | Cargas | Cargar Excel PONAL/SISIPEC/Aurora 1.0 | Carga recibida y procesada o error documentado | Pendiente ejecución |
| AUR-006 | PAG | Asignar 10 a 20 usuarios | Asignaciones guardadas | Pendiente ejecución |
| AUR-007 | PAG | Reasignar defensor | Defensor actualizado | Pendiente ejecución |
| AUR-008 | Formulario | Diligenciar 10 condenados | Estados actualizados según avance | Pendiente ejecución |
| AUR-009 | Formulario | Diligenciar 5 sindicados | Estados actualizados según avance | Pendiente ejecución |
| AUR-010 | PDF | Generar 15 consolidaciones | PDF generados correctamente | Pendiente ejecución |
| AUR-011 | Filtros | Validar filtros PAG y Usuarios asignados | Resultados coherentes con criterios | Pendiente ejecución |
| AUR-012 | Formatos | Descargar todos los formatos | Descargas disponibles | Pendiente ejecución |
| AUR-013 | Usuarios | Crear, editar, deshabilitar e importar CSV | Permisos, validaciones y cambios aplicados | Pendiente ejecución |
| AUR-014 | Roles | Probar user, pag, admin y cargas | Menús y API respetan cada privilegio | Pendiente ejecución |
| AUR-015 | Datos heredados | Buscar defensor con tilde y mojibake | Casos localizables y nombre canónico cuando existe cédula | Pendiente ejecución |
| AUR-016 | PWA | Encolar escritura, cerrar sesión y cambiar usuario | No se reproduce una operación de otra identidad | Pendiente ejecución |
| AUR-017 | Seguridad | Forzar error controlado de API | Respuesta sin stack, SQL, binds ni secreto | Pendiente ejecución |
| AUR-018 | Persistencia | Recrear contenedor conservando volúmenes | Usuarios y cargas permanecen | Pendiente ejecución |
| AUR-019 | Recuperación | Volver a versión aprobada | Servicio y datos disponibles sin pérdida | Pendiente ejecución |

## Registro de evidencias

| Evidencia | Responsable | Fecha | Observación |
| --- | --- | --- | --- |
| Capturas de despliegue Docker |   |   |   |
| Capturas de login y roles |   |   |   |
| Acta o soporte de usuarios funcionales |   |   |   |
| Listado de casos probados |   |   |   |
| PDF generados |   |   |   |
| Resultados de cargas .xlsx |   |   |   |

## Validación automatizada previa

Desde una copia limpia, con las versiones declaradas:

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

`qa:smoke` ejecuta lint, pruebas frontend, build y pruebas backend. La suite backend incluye autenticación, PAG, importación CSV, cargas, depuración, seguridad de asignaciones y búsqueda de mojibake. La suite frontend cubre reglas de negocio, estados, validaciones, PWA y manual interactivo.

La comprobación Oracle se ejecuta desde el ambiente autorizado:

```bash
npm --prefix backend run smoke:oracle
```

Las pruebas de escritura API y la preparación de base de prueba se dirigen exclusivamente a un esquema temporal distinto de `DNDP`.

## Validación de configuración y contenedor

```bash
docker compose ps
docker compose logs --tail=200 aurora
curl -k https://127.0.0.1:7860/api/health
curl -k https://127.0.0.1:7860/api/health/db
curl -k https://127.0.0.1:7860/api/auth/config
```

Se confirma que el contenedor está `healthy`, no reinicia, escucha en el puerto previsto y no registra secretos ni errores críticos. `/api/auth/config` devuelve únicamente configuración pública. La URL cliente usa certificado válido y el origen coincide con la Redirect URI SPA de Entra ID.

## Preparación de datos de prueba

El responsable funcional selecciona casos sintéticos o autorizados que cubran condenado, sindicado, sin actuación, actuación incompleta, caso cerrado, defensor con tilde, defensor con texto mal decodificado y registros aptos para reasignación. Cada identificador queda en evidencia restringida.

Para cargas se usan copias aprobadas con estructura real y datos anonimizados. Se conserva un archivo válido por fuente y versiones negativas: extensión incorrecta, tamaño excedido, columnas faltantes y error ETL controlado.

## Criterios de cierre

El despliegue se acepta cuando:

- Todas las pruebas críticas están aprobadas o cuentan con excepción formal, responsable y fecha.
- Salud, Oracle, identidad, roles, consulta, guardado, asignación y persistencia funcionan.
- No aparecen secretos ni detalles internos en respuestas y logs revisados.
- Se identifican versión de código, imagen, variables, esquema y responsables.
- Existen respaldo previo y procedimiento de reversión probado.
- Las evidencias están en el repositorio documental autorizado.

Un resultado pendiente no equivale a aprobado. Las filas de la matriz se actualizan con `Aprobado`, `Fallido`, `Bloqueado` o `No aplica`, evidencia y observación.

## Reversión

Ante un defecto crítico se detiene la publicación, se preservan logs y se vuelve a la etiqueta o imagen aprobada anterior sin eliminar volúmenes. Los cambios Oracle se revierten solo con el procedimiento acordado con DBA. Después de la reversión se repiten salud, conexión, login y consulta.

## Formato de incidente

Registrar fecha y hora, ambiente, versión, rol, módulo, pasos, resultado esperado, resultado observado, identificador de evidencia y severidad. No incluir contraseñas, tokens, cadenas completas de conexión ni datos personales innecesarios.

## Diagramas de apoyo

### Diagrama de despliegue de Aurora

![Ilustración 4 de Validación posterior al despliegue de Aurora](assets/diagrama_despliegue_aurora.png)

Figura. Diagrama de despliegue de Aurora.

### Diagrama de cargas Excel, staging y ETL de Aurora

![Ilustración 5 de Validación posterior al despliegue de Aurora](assets/diagrama_cargas_staging_etl_aurora.png)

Figura. Diagrama de cargas Excel, staging y ETL de Aurora.
