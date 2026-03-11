// Lista base de la pestana "Caja de Herramientas".
// filename debe coincidir exactamente con el archivo en backend/public/formatos.
const formatos = [
  {
    id: 'f1',
    titulo: 'INPEC-Asignacion cupo TEE - JETEE',
    filename: 'INPEC-Asignacio\u0301n cupo TEE - JETEE.docx',
  },
  {
    id: 'f2',
    titulo: 'JEPMS-Aplicacion retroactiva 2x3 redencion por trabajo',
    filename: 'JEPMS-Aplicacio\u0301n retroactiva 2x3 redencio\u0301n por trabajo.docx',
  },
  {
    id: 'f3',
    titulo: 'JEPMS-Autorizacion para radicar solicitud UP',
    filename: 'JEPMS-Autorizacio\u0301n para radicar solicitud UP.docx',
  },
  {
    id: 'f4',
    titulo: 'INPEC-Cambio de fase tratamiento penitenciario - CET',
    filename: 'INPEC-Cambio de fase tratamiento penitenciario - CET.docx',
  },
  {
    id: 'f5',
    titulo: 'JEPMS-Aplicacion retroactiva y analogica 2x3 redencion otras actividades',
    filename: 'JEPMS-Aplicacio\u0301n retroactiva y analo\u0301gica 2x3 redencio\u0301n otras actividades.docx',
  },
  {
    id: 'f6',
    titulo: 'JEPMS-Acumulacion juridica de penas',
    filename: 'JEPMS-Acumulacio\u0301n juri\u0301dica de penas.docx',
  },
  {
    id: 'f7',
    titulo: 'JEPMS-Solicitud libertad condicional',
    filename: 'JEPMS-Solicitud libertad condicional.docx',
  },
  {
    id: 'f8',
    titulo: 'Entrevista - Pruebas tipo para arraigo',
    filename: 'Entrevista - Pruebas tipo para arraigo.pdf',
  },
  {
    id: 'f9',
    titulo: 'JEPMS-Traslado del proceso de Distrito Judicial por traslado de persona privada de la libertad',
    filename:
      'JEPMS-Traslado del proceso de Distrito Judicial por traslado de persona privada de la libertad.docx',
  },
  {
    id: 'f10',
    titulo: 'JEPMS-Solicitud prision domiciliaria',
    filename: 'JEPMS-Solicitud prisio\u0301n domiciliaria.docx',
  },
];

function listFormatos() {
  return formatos;
}

function getFormatoById(id) {
  return formatos.find((f) => f.id === id);
}

module.exports = { listFormatos, getFormatoById };
