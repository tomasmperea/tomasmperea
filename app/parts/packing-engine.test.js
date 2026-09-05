/* ============================================================
   VALIJA · PRUEBAS DEL MOTOR DE EQUIPAJE
   Sin frameworks. Se corre así:

       node app/parts/packing-engine.test.js

   Imprime cada caso, lo que falló, y sale con código distinto
   de cero si hay una sola falla.
   ============================================================ */

var E = require("./packing-engine.js");

/* ---------- arnés mínimo ---------- */
var passed = 0, failed = 0, pending = [];

function group(title) { console.log("\n" + title + "\n" + "-".repeat(title.length)); }

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log("  ok     " + name);
  } catch (e) {
    failed++;
    console.log("  FALLA  " + name);
    console.log("         " + (e && e.message ? e.message : e));
    pending.push(name);
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || "se esperaba verdadero"); }
function eq(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg ? msg + ". " : "") + "esperaba " + JSON.stringify(expected) + " y vino " + JSON.stringify(actual));
  }
}
function item(list, key) { return (list.items || []).filter(function (i) { return i.key === key; })[0] || null; }
function hasItem(list, key, msg) {
  var it = item(list, key);
  assert(it && !it.dismissed, (msg || "") + " falta el ítem \"" + key + "\". Hay: " + keys(list).join(", "));
  return it;
}
function noItem(list, key, msg) {
  var it = item(list, key);
  assert(!it || it.dismissed, (msg || "") + " no debería estar el ítem \"" + key + "\"");
}
function keys(list) { return (list.items || []).map(function (i) { return i.key; }); }
function AT() { return "2026-09-05T12:00:00.000Z"; }

/* ---------- datos de prueba ---------- */
function viajePlaya(over) {
  return Object.assign({
    id:"t-playa", name:"Verano en Brasil", destination:"Florianópolis",
    startDate:"2026-01-10", endDate:"2026-01-17"
  }, over || {});
}
function listaHistorial(tripType, items) {
  return { schemaVersion:1, tripType:tripType, items:items };
}
function manual(label, category) {
  return { key:E.slug(label), label:label, category:category || "otros", source:"manual", manual:true, packed:true, dismissed:false };
}
function descartado(label) {
  return { key:E.slug(label), label:label, category:"electronica", source:"regla", manual:false, packed:false, dismissed:true };
}

/* ============================================================ */
async function main() {

group("Catálogo de reglas");

await test("el catálogo no tiene ids ni claves repetidas, y toda regla tiene razón", function () {
  var problemas = E.validateRules();
  assert(problemas.length === 0, "problemas en el catálogo:\n         " + problemas.join("\n         "));
  assert(E.BASE_RULES.length >= 30, "el catálogo quedó corto: " + E.BASE_RULES.length + " reglas");
});

await test("toda categoría usada por una regla existe en CATEGORIES", function () {
  var validas = E.CATEGORIES.map(function (c) { return c.key; });
  E.BASE_RULES.forEach(function (r) {
    assert(validas.indexOf(r.category) >= 0, "regla " + r.id + " con categoría " + r.category);
  });
});

group("Duración: de un día a treinta");

await test("viaje de un día: cantidades mínimas y coherentes", function () {
  var l = E.buildPackingList({
    trip:{ id:"t1", name:"Ida y vuelta a Rosario", destination:"Rosario", startDate:"2026-03-02", endDate:"2026-03-02" },
    now:AT()
  });
  eq(l.basis.days, 1, "días");
  eq(l.basis.nights, 0, "noches");
  eq(hasItem(l, "remeras").qty, 2, "remeras de un día");
  eq(hasItem(l, "ropa-interior").qty, 2, "ropa interior de un día");
  eq(hasItem(l, "pantalones").qty, 1, "pantalones de un día");
  eq(hasItem(l, "pijama").qty, 1, "pijama de un día");
  assert(l.items.length > 10, "la lista de un día quedó vacía");
});

await test("viaje de treinta días: las cantidades se topean y lo explican", function () {
  var l = E.buildPackingList({
    trip:{ id:"t2", name:"Vuelta larga", destination:"Rosario", startDate:"2026-03-01", endDate:"2026-03-30" },
    now:AT()
  });
  eq(l.basis.days, 30, "días");
  var remeras = hasItem(l, "remeras");
  eq(remeras.qty, 8, "tope de remeras");
  assert(/lav/i.test(remeras.reason), "el tope tiene que explicar que se lava: \"" + remeras.reason + "\"");
  eq(hasItem(l, "ropa-interior").qty, 10, "tope de ropa interior");
  eq(hasItem(l, "medias").qty, 10, "tope de medias");
  eq(hasItem(l, "pantalones").qty, 4, "tope de pantalones");
  eq(hasItem(l, "pijama").qty, 2, "tope de pijamas");
});

await test("cada cantidad viene con su explicación", function () {
  var l = E.buildPackingList({ trip:viajePlaya(), now:AT() });
  l.items.forEach(function (i) {
    assert(String(i.reason || "").trim().length > 0, "el ítem \"" + i.key + "\" no explica por qué está");
    if (i.qty != null) assert(i.qty >= 1, "cantidad inválida en " + i.key + ": " + i.qty);
  });
});

await test("viaje sin fechas: genera igual, avisa, y usa el default documentado", function () {
  var l = E.buildPackingList({ trip:{ id:"t3", name:"Escapada", destination:"Colonia" }, now:AT() });
  eq(l.basis.daysKnown, false, "daysKnown");
  eq(l.basis.days, E.DEFAULT_DAYS, "días asumidos");
  assert(l.items.length > 10, "sin fechas la lista igual tiene que servir");
  var w = l.warnings.filter(function (x) { return x.code === "sin-fechas"; })[0];
  assert(w, "falta el aviso de que no hay fechas");
  assert(/fecha/i.test(w.text), "el aviso tiene que hablar de las fechas");
});

group("Internacional o nacional");

await test("internacional deducido de los códigos IATA del vuelo", function () {
  var l = E.buildPackingList({
    trip:{ id:"t4", name:"Europa", destination:"", startDate:"2026-05-01", endDate:"2026-05-15" },
    items:[{ type:"flight", from:"EZE", to:"MAD" }, { type:"flight", from:"MAD", to:"EZE" }],
    now:AT()
  });
  eq(l.basis.international, true, "tendría que ser internacional");
  eq(l.basis.internationalSource, "vuelos", "fuente de la deducción");
  hasItem(l, "pasaporte", "internacional:");
  hasItem(l, "adaptador-de-enchufe", "internacional:");
  hasItem(l, "seguro-de-viaje", "internacional:");
  hasItem(l, "efectivo-en-moneda-local", "internacional:");
});

await test("nacional deducido de vuelos de cabotaje", function () {
  var l = E.buildPackingList({
    trip:{ id:"t5", name:"Sur", destination:"", startDate:"2026-07-01", endDate:"2026-07-08" },
    items:[{ type:"flight", from:"AEP", to:"BRC" }, { type:"flight", from:"BRC", to:"AEP" }],
    now:AT()
  });
  eq(l.basis.international, false, "tendría que ser nacional");
  eq(l.basis.internationalSource, "vuelos", "fuente de la deducción");
  noItem(l, "pasaporte", "nacional:");
  noItem(l, "adaptador-de-enchufe", "nacional:");
  hasItem(l, "dni", "nacional:");
});

await test("internacional deducido del destino cuando no hay vuelos", function () {
  var l = E.buildPackingList({ trip:{ id:"t6", name:"Escapada", destination:"Montevideo, Uruguay", startDate:"2026-02-01", endDate:"2026-02-04" }, now:AT() });
  eq(l.basis.international, true, "Uruguay es internacional");
  eq(l.basis.internationalSource, "destino", "fuente");
  hasItem(l, "pasaporte");
});

await test("destino irreconocible: no inventa, arma nacional y avisa", function () {
  var l = E.buildPackingList({ trip:{ id:"t7", name:"Viaje", destination:"", startDate:"2026-02-01", endDate:"2026-02-04" }, now:AT() });
  eq(l.basis.internationalKnown, false, "no puede saberlo");
  eq(l.basis.international, false, "ante la duda, nacional");
  assert(l.warnings.some(function (w) { return w.code === "destino-desconocido"; }), "falta el aviso de destino desconocido");
});

group("Tipos de viaje");

var esperadoPorTipo = {
  playa:    ["malla", "ojotas", "protector-solar"],
  ciudad:   ["un-par-para-salir", "zapatillas-comodas"],
  montana:  ["primera-capa-termica", "campera-impermeable", "botas-o-zapatillas-de-trekking", "gorro-y-guantes-de-abrigo"],
  trabajo:  ["muda-formal", "zapatos-de-vestir", "notebook-y-cargador"],
  aventura: ["botas-o-zapatillas-de-trekking", "linterna-frontal", "repelente-de-mosquitos"],
  mixto:    ["dni", "remeras", "neceser-armado"]
};

Object.keys(esperadoPorTipo).forEach(function (tipo) {
  test("tipo \"" + tipo + "\": trae sus ítems propios y ninguno sin categoría", function () {
    var l = E.buildPackingList({
      trip:{ id:"t-" + tipo, name:"Viaje", destination:"", startDate:"2026-04-01", endDate:"2026-04-06" },
      tripType:tipo, now:AT()
    });
    eq(l.tripType, tipo, "el tipo elegido manda");
    eq(l.basis.tripTypeSource, "elegido", "fuente del tipo");
    esperadoPorTipo[tipo].forEach(function (k) { hasItem(l, k, "tipo " + tipo + ":"); });
    var validas = E.CATEGORIES.map(function (c) { return c.key; });
    l.items.forEach(function (i) { assert(validas.indexOf(i.category) >= 0, "categoría rara en " + i.key); });
    assert(l.items.length >= 20, "lista corta para " + tipo + ": " + l.items.length);
  });
});
// las pruebas de arriba se encolan sincrónicamente; esperamos a que terminen
await new Promise(function (r) { setTimeout(r, 0); });

await test("playa no trae ropa de montaña y montaña no trae malla", function () {
  var base = { id:"t-x", name:"Viaje", startDate:"2026-04-01", endDate:"2026-04-06" };
  var playa = E.buildPackingList({ trip:base, tripType:"playa", now:AT() });
  var montana = E.buildPackingList({ trip:base, tripType:"montana", now:AT() });
  noItem(playa, "primera-capa-termica", "playa:");
  noItem(playa, "gorro-y-guantes-de-abrigo", "playa:");
  noItem(montana, "malla", "montaña:");
  noItem(montana, "ojotas", "montaña:");
});

await test("el tipo se sugiere solo cuando no lo eligen", function () {
  var l = E.buildPackingList({ trip:viajePlaya(), now:AT() });
  eq(l.tripType, "playa", "Florianópolis en enero es playa");
  eq(l.basis.tripTypeSource, "sugerido", "fuente del tipo");
  assert(l.basis.tripTypeReason.length > 0, "la sugerencia tiene que explicarse");

  var s = E.suggestTripType({ name:"Congreso de cardiología", destination:"Madrid", startDate:"2026-06-01", endDate:"2026-06-04" }, []);
  eq(s.type, "trabajo", "un congreso es viaje de trabajo");

  var m = E.suggestTripType({ name:"Bariloche en julio", destination:"Bariloche" }, []);
  eq(m.type, "montana", "Bariloche es montaña");

  var sin = E.suggestTripType({ name:"Viaje" }, []);
  assert(E.TRIP_TYPES.some(function (t) { return t.key === sin.type; }), "sin pistas igual tiene que proponer un tipo");
});

group("Ajustes por lo que ya está cargado en el viaje");

await test("auto alquilado: pide la licencia de conducir", function () {
  var l = E.buildPackingList({
    trip:{ id:"t8", name:"Ruta 40", destination:"Mendoza", startDate:"2026-03-01", endDate:"2026-03-08" },
    items:[{ type:"car", provider:"Hertz", title:"Auto en Mendoza" }],
    now:AT()
  });
  eq(l.basis.facts.hasRentalCar, true, "hecho hasRentalCar");
  var lic = hasItem(l, "licencia-de-conducir");
  assert(/auto alquilado/i.test(lic.reason), "la razón tiene que nombrar el auto: \"" + lic.reason + "\"");
  noItem(l, "licencia-de-conducir-internacional", "auto nacional:");
});

await test("auto alquilado en el exterior: además la licencia internacional", function () {
  var l = E.buildPackingList({
    trip:{ id:"t9", name:"Andalucía", destination:"Sevilla, España", startDate:"2026-03-01", endDate:"2026-03-10" },
    items:[{ type:"car", provider:"Europcar" }],
    now:AT()
  });
  hasItem(l, "licencia-de-conducir");
  hasItem(l, "licencia-de-conducir-internacional");
});

await test("vuelo cargado: aparece la regla de líquidos de 100 ml", function () {
  var conVuelo = E.buildPackingList({ trip:{ id:"ta", name:"Viaje", destination:"Córdoba", startDate:"2026-03-01", endDate:"2026-03-05" }, items:[{ type:"flight", from:"AEP", to:"COR" }], now:AT() });
  var sinVuelo = E.buildPackingList({ trip:{ id:"tb", name:"Viaje", destination:"Córdoba", startDate:"2026-03-01", endDate:"2026-03-05" }, items:[], now:AT() });
  hasItem(conVuelo, "liquidos-en-envases-de-hasta-100-ml");
  noItem(sinVuelo, "liquidos-en-envases-de-hasta-100-ml", "sin vuelo:");
});

await test("trekking cargado como actividad: aparece el calzado, aunque el viaje sea de ciudad", function () {
  var l = E.buildPackingList({
    trip:{ id:"tc", name:"Semana en Santiago", destination:"Santiago de Chile", startDate:"2026-05-01", endDate:"2026-05-07" },
    items:[{ type:"act", title:"Trekking al Cerro Provincia" }],
    tripType:"ciudad", now:AT()
  });
  eq(l.basis.facts.hasTrekking, true, "hecho hasTrekking");
  hasItem(l, "botas-o-zapatillas-de-trekking");
  hasItem(l, "campera-impermeable");
});

group("Historial (VAL-32)");

await test("historial vacío: la lista sale igual con las reglas base", function () {
  var sin = E.buildPackingList({ trip:viajePlaya(), tripType:"playa", now:AT() });
  var conVacio = E.buildPackingList({ trip:viajePlaya(), tripType:"playa", history:[], now:AT() });
  eq(conVacio.items.length, sin.items.length, "misma cantidad de ítems");
  eq(conVacio.learning.sampleSize, 0, "sin viajes previos");
  eq(conVacio.learning.promoted.length, 0, "nada que promover");
  eq(conVacio.learning.suppressed.length, 0, "nada que suprimir");
});

await test("un ítem agregado a mano en dos viajes del mismo tipo pasa a sugerirse", function () {
  var history = [
    listaHistorial("playa", [manual("Toalla de microfibra", "otros")]),
    listaHistorial("playa", [manual("Toalla de microfibra", "otros")])
  ];
  var l = E.buildPackingList({ trip:viajePlaya(), tripType:"playa", history:history, now:AT() });
  var it = hasItem(l, "toalla-de-microfibra");
  eq(it.source, E.SOURCE.HISTORY, "el ítem tiene que declararse como historial personal");
  assert(/a mano/i.test(it.reason) && /2/.test(it.reason), "la razón tiene que decir que lo agregaste dos veces: \"" + it.reason + "\"");
  eq(l.learning.promoted.length, 1, "un ítem promovido");
});

await test("una sola vez no alcanza para promover", function () {
  var history = [listaHistorial("playa", [manual("Toalla de microfibra")])];
  var l = E.buildPackingList({ trip:viajePlaya(), tripType:"playa", history:history, now:AT() });
  noItem(l, "toalla-de-microfibra", "con un solo viaje:");
});

await test("un ítem descartado dos veces en el mismo tipo deja de sugerirse", function () {
  var history = [
    listaHistorial("playa", [descartado("Batería portátil")]),
    listaHistorial("playa", [descartado("Batería portátil")])
  ];
  var base = E.buildPackingList({ trip:viajePlaya(), tripType:"playa", now:AT() });
  hasItem(base, "bateria-portatil", "sin historial:");

  var l = E.buildPackingList({ trip:viajePlaya(), tripType:"playa", history:history, now:AT() });
  assert(!item(l, "bateria-portatil"), "el ítem descartado dos veces no tiene que estar");
  eq(l.learning.suppressed.length, 1, "queda registrado qué se suprimió y por qué");
  eq(l.learning.suppressed[0].key, "bateria-portatil");
  eq(l.items.length, base.items.length - 1, "la lista pierde exactamente ese ítem");
});

await test("el historial de otro tipo de viaje no contamina", function () {
  var history = [
    listaHistorial("montana", [manual("Bastones de trekking")]),
    listaHistorial("montana", [manual("Bastones de trekking")]),
    listaHistorial("trabajo", [descartado("Batería portátil")]),
    listaHistorial("trabajo", [descartado("Batería portátil")])
  ];
  var l = E.buildPackingList({ trip:viajePlaya(), tripType:"playa", history:history, now:AT() });
  eq(l.learning.sampleSize, 0, "ningún viaje previo de playa");
  noItem(l, "bastones-de-trekking", "otro tipo:");
  hasItem(l, "bateria-portatil", "otro tipo:");
});

await test("un ítem contado dos veces en el mismo viaje cuenta una sola vez", function () {
  var history = [listaHistorial("playa", [manual("Toalla de microfibra"), manual("Toalla de microfibra")])];
  var aprendido = E.learnFromHistory(history, "playa");
  eq(aprendido.promote.length, 0, "un solo viaje no alcanza aunque el ítem esté repetido");
});

await test("agregado a mano gana sobre descartado: la persona lo sigue queriendo", function () {
  var history = [
    listaHistorial("playa", [manual("Parlante bluetooth"), descartado("Parlante bluetooth")]),
    listaHistorial("playa", [manual("Parlante bluetooth"), descartado("Parlante bluetooth")])
  ];
  var l = E.buildPackingList({ trip:viajePlaya(), tripType:"playa", history:history, now:AT() });
  hasItem(l, "parlante-bluetooth", "promoción sobre supresión:");
  eq(l.learning.suppressed.length, 0, "no se suprime lo que se promueve");
});

group("Regeneración (VAL-30)");

await test("regenerar conserva lo empacado, lo descartado y los ítems propios", function () {
  var v1 = E.buildPackingList({ trip:viajePlaya(), tripType:"playa", now:AT() });
  var conMarcas = E.setPacked(v1, "dni", true);
  conMarcas = E.setPacked(conMarcas, "remeras", true);
  conMarcas = E.setDismissed(conMarcas, "gorra-o-sombrero", true);
  conMarcas = E.addManualItem(conMarcas, { label:"Cargador del reloj", category:"electronica" });
  conMarcas = E.setQty(conMarcas, "pantalones", 1);

  var v2 = E.buildPackingList({ trip:viajePlaya(), tripType:"playa", previous:conMarcas, now:"2026-09-06T12:00:00.000Z" });

  eq(item(v2, "dni").packed, true, "el DNI seguía empacado");
  eq(item(v2, "remeras").packed, true, "las remeras seguían empacadas");
  eq(item(v2, "gorra-o-sombrero").dismissed, true, "lo descartado no vuelve a aparecer activo");
  var propio = item(v2, "cargador-del-reloj");
  assert(propio, "el ítem propio se perdió al regenerar");
  eq(propio.manual, true, "el ítem propio sigue siendo propio");
  eq(propio.source, E.SOURCE.MANUAL, "el ítem propio declara su origen");
  eq(item(v2, "pantalones").qty, 1, "la cantidad corregida a mano no se pisa");
  eq(item(v2, "pantalones").qtyEdited, true, "queda marcada como corregida");
});

await test("regenerar no duplica ítems", function () {
  var v1 = E.buildPackingList({ trip:viajePlaya(), tripType:"playa", now:AT() });
  var v2 = E.buildPackingList({ trip:viajePlaya(), tripType:"playa", previous:v1, now:AT() });
  var v3 = E.buildPackingList({ trip:viajePlaya(), tripType:"playa", previous:v2, now:AT() });
  eq(v3.items.length, v1.items.length, "la cantidad de ítems no puede crecer");
  var vistos = {};
  v3.items.forEach(function (i) {
    assert(!vistos[i.key], "clave duplicada: " + i.key);
    assert(!vistos[i.id], "id duplicado: " + i.id);
    vistos[i.key] = true;
  });
  eq(v3.createdAt, v1.createdAt, "la fecha de creación es la de la primera vez");
});

await test("regenerar con otro tipo de viaje conserva lo empacado de los ítems que siguen", function () {
  var v1 = E.buildPackingList({ trip:viajePlaya(), tripType:"playa", now:AT() });
  var marcada = E.setPacked(E.setPacked(v1, "dni", true), "ojotas", true);
  var v2 = E.buildPackingList({ trip:viajePlaya(), tripType:"trabajo", previous:marcada, now:AT() });
  eq(item(v2, "dni").packed, true, "el DNI sigue y sigue empacado");
  hasItem(v2, "muda-formal", "cambio de tipo:");
  var ojotas = item(v2, "ojotas");
  assert(ojotas && ojotas.packed, "las ojotas ya estaban en la valija: no se borran porque cambió el tipo");
});

group("Capa de destino con IA (VAL-33)");

await test("el prompt lleva el destino, las fechas y la instrucción de no inventar", function () {
  var l = E.buildPackingList({
    trip:{ id:"td", name:"Otoño europeo", destination:"Madrid, España", startDate:"2026-10-05", endDate:"2026-10-15" },
    items:[{ type:"flight", from:"EZE", to:"MAD" }], now:AT()
  });
  var p = E.destinationPrompt(l);
  assert(p.indexOf("Madrid") >= 0, "el prompt no nombra el destino");
  assert(p.indexOf("2026-10-05") >= 0, "el prompt no lleva las fechas");
  assert(/no lo incluyas/i.test(p) && /invent/i.test(p), "el prompt tiene que prohibir inventar datos");
  assert(/SOLO JSON/i.test(p), "el prompt tiene que pedir sólo JSON");
});

await test("la capa de destino agrega ítems con su justificación y su origen", async function () {
  var l = E.buildPackingList({
    trip:{ id:"te", name:"Otoño europeo", destination:"Madrid, España", startDate:"2026-10-05", endDate:"2026-10-15" },
    items:[{ type:"flight", from:"EZE", to:"MAD" }], now:AT()
  });
  var vistoPrompt = null;
  var ask = async function (prompt) {
    vistoPrompt = prompt;
    return {
      items:[
        { label:"Adaptador tipo F", category:"electronica", qty:1, reason:"En España el enchufe es tipo F, distinto del argentino." },
        { label:"Campera de entretiempo", category:"ropa", reason:"En octubre Madrid tiene amplitud térmica de más de diez grados." },
        { label:"Esto no tiene razón" },
        { label:"Pasaporte", reason:"repetido, ya está en la lista base" }
      ],
      clima:"Días templados y noches frescas."
    };
  };
  var out = await E.enrichWithDestination(l, ask, { now:AT() });
  assert(vistoPrompt && vistoPrompt.length > 100, "no se llamó a la función de IA con el prompt");
  eq(out.ai.status, "ok", "estado de la capa de IA");
  var ad = hasItem(out, "adaptador-tipo-f");
  eq(ad.source, E.SOURCE.DESTINATION, "el ítem tiene que declararse como del destino");
  assert(/tipo F/.test(ad.reason), "el ítem del destino tiene que explicar por qué");
  hasItem(out, "campera-de-entretiempo");
  assert(!item(out, "esto-no-tiene-razon"), "un ítem sin razón no entra");
  eq(out.items.filter(function (i) { return i.key === "pasaporte"; }).length, 1, "no se duplica lo que ya estaba");
  eq(out.clima, "Días templados y noches frescas.", "la nota de clima se conserva");
  eq(out.items.length, l.items.length + 2, "entraron sólo los dos ítems válidos");
});

await test("si la capa de destino falla, la lista base se muestra igual y se avisa", async function () {
  var l = E.buildPackingList({ trip:viajePlaya(), tripType:"playa", now:AT() });
  var ask = async function () { throw new Error("el modelo no respondió"); };
  var out = await E.enrichWithDestination(l, ask, { now:AT() });
  eq(out.ai.status, "error", "estado de la capa de IA");
  eq(out.items.length, l.items.length, "la lista base queda intacta");
  var w = out.warnings.filter(function (x) { return x.code === "ia-fallo"; })[0];
  assert(w, "falta el aviso de que faltó el ajuste por destino");
  assert(/base/i.test(w.text), "el aviso tiene que decir que igual sirve la lista base");
});

await test("sin función de IA, la lista base se genera y avisa que falta el ajuste", async function () {
  var l = E.buildPackingList({ trip:viajePlaya(), tripType:"playa", now:AT() });
  var out = await E.enrichWithDestination(l, null, { now:AT() });
  eq(out.ai.status, "no-disponible", "estado");
  eq(out.items.length, l.items.length, "misma lista");
  assert(out.warnings.some(function (x) { return x.code === "ia-no-disponible"; }), "falta el aviso");
});

await test("respuesta basura de la IA: no rompe nada", async function () {
  var l = E.buildPackingList({ trip:viajePlaya(), tripType:"playa", now:AT() });
  var casos = [null, "no soy json", { items:"nada" }, { items:[] }, { items:[{}] }, 42];
  for (var i = 0; i < casos.length; i++) {
    var out = await E.enrichWithDestination(l, async function () { return casos[i]; }, { now:AT() });
    eq(out.items.length, l.items.length, "caso " + JSON.stringify(casos[i]) + ": la lista no se toca");
    assert(out.ai.status !== "ok", "caso " + JSON.stringify(casos[i]) + ": no puede darse por buena");
  }
});

await test("la IA no puede resucitar un ítem que el historial suprimió", async function () {
  var history = [
    listaHistorial("playa", [descartado("Batería portátil")]),
    listaHistorial("playa", [descartado("Batería portátil")])
  ];
  var l = E.buildPackingList({ trip:viajePlaya(), tripType:"playa", history:history, now:AT() });
  var out = await E.enrichWithDestination(l, async function () {
    return { items:[{ label:"Batería portátil", reason:"cortes de luz en la zona" }] };
  }, { now:AT() });
  assert(!item(out, "bateria-portatil"), "lo que la persona descartó dos veces no vuelve por la IA");
});

await test("generatePackingList corre las tres capas y respeta la lista anterior", async function () {
  var history = [
    listaHistorial("playa", [manual("Toalla de microfibra")]),
    listaHistorial("playa", [manual("Toalla de microfibra")])
  ];
  var v1 = await E.generatePackingList({ trip:viajePlaya(), tripType:"playa", history:history, now:AT() });
  eq(v1.ai.status, "sin-ajuste", "sin ask no hay capa de IA");
  hasItem(v1, "toalla-de-microfibra", "capa 3:");

  var marcada = E.setPacked(v1, "dni", true);
  var v2 = await E.generatePackingList({
    trip:viajePlaya(), tripType:"playa", history:history, previous:marcada, now:AT(),
    ask:async function () { return { items:[{ label:"Repelente de agua para la carpa", reason:"En enero llueve seguido en la isla." }] }; }
  });
  eq(v2.ai.status, "ok", "capa 2 corrió");
  eq(item(v2, "dni").packed, true, "capa 1 y la lista anterior conviven");
  hasItem(v2, "toalla-de-microfibra", "capa 3 sigue viva");
  hasItem(v2, "repelente-de-agua-para-la-carpa", "capa 2:");
  var fuentes = {};
  v2.items.forEach(function (i) { fuentes[i.source] = true; });
  assert(fuentes[E.SOURCE.RULE] && fuentes[E.SOURCE.DESTINATION] && fuentes[E.SOURCE.HISTORY],
    "cada ítem tiene que declarar su origen y tienen que convivir los tres: " + Object.keys(fuentes).join(", "));
});

group("Estado de la lista (VAL-31)");

await test("marcar, desmarcar y contar", function () {
  var l = E.buildPackingList({ trip:viajePlaya(), tripType:"playa", now:AT() });
  eq(l.stats.packed, 0, "arranca en cero");
  eq(l.stats.total, l.items.length, "total inicial");

  var a = E.setPacked(l, "dni", true);
  eq(a.stats.packed, 1, "uno empacado");
  eq(item(l, "dni").packed, false, "la lista original no se muta");

  var b = E.setPacked(a, "dni", false);
  eq(b.stats.packed, 0, "se puede desmarcar");
});

await test("descartar no es empacar y saca del total", function () {
  var l = E.buildPackingList({ trip:viajePlaya(), tripType:"playa", now:AT() });
  var d = E.setDismissed(l, "ojotas", true);
  eq(d.stats.total, l.stats.total - 1, "el descartado sale del total");
  eq(d.stats.dismissed, 1, "queda contado como descartado");
  eq(item(d, "ojotas").packed, false, "descartar no empaca");
  var vuelta = E.setDismissed(d, "ojotas", false);
  eq(vuelta.stats.total, l.stats.total, "se puede recuperar");
});

await test("agregar un ítem propio y borrarlo", function () {
  var l = E.buildPackingList({ trip:viajePlaya(), tripType:"playa", now:AT() });
  var con = E.addManualItem(l, { label:"Libro de Saer", category:"otros" });
  var it = hasItem(con, "libro-de-saer");
  eq(it.manual, true, "es propio");
  eq(it.source, E.SOURCE.MANUAL, "declara su origen");
  eq(con.stats.total, l.stats.total + 1, "suma al total");

  var repe = E.addManualItem(con, { label:"libro de saer" });
  eq(repe.items.length, con.items.length, "no duplica el mismo ítem escrito distinto");

  var sin = E.removeManualItem(con, "libro-de-saer");
  eq(sin.items.length, l.items.length, "se puede borrar el propio");
  var intento = E.removeManualItem(l, "dni");
  eq(intento.items.length, l.items.length, "un sugerido no se borra: se descarta");
});

await test("agrupar por categoría respeta el orden y esconde los descartados", function () {
  var l = E.buildPackingList({ trip:viajePlaya(), tripType:"playa", now:AT() });
  var g = E.groupByCategory(l);
  eq(g[0].key, "documentacion", "documentación va primero");
  var orden = E.CATEGORIES.map(function (c) { return c.key; });
  var pos = g.map(function (x) { return orden.indexOf(x.key); });
  for (var i = 1; i < pos.length; i++) assert(pos[i] > pos[i - 1], "las categorías salieron desordenadas");

  var d = E.setDismissed(l, "ojotas", true);
  var gc = E.groupByCategory(d).filter(function (x) { return x.key === "calzado"; })[0];
  assert(!gc.items.some(function (i) { return i.key === "ojotas"; }), "el descartado no se muestra");
  var gt = E.groupByCategory(d, { includeDismissed:true }).filter(function (x) { return x.key === "calzado"; })[0];
  assert(gt.items.some(function (i) { return i.key === "ojotas"; }), "con includeDismissed sí se muestra");
});

group("Robustez");

await test("sin argumentos no explota", function () {
  var l = E.buildPackingList();
  assert(l && Array.isArray(l.items) && l.items.length > 0, "tiene que devolver una lista igual");
  eq(l.tripId, "", "sin viaje, sin id");
});

await test("reservas rotas o incompletas no rompen el motor", function () {
  var l = E.buildPackingList({
    trip:{ id:"tz", name:null, destination:undefined, startDate:"no es fecha", endDate:"" },
    items:[null, {}, { type:"flight" }, { type:"car", title:null }, { type:"stay", from:123 }],
    now:AT()
  });
  assert(l.items.length > 10, "igual tiene que armar la lista");
  eq(l.basis.daysKnown, false, "una fecha inválida es como no tener fecha");
  hasItem(l, "licencia-de-conducir", "el auto roto igual cuenta:");
});

/* ---------- cierre ---------- */
console.log("\n" + "=".repeat(52));
console.log("  " + passed + " pasaron, " + failed + " fallaron");
if (failed) {
  console.log("\n  Fallaron:");
  pending.forEach(function (n) { console.log("   - " + n); });
}
console.log("=".repeat(52) + "\n");
process.exit(failed ? 1 : 0);
}

main().catch(function (e) {
  console.error("\nLa corrida se cayó antes de terminar:\n", e);
  process.exit(1);
});
