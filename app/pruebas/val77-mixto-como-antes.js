/* ============================================================
   VAL-77a — UNA LISTA GUARDADA QUE DICE "mixto" SE COMPORTA
             EXACTAMENTE COMO ANTES

   El brief lo pide con todas las letras y aclara que "eso es una prueba,
   no una intención". Así que acá no se afirma nada sobre el motor: se
   compara contra un MAESTRO capturado del motor ANTERIOR al cambio.

   CÓMO SE CAPTURÓ EL MAESTRO, para que se pueda repetir:

       git show <commit anterior a VAL-77a>:app/parts/packing-engine.js > /tmp/base.js
       node -e "const E=require('/tmp/base.js'); ...buildPackingList con
                el VIAJE y las RESERVAS de acá, tipoViaje:'mixto',
                now fijo... imprimir [clave, cantidad, motivo] ordenado"

   No es el resultado que yo creo que tiene que dar: es el que daba.

   EL FIXTURE SE ESCRIBIÓ LEYENDO EL FORMULARIO, no de memoria (§ CLAUDE.md).
   Los campos salen de `sheetItem` en app/valija.html:
     · vuelo       — from (Origen IATA), to (Destino IATA), start (Sale),
                     end (Llega, OPCIONAL), provider, flightNumber,
                     confirmation, seat
     · alojamiento — start (Check-in), end (Check-out), provider, address,
                     confirmation, phone
     · auto        — start (Retiro), end (Devolución), provider,
                     address (Lugar de retiro), confirmation
     · traslado    — from (Desde), to (Hasta), start (Fecha y hora), provider
     · nota        — notes
   Todas las fechas son `datetime-local`, nunca una fecha pelada. Del campo
   opcional que el motor lee —la hora de LLEGADA de un vuelo— hay un caso
   CON (el vuelo de ida) y un caso SIN (el de vuelta).

   EL CONTROL NEGATIVO: el mismo maestro comparado contra una lista de
   `montana`. Si la comparación estuviera rota —si diera "igual" siempre—
   ese caso pasaría, y por eso está.

       NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/val77-mixto-como-antes.js
   ============================================================ */
"use strict";
const path = require("path");
const E = require(path.resolve(__dirname, "..", "parts", "packing-engine.js"));

let fallos = 0;
const ok   = (c, m) => { console.log((c ? "  ok    " : "  FALLA ") + m); if (!c) fallos++; };
const info = m => console.log("  info   " + m);

/* ---------- el fixture ---------- */
const VIAJE = {
  id:"t-mixto", name:"Escapada larga", destination:"Madrid",
  startDate:"2027-03-05", endDate:"2027-03-15", hue:214, travelers:"Tomás y Ana"
};
const RESERVAS = [
  { id:"r1", type:"flight", title:"Vuelo de ida", from:"EZE", to:"MAD",
    start:"2027-03-05T22:10", end:"2027-03-06T14:35",
    provider:"Iberia", flightNumber:"IB 6844", confirmation:"XKD9P2", seat:"14A" },
  { id:"r2", type:"flight", title:"Vuelo de vuelta", from:"MAD", to:"EZE",
    start:"2027-03-15T12:00", end:"",                         // sin hora de llegada: es opcional
    provider:"Iberia", flightNumber:"IB 6843", confirmation:"XKD9P3" },
  { id:"r3", type:"lodging", title:"Hotel Atocha",
    start:"2027-03-06T15:00", end:"2027-03-15T10:00",
    provider:"Booking · Hotel Atocha", address:"Calle Atocha 123, Madrid",
    confirmation:"BK-88123", phone:"+34 911 22 33 44" },
  { id:"r4", type:"car", title:"Auto en Madrid",
    start:"2027-03-08T10:00", end:"2027-03-12T10:00",
    provider:"Hertz", address:"Aeropuerto de Madrid T4", confirmation:"HZ-77" },
  { id:"r5", type:"transfer", title:"Traslado al hotel",
    from:"Aeropuerto T4", to:"Calle Atocha 123", start:"2027-03-06T15:30",
    provider:"Cabify" },
  { id:"r6", type:"note", title:"Nota", notes:"Vamos dos días al Guadarrama a caminar." }
];
const AT = "2027-01-10T12:00:00.000Z";

/* ---------- el maestro: lo que daba el motor ANTES de VAL-77a ---------- */
const MAESTRO_MIXTO = [
  ["adaptador-de-enchufe",null,"Viaje internacional: el enchufe del destino puede no ser el de acá."],
  ["auricular",null,"Para el vuelo, el colectivo y la espera."],
  ["bateria-portatil",null,"En el equipaje de mano: no se puede despachar."],
  ["bolsa-para-la-ropa-sucia",null,"Separa lo usado de lo limpio y te ahorra clasificar al volver."],
  ["botella-reutilizable",null,"Se llena después del control de seguridad y en el alojamiento."],
  ["botiquin-basico",null,"Analgésico, curitas, antiséptico y algo para el estómago. Ocupa poco y siempre se usa."],
  ["buzo-o-abrigo-liviano",2,"Las noches bajan de temperatura en casi cualquier destino."],
  ["celular-y-cargador",null,"Es el pasaje, el mapa y la cámara."],
  ["cepillo-y-pasta-de-dient",null,"Lo más olvidado de la lista."],
  ["copia-de-las-reserva",null,"Descargadas o impresas: siguen sirviendo con el celular sin batería."],
  ["desodorante",null,"Uno por viaje, del tamaño chico."],
  ["dni",null,"Siempre, aunque el viaje sea en auto y a cien kilómetros."],
  ["efectivo-en-moneda-local",null,"Para el primer traslado y las propinas, antes de encontrar un cajero."],
  ["licencia-de-conducir",null,"Tenés un auto alquilado en el viaje."],
  ["licencia-de-conducir-internacional",null,"Auto alquilado en el exterior: muchos países la piden junto con la nacional."],
  ["liquido-de-hasta-100-ml",null,"Hay vuelo: si llevás equipaje de mano, ese es el límite por envase."],
  ["media",10,"10 pares: con 11 días vas a lavar igual."],
  ["medicacion-personal",null,"Con la receta y en el equipaje de mano, por si la valija se pierde."],
  ["neceser-armado",null,"Todo junto en un solo lugar: es lo primero que se busca al llegar."],
  ["pantalon",4,"Uno cada tres días de viaje, sobre 11 días."],
  ["pasaporte",null,"Viaje internacional. Revisá que la vigencia cubra seis meses después de la vuelta."],
  ["pijama",2,"Uno por semana de viaje."],
  ["remera",8,"Con 11 días no tiene sentido una por día: 8 y lavás en el viaje."],
  ["ropa-interior",10,"10 juegos: con 11 días vas a lavar igual."],
  ["seguro-de-viaje",null,"Varios países lo piden en migraciones y la atención médica afuera se paga en dólares."],
  ["shampoo-y-jabon",null,"En envases chicos: casi todos los alojamientos tienen los suyos."],
  ["tarjeta-de-debito-y-credito",null,"Guardadas en dos lugares distintos, no las dos en la misma billetera."],
  ["un-par-para-salir",null,"Algo que no sean las zapatillas de caminar todo el día."],
  ["una-muda-para-salir-de-noche",null,"Para la cena o la salida que no estaba planeada."],
  ["visa-o-autorizacion-electronica",null,"Fijate si tu pasaporte necesita visa o permiso electrónico para este destino."],
  ["zapatilla-comoda",null,"El par que ya tenés usado. Un viaje no es para estrenar calzado."]
];

const foto = tipo => E.itemsArray(
  E.buildPackingList({ trip:VIAJE, items:RESERVAS, tipoViaje:tipo, now:AT })
).map(i => [i.clave, i.cantidad, i.motivo]).sort((a, b) => a[0].localeCompare(b[0]));

const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function primeraDiferencia(a, b) {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) if (!igual(a[i], b[i])) return `[${i}] ahora=${JSON.stringify(a[i])} antes=${JSON.stringify(b[i])}`;
  return "ninguna";
}

console.log("\n· la lista guardada que dice \"mixto\"");
const lMixto = E.buildPackingList({ trip:VIAJE, items:RESERVAS, tipoViaje:"mixto", now:AT });
ok(lMixto.tipoViaje === "mixto", `el tipo guardado sigue siendo "mixto" (${lMixto.tipoViaje})`);
ok(lMixto.base.tipoViajeFuente === "elegido", "y sigue contando como elegido, no como sugerido");
ok(igual(E.tripTypeParts("mixto"), ["mixto"]),
   `tripTypeParts("mixto") = ${JSON.stringify(E.tripTypeParts("mixto"))}`);
ok(E.canonicalTripType("mixto") === "mixto", "y su forma canónica sigue siendo \"mixto\"");
ok(E.normalizeTripType("mixto") === "mixto", "normalizeTripType(\"mixto\") no cambió");

const ahora = foto("mixto");
info(`la lista tiene ${ahora.length} ítems; el maestro, ${MAESTRO_MIXTO.length}`);
ok(igual(ahora, MAESTRO_MIXTO),
   "ítem por ítem —clave, cantidad y motivo— da EXACTAMENTE lo mismo que antes de VAL-77a. " +
   (igual(ahora, MAESTRO_MIXTO) ? "" : "Primera diferencia: " + primeraDiferencia(ahora, MAESTRO_MIXTO)));

console.log("\n· el control: si la comparación estuviera rota, esto pasaría igual");
const otraFoto = foto("montana");
ok(!igual(otraFoto, MAESTRO_MIXTO),
   `una lista de montaña NO coincide con el maestro de mixto (${otraFoto.length} ítems contra ${MAESTRO_MIXTO.length})`);

console.log("\n· las reglas que nombran \"mixto\" siguen matcheando");
const clavesMixto = ahora.map(x => x[0]);
ok(clavesMixto.indexOf("un-par-para-salir") >= 0,
   "\"Un par para salir\" —regla tripTypes:[\"ciudad\",\"mixto\"]— sigue entrando");
ok(clavesMixto.indexOf("una-muda-para-salir-de-noche") >= 0,
   "\"Una muda para salir de noche\" —regla tripTypes:[\"ciudad\",\"playa\",\"mixto\"]— sigue entrando");

console.log("\n· dos tipos: las reglas de los dos SUMAN");
const claves = t => E.itemsArray(
  E.buildPackingList({ trip:VIAJE, items:RESERVAS, tipoViaje:t, now:AT })
).map(i => i.clave).sort();
const soloMontana = claves("montana"), soloCiudad = claves("ciudad"), combinado = claves("montana+ciudad");
const union = [...new Set([...soloMontana, ...soloCiudad])].sort();
info(`montaña ${soloMontana.length} · ciudad ${soloCiudad.length} · montaña+ciudad ${combinado.length} · unión ${union.length}`);
ok(igual(combinado, union), "montaña+ciudad da exactamente la unión de las dos, ni un ítem de más ni de menos");
ok(soloMontana.indexOf("bota-o-zapatilla-de-trekking") >= 0 && combinado.indexOf("bota-o-zapatilla-de-trekking") >= 0,
   "entra lo propio de montaña");
ok(soloCiudad.indexOf("bota-o-zapatilla-de-trekking") < 0,
   "control: las botas de trekking NO entran en un viaje de ciudad a secas");
ok(soloCiudad.indexOf("un-par-para-salir") >= 0 && combinado.indexOf("un-par-para-salir") >= 0,
   "y entra lo propio de ciudad");
ok(soloMontana.indexOf("un-par-para-salir") < 0,
   "control: \"Un par para salir\" NO entra en un viaje de montaña a secas — si entrara, la aserción de arriba no probaría nada");

console.log("\n· el string guardado es canónico y estable");
ok(E.canonicalTripType("ciudad+montana") === E.canonicalTripType("montana+ciudad"),
   `"ciudad+montana" y "montana+ciudad" dan la misma forma canónica (${E.canonicalTripType("montana+ciudad")})`);
ok(igual(claves("ciudad+montana"), claves("montana+ciudad")),
   "y la lista que sale es la misma, venga escrita en el orden que venga");
const lComb = E.buildPackingList({ trip:VIAJE, items:RESERVAS, tipoViaje:"montana+ciudad", now:AT });
ok(lComb.tipoViaje === "ciudad+montana",
   `lo que se GUARDA es la forma canónica, no lo que se tocó primero (${lComb.tipoViaje})`);

console.log("\n· el parser no trunca: el tope de dos lo pone la interfaz");
ok(E.tripTypeParts("playa+ciudad+montana").length === 3,
   `tripTypeParts devuelve las tres partes que encuentra (${JSON.stringify(E.tripTypeParts("playa+ciudad+montana"))})`);

console.log("\n· lo que no se entiende no se inventa");
ok(E.canonicalTripType("") === null, "vacío da null");
ok(E.canonicalTripType(null) === null, "null da null");
ok(E.canonicalTripType("cualquier+cosa") === null, "basura da null, no un tipo inventado");
ok(igual(E.tripTypeParts("montana+montana"), ["montana"]), "una parte repetida no se cuenta dos veces");
ok(E.tripTypeLabel("montana+ciudad") === "Montaña y ciudad",
   `la etiqueta se lee como una frase: "${E.tripTypeLabel("montana+ciudad")}"`);
ok(E.tripTypeLabel("mixto") === "Mixto", "y \"mixto\" se sigue leyendo \"Mixto\"");

/* Esta sección decía "limitación declarada de 77a" y exigía que un viaje de
   montaña a secas NO contara para un montaña+ciudad. VAL-77b cierra
   exactamente esa limitación, así que la aserción se da vuelta: ahora cuentan,
   porque un ítem sin parte declarada en un viaje de UNA parte se cuenta para
   esa parte. Lo que no cambia —la misma combinación sigue contando— queda
   aseverado igual que antes. El detalle está en val77b-superconjunto.js. */
console.log("\n· el aprendizaje: la misma combinación cuenta, y desde VAL-77b también sus partes sueltas");
const viajeAnterior = (tipo) => ({
  version:E.VERSION, tipoViaje:tipo,
  /* Un ítem que NINGUNA regla base pone: si lo pusiera una regla, la
     precedencia le dejaría el motivo de la regla y el motivo aprendido —que es
     lo que esta parte mira— no se vería nunca. */
  items:{ "buzo-polar":{ clave:"buzo-polar", nombre:"Buzo polar",
    categoria:"ropa", origen:"manual", estado:"pendiente" } }
});
const conCombo = E.buildPackingList({
  trip:VIAJE, items:RESERVAS, tipoViaje:"montana+ciudad", now:AT,
  history:[viajeAnterior("montana+ciudad"), viajeAnterior("ciudad+montana")]
});
ok(conCombo.aprendizaje.muestra === 2,
   `dos viajes montaña+ciudad cuentan como muestra aunque uno esté escrito al revés (${conCombo.aprendizaje.muestra})`);
const conSueltos = E.buildPackingList({
  trip:VIAJE, items:RESERVAS, tipoViaje:"montana+ciudad", now:AT,
  history:[viajeAnterior("montana"), viajeAnterior("ciudad")]
});
ok(conSueltos.aprendizaje.muestra === 2,
   `y desde VAL-77b los de montaña o ciudad a secas también cuentan (${conSueltos.aprendizaje.muestra})`);
const sueltoPromovido = E.itemsArray(conSueltos).find(i => i.clave === "buzo-polar");
ok(!!sueltoPromovido && sueltoPromovido.origen === "historial",
   "y el ítem agregado en uno de montaña y en uno de ciudad se sugiere");
ok(!!sueltoPromovido && /viajes de ciudad o montaña\./.test(sueltoPromovido.motivo),
   `con un motivo que no afirma que algún viaje fue de las dos cosas: ${JSON.stringify(sueltoPromovido && sueltoPromovido.motivo)}`);
const viejoMixto = E.buildPackingList({
  trip:VIAJE, items:RESERVAS, tipoViaje:"mixto", now:AT,
  history:[viajeAnterior("mixto"), viajeAnterior("mixto")]
});
ok(viejoMixto.aprendizaje.muestra === 2,
   "una lista vieja de mixto sigue aprendiendo de las otras viejas de mixto, como antes");

console.log("\n· el motivo de un ítem aprendido se lee, no muestra la clave interna");
const promovido = E.itemsArray(conCombo).find(i => i.clave === "buzo-polar");
info("motivo: " + JSON.stringify(promovido && promovido.motivo));
/* El orden es el canónico —ciudad antes que montaña, por TRIP_TYPE_KEYS—, que
   es el mismo que se guarda. Lo que se prueba acá es que la frase se LEE: que
   no diga "viajes de ciudad+montana" ni "viajes de undefined". */
ok(!!promovido && /viajes de ciudad y montaña\./.test(promovido.motivo),
   "dice \"viajes de ciudad y montaña\", no \"viajes de ciudad+montana\"");
ok(!!promovido && !/\+/.test(promovido.motivo) && !/undefined/.test(promovido.motivo),
   "y no se le escapa ni el \"+\" ni un undefined");

console.log("\n====================================================");
console.log(fallos ? `  ${fallos} FALLARON` : "  Todo en verde — mixto se comporta como antes y dos tipos suman");
console.log("====================================================\n");
process.exit(fallos ? 1 : 0);
