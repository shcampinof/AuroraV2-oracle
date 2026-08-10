import { useEffect, useRef } from 'react';

import { LOGO_AURORA_URL } from '../config/externalAssets.js';

const CONDITIONS = [
  {
    title: 'Tratamiento de datos personales',
    text:
      'La información consultada, cargada o procesada a través de AURORA puede contener datos personales, incluidos datos sensibles, de personas usuarias de la Defensoría del Pueblo, en particular personas privadas de la libertad y otros intervinientes en actuaciones judiciales. El tratamiento de esta información se realiza exclusivamente para el cumplimiento de las funciones constitucionales y legales de la Defensoría del Pueblo y de conformidad con la normativa vigente sobre protección de datos personales.',
  },
  {
    title: 'Uso autorizado de la herramienta',
    text:
      'AURORA está destinada exclusivamente al desarrollo de funciones institucionales por parte de servidores públicos y contratistas autorizados. La información obtenida mediante la herramienta no podrá utilizarse para fines distintos de aquellos relacionados con la prestación del servicio de defensoría pública y las demás competencias legales de la entidad.',
  },
  {
    title: 'Confidencialidad y reserva',
    text:
      'Usted se compromete a preservar la confidencialidad y reserva de toda la información a la que acceda mediante AURORA, absteniéndose de divulgarla, copiarla, compartirla o utilizarla de forma no autorizada, de conformidad con las obligaciones legales y disciplinarias aplicables.',
  },
  {
    title: 'Responsabilidad del usuario',
    text:
      'El acceso, consulta y utilización de la información a través de AURORA son de su exclusiva responsabilidad. Usted se compromete a utilizar la herramienta de manera diligente, únicamente respecto de los casos cuya gestión le haya sido asignada o para los cuales se encuentre debidamente autorizado.',
  },
  {
    title: 'Seguridad de la información',
    text:
      'La Defensoría del Pueblo implementa medidas para proteger la información procesada en AURORA. No obstante, cada usuario es responsable de custodiar sus credenciales de acceso, evitar el acceso por terceros y reportar cualquier uso indebido o incidente de seguridad del que tenga conocimiento.',
  },
  {
    title: 'Herramienta de apoyo institucional',
    text:
      'AURORA constituye una herramienta de apoyo para la gestión de casos y la consulta de información. Su utilización no reemplaza el análisis jurídico, la valoración profesional ni las responsabilidades propias del servidor o contratista que interviene en cada actuación.',
  },
];

function DataTreatmentNotice({ onAccept, onDecline }) {
  const acceptButtonRef = useRef(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    acceptButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div className="data-notice-backdrop">
      <section
        className="data-notice"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="data-notice-title"
        aria-describedby="data-notice-introduction"
      >
        <header className="data-notice-header">
          <img src={LOGO_AURORA_URL} alt="" />
          <h2 id="data-notice-title">Condiciones de uso y tratamiento de datos</h2>
        </header>

        <div className="data-notice-content">
          <p id="data-notice-introduction">
            AURORA es una herramienta tecnológica de apoyo para la gestión y revisión de información
            relacionada con casos de personas privadas de la libertad atendidos por la Defensoría del
            Pueblo, orientada a fortalecer la labor de las y los defensores públicos y demás servidoras
            y servidores autorizados.
          </p>
          <p>Antes de continuar, por favor lea atentamente las siguientes condiciones:</p>
          <p>
            Al hacer clic en <strong>“Aceptar y continuar”</strong>, usted declara y acepta que:
          </p>

          <ol className="data-notice-conditions">
            {CONDITIONS.map((condition, index) => (
              <li key={condition.title}>
                <span className="data-notice-number" aria-hidden="true">{index + 1}</span>
                <div>
                  <h3>{condition.title}</h3>
                  <p>{condition.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <footer className="data-notice-actions">
          <button type="button" className="data-notice-decline" onClick={onDecline}>
            No aceptar
          </button>
          <button
            ref={acceptButtonRef}
            type="button"
            className="data-notice-accept"
            onClick={onAccept}
          >
            Aceptar y continuar
          </button>
        </footer>
      </section>
    </div>
  );
}

export default DataTreatmentNotice;
