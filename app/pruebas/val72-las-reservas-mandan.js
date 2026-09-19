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
ok(/no hay ningún vuelo cargado/i.test(lineaSola), "y le dice al modelo que nadie lo confirmó");

console.log("\n· las otras reservas también aportan, pero no todas mandan igual");
/* Esta prueba decía antes que traslado y auto aportaban DESTINO. Lo decía
   porque el código lo hacía, y el código estaba mal: ver el hallazgo 1 más
   abajo. Ahora aportan como PISTA, que es lo que su campo alcanza a decir. */
const OTRAS = [
  { type:"stay", address:"Calle Atocha 123, Madrid", start:"2027-04-01" },
  { type:"transfer", to:"Centro de Madrid", start:"2027-04-01" },
  { type:"car", address:"Aeropuerto de Madrid T4", start:"2027-04-02" }
];
const d2 = pe.destinosDelViaje({ id:"t2", destination:"Europa" }, OTRAS);
info("destinos: " + JSON.stringify(d2.lugares.map(x=>x.fuente)) +
     " · pistas: " + JSON.stringify(d2.pistas.map(x=>x.fuente)));
ok(!d2.deReservas, "sin vuelos, ninguna dirección se declara destino en firme");
ok(d2.pistas.some(l=>l.fuente === "alojamiento"), "el alojamiento aporta su dirección, como pista");
ok(d2.pistas.some(l=>l.fuente === "traslado"), "el traslado aporta su «hasta», como pista");
ok(d2.pistas.some(l=>l.fuente === "auto"), "y el auto su lugar de retiro, también como pista");
ok(d2.pistas.length === 3, `las tres viajan al modelo: ninguna se calla (${d2.pistas.length})`);

console.log("\n· la dirección se manda entera: no se le adivina la ciudad");
ok(d2.pistas.some(l => l.lugar === "Calle Atocha 123, Madrid"),
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

console.log("\n· HALLAZGO 1 DE LA AUDITORÍA · una reserva en el punto de PARTIDA no es un destino");
/* Esto volteó la primera versión de VAL-72 con 57/100, y no es un caso raro:
   el traslado al aeropuerto de salida es de los datos más comunes que hay.
   Medido contra la v23: ANTES el modelo recibía "- Destino: Bariloche", y
   DESPUÉS de la primera versión recibía "Ezeiza es lo que manda, Bariloche
   NUNCA por encima". Era una regresión, no una mejora incompleta. */
const BARI = { id:"t4", name:"Bariloche", destination:"Bariloche",
               startDate:"2027-07-01", endDate:"2027-07-10" };
const SOLO_TRASLADO = [{ type:"transfer", to:"Aeropuerto de Ezeiza", start:"2027-07-01" }];
const dt = pe.destinosDelViaje(BARI, SOLO_TRASLADO);
info("deReservas: " + dt.deReservas + " · lugares: " + dt.lugares.map(x=>x.lugar).join(", ") +
     " · pistas: " + (dt.pistas||[]).map(x=>x.lugar).join(", "));
ok(!dt.deReservas, "un traslado solo NO alcanza para desplazar el destino escrito");
ok(dt.lugares.some(l => l.lugar === "Bariloche"), "«Bariloche», que es lo que la persona escribió, sigue siendo el destino");
const lineaBari = pe.destinationPrompt(pe.buildPackingList({ trip:BARI, items:SOLO_TRASLADO }))
  .split("\n").find(l => /^- Destino/.test(l)) || "";
info(lineaBari.slice(0, 200));
ok(!/Ezeiza.*lo que manda|manda.*Ezeiza/i.test(lineaBari), "la línea NO dice que Ezeiza mande");
ok(!/NUNCA por encima/.test(lineaBari), "y NO le dice al modelo que ignore Bariloche");
ok(/Ezeiza/.test(lineaBari), "pero el traslado se manda igual: callarlo sería perder información");
ok(/antes de tomarla como destino/i.test(lineaBari), "presentado como pista, con las dos lecturas a la vista");

console.log("\n· HALLAZGO 1, SEGUNDA RONDA · el alojamiento en el ORIGEN, que es el caso espejo");
/* La segunda ronda de auditoría volteó el arreglo de la primera: yo le había
   preguntado «¿puede estar en el punto de partida?» al traslado y al auto, y
   NO al alojamiento, que estaba en el cajón de al lado. El hotel junto al
   aeropuerto la noche antes de un vuelo temprano es un patrón común, y hacía
   que el modelo recibiera «Buenos Aires manda, Bariloche NUNCA por encima».

   La regla que sí se sostiene: sólo un vuelo se puede comparar contra el
   punto de partida, porque los dos son códigos IATA. Una dirección es texto
   libre y no hay contra qué compararla — ni con fechas, porque una noche
   antes de salir y una noche al llegar se escriben igual. */
const HOTEL_EN_ORIGEN = [{ type:"stay", address:"Hotel Ezeiza Este, Buenos Aires", start:"2027-06-30" }];
const dho = pe.destinosDelViaje(BARI, HOTEL_EN_ORIGEN);
info("deReservas: " + dho.deReservas + " · destino: " + dho.lugares.map(x=>x.lugar).join(", "));
ok(!dho.deReservas, "un alojamiento solo NO declara destino en firme");
ok(dho.lugares.some(l => l.lugar === "Bariloche"), "«Bariloche» sigue siendo el destino");
const lineaHotel = pe.destinationPrompt(pe.buildPackingList({ trip:BARI, items:HOTEL_EN_ORIGEN }))
  .split("\n").find(l => /^- Destino/.test(l)) || "";
ok(!/NUNCA por encima/.test(lineaHotel), "y el modelo NO recibe la orden de ignorarlo");
ok(/Hotel Ezeiza Este/.test(lineaHotel), "pero el hotel se manda igual, como pista");
ok(/2027-06-30/.test(lineaHotel), "con su fecha, que es lo que le permite al modelo decidir");

console.log("\n· y el control: un vuelo SÍ puede desplazar lo escrito");
/* Sin esto, todo lo de arriba pasaría con una función que nunca declare nada
   en firme. Tiene que seguir habiendo un camino que mande. */
const dfv = pe.destinosDelViaje(BARI, [{ type:"flight", from:"EZE", to:"BRC", start:"2027-07-01" }]);
ok(dfv.deReservas, "con un vuelo cargado sí hay destino en firme");
ok(dfv.lugares.some(l => l.lugar === "BRC"), "y es el del vuelo");
ok(!dfv.lugares.some(l => /bariloche/i.test(l.lugar)), "el escrito a mano ya no aparece como destino");

console.log("\n· HALLAZGO 2 DE LA AUDITORÍA · un vuelo sin título no puede fingir que clasificó");
/* El destino de un vuelo es IATA de tres letras y ninguna palabra de
   TYPE_HINTS tiene tres letras: "MAD" no puede puntuar nunca. La prueba
   anterior pasaba porque su único fixture traía title:"Vuelo a Madrid".
   Un viaje cargado a mano no lo trae. Esto NO es regresión —la v23 hacía lo
   mismo— pero el backlog prometía que estaba resuelto. */
const SIN_TITULO = [{ type:"flight", from:"EZE", to:"MAD", start:"2027-04-01" }];
const st = pe.buildPackingList({ trip:trampa, items:SIN_TITULO });
info(`vuelo sin título → ${st.tipoViaje} · ${st.base.tipoViajeMotivo}`);
ok(/no dicen de qué tipo/i.test(st.base.tipoViajeMotivo),
   "el motivo dice en pantalla que las reservas no se pudieron clasificar");
ok(!/en lo que tenés reservado\.$/.test(st.base.tipoViajeMotivo),
   "y NO afirma haber decidido por lo reservado cuando no pudo");

console.log("\n· el control del hallazgo 2: cuando NO hay reservas, no se inventa esa frase");
ok(!/no dicen de qué tipo/i.test(sinVuelo.base.tipoViajeMotivo),
   "un viaje sin ninguna reserva no dice «tus reservas no dicen»: no las hay");

console.log("\n· ida y vuelta de dos tramos, el caso más común de todos");
const DOS_TRAMOS = [
  { type:"flight", from:"EZE", to:"MAD", start:"2027-04-01" },
  { type:"flight", from:"MAD", to:"EZE", start:"2027-04-10" }
];
const d2t = pe.destinosDelViaje(EUROPA, DOS_TRAMOS);
info("dos tramos: " + d2t.lugares.map(x=>x.lugar).join(" · "));
ok(d2t.lugares.length === 1 && d2t.lugares[0].lugar === "MAD",
   "queda Madrid y sólo Madrid: la vuelta no agrega tu casa");
ok(d2t.deReservas, "y sigue contando como destino en firme");

console.log("\n· volver a casa a MITAD de viaje: declarado, no resuelto");
/* El auditor lo marcó como menor y tiene razón: la regla mira el último vuelo
   contra el origen del primero, así que una escala en casa a mitad de viaje
   queda como destino. Se deja escrito acá para que nadie lo descubra creyendo
   que era un descuido: es el alcance elegido, no un olvido. */
const VUELVE_AL_MEDIO = [
  { type:"flight", from:"EZE", to:"MAD", start:"2027-04-01" },
  { type:"flight", from:"MAD", to:"EZE", start:"2027-04-08" },
  { type:"flight", from:"EZE", to:"FCO", start:"2027-04-12" }
];
const dm = pe.destinosDelViaje(EUROPA, VUELVE_AL_MEDIO);
info("con escala en casa: " + dm.lugares.map(x=>x.lugar).join(" · "));
ok(dm.lugares.some(l => l.lugar === "EZE"),
   "EZE queda como destino, y eso es el alcance conocido de la regla, no un bug oculto");

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
