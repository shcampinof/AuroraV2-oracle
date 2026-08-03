// Catálogo institucional de la pestaña "Caja de Herramientas".
// downloadUrl contiene el enlace de descarga autorizado para cada formato.
const formatos = [
  {
    id: 'f1',
    titulo: 'Entrevista - Pruebas tipo para arraigo',
    downloadUrl: 'https://defensoriadelpueblo.sharepoint.com/:b:/s/DNDP-DOCUMENTACION/IQBOJ6sgTm3NRJKb1iVH76tZAZzTsQJOpr47z4f3BLtNmT8?e=Elj4mb&download=1',
  },
  {
    id: 'f2', 
    titulo: 'INPEC-Asignación cupo TEE - JETEE',
    downloadUrl: 'https://defensoriadelpueblo.sharepoint.com/:w:/s/DNDP-DOCUMENTACION/IQB4Jbe6CTWfRbHzDyO-fUVfAQXNga8M5YQ8Ibi2zsluUI8?e=dwSC7c&download=1',
  },
  {
    id: 'f3',
    titulo: 'INPEC-Cambio de fase tratamiento penitenciario - CET',
    downloadUrl: 'https://defensoriadelpueblo.sharepoint.com/:w:/s/DNDP-DOCUMENTACION/IQD2c5dc1ThSRoZfMselg3ubAbQoBaN_fagKsl4w5IZ-II4?e=yXEKdB&download=1',
  },
  {
    id: 'f4',
    titulo: 'JEPMS-Acumulación jurídica de penas',
    downloadUrl: 'https://defensoriadelpueblo.sharepoint.com/:w:/s/DNDP-DOCUMENTACION/IQB9wd40axNBTL7yVRyJgvH_AfaEzm_9iYXjPN_uUa4866U?e=Ni3dM6&download=1',
  },
  {
    id: 'f5',
    titulo: 'JEPMS-Aplicación retroactiva 2x3 redención por trabajo',
    downloadUrl: 'https://defensoriadelpueblo.sharepoint.com/:w:/s/DNDP-DOCUMENTACION/IQDAVJycTdadTrfeDtv2fj1dAQmnTO85BZQus9Ru8jqJssk?e=7ifqwX&download=1',
  },
  {
    id: 'f6',
    titulo: 'JEPMS-Aplicación retroactiva e igualitaria 2x3 redención otras actividades STP 5152 2026',
    downloadUrl: 'https://defensoriadelpueblo.sharepoint.com/:w:/s/DNDP-DOCUMENTACION/IQAHhSy7mlYQRKlM9GXBVBk0AftsW-46a8XjuXGQacEeLhw?e=VltZgf&download=1',
  },
  {
    id: 'f7',
    titulo: 'JEPMS-Autorización para radicar solicitud UP',
    downloadUrl: 'https://defensoriadelpueblo.sharepoint.com/:w:/s/DNDP-DOCUMENTACION/IQAnHX5b6edyS4GYiycO75IRASyYoHu0XpG8jCsTBLuITck?e=12Xcue&download=1',
  },
  {
    id: 'f8',
    titulo: 'JEPMS-Solicitud Ley 2292 de 2023',
    downloadUrl: 'https://defensoriadelpueblo.sharepoint.com/:w:/s/DNDP-DOCUMENTACION/IQDPH6z3xTt8T7qhChh8mSXlAQb_6d7bhnJl3bvoqUwYhO8?e=jvJ2co&download=1',
  },
  {
    id: 'f9',
    titulo: 'JEPMS-Solicitud libertad condicional',
    downloadUrl: 'https://defensoriadelpueblo.sharepoint.com/:w:/s/DNDP-DOCUMENTACION/IQBix5RIYey5ToGaflYtk1OBASUWFn4JH55Q-N1YZh7JBLU?e=ji9Njc&download=1',
  },
  {
    id: 'f10',
    titulo: 'JEPMS-Solicitud prisión domiciliaria',
    downloadUrl: 'https://defensoriadelpueblo.sharepoint.com/:w:/s/DNDP-DOCUMENTACION/IQCaX4H4a-1GRIFlrvuLesvEAQevh6YuhdNro_ZqkwXpSF0?e=Ju4yp4&download=1',
  },
  {
    id: 'f11',
    titulo: 'JEPMS-Traslado del proceso de Distrito Judicial por traslado de persona privada de la libertad',
    downloadUrl: 'https://defensoriadelpueblo.sharepoint.com/:w:/s/DNDP-DOCUMENTACION/IQAPWjpc_WcCQbbyK6tgidngAUbieB2j5xZNHjLRcInZoB4?e=OhFxaQ&download=1',
  },
  {
    id: 'f12',
    titulo:
      'UP -SD-P02-F212 Solicitud de concesión de la pena sustitutiva de prestación de servicios de utilidad pública – Ley 2292 de 2023',
    downloadUrl: 'https://defensoriadelpueblo.sharepoint.com/:w:/s/DNDP-DOCUMENTACION/IQBVKUmPFDfjQLvsS6kxw_LuATZQF8Q4zpT5jkFT0_XR5MA?e=0pUnu0&download=1',
  },
  {
    id: 'f13',
    titulo: 'Utilidad Pública - Formato Entrevista',
    downloadUrl: 'https://defensoriadelpueblo.sharepoint.com/:w:/s/DNDP-DOCUMENTACION/IQD780bMK2VmQ4j9eWsutlb2ARKRs1Wi64fNOdvIEFs0TxM?e=HtCttq&download=1',
  },
  {
    id: 'f14',
    titulo: 'Utilidad Pública - Guía entrevista a mujer Ley 2292',
    downloadUrl: 'https://defensoriadelpueblo.sharepoint.com/:b:/s/DNDP-DOCUMENTACION/IQA9A8co0YgKQKkg7GCAmhrWAUxFk4-wcjConE6Avj_Z8Rg?e=7Fr5wi&download=1',
  },
  {
    id: 'f15',
    titulo: 'Utilidad Pública - Guía entrevista a terceros Ley 2292 Utilidad Publica',
    downloadUrl: 'https://defensoriadelpueblo.sharepoint.com/:b:/s/DNDP-DOCUMENTACION/IQDt53ZaQJRPRY6GmrZsBysXAY87iJe-3CyhCqXkcZAHkd8?e=U2twWj&download=1',
  },
  {
    id: 'f16',
    titulo: 'Utilidad Pública - Manifestacion voluntad mujer',
    downloadUrl: 'https://defensoriadelpueblo.sharepoint.com/:b:/s/DNDP-DOCUMENTACION/IQArbbby1Y9HSIIIgxs0bbMjAcS_ylaZOuXNljitxI0Xeqc?e=kKuiJ8&download=1',
  },
  {
    id: 'f17',
    titulo: 'Utilidad Pública - Plan ejecución servicios',
    downloadUrl: 'https://defensoriadelpueblo.sharepoint.com/:b:/s/DNDP-DOCUMENTACION/IQB3aBRwMZRNRpUsVzoYLU0YAd9VbWtiMJZ_9pLROabXZww?e=pgvh2I&download=1',
  },
  {
    id: 'f18',
    titulo: 'Utilidad Pública - Poder Defensores',
    downloadUrl: 'https://defensoriadelpueblo.sharepoint.com/:w:/s/DNDP-DOCUMENTACION/IQC72LjXAJbvQbNSAQCjydq6AT1uK-8H1zN_kiOT2hpqWgc?e=RPE6kH&download=1',
  },
  {
    id: 'f19',
    titulo: 'Utilidad Pública - Pruebas para recolectar - Pautas',
    downloadUrl: 'https://defensoriadelpueblo.sharepoint.com/:b:/s/DNDP-DOCUMENTACION/IQA7q2RCVU0ZTLGhvZPdHn_6Aa3pubO5Ovow0KGUc_LmxQY?e=Hd5fDo&download=1',
  },
  {
    id: 'f21',
    titulo: 'Utilidad Pública - Solicitud Ley 2292 de 2023',
    downloadUrl: 'https://defensoriadelpueblo.sharepoint.com/:w:/s/DNDP-DOCUMENTACION/IQAnckhNsqvdQIG2u_LskPWiAWo_gRObBR8AYOlTThyUUYU?e=WtuHec&download=1',
  },
];

function listFormatos() {
  return formatos;
}

function getFormatoById(id) {
  return formatos.find((f) => f.id === id);
}

module.exports = { listFormatos, getFormatoById };
