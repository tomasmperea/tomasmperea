/* ============================================================
   VAL-85 — LO QUE SE APRENDIÓ A SACAR NO ES "EL VIAJE CAMBIÓ"

   El defecto, reproducido contra el motor de 7f3a1e5 con el viaje SIN TOCAR
   (ver val85-la-causa-de-lo-que-se-saca.js, que lo hace sin navegador):

     sacados: Cámara y cargador · nuevos: 0
     motivo: «El viaje cambió: saco 1 que ya no corresponde.»

   Es la forma que VAL-77b arregló del lado de lo que se SUMA, del otro lado.
   Los cinco sitios son los de VAL-77b:

     1 · el motivo del plan (`motivoDelPlan`, motor)
     2 · la tira de entrada a la valija (pantalla del viaje)
     3 · el aviso de adentro de la valija (`planAvisoTexto`; el del pie usa
         la misma función)
     4 · el aviso de sólo lectura
     5 · la hoja "De dónde sale esta lista"

   EL GESTO: se arma la valija del viaje x (montaña) primero; después se
   arman dos viajes de montaña y en cada uno se toca el botón de descartar
   de «Cámara y cargador». x queda armada antes, con la cámara pendiente.

     A · sólo saca, entrando a la valija después de recargar
     B · sólo saca, guardando una reserva que no mueve nada (una nota)
     B-IA · lo mismo CON capa de IA: el plan pasa por `planListUpdateAsync`,
         que recalcula `sacados`. Es el que falla si la causa no sobrevive.
     E · las dos (además se agrega «Termo» a mano en los otros dos), por
         los dos disparadores
     (sólo suma: es el caso de VAL-77b, y lo cubre su arnés, que se corre
      después de éste)

   LOS CONTROLES:
     C · un cambio REAL que saca algo —borrar el vuelo de x saca «Líquidos
         de hasta 100 ml»—, encima de la cámara aprendida: el plan es mixto
         y los cinco textos son idénticos a 7f3a1e5
     D · EL VECINO: los líquidos se descartaron en los otros dos viajes Y se
         borra el vuelo de x. Antes de borrarlo, los textos nombran lo
         descartado (la regla sigue aplicando); después, los cinco textos
         son idénticos a los de 7f3a1e5: el viaje cambió.

   EL CONTROL NEGATIVO va adentro: el caso A se corre contra 7f3a1e5 y TIENE
   que decir «El viaje cambió». Los sabotajes por sitio, con lo que dan, están
   en app/pruebas/LEEME.md.

   LO QUE NO PRUEBA: Chromium de escritorio sobre file://, sin base. La IA es
   un simulador que devuelve "nada para sumar": no es el modelo. No es el
   teléfono.

       NODE_PATH=/opt/node22/lib/node_modules \
         node app/pruebas/val85-lo-aprendido-a-sacar.js [ruta/al/valija.html]
   ============================================================ */
"use strict";

const { chromium } = require("playwright");
const fs = require("fs"), path = require("path"), os = require("os"), cp = require("child_process");

const RAIZ = path.resolve(__dirname, "..", "..");
const HTML = process.argv[2] ? path.resolve(process.argv[2]) : path.join(RAIZ, "app", "valija.html");
const ANTES = "7f3a1e5";
const HTML_ANTES = path.join(os.tmpdir(), `valija-${ANTES}.html`);
fs.writeFileSync(HTML_ANTES, cp.execSync(`git show ${ANTES}:app/valija.html`, { cwd:RAIZ, maxBuffer:64 << 20 }));

let fallos = 0, pasaron = 0;
const ok = (c, m) => { if (c) { pasaron++; console.log("  ok     " + m); } else { fallos++; console.log("  FALLA  " + m); } };
const info = m => console.log("  info   " + m);
async function bloque(nombre, fn) {
  console.log("\n· " + nombre);
  try { await fn(); }
  catch (e) { fallos++; console.log("  FALLA (excepción) " + (e && e.message)); console.log(e && e.stack); }
}

/* Los viajes, con lo que pide `sheetTrip` (las fechas del viaje son `date`). */
const VIAJE = (id, name, destination, startDate, endDate) =>
  ({ id, name, destination, startDate, endDate, hue:200, travelers:"Tomás" });
const SEMILLA = { trips:[
  VIAJE("x", "Mendoza", "Mendoza", "2027-07-01", "2027-07-08"),
  VIAJE("m1", "Esquel", "Esquel", "2027-08-01", "2027-08-08"),
  VIAJE("m2", "Bariloche", "Bariloche", "2027-09-01", "2027-09-08")
] };

/** `ia`: false -> `claude.use` devuelve null. true -> un `sample` que responde
    "nada para sumar ni sacar" y cuenta cuántas veces se le preguntó. Las dos
    funciones van como texto y con argumento explícito: `addInitScript` no se
    lleva un closure. */
async function nuevaPagina(browser, archivo, ia) {
  const page = await browser.newPage({ viewport:{ width:390, height:844 }, hasTouch:true, isMobile:true });
  await page.route("**/*", r => (/^file:/.test(r.request().url()) ? r.continue() : r.abort()));
  page.on("pageerror", e => { console.log("  !! pageerror: " + e.message); fallos++; });
  await page.addInitScript(conIA => {
    window.__iaPreguntas = 0;
    const sample = { json: async () => { window.__iaPreguntas++; return { items:[], quitar:[] }; } };
    window.claude = { use: async k => (conIA && k === "sample" ? sample : null) };
  }, !!ia);
  /* La semilla anota qué rama tomó. Si después de recargar dice "sembró", la
     recarga no encontró lo guardado y la semilla lo pisó: es la falla de
     VAL-86 (la recarga pierde la escritura), y se dice con esas palabras en
     vez de fallar más adelante con un botón que no aparece. */
  await page.addInitScript(s => {
    try {
      window.__semilla = localStorage.getItem("valija.v1") ? "ya había" : "sembró";
      if (window.__semilla === "sembró") {
        const items = {}; s.trips.forEach(t => { items[t.id] = []; });
        localStorage.setItem("valija.v1", JSON.stringify({ trips:s.trips, items, packing:{} }));
      }
    } catch (e) { window.__semilla = "error: " + (e && e.message); }
  }, SEMILLA);
  page.__app = "file://" + archivo;
  await page.goto(page.__app);
  await page.waitForFunction(() => typeof Store !== "undefined" && Store.ready, null, { timeout:15000 });
  return page;
}
const ir = async (page, hash) => { await page.goto(page.__app + hash); await page.waitForTimeout(500); };

async function marcarTipos(page, tipos) {
  const marcadas = () => page.$$eval('#pk-tp [data-t][aria-pressed="true"]', els => els.map(e => e.dataset.t));
  for (const t of await marcadas()) if (tipos.indexOf(t) < 0) { await page.locator(`#pk-tp [data-t="${t}"]`).click(); await page.waitForTimeout(120); }
  for (const t of tipos) if ((await marcadas()).indexOf(t) < 0) { await page.locator(`#pk-tp [data-t="${t}"]`).click(); await page.waitForTimeout(120); }
}
async function armar(page, id, tipos) {
  await ir(page, "#/trip/" + id + "/valija");
  await page.waitForSelector("#pk-tp", { timeout:10000 });
  await marcarTipos(page, tipos);
  await page.locator("#pk-build").click();
  await page.waitForFunction(i => { const l = Store.packingOf(i); return !!(l && l.items && Object.keys(l.items).length) && !PK.generating; }, id, { timeout:15000 });
  await page.waitForTimeout(300);
}
/** Toca el botón de descartar del ítem cuya clave empieza con `prefijo`. */
async function descartar(page, id, prefijo) {
  const boton = page.locator(`[data-dropbtn^="${prefijo}"]`).first();
  await boton.scrollIntoViewIfNeeded();
  await boton.click();
  await page.waitForFunction(([i, p]) => {
    const l = Store.packingOf(i); const k = l && Object.keys(l.items).find(c => c.indexOf(p) === 0);
    return !!k && l.items[k].estado === "descartado";
  }, [id, prefijo], { timeout:8000 });
  await page.waitForTimeout(200);
}
async function agregarTermo(page, id) {
  await page.locator('[data-pkadd="ropa"]').click();
  await page.locator("#pk-add-ropa").fill("Termo");
  await page.locator('[data-pksave="ropa"]').click();
  await page.waitForFunction(i => { const l = Store.packingOf(i); return !!(l && l.items && l.items[PackingEngine.slug("Termo")]); }, id);
  await page.waitForTimeout(200);
}
async function cargarReserva(page, viaje, tipo, campos) {
  await ir(page, "#/trip/" + viaje);
  await page.locator("#additem").click();
  await page.waitForSelector("#i_title", { timeout:10000 });
  await page.locator(`#tp button[data-t="${tipo}"]`).click();
  await page.waitForTimeout(150);
  for (const [id, v] of Object.entries(campos)) await page.locator("#" + id).fill(v);
  await page.locator("#save").click();
  await page.waitForFunction(() => !document.querySelector("#i_title"), null, { timeout:8000 }).catch(() => {});
  await page.waitForTimeout(600);
}
/** Un vuelo como lo carga el formulario: origen, destino, sale y llega. */
const VUELO = dia => ({ i_title:"Vuelo a Bariloche", i_from:"AEP", i_to:"BRC",
                        i_start:dia + "T08:10", i_end:dia + "T10:25", i_provider:"Aerolíneas" });
async function borrarElVuelo(page, viaje) {
  await ir(page, "#/trip/" + viaje);
  const id = await page.evaluate(v => (Store.itemsOf(v).find(i => i.type === "flight") || {}).id, viaje);
  if (!id) throw new Error("no hay vuelo para borrar en " + viaje);
  await page.locator(`[data-item="${id}"]`).click();
  await page.waitForSelector("#delitem", { timeout:8000 });
  await page.locator("#delitem").click();
  await page.waitForFunction(v => !Store.itemsOf(v).some(i => i.type === "flight"), viaje, { timeout:8000 });
  await page.waitForFunction(() => !!App.plan, null, { timeout:8000 }).catch(() => {});
  await page.waitForTimeout(600);
}

/** El historial crece con el dedo. x se arma primero y queda sin tocar.
    `quitar`: el prefijo de clave que se descarta en m1 y m2.
    `termo`: si además se agrega «Termo» a mano en los dos.
    `vuelos`: si los tres viajes tienen un vuelo cargado antes de armar. */
async function crecerHistorial(page, { quitar = "camara", termo = false, vuelos = false } = {}) {
  if (vuelos) {
    await cargarReserva(page, "x", "flight", VUELO("2027-07-01"));
    await cargarReserva(page, "m1", "flight", VUELO("2027-08-01"));
    await cargarReserva(page, "m2", "flight", VUELO("2027-09-01"));
  }
  await armar(page, "x", ["montana"]);
  for (const id of ["m1", "m2"]) {
    await armar(page, id, ["montana"]);
    await descartar(page, id, quitar);
    if (termo) await agregarTermo(page, id);
  }
}

/** Los cinco textos, leídos de la pantalla (el motivo, del plan en memoria). */
async function leerLosCinco(page) {
  const t = {};
  await ir(page, "#/trip/x/valija");
  await page.waitForFunction(() => !!App.plan, null, { timeout:8000 }).catch(() => {});
  t.motivo = await page.evaluate(() => (App.plan && App.plan.motivo) || "");
  t.aviso = await page.locator("#main .notice").first().innerText().catch(() => "");
  await page.locator("#pk-info").click();
  await page.waitForTimeout(250);
  t.hoja = await page.locator("#modal .sheet-bd .stack p").first().innerText().catch(() => "");
  await page.locator("#closeSheet").click();
  await page.evaluate(() => { Store.canWrite = false; render(); });
  await page.waitForTimeout(200);
  t.soloLectura = await page.locator("#main .notice").first().innerText().catch(() => "");
  await page.evaluate(() => { Store.canWrite = true; render(); });
  await ir(page, "#/trip/x");
  t.tira = await page.locator("#vjentry .s").innerText().catch(() => "");
  return t;
}
const plano = s => String(s || "").replace(/\s+/g, " ").trim();
const mostrar = t => Object.keys(t).forEach(k => info(`${k.padEnd(11)} ${JSON.stringify(plano(t[k]))}`));
const DICE_CAMBIO = /viaje cambi|cambió el viaje/i;

/** Lo que tiene que decir cada sitio, por forma. Textual: es lo que el PM lee. */
const ESPERADO = {
  saca: {
    motivo:"Por lo que descartaste en otros viajes: saco 1 ítem.",
    tira:"Por lo que descartaste en otros viajes",
    aviso:/^Por lo que descartaste en otros viajes, tengo una cosa para sacar de esta valija\./,
    soloLectura:"Estás viendo la valija de este viaje. Por lo que se descartó en otros viajes, hay 1 cosa para sacarle. Las puede sacar quien tenga permiso de edición.",
    hoja:"1 cosa para sacar por lo que descartaste en otros viajes."
  },
  ambas: {
    motivo:"Por lo que agregaste a mano y descartaste en otros viajes: sumo 1 ítem y saco 1 ítem.",
    tira:"Por lo que agregaste y descartaste en otros viajes",
    aviso:/^Por lo que agregaste a mano y descartaste en otros viajes, tengo una cosa para sumarle a esta valija y una cosa para sacarle\./,
    soloLectura:"Estás viendo la valija de este viaje. Por lo que se agregó a mano y se descartó en otros viajes, hay 1 cosa para sumarle y 1 cosa para sacarle. Las puede cambiar quien tenga permiso de edición.",
    hoja:"2 cosas para cambiar por lo que agregaste a mano y descartaste en otros viajes."
  }
};
const NOMBRES = { motivo:"1 · el motivo del plan", tira:"2 · la tira de entrada", aviso:"3 · el aviso de la valija",
                  soloLectura:"4 · el aviso de sólo lectura", hoja:"5 · «De dónde sale esta lista»" };

function diceLoAprendido(t, forma, camino) {
  Object.keys(NOMBRES).forEach(k => {
    if (t[k] === undefined) return;
    const e = ESPERADO[forma][k], v = plano(t[k]);
    const cumple = e instanceof RegExp ? e.test(v) : v === e;
    ok(cumple && !DICE_CAMBIO.test(v), `[${camino} · ${forma}] ${NOMBRES[k]}: nombra lo descartado en otros viajes y no dice que el viaje cambió`);
  });
}

/** Cerrar la app y volver: el recálculo al entrar corre una vez por sesión.
    Antes de recargar se espera a que lo guardado YA esté en localStorage (las
    tres listas); después, se comprueba que la recarga lo encontró. Si no lo
    encontró, se dice: no es un defecto de VAL-85. */
async function recargar(page) {
  await page.waitForFunction(() => {
    try { const d = JSON.parse(localStorage.getItem("valija.v1") || "{}");
          return ["x", "m1", "m2"].every(i => d.packing && d.packing[i] && Object.keys(d.packing[i].items || {}).length); }
    catch (e) { return false; }
  }, null, { timeout:8000 });
  await page.reload();
  await page.waitForFunction(() => typeof Store !== "undefined" && Store.ready);
  const rama = await page.evaluate(() => window.__semilla);
  if (rama !== "ya había") throw new Error("la recarga no encontró valija.v1 (la semilla dice: " + rama + "). Es la falla de VAL-86, no de VAL-85");
}

async function flujoEntrar(browser, archivo, opciones) {
  const page = await nuevaPagina(browser, archivo, false);
  await crecerHistorial(page, opciones);
  await recargar(page);
  const t = await leerLosCinco(page);
  const lista = await page.evaluate(() => Store.packingOf("x"));
  await page.close();
  return { t, lista };
}
async function flujoGuardar(browser, archivo, opciones, ia) {
  const page = await nuevaPagina(browser, archivo, ia);
  await crecerHistorial(page, opciones);
  const antes = await page.evaluate(() => window.__iaPreguntas);
  await cargarReserva(page, "x", "note", { i_title:"Ideas para el viaje" });
  await page.waitForFunction(() => !!App.plan, null, { timeout:8000 }).catch(() => {});
  const plan = await page.evaluate(() => App.plan && {
    nuevos:App.plan.nuevos.map(n => n.origen), sacados:App.plan.sacados.map(s => s.nombre + " [" + s.causa + "]") });
  const preguntas = (await page.evaluate(() => window.__iaPreguntas)) - antes;
  const tira = await page.locator("#vjentry .s").innerText().catch(() => "");
  const t = await leerLosCinco(page);
  await page.close();
  return { plan, preguntas, tira, t };
}

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
    console.log("HTML bajo prueba: " + HTML);
    console.log("build anterior:   git show " + ANTES + ":app/valija.html");

    await bloque("CONTROL NEGATIVO · el build anterior SÍ dice «El viaje cambió» (la reproducción llegó)", async () => {
      const { t, lista } = await flujoEntrar(browser, HTML_ANTES, {});
      mostrar(t);
      const cam = Object.keys(lista.items).find(k => /^camara/.test(k));
      ok(!!cam && lista.items[cam].estado === "pendiente", "x tiene la cámara pendiente: se armó antes de aprender");
      ok(DICE_CAMBIO.test(t.aviso) && DICE_CAMBIO.test(t.motivo) && DICE_CAMBIO.test(t.tira),
         "en " + ANTES + " el aviso, el motivo y la tira afirman que el viaje cambió: el defecto está reproducido");
    });

    await bloque("A · sólo saca: entrar a la valija después de recargar", async () => {
      const { t, lista } = await flujoEntrar(browser, HTML, {});
      mostrar(t);
      const cam = Object.keys(lista.items).find(k => /^camara/.test(k));
      ok(!!cam && lista.items[cam].estado === "pendiente", "la lista de x sigue sin tocar: no se aplicó nada solo");
      diceLoAprendido(t, "saca", "entrar");
    });

    await bloque("B · sólo saca: guardar una reserva que no mueve nada (una nota), sin IA", async () => {
      const r = await flujoGuardar(browser, HTML, {}, false);
      info("plan: " + JSON.stringify(r.plan));
      ok(!!r.plan && r.plan.nuevos.length === 0 && r.plan.sacados.length === 1 && /\[aprendido\]$/.test(r.plan.sacados[0]),
         "el plan saca la cámara, con causa aprendido");
      info("tira al guardar: " + JSON.stringify(r.tira));
      diceLoAprendido({ tira:r.tira }, "saca", "guardar");
      mostrar(r.t);
      diceLoAprendido(r.t, "saca", "guardar");
    });

    await bloque("B-IA · lo mismo CON capa de IA: la causa sobrevive al recálculo de `planListUpdateAsync`", async () => {
      const r = await flujoGuardar(browser, HTML, {}, true);
      info("plan: " + JSON.stringify(r.plan) + " · preguntas a la IA al guardar: " + r.preguntas);
      ok(r.preguntas >= 1, "guardar la nota le preguntó a la IA: el plan pasó por el camino async");
      ok(!!r.plan && r.plan.sacados.length === 1 && /\[aprendido\]$/.test(r.plan.sacados[0]),
         "después del recálculo, la cámara sigue con causa aprendido");
      diceLoAprendido({ tira:r.tira }, "saca", "guardar con IA");
      mostrar(r.t);
      diceLoAprendido({ motivo:r.t.motivo, aviso:r.t.aviso, hoja:r.t.hoja, soloLectura:r.t.soloLectura }, "saca", "guardar con IA");
    });

    await bloque("E · las dos (Termo agregado y cámara descartada en los otros dos), entrando", async () => {
      const { t } = await flujoEntrar(browser, HTML, { termo:true });
      mostrar(t);
      diceLoAprendido(t, "ambas", "entrar");
    });

    await bloque("E · las dos, guardando una nota", async () => {
      const r = await flujoGuardar(browser, HTML, { termo:true }, false);
      info("plan: " + JSON.stringify(r.plan));
      ok(!!r.plan && r.plan.nuevos.join() === "historial" && r.plan.sacados.length === 1, "suma uno del historial y saca uno");
      diceLoAprendido({ tira:r.tira }, "ambas", "guardar");
      diceLoAprendido(r.t, "ambas", "guardar");
    });

    /* Los cinco textos de un cambio de verdad, en este build y en el anterior. */
    async function borrarVueloYLeer(archivo, opciones, alEntrar) {
      const page = await nuevaPagina(browser, archivo, false);
      await crecerHistorial(page, Object.assign({ vuelos:true }, opciones));
      let entrar = null;
      if (alEntrar) {
        await recargar(page);
        entrar = await leerLosCinco(page);
      }
      await borrarElVuelo(page, "x");
      const plan = await page.evaluate(() => App.plan && {
        nuevos:App.plan.nuevos.map(n => n.nombre), sacados:App.plan.sacados.map(s => s.nombre + " [" + s.causa + "]") });
      const t = await leerLosCinco(page);
      await page.close();
      return { entrar, plan, t };
    }

    await bloque("C · CONTROL: borrar el vuelo saca los líquidos, y los cinco textos son los de antes", async () => {
      /* Se descarta la cámara en los otros dos, como en A, y además se borra
         el vuelo: el plan saca la cámara (lo aprendido) Y los líquidos (el
         viaje cambió). Es el criterio 5 del brief por el gesto: con al menos
         un cambio que no es de lo aprendido, el texto de hoy se queda igual.
         Los líquidos no se descartaron en ningún lado. */
      const ahora = await borrarVueloYLeer(HTML, { quitar:"camara" }, false);
      const antes = await borrarVueloYLeer(HTML_ANTES, { quitar:"camara" }, false);
      info("plan: " + JSON.stringify(ahora.plan));
      mostrar(ahora.t);
      ok(!!ahora.plan && ahora.plan.sacados.some(s => /^Líquidos.*\[viaje\]$/.test(s)), "los líquidos salen con causa viaje");
      Object.keys(NOMBRES).forEach(k => ok(!!ahora.t[k] && ahora.t[k] === antes.t[k], `${NOMBRES[k]}: idéntico al build anterior`));
      ok(DICE_CAMBIO.test(ahora.t.aviso) && DICE_CAMBIO.test(ahora.t.tira), "y dice que el viaje cambió");
    });

    await bloque("D · EL VECINO: líquidos descartados en los otros dos Y borrar el vuelo de x", async () => {
      const ahora = await borrarVueloYLeer(HTML, { quitar:"liquido" }, true);
      const antes = await borrarVueloYLeer(HTML_ANTES, { quitar:"liquido" }, false);
      info("al entrar, con el vuelo todavía cargado:");
      mostrar(ahora.entrar);
      diceLoAprendido(ahora.entrar, "saca", "vecino, antes de borrar");
      info("plan después de borrar el vuelo: " + JSON.stringify(ahora.plan));
      mostrar(ahora.t);
      ok(!!ahora.plan && ahora.plan.sacados.length === 1 && /^Líquidos.*\[viaje\]$/.test(ahora.plan.sacados[0]),
         "sin el vuelo, los líquidos salen con causa viaje: sin lo aprendido se irían igual");
      Object.keys(NOMBRES).forEach(k => ok(!!ahora.t[k] && ahora.t[k] === antes.t[k], `${NOMBRES[k]}: idéntico al build anterior`));
      ok(!/descart/i.test(Object.values(ahora.t).join(" ")), "y ninguno se lo atribuye a lo descartado");
    });
  } finally {
    if (browser) await browser.close();
    console.log("\n====================================================");
    console.log(fallos ? `  ${fallos} FALLARON (${pasaron} pasaron)` : `  Todo en verde — ${pasaron} aserciones`);
    console.log("====================================================\n");
    process.exit(fallos ? 1 : 0);
  }
})();
