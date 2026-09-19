/* ============================================================
   VAL-72 — LAS RESERVAS MANDAN SOBRE EL DESTINO ESCRITO A MANO

   Reporte del PM, textual (19/09):

     "el tipo de valija inteligente que pregunta al principio se guía por
      los vuelos cargados pero luego termina sugiriendo en función del
      destino principal que está en el viaje (...) si hay vuelos o
      cualquier reserva en firme que indique destino, eso prima por sobre
      cualquier otra cosa. el ejemplo más claro es un viaje multidestino
      a Europa"

   El diagnóstico era peor que "usa uno u otro": usaba LOS DOS y no había
   regla de cuál gana. Al modelo le llegaba `destino: "Europa"` y más
   abajo tres vuelos a MAD, CDG y FCO, sin nada que dijera cuál manda.

   El motor se saca del HTML publicado, como `motores-desde-html.js`.

       node app/pruebas/val72-las-reservas-mandan.js [ruta/al/valija.html]
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
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "val72-"));
const arch = path.join(tmp, "pe.js");
fs.writeFileSync(arch, "(function(root,factory){module.exports=factory();})(this,function(){" + cuerpo + "\n});");
const pe = require(arch);

/* El caso del PM, tal cual lo describió. */
const EUROPA = { id:"t1", name:"Europa", destination:"Europa",
                 startDate:"2027-04-01", endDate:"2027-04-17" };
const VUELOS = [
  { type:"flight", from:"EZE", to:"MAD", start:"2027-04-01", title:"Vuelo a Madrid" },
  { type:"flight", from:"MAD", to:"CDG", start:"2027-04-06", title:"Vuelo a París" },
  { type:"flight", from:"CDG", to:"FCO", start:"2027-04-11", title:"Vuelo a Roma" }
];

console.log("\n· el viaje multidestino a Europa: los tres destinos, no uno");
const d = pe.destinosDelViaje(EUROPA, VUELOS);
info("lugares: " + JSON.stringify(d.lugares.map(x=>x.lugar + "/" + x.fuente)));
ok(d.deReservas, "el motor sabe que el destino viene de reservas, no del campo escrito");
ok(d.lugares.length === 3, `son TRES destinos, no uno (${d.lugares.length})`);
ok(d.lugares.every(l => l.fuente === "vuelo"), "y los tres salen de los vuelos");
ok(!d.lugares.some(l => /europa/i.test(l.lugar)), "«Europa», que es lo que se escribió a mano, NO está entre ellos");

console.log("\n· lo que le llega al modelo dice cuál manda");
const lista = pe.buildPackingList({ trip:EUROPA, items:VUELOS });
const prompt = pe.destinationPrompt(lista);
const linea = prompt.split("\n").find(l => /^- Destino/.test(l)) || "";
info(linea.slice(0, 150));
ok(/MAD/.test(linea) && /CDG/.test(linea) && /FCO/.test(linea), "la línea nombra los tres destinos");
ok(/manda/i.test(linea), "y dice explícitamente que las reservas son lo que manda");
ok(/multidestino/i.test(linea), "y avisa que tiene que servir para todos, no para uno");
ok(/NUNCA por encima/i.test(linea), "y que «Europa» es contexto, nunca por encima de las reservas");

console.log("\n· sin reservas, el campo escrito SÍ vale");
const solo = pe.buildPackingList({ trip:EUROPA, items:[] });
const lineaSola = pe.destinationPrompt(solo).split("\n").find(l => /^- Destino/.test(l)) || "";
info(lineaSola.slice(0, 120));
ok(/Europa/.test(lineaSola), "usa lo que la persona escribió");
ok(/no hay reservas/i.test(lineaSola), "y le dice al modelo que nadie lo confirmó");

console.log("\n· las otras reservas también aportan destino, no sólo los vuelos");
const OTRAS = [
  { type:"stay", address:"Calle Atocha 123, Madrid", start:"2027-04-01" },
  { type:"transfer", to:"Centro de Madrid", start:"2027-04-01" },
  { type:"car", address:"Aeropuerto de Madrid T4", start:"2027-04-02" }
];
const d2 = pe.destinosDelViaje({ id:"t2", destination:"Europa" }, OTRAS);
info("fuentes: " + JSON.stringify(d2.lugares.map(x=>x.fuente)));
ok(d2.deReservas, "un viaje sin vuelos pero con alojamiento tiene destino de reserva igual");
ok(d2.lugares.some(l=>l.fuente === "alojamiento"), "el alojamiento aporta su dirección");
ok(d2.lugares.some(l=>l.fuente === "traslado"), "y el traslado su «hasta»");
ok(d2.lugares.some(l=>l.fuente === "auto"), "y el auto su lugar de retiro");

console.log("\n· la dirección se manda entera: no se le adivina la ciudad");
ok(d2.lugares.some(l => l.lugar === "Calle Atocha 123, Madrid"),
   "la dirección va tal cual, sin recortarle «Madrid» con una heurística");

console.log("\n· el TIPO de viaje también: un vuelo le gana a una palabra tipeada");
const trampa = { id:"t3", name:"Viaje", destination:"Bariloche montaña",
                 startDate:"2027-04-01", endDate:"2027-04-10" };
const conVuelo = pe.buildPackingList({ trip:trampa, items:[VUELOS[0]] });
info(`tipo: ${conVuelo.tipoViaje} · ${conVuelo.base.tipoViajeMotivo}`);
ok(conVuelo.tipoViaje === "ciudad",
   "con un vuelo a Madrid el tipo sale del vuelo, no del «Bariloche» escrito a mano");
ok(/reservado/i.test(conVuelo.base.tipoViajeMotivo),
   "y el motivo dice de dónde salió: de lo reservado");

const sinVuelo = pe.buildPackingList({ trip:trampa, items:[] });
info(`sin reservas → tipo: ${sinVuelo.tipoViaje} · ${sinVuelo.base.tipoViajeMotivo}`);
ok(sinVuelo.tipoViaje === "montana",
   "y sin reservas, lo que escribió la persona sigue valiendo");
ok(/escribiste/i.test(sinVuelo.base.tipoViajeMotivo),
   "diciendo también de dónde salió");

console.log("\n· el vuelo de vuelta no convierte tu casa en un destino");
/* Esto NO lo reportó el PM: salió de releer el código antes de entregar. Su
   viaje de prueba era de ida sola, así que el caso no aparecía. Con la vuelta
   cargada, el prompt le pedía al modelo que la valija sirviera también para
   Buenos Aires, que es de donde sale. */
const IDA_Y_VUELTA = VUELOS.concat([
  { type:"flight", from:"FCO", to:"EZE", start:"2027-04-17", title:"Vuelo de regreso" }
]);
const dv = pe.destinosDelViaje(EUROPA, IDA_Y_VUELTA);
info("con la vuelta cargada: " + dv.lugares.map(x=>x.lugar).join(" · "));
ok(!dv.lugares.some(l => l.lugar === "EZE"),
   "EZE, que es de donde salió el primer vuelo, NO entra como destino");
ok(dv.lugares.length === 3, `siguen siendo los tres destinos reales (${dv.lugares.length})`);
const lineaIV = pe.destinationPrompt(pe.buildPackingList({ trip:EUROPA, items:IDA_Y_VUELTA }))
  .split("\n").find(l => /^- Destino/.test(l)) || "";
ok(!/EZE/.test(lineaIV), "y la línea que le llega al modelo tampoco lo nombra");

console.log("\n· pero sólo se descarta el ÚLTIMO, y sólo si es de donde salió");
/* El control negativo de la regla anterior: si el último vuelo NO vuelve al
   punto de partida, su destino tiene que quedar. Sin esto, la prueba de arriba
   pasaría igual con una función que descarte siempre el último vuelo. */
const SIN_VOLVER = [
  { type:"flight", from:"EZE", to:"MAD", start:"2027-04-01" },
  { type:"flight", from:"MAD", to:"LIS", start:"2027-04-10" }
];
const dsv = pe.destinosDelViaje(EUROPA, SIN_VOLVER);
info("sin regreso: " + dsv.lugares.map(x=>x.lugar).join(" · "));
ok(dsv.lugares.some(l => l.lugar === "LIS"),
   "LIS es el último vuelo y no vuelve a EZE, así que queda");
ok(dsv.lugares.length === 2, `los dos destinos, ninguno descartado (${dsv.lugares.length})`);

/* EL CONTROL: que estas pruebas puedan fallar. Si las reservas NO mandaran,
   el caso de la trampa daría "montana" y la línea del prompt diría sólo
   "Europa". Se comprueba que los dos resultados son distintos entre sí. */
console.log("\n· el control: los dos caminos dan resultados DISTINTOS");
ok(conVuelo.tipoViaje !== sinVuelo.tipoViaje,
   `con reservas da «${conVuelo.tipoViaje}» y sin reservas «${sinVuelo.tipoViaje}»: la jerarquía cambia el resultado`);
ok(linea !== lineaSola, "y la línea del prompt también cambia según haya reservas o no");

console.log("\n====================================================");
console.log(fallos ? `  ${fallos} FALLARON` : "  Todo en verde — las reservas mandan");
console.log("====================================================\n");
process.exit(fallos ? 1 : 0);
