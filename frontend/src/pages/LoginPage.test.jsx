import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import appMetadata from '../../package.json';
import LoginPage from './LoginPage.jsx';

describe('LoginPage', () => {
  it('mantiene visible el acceso con contraseña y la versión del frontend', () => {
    const html = renderToStaticMarkup(<LoginPage onAuthenticated={() => {}} />);

    expect(html).toContain('CONTRASEÑA');
    expect(html).toContain('Ingrese con sus credenciales institucionales.');
    expect(html).toContain('Iniciar Sesión');
    expect(html).not.toContain('Continuar con Microsoft');
    expect(html).toContain(`v${appMetadata.version}`);
  });
});
