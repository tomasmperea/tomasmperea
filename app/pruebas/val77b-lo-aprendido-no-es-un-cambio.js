/* ============================================================
   VAL-77b — LO APRENDIDO DE OTROS VIAJES NO ES "EL VIAJE CAMBIÓ"

   El defecto, reproducido por la coordinación contra el motor de antes
   (e3ed0a4) y el de VAL-77b (ec0a390), con el mismo historial y el mismo
   viaje SIN TOCAR:

     antes de 77b: desactualizada=false, "La lista sigue al día…"
     con 77b:      desactualizada=true,  "El viaje cambió: sumo 1 ítem."

   La regla nueva hace que una lista guardada tenga algo para sumar cuando
   crece el historial, y cinco textos le decían a la persona que el VIAJE
   cambió: una causa inventada. Los cinco, encontrados con
   `grep -n -i "viaje cambi\|cambió el viaje"` sobre app/valija.html:

     1 · el motivo del plan (`motivoDelPlan`, motor)
     2 · la tira de entrada a la valija (pantalla del viaje)
     3 · el aviso de adentro de la valija (`planAvisoTexto`; el del pie usa
         la misma función)
     4 · el aviso de sólo lectura
     5 · la hoja "De dónde sale esta lista"

   Cada uno tiene su aserción, por los DOS disparadores que calculan el plan:
     A · entrar a la valija (`recalcularPlanAlEntrar`), después de recargar
     B · guardar una reserva que no mueve nada (`checkPackingPlan`)

   El historial crece con el dedo: se arma el viaje, se arman otros dos de
   montaña, se agrega «Termo» a mano en cada uno, y se vuelve al primero.

   LOS CONTROLES, que un cambio de VERDAD siga diciendo lo de antes:
     C · cargar un vuelo EZE → MAD: los textos son EXACTAMENTE los que daba el
         build anterior al arreglo (`git show ec0a390`), corrido acá mismo
     D · cambiar el destino a Madrid desde la hoja del viaje, con el historial
         ya crecido (plan mixto: reglas + lo aprendido): los cinco textos
         siguen diciendo que el viaje cambió

   EL CONTROL NEGATIVO va adentro: el caso A se corre también contra
   `git show ec0a390` y tiene que DECIR "El viaje cambió". Si no lo dice, la
   reproducción no llegó y este arnés no prueba nada. Y afuera, sacándole la
   distinción a la copia de ahora:

     python3 - <<'EOF'
     s = open("app/valija.html").read()
     v = "function planSoloAprendido(nuevos, sacados) {\n  nuevos = nuevos || [];\n"
     assert s.count(v) == 1
     open("/tmp/sin-distincion.html","w").write(s.replace(v, v + "  return false;\n"))
     EOF
     NODE_PATH=/opt/node22/lib/node_modules \
       node app/pruebas/val77b-lo-aprendido-no-es-un-cambio.js /tmp/sin-distincion.html
     -> 11 FALLA: los cinco textos por el camino A, los cinco por el B, y
        la frase del aviso. Corrido el 26/09.

   Y un sabotaje POR SITIO (la condición de ese sitio cambiada por `false`),
   para que ninguna de las cinco aserciones pase de arrastre: tira 2 FALLA,
   aviso 3, sólo lectura 2, hoja 2, motivo 2 — cada una en los dos caminos.

   LO QUE NO PRUEBA: Chromium de escritorio sobre file://, sin base y sin
   IA (`claude.use` devuelve null). No es el teléfono.

       NODE_PATH=/opt/node22/lib/node_modules \
         node app/pruebas/val77b-lo-aprendido-no-es-un-cambio.js [ruta/al/valija.html]
   ============================================================ */
"use strict";

const { chromium } = require("playwright");
const fs = require("fs"), path = require("path"), os = require("os"), cp = require("child_process");

const RAIZ = path.resolve(__dirname, "..", "..");
const HTML = process.argv[2] ? path.resolve(process.argv[2]) : path.join(RAIZ, "app", "valija.html");
const ANTES = "ec0a390";
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

/* Los viajes, con lo que pide `sheetTrip`. */
const VIAJE = (id, name, destination, startDate, endDate) =>
  ({ id, name, destination, startDate, endDate, hue:200, travelers:"Tomás" });
const SEMILLA = { trips:[
  VIAJE("x", "Mendoza", "Mendoza", "2027-07-01", "2027-07-08"),
  VIAJE("m1", "Esquel", "Esquel", "2027-08-01", "2027-08-08"),
  VIAJE("m2", "Bariloche", "Bariloche", "2027-09-01", "2027-09-08")
] };

async function nuevaPagina(browser, archivo) {
  const page = await browser.newPage({ viewport:{ width:390, height:844 }, hasTouch:true, isMobile:true });
  await page.route("**/*", r => (/^file:/.test(r.request().url()) ? r.continue() : r.abort()));
  page.on("pageerror", e => { console.log("  !! pageerror: " + e.message); fallos++; });
  await page.addInitScript(() => { window.claude = { use: async () => null }; });
  await page.addInitScript(s => {
    try {
      if (!localStorage.getItem("valija.v1")) {
        const items = {}; s.trips.forEach(t => { items[t.id] = []; });
        localStorage.setItem("valija.v1", JSON.stringify({ trips:s.trips, items, packing:{} }));
      }
    } catch (e) {}
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
async function agregarTermo(page, id) {
  await page.locator('[data-pkadd="ropa"]').click();
  await page.locator("#pk-add-ropa").fill("Termo");
  await page.locator('[data-pksave="ropa"]').click();
  await page.waitForFunction(i => { const l = Store.packingOf(i); return !!(l && l.items && l.items[PackingEngine.slug("Termo")]); }, id);
  await page.waitForTimeout(200);
}
/** El historial crece con el dedo: x se arma primero, después dos viajes de
    montaña con «Termo» agregado a mano. x queda guardada y sin tocar. */
async function crecerHistorial(page) {
  await armar(page, "x", ["montana", "ciudad"]);
  await armar(page, "m1", ["montana"]); await agregarTermo(page, "m1");
  await armar(page, "m2", ["montana"]); await agregarTermo(page, "m2");
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
const mostrar = t => Object.keys(t).forEach(k => info(`${k.padEnd(11)} ${JSON.stringify(t[k].replace(/\s+/g, " ").trim())}`));
const DICE_CAMBIO = /viaje cambi|cambió el viaje/i;
const DICE_APRENDIDO = /otros viajes/i;

function sinCausaInventada(t, camino) {
  const sitios = [["motivo", "1 · el motivo del plan"], ["tira", "2 · la tira de entrada"], ["aviso", "3 · el aviso de la valija"],
                  ["soloLectura", "4 · el aviso de sólo lectura"], ["hoja", "5 · «De dónde sale esta lista»"]];
  sitios.forEach(([k, nombre]) => {
    if (t[k] === undefined) return;
    ok(!!t[k] && !DICE_CAMBIO.test(t[k]) && DICE_APRENDIDO.test(t[k]),
       `[${camino}] ${nombre}: no dice que el viaje cambió, y nombra lo aprendido`);
  });
}

async function flujoEntrar(browser, archivo) {
  const page = await nuevaPagina(browser, archivo);
  await crecerHistorial(page);
  // Cerrar la app y volver: el recálculo al entrar corre una vez por sesión.
  await page.reload();
  await page.waitForFunction(() => typeof Store !== "undefined" && Store.ready);
  const t = await leerLosCinco(page);
  const lista = await page.evaluate(() => Store.packingOf("x"));
  await page.close();
  return { t, lista };
}

async function cargarReserva(page, tipo, campos) {
  await ir(page, "#/trip/x");
  await page.locator("#additem").click();
  await page.waitForSelector("#i_title", { timeout:10000 });
  await page.locator(`#tp button[data-t="${tipo}"]`).click();
  await page.waitForTimeout(150);
  for (const [id, v] of Object.entries(campos)) await page.locator("#" + id).fill(v);
  await page.locator("#save").click();
  await page.waitForFunction(() => !!App.plan, null, { timeout:8000 }).catch(() => {});
  await page.waitForTimeout(600);
}

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
    console.log("HTML bajo prueba: " + HTML);
    console.log("build anterior:   git show " + ANTES + ":app/valija.html");

    await bloque("CONTROL NEGATIVO · el build anterior al arreglo SÍ dice «El viaje cambió» (la reproducción llegó)", async () => {
      const { t } = await flujoEntrar(browser, HTML_ANTES);
      mostrar(t);
      ok(DICE_CAMBIO.test(t.aviso) && DICE_CAMBIO.test(t.motivo) && DICE_CAMBIO.test(t.tira),
         "en ec0a390 el aviso, el motivo y la tira afirman que el viaje cambió: el defecto está reproducido");
    });

    await bloque("A · entrar a la valija después de que el historial creció", async () => {
      const { t, lista } = await flujoEntrar(browser, HTML);
      mostrar(t);
      ok(lista && lista.tipoViaje === "ciudad+montana" && !lista.items[Object.keys(lista.items).find(k => /^termo/.test(k)) || "__"],
         "la lista del viaje sigue sin tocar: no se aplicó nada solo");
      sinCausaInventada(t, "entrar");
      ok(/Por lo que agregaste a mano en otros viajes, tengo/.test(t.aviso), "el aviso dice qué pasó, en una frase");
      ok(/1 cosa|una cosa/.test(t.aviso.replace(/\s+/g, " ")), "y cuántas cosas son");
    });

    await bloque("B · guardar una reserva que no mueve nada (una nota)", async () => {
      const page = await nuevaPagina(browser, HTML);
      await crecerHistorial(page);
      await cargarReserva(page, "note", { i_title:"Ideas para el viaje" });
      const plan = await page.evaluate(() => App.plan && { nuevos:App.plan.nuevos.map(n => n.origen), sacados:App.plan.sacados.length });
      info("plan: " + JSON.stringify(plan));
      ok(!!plan && plan.nuevos.every(o => o === "historial") && plan.sacados === 0, "el plan trae sólo lo aprendido");
      const tira = await page.locator("#vjentry .s").innerText().catch(() => "");
      info("tira:  " + JSON.stringify(tira));
      sinCausaInventada({ tira }, "guardar");
      const t = await leerLosCinco(page);
      mostrar(t);
      sinCausaInventada({ motivo:t.motivo, aviso:t.aviso, hoja:t.hoja, soloLectura:t.soloLectura }, "guardar");
      await page.close();
    });

    await bloque("C · CONTROL: cargar un vuelo dice exactamente lo que decía antes", async () => {
      const vuelo = { i_title:"Vuelo a Madrid", i_from:"EZE", i_to:"MAD", i_start:"2027-07-01T22:10", i_end:"2027-07-02T14:35", i_provider:"Iberia" };
      const correr = async archivo => {
        const page = await nuevaPagina(browser, archivo);
        await crecerHistorial(page);
        await cargarReserva(page, "flight", vuelo);
        const t = await leerLosCinco(page);
        await page.close();
        return t;
      };
      const ahora = await correr(HTML), antes = await correr(HTML_ANTES);
      mostrar(ahora);
      ["motivo", "tira", "aviso", "soloLectura", "hoja"].forEach(k =>
        ok(ahora[k] === antes[k] && !!ahora[k], `${k}: idéntico al build anterior`));
      ok(!DICE_APRENDIDO.test(Object.values(ahora).join(" ")), "y ninguno atribuye el cambio a otros viajes");
    });

    await bloque("D · CONTROL: cambiar el destino, con el historial ya crecido (plan mixto)", async () => {
      const page = await nuevaPagina(browser, HTML);
      await crecerHistorial(page);
      await ir(page, "#/trip/x");
      await page.locator("#edittrip").click();
      await page.waitForSelector("#t_dest");
      await page.locator("#t_dest").fill("Madrid, España");
      await page.locator("#save").click();
      await page.waitForFunction(() => !!App.plan, null, { timeout:8000 }).catch(() => {});
      await page.waitForTimeout(500);
      const origenes = await page.evaluate(() => App.plan ? App.plan.nuevos.map(n => n.origen) : []);
      info("orígenes del plan: " + JSON.stringify(origenes));
      ok(origenes.indexOf("historial") >= 0 && origenes.indexOf("regla") >= 0, "el plan es mixto: reglas por el destino, y lo aprendido");
      const t = await leerLosCinco(page);
      mostrar(t);
      ok(/^El viaje cambió: /.test(t.motivo), "1 · el motivo sigue diciendo que el viaje cambió");
      ok(t.tira === "El viaje cambió", "2 · la tira también");
      ok(/^El viaje cambió y la lista quedó vieja/.test(t.aviso.trim()), "3 · y el aviso");
      ok(/el viaje cambió después de que se armó/.test(t.soloLectura), "4 · y el de sólo lectura");
      ok(/cuando cambió el viaje\.$/.test(t.hoja.trim()), "5 · y la hoja");
      await page.close();
    });
  } finally {
    if (browser) await browser.close();
    console.log("\n====================================================");
    console.log(fallos ? `  ${fallos} FALLARON (${pasaron} pasaron)` : `  Todo en verde — ${pasaron} aserciones`);
    console.log("====================================================\n");
    process.exit(fallos ? 1 : 0);
  }
})();
