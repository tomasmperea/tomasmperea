/* ============================================================
   VAL-77b — CADA ÍTEM SABE A QUÉ PARTE DEL VIAJE PERTENECE

   El gesto de esta historia NO se ve en la pantalla donde ocurre: se ve en
   el viaje siguiente. Así que este arnés arma VARIOS viajes seguidos,
   tocando la grilla de tipos, «Armar la lista», los chips de «Es para» y
   «Agregar», y recién después lee la lista del último viaje.

   Ninguna parte llama a `addManualItem` por dentro. Lo único que se lee por
   dentro es el resultado (`Store.packingOf`), para decir QUÉ quedó guardado.

   Los nueve casos del brief, cada uno con su bloque:
     1 · montaña+ciudad: agregar «Buzo polar» tocando Montaña
     2 · montaña sola: agregar «Buzo polar» sin pregunta -> se guarda para montaña
     3 · otro montaña: «Buzo polar» aparece, de historial, y el motivo dice
         montaña. EL CASO DE ÉXITO: antes de VAL-77b no aparecía
     4 · ciudad sola: «Buzo polar» NO aparece. El control
     5 · lo guardado hoy no pierde nada: dos montaña+ciudad con un ítem SIN
         parte —guardado ANTES de esta historia (campo ausente) y agregado
         AHORA sin elegir (campo vacío)— y el tercero lo sigue sugiriendo
     6 · un viaje de un tipo: el formulario no tiene la fila, y mide lo mismo
         que en el build anterior (se mide contra `git show 38ae74f`)
     7 · «Las dos», por la HOJA del botón grande: cuenta para montaña y ciudad
     8 · sin elegir: se agrega igual, sin chip, y no cuenta para otra combinación
     9 · lo descartado no cambia: descartar en dos montaña+ciudad lo saca del
         tercero, y NO lo saca de un montaña solo

   Y los vecinos del brief que se tocan con el dedo: re-agregar un propio
   eligiendo parte (2), cambiar el tipo del viaje después (3), rehacer la
   lista (4), la cuenta de la hoja «De dónde sale esta lista» (5). Más sólo
   lectura, foco visible, y los dos temas.

   DOS MODOS, porque los dos son caminos reales:
     · sin base y sin IA  — `claude.use()` devuelve null para todo
     · base compartida    — `app/parts/db-mock.js`, el simulador escrito
                            contra el contrato; el historial se lee con get()

   LOS FIXTURES SE ESCRIBIERON LEYENDO EL FORMULARIO. Un viaje: nombre,
   destino, salida, regreso (`sheetTrip`). El ítem propio lo escribe la app.
   El único fixture a mano es la lista guardada ANTES de esta historia (caso
   5), y tiene los campos de `makeItem` + `addManualItem` de 38ae74f, SIN
   `paraTipos`: es exactamente lo que hay guardado hoy. No usa `lodging`
   (VAL-82): acá no hay reservas.

   ------------------------------------------------------------
   LOS CONTROLES NEGATIVOS — corridos, y con lo que dan
   ------------------------------------------------------------
   Cada uno se aplica con python y ASEVERA que el texto estaba una sola vez,
   así un sabotaje que no llegó no pasa por verde. Corridos el 26/09 sobre
   el árbol de esta entrega, con estos resultados (75 aserciones en total):

     python3 - <<'EOF'
     s = open("app/valija.html").read()
     v = "const paraTipos = pkParaAlGuardar(list, PK.addPara);"
     assert s.count(v) == 1
     open("/tmp/c1.html","w").write(s.replace(v, "const paraTipos = [];"))
     EOF
       1 · el formulario de la categoría no manda la parte -> 24 FALLA
           (casos 1, 2 y 3 en los DOS modos, el re-agregar, rehacer, el chip
           en los dos temas y en sólo lectura, el cambio de tipo, recargar)

     v = "paraTipos:pkParaAlGuardar(list, para)}"   ->  "paraTipos:[]}"
       2 · la hoja del botón grande no manda la parte -> 5 FALLA (caso 7)

     v = "  const aca = partes.filter(p=> declaradas.indexOf(p) >= 0);"
         -> "  const aca = declaradas;"
       3 · el chip de la fila deja de mirar las partes del viaje -> 1 FALLA
           (el vecino 3: afirma "para montaña" en un playa+ciudad)

       NODE_PATH=/opt/node22/lib/node_modules \
         node app/pruebas/val77b-la-parte-del-viaje.js [ruta/al/valija.html]

   ------------------------------------------------------------
   LO QUE ESTE ARNÉS NO PRUEBA — dicho de frente
   ------------------------------------------------------------
   · Chromium de escritorio sobre `file://`, con viewport de teléfono y
     toque, no es el teléfono. Ver CLAUDE.md, "La palabra verificado".
   · `db-mock.js` replica el contrato; no es la base de verdad.
   · No hay IA: la capa de destino no corre. Lo que se prueba es el
     aprendizaje, que no la usa.
   ============================================================ */
"use strict";

const { chromium } = require("playwright");
const fs = require("fs"), path = require("path"), os = require("os"), cp = require("child_process");

const RAIZ = path.resolve(__dirname, "..", "..");
const HTML = process.argv[2] ? path.resolve(process.argv[2]) : path.join(RAIZ, "app", "valija.html");
const APP = "file://" + HTML;
const DB_MOCK = fs.readFileSync(path.join(RAIZ, "app", "parts", "db-mock.js"), "utf8");

let fallos = 0, pasaron = 0;
const ok = (c, m) => { if (c) { pasaron++; console.log("  ok     " + m); } else { fallos++; console.log("  FALLA  " + m); } };
const info = m => console.log("  info   " + m);
async function bloque(nombre, fn) {
  console.log("\n· " + nombre);
  try { await fn(); }
  catch (e) { fallos++; console.log("  FALLA (excepción) " + (e && e.message)); console.log(e && e.stack); }
}

/* ---------- los viajes: lo que pide `sheetTrip` ---------- */
const VIAJE = (id, name, destination, startDate, endDate) =>
  ({ id, name, destination, startDate, endDate, hue:200, travelers:"Tomás" });

/* ---------- la página ---------- */
async function nuevaPagina(browser, semilla, modo) {
  const page = await browser.newPage({ viewport:{ width:390, height:844 }, hasTouch:true, isMobile:true });
  await page.route("**/*", r => (/^file:/.test(r.request().url()) ? r.continue() : r.abort()));
  page.on("pageerror", e => { console.log("  !! pageerror: " + e.message); fallos++; });
  if (modo === "base") {
    await page.addInitScript(DB_MOCK);
    await page.addInitScript(s => {
      const st = window.__store;
      Object.keys(st).forEach(k => delete st[k]);          // sin el viaje de ejemplo del simulador
      s.trips.forEach(t => { const d = Object.assign({}, t); delete d.id; st["trips/" + t.id] = d; });
      Object.keys(s.packing || {}).forEach(id => { st["trips/" + id + "/packing/lista"] = s.packing[id]; });
    }, semilla);
  } else {
    await page.addInitScript(() => { window.claude = { use: async () => null }; });
    await page.addInitScript(s => {
      try {
        if (!localStorage.getItem("valija.v1")) {
          const items = {}; s.trips.forEach(t => { items[t.id] = []; });
          localStorage.setItem("valija.v1", JSON.stringify({ trips:s.trips, items, packing:s.packing || {} }));
        }
      } catch (e) {}
    }, semilla);
  }
  await page.goto(APP);
  await page.waitForFunction(() => typeof Store !== "undefined" && Store.ready, null, { timeout:15000 });
  await page.waitForTimeout(modo === "base" ? 900 : 200);
  return page;
}

const ir = async (page, hash) => { await page.goto(APP + hash); await page.waitForTimeout(450); };
const clave = (page, nombre) => page.evaluate(n => PackingEngine.slug(n), nombre);
const itemDe = (page, id, nombre) => page.evaluate(([i, n]) => {
  const l = Store.packingOf(i); return l && l.items ? (l.items[PackingEngine.slug(n)] || null) : null;
}, [id, nombre]);
/* Con la base compartida, cada escritura vuelve por un snapshot que
   re-renderiza la pantalla. Un render con el formulario abierto borra lo que
   estaba escrito en el campo (defecto PREEXISTENTE, anotado en la entrega de
   VAL-77b: el campo nunca guardó su texto entre renders). Una persona tarda
   segundos en escribir y el snapshot llega antes; este arnés tarda
   milisegundos. Así que se espera a que no quede ninguna escritura en vuelo,
   que es lo que pasa en la mano de la persona, y no se esconde el defecto:
   se declara. */
const esperarLista = async (page, id) => {
  await page.waitForFunction(i => {
    const l = Store.packingOf(i);
    return !!(l && l.items && Object.keys(l.items).length) && !PK.generating && !Store.pending.size;
  }, id, { timeout:15000 });
  if (await page.evaluate(() => !!Store.db)) await page.waitForTimeout(900);
};

/** Que el ítem esté en la lista Y en pantalla. Con la base compartida la
    escritura vuelve por el snapshot, que tarda: se espera al dato, no a un reloj. */
const esperarItem = async (page, id, nombre) => {
  await page.waitForFunction(([i, n]) => { const l = Store.packingOf(i);
    return !!(l && l.items && l.items[PackingEngine.slug(n)]); }, [id, nombre], { timeout:8000 });
  await page.waitForTimeout(600);
};

/** EL GESTO de marcar exactamente estos tipos en la grilla: destildar lo que
    sobra primero (el tope es dos) y tildar lo que falta. */
async function marcarTipos(page, tipos) {
  const marcadas = () => page.$$eval('#pk-tp [data-t][aria-pressed="true"]', els => els.map(e => e.dataset.t));
  for (const t of await marcadas()) if (tipos.indexOf(t) < 0) { await page.locator(`#pk-tp [data-t="${t}"]`).click(); await page.waitForTimeout(120); }
  for (const t of tipos) if ((await marcadas()).indexOf(t) < 0) { await page.locator(`#pk-tp [data-t="${t}"]`).click(); await page.waitForTimeout(120); }
  return marcadas();
}

/** EL GESTO de armar la valija de un viaje nuevo. */
async function armar(page, id, tipos) {
  await ir(page, "#/trip/" + id + "/valija");
  await page.waitForSelector("#pk-tp", { timeout:10000 });
  const m = await marcarTipos(page, tipos);
  await page.locator("#pk-build").click();
  await esperarLista(page, id);
  await page.waitForTimeout(350);
  return m;
}

/** Abre el formulario de la categoría, si no está abierto ya. */
async function abrirFormulario(page, cat) {
  if (!(await page.locator(`#pk-add-${cat}`).count())) await page.locator(`[data-pkadd="${cat}"]`).click();
  await page.waitForSelector(`#pk-add-${cat}`, { timeout:5000 });
}

/** EL GESTO de agregar desde adentro de la categoría: tocar «Agregar a …»,
    escribir, tocar el chip (si hay que elegir) y tocar «Agregar». */
async function agregarEnCategoria(page, id, cat, nombre, chip) {
  await abrirFormulario(page, cat);
  await page.locator(`#pk-add-${cat}`).fill(nombre);
  if (chip) await page.locator("#main .pk-para button", { hasText:chip }).click();
  await page.locator(`[data-pksave="${cat}"]`).click();
  await page.waitForFunction(([i, n]) => { const l = Store.packingOf(i);
    return !!(l && l.items && l.items[PackingEngine.slug(n)] && l.items[PackingEngine.slug(n)].estado === "pendiente"); },
    [id, nombre], { timeout:5000 });
  await page.waitForTimeout(250);
}

/** EL GESTO de agregar por la hoja del botón grande de abajo. */
async function agregarPorHoja(page, id, nombre, cat, chip) {
  await page.locator("#pk-additem").click();
  await page.waitForSelector("#pk_new_nombre", { timeout:5000 });
  await page.locator("#pk_new_nombre").fill(nombre);
  await page.locator("#pk_new_cat").selectOption(cat);
  if (chip) await page.locator("#modal .pk-para button", { hasText:chip }).click();
  await page.locator("#save").click();
  await page.waitForFunction(([i, n]) => { const l = Store.packingOf(i);
    return !!(l && l.items && l.items[PackingEngine.slug(n)]); }, [id, nombre], { timeout:5000 });
  await page.waitForTimeout(250);
}

/* Por el texto de la fila y no por `data-row`: sin permiso de edición la
   fila no lleva `data-row`, y el chip se tiene que poder leer igual. */
const chipDeFila = async (page, nombre) => {
  const loc = page.locator(".pk-row", { has: page.locator(".pk-nm .t", { hasText: new RegExp("^" + nombre + "$") }) }).locator(".chip.parte");
  return (await loc.count()) ? (await loc.first().innerText()).trim() : "";
};
const paraDe = async (page, id, nombre) => { const it = await itemDe(page, id, nombre); return it ? JSON.stringify(it.paraTipos) : "(no está)"; };

/* ═════════════════════ MUNDO A · casos 1 a 4, y los vecinos ═════════════════════ */
const MUNDO_A = { trips:[
  VIAJE("a1", "Andes y Santiago", "Chile", "2027-07-01", "2027-07-10"),
  VIAJE("a2", "Bariloche", "Bariloche", "2027-08-01", "2027-08-08"),
  VIAJE("a3", "El Chaltén", "El Chaltén", "2027-09-01", "2027-09-07"),
  VIAJE("a4", "Buenos Aires", "Buenos Aires", "2027-10-01", "2027-10-05")
] };

async function mundoA(browser, modo) {
  const page = await nuevaPagina(browser, MUNDO_A, modo);

  await bloque(`[${modo}] CASO 1 · montaña+ciudad: agregar «Buzo polar» tocando Montaña`, async () => {
    const m = await armar(page, "a1", ["montana", "ciudad"]);
    info("tipos marcados: " + JSON.stringify(m));
    await page.locator('[data-pkadd="ropa"]').click();
    await page.waitForSelector("#pk-add-ropa");
    const chips = await page.$$eval("#main .pk-para button", els => els.map(e => [e.innerText.trim(), e.getAttribute("aria-pressed")]));
    info("la fila de chips: " + JSON.stringify(chips));
    ok(chips.length === 3, "la fila tiene las dos partes del viaje y «Las dos»");
    ok(chips.every(c => c[1] === "false"), "sin selección por defecto");
    ok(!(await page.locator('[data-pksave="ropa"]').isDisabled()), "«Agregar» está habilitado sin elegir");
    await page.locator("#pk-add-ropa").fill("Buzo polar");
    await page.locator("#main .pk-para button", { hasText:"Montaña" }).click();
    ok(await page.locator("#pk-add-ropa").inputValue() === "Buzo polar", "tocar el chip no borra lo escrito");
    ok(await page.locator("#main .pk-para button", { hasText:"Montaña" }).getAttribute("aria-pressed") === "true",
       "el chip tocado queda marcado");
    await page.locator('[data-pksave="ropa"]').click();
    await esperarItem(page, "a1", "Buzo polar");
    ok(await paraDe(page, "a1", "Buzo polar") === '["montana"]', `se guardó para montaña: ${await paraDe(page, "a1", "Buzo polar")}`);
    ok(await chipDeFila(page, "Buzo polar") === "para montaña", `la fila lo dice: «${await chipDeFila(page, "Buzo polar")}»`);
    ok(await page.locator("#main .pk-para").count() === 0, "y la fila de chips se va con el formulario");
  });

  await bloque(`[${modo}] CASO 2 · montaña sola: «Buzo polar» sin pregunta`, async () => {
    await armar(page, "a2", ["montana"]);
    await page.locator('[data-pkadd="ropa"]').click();
    await page.waitForSelector("#pk-add-ropa");
    ok(await page.locator(".pk-para").count() === 0, "con un tipo no hay fila de chips");
    await page.locator("#pk-add-ropa").fill("Buzo polar");
    await page.locator('[data-pksave="ropa"]').click();
    await esperarItem(page, "a2", "Buzo polar");
    ok(await paraDe(page, "a2", "Buzo polar") === '["montana"]', `se guardó para montaña sin preguntar: ${await paraDe(page, "a2", "Buzo polar")}`);
    ok(await chipDeFila(page, "Buzo polar") === "", "y en un viaje de un tipo la fila no lleva chip de parte");
  });

  await bloque(`[${modo}] CASO 3 · otro montaña: «Buzo polar» aparece (el caso de éxito)`, async () => {
    await armar(page, "a3", ["montana"]);
    const it = await itemDe(page, "a3", "Buzo polar");
    ok(!!it, "«Buzo polar» está en la lista del viaje nuevo");
    ok(it && it.origen === "historial", `de origen historial: ${it && it.origen}`);
    info("motivo: " + JSON.stringify(it && it.motivo));
    ok(it && /viajes de montaña\./.test(it.motivo), "y el motivo dice montaña");
    const fila = page.locator(`.pk-row[data-row="${await clave(page, "Buzo polar")}"]`);
    ok(await fila.count() === 1 && /tus viajes/.test(await fila.innerText()), "en pantalla, con el chip «tus viajes»");
    await page.locator("#pk-info").click();
    await page.waitForTimeout(250);
    const chips = await page.$$eval("#modal .pk-inputs .chip", els => els.map(e => e.innerText.trim()));
    info("«De dónde sale esta lista»: " + JSON.stringify(chips));
    ok(chips.indexOf("2 viajes de montaña anteriores") >= 0, "la hoja cuenta los dos viajes que se leyeron, el mixto incluido");
    await page.locator("#closeSheet").click();
  });

  await bloque(`[${modo}] CASO 4 · ciudad sola: «Buzo polar» NO aparece (el control)`, async () => {
    await armar(page, "a4", ["ciudad"]);
    ok(await itemDe(page, "a4", "Buzo polar") === null, "lo declarado para montaña no se sugiere en ciudad");
  });

  if (modo === "local") {
    await bloque(`[${modo}] VECINO 2 · re-agregar un propio que ya estaba, eligiendo parte`, async () => {
      await ir(page, "#/trip/a1/valija");
      await page.waitForTimeout(200);
      await agregarEnCategoria(page, "a1", "ropa", "Termo", null);
      ok(await paraDe(page, "a1", "Termo") === "[]", "sin elegir: []");
      await page.locator(`[data-dropbtn="${await clave(page, "Termo")}"]`).click();
      await page.waitForFunction(() => Store.packingOf("a1").items[PackingEngine.slug("Termo")].estado === "descartado");
      await agregarEnCategoria(page, "a1", "ropa", "Termo", "Ciudad");
      const t = await itemDe(page, "a1", "Termo");
      ok(t.estado === "pendiente" && JSON.stringify(t.paraTipos) === '["ciudad"]',
         `volvió a pendiente y guardó lo que eligió ahora: ${t.estado} ${JSON.stringify(t.paraTipos)}`);
      await agregarEnCategoria(page, "a1", "ropa", "Termo", null);
      ok(await paraDe(page, "a1", "Termo") === '["ciudad"]', "re-agregarlo sin elegir no borra la parte");
    });

    await bloque(`[${modo}] VECINO 4 · rehacer la lista no pierde la parte`, async () => {
      await page.locator("#pk-info").click();
      await page.waitForTimeout(250);
      const chips = await page.$$eval("#modal .pk-inputs .chip", els => els.map(e => e.innerText.trim()));
      info("«De dónde sale» en un viaje de dos tipos: " + JSON.stringify(chips));
      ok(!chips.some(c => /ciudad y montaña anteriores/.test(c)),
         "VECINO 5 · la cuenta no dice «de ciudad y montaña»: los viajes que cuenta no tienen por qué ser de las dos cosas");
      await page.locator("#pk-redo").click();
      await page.waitForTimeout(700);
      ok(await paraDe(page, "a1", "Buzo polar") === '["montana"]', `después de rehacer: ${await paraDe(page, "a1", "Buzo polar")}`);
      ok(await chipDeFila(page, "Buzo polar") === "para montaña", "y el chip sigue");
    });

    await bloque(`[${modo}] FOCO, TEMAS y SÓLO LECTURA`, async () => {
      await page.locator('[data-pkadd="ropa"]').click();
      await page.waitForSelector("#pk-add-ropa");
      await page.locator("#pk-add-ropa").focus();
      await page.keyboard.press("Tab"); await page.keyboard.press("Tab");
      const foco = await page.evaluate(() => { const a = document.activeElement;
        return { chip: !!(a && a.closest(".pk-para")), outline: getComputedStyle(a).outlineStyle, ancho: getComputedStyle(a).outlineWidth }; });
      ok(foco.chip && foco.outline !== "none", `el chip se alcanza con el teclado y el foco se ve (${foco.outline} ${foco.ancho})`);
      const hex = h => { h = h.trim().replace("#", ""); return `rgb(${parseInt(h.slice(0,2),16)}, ${parseInt(h.slice(2,4),16)}, ${parseInt(h.slice(4,6),16)})`; };
      for (const tema of ["light", "dark"]) {
        await page.evaluate(t => document.documentElement.setAttribute("data-theme", t), tema);
        await page.locator("#main .pk-para button", { hasText:"Montaña" }).click();
        await page.waitForTimeout(400);      // la transición de color del chip es de .14s
        const c = await page.evaluate(() => {
          const b = document.querySelector('#main .pk-para button[aria-pressed="true"]');
          const ch = document.querySelector(".chip.parte");
          const r = getComputedStyle(document.documentElement);
          return { btn:getComputedStyle(b).color, accent:r.getPropertyValue("--accent"),
                   chip:ch ? getComputedStyle(ch).color : "", ink3:r.getPropertyValue("--ink-3") };
        });
        ok(c.btn === hex(c.accent) && c.chip === hex(c.ink3),
           `tema ${tema}: el chip marcado sale de --accent (${c.btn}) y el de la fila de --ink-3 (${c.chip})`);
        await page.locator("#main .pk-para button", { hasText:"Montaña" }).click();   // se suelta: vuelve a "sin elegir"
      }
      ok(await page.locator('#main .pk-para button[aria-pressed="true"]').count() === 0, "tocar el elegido lo suelta");
      await page.evaluate(() => document.documentElement.removeAttribute("data-theme"));
      await page.keyboard.press("Escape");
      await page.evaluate(() => { Store.canWrite = false; render(); });
      await page.waitForTimeout(200);
      ok(await page.locator(".pk-para").count() === 0 && await page.locator("#pk-additem").count() === 0 &&
         await page.locator("[data-pkadd]").count() === 0, "sin permiso de edición no hay dónde agregar ni qué elegir");
      ok(await chipDeFila(page, "Buzo polar") === "para montaña", "pero la parte se sigue leyendo en la fila");
      await page.evaluate(() => { Store.canWrite = true; render(); });
    });

    await bloque(`[${modo}] VECINO 3 · el viaje cambia de tipo después`, async () => {
      /* Con el formulario ABIERTO y Montaña tocada: cambiar el tipo no puede
         dejar esa elección escondida y guardarla después. */
      await abrirFormulario(page, "ropa");
      await page.locator("#main .pk-para button", { hasText:"Montaña" }).click();
      await page.locator("#pk-typebtn").click();
      await page.waitForSelector("#pk-tp");
      await marcarTipos(page, ["playa", "ciudad"]);
      await page.locator("#pk-confirmtype").click();
      await page.waitForFunction(() => (Store.packingOf("a1") || {}).tipoViaje === "playa+ciudad" && !PK.generating);
      await page.waitForTimeout(400);
      ok(await paraDe(page, "a1", "Buzo polar") === '["montana"]', "el dato guardado no se reescribe: sigue siendo para montaña");
      ok(await chipDeFila(page, "Buzo polar") === "", "y la fila no afirma «para montaña» en un viaje de playa y ciudad");
      ok(await chipDeFila(page, "Termo") === "para ciudad", "lo que era para ciudad lo sigue diciendo: ciudad sigue en el viaje");
      await abrirFormulario(page, "ropa");
      const partes = await page.$$eval("#main .pk-para button", els => els.map(e => e.innerText.trim()));
      ok(JSON.stringify(partes) === '["Playa","Ciudad","Las dos"]', `los chips son los del tipo nuevo: ${JSON.stringify(partes)}`);
      ok(await page.locator('#main .pk-para button[aria-pressed="true"]').count() === 0, "ninguno marcado");
      await page.locator("#pk-add-ropa").fill("Gorro de lana");
      await page.locator('[data-pksave="ropa"]').click();
      await esperarItem(page, "a1", "Gorro de lana");
      ok(await paraDe(page, "a1", "Gorro de lana") === "[]",
         `lo tocado ANTES de cambiar el tipo no se guarda a escondidas: ${await paraDe(page, "a1", "Gorro de lana")}`);
    });

    await bloque(`[${modo}] lo guardado sobrevive a recargar`, async () => {
      await page.reload();
      await page.waitForFunction(() => typeof Store !== "undefined" && Store.ready);
      ok(await paraDe(page, "a1", "Buzo polar") === '["montana"]', "`paraTipos` vuelve del respaldo local");
    });
  }
  await page.close();
}

/* ═════════════════════ MUNDO B · caso 5, lo guardado hoy ═════════════════════ */
/* Una lista como la escribía 38ae74f: campos de makeItem, SIN paraTipos. */
/* La clave la calcula el motor, como la calculaba la app al guardar: escrita
   a mano quedaba "repelente-de-mosquitos" y la app escribe otra cosa. */
const SLUG = require(path.join(RAIZ, "app", "parts", "packing-engine.js")).slug;
const ITEM_VIEJO = (nombre, clave) => ({
  clave, nombre, categoria:"otros", cantidad:null, motivo:"Lo agregaste vos.", origen:"manual",
  estado:"pendiente", empacadoEn:null, regla:"", cantidadEditada:false, nota:"", orden:950,
  porDestino:"", porDestinoFuente:"", agregadoEn:"2027-01-01T00:00:00.000Z", actualizadoEn:"2027-01-01T00:00:00.000Z"
});
const LISTA_VIEJA = (tripId, tipoViaje) => ({
  version:2, tripId, tipoViaje, creadaEn:"2027-01-01T00:00:00.000Z", generadaEn:"2027-01-01T00:00:00.000Z",
  actualizadaEn:"2027-01-01T00:00:00.000Z", aprendizaje:{ muestra:0, promovidos:[], suprimidos:[] },
  items:{ [SLUG("Repelente de mosquitos")]:ITEM_VIEJO("Repelente de mosquitos", SLUG("Repelente de mosquitos")) }
});
const MUNDO_B = {
  trips:[
    VIAJE("b1", "Salta vieja", "Salta", "2026-05-01", "2026-05-08"),
    VIAJE("b2", "Jujuy vieja", "Jujuy", "2026-06-01", "2026-06-08"),
    VIAJE("b3", "Mendoza", "Mendoza", "2027-05-01", "2027-05-08"),
    VIAJE("b4", "Córdoba", "Córdoba", "2027-06-01", "2027-06-08"),
    VIAJE("b5", "Tucumán", "Tucumán", "2027-07-01", "2027-07-08")
  ],
  packing:{ b1:LISTA_VIEJA("b1", "ciudad+montana"), b2:LISTA_VIEJA("b2", "montana+ciudad") }
};

async function mundoB(browser, modo) {
  const page = await nuevaPagina(browser, MUNDO_B, modo);
  await bloque(`[${modo}] CASO 5 · lo guardado hoy no pierde nada`, async () => {
    await armar(page, "b3", ["ciudad", "montana"]);
    const r = await itemDe(page, "b3", "Repelente de mosquitos");
    ok(!!r && r.origen === "historial", "dos listas guardadas ANTES de esta historia (sin el campo) lo siguen sugiriendo");
    info("motivo: " + JSON.stringify(r && r.motivo));
    ok(r && /viajes de ciudad y montaña\./.test(r.motivo), "con el motivo de siempre: la combinación");
    // y lo mismo agregado AHORA sin elegir: paraTipos:[]
    await agregarEnCategoria(page, "b3", "ropa", "Almohada de viaje", null);
    ok(await paraDe(page, "b3", "Almohada de viaje") === "[]", "agregado sin elegir: []");
    await armar(page, "b4", ["montana", "ciudad"]);
    await agregarPorHoja(page, "b4", "Almohada de viaje", "otros", null);
    ok(await paraDe(page, "b4", "Almohada de viaje") === "[]", "también por la hoja, sin elegir: []");
    await armar(page, "b5", ["ciudad", "montana"]);
    const l = await itemDe(page, "b5", "Almohada de viaje");
    ok(!!l && l.origen === "historial", "un tercer montaña+ciudad lo sigue sugiriendo, igual que hoy");
  });
  await page.close();
}

/* ═════════════════════ MUNDO C · casos 7 y 8, «las dos» y sin elegir ═════════════════════ */
const MUNDO_C = { trips:[
  VIAJE("c1", "Montaña y ciudad", "Mendoza", "2027-02-01", "2027-02-08"),
  VIAJE("c2", "Montaña", "Esquel", "2027-03-01", "2027-03-08"),
  VIAJE("c3", "Ciudad", "Rosario", "2027-04-01", "2027-04-04"),
  VIAJE("c4", "Otra montaña", "Villa La Angostura", "2027-05-01", "2027-05-08"),
  VIAJE("c5", "Otra ciudad", "Montevideo", "2027-06-01", "2027-06-04")
] };

async function mundoC(browser, modo) {
  const page = await nuevaPagina(browser, MUNDO_C, modo);
  await bloque(`[${modo}] CASO 7 y 8 · «Las dos» por la hoja, y sin elegir`, async () => {
    await armar(page, "c1", ["montana", "ciudad"]);
    await page.locator("#pk-additem").click();
    await page.waitForSelector("#pk_new_nombre");
    const campo = await page.$$eval("#modal .pk-para button", els => els.map(e => e.innerText.trim()));
    ok(JSON.stringify(campo) === '["Ciudad","Montaña","Las dos"]', `la hoja pregunta lo mismo: ${JSON.stringify(campo)}`);
    const hint = await page.locator("#modal .pk-para + .hint").innerText();
    info("hint: " + JSON.stringify(hint));
    ok(/sólo lo aprendo para otro viaje de ciudad y montaña/.test(hint), "y el hint no promete «no aprendo nada», que sería falso");
    await page.locator("#cancel").click();
    await agregarPorHoja(page, "c1", "Paraguas", "otros", "Las dos");
    ok(await paraDe(page, "c1", "Paraguas") === '["ciudad","montana"]', `«Las dos» guarda las dos claves: ${await paraDe(page, "c1", "Paraguas")}`);
    ok(await chipDeFila(page, "Paraguas") === "para las dos", "la fila dice «para las dos»");
    await agregarEnCategoria(page, "c1", "electronica", "Cargador del reloj", null);
    ok(await paraDe(page, "c1", "Cargador del reloj") === "[]", "sin elegir: se agrega igual, con []");
    ok(await chipDeFila(page, "Cargador del reloj") === "", "y sin chip");

    await armar(page, "c2", ["montana"]);
    await page.locator("#pk-additem").click();
    await page.waitForSelector("#pk_new_nombre");
    ok(await page.locator("#modal .pk-para").count() === 0, "con un tipo, la hoja no tiene el campo «Es para»");
    await page.locator("#cancel").click();
    await agregarPorHoja(page, "c2", "Paraguas", "otros", null);
    await agregarEnCategoria(page, "c2", "electronica", "Cargador del reloj", null);
    ok(await paraDe(page, "c2", "Paraguas") === '["montana"]', "por la hoja, sin pregunta, se guarda para montaña");

    await armar(page, "c3", ["ciudad"]);
    await agregarEnCategoria(page, "c3", "ropa", "Paraguas", null);

    await armar(page, "c4", ["montana"]);
    const p4 = await itemDe(page, "c4", "Paraguas");
    ok(!!p4 && p4.origen === "historial", "CASO 7 · «las dos» cuenta para montaña (c1 + c2)");
    ok(await itemDe(page, "c4", "Cargador del reloj") === null,
       "CASO 8 · lo agregado sin elegir en el montaña+ciudad NO cuenta para montaña sola (sólo c2: una vez)");
    await armar(page, "c5", ["ciudad"]);
    const p5 = await itemDe(page, "c5", "Paraguas");
    ok(!!p5 && p5.origen === "historial", "CASO 7 · y cuenta para ciudad (c1 + c3)");
    info("motivo en ciudad: " + JSON.stringify(p5 && p5.motivo));
  });

  await bloque(`[${modo}] VECINO 5 · «De dónde sale esta lista» cuenta lo que ahora cuenta`, async () => {
    /* c1 se armó primero: su cuenta es 0. Rehacerla ahora la vuelve a leer
       con c2..c5 en el historial: dos de montaña y dos de ciudad, ninguno de
       las dos cosas. Antes de VAL-77b decía "0 viajes de ciudad y montaña". */
    await ir(page, "#/trip/c1/valija");
    await page.locator("#pk-info").click();
    await page.locator("#pk-redo").click();
    await page.waitForTimeout(700);
    await page.locator("#pk-info").click();
    await page.waitForTimeout(250);
    const chips = await page.$$eval("#modal .pk-inputs .chip", els => els.map(e => e.innerText.trim()));
    info("después de rehacer: " + JSON.stringify(chips));
    ok(chips.indexOf("4 viajes de ciudad o montaña anteriores") >= 0,
       "cuenta los cuatro que se leyeron, y no dice que fueron de ciudad Y montaña");
    await page.locator("#closeSheet").click();
  });
  await page.close();
}

/* ═════════════════════ MUNDO D · caso 9, lo descartado ═════════════════════ */
const MUNDO_D = { trips:[
  VIAJE("d1", "Uno", "Mendoza", "2027-02-01", "2027-02-08"),
  VIAJE("d2", "Dos", "Salta", "2027-03-01", "2027-03-08"),
  VIAJE("d3", "Tres", "Jujuy", "2027-04-01", "2027-04-08"),
  VIAJE("d4", "Cuatro", "Esquel", "2027-05-01", "2027-05-08")
] };

async function mundoD(browser, modo) {
  const page = await nuevaPagina(browser, MUNDO_D, modo);
  await bloque(`[${modo}] CASO 9 · lo descartado no cambia`, async () => {
    await armar(page, "d1", ["montana", "ciudad"]);
    /* Un ítem de regla que también pone un viaje de montaña solo, y que no es
       crítico: se elige leyendo las listas, no de memoria. */
    const x = await page.evaluate(() => {
      const mc = Store.packingOf("d1");
      const trip = Store.trip ? null : null;
      const solo = PackingEngine.buildPackingList({ trip:{ id:"z", startDate:"2027-05-01", endDate:"2027-05-08", destination:"Esquel" }, tipoViaje:"montana" });
      return Object.values(mc.items).filter(i => i.origen === "regla" && i.estado === "pendiente" && solo.items[i.clave]
        && !PackingEngine.isCriticalClave(i.clave)).map(i => i.clave)[0];
    });
    info("ítem a descartar: " + x);
    await page.locator(`[data-dropbtn="${x}"]`).click();
    await page.waitForTimeout(300);
    await armar(page, "d2", ["montana", "ciudad"]);
    await page.locator(`[data-dropbtn="${x}"]`).click();
    await page.waitForTimeout(300);
    await armar(page, "d3", ["ciudad", "montana"]);
    ok(!(await page.evaluate(([c]) => !!Store.packingOf("d3").items[c], [x])),
       "descartado en dos montaña+ciudad: el tercero no lo trae (igual que antes)");
    await armar(page, "d4", ["montana"]);
    ok(await page.evaluate(([c]) => !!Store.packingOf("d4").items[c], [x]),
       "y un montaña solo SÍ lo trae: la supresión sigue siendo de la misma combinación");
  });
  await page.close();
}

/* ═════════════════════ CASO 6 · un tipo: sin fila, y el alto de hoy ═════════════════════ */
async function medirFormulario(browser, archivo, tipos) {
  const page = await browser.newPage({ viewport:{ width:390, height:844 }, hasTouch:true, isMobile:true });
  await page.route("**/*", r => (/^file:/.test(r.request().url()) ? r.continue() : r.abort()));
  await page.addInitScript(() => { window.claude = { use: async () => null }; });
  await page.addInitScript(s => { try { localStorage.setItem("valija.v1", JSON.stringify(s)); } catch (e) {} },
    { trips:[VIAJE("h1", "Medir", "Bariloche", "2027-08-01", "2027-08-08")], items:{ h1:[] }, packing:{} });
  await page.goto("file://" + archivo + "#/trip/h1/valija");
  await page.waitForFunction(() => typeof Store !== "undefined" && Store.ready);
  await page.waitForSelector("#pk-tp");
  await marcarTipos(page, tipos);
  await page.locator("#pk-build").click();
  await page.waitForFunction(() => { const l = Store.packingOf("h1"); return l && Object.keys(l.items || {}).length && !PK.generating; });
  await page.waitForTimeout(300);
  await page.locator('[data-pkadd="ropa"]').click();
  await page.waitForSelector("#pk-add-ropa");
  const m = await page.evaluate(() => {
    const f = document.querySelector(".pk-addform"), para = document.querySelector(".pk-para");
    const wrap = f.closest(".pk-body-wrap");
    const h = e => e ? e.getBoundingClientRect().height : 0;
    return { form:h(f), para:h(para), wrap:h(wrap), filas:wrap.querySelectorAll(".pk-row").length };
  });
  await page.close();
  return m;
}

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
    console.log("HTML bajo prueba: " + HTML);

    const SOLO = (process.env.SOLO || "A,Abase,B,C,D,6").split(",");
    if (SOLO.includes("A")) await mundoA(browser, "local");
    if (SOLO.includes("Abase")) await mundoA(browser, "base");
    if (SOLO.includes("B")) await mundoB(browser, "local");
    if (SOLO.includes("C")) await mundoC(browser, "local");
    if (SOLO.includes("D")) await mundoD(browser, "local");

    if (SOLO.includes("6")) await bloque("CASO 6 · un viaje de un tipo: sin fila de chips, y el alto de hoy", async () => {
      const viejo = path.join(os.tmpdir(), "valija-38ae74f.html");
      fs.writeFileSync(viejo, cp.execSync("git show 38ae74f:app/valija.html", { cwd:RAIZ, maxBuffer:64 << 20 }));
      const antes = await medirFormulario(browser, viejo, ["montana"]);
      const ahora = await medirFormulario(browser, HTML, ["montana"]);
      const dos = await medirFormulario(browser, HTML, ["montana", "ciudad"]);
      info(`38ae74f, montaña: formulario ${antes.form}px · categoría ${antes.wrap}px (${antes.filas} filas)`);
      info(`ahora,   montaña: formulario ${ahora.form}px · fila de chips ${ahora.para}px · categoría ${ahora.wrap}px (${ahora.filas} filas)`);
      info(`ahora,   montaña+ciudad: formulario ${dos.form}px + chips ${dos.para}px = ${dos.form + dos.para}px`);
      ok(ahora.para === 0, "con un tipo la fila no se renderiza");
      ok(ahora.form === antes.form && ahora.wrap === antes.wrap && ahora.filas === antes.filas,
         "y el formulario y la categoría miden exactamente lo mismo que en el build anterior");
      ok(dos.para > 0, "con dos tipos, la fila está");
    });
  } finally {
    if (browser) await browser.close();
    console.log("\n====================================================");
    console.log(fallos ? `  ${fallos} FALLARON (${pasaron} pasaron)` : `  Todo en verde — ${pasaron} aserciones`);
    console.log("====================================================\n");
    process.exit(fallos ? 1 : 0);
  }
})();
