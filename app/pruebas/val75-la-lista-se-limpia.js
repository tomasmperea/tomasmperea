/* ============================================================
   VAL-75 — LA LISTA SE LIMPIA CUANDO CAMBIA EL VIAJE

   Reporte del PM (19/09), con captura: cambió el viaje de Noruega a
   Argentina, la valija sugirió cosas nuevas —o sea que VAL-63 andaba—
   pero *"no actualiza los que ya hizo"*. En la captura, tres ítems
   razonados para Noruega, con la cabecera diciendo ARGENTINA.

   LA REGLA LA DECIDIÓ EL PM EL 22/09, y es más simple que la que el
   backlog tenía escrita:

     "si ya empaqué un ítem, es porque realmente lo necesito y ya está
      en la valija real, por lo que no tiene sentido sacarlo... lo que
      verdaderamente no empaqué aún es lo que debería cambiar"

   Traducido al modelo de la app:

     empacado            intocable — está en la valija de verdad
     agregado a mano     intocable — lo escribió la persona
     descartado          no revive — ya dijo que no lo quería
     pendiente sugerido  se recalcula: se va si ya no corresponde

   Y DÓNDE ESTABA EL DEFECTO, que no era donde decía el backlog: el
   motor ya hacía todo esto. Lo que fallaba es que `desactualizada`
   contaba sólo lo que se AGREGA, así que un viaje que sólo necesitaba
   SACAR terminaba con la app diciendo "La lista sigue al día con lo
   que cargaste" y sin guardar nada.

       node app/pruebas/val75-la-lista-se-limpia.js [ruta/al/valija.html]
   ============================================================ */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const APP = process.argv[2] || path.resolve(__dirname, "..", "valija.html");

let fallos = 0;
const ok   = (c, m) => { console.log((c ? "  ok    " : "  FALLA ") + m); if (!c) fallos++; };
const info = m => console.log("  info   " + m);

const html = fs.readFileSync(APP, "utf8");
const abre = "const PackingEngine = (function () {";
const i = html.indexOf(abre);
if (i < 0) { console.log("no encontré PackingEngine"); process.exit(2); }
const cuerpo = html.slice(i + abre.length, html.indexOf("\n})();", i + abre.length));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "val75-"));
const arch = path.join(tmp, "pe.js");
fs.writeFileSync(arch, "(function(root,factory){module.exports=factory();})(this,function(){" + cuerpo + "\n});");
const pe = require(arch);

/* El viaje del PM, y la respuesta del modelo tal como la vio en su captura. */
const NORUEGA = { id:"t1", name:"Noruega", destination:"Noruega",
                  startDate:"2026-09-14", endDate:"2026-09-24" };
const ARGENTINA = Object.assign({}, NORUEGA, { name:"Argentina", destination:"Argentina" });

const deNoruega = async () => ({ items:[
  { nombre:"Pantalón impermeable", categoria:"ropa", cantidad:1, motivo:"En Noruega la lluvia es frecuente en septiembre." },
  { nombre:"Capas intermedias de polar", categoria:"ropa", cantidad:2, motivo:"Fin de septiembre en la montaña noruega es frío." },
  { nombre:"Buff o cuello", categoria:"ropa", cantidad:1, motivo:"El viento de montaña en Noruega corta la cara." }
], quitar:[] });
const sinNada = async () => ({ items:[], quitar:[] });

(async () => {

  /* ---- la lista de Noruega, que es el punto de partida de todo ---- */
  let noruega = pe.buildPackingList({ trip:NORUEGA, items:[], tipoViaje:"montana" });
  noruega = await pe.enrichWithDestination(noruega, deNoruega, {});
  const ia = pe.itemsArray(noruega).filter(x => x.origen === "destino");
  console.log("\n· la lista de Noruega, tal como la vio el PM");
  ok(ia.length === 3, `la capa de destino puso sus tres ítems (${ia.length})`);
  ok(ia.every(x => /[Nn]oruega/.test(x.motivo)), "y los tres razonan sobre Noruega");

  console.log("\n· EL CASO DEL REPORTE · sin NADA para agregar, la lista igual está vieja");
  /* Es el caso que el defecto dejaba afuera: si el recálculo no encuentra nada
     que sumar, `desactualizada` daba false, la app decía "la lista sigue al
     día" y no guardaba la lista limpia. Tres ítems de Noruega para siempre. */
  const soloSacar = await pe.planListUpdateAsync({
    list:noruega, trip:ARGENTINA, items:[], tipoViaje:"montana", ask:sinNada });
  info("motivo: " + JSON.stringify(soloSacar.motivo));
  ok(soloSacar.desactualizada, "la app SÍ tiene algo para ofrecer, aunque no haya nada que sumar");
  ok((soloSacar.nuevos || []).length === 0, "y efectivamente no hay nada que sumar");
  ok((soloSacar.sacados || []).length > 0, `hay cosas para sacar (${(soloSacar.sacados||[]).length})`);
  ok(!/sigue al día/.test(soloSacar.motivo), "el texto NO dice que la lista sigue al día");

  console.log("\n· y lo que saca es lo correcto");
  const nombres = (soloSacar.sacados || []).map(x => x.nombre);
  info(nombres.join(", "));
  ok(ia.every(x => nombres.indexOf(x.nombre) >= 0), "los tres ítems de Noruega se van");
  ok(nombres.indexOf("Pasaporte") >= 0,
     "y también el pasaporte: Noruega es internacional y Argentina no, así que la regla dejó de aplicar");
  const quedan = pe.itemsArray(soloSacar.listaPropuesta);
  ok(!quedan.some(x => /[Nn]oruega/.test(x.motivo || "")),
     "en la lista propuesta no queda un solo motivo que hable de Noruega");

  /* ---- LA REGLA DEL PM, caso por caso ---- */
  console.log("\n· LA REGLA DEL PM · lo EMPACADO es intocable");
  const conEmpacado = pe.setItemState(noruega, ia[1].clave, "empacado");
  const r1 = await pe.planListUpdateAsync({
    list:conEmpacado, trip:ARGENTINA, items:[], tipoViaje:"montana", ask:sinNada });
  const sobrevive = pe.itemsArray(r1.listaPropuesta).find(x => x.clave === ia[1].clave);
  ok(!!sobrevive, "el ítem que la persona empacó sigue en la lista");
  ok(sobrevive && sobrevive.estado === "empacado", "y sigue empacado");
  ok(!(r1.sacados || []).some(x => x.clave === ia[1].clave), "y no aparece entre lo que se saca");

  console.log("\n· el control: sus dos hermanos, que NO empacó, sí se van");
  ok((r1.sacados || []).some(x => x.clave === ia[0].clave) &&
     (r1.sacados || []).some(x => x.clave === ia[2].clave),
     "los otros dos ítems de Noruega, pendientes, se sacan igual");

  console.log("\n· lo DESCARTADO no revive");
  const conDescartado = pe.setItemState(noruega, ia[0].clave, "descartado");
  const r2 = await pe.planListUpdateAsync({
    list:conDescartado, trip:ARGENTINA, items:[], tipoViaje:"montana", ask:deNoruega });
  const desc = pe.itemsArray(r2.listaPropuesta).find(x => x.clave === ia[0].clave);
  ok(!!desc && desc.estado === "descartado",
     "un ítem descartado sigue descartado aunque el modelo lo vuelva a proponer");

  console.log("\n· lo AGREGADO A MANO es intocable");
  const conPropio = pe.addManualItem(noruega, { nombre:"Cargador del reloj", categoria:"otros" });
  const mio = pe.itemsArray(conPropio).find(x => x.origen === "manual");
  const r3 = await pe.planListUpdateAsync({
    list:conPropio, trip:ARGENTINA, items:[], tipoViaje:"montana", ask:sinNada });
  ok(pe.itemsArray(r3.listaPropuesta).some(x => x.clave === mio.clave),
     "lo que la persona escribió se queda aunque cambie el viaje entero");
  ok(!(r3.sacados || []).some(x => x.clave === mio.clave), "y nunca aparece entre lo que se saca");

  /* ---- EL CHIP, que es el defecto B del reporte ---- */
  console.log("\n· EL CHIP · el ítem guarda de qué destino salió");
  ok(ia.every(x => x.porDestino === "Noruega"),
     "cada ítem de la capa de destino guarda el destino con el que se generó");
  const empacadoTrasCambio = pe.itemsArray(r1.listaPropuesta).find(x => x.clave === ia[1].clave);
  ok(empacadoTrasCambio.porDestino === "Noruega",
     "y lo conserva después de cambiar el viaje a Argentina");
  info("el chip decía «por Argentina» sobre un ítem razonado para Noruega; ahora dice «por " +
       empacadoTrasCambio.porDestino + "»");

  console.log("\n· el control: un ítem generado DESPUÉS dice el destino nuevo");
  /* Sin esto, `porDestino` podría estar clavado en cualquier cosa y todo lo
     de arriba pasaría igual. */
  const deArgentina = async () => ({ items:[
    { nombre:"Repelente", categoria:"salud", cantidad:1, motivo:"En el norte argentino hay mosquitos." }
  ], quitar:[] });
  const r4 = await pe.planListUpdateAsync({
    list:noruega, trip:ARGENTINA, items:[], tipoViaje:"montana", ask:deArgentina });
  const nuevo = pe.itemsArray(r4.listaPropuesta).find(x => /Repelente/.test(x.nombre));
  ok(!!nuevo && nuevo.porDestino === "Argentina",
     "un ítem generado con el viaje ya cambiado dice «Argentina», no «Noruega»");
  ok(ia[0].porDestino !== nuevo.porDestino,
     "o sea que el campo cambia con el viaje: no es una constante disfrazada");

  console.log("\n· y nada de esto se dispara cuando el viaje NO cambió");
  /* El control que evita el peor resultado posible: que la app proponga
     cambios cada vez que abrís la valija. */
  const igual = await pe.planListUpdateAsync({
    list:noruega, trip:NORUEGA, items:[], tipoViaje:"montana", ask:sinNada });
  info("mismo viaje → " + JSON.stringify(igual.motivo));
  ok(!igual.desactualizada, "con el mismo viaje no hay nada que ofrecer");
  ok((igual.sacados || []).length === 0, "y no se saca nada");
  ok(/sigue al día/.test(igual.motivo), "y ahí SÍ dice que la lista sigue al día");

  /* ---- EL CASO VECINO, QUE ES EL QUE ME FALTÓ ---- */
  console.log("\n· EL CASO VECINO · cambió el NOMBRE del destino, no el destino");
  /* Lo encontró la auditoría del 22/09 y es un defecto de producto, no de
     arnés. `destinoQueRazono` devuelve el campo escrito cuando no hay vuelos
     ("Noruega") y códigos IATA en cuanto aparece uno ("OSL"). La primera
     versión comparaba los dos como si fueran lo mismo, así que CARGAR UN
     VUELO —el gesto más común de la app— proponía sacar ítems válidos
     diciendo "ya no corresponde".

     Las pruebas de arriba no lo veían porque todas cambian el destino de
     verdad o no lo cambian nada. Ninguna cambiaba sólo cómo se lo nombra. */
  const VUELO = { id:"r1", type:"flight", title:"EZE → OSL", from:"EZE", to:"OSL",
                  start:"2026-09-14T22:00", end:"2026-09-15T18:00" };

  const alCargarVuelo = await pe.planListUpdateAsync({
    list:noruega, trip:NORUEGA, items:[VUELO], tipoViaje:"montana", ask:sinNada });
  const sacaIA = (alCargarVuelo.sacados || []).filter(x => x.origen === "destino").map(x => x.nombre);
  info("al cargar el vuelo saca de la capa de destino: " + JSON.stringify(sacaIA));
  ok(sacaIA.length === 0,
     "cargar un vuelo a Noruega NO propone sacar lo que se razonó para Noruega");
  ok(pe.itemsArray(alCargarVuelo.listaPropuesta).filter(x => x.origen === "destino").length === 3,
     "y los tres siguen en la lista propuesta");

  console.log("\n· y al revés: la lista se generó CON el vuelo y después se borra la reserva");
  let conVuelo = pe.buildPackingList({ trip:NORUEGA, items:[VUELO], tipoViaje:"montana" });
  conVuelo = await pe.enrichWithDestination(conVuelo, deNoruega, {});
  const iaVuelo = pe.itemsArray(conVuelo).filter(x => x.origen === "destino");
  info("porDestino cuando hay vuelo: " + JSON.stringify(iaVuelo.map(x => x.porDestino)));
  ok(iaVuelo.every(x => x.porDestinoFuente === "reservas"),
     "el ítem guarda que ese destino salió de las reservas, no del campo escrito");
  const alBorrarVuelo = await pe.planListUpdateAsync({
    list:conVuelo, trip:NORUEGA, items:[], tipoViaje:"montana", ask:sinNada });
  const sacaIA2 = (alBorrarVuelo.sacados || []).filter(x => x.origen === "destino").map(x => x.nombre);
  info("al borrar el vuelo saca de la capa de destino: " + JSON.stringify(sacaIA2));
  ok(sacaIA2.length === 0, "borrar el vuelo tampoco propone sacar lo que se razonó con él");

  console.log("\n· el control: con vuelo en las DOS puntas, un destino distinto SÍ se saca");
  /* Sin esto, «no comparar fuentes distintas» podría estar tapando todo. */
  const OTRO = Object.assign({}, VUELO, { title:"EZE → MAD", to:"MAD" });
  const alCambiarVuelo = await pe.planListUpdateAsync({
    list:conVuelo, trip:NORUEGA, items:[OTRO], tipoViaje:"montana", ask:sinNada });
  const sacaIA3 = (alCambiarVuelo.sacados || []).filter(x => x.origen === "destino").map(x => x.nombre);
  info("al cambiar el vuelo de OSL a MAD saca: " + JSON.stringify(sacaIA3));
  ok(sacaIA3.length === 3, "cambiar el vuelo a otra ciudad sí saca lo que era de la anterior");

  /* ---- LA LISTA QUE EL PM YA TIENE EN EL TELÉFONO ---- */
  console.log("\n· LA LISTA VIEJA · la del PM no tiene `porDestino`, porque es de antes");
  /* El fixture se escribe como la app ESCRIBÍA, no como escribe hoy: `porDestino`
     nació con esta historia, así que ninguna lista guardada lo tiene. Si el
     arreglo dependiera de ese campo, en el teléfono del PM no haría nada — y
     la prueba de arriba pasaría igual, porque su fixture sí lo tiene. Es el
     caso que gasta una ronda entera del PM si no está acá. */
  const vieja = JSON.parse(JSON.stringify(noruega));
  Object.keys(vieja.items).forEach(k => { delete vieja.items[k].porDestino; });
  ok(pe.itemsArray(vieja).every(x => !x.porDestino), "el fixture no tiene el campo, como la lista guardada");
  info("y la lista sí sabe de dónde viene: base.destino = " + JSON.stringify(vieja.base.destino));

  const r5 = await pe.planListUpdateAsync({
    list:vieja, trip:ARGENTINA, items:[], tipoViaje:"montana", ask:sinNada });
  const sacadosViejos = (r5.sacados || []).map(x => x.nombre);
  ok(ia.every(x => sacadosViejos.indexOf(x.nombre) >= 0),
     "los tres ítems de Noruega se van igual, sin el campo, leyendo de dónde salió la lista");

  console.log("\n· el control: la MISMA lista vieja, con el MISMO viaje, no se toca");
  /* Sin esto, "los saca" podría estar pasando porque los saca siempre. */
  const r6 = await pe.planListUpdateAsync({
    list:vieja, trip:NORUEGA, items:[], tipoViaje:"montana", ask:sinNada });
  info("mismo viaje, lista vieja → " + JSON.stringify(r6.motivo));
  ok((r6.sacados || []).length === 0, "no se saca nada");
  ok(pe.itemsArray(r6.listaPropuesta).filter(x => x.origen === "destino").length === 3,
     "y los tres ítems de la capa de destino siguen en la lista propuesta");

  console.log("\n· y la lista propuesta nunca pierde en silencio lo que `sacados` no nombra");
  /* La regla que hace que las dos no puedan mentir por separado: todo lo que
     estaba antes, o está en la propuesta, o está nombrado en `sacados`. */
  for (const [etiqueta, previa, plan] of [["cambió el viaje", vieja, r5],
                                          ["mismo viaje", vieja, r6],
                                          ["mismo viaje, lista nueva", noruega, igual]]) {
    const hay = {}; pe.itemsArray(plan.listaPropuesta).forEach(x => hay[x.clave] = true);
    const nombrado = {}; (plan.sacados || []).forEach(x => nombrado[x.clave] = true);
    const fantasmas = pe.itemsArray(previa).filter(x => !hay[x.clave] && !nombrado[x.clave]);
    ok(fantasmas.length === 0,
       `${etiqueta}: nada desaparece sin que el plan lo diga` +
       (fantasmas.length ? " — " + fantasmas.map(x => x.nombre).join(", ") : ""));
  }

  console.log("\n====================================================");
  console.log(fallos ? `  ${fallos} FALLARON` : "  Todo en verde — la lista se limpia y no toca lo tuyo");
  console.log("====================================================\n");
  process.exit(fallos ? 1 : 0);
})();
