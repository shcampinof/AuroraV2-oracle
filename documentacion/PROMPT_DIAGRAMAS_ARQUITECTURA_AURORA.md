# Prompt para diagramas de arquitectura Aurora

Usar el siguiente texto en una herramienta de generación o diagramación visual:

```text
Diseñar un conjunto de diagramas de arquitectura institucional para el sistema Aurora de la Dirección Nacional de Defensoría Pública.

Generar cinco diagramas claros, sobrios y aptos para documentación técnica:

1. Diagrama de contexto:
   - Usuario funcional autorizado.
   - Usuario administrador.
   - Navegador web.
   - Sistema Aurora.
   - Microsoft Entra ID / Azure AD para autenticación.
   - Oracle como base de datos.
   - SharePoint como ubicación de versión cero del código.
   - Azure DevOps como repositorio institucional posterior.

2. Diagrama de componentes:
   - Frontend React/Vite.
   - Backend Node.js/Express.
   - API bajo /api.
   - Middleware de autenticación.
   - Rutas de personas, defensores, formatos y cargas.
   - Repositorios Oracle.
   - Servicios Python de cargas.
   - Volumen persistente para archivos/logs de cargas.

3. Diagrama de despliegue:
   - Servidor de aplicaciones.
   - Docker Compose.
   - Contenedor Aurora.
   - Puerto interno y publicado 7860.
   - Posible proxy HTTPS institucional.
   - Servidor Oracle puerto 1521.
   - Variables .env administradas fuera del repositorio.

4. Diagrama de autenticación y roles:
   - Login institucional con Microsoft Entra ID.
   - App Registration.
   - Roles admin y user.
   - Validación de tenant, client ID, grupos o roles.
   - Token de sesión Aurora.
   - Usuario funcional con módulos ordinarios.
   - Administrador con módulo Cargas mensuales.

5. Diagrama de cargas Excel/staging/ETL:
   - Archivos .xlsx de PONAL, SISIPEC y Aurora 1.0.
   - Módulo Cargas mensuales.
   - Backend recibe archivo.
   - Registro de usuario, estado y log.
   - Servicio Python loader_service.py.
   - Tablas staging.
   - Procedimientos ETL Oracle.
   - Tablas de negocio PERSONA, SITUACION_CARCELARIA, GESTION_JURIDICA y ASIGNACION.

Estilo visual:
   - Formato institucional, limpio y legible.
   - Usar cajas rectangulares, flechas direccionales y agrupación por capas.
   - Evitar elementos decorativos innecesarios.
   - Incluir título en cada diagrama.
   - Exportar en PNG para insertar en documento Word.
```
