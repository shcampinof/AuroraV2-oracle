# Acceso al repositorio Aurora

Fecha de generación: 2026-05-12

## Introducción

Este documento establece recomendaciones técnicas para el acceso y manejo del repositorio privado de Aurora. No incluye una URL real porque no se identificó una URL oficial de repositorio en los archivos revisados.

## Descripción del repositorio privado

El repositorio contiene:

- Código fuente frontend y backend.
- Scripts de pruebas y despliegue.
- Documentación técnica.
- Plantillas de variables de entorno.
- Archivos de datos locales que podrían contener información sensible.

Por el tipo de información y el propósito del sistema, se recomienda mantenerlo como repositorio privado.

## Cuentas autorizadas

Se recomienda:

- Usar cuentas nominales.
- Evitar cuentas compartidas.
- Dar acceso solo a personas con función técnica o de revisión autorizada.
- Revisar permisos de forma periódica.
- Revocar accesos cuando una persona deje de participar en el proyecto.

## Rama principal sugerida

El README menciona publicación en `main`. En los comandos de revisión también se observó referencia a `master`.

No se pudo validar en esta revisión cuál es la rama principal oficial del repositorio remoto. Se recomienda que OTI o el administrador del repositorio confirme una rama principal única.

## Proceso para solicitar acceso

Flujo recomendado:

1. Solicitar acceso al responsable técnico del proyecto.
2. Justificar el rol o actividad.
3. Confirmar usuario o correo de la plataforma Git.
4. Asignar permisos mínimos necesarios.
5. Registrar fecha de aprobación y responsable.

## Buenas prácticas para clonar

```bash
git clone <URL_DEL_REPOSITORIO_PRIVADO>
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
- `docs/nombre-corto`
- `chore/nombre-corto`

Evitar trabajar directamente sobre la rama principal.

## Recomendaciones antes de hacer push

- Ejecutar pruebas relevantes.
- Revisar `git status`.
- Revisar `git diff`.
- Confirmar que no se agregaron `.env`, dumps, CSV sensibles nuevos o credenciales.
- Evitar subir `node_modules`.
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
- Exportaciones con datos personales no anonimizados.

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
