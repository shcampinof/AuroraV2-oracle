import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ManualInteractivo from './ManualInteractivo.jsx';

describe('ManualInteractivo', () => {
  it('muestra los tres roles y el video local sin enlace externo', () => {
    const html = renderToStaticMarkup(<ManualInteractivo />);

    expect(html).toContain('Da clic en tu rol para consultar el tutorial.');
    expect(html).toContain('Defensor(a) público(a) para condenados');
    expect(html).toContain('Defensor(a) público(a) en Ley 906');
    expect(html).toContain('PAG de programa condenados');
    expect(html).toContain('/tutorial-videos/defensor-publico-condenados-eron.mp4');
    expect(html).toContain('preload="metadata"');
    expect(html.match(/<button/g)).toHaveLength(3);
    expect(html).not.toContain('<a ');
    expect(html).not.toContain('abre el video en una pestaña nueva');
  });
});
