// Catálogo institucional de la pestaña "Caja de Herramientas".
// downloadUrl contiene el enlace de descarga autorizado para cada formato.
const formatos = [
  {
    id: 'f3',
    titulo: 'Entrevista - Pruebas tipo para arraigo',
    downloadUrl: 'https://defensoriadelpueblo.sharepoint.com/:b:/s/DNDP-DOCUMENTACION/IQBOJ6sgTm3NRJKb1iVH76tZAZzTsQJOpr47z4f3BLtNmT8?e=ujvX2W&download=1',
  },
  {
    id: 'f4',
    titulo: 'Solicitud de acumulación jurídica de penas',
    downloadUrl: 'https://defensoriadelpueblo.sharepoint.com/:w:/s/DNDP-DOCUMENTACION/IQB9wd40axNBTL7yVRyJgvH_AfaEzm_9iYXjPN_uUa4866U?e=AmHcLm&download=1',
  },
  {
    id: 'f5',
    titulo: 'Solicitud de aplicación retroactiva redención de pena por trabajo',
    downloadUrl: 'https://defensoriadelpueblo.sharepoint.com/:w:/s/DNDP-DOCUMENTACION/IQAHhSy7mlYQRKlM9GXBVBk0AftsW-46a8XjuXGQacEeLhw?e=aDjtR2&download=1',
  },
  {
    id: 'f1',
    titulo: 'Solicitud de aplicación retroactiva y analógica 2x3 redención otras actividades',
    downloadUrl: 'https://defensoriadelpueblo.sharepoint.com/:w:/s/DNDP-DOCUMENTACION/IQDacSN17TWlSK2EgsVKCn4jAd0pEEnsOQzycQJtDgXXXIQ?e=eneDGI&download=1',
  },
  {
    id: 'f6',
    titulo: 'Solicitud de asignación de plaza de redención de pena por actividades de resocialización',
    downloadUrl: 'https://defensoriadelpueblo.sharepoint.com/:w:/s/DNDP-DOCUMENTACION/IQB4Jbe6CTWfRbHzDyO-fUVfAQXNga8M5YQ8Ibi2zsluUI8?e=J4b1LG&download=1',
  },
  {
    id: 'f7',
    titulo: 'Solicitud de evaluación de cambio de fase del tratamiento penitenciario',
    downloadUrl: 'https://defensoriadelpueblo.sharepoint.com/:w:/s/DNDP-DOCUMENTACION/IQDAVJycTdadTrfeDtv2fj1dAQmnTO85BZQus9Ru8jqJssk?e=gPzuSm&download=1',
  },
  {
    id: 'f9',
    titulo: 'Solicitud de libertad condicional',
    downloadUrl: 'https://defensoriadelpueblo.sharepoint.com/:w:/s/DNDP-DOCUMENTACION/IQAPWjpc_WcCQbbyK6tgidngAUbieB2j5xZNHjLRcInZoB4?e=CFqwNy&download=1',
  },
  {
    id: 'f10',
    titulo: 'Solicitud de prisión domiciliaria',
    downloadUrl: 'https://defensoriadelpueblo.sharepoint.com/:w:/s/DNDP-DOCUMENTACION/IQBix5RIYey5ToGaflYtk1OBASUWFn4JH55Q-N1YZh7JBLU?e=BGZdgX&download=1',
  },
  {
    id: 'f22',
    titulo: 'Traslado del proceso de Distrito Judicial por traslado de persona privada de la libertad',
    downloadUrl: 'https://defensoriadelpueblo.sharepoint.com/:w:/s/DNDP-DOCUMENTACION/IQCaX4H4a-1GRIFlrvuLesvEAQevh6YuhdNro_ZqkwXpSF0?e=8hzghn&download=1',
  },
  {
    id: 'f12',
    categoria: 'utilidad-publica',
    titulo: 'Autorización para radicar solicitud UP',
    downloadUrl: 'https://defensoriadelpueblo.sharepoint.com/:w:/s/DNDP-DOCUMENTACION/IQAnHX5b6edyS4GYiycO75IRASyYoHu0XpG8jCsTBLuITck?e=UHxO3q&download=1',
  },
  {
    id: 'f13',
    categoria: 'utilidad-publica',
    titulo: 'Solicitud Ley 2292 de 2023 Utilidad Pública',
    downloadUrl: 'https://defensoriadelpueblo.sharepoint.com/:w:/s/DNDP-DOCUMENTACION/IQDPH6z3xTt8T7qhChh8mSXlAQb_6d7bhnJl3bvoqUwYhO8?e=TOKggL&download=1',
  },
  {
    id: 'f14',
    categoria: 'utilidad-publica',
    titulo: 'Utilidad Pública - Formato Entrevista',
    downloadUrl: 'https://defensoriadelpueblo.sharepoint.com/:w:/s/DNDP-DOCUMENTACION/IQD780bMK2VmQ4j9eWsutlb2ARKRs1Wi64fNOdvIEFs0TxM?e=K6fa9m&download=1',
  },
  {
    id: 'f15',
    categoria: 'utilidad-publica',
    titulo: 'Utilidad Pública - Guía entrevista a mujer Ley 2292',
    downloadUrl: 'https://defensoriadelpueblo.sharepoint.com/:b:/s/DNDP-DOCUMENTACION/IQA9A8co0YgKQKkg7GCAmhrWAUxFk4-wcjConE6Avj_Z8Rg?e=5e5ZT8&download=1',
  },
  {
    id: 'f16',
    categoria: 'utilidad-publica',
    titulo: 'Utilidad Pública - Guía entrevista a terceros Ley 2292 Utilidad Pública',
    downloadUrl: 'https://defensoriadelpueblo.sharepoint.com/:b:/s/DNDP-DOCUMENTACION/IQDt53ZaQJRPRY6GmrZsBysXAY87iJe-3CyhCqXkcZAHkd8?e=xj2LBk&download=1',
  },
  {
    id: 'f17',
    categoria: 'utilidad-publica',
    titulo: 'Utilidad Pública - Manifestación voluntad mujer',
    downloadUrl: 'https://defensoriadelpueblo.sharepoint.com/:b:/s/DNDP-DOCUMENTACION/IQArbbby1Y9HSIIIgxs0bbMjAcS_ylaZOuXNljitxI0Xeqc?e=wEEI9p&download=1',
  },
  {
    id: 'f18',
    categoria: 'utilidad-publica',
    titulo: 'Utilidad Pública - Plan ejecución servicios',
    downloadUrl: 'https://defensoriadelpueblo.sharepoint.com/:b:/s/DNDP-DOCUMENTACION/IQB3aBRwMZRNRpUsVzoYLU0YAd9VbWtiMJZ_9pLROabXZww?e=Rm5oD6&download=1',
  },
  {
    id: 'f19',
    categoria: 'utilidad-publica',
    titulo: 'Utilidad Pública - Poder Defensores',
    downloadUrl: 'https://defensoriadelpueblo.sharepoint.com/:w:/s/DNDP-DOCUMENTACION/IQC72LjXAJbvQbNSAQCjydq6AT1uK-8H1zN_kiOT2hpqWgc?e=SUK1ip&download=1',
  },
  {
    id: 'f20',
    categoria: 'utilidad-publica',
    titulo: 'Utilidad Pública - Pruebas para recolectar - Pautas',
    downloadUrl: 'https://defensoriadelpueblo.sharepoint.com/:b:/s/DNDP-DOCUMENTACION/IQA7q2RCVU0ZTLGhvZPdHn_6Aa3pubO5Ovow0KGUc_LmxQY?e=5a7g8Z&download=1',
  },
  {
    id: 'f21',
    categoria: 'utilidad-publica',
    titulo: 'Utilidad Pública - Solicitud de Misión de Trabajo',
    downloadUrl: 'https://defensoriadelpueblo.sharepoint.com/:w:/s/DNDP-DOCUMENTACION/IQCEILWewEZ7QKG8rkHEB34_AYeN2av--yEYTNrxhlE91qE?e=GNPeBq&download=1',
  },
];

function listFormatos() {
  return formatos;
}

function getFormatoById(id) {
  return formatos.find((f) => f.id === id);
}

module.exports = { listFormatos, getFormatoById };
