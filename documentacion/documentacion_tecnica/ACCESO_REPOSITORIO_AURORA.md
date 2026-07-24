# Acceso al repositorio Aurora

Fecha de actualización: 2026-07-24

## Introducción

Este documento establece recomendaciones técnicas para el acceso y manejo del repositorio Aurora.

## Descripción del repositorio privado

El repositorio contiene:

- Código fuente frontend y backend.
- Scripts de pruebas y despliegue.
- Documentación técnica.
- Plantillas de variables de entorno.
- Tutoriales institucionales versionados y verificados por suma SHA-256.

El repositorio oficial es:

```text
https://github.com/shcampinof/AuroraV2-oracle
```

El repositorio debe mantenerse privado y con acceso nominal controlado. La visibilidad no debe ampliarse para facilitar un despliegue; infraestructura debe usar credenciales de lectura o un paquete institucional autorizado.

## Cuentas autorizadas

Se recomienda:

- Usar cuentas nominales.
- Evitar cuentas compartidas.
- Dar acceso solo a personas con función técnica o de validación autorizada.
- Revisar permisos de forma periódica.
- Revocar accesos cuando una persona deje de participar en el proyecto.

## Rama principal sugerida

La rama principal operativa configurada para este repositorio es `master`.

## Proceso para solicitar acceso

Flujo recomendado:

1. Solicitar acceso al responsable técnico del proyecto.
2. Justificar el rol o actividad.
3. Confirmar usuario o correo de la plataforma Git.
4. Asignar permisos mínimos necesarios.
5. Registrar fecha de aprobación y responsable.

## Buenas prácticas para clonar

```bash
git clone https://github.com/shcampinof/AuroraV2-oracle
cd aurora
git status
```

Después de clonar:

- No crear `.env` con valores reales hasta estar en el ambiente autorizado.
- Revisar `README.md` y documentación técnica.
- Instalar dependencias solo desde fuentes confiables.

## Buenas prácticas para ramas

Usar nombres descriptivos:

- `feature/nombre-corto`
- `fix/nombre-corto`
- `documentacion/soporte/nombre-corto`
- `chore/nombre-corto`

Evitar trabajar directamente sobre la rama principal.

## Recomendaciones antes de hacer push

- Ejecutar pruebas relevantes.
- Revisar `git status`.
- Revisar `git diff`.
- Confirmar que no se agregaron `.env`, dumps, exportaciones de datos o credenciales.
- Evitar subir `node_modules`.
- Confirmar que cada archivo nuevo es menor al límite admitido por la plataforma; los videos actuales son inferiores a 100 MB por archivo.
- Documentar cambios relevantes en Markdown si afectan operación.

## Archivos que no deben subirse

- `.env`
- `.env.*`
- `backend/.env`
- `backend/.env.*`
- `frontend/.env`
- `frontend/.env.*`
- `node_modules/`
- Respaldos de base de datos.
- Archivos con credenciales.
- Exportaciones o muestras con datos personales no anonimizados.
- `backend/storage/`, logs operativos, cargas Excel y certificados.
- Entregables documentales binarios; la fuente Markdown sí acompaña al código.

## Uso de `.gitignore`

El repositorio cuenta con patrones para ignorar archivos de entorno y dependencias. Se recomienda validar:

```bash
git check-ignore -v .env backend/.env backend/.env.test frontend/.env
```

Si se agrega una nueva carpeta con secretos o salidas generadas, actualizar `.gitignore`.

## Releases o etiquetas

Se recomienda crear etiquetas para versiones desplegadas:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Cada release debería indicar:

- Fecha.
- Rama o commit.
- Cambios principales.
- Resultado de pruebas.
- Responsable técnico.

## Recomendaciones finales

- Mantener el repositorio privado.
- Definir oficialmente la rama principal.
- No compartir el código por canales alternos sin autorización.
- Documentar accesos, releases y despliegues.
