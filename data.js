// data.js — Datos del juego ICEX Milán. Todo lo narrativo/generativo vive aquí.

const BECARIOS = [
  { id: "jorge",    nombre: "Jorge",   img: "img/jorge.jpg",    jefe: "andrea"    },
  { id: "juan_m",   nombre: "Juan M",  img: "img/juan_m.jpg",   jefe: "francesco" },
  { id: "juan_b",   nombre: "Juan B",  img: "img/juan_b.jpg",   jefe: "francesco" },
  { id: "gemma",    nombre: "Gemma",   img: "img/gemma.jpg",    jefe: "andrea"    },
  { id: "graciela", nombre: "Graciela",img: "img/graciela.jpg", jefe: "andrea"    },
  { id: "clara",    nombre: "Clara",   img: "img/clara.jpg",    jefe: "andrea"    },
  { id: "emma",     nombre: "Emma",    img: "img/emma.jpg",     jefe: "francesco" },
  { id: "luca",     nombre: "Luca",    img: "img/luca.jpg",     jefe: "francesco" },
];

const JEFES = {
  andrea:    { nombre: "Andrea",    rol: "Jefa de sector", severidad: 0.55, avatar: "A", color: "#8a5a44" },
  francesco: { nombre: "Francesco", rol: "Jefe de sector", severidad: 0.55, avatar: "F", color: "#3f5a70" },
  luis:      { nombre: "Luis",      rol: "Jefe Supremo",   severidad: 0.9,  avatar: "L", color: "#6b1f1f" },
};

// Sectores y regiones para generación procedural.
const SECTORES = ["Agroalimentario", "Calzado", "Moda", "Maquinaria", "Vino", "Mueble", "Automoción", "Farmacéutico"];
const REGIONES = ["Lombardía", "Piamonte", "Véneto", "Emilia-Romaña", "Toscana", "Liguria"];
const CIUDADES_OK = {
  "Lombardía": "Milán", "Piamonte": "Turín", "Véneto": "Venecia",
  "Emilia-Romaña": "Bolonia", "Toscana": "Florencia", "Liguria": "Génova",
};
const CIUDADES_MAL = ["Roma", "Nápoles", "Palermo", "Bari", "Cagliari"]; // fuera de región => discrepancia

// Cada empresa lleva su sector coherente. El sector del post-it sale SIEMPRE de la empresa,
// nunca al azar por separado (así no hay "Calzados" con sector "Maquinaria").
const EMPRESAS = [
  { nombre: "Embutidos García",       sector: "Agroalimentario" },
  { nombre: "Conservas Atlántico",    sector: "Agroalimentario" },
  { nombre: "Jamones La Dehesa",      sector: "Agroalimentario" },
  { nombre: "Aceites del Sur",        sector: "Agroalimentario" },
  { nombre: "Calzados Hermanos Ruiz", sector: "Calzado" },
  { nombre: "Curtidos Levantinos",    sector: "Calzado" },
  { nombre: "Textiles del Segura",    sector: "Moda" },
  { nombre: "Confecciones Duero",     sector: "Moda" },
  { nombre: "Bodegas Valdemar",       sector: "Vino" },
  { nombre: "Viñedos del Ebro",       sector: "Vino" },
  { nombre: "Maquinaria Ibérica SL",  sector: "Maquinaria" },
  { nombre: "Prensas y Tornos Vega",  sector: "Maquinaria" },
  { nombre: "Muebles Levante",        sector: "Mueble" },
  { nombre: "Cerámica Mediterránea",  sector: "Mueble" },
  { nombre: "AutoPartes Norte",       sector: "Automoción" },
  { nombre: "Componentes Ebro Auto",  sector: "Automoción" },
  { nombre: "Farma Andalucía",        sector: "Farmacéutico" },
  { nombre: "Laboratorios Tajo",      sector: "Farmacéutico" },
];

const TIPOS_DOC = {
  DRAFT:        "Borrador de correo",
  FAIR_REPORT:  "Informe de Feria",
  MARKET_STUDY: "Estudio de Mercado",
};

// Catálogo de gazapos de IA. Cada uno inyecta una frase marcable en el documento.
// tipo: identificador; critico: si delata uso de IA de forma flagrante.
const GAZAPOS = {
  AI_DISCLAIMER: {
    critico: true,
    etiqueta: "Se delata como IA",
    frases: [
      // Sutiles: no dicen "soy una IA", pero son coletillas que solo pone un modelo.
      "Es importante recordar que la información puede variar y conviene contrastarla con fuentes actualizadas.",
      "No dispongo de datos posteriores a mi última actualización, pero en términos generales el sector es relevante.",
      "Cabe señalar que no puedo garantizar la exactitud de estas cifras en tiempo real.",
      "Espero que esta información te resulte útil para tu informe.",
    ],
  },
  META_INSTRUCTION: {
    critico: true,
    etiqueta: "Filtra el prompt",
    frases: [
      // Sutiles: rastros del prompt colados en el texto, fáciles de pasar por alto leyendo en diagonal.
      "Redactado en tono formal y profesional, con una extensión aproximada de 300 palabras, tal y como se solicita.",
      "A continuación se desarrolla el punto anterior en tres párrafos, evitando tecnicismos.",
      "Resumen ejecutivo (opción 2 de las que me pediste):",
    ],
  },
  PLACEHOLDER: {
    critico: true,
    etiqueta: "Deja un placeholder",
    frases: [
      // Menos gritones que un [INSERTAR AQUÍ]: huecos que parecen texto pero no lo son.
      "Las exportaciones alcanzaron los XX millones de euros el año pasado.",
      "La empresa, fundada en [año], lidera el sector en la región.",
      "Se recomienda contactar con el responsable (nombre por confirmar) antes de la feria.",
    ],
  },
  HALLUCINATION: {
    critico: false,
    etiqueta: "Dato inventado",
    frases: [
      // Plausibles pero falsos: suenan a informe real, hay que dudar del dato.
      "El Acuerdo Bilateral de Cooperación Textil de 2019 eliminó los aranceles para este sector.",
      "Milán concentra el 63% de las importaciones nacionales italianas de este producto.",
      "La región lidera el ranking europeo de consumo per cápita desde 2015 sin interrupción.",
    ],
  },
  WRONG_TONE: {
    critico: false,
    etiqueta: "Tono incorrecto",
    frases: [
      // Sutil: no es jerga chabacana, es un desliz de registro en un texto por lo demás formal.
      "En definitiva, es una oportunidad buenísima que no se puede dejar escapar.",
      "La verdad es que el mercado pinta muy bien para nuestras empresas.",
      "Conviene moverse ya, porque si no otros se nos van a adelantar seguro.",
    ],
  },
  // Estos dos se inyectan con datos concretos desde game.js (llevan cifra y fuente).
  FUENTE_FALSA: {
    critico: true,
    etiqueta: "Fuente inventada",
    frases: [], // se generan dinámicamente
  },
};

// ---- Datos de mercado y fuentes (para estudios de mercado) ----
// Fuentes reales que un becario del ICEX citaría de verdad.
const FUENTES_REALES = [
  "ISTAT (Instituto Nacional de Estadística italiano)",
  "ICEX España Exportación e Inversiones",
  "Cámara de Comercio de Milán",
  "Eurostat",
  "Confindustria",
  "Agencia ICE (Italian Trade Agency)",
  "Datacomex (Secretaría de Estado de Comercio)",
];
// Fuentes falsas: si el documento cita una de estas, es un gazapo. Plausibles pero no válidas:
// no son fuentes oficiales contrastables, así que hay que dudar.
const FUENTES_FALSAS = [
  "estimación propia sin contrastar",
  "un artículo de prensa de hace ocho años",
  "Statista (con datos de otro país)",
  "la página web de la propia empresa cliente",
  "un informe interno sin publicar",
  "una consultora no identificada",
  "cifras redondeadas de memoria",
];
// Plantillas de dato de mercado. {n}=cifra, {sector}, {region}.
const PLANTILLAS_DATO = [
  "Las exportaciones españolas del sector {sector} a {region} crecieron un {n}% en 2023",
  "El sector {sector} representa el {n}% del PIB regional de {region}",
  "Se registraron {n} empresas importadoras activas del sector {sector} en {region}",
  "El consumo de productos del sector {sector} aumentó un {n}% interanual en {region}",
  "La cuota de mercado de producto español en {sector} alcanza el {n}% en {region}",
];

// ---- Tareas dirigidas por jefe ----
// Andrea manda borradores de correo a SUS becarios. Francesco interrumpe con urgencias.
const BORRADORES_ANDREA = [
  { asunto: "Declinar invitación a feria", instru: "Responde a la empresa declinando su invitación a la feria, en tono formal y agradecido." },
  { asunto: "Pedir catálogo actualizado", instru: "Escribe a la empresa pidiendo su catálogo actualizado en italiano para un cliente." },
  { asunto: "Concertar reunión", instru: "Propón a la empresa una reunión la semana que viene en la oficina de Milán." },
  { asunto: "Reclamar factura pendiente", instru: "Reclama con educación una factura pendiente de la cuota de participación en la feria." },
];
const URGENCIAS_FRANCESCO = [
  "DEJA LO QUE ESTÉS HACIENDO. Necesito un estudio de mercado de {sector} en {region} para dentro de nada.",
  "Perdona, se me olvidó: hazme YA un informe de feria del sector {sector}. Es para una llamada en 5 minutos.",
  "Urgente. La embajada pide datos de {sector} en {region}. No preguntes, hazlo.",
  "Cambio de planes, esto es prioritario: un borrador sobre {sector} en {region}, rapidito.",
];

// ---- Skyscanner (pestaña de escaqueo) ----
const SKYSCANNER_RUTAS = [
  { destino: "Madrid",     precio: 39,  hora: "06:50" },
  { destino: "Barcelona",  precio: 45,  hora: "21:30" },
  { destino: "Valencia",   precio: 52,  hora: "07:15" },
  { destino: "Sevilla",    precio: 61,  hora: "22:05" },
  { destino: "Bilbao",     precio: 58,  hora: "18:40" },
  { destino: "Cualquier sitio menos aquí", precio: 19, hora: "05:00" },
];

// Reglas que van cambiando a lo largo de la campaña. Se activan por día.
const REGLAS_PROGRESIVAS = [
  { dia: 1,  texto: "Todo informe debe empezar mencionando la empresa y el sector." },
  { dia: 3,  texto: "Prohibido cualquier rastro de lenguaje de IA (disclaimers, 'como modelo...')." },
  { dia: 5,  texto: "El tono debe ser formal. Nada de coloquialismos ('en plan', 'colega')." },
  { dia: 8,  texto: "Verificar SIEMPRE que la ciudad citada pertenezca a la región pedida." },
  { dia: 12, texto: "Ningún documento puede contener placeholders sin rellenar." },
];

// Eventos guionizados del grupo de WhatsApp / oficina. Se muestran al inicio de días concretos.
const EVENTOS_WHATSAPP = {
  1:  [ { autor: "Graciela", texto: "Buenos días equipo!! Primer día de todos, mucho ánimo 🫠" },
        { autor: "Luca",     texto: "alguien sabe la contraseña del wifi? llevo 20 min mirando la pared" } ],
  2:  [ { autor: "Andrea",   texto: "Recordad: los informes se envían ANTES de las 17:00. No excusas." } ],
  3:  [ { autor: "Juan B",   texto: "Ojo, Luis está revisando informes él mismo esta semana. Cuidado con la IA." },
        { autor: "Emma",     texto: "a mí me pilló un 'como modelo de lenguaje' la semana pasada, casi me muero" } ],
  4:  [ { autor: "Clara",    texto: "El de la máquina de café volvió a robar mi leche de avena. Guerra." } ],
  5:  [ { autor: "Francesco",texto: "A partir de hoy, tono formal obligatorio. Andrea y yo lo vamos a mirar." } ],
  6:  [ { autor: "Jorge",    texto: "aperitivo hoy en Navigli a las 17:30, quien se apunta 🍸" } ],
  8:  [ { autor: "Andrea",   texto: "Han salido informes con ciudades que no tocan. Revisad la geografía." } ],
  10: [ { autor: "Luis",     texto: "Buenos días. Este mes he leído cada informe. Sé quién usa la maquinita." } ],
  12: [ { autor: "Gemma",    texto: "me han renovado la beca!! bueno, otros 6 meses sin cobrar apenas pero bueno" } ],
  15: [ { autor: "Emma",     texto: "hoy es el último día del mes... a ver si llega el ingreso de la beca 🙏" } ],
};

// Parámetros económicos (mensuales, prorrateados por día laborable de campaña).
const ECONOMIA = {
  becaMensual: 1100,     // beca ICEX Milán
  alquilerMensual: 850,  // habitación en Milán
  transporteMensual: 39, // abono ATM
  aperitivoDiario: 12,   // spritz + tagliere en Navigli
  comidaDiaria: 9,
  diasCampania: 15,      // 15 días laborables jugables ~ resumen de 6 meses
};
