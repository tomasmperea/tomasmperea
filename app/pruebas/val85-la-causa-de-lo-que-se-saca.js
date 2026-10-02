/* ============================================================
   VAL-85 — POR QUÉ SE SACA CADA ÍTEM, LEÍDO DEL MOTOR DE LA APP

   Sin navegador. Corre contra el motor EMBEBIDO en app/valija.html (no
   contra app/parts/), extraído igual que en motores-desde-html.js.

   La reproducción, antes del arreglo (7f3a1e5), con el viaje SIN TOCAR:
   una lista armada antes de aprender trae «Cámara y cargador» pendiente;
   en otros dos viajes de la misma combinación se descartó.

     sacados: Cámara y cargador · nuevos: 0
     motivo: «El viaje cambió: saco 1 que ya no corresponde.»

   Lo que se asevera:
     1 · sólo saca: causa `aprendido`, y el motivo nombra lo descartado
     2 · sólo suma (VAL-77b): el motivo de antes, textual
     3 · las dos
     4 · CONTROL: un cambio real del viaje que saca algo dice lo mismo que
         el motor de antes, textual
     5 · EL VECINO: suprimido Y su regla dejó de aplicar -> `viaje`, y el
         texto es el del motor de antes
     6 · mixto: lo aprendido saca uno y una regla suma otro -> el texto de
         antes (criterio 5 del brief)
     7 · después de la IA (`planListUpdateAsync`): la causa sobrevive al
         recálculo; y lo que suma la IA no es lo aprendido
     8 · sin determinar: un ítem aprendido que dejó de promoverse
     9 · un destino vencido es `viaje`

   EL CONTROL NEGATIVO va adentro: el caso 1 se corre contra
   `git show 7f3a1e5` y TIENE que decir «El viaje cambió». Si no lo dice, la
   reproducción no llegó y el resto no prueba nada.

   Los sabotajes de afuera, con lo que dan, están en app/pruebas/LEEME.md.

       node app/pruebas/val85-la-causa-de-lo-que-se-saca.js [ruta/al/valija.html]
   ============================================================ */
"use strict";
const fs = require("fs"), path = require("path"), cp = require("child_process");

const RAIZ = path.resolve(__dirname, "..", "..");
const HTML = process.argv[2] ? path.resolve(process.argv[2]) : path.join(RAIZ, "app", "valija.html");
const ANTES = "7f3a1e5";

function motorDe(fuente) {
  const abre = "const PackingEngine = (function () {";
  const i = fuente.indexOf(abre);
  if (i < 0) throw new Error("no encontré el motor en el HTML");
  const j = fuente.indexOf("\n})();", i);
  return new Function(fuente.slice(i + abre.length, j))();
}
const PE = motorDe(fs.readFileSync(HTML, "utf8"));
const PE_ANTES = motorDe(cp.execSync(`git show ${ANTES}:app/valija.html`, { cwd:RAIZ, maxBuffer:64 << 20 }).toString());

let fallos = 0, pasaron = 0;
const ok = (c, m) => { if (c) { pasaron++; console.log("  ok     " + m); } else { fallos++; console.log("  FALLA  " + m); } };
const info = m => console.log("  info   " + m);
function bloque(nombre, fn) {
  console.log("\n· " + nombre);
  return Promise.resolve().then(fn).catch(e => { fallos++; console.log("  FALLA (excepción) " + (e && e.stack)); });
}

/* Los viajes, con los campos de la hoja del viaje: las fechas del viaje son
   `type="date"`. Las reservas, con los del formulario: un vuelo tiene
   origen, destino, sale y llega, en `datetime-local`. */
const NOW = "2027-01-01T00:00:00.000Z";
const VIAJE = (id, name, destination, a, b) => ({ id, name, destination, startDate:a, endDate:b, travelers:"Tomás" });
const X  = VIAJE("x",  "Mendoza",   "Mendoza",   "2027-07-01", "2027-07-08");
const M1 = VIAJE("m1", "Esquel",    "Esquel",    "2027-08-01", "2027-08-08");
const M2 = VIAJE("m2", "Bariloche", "Bariloche", "2027-09-01", "2027-09-08");
const VUELO = (id, a) => ({ id, type:"flight", title:"Vuelo a Bariloche", from:"AEP", to:"BRC",
                            start:a + "T08:10", end:a + "T10:25", provider:"Aerolíneas" });

const armar = (E, trip, tipo, items, history) => E.buildPackingList({ trip, items:items || [], tipoViaje:tipo, history:history || [], now:NOW });
const claveDe = (E, list, re) => Object.keys(list.items).find(k => re.test(k));
const plan = (E, list, trip, tipo, items, history) =>
  E.planListUpdate({ list, trip, items:items || [], tipoViaje:tipo, history:history || [], now:NOW });
const resumen = p => `sacados: ${JSON.stringify(p.sacados.map(s => s.nombre + " [" + s.causa + "]"))} · nuevos: ${JSON.stringify(p.nuevos.map(n => n.nombre + " [" + n.origen + "]"))}`;

/** Dos viajes de la misma combinación donde se descartó lo que matchea `re`. */
function historialDescartando(E, tipo, re, items) {
  return [M1, M2].map((t, i) => {
    const l = armar(E, t, tipo, items ? items(i) : []);
    const clave = claveDe(E, l, re);
    if (!clave) throw new Error("el fixture no tiene un ítem que matchee " + re + ": no hay nada que descartar");
    return E.dismissItem(l, clave);
  });
}
/** Lo mismo, y además se agregó «Termo» a mano en los dos. */
const conTermo = (E, hist) => hist.map(l => E.addManualItem(l, { nombre:"Termo", categoria:"otros" }));

/** El caso del brief: x armada antes, cámara descartada en m1 y m2. */
function casoSoloSaca(E) {
  const lista = armar(E, X, "montana");
  const hist = historialDescartando(E, "montana", /^camara/);
  return { lista, hist, p:plan(E, lista, X, "montana", [], hist) };
}

(async () => {
  console.log("HTML bajo prueba: " + HTML);
  console.log("motor anterior:   git show " + ANTES + ":app/valija.html");

  await bloque("CONTROL NEGATIVO · el motor anterior reproduce el defecto", () => {
    const { lista, p } = casoSoloSaca(PE_ANTES);
    info(resumen(p) + " · motivo: " + JSON.stringify(p.motivo));
    ok(lista.items[claveDe(PE_ANTES, lista, /^camara/)].estado === "pendiente", "la cámara está pendiente en la lista armada antes");
    ok(p.motivo === "El viaje cambió: saco 1 que ya no corresponde.", "en " + ANTES + " dice «El viaje cambió: saco 1 que ya no corresponde.»");
  });

  await bloque("1 · sólo saca: lo descartado en otros dos viajes, con el viaje sin tocar", () => {
    const { p } = casoSoloSaca(PE);
    info(resumen(p) + " · motivo: " + JSON.stringify(p.motivo));
    ok(p.desactualizada === true && p.sacados.length === 1 && p.nuevos.length === 0, "el plan saca uno y no suma nada");
    ok(p.sacados[0].causa === "aprendido", "la cámara sale con causa `aprendido`");
    ok(PE.planSoloAprendido(p.nuevos, p.sacados) === true, "planSoloAprendido es verdadera con sacados no vacío");
    ok(p.motivo === "Por lo que descartaste en otros viajes: saco 1 ítem.", "el motivo nombra lo descartado en otros viajes");
    ok(!claveDe(PE, p.listaPropuesta, /^camara/), "y la lista propuesta ya no la tiene");
  });

  await bloque("2 · sólo suma (VAL-77b): el texto de antes, textual", () => {
    const lista = armar(PE, X, "montana");
    const hist = conTermo(PE, [M1, M2].map(t => armar(PE, t, "montana")));
    const p = plan(PE, lista, X, "montana", [], hist);
    info(resumen(p) + " · motivo: " + JSON.stringify(p.motivo));
    ok(p.sacados.length === 0 && p.nuevos.length === 1 && p.nuevos[0].origen === "historial", "suma «Termo» de origen historial y no saca nada");
    ok(p.motivo === "Por lo que agregaste a mano en otros viajes: sumo 1 ítem.", "el motivo es el de VAL-77b");
    const antes = plan(PE_ANTES, armar(PE_ANTES, X, "montana"), X, "montana", [],
                       conTermo(PE_ANTES, [M1, M2].map(t => armar(PE_ANTES, t, "montana"))));
    ok(p.motivo === antes.motivo, "idéntico al motor de " + ANTES);
  });

  await bloque("3 · las dos: suma lo agregado y saca lo descartado en otros viajes", () => {
    const lista = armar(PE, X, "montana");
    const hist = conTermo(PE, historialDescartando(PE, "montana", /^camara/));
    const p = plan(PE, lista, X, "montana", [], hist);
    info(resumen(p) + " · motivo: " + JSON.stringify(p.motivo));
    ok(p.nuevos.length === 1 && p.sacados.length === 1 && p.sacados[0].causa === "aprendido", "suma uno, saca uno, y lo sacado es aprendido");
    ok(PE.planSoloAprendido(p.nuevos, p.sacados) === true, "planSoloAprendido es verdadera");
    ok(p.motivo === "Por lo que agregaste a mano y descartaste en otros viajes: sumo 1 ítem y saco 1 ítem.", "el motivo nombra las dos cosas");
  });

  await bloque("4 · CONTROL: un cambio real del viaje (montaña -> ciudad) dice lo de antes", () => {
    const correr = E => plan(E, armar(E, X, "montana"), X, "ciudad", [], []);
    const p = correr(PE), antes = correr(PE_ANTES);
    info(resumen(p));
    info("motivo: " + JSON.stringify(p.motivo));
    ok(p.sacados.length > 0 && p.sacados.every(s => s.causa === "viaje"), "todo lo sacado tiene causa `viaje`");
    ok(PE.planSoloAprendido(p.nuevos, p.sacados) === false, "planSoloAprendido es falsa");
    ok(/^El viaje cambió: /.test(p.motivo) && p.motivo === antes.motivo, "el motivo es idéntico al motor de " + ANTES);
  });

  await bloque("5 · EL VECINO: «Líquidos» descartado en otros viajes, Y se borró el vuelo de este", () => {
    /* La regla de los líquidos lee si hay vuelos. Con el vuelo, la regla
       aplica y lo aprendido la saca; sin el vuelo, la regla tampoco aplica.
       El mismo tipo en los tres viajes, así que la supresión vale igual. */
    const correr = E => {
      const lista = armar(E, X, "montana", [VUELO("vx", "2027-07-01")]);
      const hist = historialDescartando(E, "montana", /^liquido/, i => [VUELO("v" + i, i ? "2027-09-01" : "2027-08-01")]);
      const sinTocar = plan(E, lista, X, "montana", [VUELO("vx", "2027-07-01")], hist);
      const sinVuelo = plan(E, lista, X, "montana", [], hist);
      return { sinTocar, sinVuelo, sup:sinVuelo.listaPropuesta.aprendizaje.suprimidos.map(e => e.clave) };
    };
    const r = correr(PE), antes = correr(PE_ANTES);
    info("suprimidos: " + JSON.stringify(r.sup));
    info("con el vuelo:  " + resumen(r.sinTocar) + " · " + JSON.stringify(r.sinTocar.motivo));
    info("sin el vuelo:  " + resumen(r.sinVuelo) + " · " + JSON.stringify(r.sinVuelo.motivo));
    ok(r.sup.some(c => /^liquido/.test(c)), "los líquidos están suprimidos por lo aprendido");
    ok(r.sinTocar.sacados.length === 1 && r.sinTocar.sacados[0].causa === "aprendido",
       "con el vuelo todavía cargado, sacarlos es lo aprendido (la regla sigue aplicando)");
    ok(r.sinVuelo.sacados.length === 1 && /^liquido/.test(r.sinVuelo.sacados[0].clave), "sin el vuelo se saca sólo eso");
    ok(r.sinVuelo.sacados[0].causa === "viaje", "y la causa es `viaje`: sin lo aprendido se iría igual");
    ok(r.sinVuelo.motivo === "El viaje cambió: saco 1 que ya no corresponde." && r.sinVuelo.motivo === antes.sinVuelo.motivo,
       "el motivo es el de antes, idéntico al motor de " + ANTES);
  });

  await bloque("6 · mixto: lo aprendido saca uno y cargar un vuelo suma otro (criterio 5)", () => {
    const correr = E => {
      const lista = armar(E, X, "montana");
      const hist = historialDescartando(E, "montana", /^camara/);
      return plan(E, lista, X, "montana", [VUELO("vx", "2027-07-01")], hist);
    };
    const p = correr(PE), antes = correr(PE_ANTES);
    info(resumen(p) + " · motivo: " + JSON.stringify(p.motivo));
    ok(p.nuevos.some(n => n.origen === "regla") && p.sacados.some(s => s.causa === "aprendido"), "una regla suma, lo aprendido saca");
    ok(PE.planSoloAprendido(p.nuevos, p.sacados) === false, "planSoloAprendido es falsa");
    ok(p.motivo === antes.motivo && /^El viaje cambió: /.test(p.motivo), "el motivo es idéntico al motor de " + ANTES);
  });

  await bloque("7 · después de la IA: la causa sobrevive al recálculo de `sacados`", async () => {
    const { lista, hist } = casoSoloSaca(PE);
    const preguntas = [];
    const vacia = async prompt => { preguntas.push(prompt); return { items:[], quitar:[] }; };
    const p = await PE.planListUpdateAsync({ list:lista, trip:X, items:[], tipoViaje:"montana", history:hist, now:NOW, ask:vacia });
    info(resumen(p) + " · motivo: " + JSON.stringify(p.motivo));
    ok(preguntas.length === 1, "la capa de IA corrió (se le preguntó una vez)");
    ok(p.sacados.length === 1 && p.sacados[0].causa === "aprendido", "lo sacado sigue con causa `aprendido` después del recálculo");
    ok(p.motivo === "Por lo que descartaste en otros viajes: saco 1 ítem.", "y el motivo nombra lo descartado");

    const conAlgo = async () => ({ items:[{ nombre:"Bastones de trekking", categoria:"destino", motivo:"Senderos de montaña." }], quitar:[] });
    const q = await PE.planListUpdateAsync({ list:lista, trip:X, items:[], tipoViaje:"montana", history:hist, now:NOW, ask:conAlgo });
    info(resumen(q) + " · motivo: " + JSON.stringify(q.motivo));
    ok(q.nuevos.some(n => n.origen === "destino") && q.sacados[0].causa === "aprendido", "la IA suma uno de origen destino; lo sacado sigue aprendido");
    ok(PE.planSoloAprendido(q.nuevos, q.sacados) === false && /^El viaje cambió: /.test(q.motivo),
       "lo que suma la IA no es lo aprendido: el texto es el de antes");
  });

  await bloque("8 · sin determinar: un ítem aprendido que dejó de promoverse", () => {
    /* La lista se armó cuando «Termo» estaba promovido; después el historial
       ya no lo promueve (por ejemplo, se borró uno de esos viajes). Desde acá
       no se sabe si cambió el historial o el viaje: no se afirma ninguna. */
    const hist = conTermo(PE, [M1, M2].map(t => armar(PE, t, "montana")));
    const lista = armar(PE, X, "montana", [], hist);
    const p = plan(PE, lista, X, "montana", [], [hist[0]]);
    info(resumen(p) + " · motivo: " + JSON.stringify(p.motivo));
    ok(p.sacados.length === 1 && p.sacados[0].origen === "historial" && p.sacados[0].causa === "sin-determinar", "causa `sin-determinar`");
    ok(PE.planSoloAprendido(p.nuevos, p.sacados) === false, "y no cuenta como lo aprendido: el texto es el de antes");
  });

  await bloque("9 · un ítem de la capa de destino razonado para otro destino es `viaje`", async () => {
    const ask = async () => ({ items:[{ nombre:"Adaptador universal", categoria:"destino", motivo:"Enchufes distintos." }], quitar:[] });
    const lista = await PE.enrichWithDestination(armar(PE, X, "montana"), ask, { now:NOW });
    const a = Object.keys(lista.items).find(k => lista.items[k].origen === "destino");
    const Y = Object.assign({}, X, { destination:"Salta" });
    const p = plan(PE, lista, Y, "montana", [], []);
    info(resumen(p));
    ok(!!a && p.sacados.length === 1 && p.sacados[0].clave === a && p.sacados[0].causa === "viaje", "el ítem de destino vencido sale con causa `viaje`");
  });

  console.log("\n====================================================");
  console.log(fallos ? `  ${fallos} FALLARON (${pasaron} pasaron)` : `  Todo en verde — ${pasaron} aserciones`);
  console.log("====================================================\n");
  process.exit(fallos ? 1 : 0);
})();
