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
/* CON `end` CARGADO, que es lo que la app escribe. El fixture no lo tenía, y
   por eso un control que declaraba un caso de éxito pasaba: le faltaba un
   campo que el formulario de vuelo ("Llega"), la pantalla de revisar lo
   importado y el prompt del importador completan los tres. La quinta
   auditoría lo destapó. Es la regla que ya está escrita: un escenario que
   espera que todo salga bien puede pasar porque el sabotaje nunca llegó —
   acá el sabotaje era el dato real. */
const VUELOS = [
  { type:"flight", from:"EZE", to:"MAD", start:"2027-04-01T08:00", end:"2027-04-01T23:30", title:"Vuelo a Madrid" },
  { type:"flight", from:"MAD", to:"CDG", start:"2027-04-06T09:00", end:"2027-04-06T11:00", title:"Vuelo a París" },
  { type:"flight", from:"CDG", to:"FCO", start:"2027-04-11T14:00", end:"2027-04-11T16:00", title:"Vuelo a Roma" }
];

/* El caso más común que existe en la app, y el que esta marca rompía: ida y
   vuelta. El único destino del viaje quedaba rotulado como lugar de
   trasbordo, y el prompt le pedía al modelo que dudara de tratarlo como
   destino. No había otro lugar al que pudiera caer. */
const IDA_Y_VUELTA_CON_END = [
  { type:"flight", from:"EZE", to:"MAD", start:"2027-04-01T08:00", end:"2027-04-01T23:30" },
  { type:"flight", from:"MAD", to:"EZE", start:"2027-04-15T10:00", end:"2027-04-16T06:00" }
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
  { type:"stay", address:"Calle Atocha 123, Madrid", start:"2027-04-01T15:00", end:"2027-04-06T10:00" },
  { type:"transfer", from:"Aeropuerto de Madrid T4", to:"Centro de Madrid", start:"2027-04-01T10:00" },
  { type:"car", address:"Aeropuerto de Madrid T4", start:"2027-04-02T09:00", end:"2027-04-09T09:00" }
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
  { type:"flight", from:"FCO", to:"EZE", start:"2027-04-17T08:00", end:"2027-04-17T10:00", title:"Vuelo de regreso" }
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
  { type:"flight", from:"EZE", to:"MAD", start:"2027-04-01T08:00", end:"2027-04-01T10:00" },
  { type:"flight", from:"MAD", to:"LIS", start:"2027-04-10T08:00", end:"2027-04-10T10:00" }
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
const SOLO_TRASLADO = [{ type:"transfer", from:"Av. Santa Fe 1234", to:"Aeropuerto de Ezeiza", start:"2027-07-01T05:00" }];
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
const HOTEL_EN_ORIGEN = [{ type:"stay", address:"Hotel Ezeiza Este, Buenos Aires", start:"2027-06-30T20:00", end:"2027-07-01T04:00" }];
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
const dfv = pe.destinosDelViaje(BARI, [{ type:"flight", from:"EZE", to:"BRC", start:"2027-07-01T08:00", end:"2027-07-01T10:00" }]);
ok(dfv.deReservas, "con un vuelo cargado sí hay destino en firme");
ok(dfv.lugares.some(l => l.lugar === "BRC"), "y es el del vuelo");
ok(!dfv.lugares.some(l => /bariloche/i.test(l.lugar)), "el escrito a mano ya no aparece como destino");

console.log("\n· HALLAZGO 2 DE LA AUDITORÍA · un vuelo sin título no puede fingir que clasificó");
/* El destino de un vuelo es IATA de tres letras y ninguna palabra de
   TYPE_HINTS tiene tres letras: "MAD" no puede puntuar nunca. La prueba
   anterior pasaba porque su único fixture traía title:"Vuelo a Madrid".
   Un viaje cargado a mano no lo trae. Esto NO es regresión —la v23 hacía lo
   mismo— pero el backlog prometía que estaba resuelto. */
const SIN_TITULO = [{ type:"flight", from:"EZE", to:"MAD", start:"2027-04-01T08:00", end:"2027-04-01T10:00" }];
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
  { type:"flight", from:"EZE", to:"MAD", start:"2027-04-01T08:00", end:"2027-04-01T10:00" },
  { type:"flight", from:"MAD", to:"EZE", start:"2027-04-10T08:00", end:"2027-04-10T10:00" }
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
  { type:"flight", from:"EZE", to:"MAD", start:"2027-04-01T08:00", end:"2027-04-01T10:00" },
  { type:"flight", from:"MAD", to:"EZE", start:"2027-04-08T08:00", end:"2027-04-08T10:00" },
  { type:"flight", from:"EZE", to:"FCO", start:"2027-04-12T08:00", end:"2027-04-12T10:00" }
];
const dm = pe.destinosDelViaje(EUROPA, VUELVE_AL_MEDIO);
info("con escala en casa: " + dm.lugares.map(x=>x.lugar).join(" · "));
ok(dm.lugares.some(l => l.lugar === "EZE"),
   "EZE queda como destino, y eso es el alcance conocido de la regla, no un bug oculto");

console.log("\n· sin destino escrito y sin vuelos, la pista NO se tira");
/* Salió de atacar la función con fixtures nuevos, no de un reporte. Si la
   persona nunca escribió el destino y sólo importó el hotel, la línea no
   tenía nada que encabezarla y cortaba antes de las pistas: el modelo
   recibía "sin especificar" mientras la app tenía el hotel cargado. Las
   pistas existen para mandarse; que se pierdan justo cuando son lo único
   que hay es el peor momento posible. */
const SIN_ESCRIBIR = { id:"t9", name:"Viaje", destination:"",
                       startDate:"2027-05-01", endDate:"2027-05-10" };
const SOLO_RIAD = [{ type:"stay", address:"Riad Dar Anika, Marrakech",
                     start:"2027-05-01T15:00", end:"2027-05-08T10:00" }];
const lineaRiad = pe.destinationPrompt(pe.buildPackingList({ trip:SIN_ESCRIBIR, items:SOLO_RIAD }))
  .split("\n").find(l => /^- Destino/.test(l)) || "";
info(lineaRiad.slice(0, 170));
ok(/Marrakech/.test(lineaRiad), "el hotel llega al modelo aunque no haya destino escrito");
ok(/2027-05-01T15:00 a 2027-05-08T10:00/.test(lineaRiad),
   "con sus fechas tal como las guarda la app, que es lo que le permite ubicarlo");
ok(!/^- Destino: sin especificar/.test(lineaRiad), "y la línea deja de decir que no se sabe nada");

console.log("\n· el control: sin nada cargado SÍ dice que no hay destino");
const lineaNada = pe.destinationPrompt(pe.buildPackingList({ trip:SIN_ESCRIBIR, items:[] }))
  .split("\n").find(l => /^- Destino/.test(l)) || "";
ok(/sin especificar/.test(lineaNada),
   "un viaje vacío de verdad sigue diciendo «sin especificar»: el arreglo no inventa una pista");

console.log("\n· un vuelo sin origen cargado: el alcance, dicho");
/* La regla del vuelo de vuelta compara el `to` del último contra el `from`
   del primero. Si ese `from` está vacío no hay contra qué comparar, así que
   el aeropuerto de casa entra como destino. Es el lado seguro del error —se
   manda de más, no de menos— pero queda escrito para que no se descubra
   como sorpresa. */
const SIN_ORIGEN = [
  { type:"flight", from:"", to:"SLA", start:"2027-05-01T08:00", end:"2027-05-01T10:00" },
  { type:"flight", from:"SLA", to:"EZE", start:"2027-05-10T08:00", end:"2027-05-10T10:00" }
];
const dso = pe.destinosDelViaje({ id:"t10", destination:"Salta" }, SIN_ORIGEN);
info("sin origen en el primer vuelo: " + dso.lugares.map(x=>x.lugar).join(" · "));
ok(dso.lugares.some(l => l.lugar === "EZE"),
   "sin `from` en el primer vuelo, EZE entra: no hay contra qué compararlo, y se manda de más y no de menos");

console.log("\n· BLOQUEANTE DE LA CUARTA RONDA · una pista no puede borrar el destino escrito");
/* El destino escrito se sumaba con la misma función que las pistas, y esa
   función comparte un registro de "ya lo vi". Un traslado cuyo «hasta» dice
   lo mismo que el destino del viaje se comía la entrada del destino escrito:
   la línea le decía al modelo que la persona no había escrito ninguno —falso—
   y le ofrecía su propio destino como pista que no tomara en serio. Una
   reserva desplazando al destino escrito otra vez, por un camino nuevo. */
[["el «hasta» de un traslado, igual al destino", { id:"c1", destination:"Bariloche",
   startDate:"2027-06-01", endDate:"2027-06-10" }, [{ type:"transfer", from:"Aeropuerto", to:"Bariloche", start:"2027-06-01T09:00" }], "Bariloche"],
 ["con acento y mayúscula de diferencia", { id:"c2", destination:"Córdoba",
   startDate:"2027-06-01", endDate:"2027-06-10" }, [{ type:"car", address:"cordoba", start:"2027-06-01T09:00", end:"2027-06-08T09:00" }], "Córdoba"],
 ["con espacios de más", { id:"c3", destination:"Madrid",
   startDate:"2027-06-01", endDate:"2027-06-10" }, [{ type:"stay", address:"  MADRID ", start:"2027-06-01T15:00", end:"2027-06-08T10:00" }], "Madrid"]
].forEach(function (caso) {
  var titulo = caso[0], trip = caso[1], items = caso[2], esperado = caso[3];
  var d = pe.destinosDelViaje(trip, items);
  var linea = pe.destinationPrompt(pe.buildPackingList({ trip:trip, items:items }))
    .split("\n").find(l => /^- Destino/.test(l)) || "";
  ok(d.lugares.some(l => l.lugar === esperado), `${titulo}: «${esperado}» sigue siendo el destino`);
  ok(!/no escribió ninguno/.test(linea), `${titulo}: la línea no afirma que no escribió nada`);
  ok(d.pistas.length === 0, `${titulo}: la pista redundante se cae, no se manda dos veces lo mismo`);
});

console.log("\n· el control: una pista DISTINTA se sigue mandando");
const dDistinta = pe.destinosDelViaje({ id:"c4", destination:"Bariloche" },
  [{ type:"transfer", from:"Bariloche centro", to:"Villa La Angostura", start:"2027-06-01T09:00" }]);
ok(dDistinta.lugares.some(l => l.lugar === "Bariloche"), "el destino escrito sigue ahí");
ok(dDistinta.pistas.some(l => l.lugar === "Villa La Angostura"),
   "y la pista distinta NO se cae: el filtro saca lo redundante, no todo");

console.log("\n· la línea no afirma lo que no miró");
/* Decía "no hay vuelos cargados" mirando si quedaban destinos, no si había
   vuelos. Un vuelo cargado sin destino —la app los acepta, el contrato del
   importador dice "o vacío"— la hacía mentir. */
const VUELO_MUDO = [{ type:"flight", from:"EZE", to:"", start:"2027-06-01T08:00", end:"2027-06-01T10:00" },
                    { type:"stay", address:"Hotel X, Lima", start:"2027-06-02T15:00", end:"2027-06-09T10:00" }];
const lineaMuda = pe.destinationPrompt(pe.buildPackingList({
  trip:{ id:"c5", destination:"", startDate:"2027-06-01", endDate:"2027-06-10" }, items:VUELO_MUDO }))
  .split("\n").find(l => /^- Destino/.test(l)) || "";
info(lineaMuda.slice(0, 130));
ok(!/no hay vuelos cargados/.test(lineaMuda), "con un vuelo cargado, NO dice que no hay vuelos");
ok(/no dicen adónde llegan/.test(lineaMuda), "dice lo que sí pasa: el vuelo está, sin destino");
ok(/Hotel X, Lima/.test(lineaMuda), "y la pista se manda igual");

console.log("\n· el control: sin ningún vuelo, sí dice que no hay vuelos");
const lineaSinVuelos = pe.destinationPrompt(pe.buildPackingList({
  trip:{ id:"c6", destination:"", startDate:"2027-06-01", endDate:"2027-06-10" },
  items:[{ type:"stay", address:"Hotel X, Lima", start:"2027-06-02T15:00", end:"2027-06-09T10:00" }] }))
  .split("\n").find(l => /^- Destino/.test(l)) || "";
ok(/no hay vuelos cargados/.test(lineaSinVuelos),
   "las dos frases existen y se eligen por el dato, no una sola para todo");

console.log("\n· BLOQUEANTE DE LA CUARTA RONDA · el vuelo de vuelta SIN fecha");
/* El orden por fecha es lo único que le da sentido a «el primero» y «el
   último». Un vuelo sin fecha ordena antes que todos y pasaba a definir cuál
   era casa: el descarte se comía el destino VERDADERO y dejaba el aeropuerto
   de salida. Ahora el descarte se aplica sólo si el orden es confiable. */
const VUELTA_SIN_FECHA = [
  { type:"flight", from:"EZE", to:"MAD", start:"2027-04-01T10:00", end:"2027-04-01T12:00" },
  { type:"flight", from:"MAD", to:"EZE", start:"", end:"" }
];
const dsf = pe.destinosDelViaje({ id:"c7", destination:"España" }, VUELTA_SIN_FECHA);
info("vuelta sin fecha: " + dsf.lugares.map(x=>x.lugar).join(" · "));
ok(dsf.lugares.some(l => l.lugar === "MAD"), "MAD, que es el destino de verdad, NO se pierde");
ok(dsf.deReservas, "y el viaje sigue teniendo destino en firme");

console.log("\n· el control: con las dos fechas puestas, el descarte SÍ se aplica");
const dcf = pe.destinosDelViaje({ id:"c8", destination:"España" }, [
  { type:"flight", from:"EZE", to:"MAD", start:"2027-04-01T10:00", end:"2027-04-01T12:00" },
  { type:"flight", from:"MAD", to:"EZE", start:"2027-04-10T18:00", end:"2027-04-10T20:00" }
]);
info("con fechas: " + dcf.lugares.map(x=>x.lugar).join(" · "));
ok(dcf.lugares.length === 1 && dcf.lugares[0].lugar === "MAD",
   "queda MAD sola: la regla del vuelo de vuelta sigue funcionando cuando puede");
ok(!dsf.lugares.length === false && dsf.lugares.length !== dcf.lugares.length,
   "y los dos casos dan resultados distintos: la fecha cambia el comportamiento");

console.log("\n· una lista vieja no deja la app muda");
/* `destinationPrompt` declara que puede recibir una lista armada por una
   versión anterior del motor, sin `destinos`. La guarda estaba en una línea
   y faltaba en la de al lado. */
let reventó = false;
try { pe.destinationPrompt({ base:{ destino:"Roma", destinos:null }, items:{} }); }
catch (e) { reventó = true; info("reventó con: " + e.message); }
ok(!reventó, "una lista sin `destinos` no tira una excepción");

console.log("\n· la línea NO resume cuánto dura cada tramo, y eso es a propósito");
/* Tres intentos de resumirlo costaron tres vetos seguidos —rotular por
   encadenamiento marcó las tres ciudades de un multidestino; rotular por
   duración medible marcó el único destino de una ida y vuelta; y decir
   "N días ahí" mentía cuando había un tramo por tierra—. El PM lo sacó el
   21/09 con el dato a la vista: el modelo YA recibe, más abajo en el mismo
   pedido, cada vuelo con sus horas y un renglón por cada escala con su
   duración. Todo lo que se construía acá repetía un dato que ya tenía. */
const CON_ESCALA = [
  { type:"flight", from:"EZE", to:"GRU", start:"2027-04-01T08:00", end:"2027-04-01T11:00" },
  { type:"flight", from:"GRU", to:"MAD", start:"2027-04-01T13:00", end:"2027-04-02T05:00" }
];
const promptEsc = pe.destinationPrompt(pe.buildPackingList({ trip:EUROPA, items:CON_ESCALA }));
const lineaEsc = promptEsc.split("\n").find(l => /^- Destino/.test(l)) || "";
info(lineaEsc.slice(0, 150));
ok(!/\d+ h\b|\d+ días/.test(lineaEsc), "la línea de destino no trae ningún número de tiempo");
ok(!/ahí\)/.test(lineaEsc), "ni afirma cuánto se queda en ningún lado");
ok(/puede ser sólo un cambio de avión/.test(lineaEsc),
   "pero le avisa al modelo que alguno puede ser un cambio de avión");
ok(/No lo adivines/.test(lineaEsc), "y le dice explícitamente que no lo adivine");

console.log("\n· el control: el dato que la línea ya no resume SÍ le llega al modelo");
/* Sin esto, sacar la anotación sería perder información en vez de dejar de
   repetirla. Es la premisa entera de la decisión, así que se comprueba. */
ok(/"tipo":"entre-vuelos"/.test(promptEsc), "el prompt trae un renglón por el tiempo entre dos vuelos");
ok(/"horasEnTierra":2/.test(promptEsc), "con sus horas: 2");
ok(/"origen":"EZE","destino":"GRU"/.test(promptEsc), "y cada vuelo con su origen y destino");
ok(/"desde":"2027-04-01T08:00","hasta":"2027-04-01T11:00"/.test(promptEsc),
   "y con sus horas de salida y llegada, que es de donde sale la cuenta");

console.log("\n· HALLAZGO DE LA OCTAVA RONDA · el bloque de reservas tampoco rotula");
/* La premisa con la que se tomó la decisión estaba INCOMPLETA, y lo encontró
   la auditoría mirando donde ninguna prueba miraba: el bloque de reservas,
   no la línea de destino. `summarizeReservationsForAI` venía de VAL-44
   diciendo `tipo:"escala"` sobre CUALQUIER par de vuelos encadenados, sin
   umbral. Un viaje de ida y vuelta a Madrid le mandaba al modelo trece días
   de estadía llamados escala, y el viaje del PM marcaba dos de sus tres
   ciudades. Es el mismo error de rotular por encadenamiento que esta
   historia ya cometió tres veces, vivo en otra función — y al apuntarle el
   modelo a ese bloque pasó de dormido a amplificado.

   Estas aserciones miran el prompt ENTERO, no sólo la línea de destino, que
   es lo que faltaba. */
[["ida y vuelta: 13 días en Madrid", IDA_Y_VUELTA_CON_END, "MAD", 322.5],
 ["el multidestino del PM", VUELOS, "CDG", 123]
].forEach(function (caso) {
  var titulo = caso[0], items = caso[1], ciudad = caso[2], horas = caso[3];
  var p = pe.destinationPrompt(pe.buildPackingList({ trip:EUROPA, items:items }));
  ok(!/"tipo":"escala"/.test(p), `${titulo}: ningún renglón se llama «escala»`);
  ok(p.indexOf('"ciudad":"' + ciudad + '","horasEnTierra":' + horas) >= 0,
     `${titulo}: ${ciudad} informa sus ${horas} horas, sin decir qué son`);
});

console.log("\n· el control: una escala de verdad y una estadía se ven IGUAL de rotuladas");
/* O sea: no se ven rotuladas. Si el rótulo volviera para el caso corto,
   volvería el criterio que ya falló tres veces. */
const pCorta = pe.destinationPrompt(pe.buildPackingList({ trip:EUROPA, items:CON_ESCALA }));
const pLarga = pe.destinationPrompt(pe.buildPackingList({ trip:EUROPA, items:IDA_Y_VUELTA_CON_END }));
ok(/"tipo":"entre-vuelos"/.test(pCorta) && /"tipo":"entre-vuelos"/.test(pLarga),
   "las dos usan el mismo tipo: el rótulo no depende de la duración");
ok(/"horasEnTierra":2\b/.test(pCorta) && /"horasEnTierra":322.5/.test(pLarga),
   "y lo único que las distingue es el número, que es lo único que las distingue de verdad");
ok(/entre-vuelos.*dicen cuántas horas|horas pasan en una ciudad/.test(pCorta),
   "el prompt le explica al modelo qué es ese número y que lo interprete él");

console.log("\n· el control: un multidestino DE VERDAD conserva su énfasis");
const SIN_ESCALA = [
  { type:"flight", from:"EZE", to:"MAD", start:"2027-04-01T08:00", end:"2027-04-01T23:30" },
  { type:"flight", from:"BCN", to:"FCO", start:"2027-04-06T10:00", end:"2027-04-06T12:00" }
];
const lineaMulti = pe.destinationPrompt(pe.buildPackingList({ trip:EUROPA, items:SIN_ESCALA }))
  .split("\n").find(l => /^- Destino/.test(l)) || "";
ok(/multidestino/.test(lineaMulti), "dos vuelos que no se encadenan siguen siendo dos destinos");

console.log("\n· y el caso que define el éxito de la historia NO se rompió");
ok(/multidestino/.test(linea), "Europa con MAD, CDG y FCO sigue avisando que es multidestino");
ok(/MAD/.test(linea) && /CDG/.test(linea) && /FCO/.test(linea), "y nombra las tres ciudades");

console.log("\n· EL CASO QUE VOLTEÓ LA QUINTA RONDA · ida y vuelta con hora de llegada");
/* Madrid es el destino del primer vuelo y el origen del segundo, así que
   cualquier regla basada en encadenamiento lo rotulaba como trasbordo. Sin
   rótulo, el problema no existe. */
const lineaIV2 = pe.destinationPrompt(pe.buildPackingList({ trip:EUROPA, items:IDA_Y_VUELTA_CON_END }))
  .split("\n").find(l => /^- Destino/.test(l)) || "";
info(lineaIV2.slice(0, 120));
ok(/MAD \(vuelo\)/.test(lineaIV2), "Madrid queda como destino, a secas");
ok(!/escala|ahí|trasbordo/.test(lineaIV2), "sin ningún rótulo que lo ponga en duda");
ok(!/EZE/.test(lineaIV2), "y el vuelo de vuelta sigue sin agregar tu casa");

console.log("\n· EL CASO QUE VOLTEÓ LA SEXTA RONDA · un tramo por tierra en el medio");
/* Decía "MAD, 11 días ahí" en la misma oración que mostraba el tren del día
   3. Sin resumen de tiempo no hay nada que pueda mentir. */
const POR_TIERRA = [
  { type:"flight", from:"EZE", to:"MAD", start:"2027-04-01T08:00", end:"2027-04-01T23:30" },
  { type:"transfer", from:"Madrid Atocha", to:"Lisboa Oriente", start:"2027-04-03T09:00", end:"2027-04-03T19:00" },
  { type:"flight", from:"LIS", to:"EZE", start:"2027-04-12T18:00", end:"2027-04-13T06:00" }
];
const lineaTierra = pe.destinationPrompt(pe.buildPackingList({
  trip:{ id:"c10", destination:"Península Ibérica", startDate:"2027-04-01", endDate:"2027-04-13" },
  items:POR_TIERRA })).split("\n").find(l => /^- Destino/.test(l)) || "";
info(lineaTierra.slice(0, 150));
ok(!/días ahí/.test(lineaTierra), "no afirma días en Madrid que la persona pasó en Lisboa");
ok(/Lisboa Oriente/.test(lineaTierra), "y el tren se manda igual, como pista");

console.log("\n· EL CASO QUE VOLTEÓ LA SÉPTIMA RONDA · vuelo del medio sin hora de llegada");
/* `end` no es obligatorio en un vuelo. Las frases que dependían de poder
   medir el tiempo mentían acá; sin ellas, no hay nada que mienta. */
const VUELO_DEL_MEDIO_SIN_LLEGADA = [
  { type:"flight", from:"EZE", to:"MAD", start:"2027-04-01T08:00", end:"2027-04-01T20:00" },
  { type:"flight", from:"MAD", to:"CDG", start:"2027-04-08T09:00" },
  { type:"flight", from:"CDG", to:"FCO", start:"2027-04-17T09:00", end:"2027-04-17T11:00" }
];
const lineaMedio = pe.destinationPrompt(pe.buildPackingList({ trip:EUROPA, items:VUELO_DEL_MEDIO_SIN_LLEGADA }))
  .split("\n").find(l => /^- Destino/.test(l)) || "";
info(lineaMedio.slice(0, 130));
ok(/MAD \(vuelo\) · CDG \(vuelo\) · FCO \(vuelo\)/.test(lineaMedio),
   "los tres destinos entran igual, con o sin hora de llegada");
ok(!/no hay vuelo después|no se pudo medir/.test(lineaMedio),
   "y no queda ninguna frase sobre medir tiempos que pueda ser falsa");


console.log("\n· fechas invertidas: declarado, no resuelto");
/* Si el vuelo de vuelta quedó cargado con una fecha ANTERIOR a la de ida, el
   orden se invierte, el descarte se come el destino real y queda el
   aeropuerto de casa. No es determinable desde los datos: un MAD→EZE→MAD es
   exactamente lo que carga alguien que vive en Madrid. Queda escrito para
   que no se descubra como sorpresa; `ordenConfiable` cubre la fecha que
   FALTA, no la fecha equivocada. */
const INVERTIDAS = [
  { type:"flight", from:"EZE", to:"MAD", start:"2027-04-10T08:00", end:"2027-04-10T23:30" },
  { type:"flight", from:"MAD", to:"EZE", start:"2027-04-01T10:00", end:"2027-04-02T06:00" }
];
const dInv = pe.destinosDelViaje({ id:"c13", destination:"Madrid" }, INVERTIDAS);
info("con las fechas al revés: " + dInv.lugares.map(x=>x.lugar).join(" · "));
ok(dInv.lugares.some(l => l.lugar === "EZE"),
   "con las fechas invertidas queda EZE, y es el alcance conocido, no un bug oculto");


console.log("\n· reservas a las que les falta un campo: nada revienta y nada se inventa");
/* El mecanismo de abajo exige que exista un caso SIN cada campo que el motor
   lee. Estos son esos casos, y valen por sí mismos: son lo que queda cuando
   alguien carga una reserva a medias y se va. */
const INCOMPLETAS = [
  { type:"stay", start:"2027-05-01T15:00", end:"2027-05-08T10:00" },          // sin dirección
  { type:"stay", address:"Hotel sin fechas, Lima" },                           // sin check-in ni check-out
  { type:"transfer", from:"Centro", start:"2027-05-02T09:00" },                // sin "hasta"
  { type:"transfer", from:"Centro", to:"Aeropuerto" },                         // sin fecha
  { type:"car", start:"2027-05-03T09:00", end:"2027-05-06T09:00" },            // sin lugar de retiro
  { type:"car", address:"Rentadora del centro" }                               // sin retiro ni devolución
];
let revento = false;
let dInc = null;
try { dInc = pe.destinosDelViaje({ id:"c14", destination:"Lima" }, INCOMPLETAS); }
catch (e) { revento = true; info("reventó: " + e.message); }
ok(!revento, "seis reservas a medias no tiran ninguna excepción");
ok(dInc && dInc.lugares.some(l => l.lugar === "Lima"), "el destino escrito sigue mandando");
ok(dInc && dInc.pistas.length === 3,
   `sólo las que tienen lugar entran como pista (${dInc && dInc.pistas.length}): las otras tres no se inventan`);
const lineaInc = pe.destinationPrompt(pe.buildPackingList({
  trip:{ id:"c14", destination:"Lima", startDate:"2027-05-01", endDate:"2027-05-10" }, items:INCOMPLETAS }))
  .split("\n").find(l => /^- Destino/.test(l)) || "";
ok(!/undefined|null|NaN/.test(lineaInc), "y la línea no muestra «undefined» ni «NaN» por los campos que faltan");

console.log("\n· las notas de una reserva llegan al modelo, y saneadas");
/* El mecanismo de abajo pidió un caso CON notas en los cuatro tipos y no
   había ninguno: 33 fixtures de vuelo y cero con el campo que la persona usa
   para escribir lo que no entra en ningún otro lado. Las notas alimentan el
   prompt por `summarizeReservationsForAI` y el tipo de viaje por la bolsa de
   lo reservado, así que no tenerlas en ningún fixture dejaba sin cubrir dos
   caminos enteros. */
const CON_NOTAS = [
  { type:"flight", from:"EZE", to:"MAD", start:"2027-04-01T08:00", end:"2027-04-01T23:30",
    notes:"Asiento de ventanilla, equipaje de mano solamente" },
  { type:"stay", address:"Calle Atocha 123, Madrid", start:"2027-04-01T15:00", end:"2027-04-06T10:00",
    notes:"No tiene lavandería en el edificio" },
  { type:"transfer", from:"Atocha", to:"Centro", start:"2027-04-02T09:00", end:"2027-04-02T10:00",
    notes:"Sale del andén 4" },
  { type:"car", address:"Aeropuerto T4", start:"2027-04-03T09:00", end:"2027-04-05T09:00",
    notes:"Caja manual, hay que devolverlo con tanque lleno" }
];
const promptNotas = pe.destinationPrompt(pe.buildPackingList({ trip:EUROPA, items:CON_NOTAS }));
ok(/lavandería/.test(promptNotas), "la nota del alojamiento llega al modelo");
ok(/ventanilla/.test(promptNotas), "y la del vuelo también");
ok(/tanque lleno/.test(promptNotas), "y la del auto");
ok(/andén 4/.test(promptNotas), "y la del traslado, que era la que faltaba");

console.log("\n· un traslado ES una reserva, y hasta acá no llegaba al modelo");
/* `summarizeReservationsForAI` resumía vuelo, alojamiento, auto y actividad,
   y saltaba el quinto tipo que la app deja cargar. Un viaje con sólo un
   traslado le decía al modelo "(todavía no hay reservas cargadas)" teniendo
   una reserva cargada. Faltaba desde VAL-44 y lo encontró la auditoría de
   confirmación preguntando por qué yo había declarado que el prompt lee
   `transfer.notes`: no lo leía, y la aserción que lo respaldaba pasaba
   mirando el archivo de pruebas en vez de mirar el prompt. */
const SOLO_TRASLADO_CON_NOTA = [
  { type:"transfer", from:"Madrid Atocha", to:"Lisboa Oriente",
    start:"2027-04-03T09:00", end:"2027-04-03T19:00", notes:"Sale del andén 4" }
];
const resumen = pe.summarizeReservationsForAI(EUROPA, SOLO_TRASLADO_CON_NOTA);
info("resumen: " + JSON.stringify(resumen));
ok(resumen.length === 1, `el traslado entra al resumen de reservas (${resumen.length})`);
ok(resumen[0].tipo === "traslado", "con su propio tipo");
ok(resumen[0].origen === "Madrid Atocha" && resumen[0].destino === "Lisboa Oriente",
   "con de dónde sale y adónde llega");
const pSoloTras = pe.destinationPrompt(pe.buildPackingList({ trip:EUROPA, items:SOLO_TRASLADO_CON_NOTA }));
ok(!/no hay reservas cargadas/.test(pSoloTras),
   "y el prompt deja de decir que no hay reservas teniendo una cargada");
ok(/andén 4/.test(pSoloTras), "la nota del traslado llega al modelo");

console.log("\n· las actividades también llegan, y este arnés no tenía ninguna");
/* Ni un solo fixture de actividad en todo el archivo, y el resumen lee su
   fecha, su título y sus notas. Lo pidió el mecanismo al sumar `act` a la
   lista de campos leídos. */
const ACTIVIDADES = [
  { type:"act", start:"2027-04-04T10:00", title:"Buceo en la costa", notes:"Llevar certificación" },
  { type:"act", title:"Cena con Ana" },                       // sin fecha ni notas
  { type:"act", start:"2027-04-06T20:00", notes:"Sin título" } // sin título
];
const pActs = pe.destinationPrompt(pe.buildPackingList({ trip:EUROPA, items:ACTIVIDADES }));
ok(/Buceo en la costa/.test(pActs), "el título de la actividad llega al modelo");
ok(/Llevar certificación/.test(pActs), "y su nota también");
let revientaAct = false;
try { pe.summarizeReservationsForAI(EUROPA, ACTIVIDADES); } catch (e) { revientaAct = true; }
ok(!revientaAct, "una actividad sin fecha y otra sin título no revientan el resumen");

console.log("\n· NADA se cae al piso: una nota llega, y un tipo futuro también");
/* La app deja cargar SEIS tipos de reserva y el resumen tenía cinco `filter`.
   Una nota —"comprar adaptador de enchufe, el tipo F"— no llegaba nunca, que
   es justo la clase de dato para la que existe esta función. Y la ronda
   anterior arregló el traslado, que faltaba por lo mismo, sin preguntar por
   el vecino: el mismo error tres veces en esta historia.

   El arreglo no fue agregar un sexto `filter` —el séptimo se caería igual—
   sino que lo que no tenga bloque propio salga de todos modos. */
const UNA_NOTA = [{ type:"note", title:"Comprar adaptador de enchufe",
                    start:"2027-04-01T09:00", notes:"El tipo F, que usan allá" }];
const rNota = pe.summarizeReservationsForAI(EUROPA, UNA_NOTA);
info("nota: " + JSON.stringify(rNota));
ok(rNota.length === 1, "la nota entra al resumen");
ok(/adaptador/.test(rNota[0].titulo), "con su título");
ok(/tipo F/.test(rNota[0].notas), "y su texto");
const pNota = pe.destinationPrompt(pe.buildPackingList({ trip:EUROPA, items:UNA_NOTA }));
ok(!/no hay reservas cargadas/.test(pNota),
   "y el prompt deja de decir que no hay reservas teniendo una nota cargada");

console.log("\n· una nota a medias: sin título o sin texto");
/* El mecanismo pidió el caso SIN cada campo. Una nota sin título es lo que
   queda cuando alguien escribe rápido y se va. */
const NOTAS_A_MEDIAS = [
  { type:"note", start:"2027-04-02T09:00", notes:"Sin título, sólo el texto" },
  { type:"note", title:"Sin texto, sólo el título" }
];
let revientaNota = false;
let rMedias = null;
try { rMedias = pe.summarizeReservationsForAI(EUROPA, NOTAS_A_MEDIAS); }
catch (e) { revientaNota = true; info("reventó: " + e.message); }
ok(!revientaNota, "una nota sin título y otra sin texto no revientan el resumen");
ok(rMedias && rMedias.length === 2, "las dos entran igual");
ok(rMedias && rMedias[0].titulo === "", "la que no tiene título llega con el título vacío, no con «undefined»");

console.log("\n· el control: un tipo que todavía no existe tampoco se cae");
/* Esto es lo que distingue el arreglo de clase del arreglo de instancia: si
   sólo se hubiera agregado un `filter` para `note`, este caso fallaría. */
const TIPO_FUTURO = [{ type:"crucero", title:"Barco a Mallorca",
                       start:"2027-04-05T09:00", notes:"Sale del puerto" }];
const rFut = pe.summarizeReservationsForAI(EUROPA, TIPO_FUTURO);
ok(rFut.length === 1 && rFut[0].tipo === "crucero",
   "un tipo que el motor no conoce llega igual, con su propio nombre");
ok(/Mallorca/.test(rFut[0].titulo), "y con su título, en vez de desaparecer en silencio");

console.log("\n· ninguna reserva sale DOS veces");
/* La primera versión de la rama genérica se guardaba de duplicar con otra
   lista de tipos escrita a mano —la misma fragilidad que decía haber
   erradicado, un nivel más adentro—. La auditoría la saboteó sacando `act`
   de esa lista y la reserva salió dos veces. Ahora la guarda no es una lista
   sino el hecho: se anota cada ítem que ya salió. */
const UNO_DE_CADA = [
  { type:"flight", from:"EZE", to:"MAD", start:"2027-04-01T08:00", end:"2027-04-01T20:00" },
  { type:"stay", address:"Hotel", start:"2027-04-01T15:00", end:"2027-04-05T10:00" },
  { type:"car", address:"T4", start:"2027-04-02T09:00", end:"2027-04-04T09:00" },
  { type:"transfer", from:"A", to:"B", start:"2027-04-02T07:00", end:"2027-04-02T08:00" },
  { type:"act", title:"Museo", start:"2027-04-03T10:00" },
  { type:"note", title:"Adaptador", start:"2027-04-01T09:00" },
  { type:"crucero", title:"Barco", start:"2027-04-06T09:00" }
];
const rTodos = pe.summarizeReservationsForAI(EUROPA, UNO_DE_CADA);
info("tipos: " + rTodos.map(x => x.tipo).join(", "));

/* SE CUENTA, no se comparan firmas. La primera versión de esta aserción
   miraba si había dos entradas con el mismo JSON, y un duplicado NUNCA tiene
   el mismo JSON: la copia sale por la rama genérica con el nombre crudo del
   tipo (`act`) y la original con el rótulo (`actividad`). La auditoría la
   saboteó quitándole el `push` a un bloque y las tres aserciones quedaron en
   verde con el duplicado a la vista, impreso en la línea de arriba.
   Es la trampa que este proyecto ya tiene escrita dos veces: un control que
   no falla cuando el sabotaje llega no es un control. Lo único que no se
   puede falsear es el total. */
const conVuelos = rTodos.filter(x => x.tipo !== "entre-vuelos");
ok(conVuelos.length === UNO_DE_CADA.length,
   `sale UNA entrada por reserva y ninguna de más: ${conVuelos.length} de ${UNO_DE_CADA.length}`);
ok(rTodos.filter(x => x.tipo === "actividad" || x.tipo === "act").length === 1,
   "la actividad sale una sola vez, con su rótulo o con su nombre crudo");
ok(rTodos.some(x => x.tipo === "crucero"), "y el tipo inventado sale igual, por la rama de al final");

console.log("\n· una nota y un traslado se citan por su nombre, no como «la reserva»");
/* `findFactSource` busca palabras clave en CUALQUIER ítem sin filtrar por
   tipo, así que una nota podía terminar citada como "la reserva" genérico:
   al mapa de rótulos le faltaban justo `transfer` y `note`, los dos tipos
   que costaron esta historia entera. Lo encontró la auditoría barriendo por
   la FORMA del bug —un objeto con claves de tipo mantenido a mano— en vez de
   por la función tocada. Se prueba por el camino público, no por la
   función suelta. */
const viajeCiudad = { id:"c20", name:"Madrid", destination:"Madrid",
                      startDate:"2027-05-05", endDate:"2027-05-10" };
const listaCiudad = pe.buildPackingList({ trip:viajeCiudad, items:[], tipoViaje:"ciudad" });
[["la nota", { id:"n1", type:"note", title:"Día de playa en Valencia", start:"2027-05-08T10:00" }, /la nota/],
 ["el traslado", { id:"x1", type:"transfer", from:"Madrid", to:"Valencia",
                   start:"2027-05-08T08:00", notes:"vamos a la playa" }, /el traslado/]
].forEach(function (caso) {
  const r = pe.planListUpdate({ list:listaCiudad, trip:viajeCiudad, items:[caso[1]], tipoViaje:"ciudad" });
  const citas = [...new Set((r.nuevos || []).map(n => n.reserva).filter(Boolean))];
  info(caso[0] + " → " + JSON.stringify(citas));
  ok(citas.length > 0, `${caso[0]}: el motor cita la reserva que motivó el ítem`);
  ok(citas.some(c => caso[2].test(c)), `${caso[0]}: la cita la nombra por lo que es`);
  ok(!citas.some(c => /^la reserva/.test(c)), `${caso[0]}: y NO la llama «la reserva» genérico`);
});

console.log("\n· el control: lo que se cae al piso también se sanea");
const rSens = pe.summarizeReservationsForAI(EUROPA,
  [{ type:"note", title:"Pagar", notes:"tarjeta 4111 1111 1111 1111" }]);
ok(!/4111/.test(JSON.stringify(rSens)), "el camino nuevo pasa por el mismo saneo que los otros cinco");

console.log("\n· un traslado sin origen cargado tampoco revienta");
/* El mecanismo pidió un caso SIN `from`, que es un campo que el formulario
   marca como requerido pero la app acepta vacío igual. */
const TRASLADO_SIN_ORIGEN = [{ type:"transfer", to:"Centro", start:"2027-04-02T09:00", end:"2027-04-02T10:00" }];
const rSinOrig = pe.summarizeReservationsForAI(EUROPA, TRASLADO_SIN_ORIGEN);
ok(rSinOrig.length === 1 && rSinOrig[0].origen === "", "entra igual, con el origen vacío");
ok(rSinOrig[0].destino === "Centro", "y conserva el destino, que es lo que sí se cargó");

console.log("\n· el control: la nota del traslado también se sanea");
const pTrasSens = pe.destinationPrompt(pe.buildPackingList({ trip:EUROPA, items:[
  { type:"transfer", from:"A", to:"B", start:"2027-04-02T09:00", end:"2027-04-02T10:00",
    notes:"Llamar al 11 5555 4444 antes de salir" } ] }));
ok(!/11 5555 4444/.test(pTrasSens), "el teléfono de una nota de traslado no llega al modelo");

console.log("\n· el control: una nota con un dato sensible NO llega");
/* `sanitizeNotesForAI` existe desde VAL-44 y ningún fixture de este arnés la
   ejercitaba. Si dejara de sanear, todo lo de arriba pasaría igual. */
const NOTA_SENSIBLE = [{ type:"stay", address:"Hotel, Madrid", start:"2027-04-01T15:00",
                         end:"2027-04-06T10:00", notes:"Llamar al 11 5555 4444 y pagar con la 4111 1111 1111 1111" }];
const promptSens = pe.destinationPrompt(pe.buildPackingList({ trip:EUROPA, items:NOTA_SENSIBLE }));
ok(!/4111 1111 1111 1111/.test(promptSens), "el número de tarjeta no llega al modelo");
ok(!/11 5555 4444/.test(promptSens), "ni el teléfono");

/* MECANISMO, NO PROMESA — SEGUNDA VERSIÓN, porque la primera aseguraba algo
   falso. Decía «end, que la app siempre escribe» y `end` NO es obligatorio en
   un vuelo: no está en `REQUIRED.flight` y el campo "Llega" se dibuja sin la
   marca de requerido. La aserción, escrita desde esa creencia, PROHIBÍA el
   único fixture que habría encontrado el defecto de esta ronda — un vuelo del
   medio sin hora de llegada—. Convertir una regla en aserción estuvo bien; se
   convirtió la regla equivocada, y una aserción escrita desde una creencia
   sólo puede darle la razón a quien la escribió.

   Lo que sí se puede afirmar sin creer nada: **de cada campo que el motor
   LEE tiene que haber un caso con y un caso sin.** Eso no sale de una
   suposición sobre el formulario; sale de abrir la función y ver qué toca.
   Y `CLAUDE.md` ya lo decía con esas palabras: "si un campo es opcional,
   tiene que haber un caso con y un caso sin". */
console.log("\n· de cada campo que el motor lee hay un caso con y un caso sin");
(function () {
  const fuente = fs.readFileSync(__filename, "utf8");
  /* Campos que el prompt lee de cada tipo de reserva. Salen de abrir las
     funciones, no de recordar el formulario.

     La primera versión de esta lista cubría sólo `destinosDelViaje`, y la
     novena auditoría preguntó por qué no `summarizeReservationsForAI` — que
     es justo la función donde vivía el defecto de la ronda anterior. La
     respuesta honesta era "porque no se me ocurrió", así que se extendió:
     `notes` entra por ahí, en los cuatro tipos. */
  /* EL UNIVERSO DE TIPOS SALE DE LA APP, no de una lista escrita a mano acá.
     A la lista a mano le faltó `transfer`, después `act`, después `note`:
     tres veces el mismo error, y la tercera en el commit cuyo título hablaba
     de las dos anteriores. Una lista que hay que acordarse de completar no
     sirve; ésta se lee del `TYPES` de la app y falla sola si mañana aparece
     un séptimo tipo sin fixtures. */
  const bloqueTypes = html.slice(html.indexOf("const TYPES = {"));
  const TIPOS_DE_LA_APP = (bloqueTypes.slice(0, bloqueTypes.indexOf("\n};"))
    .match(/^\s*([a-z]+)\s*:\s*\{label:/gm) || []).map(l => l.trim().split(/\s*:/)[0]);
  ok(TIPOS_DE_LA_APP.length >= 6,
     `la app declara ${TIPOS_DE_LA_APP.length} tipos de reserva: ${TIPOS_DE_LA_APP.join(", ")}`);

  const LEE = {
    flight:   ["from", "to", "start", "end", "notes"],
    stay:     ["address", "start", "end", "notes"],
    transfer: ["from", "to", "start", "end", "notes"],
    car:      ["address", "start", "end", "notes"],
    act:      ["start", "title", "notes"],
    note:     ["start", "title", "notes"]
  };
  const sinCubrir = TIPOS_DE_LA_APP.filter(t => !LEE[t]);
  ok(sinCubrir.length === 0,
     sinCubrir.length ? `tipos que la app declara y este arnés no cubre: ${sinCubrir.join(", ")}`
                      : "todos los tipos que la app declara tienen fixtures acá");
  Object.keys(LEE).forEach(function (tipo) {
    const re = new RegExp('\\{[^{}]*type:"' + tipo + '"[^{}]*\\}', "g");
    const fixtures = fuente.match(re) || [];
    ok(fixtures.length > 0, `hay fixtures de «${tipo}» (${fixtures.length})`);
    LEE[tipo].forEach(function (campo) {
      const conValor = fixtures.filter(f => new RegExp('\\b' + campo + ':"[^"]+"').test(f)).length;
      const sinValor = fixtures.filter(f => !new RegExp('\\b' + campo + ':"[^"]+"').test(f)).length;
      ok(conValor > 0 && sinValor > 0,
         `${tipo}.${campo}: ${conValor} con valor y ${sinValor} sin` +
         (conValor && sinValor ? "" : " — falta el caso que no está"));
    });
  });
})();

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
