/* ============================================================
   Qué tier del modelo pide cada camino, TOCANDO LOS CONTROLES
   (decisión del PO del 12/09; el porqué está en
    docs/design/import-engine.md § "El tier del modelo")

   Se corre así:

       NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/tier-del-modelo.js

   Y acepta la ruta del HTML como argumento, que es su CONTROL
   NEGATIVO (ver el final de este comentario):

       node app/pruebas/tier-del-modelo.js /tmp/otra-copia.html

   Qué cubre:

     1. Importar pegando texto  → la llamada pide "default".
     2. Importar un PDF con capa de texto → "default" (mismo camino).
     3. Importar una FOTO en una vista que acepta imágenes → "complex",
        y con la clave `images` puesta. Este camino existe en el código
        aunque la vista del PM no lo habilite: se prueba acá para que el
        día que lo habilite ya esté en el tier alto.
     4. Armar la lista de la valija → "complex" (equipaje-destino).
     5. Guardar una reserva nueva con la lista ya armada → "complex"
        (equipaje-plan).
     6. Las opciones que recibe `sample.json()` no llevan ningún miembro
        que el contrato no conozca: `modo`, `archivo` y `paginas` son
        nuestros y se quedan del lado de la app.
     7. El registro (`ValijaTier.log()`) anota el tier PEDIDO, y anota
        `aplicado: null` con el motivo, porque `sample.json()` resuelve
        el JSON parseado y NO el `SampleResult` donde vive
        `modelTierApplied`.

   La aserción se hace sobre las opciones que EFECTIVAMENTE recibió la
   llamada (`window.__CALLS__`), no leyendo el código.

   ------------------------------------------------------------
   LO QUE ESTE ARNÉS *NO* PRUEBA — dicho de frente
   ------------------------------------------------------------
   · **`claude` es falso.** `json()` y `limits()` los inyecta este
     archivo escritos contra `sample.d.ts` 0.2.41. Que la plataforma
     real honre el tier pedido no se puede ver desde acá: justamente
     por eso el punto 7 existe, y justamente por eso el dato que
     contestaría esa pregunta (`modelTierApplied`) no llega por
     `json()`.
   · **pdf.js es un simulador** (cdnjs está bloqueado en este entorno).
   · Chromium de escritorio sobre `file://` no es el entorno real. Ver
     CLAUDE.md, "La palabra verificado".

   ------------------------------------------------------------
   EL CONTROL NEGATIVO
   ------------------------------------------------------------
   Una prueba de configuración que no puede fallar no prueba nada. Se
   comprueba corriendo el mismo arnés contra copias del HTML con cada tier
   movido. Los tres controles, corridos el 12/09/2026:

     sed 's/texto:"default"/texto:"complex"/' app/valija.html > /tmp/t1.html
       → 5 FALLA (la llamada de texto pide "default": "complex")
     sed 's/imagenes:"complex"/imagenes:"default"/' app/valija.html > /tmp/t2.html
       → 1 FALLA (y pide "complex", sin que nadie se tenga que acordar: "default")
     sed 's/equipaje:"complex"/equipaje:"quick"/' app/valija.html > /tmp/t3.html
       → 2 FALLA (todas las llamadas del equipaje piden "complex": ["quick"])

     node app/pruebas/tier-del-modelo.js /tmp/t1.html
   ============================================================ */
"use strict";

const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const HTML = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(__dirname, "..", "valija.html");
const APP = "file://" + HTML;
const VOUCHER = fs.readFileSync(path.resolve(__dirname, "fixtures", "voucher-lobos-bus.txt"), "utf8");

/* LA SALIDA SE GUARDA SIEMPRE, y no porque sea prolijo: este arnés falló
   tres veces en tres días —una sola corrida cada vez, con ~30 corridas
   limpias alrededor— y LAS TRES VECES SE PERDIÓ LA SALIDA. El protocolo de
   este proyecto pide justamente guardarla para un defecto que no se
   reproduce, y las tres veces se pidió a mano y las tres veces se olvidó.
   Una intención que falla tres veces deja de ser una intención: el arnés se
   guarda a sí mismo, y cuando falla lo grita con la ruta del archivo.
   Va a `os.tmpdir()` para no ensuciar el repo. */
const os = require("os");
const LINEAS = [];
const REGISTRO = path.join(os.tmpdir(), "tier-del-modelo-" + Date.now() + ".txt");
(function envolverConsola() {
  const original = console.log;
  console.log = function () {
    LINEAS.push(Array.prototype.map.call(arguments, String).join(" "));
    original.apply(console, arguments);
  };
})();
/* El `catch` de la primera versión se tragaba el error y devolvía `null`, y
   como el aviso estaba detrás de `if (fail && donde)`, una corrida que
   fallaba Y no podía escribir terminaba sin archivo, sin mensaje y sin
   motivo: exactamente el síntoma que este mecanismo existe para prevenir,
   producido por el mecanismo. Lo encontró la auditoría atacándolo con una
   ruta imposible. Ahora el fracaso de guardar se dice, con su motivo. */
function guardarRegistro() {
  try { fs.writeFileSync(REGISTRO, LINEAS.join("\n") + "\n"); return REGISTRO; }
  catch (e) {
    process.stdout.write("\n  >>> NO SE PUDO GUARDAR EL REGISTRO en " + REGISTRO + "\n" +
                         "  >>> motivo: " + (e && e.message) + "\n" +
                         "  >>> La salida de esta corrida está sólo en pantalla: copiala.\n\n");
    return null;
  }
}

/* Y el aviso se da SIEMPRE que hubo fallas, haya archivo o no. Separar las
   dos cosas es el punto: que no se pueda guardar es una razón MÁS para
   gritar, no una para callarse. */
function avisarSiFallo(cuantas) {
  if (!cuantas) return;
  const donde = guardarRegistro();
  process.stdout.write("  >>> ESTA CORRIDA FALLÓ (" + cuantas + ")\n");
  if (donde) {
    process.stdout.write("  >>> QUEDÓ GUARDADA EN: " + donde + "\n" +
                         "  >>> No la pierdas: este arnés falla una vez cada tantas decenas\n" +
                         "  >>> de corridas y las tres primeras veces se perdió la salida.\n\n");
  }
}

let ok = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { ok++; console.log("  ok     " + msg); }
  else { fail++; console.log("  FALLA  " + msg); }
}
async function test(nombre, fn) {
  console.log("\n· " + nombre);
  try { await fn(); }
  catch (e) { fail++; console.log("  FALLA (excepción) " + (e && e.message)); console.log(e && e.stack); }
}

const TRIP = {
  id: "t1", name: "Vacaciones en Madrid", destination: "Madrid",
  startDate: "2026-10-05", endDate: "2026-10-15", hue: 214,
  createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z", notes: ""
};
const VUELO = {
  id: "i1", type: "flight", title: "Vuelo a Madrid", start: "2026-10-05T22:00",
  end: "2026-10-06T14:00", from: "EZE", to: "MAD", provider: "Iberia",
  confirmation: "ABC123", notes: ""
};

/** Forma del contrato (sample.d.ts 0.2.41): `images` está sólo en las
    vistas que pueden mandarlas. */
const LIMITS_CON_IMAGENES = {
  maxPromptBytes: 200000,
  images: { maxCount: 5, maxInputBytes: 20971520, mediaTypes: ["image/jpeg", "image/png", "image/webp"] }
};
const LIMITS_SIN_IMAGENES = { maxPromptBytes: 200000 };

/** Miembros de `options` que el contrato conoce y que la app tiene motivo
    para mandar. Cualquier otro lo ignora la plataforma, pero lo nombra en
    la consola: es ruido nuestro, y se prueba que no pasa. */
const CLAVES_PERMITIDAS = ["images", "modelTier"];

async function nuevaPagina(browser, cfg) {
  cfg = cfg || {};
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  /* Corte de red: este entorno bloquea fuentes, jspdf y pdf.js, y sin el
     corte cada carga espera un handshake que nunca llega. */
  await page.route("**/*", r => (/^file:/.test(r.request().url()) ? r.continue() : r.abort()));
  page.on("pageerror", e => { console.log("  !! pageerror: " + e.message); fail++; });

  await page.addInitScript(({ datos, limits, conLimits, voucher }) => {
    /* Cada llamada al modelo queda registrada con las opciones REALES que
       recibió. Es lo único sobre lo que se asevera. */
    window.__CALLS__ = [];

    const sample = {
      json: async (prompt, opts) => {
        const p = String(prompt);
        window.__CALLS__.push({
          tier: opts ? opts.modelTier : undefined,
          claves: opts ? Object.keys(opts).sort() : [],
          tieneImages: !!(opts && opts.images),
          esEquipaje: /valija|equipaje|empacar/i.test(p),
          traeElCodigo: p.indexOf("LB0TKCV5") >= 0
        });

        // Equipaje: la forma que espera `parseDestinationItems`.
        if (/valija|equipaje|empacar/i.test(p)) {
          return { items: [], quitar: [], clima: "Octubre en Madrid: entre 12 y 22 grados." };
        }
        // Importación por imagen: no hay texto que mirar, contesta una reserva.
        if (opts && opts.images) {
          return { items: [{
            type: "flight", title: "Buenos Aires → Madrid",
            start: "2026-10-05T22:00", end: "2026-10-06T14:00",
            from: "EZE", to: "MAD", provider: "Iberia",
            confirmation: "FOTO123", flightNumber: "IB6842", seat: "14C",
            terminal: "", gate: "", boardingTime: "", address: "", phone: "",
            cost: "", currency: "", notes: ""
          }] };
        }
        // Importación por texto: la reserva sale sólo si el prompt trae el texto.
        if (p.indexOf("LB0TKCV5") < 0) return { items: [] };
        return { items: [{
          type: "transfer", title: "Lobos → Buenos Aires",
          start: "2026-09-13T19:01", end: "2026-09-13T20:31",
          from: "Lobos", to: "Buenos Aires", provider: "Lobos Bus",
          confirmation: "LB0TKCV5", flightNumber: "", seat: "", terminal: "", gate: "",
          boardingTime: "", address: "", phone: "", cost: "", currency: "", notes: ""
        }] };
      }
    };
    if (conLimits) sample.limits = async () => limits;

    window.claude = { use: async k => (k === "sample" ? sample : null) };

    /* pdf.js SIMULADO, escrito contra la API documentada. */
    window.pdfjsLib = {
      version: "3.11.174-simulado",
      GlobalWorkerOptions: {},
      getDocument: () => ({ promise: Promise.resolve({
        numPages: 1,
        getPage: () => Promise.resolve({
          getTextContent: () => Promise.resolve({
            items: String(voucher).split("\n").map(str => ({ str: str, hasEOL: true })),
            styles: {}
          })
        }),
        destroy: function () {}
      }) })
    };

    /* Sembrar y limpiar SÓLO en la primera carga: `addInitScript` corre en
       cada recarga, y si el registro se borrara ahí, la aserción de que
       sobrevive a un reload no podría fallar nunca. */
    try {
      if (!localStorage.getItem("valija.v1")) {
        localStorage.setItem("valija.v1", JSON.stringify(datos));
        localStorage.removeItem("valija.iaTier.v1");
      }
    } catch (e) {}
  }, {
    datos: { trips: [TRIP], items: { t1: cfg.items || [VUELO] }, packing: {} },
    limits: cfg.limits || LIMITS_CON_IMAGENES,
    conLimits: cfg.conLimits !== false,
    voucher: VOUCHER
  });

  await page.goto(APP + (cfg.hash || "#/trip/t1"));
  await page.waitForFunction(() => typeof Store !== "undefined" && Store.ready, null, { timeout: 15000 });
  await page.waitForTimeout(300);
  return page;
}

/** El gesto: se toca "Importar" en la barra de abajo. */
async function abrirImportar(page) {
  await page.locator("#imp").click();
  await page.waitForSelector("#imp-live", { state: "attached", timeout: 10000 });
  await page.waitForTimeout(200);
}
/** El gesto: se toca el botón de origen y se le da el archivo al selector
    que ese botón abre. Nunca se dispara el `change` a mano. */
async function tocarYElegir(page, pick, archivo) {
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser", { timeout: 10000 }),
    page.locator(`[data-pick="${pick}"]`).click()
  ]);
  await chooser.setFiles(archivo);
  await page.waitForTimeout(250);
}
const llamadas = page => page.evaluate(() => window.__CALLS__);
const registro = page => page.evaluate(() => window.ValijaTier.log());

/** Todas las llamadas tienen que llevar sólo opciones que el contrato conoce. */
/** Pega texto en la caja de importar, TOCANDO primero el resumen si hace falta.

    Desde el 18/09 la caja arranca colapsada cuando la vista no lee imágenes
    (pedido del PM: no es la funcionalidad principal). Escribir directo en
    `#im_text` sin abrirla es un gesto que ninguna persona puede hacer, y
    Playwright se cuelga esperando un campo que no está a la vista. Se abre como
    se abre de verdad: un toque en el resumen. */
async function pegarTexto(page, texto) {
  const abierta = await page.locator(".imp-more").evaluate(e => e.open);
  if (!abierta) {
    await page.locator(".imp-more summary").click();
    await page.waitForTimeout(120);
  }
  await page.locator("#im_text").fill(texto);
}

function assertClavesLimpias(ls, donde) {
  const sucias = ls.filter(l => l.claves.some(k => CLAVES_PERMITIDAS.indexOf(k) < 0));
  assert(sucias.length === 0,
    `${donde}: ninguna opción ajena al contrato llega a sample.json() ` +
    (sucias.length ? "— " + JSON.stringify(sucias.map(s => s.claves)) : "(modo/archivo/paginas se quedan en la app)"));
}

/* EL IIFE VA ENVUELTO, porque una excepción fuera de cualquier `test()` —el
   navegador que no arranca, un fixture que no está— terminaba el proceso sin
   pasar nunca por el guardado. La auditoría lo forzó con un `executablePath`
   inválido: se perdió la salida entera, sin archivo y sin aviso. El `finally`
   corre igual, y la excepción se imprime antes de que se pierda.

   LO QUE ESTO NO CUBRE, dicho para que no se descubra como sorpresa: lo que
   pasa ANTES de este bloque —la lectura del fixture, el `require` de
   Playwright— sigue sin envolverse. Se probó: revienta con la excepción a la
   vista y sin archivo. Se deja así a propósito, porque en ese momento no hay
   ninguna salida que perder: el arnés todavía no imprimió nada. Envolver eso
   sería ruido, no protección. */
(async () => {
 try {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  console.log("HTML bajo prueba: " + HTML);

  /* ---------------------------------------------------------- */
  await test("importar PEGANDO TEXTO pide \"default\"", async () => {
    const page = await nuevaPagina(browser, { limits: LIMITS_SIN_IMAGENES });
    await abrirImportar(page);
    await pegarTexto(page, VOUCHER);
    await page.waitForTimeout(150);
    await page.locator("#im-run").click();
    await page.waitForSelector("#im-save", { timeout: 15000 });

    const ls = await llamadas(page);
    assert(ls.length === 1, `se llamó al modelo una sola vez (${ls.length})`);
    assert(ls[0] && ls[0].tier === "default", "la llamada de texto pide \"default\": " + JSON.stringify(ls[0] && ls[0].tier));
    assert(ls[0] && ls[0].tieneImages === false, "y no manda imágenes");
    assert(ls[0] && ls[0].traeElCodigo === true, "el prompt lleva el texto pegado (trae LB0TKCV5)");
    assertClavesLimpias(ls, "texto pegado");
    assert(await page.locator('.stack [data-f="confirmation"]').first().inputValue() === "LB0TKCV5",
      "y la reserva sale igual que antes del cambio de tier");
    await page.close();
  });

  /* ---------------------------------------------------------- */
  await test("un PDF con capa de texto también pide \"default\"", async () => {
    const page = await nuevaPagina(browser, { limits: LIMITS_CON_IMAGENES });
    await abrirImportar(page);
    await tocarYElegir(page, "im_doc", {
      name: "RLB_CLARA_SANCHEZ.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 falso")
    });
    await page.locator("#im-run").click();
    await page.waitForSelector("#im-save", { timeout: 15000 });

    const ls = await llamadas(page);
    assert(ls.length === 1, `una llamada, no una por página (${ls.length})`);
    assert(ls[0] && ls[0].tier === "default",
      "el PDF leído por texto pide \"default\" aunque la vista acepte imágenes: " + JSON.stringify(ls[0] && ls[0].tier));
    assert(ls[0] && ls[0].tieneImages === false, "y no se mandó ninguna imagen");
    assertClavesLimpias(ls, "PDF con texto");
    await page.close();
  });

  /* ---------------------------------------------------------- */
  await test("importar una FOTO pide \"complex\" y manda las imágenes", async () => {
    const page = await nuevaPagina(browser, { limits: LIMITS_CON_IMAGENES });
    await abrirImportar(page);
    assert(await page.locator('[data-pick="im_gal"]').count() === 1,
      "la vista acepta imágenes, así que el camino existe en la pantalla");
    await tocarYElegir(page, "im_gal", {
      name: "tarjeta-de-embarque.jpg", mimeType: "image/jpeg", buffer: Buffer.from("falso pero jpeg")
    });
    await page.locator("#im-run").click();
    await page.waitForSelector("#im-save", { timeout: 15000 });

    const ls = await llamadas(page);
    assert(ls.length === 1, `una llamada (${ls.length})`);
    assert(ls[0] && ls[0].tieneImages === true, "la llamada lleva la clave `images`: es el camino de imágenes");
    assert(ls[0] && ls[0].tier === "complex",
      "y pide \"complex\", sin que nadie se tenga que acordar: " + JSON.stringify(ls[0] && ls[0].tier));
    assertClavesLimpias(ls, "foto");
    assert(await page.locator('.stack [data-f="confirmation"]').first().inputValue() === "FOTO123",
      "y la reserva leída de la foto aparece para revisar");
    await page.close();
  });

  /* ---------------------------------------------------------- */
  await test("armar la lista de la valija sigue pidiendo \"complex\"", async () => {
    const page = await nuevaPagina(browser, { hash: "#/trip/t1/valija" });
    await page.locator("#pk-build").click();
    /* Esperar la SEÑAL, no un reloj: que la llamada del equipaje haya llegado.
       Las esperas fijas de acá son el patrón que ya tumbó otro arnés y que hizo
       fallar éste en una de siete corridas. Si la llamada nunca llega, esto
       revienta por tiempo y la aserción de abajo falla igual: la espera saca la
       fragilidad, no la exigencia. */
    await page.waitForFunction(
      () => (window.__CALLS__ || []).some(l => l.esEquipaje), null, { timeout: 15000 }
    ).catch(()=>{});

    const ls = (await llamadas(page)).filter(l => l.esEquipaje);
    assert(ls.length >= 1, `la capa inteligente del equipaje se consultó (${ls.length})`);
    assert(ls.every(l => l.tier === "complex"),
      "todas las llamadas del equipaje piden \"complex\": " + JSON.stringify(ls.map(l => l.tier)));
    assertClavesLimpias(ls, "equipaje");
    assert(await page.locator(".pk-row[data-row]").count() > 5, "y la lista se armó igual");
    await page.close();
  });

  /* ---------------------------------------------------------- */
  await test("guardar una reserva con la lista armada recalcula el plan en \"complex\"", async () => {
    const page = await nuevaPagina(browser, { hash: "#/trip/t1/valija" });
    await page.locator("#pk-build").click();
    await page.waitForFunction(
      () => (window.__CALLS__ || []).some(l => l.esEquipaje), null, { timeout: 15000 }
    ).catch(()=>{});
    const antes = (await llamadas(page)).length;

    // El gesto: se vuelve al viaje, se toca "Agregar", se elige "Auto" y se guarda.
    await page.goto(APP + "#/trip/t1");
    await page.waitForTimeout(300);
    await page.locator("#additem").click();
    await page.waitForTimeout(200);
    await page.locator('[data-t="car"]').click();
    await page.waitForTimeout(150);
    await page.locator("#i_title").fill("Auto en Madrid");
    await page.locator("#save").click();
    /* Misma idea: la señal es que apareció una llamada nueva después de `antes`. */
    await page.waitForFunction(
      n => (window.__CALLS__ || []).length > n, antes, { timeout: 15000 }
    ).catch(()=>{});

    const nuevas = (await llamadas(page)).slice(antes);
    assert(nuevas.length >= 1, `guardar la reserva disparó el recálculo del plan (${nuevas.length} llamada/s)`);
    assert(nuevas.every(l => l.tier === "complex"),
      "y el recálculo pide \"complex\": " + JSON.stringify(nuevas.map(l => l.tier)));
    assert(await page.evaluate(() => Store.itemsOf("t1").length) === 2, "la reserva quedó guardada");
    await page.close();
  });

  /* ---------------------------------------------------------- */
  await test("el registro dice qué tier se PIDIÓ, y dice que el aplicado no se puede saber", async () => {
    /* Vista sin imágenes. Ahí la caja de pegar el texto arranca COLAPSADA desde
       el 18/09 (pedido del PM), así que `pegarTexto` toca el resumen antes de
       escribir. Este comentario decía lo contrario —"ya viene desplegada"— y
       quedó describiendo el comportamiento anterior al mismo commit que lo
       cambió: lo agarró la auditoría. Es la trampa de la documentación que
       queda mintiendo, cometida en el commit que arregla el comportamiento. */
    const page = await nuevaPagina(browser, { limits: LIMITS_SIN_IMAGENES });
    await abrirImportar(page);
    await pegarTexto(page, VOUCHER);
    await page.waitForTimeout(150);
    await page.locator("#im-run").click();
    await page.waitForSelector("#im-save", { timeout: 15000 });

    const log = await registro(page);
    assert(log.length === 1, `una entrada por llamada (${log.length})`);
    const e = log[0] || {};
    assert(e.tarea === "importar-texto", "la entrada dice qué tarea fue: " + JSON.stringify(e.tarea));
    assert(e.pedido === "default", "y qué tier se pidió: " + JSON.stringify(e.pedido));
    assert(e.estado === "ok", "y cómo salió: " + JSON.stringify(e.estado));
    assert(typeof e.ms === "number" && e.ms >= 0, "y cuánto tardó: " + JSON.stringify(e.ms));
    assert(e.aplicado === null, "el tier APLICADO queda en null: no se inventa");
    assert(/sample\.json\(\)/.test(String(e.motivo)), "con el motivo escrito: " + JSON.stringify(e.motivo));
    assert(typeof e.ts === "string" && e.ts.length === 24, "y con fecha ISO: " + JSON.stringify(e.ts));

    const resumen = await page.evaluate(() => window.ValijaTier.resumen());
    const claves = Object.keys(resumen);
    assert(claves.length === 1 && /importar-texto · pedido:default · aplicado:no se sabe/.test(claves[0]),
      "el resumen agrupa por tarea y tier, y dice \"no se sabe\" donde no se sabe: " + JSON.stringify(claves));
    assert(resumen[claves[0]].llamadas === 1 && resumen[claves[0]].ok === 1, "con el conteo de la corrida");

    // Sobrevive a la recarga: el registro es del dispositivo, no de la sesión.
    await page.reload();
    await page.waitForFunction(() => typeof Store !== "undefined" && Store.ready, null, { timeout: 15000 });
    /* QUE DIGA LO QUE VIO. Esta aserción falló UNA vez en siete el 26/09 y en
       cero de dieciséis corridas medidas después, contra la versión de antes y
       la de después de VAL-77b. Que falle a veces no es una causa: puede ser
       que la recarga pierda la escritura (cero entradas) o que una llamada de
       fondo se registre de más (dos). Son dos defectos distintos y el mensaje
       viejo no distinguía uno del otro — decía "FALLA" y nada más.
       No se arregla adivinando cuál es: se hace que la próxima vez lo diga. */
    const trasRecargar = await registro(page);
    assert(trasRecargar.length === 1, "y sigue ahí después de recargar" +
      (trasRecargar.length === 1 ? "" : " — encontré " + trasRecargar.length + " entradas: " +
        JSON.stringify(trasRecargar.map(x => ({ tarea:x.tarea, estado:x.estado, ts:x.ts })))));
    await page.close();
  });

  /* ---------------------------------------------------------- */
  await test("un error del modelo también queda registrado, y la app no se rompe", async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await page.route("**/*", r => (/^file:/.test(r.request().url()) ? r.continue() : r.abort()));
    page.on("pageerror", ev => { console.log("  !! pageerror: " + ev.message); fail++; });
    await page.addInitScript(datos => {
      window.claude = { use: async k => (k === "sample" ? {
        json: async () => { const e = { code: "rate_limited", message: "Demasiados pedidos seguidos." }; throw e; },
        limits: async () => ({ maxPromptBytes: 200000 })
      } : null) };
      try {
        if (!localStorage.getItem("valija.v1")) {
          localStorage.setItem("valija.v1", JSON.stringify(datos));
          localStorage.removeItem("valija.iaTier.v1");
        }
      } catch (e) {}
    }, { trips: [TRIP], items: { t1: [VUELO] }, packing: {} });
    await page.goto(APP + "#/trip/t1");
    await page.waitForFunction(() => typeof Store !== "undefined" && Store.ready, null, { timeout: 15000 });

    await abrirImportar(page);
    await pegarTexto(page, VOUCHER);
    await page.waitForTimeout(150);
    await page.locator("#im-run").click();
    await page.waitForTimeout(1500);

    const log = await registro(page);
    assert(log.length === 1 && log[0].estado === "error", "la llamada fallada queda registrada: " + JSON.stringify(log[0] && log[0].estado));
    assert(log[0] && log[0].codigo === "rate_limited", "con el código de la plataforma: " + JSON.stringify(log[0] && log[0].codigo));
    assert(log[0] && log[0].pedido === "default", "y con el tier que se había pedido: " + JSON.stringify(log[0] && log[0].pedido));
    const txt = await page.locator("#sheet, .sheet").first().innerText();
    assert(/segu|espera|minuto|pedidos/i.test(txt), "y la pantalla explica qué pasó: " + JSON.stringify(txt.replace(/\s+/g, " ").slice(0, 100)));
    await page.close();
  });

  /* ---------------------------------------------------------- */
  await test("sin capa inteligente (claude.use devuelve null) no se registra nada y la app anda", async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.route("**/*", r => (/^file:/.test(r.request().url()) ? r.continue() : r.abort()));
    page.on("pageerror", ev => { console.log("  !! pageerror: " + ev.message); fail++; });
    await page.addInitScript(datos => {
      window.claude = { use: async () => null };
      try { if (!localStorage.getItem("valija.v1")) localStorage.setItem("valija.v1", JSON.stringify(datos)); } catch (e) {}
    }, { trips: [TRIP], items: { t1: [VUELO] }, packing: {} });
    await page.goto(APP + "#/trip/t1/valija");
    await page.waitForFunction(() => typeof Store !== "undefined" && Store.ready, null, { timeout: 15000 });
    await page.locator("#pk-build").click();
    await page.waitForTimeout(900);
    assert(await page.locator(".pk-row[data-row]").count() > 5, "la lista se arma igual sin IA");
    assert((await registro(page)).length === 0, "y el registro queda vacío: no hubo llamada que registrar");
    // "Importar" vive en la barra del viaje, no en la de la valija.
    await page.goto(APP + "#/trip/t1");
    await page.waitForTimeout(300);
    await page.locator("#imp").click();
    await page.waitForTimeout(500);
    assert(/no está disponible/i.test(await page.locator("#sheet, .sheet").first().innerText()),
      "importar lo explica en vez de fallar");
    await page.close();
  });

  /* ---------------------------------------------------------- */
  await test("una plataforma sin sample.json() se trata como plataforma sin IA", async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.route("**/*", r => (/^file:/.test(r.request().url()) ? r.continue() : r.abort()));
    page.on("pageerror", ev => { console.log("  !! pageerror: " + ev.message); fail++; });
    await page.addInitScript(datos => {
      // `sample` existe pero sin `json`: antes se llamaba igual y explotaba.
      window.claude = { use: async k => (k === "sample" ? { limits: async () => ({ maxPromptBytes: 200000 }) } : null) };
      try { if (!localStorage.getItem("valija.v1")) localStorage.setItem("valija.v1", JSON.stringify(datos)); } catch (e) {}
    }, { trips: [TRIP], items: { t1: [VUELO] }, packing: {} });
    await page.goto(APP + "#/trip/t1");
    await page.waitForFunction(() => typeof Store !== "undefined" && Store.ready, null, { timeout: 15000 });
    await page.locator("#imp").click();
    await page.waitForTimeout(800);
    assert(/no está disponible/i.test(await page.locator("#sheet, .sheet").first().innerText()),
      "se manda a la carga manual en vez de reventar");
    await page.close();
  });

  console.log("\n====================================================");
  console.log(`  ${ok} pasaron, ${fail} fallaron`);
  console.log("====================================================\n");
  await browser.close();
 } catch (e) {
   fail++;
   console.log("\n  FALLA (excepción fuera de toda prueba) " + (e && e.message));
   console.log(e && e.stack);
 } finally {
   avisarSiFallo(fail);
   process.exitCode = fail ? 1 : 0;
 }
})();
