# Plan de acciones de mejora - Documentacion Word Aurora

Fecha de revision: 2026-05-28  
Alcance: documentos Word de `documentacion/documentacion_word/`, excluyendo documentos de base de datos.

## 1. Documentos revisados

Los archivos duplicados que estaban en `documentacion/documentacion_word/Documentacion Word/` fueron retirados. La ruta unica de trabajo queda en `documentacion/documentacion_word/`.

Documentos dentro del alcance:

| Documento | Observacion principal |
|---|---|
| `ACCESO_REPOSITORIO_AURORA.docx` | Referencia GitHub como repositorio oficial; debe migrar el discurso a Azure DevOps y SharePoint. |
| `ARQUITECTURA_SISTEMA_AURORA.docx` | Tiene descripcion textual, pero no diagramas visuales de arquitectura, componentes o red. |
| `DESCRIPCION_CODIGO_FUENTE_AURORA.docx` | Debe basarse en el codigo consolidado en SharePoint y especificar configuraciones de conexion, Azure Tenant y archivos de relacion. |
| `GUIA_DESPLIEGUE_AURORA.docx` | Usa GitHub y `localhost`; debe ajustarse al ambiente real de pruebas/preproduccion. |
| `INFRAESTRUCTURA_AURORA.docx` | Debe declarar expresamente si la entidad entrego servidor de aplicaciones y servidor de base de datos. |
| `LINEAMIENTOS_SEGURIDAD_AURORA.docx` | Requiere ajuste de plantilla, control de cambios y alineacion con repositorio institucional. |
| `MANUAL_TECNICO_AURORA.docx` | Contiene base tecnica util, pero debe integrarse con arquitectura, despliegue e infraestructura institucional. |
| `MANUAL_USUARIO_AURORA.docx` | Tiene capturas, pero el tono sigue siendo tecnico. Debe reescribirse en lenguaje ciudadano y paso a paso funcional. |
| `VALIDACION_POST_DESPLIEGUE_AURORA.docx` | Es checklist tecnico; falta convertirlo o complementarlo con plan/resultados de pruebas, casos y evidencias de usuarios. |

Fuera del alcance de esta revision:

| Documento | Motivo |
|---|---|
| `DESCRIPCION_MODELO_DATOS_AURORA.docx` | Corresponde al frente de base de datos. |
| `documentacion/documentacion_tecnica/base_datos/Explicación del modelo y objetos.docx` | Corresponde al frente de base de datos. |

## 2. Hallazgos transversales contra el correo de Sofia

| Solicitud de Sofia | Estado observado | Accion propuesta |
|---|---|---|
| Aplicar plantilla institucional | Existe `Plantilla-Documento-Word-Diseño-1-2025-2.docx`, pero los documentos no parecen estar construidos sobre ella. | Rehacer cada Word desde la plantilla oficial, trasladando contenido limpio y usando estilos institucionales. |
| Corregir maquetacion interna | No se detecto indice automatico en los Word; la jerarquia parece textual. | Usar estilos `Titulo 1`, `Titulo 2`, `Titulo 3`, listas y tablas nativas. Generar tabla de contenido automatica. |
| Incluir control de versiones e historial de cambios | No se evidencia cuadro estandar al inicio. | Agregar tabla de control documental despues de portada: version, fecha, autor, revisor, descripcion del cambio. |
| Respetar estructura de carpetas solicitada | Corregido parcialmente: se elimino la carpeta anidada duplicada y queda una sola ruta de Word. | Confirmar la estructura oficial de entrega solicitada por la entidad. |
| Servidor de aplicaciones y BD | `INFRAESTRUCTURA_AURORA.docx` dice que no se pudo validar topologia productiva. | Reemplazar por una seccion de ambientes: desarrollo, pruebas/preproduccion y produccion, indicando servidor entregado/no entregado. |
| Caso de negocio o necesidad | No existe documento Word especifico de linea base/caso de negocio. | Crear o anexar "Linea base y caso de negocio" con antecedentes, necesidad, usuarios beneficiarios, alcance e historias de usuario/casos de uso. |
| Repositorio oficial Azure DevOps | `ACCESO_REPOSITORIO_AURORA.docx` y `GUIA_DESPLIEGUE_AURORA.docx` citan GitHub. | Cambiar a flujo oficial: SharePoint como version cero y Azure DevOps como repositorio institucional. GitHub debe quedar solo como antecedente tecnico, si se permite mencionarlo. |
| Diagramas de arquitectura | `ARQUITECTURA_SISTEMA_AURORA.docx` no tiene imagenes ni diagramas embebidos. | Incluir minimo: diagrama de contexto, componentes, despliegue/red, flujo de autenticacion, flujo de cargas Excel/ETL. |
| Configuracion, Tenant Azure y archivos de relacion | Existe informacion dispersa en documentos tecnicos y soporte. | Consolidar en `DESCRIPCION_CODIGO_FUENTE_AURORA.docx` una matriz de variables, archivos `.env.example`, Azure Tenant/App Registration y rutas de relacion. |
| URL real de ambiente | Varios documentos usan `localhost`. Se identifico IP privada temporal del servidor: `172.31.64.7`. | Documentar `http://172.31.64.7:7860` como URL temporal de pruebas, sujeta a validacion de red/firewall. Mantener `localhost` solo para diagnostico local y dejar URL institucional HTTPS pendiente por Infraestructura. Ver `documentacion/AJUSTE_URL_AMBIENTE_AURORA.md`. |
| Manual de usuario ciudadano | Manual actual menciona codigo, endpoints y limitaciones de revision. | Reescribir por tareas: ingresar, consultar, filtrar, diligenciar formulario, guardar, asignar defensor, descargar formatos, cargar Excel si aplica. |
| Plan/resultados de pruebas y validacion de usuarios | Hay checklist post despliegue, pero faltan actas y evidencia de usuario. | Crear documento formal de plan de pruebas, matriz de casos, resultados, responsables, ambiente y soportes firmados. |
| Carga de Excel externos | Hay soporte tecnico en `documentacion/soporte/operacion/16_cargas_staging_etl_bd.md`, pero debe quedar en Word funcional. | Incorporar seccion operativa: origen de Excel, responsable, ruta de carga, validaciones, ETL, log, errores comunes y evidencia esperada. |

## 3. Acciones por documento

### ACCESO_REPOSITORIO_AURORA.docx

Prioridad: alta.

Cambios requeridos:

- Eliminar la frase "El repositorio oficial es: https://github.com/shcampinof/AuroraV2-oracle".
- Reemplazar por el flujo acordado:
  - El codigo fuente consolidado se entrega en la carpeta designada de SharePoint como version cero.
  - La entidad realizara el despliegue o importacion inicial en Azure DevOps.
  - Azure DevOps sera el repositorio institucional oficial para control de cambios posteriores.
- Incluir tabla de responsables: propietario funcional, responsable tecnico, custodio SharePoint, administrador Azure DevOps.
- Incluir procedimiento de entrega: compresion/versionado, checksum opcional, fecha, responsable, ruta SharePoint, acta de entrega.
- Dejar GitHub solo como "repositorio de trabajo previo" si la entidad autoriza mencionarlo; de lo contrario, retirarlo completamente.

### ARQUITECTURA_SISTEMA_AURORA.docx

Prioridad: alta.

Cambios requeridos:

- Insertar diagramas visuales:
  - Diagrama de contexto: usuario autorizado, navegador, Aurora, Azure AD, Oracle, fuentes Excel.
  - Diagrama de componentes: frontend React, backend Express, rutas API, servicios, repositorios Oracle, modulo de cargas.
  - Diagrama de despliegue/red: servidor de aplicaciones, servidor de base de datos, puertos, HTTPS/proxy si aplica.
  - Diagrama de flujo de autenticacion: Azure AD, token, JWT interno, consumo API.
  - Diagrama de cargas: Excel PONAL/SISIPEC/Aurora 1.0, upload, staging, procedimiento ETL, tablas de negocio, logs.
- Agregar seccion "Supuestos de infraestructura" separando confirmado vs pendiente por confirmar.
- Usar como soporte `documentacion/soporte/vision/01_vision_general.md`, `documentacion/soporte/api_integraciones/14_integracion_sso_azure_ad.md` y `documentacion/soporte/operacion/16_cargas_staging_etl_bd.md`.

### DESCRIPCION_CODIGO_FUENTE_AURORA.docx

Prioridad: alta.

Cambios requeridos:

- Ajustar la estructura del repositorio a la version consolidada que se subira a SharePoint.
- Agregar seccion de configuracion:
  - Variables backend: `PORT`, `NODE_ENV`, `AUTH_JWT_SECRET`, `AZURE_AD_TENANT_ID`, `AZURE_AD_CLIENT_ID`, `ORACLE_*`, `AURORA_CARGAS_DIR`, `CARGUEBD_*`.
  - Variables frontend: `VITE_API_BASE_URL`, `VITE_DEV_API_TARGET`, `VITE_DEV_PORT`.
  - Archivos de ejemplo: `.env.example`, `backend/.env.example`.
- Agregar seccion "Registro Azure Tenant":
  - Tenant ID, Client ID, redirect URI, dominios permitidos, grupos/roles requeridos.
  - Dejar campos como "por confirmar por la entidad" si no se cuenta con valores reales.
- Agregar matriz de archivos de relacion:
  - `frontend/src/services/api.js` hacia backend.
  - `backend/routes/*.js` hacia servicios/repositorios.
  - `backend/repositories/oracle/*.js` hacia Oracle.
  - `scripts/cargas_bd/*.py` hacia staging/ETL.
- Quitar referencias a rutas inexistentes o antiguas como `docs/`, `BD Documentation/` si no hacen parte de la entrega final.

### GUIA_DESPLIEGUE_AURORA.docx

Prioridad: alta.

Cambios requeridos:

- Cambiar "clonar GitHub" por "tomar version cero desde SharePoint" o "clonar Azure DevOps" segun el momento institucional.
- Sustituir `http://localhost:7860` por la URL real del ambiente de pruebas/preproduccion.
- Conservar `localhost` solo en un anexo "Ejecucion local para diagnostico tecnico".
- Para el ambiente actual, usar como URL temporal: `http://172.31.64.7:7860`. Si la entidad asigna DNS/HTTPS, reemplazarla por la URL institucional definitiva.
- Mantener Docker Compose como mecanismo oficial de despliegue. La prueba con Node.js solo debe citarse como validacion temporal cuando Docker no este disponible. Ver `documentacion/DESPLIEGUE_DOCKER_AURORA.md`.
- Agregar datos de ambiente:
  - URL aplicacion.
  - URL/API base.
  - servidor de aplicaciones.
  - servidor de base de datos.
  - puerto publicado.
  - responsable de variables de entorno.
- Agregar paso de validacion posterior con evidencia: `/api/health`, `/api/health/db`, login, consulta, carga Excel de prueba si aplica.

### INFRAESTRUCTURA_AURORA.docx

Prioridad: alta.

Cambios requeridos:

- Reemplazar "ambiente local identificado" como cuerpo principal por "ambientes institucionales".
- Crear tabla:
  - Ambiente.
  - Servidor de aplicaciones.
  - Servidor de base de datos.
  - URL.
  - Sistema operativo.
  - Runtime.
  - Estado de entrega.
  - Responsable.
- Agregar declaracion explicita solicitada por Sofia:
  - "Servidor de aplicaciones: entregado/no entregado/pendiente de confirmacion".
  - "Servidor de base de datos: entregado/no entregado/pendiente de confirmacion".
- Mantener la informacion local solo como anexo de desarrollo.

### LINEAMIENTOS_SEGURIDAD_AURORA.docx

Prioridad: media.

Cambios requeridos:

- Aplicar plantilla, control de versiones e indice.
- Alinear la seccion de repositorio con SharePoint/Azure DevOps.
- Incluir reglas de custodia de codigo fuente y datos:
  - No subir `.env`.
  - No versionar Excel mensuales ni datos personales.
  - Accesos nominales.
  - Revision periodica de permisos.
  - Logs sin credenciales.
- Incluir administracion de usuarios por Azure AD: grupos, roles, revocacion y responsable.

### MANUAL_TECNICO_AURORA.docx

Prioridad: media.

Cambios requeridos:

- Evitar duplicar extensamente arquitectura, despliegue e infraestructura. Referenciar esos documentos y concentrarse en operacion tecnica.
- Incluir secciones de mantenimiento:
  - revision de logs.
  - reinicio del servicio.
  - verificacion de salud.
  - revision de variables.
  - carga mensual y diagnostico.
- Corregir menciones a `localhost` como ambiente principal.
- Agregar advertencias de seguridad y separacion entre desarrollo, pruebas y produccion.

### MANUAL_USUARIO_AURORA.docx

Prioridad: alta.

Cambios requeridos:

- Reescribir en lenguaje ciudadano. Evitar:
  - nombres de archivos de codigo.
  - endpoints.
  - frases como "no se pudo validar en esta revision".
  - conceptos internos como PUT/POST, backend, frontend.
- Estructura sugerida:
  - Objetivo del manual.
  - Ingreso al sistema.
  - Consultar una persona por documento.
  - Revisar usuarios asignados.
  - Diligenciar formulario de atencion.
  - Guardar informacion.
  - Consultar historial de actuaciones.
  - Asignar o reasignar defensor.
  - Descargar formatos.
  - Cargar archivos mensuales, solo si el perfil del usuario lo permite.
  - Mensajes frecuentes y que hacer.
- Mantener y actualizar capturas reales. Cada captura debe tener un paso asociado y texto funcional breve.
- Separar "manual de usuario final" de "manual de administrador de cargas" si la entidad prefiere roles diferenciados.

### VALIDACION_POST_DESPLIEGUE_AURORA.docx

Prioridad: alta.

Cambios requeridos:

- Convertirlo en "Plan y resultados de pruebas" o crear un documento adicional.
- Agregar matriz de casos de prueba:
  - ID.
  - modulo.
  - caso.
  - precondicion.
  - pasos.
  - resultado esperado.
  - resultado obtenido.
  - responsable.
  - fecha.
  - evidencia.
  - estado.
- Incluir seccion de validacion por usuarios:
  - usuarios participantes.
  - perfil/cargo.
  - ambiente usado.
  - fecha de ejecucion.
  - acta o soporte.
  - observaciones.
- El checklist post despliegue puede quedar como anexo tecnico.
- Usar como soporte `documentacion/soporte/pruebas/06_estrategia_de_pruebas.md`, `documentacion/soporte/pruebas/09_validacion_funcional_2026-03-09.md`, `documentacion/soporte/pruebas/11_protocolo_de_pruebas.md` y `documentacion/soporte/pruebas/SET_PRUEBAS_AURORA.md`.

## 4. Documento faltante recomendado

Se recomienda crear un Word nuevo:

`LINEA_BASE_CASO_NEGOCIO_AURORA.docx`

Contenido minimo:

- Antecedentes o reseña historica.
- Necesidad del area usuaria.
- Problema operativo que resuelve Aurora.
- Objetivos generales y especificos.
- Usuarios beneficiarios.
- Alcance funcional.
- Beneficios esperados para la Direccion y usuarios.
- Historias de usuario o casos de uso.
- Supuestos, restricciones y dependencias.

Soporte local disponible: `documentacion/soporte/vision/01_vision_general.md`.

## 5. Insumos que se deben solicitar a la entidad

Para cerrar las observaciones sin dejar textos "por confirmar", se necesitan estos datos:

| Insumo | Para que documento aplica |
|---|---|
| Estructura oficial de carpetas de entrega | Todos |
| Ruta SharePoint designada para version cero | Acceso repositorio, codigo fuente, despliegue |
| URL o direccionamiento real del ambiente de pruebas/preproduccion | Guia despliegue, infraestructura, validacion |
| Datos del servidor de aplicaciones entregado | Infraestructura, arquitectura, despliegue |
| Datos del servidor de base de datos entregado | Infraestructura, arquitectura, despliegue |
| Tenant ID y Client ID de Azure AD | Codigo fuente, seguridad, despliegue |
| Grupos o roles Azure autorizados | Codigo fuente, seguridad, manual usuario |
| Confirmacion de Azure DevOps: organizacion, proyecto y repositorio | Acceso repositorio |
| Actas o soportes de pruebas funcionales de usuarios | Plan/resultados de pruebas |
| Capturas reales del ambiente institucional | Manual usuario, guia despliegue |
| Responsable institucional de cargas Excel y periodicidad | Manual usuario, manual tecnico, pruebas |

## 6. Orden sugerido de implementacion

1. Confirmar la carpeta oficial de entrega con la entidad.
2. Aplicar plantilla institucional, portada, control de cambios e indice automatico a todos los Word.
3. Corregir primero los documentos con observaciones juridico-institucionales: repositorio, despliegue, infraestructura y codigo fuente.
4. Actualizar arquitectura con diagramas.
5. Reescribir manual de usuario en lenguaje ciudadano.
6. Crear o completar linea base/caso de negocio.
7. Convertir validacion post despliegue en plan/resultados de pruebas con evidencias.
8. Revisar consistencia final: nombres de carpetas, versiones, fechas, responsables, URL real, repositorio oficial y ausencia de referencias no oficiales.

## 7. Riesgos si se entrega sin ajustes

- La entidad puede rechazar nuevamente los documentos por no usar plantilla ni estructura oficial.
- GitHub como repositorio "oficial" contradice el estandar Azure DevOps indicado por Sofia.
- `localhost` puede interpretarse como ausencia de ambiente institucional de pruebas.
- Sin diagramas, arquitectura no cumple el requisito minimo de modelado visual.
- Sin actas o casos de prueba, la validacion funcional queda incompleta.
- El manual de usuario puede no ser aceptado por lenguaje demasiado tecnico.
