# Integración SSO Azure AD para AURORA

Esta guía deja listo el camino para activar el inicio de sesión institucional de AURORA cuando la entidad entregue los datos del registro de aplicación en Azure.

## Datos requeridos

- `Directory (tenant) ID`
- `Application (client) ID`
- Dominio institucional permitido, por ejemplo `defensoria.gov.co`
- Opcional: ID de grupo de Azure AD autorizado para usar AURORA
- Opcional: roles de aplicación definidos para AURORA
- URL pública de despliegue, por ejemplo `https://aurora.defensoria.gov.co`

## Configuración en Azure App registrations

1. Crear un App registration para AURORA en el directorio de la entidad.
2. Usar cuentas de un solo directorio organizacional, salvo que seguridad indique otra política.
3. En Authentication, agregar plataforma `Single-page application`.
4. Registrar redirect URIs:
   - Desarrollo local: `http://localhost:5174`
   - Backend local compilado: `https://localhost:7860` si el navegador abre Aurora con HTTPS en ese puerto
   - Producción: URL pública exacta de AURORA
5. Usar MSAL.js con authorization code flow y PKCE. No activar implicit grant para SPA nuevas.
6. En Token configuration o App roles, acordar con seguridad si el control se hará por:
   - dominio de correo institucional;
   - grupo de Azure AD;
   - rol de aplicación.

## Variables del backend

Configurar en `backend/.env`:

```env
AUTH_LOCAL_ADMIN_ENABLED=false
AUTH_LOCAL_ADMIN_USERNAME=aurora-admin
AUTH_LOCAL_ADMIN_PASSWORD=change-this-temporary-password
AUTH_JWT_SECRET=replace-with-a-long-random-secret-at-least-32-bytes

AZURE_AD_TENANT_ID=00000000-0000-0000-0000-000000000000
AZURE_AD_CLIENT_ID=00000000-0000-0000-0000-000000000000
AZURE_AD_ALLOWED_EMAIL_DOMAINS=defensoria.gov.co
AZURE_AD_REQUIRED_GROUP_IDS=
AZURE_AD_REQUIRED_APP_ROLES=
```

Durante pruebas locales se puede activar un acceso temporal. En `NODE_ENV=production`, si `AUTH_LOCAL_ADMIN_ENABLED` se omite queda deshabilitado por defecto, y el backend rechaza `admin/admin` aunque se active explicitamente:

```env
AUTH_LOCAL_ADMIN_ENABLED=true
AUTH_LOCAL_ADMIN_USERNAME=aurora-admin
AUTH_LOCAL_ADMIN_PASSWORD=<password-temporal-fuerte>
```

## Flujo implementado

1. El frontend consulta `/api/auth/config`.
2. Si `AZURE_AD_TENANT_ID` y `AZURE_AD_CLIENT_ID` existen, habilita el botón `Ingresar con SSO Azure AD`.
3. MSAL abre el flujo de Microsoft identity platform contra `login.microsoftonline.com`.
4. El backend recibe el `idToken`, valida firma, `issuer`, `audience`, `tenant`, dominio y opcionalmente grupos o roles.
5. AURORA emite un JWT propio para proteger `/api/ppl`, `/api/formatos` y `/api/defensores`.

## Verificación rápida

```bash
curl http://localhost:8899/api/auth/config
```

Debe responder `azureAd.enabled: true` cuando `tenantId` y `clientId` estén configurados.

Si Microsoft devuelve `AADSTS9002326` o `Cross-origin token redemption is permitted only for the Single-Page Application client-type`, la Redirect URI quedó registrada como `Web` o no existe para la URL exacta usada por el navegador. En Entra ID, mover o agregar esa URL en `Authentication > Platform configurations > Single-page application`.

## Referencias oficiales

- MSAL Browser: https://learn.microsoft.com/en-us/entra/msal/javascript/browser/about-msal-browser
- SSO con MSAL.js: https://learn.microsoft.com/en-us/entra/identity-platform/msal-js-sso
- Authorization code flow con PKCE: https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow
- Redirect URIs en App registrations: https://learn.microsoft.com/en-us/entra/identity-platform/how-to-add-redirect-uri
- Validación de ID tokens: https://learn.microsoft.com/en-us/entra/identity-platform/id-tokens
