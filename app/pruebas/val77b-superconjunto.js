/* ============================================================
   VAL-77b — NADIE PIERDE LO APRENDIDO, Y LO DESCARTADO NO CAMBIA

   El muestrario le afirma al PM "0 ítems pierden lo que habían aprendido".
   El brief dice que eso es una prueba y no una intención, y dice cómo:

     la función VIEJA se saca de `git show 38ae74f:app/valija.html`, se
     corren las dos sobre una batería de historiales SIN `paraTipos`, y se
     asevera que lo promovido por la nueva INCLUYE lo promovido por la vieja,
     para cada viaje destino.

   Así que acá no se escribe a mano qué "debería" dar: se compara contra lo
   que DABA. Las dos funciones se extraen del HTML (el de antes, del commit;
   el de ahora, del archivo), igual que `motores-desde-html.js`.

   Cuatro partes:

     1 · SUPERCONJUNTO, batería sistemática: todo par de listas pasadas por
         todo tipo de viaje nuevo, con el ítem sin declarar en las TRES formas
         que existen en datos reales — campo ausente, `paraTipos:[]`, y listas
         viejas que guardan el tipo en `tripType` en vez de `tipoViaje`.
     2 · SUPERCONJUNTO, batería al azar (semilla fija, repetible).
     3 · LO DESCARTADO NO CAMBIA: con los ítems descartados y los agregados a
         mano en claves distintas, `suprimir` da IDÉNTICO antes y después. Con
         claves que se cruzan, la nueva nunca suprime algo que la vieja no
         suprimía, y lo único que puede sacar de `suprimir` es lo que ahora se
         promueve (la precedencia de siempre, declarada en el brief).
     4 · LOS CONTROLES NEGATIVOS, adentro del arnés y no en un comentario:
           a · se BORRA la fila `canonical(Q) === canonical(P)` de la regla
               nueva, que es la tentación que el brief nombra, y la parte 1
               TIENE que fallar;
           b · se le saca a la supresión la guarda de misma combinación
               (ampliar lo que se saca, que es la decisión 4 al revés), y la
               parte 3 TIENE que fallar.
         Cada sabotaje asevera primero que el texto que rompe está, UNA vez.
         Si no está, el control falla: un sabotaje que no llegó no prueba nada.

   Y una aserción más, que es la que hace que el superconjunto no sea gratis:
   en alguna parte de la batería la nueva tiene que promover ESTRICTAMENTE
   más que la vieja. Si nunca pasa, la batería no está tocando las filas
   nuevas y el "incluye" se cumpliría con dos funciones idénticas.

       node app/pruebas/val77b-superconjunto.js [ruta/al/valija.html]
   ============================================================ */
"use strict";
const fs = require("fs"), path = require("path"), cp = require("child_process");

const RAIZ = path.resolve(__dirname, "..", "..");
const HTML = process.argv[2] ? path.resolve(process.argv[2]) : path.join(RAIZ, "app", "valija.html");
const COMMIT_VIEJO = "38ae74f";

let fallos = 0, pasaron = 0;
const ok = (c, m) => { if (c) { pasaron++; console.log("  ok     " + m); } else { fallos++; console.log("  FALLA  " + m); } };
const info = m => console.log("  info   " + m);

/* ---------- los motores ---------- */
function cuerpoDelMotor(fuente) {
  const abre = "const PackingEngine = (function () {";
  const i = fuente.indexOf(abre);
  if (i < 0) throw new Error("no encontré el motor en el HTML");
  const j = fuente.indexOf("\n})();", i);
  if (j < 0) throw new Error("no encontré el cierre del motor");
  return fuente.slice(i + abre.length, j);
}
const cargar = cuerpo => new Function("return (function () {" + cuerpo + "\n})();")();

const htmlViejo = cp.execSync(`git show ${COMMIT_VIEJO}:app/valija.html`, { cwd:RAIZ, maxBuffer:64 << 20 }).toString("utf8");
const cuerpoViejo = cuerpoDelMotor(htmlViejo);
const cuerpoNuevo = cuerpoDelMotor(fs.readFileSync(HTML, "utf8"));
const VIEJO = cargar(cuerpoViejo), NUEVO = cargar(cuerpoNuevo);

console.log("HTML bajo prueba: " + HTML);
console.log("función vieja:    git show " + COMMIT_VIEJO + ":app/valija.html");
ok(typeof VIEJO.learnFromHistory === "function" && typeof NUEVO.learnFromHistory === "function",
   "las dos funciones se cargaron");
ok(!/paraTipos/.test(cuerpoViejo), "la vieja es de antes de VAL-77b: no sabe nada de `paraTipos`");

/* ---------- los tipos ----------
   La lista sale del catálogo del motor, no de una lista a mano: si mañana se
   agrega un tipo, la batería lo cubre sin que nadie se acuerde. */
const CLAVES = NUEVO.TRIP_TYPES.map(t => t.key);
const SIMPLES = CLAVES.slice();                                  // incluye "mixto"
const PARES = [];
CLAVES.filter(k => k !== "mixto").forEach((a, i, arr) => arr.forEach((b, j) => { if (i !== j) PARES.push(a + "+" + b); }));
/* Q: lo que puede estar guardado. Los pares en los DOS órdenes (listas viejas
   quedaron al revés), sin tipo, vacío, basura y una parte repetida. */
const TIPOS_Q = [null, "", "basura", "montana+montana"].concat(SIMPLES, PARES);
/* P: el viaje nuevo, en su forma canónica, más sin tipo. */
const TIPOS_P = [null].concat(SIMPLES, PARES.filter(p => VIEJO.canonicalTripType(p) === p));

/* ---------- los fixtures ----------
   Un ítem guardado por la app, leyendo `makeItem` y `addManualItem`: clave,
   nombre, categoría, cantidad, motivo, origen, estado, regla, orden. El campo
   de esta historia en sus tres formas: AUSENTE (todo lo guardado hasta hoy),
   VACÍO (agregado sin elegir) y DECLARADO (sólo en las partes 3 y 4, porque
   el superconjunto es sobre lo guardado sin parte). */
const ITEM = (nombre, origen, estado, para) => {
  const it = { clave:VIEJO.slug(nombre), nombre, categoria:"otros", cantidad:null,
               motivo:"Lo agregaste vos.", origen, estado, regla:"", orden:950 };
  if (para !== undefined) it.paraTipos = para;
  return it;
};
const LISTA = (tipo, items, campo) => {
  const l = { version:2, items:{} };
  l[campo || "tipoViaje"] = tipo;
  items.forEach(i => { l.items[i.clave] = i; });
  return l;
};

const claves = r => r.promover.map(e => e.clave);
const faltan = (viejo, nuevo) => { const n = new Set(claves(nuevo)); return claves(viejo).filter(c => !n.has(c)); };

/* ---------- 1 · batería sistemática ---------- */
function bateriaSistematica(E) {
  let casos = 0, violaciones = [], masQueAntes = 0;
  const formas = [
    { nombre:"campo ausente",       para:undefined, campo:"tipoViaje" },
    { nombre:"paraTipos vacío",     para:[],        campo:"tipoViaje" },
    { nombre:"lista vieja tripType", para:undefined, campo:"tripType" }
  ];
  formas.forEach(f => {
    TIPOS_Q.forEach(q1 => TIPOS_Q.forEach(q2 => TIPOS_P.forEach(p => {
      const hist = [
        LISTA(q1, [ITEM("Buzo polar", "manual", "pendiente", f.para), ITEM("Sube", "regla", "descartado")], f.campo),
        LISTA(q2, [ITEM("Buzo polar", "manual", "empacado",  f.para), ITEM("Sube", "regla", "descartado")], f.campo)
      ];
      const v = VIEJO.learnFromHistory(hist, p), n = E.learnFromHistory(hist, p);
      casos++;
      const f1 = faltan(v, n);
      if (f1.length) violaciones.push(`${f.nombre} · Q=${q1},${q2} · P=${p} · pierde ${f1.join(",")}`);
      if (claves(n).length > claves(v).length) masQueAntes++;
    })));
  });
  return { casos, violaciones, masQueAntes };
}

/* ---------- 2 · batería al azar, con semilla ---------- */
function azar(semilla) {
  let s = semilla >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const NOMBRES = ["Buzo polar", "Paraguas", "Cargador del reloj", "Protector solar", "Zapatillas cómodas",
                 "Bastones de trekking", "Adaptador de enchufe", "Termo"];
const ORIGENES = ["manual", "manual", "manual", "regla", "historial", "destino"];
const ESTADOS = ["pendiente", "empacado", "descartado"];
const elegir = (r, arr) => arr[Math.floor(r() * arr.length)];

function historialAlAzar(r, conDeclarados) {
  const n = Math.floor(r() * 7), hist = [];
  for (let i = 0; i < n; i++) {
    const items = [], k = Math.floor(r() * 7);
    for (let j = 0; j < k; j++) {
      const origen = elegir(r, ORIGENES);
      let para;
      const forma = r();
      if (forma < 0.4) para = undefined;
      else if (forma < 0.7 || !conDeclarados || origen !== "manual") para = origen === "manual" ? [] : undefined;
      else para = r() < 0.5 ? [elegir(r, CLAVES)] : [elegir(r, CLAVES), elegir(r, CLAVES)];
      items.push(ITEM(elegir(r, NOMBRES), origen, elegir(r, ESTADOS), para));
    }
    hist.push(LISTA(elegir(r, TIPOS_Q), items, r() < 0.1 ? "tripType" : "tipoViaje"));
  }
  return hist;
}

function bateriaAlAzar(E, semilla, vueltas) {
  const r = azar(semilla);
  let casos = 0, violaciones = [], masQueAntes = 0, vecesMenos = [];
  for (let i = 0; i < vueltas; i++) {
    const hist = historialAlAzar(r, false);
    const p = elegir(r, TIPOS_P);
    const v = VIEJO.learnFromHistory(hist, p), n = E.learnFromHistory(hist, p);
    casos++;
    const f = faltan(v, n);
    if (f.length) violaciones.push(`vuelta ${i} · P=${p} · pierde ${f.join(",")}`);
    if (claves(n).length > claves(v).length) masQueAntes++;
    const nv = {}; n.promover.forEach(e => { nv[e.clave] = e.veces; });
    v.promover.forEach(e => { if (nv[e.clave] !== undefined && nv[e.clave] < e.veces) vecesMenos.push(e.clave); });
  }
  return { casos, violaciones, masQueAntes, vecesMenos };
}

/* ---------- 3 · lo descartado ---------- */
const firmaSup = r => r.suprimir.map(e => e.clave + "×" + e.veces).sort().join(" ");

function bateriaDescartados(E, semilla, vueltas) {
  const r = azar(semilla);
  let identicos = 0, casosDisjuntos = 0, distintosDisjuntos = [];
  let casosCruzados = 0, suprimeDeMas = [], sinExplicar = [], porPrecedencia = 0;
  for (let i = 0; i < vueltas; i++) {
    const hist = historialAlAzar(r, true);          // acá SÍ hay declarados: la supresión no los mira
    const p = elegir(r, TIPOS_P);
    /* Claves disjuntas: a lo descartado se le cambia el nombre, así ningún
       descarte comparte clave con un agregado a mano. */
    const disjunto = hist.map(l => Object.assign({}, l, { items:Object.fromEntries(
      Object.values(l.items).map(it => {
        if (it.estado !== "descartado") return [it.clave, it];
        const c = Object.assign({}, it, { nombre:"Descartado " + it.nombre, clave:"descartado-" + it.clave, origen:"regla" });
        delete c.paraTipos;
        return [c.clave, c];
      })) }));
    const vd = VIEJO.learnFromHistory(disjunto, p), nd = E.learnFromHistory(disjunto, p);
    casosDisjuntos++;
    if (firmaSup(vd) === firmaSup(nd)) identicos++;
    else distintosDisjuntos.push(`vuelta ${i} · P=${p} · antes [${firmaSup(vd)}] · ahora [${firmaSup(nd)}]`);

    const v = VIEJO.learnFromHistory(hist, p), n = E.learnFromHistory(hist, p);
    casosCruzados++;
    const antes = new Set(v.suprimir.map(e => e.clave));
    const promNueva = new Set(claves(n));
    n.suprimir.forEach(e => { if (!antes.has(e.clave)) suprimeDeMas.push(`vuelta ${i} · ${e.clave}`); });
    v.suprimir.forEach(e => {
      const sigue = n.suprimir.some(x => x.clave === e.clave && x.veces === e.veces);
      if (sigue) return;
      if (promNueva.has(e.clave)) porPrecedencia++;
      else sinExplicar.push(`vuelta ${i} · ${e.clave}`);
    });
  }
  return { casosDisjuntos, identicos, distintosDisjuntos, casosCruzados, suprimeDeMas, sinExplicar, porPrecedencia };
}

/* ---------- los sabotajes ---------- */
function sabotear(cuerpo, quitar) {
  const n = cuerpo.split(quitar).length - 1;
  return { n, cuerpo: n === 1 ? cuerpo.replace(quitar, "") : cuerpo };
}
/* La fila 2, textual. Si alguien la reescribe, este control deja de encontrarla
   y FALLA en vez de pasar en falso. */
const FILA_2 = "        else if (mismaCombinacion) { por = partesP.slice(); cuenta = true; }  // fila 2: NO SE BORRA\n";
const GUARDA_SUPRESION = "if (mismaCombinacion && it.estado === ESTADO.DESCARTADO";

const muestra = arr => arr.slice(0, 3).forEach(x => info("  " + x));

(function () {
  console.log("\n· 1 · superconjunto, batería sistemática (sin paraTipos: ausente, vacío y lista vieja)");
  const s = bateriaSistematica(NUEVO);
  info(`${s.casos} casos · Q ∈ ${TIPOS_Q.length} tipos guardados · P ∈ ${TIPOS_P.length} viajes nuevos`);
  ok(s.violaciones.length === 0, `ningún viaje destino pierde un ítem promovido por la vieja (${s.violaciones.length} violaciones)`);
  muestra(s.violaciones);
  ok(s.masQueAntes > 0, `y en ${s.masQueAntes} casos la nueva promueve ESTRICTAMENTE más: la batería toca las filas nuevas`);

  console.log("\n· 2 · superconjunto, batería al azar (semilla 77, 20000 historiales de 0 a 6 viajes)");
  const a = bateriaAlAzar(NUEVO, 77, 20000);
  ok(a.violaciones.length === 0, `ningún historial pierde un promovido (${a.violaciones.length} violaciones en ${a.casos})`);
  muestra(a.violaciones);
  ok(a.vecesMenos.length === 0, `y ningún promovido cuenta MENOS veces que antes (${a.vecesMenos.length})`);
  ok(a.masQueAntes > 0, `en ${a.masQueAntes} historiales la nueva promueve más`);

  console.log("\n· 3 · lo descartado no cambia (acá sí hay ítems con paraTipos declarado)");
  const d = bateriaDescartados(NUEVO, 9, 20000);
  ok(d.identicos === d.casosDisjuntos,
     `con descartes y agregados en claves distintas, suprimir da IDÉNTICO: ${d.identicos} de ${d.casosDisjuntos}`);
  muestra(d.distintosDisjuntos);
  ok(d.suprimeDeMas.length === 0, `con claves cruzadas, la nueva nunca suprime algo que la vieja no suprimía (${d.suprimeDeMas.length})`);
  muestra(d.suprimeDeMas);
  ok(d.sinExplicar.length === 0,
     `y lo único que deja de suprimirse es lo que ahora se promueve (${d.sinExplicar.length} sin explicar)`);
  muestra(d.sinExplicar);
  info(`la consecuencia declarada en el brief, medida: ${d.porPrecedencia} supresiones que ahora gana la promoción, en ${d.casosCruzados} historiales`);

  /* El azar casi nunca arma la consecuencia declarada, así que va un caso a
     mano: dos viajes de montaña donde lo agregaste, dos de montaña+ciudad donde
     lo descartaste. Antes se suprimía en el tercer montaña+ciudad; ahora se
     promueve, porque lo de montaña cuenta, y gana la promoción. */
  const prec = [
    LISTA("montana", [ITEM("Termo", "manual", "pendiente")]),
    LISTA("montana", [ITEM("Termo", "manual", "pendiente")]),
    LISTA("ciudad+montana", [ITEM("Termo", "regla", "descartado")]),
    LISTA("montana+ciudad", [ITEM("Termo", "regla", "descartado")])
  ];
  const pv = VIEJO.learnFromHistory(prec, "ciudad+montana"), pn = NUEVO.learnFromHistory(prec, "ciudad+montana");
  ok(pv.suprimir.some(e => e.clave === "termo") && !pn.suprimir.some(e => e.clave === "termo") && claves(pn).indexOf("termo") >= 0,
     "la consecuencia declarada existe y es ésta: antes se suprimía, ahora se promueve y gana la promoción");

  /* Y la otra mitad de la precedencia, la que encontró esta misma batería: un
     ítem declarado para una parte que el viaje ya no tiene sigue protegido de
     la supresión por la regla de 77a. */
  const vuelta = [
    LISTA("ciudad+playa", [ITEM("Termo", "manual", "descartado", ["montana"])]),
    LISTA("ciudad+playa", [ITEM("Termo", "manual", "descartado", ["montana"])])
  ];
  const vv = VIEJO.learnFromHistory(vuelta, "ciudad+playa"), vn = NUEVO.learnFromHistory(vuelta, "ciudad+playa");
  ok(!vv.suprimir.length && !vn.suprimir.length,
     "declarado para montaña en un viaje que pasó a ciudad+playa, y descartado ahí dos veces: no se suprime, igual que antes");
  ok(!claves(vn).length, "y tampoco se promueve para ciudad+playa: se declaró para montaña");

  console.log("\n· 5 · las piezas del motor que la pantalla usa");
  const AT = "2027-01-01T00:00:00.000Z";
  const base = { version:2, tipoViaje:"ciudad+montana", items:{} };
  const conParte = NUEVO.addManualItem(base, { nombre:"Buzo polar", categoria:"ropa", paraTipos:["montana"] }, { now:AT });
  ok(JSON.stringify(conParte.items["buzo-polar"].paraTipos) === '["montana"]', "agregar con una parte la guarda");
  const sinParte = NUEVO.addManualItem(base, { nombre:"Cargador del reloj", categoria:"electronica" }, { now:AT });
  ok(Array.isArray(sinParte.items[NUEVO.slug("Cargador del reloj")].paraTipos) &&
     sinParte.items[NUEVO.slug("Cargador del reloj")].paraTipos.length === 0,
     "agregar sin elegir guarda [] —no declarado—, no inventa una parte");
  // vecino 2: ya existía como propio sin parte, y ahora eligió una
  const legado = { version:2, tipoViaje:"ciudad+montana", items:{ "buzo-polar":
    { clave:"buzo-polar", nombre:"Buzo polar", categoria:"ropa", origen:"manual", estado:"descartado", motivo:"Lo agregaste vos.", orden:950 } } };
  const reAgregado = NUEVO.addManualItem(legado, { nombre:"Buzo polar", paraTipos:["montana"] }, { now:AT });
  ok(reAgregado.items["buzo-polar"].estado === "pendiente" &&
     JSON.stringify(reAgregado.items["buzo-polar"].paraTipos) === '["montana"]',
     "re-agregar un propio SIN parte, eligiendo una: vuelve a pendiente y guarda la parte");
  const reSinElegir = NUEVO.addManualItem(conParte, { nombre:"Buzo polar" }, { now:AT });
  ok(JSON.stringify(reSinElegir.items["buzo-polar"].paraTipos) === '["montana"]',
     "re-agregar sin elegir no borra la parte que ya tenía");
  const deRegla = { version:2, tipoViaje:"ciudad+montana", items:{ "dni":
    { clave:"dni", nombre:"DNI", categoria:"documentacion", origen:"regla", estado:"pendiente", orden:1 } } };
  ok(NUEVO.addManualItem(deRegla, { nombre:"DNI", paraTipos:["montana"] }, { now:AT }).items.dni.paraTipos === undefined,
     "a un ítem de regla no se le pone parte: sólo los propios la llevan");
  // vecino 4: regenerar
  const viaje = { id:"t", name:"Andes", destination:"Mendoza", startDate:"2027-07-01", endDate:"2027-07-08" };
  const v1 = NUEVO.buildPackingList({ trip:viaje, tipoViaje:"ciudad+montana", now:AT });
  const v1b = NUEVO.addManualItem(v1, { nombre:"Buzo polar", categoria:"ropa", paraTipos:["montana"] }, { now:AT });
  const v2 = NUEVO.buildPackingList({ trip:viaje, tipoViaje:"ciudad+montana", previous:v1b, now:AT });
  ok(JSON.stringify((v2.items["buzo-polar"] || {}).paraTipos) === '["montana"]', "rehacer la lista conserva la parte (mergeLists)");
  const v3 = NUEVO.buildPackingList({ trip:viaje, tipoViaje:"ciudad+playa", previous:v2, now:AT });
  ok(JSON.stringify((v3.items["buzo-polar"] || {}).paraTipos) === '["montana"]',
     "cambiar el tipo del viaje no reescribe lo que la persona declaró");
  const fresco = { generadaEn:AT, items:{ "buzo-polar":{ clave:"buzo-polar", nombre:"Buzo polar", origen:"manual", estado:"pendiente", paraTipos:[] } } };
  const m = NUEVO.mergeLists({ items:{ "buzo-polar":{ clave:"buzo-polar", nombre:"Buzo polar", origen:"manual", estado:"empacado", paraTipos:["ciudad"] } } }, fresco);
  ok(JSON.stringify(m.items["buzo-polar"].paraTipos) === '["ciudad"]' && m.items["buzo-polar"].estado === "empacado",
     "si los dos lados son propios, gana lo que la persona declaró en la lista guardada");
  const m2 = NUEVO.mergeLists({ items:{ "buzo-polar":{ clave:"buzo-polar", nombre:"Buzo polar", origen:"manual", estado:"pendiente", paraTipos:["montana"] } } },
    { generadaEn:AT, items:{ "buzo-polar":{ clave:"buzo-polar", nombre:"Buzo polar", origen:"historial", estado:"pendiente" } } });
  ok(m2.items["buzo-polar"].origen === "historial" && m2.items["buzo-polar"].paraTipos === undefined,
     "si otra capa se lo queda por precedencia, deja de ser propio y no lleva parte");
  // decisión 5: el motivo
  const H = (tipo, para) => LISTA(tipo, [ITEM("Buzo polar", "manual", "pendiente", para)]);
  const mot = (hist, p) => { const e = NUEVO.learnFromHistory(hist, p).promover[0]; return e ? NUEVO.motivoAprendido(e, p) : "(no se promovió)"; };
  const casosMotivo = [
    [[H("ciudad+montana", ["montana"]), H("montana", ["montana"])], "montana",         "Lo agregaste a mano en 2 viajes de montaña."],
    [[H("ciudad+montana", ["montana"]), H("montana", ["montana"])], "ciudad+montana",  "Lo agregaste a mano en 2 viajes de montaña."],
    [[H("ciudad+montana"), H("montana+ciudad", [])],               "ciudad+montana",  "Lo agregaste a mano en 2 viajes de ciudad y montaña."],
    [[H("montana"), H("ciudad")],                                   "ciudad+montana",  "Lo agregaste a mano en 2 viajes de ciudad o montaña."],
    [[H("ciudad+montana", ["ciudad","montana"]), H("ciudad", [])],  "ciudad",          "Lo agregaste a mano en 2 viajes de ciudad."],
    [[H("mixto"), H("mixto")],                                      "mixto",           "Lo agregaste a mano en 2 viajes de mixto."]
  ];
  casosMotivo.forEach(([hist, p, esperado]) => {
    const dice = mot(hist, p);
    ok(dice === esperado, `motivo en un viaje de ${p}: ${JSON.stringify(dice)}`);
  });
  ok(NUEVO.learnFromHistory([H("ciudad+montana", ["montana"]), H("montana", ["montana"])], "ciudad").promover.length === 0,
     "lo declarado para montaña no se sugiere en un viaje de ciudad");
  ok(NUEVO.learnFromHistory([H("ciudad+montana", []), H("montana", [])], "montana").promover.length === 0,
     "lo agregado sin elegir en un montaña+ciudad no cuenta para montaña sola");
  ok(NUEVO.learnFromHistory([H("ciudad+montana"), H("ciudad+playa")], "ciudad+montana").muestra === 2,
     "`muestra` cuenta los viajes que comparten una parte, que son los que se leyeron");

  console.log("\n· 4a · control negativo: borrar la fila canonical(Q) === canonical(P)");
  const sa = sabotear(cuerpoNuevo, FILA_2);
  ok(sa.n === 1, `el sabotaje encontró la fila, una sola vez (${sa.n})`);
  if (sa.n === 1) {
    const E = cargar(sa.cuerpo);
    const s2 = bateriaSistematica(E);
    ok(s2.violaciones.length > 0, `SIN la fila, la batería sistemática FALLA: ${s2.violaciones.length} violaciones`);
    muestra(s2.violaciones);
    const a2 = bateriaAlAzar(E, 77, 20000);
    ok(a2.violaciones.length > 0, `y la del azar también: ${a2.violaciones.length} violaciones`);
  }

  console.log("\n· 4b · control negativo: ampliar la supresión (sacarle la guarda de misma combinación)");
  const nb = cuerpoNuevo.split(GUARDA_SUPRESION).length - 1;
  ok(nb === 1, `el sabotaje encontró la guarda, una sola vez (${nb})`);
  if (nb === 1) {
    const E = cargar(cuerpoNuevo.replace(GUARDA_SUPRESION, "if (it.estado === ESTADO.DESCARTADO"));
    const d2 = bateriaDescartados(E, 9, 20000);
    ok(d2.identicos < d2.casosDisjuntos && d2.suprimeDeMas.length > 0,
       `CON la supresión ampliada, la parte 3 FALLA: ${d2.casosDisjuntos - d2.identicos} distintos, ${d2.suprimeDeMas.length} suprimidos de más`);
  }

  console.log("\n· 4c · control negativo: proteger la supresión sólo con la regla nueva");
  const PROTECCION = "  agregadoEnCombinacion.forEach(function (e) { if (e.veces >= HISTORY_PROMOTE_AT) promoverClaves[e.clave] = true; });\n";
  const sc = sabotear(cuerpoNuevo, PROTECCION);
  ok(sc.n === 1, `el sabotaje encontró la protección, una sola vez (${sc.n})`);
  if (sc.n === 1) {
    const E = cargar(sc.cuerpo);
    const d3 = bateriaDescartados(E, 9, 20000);
    ok(d3.suprimeDeMas.length > 0, `SIN ella, la nueva suprime lo que la vieja no: ${d3.suprimeDeMas.length} casos`);
    ok(E.learnFromHistory(vuelta, "ciudad+playa").suprimir.length === 1, "y el caso a mano también lo muestra");
  }

  console.log("\n====================================================");
  console.log(fallos ? `  ${fallos} FALLARON (${pasaron} pasaron)` : `  Todo en verde — ${pasaron} aserciones`);
  console.log("====================================================\n");
  process.exit(fallos ? 1 : 0);
})();
