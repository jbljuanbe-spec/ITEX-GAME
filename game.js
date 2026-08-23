// game.js — Motor de "ICEX Milán: El Simulador de Becarios"

const $ = (sel) => document.querySelector(sel);
const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chance = (p) => Math.random() < p;
const entero = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

// ---------- Estado global ----------
const state = {
  becario: null,
  modo: "campania",
  dia: 1,
  hora: 9 * 60,
  finJornada: 17 * 60,
  dinero: 0,
  strikes: 0,
  hambre: 0,
  estres: 0,
  reputacion: 50,
  enviadosHoy: 0,
  cuotaDiaria: 4,
  tarea: null,
  marcados: new Set(),
  reglasActivas: [],
  gameOver: false,
  // v2
  pestana: "trabajo",       // "trabajo" | "skyscanner"
  filtrosRestantes: 2,      // usos de filtro anti-IA por día
  jefeTimeout: null,        // timer del "jefe se acerca"
  jefeVentana: null,        // timer de la ventana de reacción
  jefeViene: false,
  relaxInterval: null,      // baja estrés mientras estás en Skyscanner
  enModal: false,           // hay un popup bloqueante abierto
  colaUrgente: null,        // tarea urgente de Francesco pendiente de meterse
  cafesRestantes: 2,        // pausas para el café por día
};

// ---------- Utilidades de tiempo ----------
function horaTexto(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ---------- Generación de tareas ----------
let taskCounter = 0;

function generarTarea(forzar) {
  taskCounter++;
  const jefeId = state.becario.jefe;

  // Origen de la tarea. Andrea manda borradores de correo a sus becarios;
  // Francesco interrumpe con urgencias. forzar permite inyectar una urgencia concreta.
  let origen = "sistema";
  let tipo;
  if (forzar) {
    origen = forzar.origen; tipo = forzar.tipo;
  } else if (jefeId === "andrea" && chance(0.3)) {
    origen = "andrea"; tipo = "DRAFT"; // borrador de correo
  } else {
    // Más estudios de mercado que otra cosa.
    tipo = rnd(["MARKET_STUDY", "MARKET_STUDY", "MARKET_STUDY", "FAIR_REPORT", "DRAFT"]);
  }

  const emp = rnd(EMPRESAS);
  const region = rnd(REGIONES);
  const postit = {
    empresa: emp.nombre,
    sector: emp.sector,            // coherente con la empresa
    region,
    ciudad: CIUDADES_OK[region],
    tipo,
    origen,
    extra: forzar ? forzar.extra : (origen === "andrea" ? rnd(BORRADORES_ANDREA) : null),
  };

  const dificultad = Math.min(0.25 + state.dia * 0.04, 0.7);
  const parrafos = tipo === "DRAFT"
    ? construirBorrador(postit, dificultad)
    : construirDocumento(postit, dificultad);

  return { taskId: `task_${String(taskCounter).padStart(5, "0")}`, postit, parrafos, minutos: 0 };
}

// Construye un estudio de mercado / informe de feria, con datos y fuentes.
function construirDocumento(postit, dificultad) {
  const parrafos = [];
  const { empresa, sector, region, ciudad } = postit;
  const secL = sector.toLowerCase();

  parrafos.push(par(`Estudio elaborado para ${empresa}, empresa del sector ${secL}.`));

  // Frase geográfica: correcta o con ciudad de otra región (discrepancia, filtro no la ve).
  if (chance(dificultad)) {
    const mala = rnd(CIUDADES_MAL);
    parrafos.push(par(`El mercado se concentra especialmente en la ciudad de ${mala}, dentro de ${region}.`,
      { discrepancia: "GEO", info: `${mala} no pertenece a ${region} (sería ${ciudad}).` }));
  } else {
    parrafos.push(par(`El mercado se concentra en ${ciudad} y su área metropolitana, dentro de ${region}.`));
  }

  // 1-2 datos de mercado con su fuente. Alguna fuente puede ser falsa (gazapo de lectura).
  const nDatos = 1 + (chance(0.6) ? 1 : 0);
  for (let i = 0; i < nDatos; i++) {
    const n = entero(3, 42);
    const texto = rnd(PLANTILLAS_DATO).replace("{n}", n).replace("{sector}", secL).replace("{region}", region);
    const falsa = chance(dificultad * 0.7);
    const fuente = falsa ? rnd(FUENTES_FALSAS) : rnd(FUENTES_REALES);
    parrafos.push(par(`${texto} (fuente: ${fuente}).`,
      falsa ? { gazapo: "FUENTE_FALSA", dato: true, fuente, resumen: texto }
            : { dato: true, fuente, resumen: texto }));
  }

  // Inyectar gazapos de "tics" de IA (los que sí ve el filtro) y algún tono/alucinación.
  const claves = ["AI_DISCLAIMER", "META_INSTRUCTION", "PLACEHOLDER", "HALLUCINATION", "WRONG_TONE"];
  const nGazapos = (chance(dificultad + 0.2) ? 1 : 0) + (chance(dificultad) ? 1 : 0);
  const usadas = new Set();
  for (let i = 0; i < nGazapos; i++) {
    const k = rnd(claves);
    if (usadas.has(k)) continue;
    usadas.add(k);
    parrafos.push(par(rnd(GAZAPOS[k].frases), { gazapo: k }));
  }

  parrafos.push(par(`En conclusión, se recomienda una misión comercial para ${empresa} en la próxima feria del sector ${secL}.`));

  return barajarCuerpo(parrafos);
}

// Construye un borrador de correo (tareas de Andrea).
function construirBorrador(postit, dificultad) {
  const { empresa, extra } = postit;
  const asunto = extra ? extra.asunto : "Seguimiento comercial";
  const parrafos = [];
  parrafos.push(par(`Asunto: ${asunto} — ${empresa}`));
  parrafos.push(par(`Estimados señores de ${empresa}:`));

  // Cuerpo correcto.
  parrafos.push(par(`Les escribo desde la Oficina Económica y Comercial de España en Milán en relación con ${asunto.toLowerCase()}.`));

  // Gazapos típicos de IA en correos.
  const claves = ["META_INSTRUCTION", "AI_DISCLAIMER", "WRONG_TONE", "PLACEHOLDER"];
  const nGazapos = 1 + (chance(dificultad) ? 1 : 0);
  const usadas = new Set();
  for (let i = 0; i < nGazapos; i++) {
    const k = rnd(claves);
    if (usadas.has(k)) continue;
    usadas.add(k);
    parrafos.push(par(rnd(GAZAPOS[k].frases), { gazapo: k }));
  }

  parrafos.push(par(`Quedamos a su disposición. Un cordial saludo,`));
  parrafos.push(par(`${state.becario.nombre} — Becario ICEX Milán`));
  return barajarCuerpo(parrafos);
}

// Helper: crea un párrafo.
function par(texto, extra) { return Object.assign({ texto, gazapo: null, discrepancia: null }, extra || {}); }

// Baraja solo el cuerpo (deja intro primera y cierre último).
function barajarCuerpo(parrafos) {
  const medio = parrafos.slice(1, -1);
  for (let i = medio.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [medio[i], medio[j]] = [medio[j], medio[i]];
  }
  return [parrafos[0], ...medio, parrafos[parrafos.length - 1]];
}

// ¿Puede el filtro anti-IA ver este gazapo? Solo los "tics" de lenguaje.
function filtroDetecta(par) {
  return par.gazapo === "AI_DISCLAIMER" || par.gazapo === "META_INSTRUCTION";
}

// ---------- Pantallas ----------
function mostrar(pantalla) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("activa"));
  $("#" + pantalla).classList.add("activa");
  if (pantalla !== "juego") pararJefe();
}

function renderSeleccion() {
  const cont = $("#lista-becarios");
  cont.innerHTML = "";
  BECARIOS.forEach((b) => {
    const jefe = JEFES[b.jefe];
    const div = document.createElement("div");
    div.className = "becario-card";
    div.innerHTML = `
      <div class="foto-marco"><img src="${b.img}" alt="${b.nombre}" class="foto-retro"></div>
      <div class="becario-nombre">${b.nombre}</div>
      <div class="becario-jefe">Jefe: ${jefe.nombre}</div>`;
    div.onclick = () => { state.becario = b; iniciarPartida(); };
    cont.appendChild(div);
  });
}

// ---------- Inicio de partida ----------
function iniciarPartida() {
  state.modo = $("#modo-infinito").checked ? "infinito" : "campania";
  Object.assign(state, { dia: 1, dinero: 0, strikes: 0, hambre: 10, estres: 10, reputacion: 50, gameOver: false });
  mostrar("juego");
  $("#foto-escritorio").src = state.becario.img;
  $("#nombre-escritorio").textContent = state.becario.nombre;
  const jefe = JEFES[state.becario.jefe];
  $("#jefe-escritorio").textContent = `Reporta a: ${jefe.nombre}`;
  empezarDia();
}

// ---------- Día ----------
function empezarDia() {
  state.hora = 9 * 60;
  state.enviadosHoy = 0;
  state.filtrosRestantes = 2;
  state.cafesRestantes = 2;
  state.colaUrgente = null;
  state.reglasActivas = REGLAS_PROGRESIVAS.filter((r) => r.dia <= state.dia);
  renderWhatsapp();
}

function renderWhatsapp() {
  mostrar("whatsapp");
  $("#wa-dia").textContent = `Día ${state.dia}` + (state.modo === "campania" ? ` / ${ECONOMIA.diasCampania}` : "");
  const cont = $("#wa-mensajes");
  cont.innerHTML = "";
  const eventos = (EVENTOS_WHATSAPP[state.dia] || []).slice();
  if (eventos.length === 0) {
    eventos.push({ autor: rnd(BECARIOS).nombre, texto: rnd([
      "buenos días, alguien ha visto mi grapadora",
      "café?",
      "hoy Luis tiene cara de pocos amigos, ojito",
      "el ascensor vuelve a estar roto",
      "quien se apunta al aperitivo luego",
    ]) });
  }
  eventos.forEach((m) => {
    const el = document.createElement("div");
    el.className = "wa-msg" + (m.autor === state.becario.nombre ? " propio" : "");
    el.innerHTML = `<span class="wa-autor">${m.autor}</span><span class="wa-texto">${m.texto}</span>`;
    cont.appendChild(el);
  });
  const nuevas = REGLAS_PROGRESIVAS.filter((r) => r.dia === state.dia);
  const rc = $("#wa-reglas");
  rc.innerHTML = nuevas.length
    ? "<div class='wa-regla-tit'>Regla nueva de la oficina:</div>" + nuevas.map((r) => `<div class="wa-regla">• ${r.texto}</div>`).join("")
    : "";
}

function entrarOficina() {
  mostrar("juego");
  cambiarPestana("trabajo");
  actualizarHUD();
  nuevaTarea();
  programarJefe();
}

// ---------- Tarea en pantalla ----------
function nuevaTarea() {
  if (state.hora >= state.finJornada) { finDia(); return; }
  // ¿Hay urgencia de Francesco encolada?
  if (state.colaUrgente) { const u = state.colaUrgente; state.colaUrgente = null; state.tarea = u; }
  else state.tarea = generarTarea();

  state.marcados = new Set();
  cambiarPestana("trabajo");
  $("#documento").innerHTML = `<div class="doc-vacio">Bandeja de entrada: 1 tarea nueva.<br>Pulsa <b>“Generar con IA”</b> para redactar el documento.</div>`;
  $("#btn-generar").style.display = "inline-block";
  $("#acciones-doc").style.display = "none";
  renderPostit();
  actualizarHUD();
}

function renderPostit() {
  const p = state.tarea.postit;
  let cabecera, cuerpo;
  if (p.origen === "andrea") {
    cabecera = `POST-IT · Andrea te pide un correo`;
    cuerpo = `<div class="postit-linea"><b>Para:</b> ${p.empresa}</div>
              <div class="postit-linea"><b>Asunto:</b> ${p.extra ? p.extra.asunto : ""}</div>
              <div class="postit-linea small">${p.extra ? p.extra.instru : ""}</div>`;
  } else if (p.origen === "francesco") {
    cabecera = `POST-IT · URGENTE de Francesco`;
    cuerpo = `<div class="postit-linea urgente">${p.urgenciaTexto}</div>
              <div class="postit-linea"><b>Empresa:</b> ${p.empresa}</div>
              <div class="postit-linea"><b>Sector:</b> ${p.sector} · <b>Región:</b> ${p.region}</div>`;
  } else {
    cabecera = `POST-IT · ${TIPOS_DOC[p.tipo]}`;
    cuerpo = `<div class="postit-linea"><b>Empresa:</b> ${p.empresa}</div>
              <div class="postit-linea"><b>Sector:</b> ${p.sector}</div>
              <div class="postit-linea"><b>Región:</b> ${p.region}</div>
              <div class="postit-linea small">Revísalo antes de enviarlo a ${JEFES[state.becario.jefe].nombre}.</div>`;
  }
  $("#postit").innerHTML = `<div class="postit-tit">${cabecera}</div>${cuerpo}`;
  $("#reglas-panel").innerHTML = state.reglasActivas.map((r) => `<div class="regla-item">• ${r.texto}</div>`).join("");
}

function generarConIA() {
  const t = state.tarea;
  pintarDocumento();
  t.minutos = entero(12, 20);
  avanzarTiempo(t.minutos);
  $("#btn-generar").style.display = "none";
  $("#acciones-doc").style.display = "flex";
  $("#btn-filtro").textContent = `🔍 Filtro anti-IA (${state.filtrosRestantes})`;
  actualizarHUD();
}

function pintarDocumento() {
  const doc = $("#documento");
  doc.innerHTML = "";
  state.tarea.parrafos.forEach((par, i) => {
    const el = document.createElement("p");
    el.className = "doc-par";
    el.textContent = par.texto;
    el.dataset.idx = i;
    if (state.marcados.has(i)) el.classList.add("marcado");
    el.onclick = () => toggleMarca(i, el);
    doc.appendChild(el);
  });
}

function toggleMarca(i, el) {
  if (state.marcados.has(i)) { state.marcados.delete(i); el.classList.remove("marcado"); }
  else { state.marcados.add(i); el.classList.add("marcado"); }
}

// Filtro anti-IA: usos limitados, solo ve "tics" de lenguaje, con falsos positivos y fallos.
function usarFiltroIA() {
  if (state.pestana !== "trabajo") return;
  if (state.filtrosRestantes <= 0) { feedback("Sin usos de filtro hoy. Toca leer.", "regular"); return; }
  state.filtrosRestantes--;
  avanzarTiempo(4);
  state.estres = Math.min(100, state.estres + 2);
  document.querySelectorAll(".doc-par").forEach((el) => {
    const par = state.tarea.parrafos[+el.dataset.idx];
    // Detecta tics de IA la mayoría de veces, se le escapan otros, y a veces marca de más.
    const marca = (filtroDetecta(par) && chance(0.85)) || chance(0.12);
    if (marca) { el.classList.add("sospechoso"); setTimeout(() => el.classList.remove("sospechoso"), 2600); }
  });
  $("#btn-filtro").textContent = `🔍 Filtro anti-IA (${state.filtrosRestantes})`;
  feedback("El filtro solo huele los 'tics' de IA. Geografía, datos y fuentes: léelos tú.", "regular");
  actualizarHUD();
}

// ---------- Envío ----------
function enviarDoc() {
  if (state.enModal) return;
  // Antes de enviar, a veces el jefe te pregunta por la fuente de un dato (te obliga a leer).
  const datosLegit = state.tarea.parrafos.filter((p) => p.dato && !p.fuenteFalsa && p.gazapo !== "FUENTE_FALSA");
  const preguntaProb = Math.min(0.35 + state.dia * 0.03, 0.8);
  if (datosLegit.length && chance(preguntaProb)) {
    preguntarFuente(rnd(datosLegit), (acierto) => resolverEnvio(acierto));
  } else {
    resolverEnvio(null);
  }
}

// Modal: ¿de dónde has sacado este dato?
function preguntarFuente(parDato, cb) {
  state.enModal = true;
  const jefe = JEFES[state.becario.jefe];
  const correcta = parDato.fuente;
  const opciones = new Set([correcta]);
  while (opciones.size < 4) opciones.add(rnd([...FUENTES_REALES, ...FUENTES_FALSAS]));
  const lista = [...opciones].sort(() => Math.random() - 0.5);

  $("#modal-titulo").textContent = `${jefe.nombre} se para en tu mesa`;
  $("#modal-cuerpo").innerHTML =
    `<p>"Oye, este dato: <i>«${parDato.resumen}»</i> … ¿de dónde lo has sacado exactamente?"</p>
     <p class="modal-nota">Tienes que decir la fuente que pusiste en el documento. (Si no lo leíste, mal vas.)</p>`;
  const cont = $("#modal-opciones");
  cont.innerHTML = "";
  lista.forEach((op) => {
    const b = document.createElement("button");
    b.className = "modal-op"; b.textContent = op;
    b.onclick = () => { cerrarModal(); cb(op === correcta); };
    cont.appendChild(b);
  });
  $("#modal").classList.add("activa");
}

function cerrarModal() { state.enModal = false; $("#modal").classList.remove("activa"); }

function resolverEnvio(aciertoFuente) {
  const t = state.tarea;
  const reales = t.parrafos.map((p, i) => ({ i, es: !!(p.gazapo || p.discrepancia), critico: p.gazapo ? GAZAPOS[p.gazapo].critico : false }));
  const noMarcados = reales.filter((r) => r.es && !state.marcados.has(r.i));
  const criticosSueltos = noMarcados.filter((r) => r.critico).length;

  const jefe = JEFES[state.becario.jefe];
  let pPillado = 1 - Math.pow(1 - jefe.severidad, noMarcados.length);
  pPillado = Math.min(0.98, pPillado + criticosSueltos * 0.25);
  const revisaLuis = chance(0.25 + state.dia * 0.02);

  // Fallar la pregunta de fuente delata que no lo has leído: sube el riesgo.
  if (aciertoFuente === false) pPillado = Math.min(0.98, pPillado + 0.4);

  let mensaje, tipo;
  const falsosPos = [...state.marcados].filter((i) => { const p = t.parrafos[i]; return !(p.gazapo || p.discrepancia); }).length;

  if (noMarcados.length === 0 && aciertoFuente !== false) {
    state.reputacion = Math.min(100, state.reputacion + 3);
    state.enviadosHoy++;
    ganarDinero(18);
    mensaje = `${jefe.nombre}: "Correcto${aciertoFuente ? ", y sabes de dónde sale el dato" : ""}. Buen trabajo." (+18€)`;
    tipo = "ok";
    if (falsosPos > 0) mensaje += `  (${falsosPos} marca(s) de más)`;
  } else if (chance(pPillado) || (revisaLuis && criticosSueltos > 0 && chance(JEFES.luis.severidad))) {
    const quien = (revisaLuis && criticosSueltos > 0) ? JEFES.luis : jefe;
    state.reputacion = Math.max(0, state.reputacion - 15);
    state.estres = Math.min(100, state.estres + 18);
    if (criticosSueltos > 0) state.strikes++;
    const causa = aciertoFuente === false ? "No tienes ni idea de dónde salió el dato. " : "";
    mensaje = `${quien.nombre}: "${causa}¿¿Esto lo ha escrito una IA?? ${criticosSueltos > 0 ? "STRIKE." : "Broncazo."}" (rep -15)`;
    tipo = "malo";
  } else {
    state.reputacion = Math.max(0, state.reputacion - 4);
    state.enviadosHoy++;
    ganarDinero(10);
    mensaje = `${jefe.nombre}: "Vale, pasa... pero revísalo mejor." (coló con fallos, +10€)`;
    tipo = "regular";
  }

  feedback(mensaje, tipo);
  chequearGameOver();
  if (!state.gameOver) setTimeout(nuevaTarea, 1500);
}

function rehacerDoc() {
  if (state.pestana !== "trabajo") return;
  avanzarTiempo(10);
  state.estres = Math.min(100, state.estres + 4);
  const p = state.tarea.postit;
  const dif = Math.min(0.2 + state.dia * 0.03, 0.6);
  state.tarea.parrafos = p.tipo === "DRAFT" ? construirBorrador(p, dif) : construirDocumento(p, dif);
  state.marcados = new Set();
  pintarDocumento();
  feedback(`"Rehacer": la IA regenera el documento (-10 min).`, "regular");
}

function editarDoc() {
  if (state.pestana !== "trabajo") return;
  if (state.marcados.size === 0) { feedback("No has marcado nada que editar.", "regular"); return; }
  avanzarTiempo(3 + state.marcados.size * 2);
  state.tarea.parrafos = state.tarea.parrafos.filter((_, i) => !state.marcados.has(i));
  state.marcados = new Set();
  pintarDocumento();
  feedback("Has borrado las líneas marcadas. Envía el documento limpio.", "ok");
}

// Pausa para el café: baja estrés y hambre, pero consume tiempo. Usos limitados por día.
function pausaCafe() {
  if (!$("#juego").classList.contains("activa") || state.enModal || state.gameOver) return;
  if (state.cafesRestantes <= 0) { feedback("Ya has bajado dos veces a la máquina. Como sigas, se nota.", "regular"); return; }
  state.cafesRestantes--;
  avanzarTiempo(10);
  state.estres = Math.max(0, state.estres - 12);
  state.hambre = Math.max(0, state.hambre - 8);
  actualizarCafe();
  feedback(rnd([
    "Café con el resto de becarios en la máquina. Estrés -12.",
    "Café y cornetto. Vuelves algo más entero. Estrés -12, hambre -8.",
    "Cinco minutos de cotilleo de oficina. Recargado.",
  ]), "ok");
}

function actualizarCafe() {
  const b = $("#btn-cafe");
  if (b) { b.textContent = `☕ Café (${state.cafesRestantes})`; b.disabled = state.cafesRestantes <= 0; }
}

// ---------- Pestaña Skyscanner / escaqueo ----------
function cambiarPestana(cual) {
  state.pestana = cual;
  $("#panel-trabajo").style.display = cual === "trabajo" ? "block" : "none";
  $("#panel-skyscanner").style.display = cual === "skyscanner" ? "block" : "none";
  $("#tab-trabajo").classList.toggle("activa", cual === "trabajo");
  $("#tab-skyscanner").classList.toggle("activa", cual === "skyscanner");
  // Escaquearse baja el estrés poco a poco; volver al trabajo lo corta.
  clearInterval(state.relaxInterval);
  if (cual === "skyscanner") {
    if (!$("#panel-skyscanner").dataset.pintado) pintarSkyscanner();
    state.relaxInterval = setInterval(() => { state.estres = Math.max(0, state.estres - 1); actualizarHUD(); }, 1500);
  }
  // Si el jefe estaba viniendo y vuelves a tiempo al trabajo, te salvas.
  if (cual === "trabajo" && state.jefeViene) resolverJefe(true);
}

function pintarSkyscanner() {
  const cont = $("#panel-skyscanner");
  cont.dataset.pintado = "1";
  const filas = SKYSCANNER_RUTAS.map((r) =>
    `<div class="sky-fila"><span>Milán (MXP) → ${r.destino}</span><span class="sky-hora">${r.hora}</span><span class="sky-precio">${r.precio}€</span><button class="sky-btn">Ver</button></div>`).join("");
  cont.innerHTML = `
    <div class="sky-barra">✈ Skyscanner — Vuelos baratos desde Milán</div>
    <div class="sky-body">
      <div class="sky-tit">Escápate un finde (o para siempre)</div>
      ${filas}
      <div class="sky-nota">Estás fingiendo que trabajas. El estrés baja... pero si un jefe se acerca y te pilla aquí, la lías. Vuelve con <b>Tab</b>.</div>
    </div>`;
  cont.querySelectorAll(".sky-btn").forEach((b) => b.onclick = () => feedback("Vuelo guardado en tus sueños. Sigues en Milán.", "regular"));
}

// ---------- Jefe se acerca ----------
function programarJefe() {
  pararJefe();
  state.jefeTimeout = setTimeout(dispararJefe, entero(9000, 20000));
}

function dispararJefe() {
  if (state.gameOver || !$("#juego").classList.contains("activa") || state.enModal) { programarJefe(); return; }
  state.jefeViene = true;
  const jefe = JEFES[chance(0.2) ? "luis" : state.becario.jefe];
  state.jefeActual = jefe;
  const av = $("#aviso-jefe");
  av.innerHTML = `👀 <b>${jefe.nombre}</b> se acerca a tu mesa — vuelve al trabajo (<b>Tab</b>)`;
  av.classList.add("activa");
  // Ventana de reacción.
  state.jefeVentana = setTimeout(() => {
    if (state.pestana === "skyscanner") resolverJefe(false);
    else resolverJefe(true);
  }, 3500);
}

function resolverJefe(aSalvo) {
  clearTimeout(state.jefeVentana);
  state.jefeViene = false;
  $("#aviso-jefe").classList.remove("activa");
  if (!aSalvo) {
    const jefe = state.jefeActual || JEFES[state.becario.jefe];
    const esLuis = jefe === JEFES.luis;
    state.reputacion = Math.max(0, state.reputacion - (esLuis ? 18 : 10));
    state.estres = Math.min(100, state.estres + 15);
    if (esLuis) state.strikes++;
    cambiarPestana("trabajo");
    feedback(`${jefe.nombre} te ha pillado en Skyscanner. ${esLuis ? "STRIKE." : "Bronca."} (rep -${esLuis ? 18 : 10})`, "malo");
    chequearGameOver();
  }
  actualizarHUD();
  if (!state.gameOver) programarJefe();
}

function pararJefe() {
  clearTimeout(state.jefeTimeout); clearTimeout(state.jefeVentana);
  clearInterval(state.relaxInterval);
  state.jefeViene = false;
  const av = $("#aviso-jefe"); if (av) av.classList.remove("activa");
}

// ---------- Economía / tiempo ----------
function ganarDinero(x) { state.dinero += x; }

function avanzarTiempo(min) {
  state.hora += min;
  if (state.hora > state.finJornada) {
    const extra = state.hora - state.finJornada;
    state.estres = Math.min(100, state.estres + Math.pow(extra / 30, 1.6) + 2);
  }
  // Interrupción de Francesco: a veces mete una urgencia para la siguiente tarea.
  if (state.becario.jefe === "francesco" && !state.colaUrgente && chance(0.18) && state.hora < state.finJornada) {
    const region = rnd(REGIONES);
    const emp = rnd(EMPRESAS);
    const txt = rnd(URGENCIAS_FRANCESCO).replace("{sector}", emp.sector.toLowerCase()).replace("{region}", region);
    const forzada = generarTarea({ origen: "francesco", tipo: rnd(["MARKET_STUDY", "FAIR_REPORT"]), extra: null });
    forzada.postit.origen = "francesco";
    forzada.postit.urgenciaTexto = txt;
    state.colaUrgente = forzada;
    state.estres = Math.min(100, state.estres + 6);
    feedback(`Francesco te interrumpe: "${txt}"`, "malo");
  }
  actualizarHUD();
}

function finDia() {
  pararJefe();
  const e = ECONOMIA;
  const ingresoDia = Math.round(e.becaMensual / e.diasCampania);
  const gastoDia = Math.round(e.alquilerMensual / e.diasCampania) + e.transporteMensual / e.diasCampania + e.comidaDiaria;
  const aperitivo = state.hora <= state.finJornada + 15 ? e.aperitivoDiario : 0;
  state.dinero += ingresoDia;
  state.dinero -= Math.round(gastoDia + aperitivo);

  state.hambre = Math.min(100, state.hambre + (state.enviadosHoy < state.cuotaDiaria ? 14 : 6));
  if (aperitivo) state.estres = Math.max(0, state.estres - 12);
  if (state.enviadosHoy < state.cuotaDiaria) state.reputacion = Math.max(0, state.reputacion - 8);

  mostrar("resumen");
  $("#res-titulo").textContent = `Fin del día ${state.dia}`;
  $("#res-cuerpo").innerHTML = `
    <div class="res-linea"><span>Informes enviados</span><b>${state.enviadosHoy} / ${state.cuotaDiaria} (cuota)</b></div>
    <div class="res-linea"><span>Salida</span><b>${horaTexto(Math.min(state.hora, 22*60))} ${aperitivo ? "🍸 aperitivo en Navigli" : "😓 horas extra"}</b></div>
    <div class="res-linea ingreso"><span>Beca (prorrateo)</span><b>+${ingresoDia}€</b></div>
    <div class="res-linea gasto"><span>Alquiler + transporte + comida${aperitivo ? " + aperitivo" : ""}</span><b>-${Math.round(gastoDia + aperitivo)}€</b></div>
    <div class="res-linea total"><span>Dinero acumulado</span><b>${state.dinero}€</b></div>
    <div class="res-linea"><span>Reputación</span><b>${state.reputacion}/100</b></div>
    <div class="res-linea"><span>Strikes</span><b>${state.strikes}/3</b></div>
    <div class="res-linea"><span>Hambre / Estrés</span><b>${Math.round(state.hambre)} / ${Math.round(state.estres)}</b></div>`;

  chequearGameOver(true);
  const btn = $("#btn-siguiente-dia");
  if (state.modo === "campania" && state.dia >= ECONOMIA.diasCampania && !state.gameOver) { finCampania(); return; }
  btn.style.display = state.gameOver ? "none" : "inline-block";
}

function siguienteDia() { state.dia++; empezarDia(); }

// ---------- Derrota / victoria ----------
function chequearGameOver(finDeDia = false) {
  let motivo = null;
  if (state.strikes >= 3) motivo = "3 strikes. Luis te ha despedido. La beca ha terminado.";
  else if (state.reputacion <= 0) motivo = "Tu reputación llegó a 0. No te renuevan la beca.";
  else if (state.hambre >= 100) motivo = "Hambre extrema: te has desmayado en el escritorio.";
  else if (state.estres >= 100) motivo = "Colapso por estrés. Te vas de Milán en el primer tren.";
  else if (finDeDia && state.dinero < -300) motivo = "Ruina total en Milán: no puedes pagar el alquiler.";
  if (motivo && !state.gameOver) { state.gameOver = true; pararJefe(); gameOver(motivo); }
}

function gameOver(motivo) {
  mostrar("final");
  $("#final-tit").textContent = "GAME OVER";
  $("#final-tit").className = "final-tit derrota";
  $("#final-cuerpo").innerHTML = `
    <p>${motivo}</p>
    <div class="final-stats">
      <div>Días sobrevividos: <b>${state.dia}</b></div>
      <div>Dinero final: <b>${state.dinero}€</b></div>
      <div>Reputación: <b>${state.reputacion}/100</b></div>
    </div>`;
}

function finCampania() {
  state.gameOver = true; pararJefe();
  mostrar("final");
  const bien = state.reputacion >= 40 && state.strikes < 3;
  $("#final-tit").textContent = bien ? "BECA COMPLETADA" : "BECA TERMINADA";
  $("#final-tit").className = "final-tit " + (bien ? "victoria" : "derrota");
  $("#final-cuerpo").innerHTML = `
    <p>${bien
      ? `Has sobrevivido los 6 meses de beca en el ICEX Milán sin que te pillen del todo. ${state.dinero >= 0 ? "Incluso has ahorrado algo." : "Vuelves a casa arruinado pero con experiencia."}`
      : "Terminas la beca de milagro, con la reputación por los suelos y sin carta de recomendación."}</p>
    <div class="final-stats">
      <div>Dinero final: <b>${state.dinero}€</b></div>
      <div>Reputación: <b>${state.reputacion}/100</b></div>
      <div>Strikes: <b>${state.strikes}/3</b></div>
    </div>`;
}

// ---------- HUD / feedback ----------
function actualizarHUD() {
  $("#hud-dia").textContent = `Día ${state.dia}`;
  $("#hud-hora").textContent = horaTexto(Math.min(state.hora, 22 * 60));
  $("#hud-dinero").textContent = `${state.dinero}€`;
  $("#hud-rep").textContent = `Rep ${state.reputacion}`;
  $("#hud-strikes").textContent = `⚠ ${state.strikes}/3`;
  setBarra("#barra-hambre", state.hambre);
  setBarra("#barra-estres", state.estres);
  const rel = $("#hud-hora");
  rel.classList.toggle("tarde", state.hora >= 16 * 60);
  rel.classList.toggle("extra", state.hora > state.finJornada);
  actualizarCafe();
}

function setBarra(sel, val) {
  const b = $(sel); if (!b) return;
  b.style.width = Math.min(100, val) + "%";
  b.style.background = val > 75 ? "#b23b3b" : val > 45 ? "#c8912f" : "#5a8f4d";
}

function feedback(msg, tipo) {
  const f = $("#feedback");
  f.textContent = msg;
  f.className = "feedback " + tipo + " visible";
  clearTimeout(f._t);
  f._t = setTimeout(() => f.classList.remove("visible"), 3400);
}

// ---------- Wiring ----------
window.addEventListener("DOMContentLoaded", () => {
  renderSeleccion();
  $("#btn-jugar").onclick = () => mostrar("seleccion");
  $("#btn-wa-entrar").onclick = entrarOficina;
  $("#btn-generar").onclick = generarConIA;
  $("#btn-enviar").onclick = enviarDoc;
  $("#btn-rehacer").onclick = rehacerDoc;
  $("#btn-editar").onclick = editarDoc;
  $("#btn-filtro").onclick = usarFiltroIA;
  $("#btn-siguiente-dia").onclick = siguienteDia;
  $("#btn-reiniciar").onclick = () => location.reload();
  $("#btn-volver-menu").onclick = () => location.reload();
  $("#tab-trabajo").onclick = () => cambiarPestana("trabajo");
  $("#tab-skyscanner").onclick = () => cambiarPestana("skyscanner");
  $("#btn-cafe").onclick = pausaCafe;
  // Tecla Tab: alterna entre trabajo y escaqueo, como un alt-tab de oficina.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Tab" && $("#juego").classList.contains("activa") && !state.enModal) {
      e.preventDefault();
      cambiarPestana(state.pestana === "trabajo" ? "skyscanner" : "trabajo");
    }
  });
});
