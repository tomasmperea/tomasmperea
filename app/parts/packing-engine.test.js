/* ============================================================
   VALIJA · PRUEBAS DEL MOTOR DE EQUIPAJE
   Sin frameworks. Se corre así:

       node app/parts/packing-engine.test.js

   Imprime cada caso, lo que falló, y sale con código distinto
   de cero si hay una sola falla.

   Prueban la API REAL del motor (app/parts/packing-engine.js):
     - la lista es un documento con `items` como OBJETO indexado
       por clave normalizada, no un array;
     - cada ítem tiene tres estados (`estado`: pendiente | empacado
       | descartado), no un booleano;
     - los campos del documento están en español (`base`, `dias`,
       `noches`, `internacional`, `hechos`, etc.), ver el bloque de
       documentación al principio de packing-engine.js.
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

/* ---------- acceso a los ítems (objeto indexado por clave, no array) ---------- */
function item(list, clave) { return (list && list.items && list.items[clave]) || null; }
function hasItem(list, clave, msg) {
  var it = item(list, clave);
  assert(it && it.estado !== E.ESTADO.DESCARTADO, (msg || "") + " falta el ítem \"" + clave + "\". Hay: " + keys(list).join(", "));
  return it;
}
function noItem(list, clave, msg) {
  var it = item(list, clave);
  assert(!it || it.estado === E.ESTADO.DESCARTADO, (msg || "") + " no debería estar el ítem \"" + clave + "\"");
}
function keys(list) { return Object.keys((list && list.items) || {}); }
function count(list) { return keys(list).length; }
function AT() { return "2026-09-05T12:00:00.000Z"; }

/* ---------- datos de prueba ---------- */
function viajePlaya(over) {
  return Object.assign({
    id:"t-playa", name:"Verano en Brasil", destination:"Florianópolis",
    startDate:"2026-01-10", endDate:"2026-01-17"
  }, over || {});
}

/** Un documento de lista guardada, como los que alimentan el historial (VAL-32). */
function listaHistorial(tipoViaje, items) {
  return { version:E.VERSION, tipoViaje:tipoViaje, items:items };
}
/** Ítem agregado a mano en una lista de historial. `estadoOverride` sirve para
 *  representar "lo agregué a mano y después lo descarté": las dos señales en
 *  el mismo ítem, como pasaría en el documento real. */
function manualItem(nombre, categoria, estadoOverride) {
  return { clave:E.slug(nombre), nombre:nombre, categoria:categoria || "otros",
           origen:E.ORIGEN.MANUAL, estado:estadoOverride || E.ESTADO.PENDIENTE };
}
/** Ítem sugerido por una regla y descartado, en una lista de historial. */
function descartadoItem(nombre, categoria) {
  return { clave:E.slug(nombre), nombre:nombre, categoria:categoria || "electronica",
           origen:E.ORIGEN.REGLA, estado:E.ESTADO.DESCARTADO };
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
  // El catálogo está sano: se valida con validateRules(), no recorriéndolo a mano.
  var problemas = E.validateRules();
  var deCategoria = problemas.filter(function (p) { return /categoría desconocida/i.test(p); });
  assert(deCategoria.length === 0, "reglas con categoría inválida:\n         " + deCategoria.join("\n         "));
});

group("Duración: de un día a treinta");

await test("viaje de un día: cantidades mínimas y coherentes", function () {
  var l = E.buildPackingList({
    trip:{ id:"t1", name:"Ida y vuelta a Rosario", destination:"Rosario", startDate:"2026-03-02", endDate:"2026-03-02" },
    now:AT()
  });
  eq(l.base.dias, 1, "días");
  eq(l.base.noches, 0, "noches");
  eq(hasItem(l, E.slug("Remeras")).cantidad, 2, "remeras de un día");
  eq(hasItem(l, E.slug("Ropa interior")).cantidad, 2, "ropa interior de un día");
  eq(hasItem(l, E.slug("Pantalones")).cantidad, 1, "pantalones de un día");
  eq(hasItem(l, E.slug("Pijama")).cantidad, 1, "pijama de un día");
  assert(count(l) > 10, "la lista de un día quedó vacía");
});

await test("viaje de treinta días: las cantidades se topean y lo explican", function () {
  var l = E.buildPackingList({
    trip:{ id:"t2", name:"Vuelta larga", destination:"Rosario", startDate:"2026-03-01", endDate:"2026-03-30" },
    now:AT()
  });
  eq(l.base.dias, 30, "días");
  var remeras = hasItem(l, E.slug("Remeras"));
  eq(remeras.cantidad, 8, "tope de remeras");
  assert(/lav/i.test(remeras.motivo), "el tope tiene que explicar que se lava: \"" + remeras.motivo + "\"");
  eq(hasItem(l, E.slug("Ropa interior")).cantidad, 10, "tope de ropa interior");
  eq(hasItem(l, E.slug("Medias")).cantidad, 10, "tope de medias");
  eq(hasItem(l, E.slug("Pantalones")).cantidad, 4, "tope de pantalones");
  eq(hasItem(l, E.slug("Pijama")).cantidad, 2, "tope de pijamas");
});

await test("cada cantidad viene con su explicación", function () {
  var l = E.buildPackingList({ trip:viajePlaya(), now:AT() });
  E.itemsArray(l).forEach(function (i) {
    assert(String(i.motivo || "").trim().length > 0, "el ítem \"" + i.clave + "\" no explica por qué está");
    if (i.cantidad != null) assert(i.cantidad >= 1, "cantidad inválida en " + i.clave + ": " + i.cantidad);
  });
});

await test("viaje sin fechas: genera igual, avisa, y usa el default documentado", function () {
  var l = E.buildPackingList({ trip:{ id:"t3", name:"Escapada", destination:"Colonia" }, now:AT() });
  eq(l.base.diasConocidos, false, "diasConocidos");
  eq(l.base.dias, E.DEFAULT_DAYS, "días asumidos");
  assert(count(l) > 10, "sin fechas la lista igual tiene que servir");
  var w = l.avisos.filter(function (x) { return x.codigo === "sin-fechas"; })[0];
  assert(w, "falta el aviso de que no hay fechas");
  assert(/fecha/i.test(w.texto), "el aviso tiene que hablar de las fechas");
});

group("Internacional o nacional");

await test("internacional deducido de los códigos IATA del vuelo", function () {
  var l = E.buildPackingList({
    trip:{ id:"t4", name:"Europa", destination:"", startDate:"2026-05-01", endDate:"2026-05-15" },
    items:[{ type:"flight", from:"EZE", to:"MAD" }, { type:"flight", from:"MAD", to:"EZE" }],
    now:AT()
  });
  eq(l.base.internacional, true, "tendría que ser internacional");
  eq(l.base.internacionalFuente, "vuelos", "fuente de la deducción");
  hasItem(l, E.slug("Pasaporte"), "internacional:");
  hasItem(l, E.slug("Adaptador de enchufe"), "internacional:");
  hasItem(l, E.slug("Seguro de viaje"), "internacional:");
  hasItem(l, E.slug("Efectivo en moneda local"), "internacional:");
});

await test("nacional deducido de vuelos de cabotaje", function () {
  var l = E.buildPackingList({
    trip:{ id:"t5", name:"Sur", destination:"", startDate:"2026-07-01", endDate:"2026-07-08" },
    items:[{ type:"flight", from:"AEP", to:"BRC" }, { type:"flight", from:"BRC", to:"AEP" }],
    now:AT()
  });
  eq(l.base.internacional, false, "tendría que ser nacional");
  eq(l.base.internacionalFuente, "vuelos", "fuente de la deducción");
  noItem(l, E.slug("Pasaporte"), "nacional:");
  noItem(l, E.slug("Adaptador de enchufe"), "nacional:");
  hasItem(l, E.slug("DNI"), "nacional:");
});

await test("internacional deducido del destino cuando no hay vuelos", function () {
  var l = E.buildPackingList({ trip:{ id:"t6", name:"Escapada", destination:"Montevideo, Uruguay", startDate:"2026-02-01", endDate:"2026-02-04" }, now:AT() });
  eq(l.base.internacional, true, "Uruguay es internacional");
  eq(l.base.internacionalFuente, "destino", "fuente");
  hasItem(l, E.slug("Pasaporte"));
});

await test("destino irreconocible: no inventa, arma nacional y avisa", function () {
  var l = E.buildPackingList({ trip:{ id:"t7", name:"Viaje", destination:"", startDate:"2026-02-01", endDate:"2026-02-04" }, now:AT() });
  eq(l.base.internacionalConocido, false, "no puede saberlo");
  eq(l.base.internacional, false, "ante la duda, nacional");
  assert(l.avisos.some(function (w) { return w.codigo === "destino-desconocido"; }), "falta el aviso de destino desconocido");
});

group("Tipos de viaje");

var esperadoPorTipo = {
  playa:    ["Malla", "Ojotas", "Protector solar"],
  ciudad:   ["Un par para salir", "Zapatillas cómodas"],
  montana:  ["Primera capa térmica", "Campera impermeable", "Botas o zapatillas de trekking", "Gorro y guantes de abrigo"],
  trabajo:  ["Muda formal", "Zapatos de vestir", "Notebook y cargador"],
  aventura: ["Botas o zapatillas de trekking", "Linterna frontal", "Repelente de mosquitos"],
  mixto:    ["DNI", "Remeras", "Neceser armado"]
};

for (var tipo in esperadoPorTipo) {
  (function (tipo) {
    return test("tipo \"" + tipo + "\": trae sus ítems propios y ninguno sin categoría", function () {
      var l = E.buildPackingList({
        trip:{ id:"t-" + tipo, name:"Viaje", destination:"", startDate:"2026-04-01", endDate:"2026-04-06" },
        tipoViaje:tipo, now:AT()
      });
      eq(l.tipoViaje, tipo, "el tipo elegido manda");
      eq(l.base.tipoViajeFuente, "elegido", "fuente del tipo");
      esperadoPorTipo[tipo].forEach(function (nombre) { hasItem(l, E.slug(nombre), "tipo " + tipo + ":"); });
      var validas = E.CATEGORIES.map(function (c) { return c.key; });
      E.itemsArray(l).forEach(function (i) { assert(validas.indexOf(i.categoria) >= 0, "categoría rara en " + i.clave); });
      assert(count(l) >= 20, "lista corta para " + tipo + ": " + count(l));
    });
  })(tipo);
}
// el for...in de arriba encola las promesas de test() sin esperarlas cada una;
// como esperadoPorTipo se recorre por completo antes de seguir, hace falta
// esperar a que terminen antes del próximo grupo.
await Promise.all(pending.length === 0 ? [] : []); // no-op: los test() ya corrieron su fn() sincrónica
await new Promise(function (r) { setImmediate(r); });

await test("playa no trae ropa de montaña y montaña no trae malla", function () {
  var base = { id:"t-x", name:"Viaje", startDate:"2026-04-01", endDate:"2026-04-06" };
  var playa = E.buildPackingList({ trip:base, tipoViaje:"playa", now:AT() });
  var montana = E.buildPackingList({ trip:base, tipoViaje:"montana", now:AT() });
  noItem(playa, E.slug("Primera capa térmica"), "playa:");
  noItem(playa, E.slug("Gorro y guantes de abrigo"), "playa:");
  noItem(montana, E.slug("Malla"), "montaña:");
  noItem(montana, E.slug("Ojotas"), "montaña:");
});

await test("el tipo se sugiere solo cuando no lo eligen", function () {
  var l = E.buildPackingList({ trip:viajePlaya(), now:AT() });
  eq(l.tipoViaje, "playa", "Florianópolis en enero es playa");
  eq(l.base.tipoViajeFuente, "sugerido", "fuente del tipo");
  assert(l.base.tipoViajeMotivo.length > 0, "la sugerencia tiene que explicarse");

  // Sin un destino con pistas de ciudad: "congreso" alcanza para reconocer trabajo.
  var s = E.suggestTripType({ name:"Congreso de cardiología", destination:"", startDate:"2026-06-01", endDate:"2026-06-04" }, []);
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
  eq(l.base.hechos.hasRentalCar, true, "hecho hasRentalCar");
  var lic = hasItem(l, E.slug("Licencia de conducir"));
  assert(/auto alquilado/i.test(lic.motivo), "la razón tiene que nombrar el auto: \"" + lic.motivo + "\"");
  noItem(l, E.slug("Licencia de conducir internacional"), "auto nacional:");
});

await test("auto alquilado en el exterior: además la licencia internacional", function () {
  var l = E.buildPackingList({
    trip:{ id:"t9", name:"Andalucía", destination:"Sevilla, España", startDate:"2026-03-01", endDate:"2026-03-10" },
    items:[{ type:"car", provider:"Europcar" }],
    now:AT()
  });
  hasItem(l, E.slug("Licencia de conducir"));
  hasItem(l, E.slug("Licencia de conducir internacional"));
});

await test("vuelo cargado: aparece la regla de líquidos de 100 ml", function () {
  var conVuelo = E.buildPackingList({ trip:{ id:"ta", name:"Viaje", destination:"Córdoba", startDate:"2026-03-01", endDate:"2026-03-05" }, items:[{ type:"flight", from:"AEP", to:"COR" }], now:AT() });
  var sinVuelo = E.buildPackingList({ trip:{ id:"tb", name:"Viaje", destination:"Córdoba", startDate:"2026-03-01", endDate:"2026-03-05" }, items:[], now:AT() });
  hasItem(conVuelo, E.slug("Líquidos de hasta 100 ml"));
  noItem(sinVuelo, E.slug("Líquidos de hasta 100 ml"), "sin vuelo:");
});

await test("trekking cargado como actividad: aparece el calzado, aunque el viaje sea de ciudad", function () {
  var l = E.buildPackingList({
    trip:{ id:"tc", name:"Semana en Santiago", destination:"Santiago de Chile", startDate:"2026-05-01", endDate:"2026-05-07" },
    items:[{ type:"act", title:"Trekking al Cerro Provincia" }],
    tipoViaje:"ciudad", now:AT()
  });
  eq(l.base.hechos.hasTrekking, true, "hecho hasTrekking");
  hasItem(l, E.slug("Botas o zapatillas de trekking"));
  hasItem(l, E.slug("Campera impermeable"));
});

group("Historial (VAL-32)");

await test("historial vacío: la lista sale igual con las reglas base", function () {
  var sin = E.buildPackingList({ trip:viajePlaya(), tipoViaje:"playa", now:AT() });
  var conVacio = E.buildPackingList({ trip:viajePlaya(), tipoViaje:"playa", history:[], now:AT() });
  eq(count(conVacio), count(sin), "misma cantidad de ítems");
  eq(conVacio.aprendizaje.muestra, 0, "sin viajes previos");
  eq(conVacio.aprendizaje.promovidos.length, 0, "nada que promover");
  eq(conVacio.aprendizaje.suprimidos.length, 0, "nada que suprimir");
});

await test("un ítem agregado a mano en dos viajes del mismo tipo pasa a sugerirse", function () {
  var history = [
    listaHistorial("playa", [manualItem("Toalla de microfibra", "otros")]),
    listaHistorial("playa", [manualItem("Toalla de microfibra", "otros")])
  ];
  var l = E.buildPackingList({ trip:viajePlaya(), tipoViaje:"playa", history:history, now:AT() });
  var it = hasItem(l, E.slug("Toalla de microfibra"));
  eq(it.origen, E.ORIGEN.HISTORIAL, "el ítem tiene que declararse como historial personal");
  assert(/a mano/i.test(it.motivo) && /2/.test(it.motivo), "la razón tiene que decir que lo agregaste dos veces: \"" + it.motivo + "\"");
  eq(l.aprendizaje.promovidos.length, 1, "un ítem promovido");
});

await test("una sola vez no alcanza para promover", function () {
  var history = [listaHistorial("playa", [manualItem("Toalla de microfibra")])];
  var l = E.buildPackingList({ trip:viajePlaya(), tipoViaje:"playa", history:history, now:AT() });
  noItem(l, E.slug("Toalla de microfibra"), "con un solo viaje:");
});

await test("un ítem descartado dos veces en el mismo tipo deja de sugerirse", function () {
  var history = [
    listaHistorial("playa", [descartadoItem("Batería portátil")]),
    listaHistorial("playa", [descartadoItem("Batería portátil")])
  ];
  var bateriaKey = E.slug("Batería portátil");
  var base = E.buildPackingList({ trip:viajePlaya(), tipoViaje:"playa", now:AT() });
  hasItem(base, bateriaKey, "sin historial:");

  var l = E.buildPackingList({ trip:viajePlaya(), tipoViaje:"playa", history:history, now:AT() });
  assert(!item(l, bateriaKey), "el ítem descartado dos veces no tiene que estar");
  eq(l.aprendizaje.suprimidos.length, 1, "queda registrado qué se suprimió y por qué");
  eq(l.aprendizaje.suprimidos[0].clave, bateriaKey);
  eq(count(l), count(base) - 1, "la lista pierde exactamente ese ítem");
});

await test("el historial de otro tipo de viaje no contamina", function () {
  var history = [
    listaHistorial("montana", [manualItem("Bastones de trekking")]),
    listaHistorial("montana", [manualItem("Bastones de trekking")]),
    listaHistorial("trabajo", [descartadoItem("Batería portátil")]),
    listaHistorial("trabajo", [descartadoItem("Batería portátil")])
  ];
  var l = E.buildPackingList({ trip:viajePlaya(), tipoViaje:"playa", history:history, now:AT() });
  eq(l.aprendizaje.muestra, 0, "ningún viaje previo de playa");
  noItem(l, E.slug("Bastones de trekking"), "otro tipo:");
  hasItem(l, E.slug("Batería portátil"), "otro tipo:");
});

await test("un ítem contado dos veces en el mismo viaje cuenta una sola vez", function () {
  var history = [listaHistorial("playa", [manualItem("Toalla de microfibra"), manualItem("Toalla de microfibra")])];
  var aprendido = E.learnFromHistory(history, "playa");
  eq(aprendido.promover.length, 0, "un solo viaje no alcanza aunque el ítem esté repetido");
});

await test("agregado a mano gana sobre descartado: la persona lo sigue queriendo", function () {
  // El mismo ítem, agregado a mano y a la vez descartado: las dos señales conviven
  // en un solo ítem, como en el documento real.
  var history = [
    listaHistorial("playa", [manualItem("Parlante bluetooth", "electronica", E.ESTADO.DESCARTADO)]),
    listaHistorial("playa", [manualItem("Parlante bluetooth", "electronica", E.ESTADO.DESCARTADO)])
  ];
  var l = E.buildPackingList({ trip:viajePlaya(), tipoViaje:"playa", history:history, now:AT() });
  hasItem(l, E.slug("Parlante bluetooth"), "promoción sobre supresión:");
  eq(l.aprendizaje.suprimidos.length, 0, "no se suprime lo que se promueve");
});

group("Regeneración (VAL-30)");

await test("regenerar conserva lo empacado, lo descartado y los ítems propios", function () {
  var v1 = E.buildPackingList({ trip:viajePlaya(), tipoViaje:"playa", now:AT() });
  var conMarcas = E.packItem(v1, "dni");
  conMarcas = E.packItem(conMarcas, E.slug("Remeras"));
  conMarcas = E.dismissItem(conMarcas, E.slug("Gorra o sombrero"));
  conMarcas = E.addManualItem(conMarcas, { nombre:"Cargador del reloj", categoria:"electronica" });
  conMarcas = E.setQty(conMarcas, E.slug("Pantalones"), 1);

  var v2 = E.buildPackingList({ trip:viajePlaya(), tipoViaje:"playa", previous:conMarcas, now:"2026-09-06T12:00:00.000Z" });

  eq(item(v2, "dni").estado, E.ESTADO.EMPACADO, "el DNI seguía empacado");
  eq(item(v2, E.slug("Remeras")).estado, E.ESTADO.EMPACADO, "las remeras seguían empacadas");
  eq(item(v2, E.slug("Gorra o sombrero")).estado, E.ESTADO.DESCARTADO, "lo descartado no vuelve a aparecer activo");
  var propio = item(v2, E.slug("Cargador del reloj"));
  assert(propio, "el ítem propio se perdió al regenerar");
  eq(propio.origen, E.ORIGEN.MANUAL, "el ítem propio sigue declarando su origen");
  eq(item(v2, E.slug("Pantalones")).cantidad, 1, "la cantidad corregida a mano no se pisa");
  eq(item(v2, E.slug("Pantalones")).cantidadEditada, true, "queda marcada como corregida");
});

await test("regenerar no duplica ítems", function () {
  var v1 = E.buildPackingList({ trip:viajePlaya(), tipoViaje:"playa", now:AT() });
  var v2 = E.buildPackingList({ trip:viajePlaya(), tipoViaje:"playa", previous:v1, now:AT() });
  var v3 = E.buildPackingList({ trip:viajePlaya(), tipoViaje:"playa", previous:v2, now:AT() });
  eq(count(v3), count(v1), "la cantidad de ítems no puede crecer");
  var vistos = {};
  E.itemsArray(v3).forEach(function (i) {
    assert(!vistos[i.clave], "clave duplicada: " + i.clave);
    vistos[i.clave] = true;
  });
  eq(v3.creadaEn, v1.creadaEn, "la fecha de creación es la de la primera vez");
});

await test("regenerar con otro tipo de viaje conserva lo empacado de los ítems que siguen", function () {
  var v1 = E.buildPackingList({ trip:viajePlaya(), tipoViaje:"playa", now:AT() });
  var marcada = E.packItem(E.packItem(v1, "dni"), E.slug("Ojotas"));
  var v2 = E.buildPackingList({ trip:viajePlaya(), tipoViaje:"trabajo", previous:marcada, now:AT() });
  eq(item(v2, "dni").estado, E.ESTADO.EMPACADO, "el DNI sigue y sigue empacado");
  hasItem(v2, E.slug("Muda formal"), "cambio de tipo:");
  var ojotas = item(v2, E.slug("Ojotas"));
  assert(ojotas && ojotas.estado === E.ESTADO.EMPACADO, "las ojotas ya estaban en la valija: no se borran porque cambió el tipo");
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
        { nombre:"Adaptador tipo F", categoria:"electronica", cantidad:1, motivo:"En España el enchufe es tipo F, distinto del argentino." },
        { nombre:"Campera de entretiempo", categoria:"ropa", motivo:"En octubre Madrid tiene amplitud térmica de más de diez grados." },
        { nombre:"Esto no tiene razón" },
        { nombre:"Pasaporte", motivo:"repetido, ya está en la lista base" }
      ],
      clima:"Días templados y noches frescas."
    };
  };
  var out = await E.enrichWithDestination(l, ask, { now:AT() });
  assert(vistoPrompt && vistoPrompt.length > 100, "no se llamó a la función de IA con el prompt");
  eq(out.capaInteligente.estado, "ok", "estado de la capa de IA");
  var ad = hasItem(out, E.slug("Adaptador tipo F"));
  eq(ad.origen, E.ORIGEN.DESTINO, "el ítem tiene que declararse como del destino");
  assert(/tipo F/.test(ad.motivo), "el ítem del destino tiene que explicar por qué");
  hasItem(out, E.slug("Campera de entretiempo"));
  assert(!item(out, E.slug("Esto no tiene razón")), "un ítem sin razón no entra");
  eq(out.items.pasaporte.motivo, l.items.pasaporte.motivo, "no se pisa lo que ya estaba en la lista base");
  eq(out.capaInteligente.clima, "Días templados y noches frescas.", "la nota de clima se conserva");
  eq(count(out), count(l) + 2, "entraron sólo los dos ítems válidos");
});

await test("si la capa de destino falla, la lista base se muestra igual y se avisa", async function () {
  var l = E.buildPackingList({ trip:viajePlaya(), tipoViaje:"playa", now:AT() });
  var ask = async function () { throw new Error("el modelo no respondió"); };
  var out = await E.enrichWithDestination(l, ask, { now:AT() });
  eq(out.capaInteligente.estado, "error", "estado de la capa de IA");
  eq(count(out), count(l), "la lista base queda intacta");
  var w = out.avisos.filter(function (x) { return x.codigo === "ia-fallo"; })[0];
  assert(w, "falta el aviso de que faltó el ajuste por destino");
  assert(/base/i.test(w.texto), "el aviso tiene que decir que igual sirve la lista base");
});

await test("sin función de IA, la lista base se genera y avisa que falta el ajuste", async function () {
  var l = E.buildPackingList({ trip:viajePlaya(), tipoViaje:"playa", now:AT() });
  var out = await E.enrichWithDestination(l, null, { now:AT() });
  eq(out.capaInteligente.estado, "no-disponible", "estado");
  eq(count(out), count(l), "misma lista");
  assert(out.avisos.some(function (x) { return x.codigo === "ia-no-disponible"; }), "falta el aviso");
});

await test("respuesta basura de la IA: no rompe nada", async function () {
  var l = E.buildPackingList({ trip:viajePlaya(), tipoViaje:"playa", now:AT() });
  var casos = [null, "no soy json", { items:"nada" }, { items:[] }, { items:[{}] }, 42];
  for (var i = 0; i < casos.length; i++) {
    var out = await E.enrichWithDestination(l, async function () { return casos[i]; }, { now:AT() });
    eq(count(out), count(l), "caso " + JSON.stringify(casos[i]) + ": la lista no se toca");
    assert(out.capaInteligente.estado !== "ok", "caso " + JSON.stringify(casos[i]) + ": no puede darse por buena");
  }
});

await test("la IA no puede resucitar un ítem que el historial suprimió", async function () {
  var history = [
    listaHistorial("playa", [descartadoItem("Batería portátil")]),
    listaHistorial("playa", [descartadoItem("Batería portátil")])
  ];
  var l = E.buildPackingList({ trip:viajePlaya(), tipoViaje:"playa", history:history, now:AT() });
  var out = await E.enrichWithDestination(l, async function () {
    return { items:[{ nombre:"Batería portátil", motivo:"cortes de luz en la zona" }] };
  }, { now:AT() });
  assert(!item(out, E.slug("Batería portátil")), "lo que la persona descartó dos veces no vuelve por la IA");
});

await test("generatePackingList corre las tres capas y respeta la lista anterior", async function () {
  var history = [
    listaHistorial("playa", [manualItem("Toalla de microfibra")]),
    listaHistorial("playa", [manualItem("Toalla de microfibra")])
  ];
  var v1 = await E.generatePackingList({ trip:viajePlaya(), tipoViaje:"playa", history:history, now:AT() });
  eq(v1.capaInteligente.estado, "sin-ajuste", "sin ask no hay capa de IA");
  hasItem(v1, E.slug("Toalla de microfibra"), "capa 3:");

  var marcada = E.packItem(v1, "dni");
  var v2 = await E.generatePackingList({
    trip:viajePlaya(), tipoViaje:"playa", history:history, previous:marcada, now:AT(),
    ask:async function () { return { items:[{ nombre:"Repelente de agua para la carpa", motivo:"En enero llueve seguido en la isla." }] }; }
  });
  eq(v2.capaInteligente.estado, "ok", "capa 2 corrió");
  eq(item(v2, "dni").estado, E.ESTADO.EMPACADO, "capa 1 y la lista anterior conviven");
  hasItem(v2, E.slug("Toalla de microfibra"), "capa 3 sigue viva");
  hasItem(v2, E.slug("Repelente de agua para la carpa"), "capa 2:");
  var origenes = {};
  E.itemsArray(v2).forEach(function (i) { origenes[i.origen] = true; });
  assert(origenes[E.ORIGEN.REGLA] && origenes[E.ORIGEN.DESTINO] && origenes[E.ORIGEN.HISTORIAL],
    "cada ítem tiene que declarar su origen y tienen que convivir los tres: " + Object.keys(origenes).join(", "));
});

group("Estado de la lista (VAL-31)");

await test("marcar, desmarcar y contar", function () {
  var l = E.buildPackingList({ trip:viajePlaya(), tipoViaje:"playa", now:AT() });
  eq(l.conteo.empacados, 0, "arranca en cero");
  eq(l.conteo.resueltos, 0, "nada resuelto todavía");
  eq(l.conteo.total, count(l), "total inicial, con todos los ítems");
  eq(l.conteo.pendientes, l.conteo.total, "todo pendiente al arrancar");

  var a = E.packItem(l, "dni");
  eq(a.conteo.empacados, 1, "uno empacado");
  eq(a.conteo.resueltos, 1, "empacar es resolver");
  eq(a.conteo.pct, Math.round(1 / a.conteo.total * 100), "el porcentaje sube con lo empacado");
  eq(item(l, "dni").estado, E.ESTADO.PENDIENTE, "la lista original no se muta");

  var b = E.resetItem(a, "dni");
  eq(b.conteo.empacados, 0, "se puede desmarcar");
  eq(b.conteo.resueltos, 0, "volver a pendiente deshace lo resuelto");
});

await test("descartar es una decisión resuelta, tan válida como empacar: no sale del total ni se pierde el dato", function () {
  // Decisión del Product Owner: si descartar restara del total, la persona
  // dejaría de descartar y marcaría como empacado lo que no va a llevar
  // sólo para bajar el pendiente. Eso arruina el aprendizaje de VAL-32
  // (que se alimenta de los descartes) y la confiabilidad de lo empacado.
  var l = E.buildPackingList({ trip:viajePlaya(), tipoViaje:"playa", now:AT() });
  var ojotaKey = E.slug("Ojotas");
  var d = E.dismissItem(l, ojotaKey);
  eq(d.conteo.total, l.conteo.total, "el descartado sigue contando en el total");
  eq(d.conteo.descartados, 1, "queda contado como descartado");
  eq(d.conteo.empacados, 0, "descartar no empaca");
  eq(d.conteo.pendientes, l.conteo.pendientes - 1, "sale de pendientes");
  eq(d.conteo.resueltos, 1, "descartar es resolver");
  eq(d.conteo.pct, Math.round(1 / d.conteo.total * 100), "el descarte mueve el porcentaje igual que empacar");
  eq(item(d, ojotaKey).estado, E.ESTADO.DESCARTADO, "descartar no empaca");
  var vuelta = E.resetItem(d, ojotaKey);
  eq(vuelta.conteo.total, l.conteo.total, "el total no cambia al volver a pendiente");
  eq(vuelta.conteo.resueltos, 0, "vuelve a quedar sin resolver");
  eq(vuelta.conteo.pct, 0, "el porcentaje vuelve a cero");
});

await test("agregar un ítem propio y borrarlo", function () {
  var l = E.buildPackingList({ trip:viajePlaya(), tipoViaje:"playa", now:AT() });
  var con = E.addManualItem(l, { nombre:"Libro de Saer", categoria:"otros" });
  var it = hasItem(con, E.slug("Libro de Saer"));
  eq(it.origen, E.ORIGEN.MANUAL, "es propio y declara su origen");
  eq(con.conteo.total, l.conteo.total + 1, "suma al total");

  var repe = E.addManualItem(con, { nombre:"libro de saer" });
  eq(count(repe), count(con), "no duplica el mismo ítem escrito distinto");

  var sin = E.removeManualItem(con, E.slug("Libro de Saer"));
  eq(count(sin), count(l), "se puede borrar el propio");
  var intento = E.removeManualItem(l, "dni");
  eq(count(intento), count(l), "un sugerido no se borra: se descarta");
});

await test("agrupar por categoría respeta el orden y esconde los descartados", function () {
  var l = E.buildPackingList({ trip:viajePlaya(), tipoViaje:"playa", now:AT() });
  var g = E.groupByCategory(l);
  eq(g[0].key, "documentacion", "documentación va primero");
  var orden = E.CATEGORIES.map(function (c) { return c.key; });
  var pos = g.map(function (x) { return orden.indexOf(x.key); });
  for (var i = 1; i < pos.length; i++) assert(pos[i] > pos[i - 1], "las categorías salieron desordenadas");

  var ojotaKey = E.slug("Ojotas");
  var d = E.dismissItem(l, ojotaKey);
  var gc = E.groupByCategory(d).filter(function (x) { return x.key === "calzado"; })[0];
  assert(!gc.items.some(function (i) { return i.clave === ojotaKey; }), "el descartado no se muestra");
  var gt = E.groupByCategory(d, { includeDismissed:true }).filter(function (x) { return x.key === "calzado"; })[0];
  assert(gt.items.some(function (i) { return i.clave === ojotaKey; }), "con includeDismissed sí se muestra");
});

group("Robustez");

await test("sin argumentos no explota", function () {
  var l = E.buildPackingList();
  assert(l && l.items && typeof l.items === "object" && count(l) > 0, "tiene que devolver una lista igual");
  eq(l.tripId, "", "sin viaje, sin id");
});

await test("reservas rotas o incompletas no rompen el motor", function () {
  var l = E.buildPackingList({
    trip:{ id:"tz", name:null, destination:undefined, startDate:"no es fecha", endDate:"" },
    items:[null, {}, { type:"flight" }, { type:"car", title:null }, { type:"stay", from:123 }],
    now:AT()
  });
  assert(count(l) > 10, "igual tiene que armar la lista");
  eq(l.base.diasConocidos, false, "una fecha inválida es como no tener fecha");
  hasItem(l, E.slug("Licencia de conducir"), "el auto roto igual cuenta:");
});

/* ---------- cierre ---------- */
console.log("\n" + "=".repeat(52));
console.log("  " + passed + " pasaron, " + failed + " fallaron");
if (failed) {
  console.log("\n  Fallaron:");
  pending.forEach(function (n) { console.log("   - " + n); });
}
console.log("=".repeat(52) + "\n");
process.exitCode = failed ? 1 : 0;
}

main().catch(function (e) {
  console.error("\nLa corrida se cayó antes de terminar:\n", e);
  process.exitCode = 1;
});
