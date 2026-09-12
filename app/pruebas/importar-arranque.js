/* ============================================================
   EL ARRANQUE DE LA PANTALLA DE IMPORTAR
   Hallazgos A y B de docs/auditoria/2026-09-12-iteracion-2.md

   Se corre así:

       NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/importar-arranque.js

   Qué cubre, TOCANDO EL BOTÓN:

     A · El toque en "Importar" tiene que producir una reacción visible EN
         EL ACTO, aunque `claude.use()` y `limits()` tarden. No se mira: se
         mide. La aserción falla si la pantalla no cambió dentro del umbral.
         Se mide desde el `pointerdown` del toque real hasta la primera
         mutación del contenedor del modal, las dos marcas tomadas adentro
         de la página con `performance.now()`.
     A2· Si la persona cierra la hoja (o se va a otra) mientras la promesa
         está en camino, lo que resuelve tarde no reabre ni pisa nada.
     A3· Si `limits()` no contesta, la pantalla se completa igual con
         certeza "desconocida" (no se saca nada), y si la respuesta llega
         tarde se aplica ahí, sin pisar lo que la persona escribió.
     A4· A los 7 segundos de espera se dice que está tardando y se ofrece
         cargar la reserva a mano.
     B · Sin `window.pdfjsLib` (el mismo `<script src>` de cdnjs que ya
         falló en el teléfono del PM con jsPDF, VAL-50) la pantalla lo dice
         ANTES de que se suba nada y deja a la vista la vía que sigue
         funcionando: pegar el texto del correo.

   ------------------------------------------------------------
   LO QUE ESTE ARNÉS *NO* PRUEBA — dicho de frente
   ------------------------------------------------------------
   · `claude` es un simulador escrito contra el contrato documentado
     (0.2.41): `use()` resuelve siempre después de la primera corrida del
     script y devuelve null a los 10 s. Las demoras de acá son simuladas
     con `setTimeout`; que la plataforma real tarde eso está tomado del
     contrato, no medido en un teléfono.
   · pdf.js acá nunca es el real (cdnjs está bloqueado en este entorno).
     Lo que se prueba es exactamente el caso en que NO está, que es el
     riesgo de VAL-50; que el real cargue bien sólo se ve en el teléfono.
   · Chromium de escritorio sobre `file://` no es el entorno real. Ver
     CLAUDE.md, "La palabra verificado".
   ============================================================ */
"use strict";

const { chromium } = require("playwright");
const path = require("path");

/* Recibe opcionalmente la ruta del HTML, para poder correr el arnés contra
   una copia modificada. Así se comprueba que la aserción del umbral FALLA
   cuando se le saca el estado de carga: una prueba que no puede fallar no
   prueba nada (ver el control negativo en LEEME.md). */
const APP = "file://" + path.resolve(process.argv[2] || path.join(__dirname, "..", "valija.html"));

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
  id: "t1", name: "Escapada a Lobos", destination: "Lobos",
  startDate: "2026-09-13", endDate: "2026-09-15", hue: 214,
  createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z", notes: ""
};
const LIMITS_CON_IMAGENES = {
  maxPromptBytes: 200000,
  images: { maxCount: 5, maxInputBytes: 20971520, mediaTypes: ["image/jpeg", "image/png", "image/webp"] }
};
const LIMITS_SIN_IMAGENES = { maxPromptBytes: 200000 };

/**
 * @param {Object} cfg
 * @param {number} cfg.demoraUse     cuánto tarda `claude.use("sample")` (ms)
 * @param {number} cfg.demoraLimits  cuánto tarda `limits()` (ms)
 * @param {boolean} cfg.limitsMudo   `limits()` no resuelve nunca
 * @param {Object|null} cfg.limits   qué resuelve `limits()`
 * @param {boolean} cfg.sinPdfjs     simula que cdnjs no cargó pdf.js
 */
async function nuevaPagina(browser, cfg) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  /* Este entorno bloquea los hosts externos (fuentes, jspdf, pdf.js). Sin
     esto cada carga espera un handshake que no llega y aparecen fallos que
     no son del producto. */
  await page.route("**/*", r => (/^file:/.test(r.request().url()) ? r.continue() : r.abort()));
  page.on("pageerror", e => { console.log("  !! pageerror: " + e.message); fail++; });

  await page.addInitScript(cfg2 => {
    window.__CALLS__ = [];
    window.__LIMITS__ = 0;
    window.__USE__ = 0;

    const sample = {
      json: async (prompt, opts) => {
        window.__CALLS__.push({
          tieneImages: !!(opts && Object.prototype.hasOwnProperty.call(opts, "images")),
          traeElCodigo: String(prompt).indexOf("LB0TKCV5") >= 0
        });
        if (String(prompt).indexOf("LB0TKCV5") < 0) return { items: [] };
        return { items: [{
          type: "transfer", title: "Lobos → Buenos Aires",
          start: "2026-09-13T19:01", end: "2026-09-13T20:31",
          from: "Lobos", to: "Buenos Aires", provider: "Lobos Bus",
          confirmation: "LB0TKCV5", flightNumber: "", seat: "", terminal: "", gate: "",
          boardingTime: "", address: "", phone: "", cost: "", currency: "", notes: ""
        }] };
      },
      limits: () => new Promise(res => {
        if (cfg2.limitsMudo) return;            // no contesta nunca: el caso del hallazgo A
        setTimeout(() => { window.__LIMITS__++; res(cfg2.limits); }, cfg2.demoraLimits || 0);
      })
    };

    /* El contrato (0.2.41) dice que `use()` NUNCA resuelve dentro de la
       primera corrida del script: acá se simula esa demora. */
    window.claude = {
      use: k => new Promise(res => {
        window.__USE__++;
        setTimeout(() => res(k === "sample" ? sample : null), cfg2.demoraUse || 0);
      })
    };

    if (!cfg2.sinPdfjs) {
      window.pdfjsLib = {
        version: "3.11.174-simulado",
        GlobalWorkerOptions: {},
        getDocument: () => ({ promise: Promise.resolve({
          numPages: 1,
          getPage: () => Promise.resolve({ getTextContent: () => Promise.resolve({ items: [], styles: {} }) }),
          destroy: function () {}
        }) })
      };
    }

    try {
      if (!localStorage.getItem("valija.v1")) {
        localStorage.setItem("valija.v1", JSON.stringify(cfg2.datos));
      }
    } catch (e) {}
  }, {
    datos: { trips: [TRIP], items: { t1: [] }, packing: {} },
    limits: cfg.limits || null,
    demoraUse: cfg.demoraUse || 0,
    demoraLimits: cfg.demoraLimits || 0,
    limitsMudo: !!cfg.limitsMudo,
    sinPdfjs: !!cfg.sinPdfjs
  });

  await page.goto(APP + "#/trip/t1");
  await page.waitForFunction(() => typeof Store !== "undefined" && Store.ready, null, { timeout: 15000 });
  await page.waitForTimeout(300);
  return page;
}

/** Deja el cronómetro armado adentro de la página: t0 en el `pointerdown`
    del toque real sobre "Importar", t1 en la primera mutación del modal. */
async function armarCronometro(page) {
  await page.evaluate(() => {
    window.__T0__ = null; window.__T1__ = null;
    const modal = document.getElementById("modal");
    new MutationObserver(() => {
      if (window.__T0__ !== null && window.__T1__ === null) window.__T1__ = performance.now();
    }).observe(modal, { childList: true, subtree: true });
    document.getElementById("imp").addEventListener("pointerdown", () => {
      if (window.__T0__ === null) window.__T0__ = performance.now();
    }, { once: true });
  });
}
const reaccion = page => page.evaluate(() =>
  (window.__T0__ === null || window.__T1__ === null) ? null : Math.round(window.__T1__ - window.__T0__));

/** El umbral. 200 ms es el techo de lo que se siente "en el acto" al tacto;
    el camino bueno es sincrónico con el toque, así que en la práctica da 0-5. */
const UMBRAL_MS = 200;

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

  /* ---------------------------------------------------------- A ---- */
  await test("A · con claude.use y limits() lentos, el toque reacciona EN EL ACTO", async () => {
    const page = await nuevaPagina(browser, { limits: LIMITS_SIN_IMAGENES, demoraUse: 1500, demoraLimits: 2500 });
    await armarCronometro(page);

    /* Se toca y se espera un ratito fijo, no el selector: si la pantalla no
       cambió, lo que tiene que fallar es la aserción de la medición, con el
       síntoma dicho, no un `waitForSelector` por tiempo agotado. */
    await page.locator("#imp").click();
    await page.waitForTimeout(UMBRAL_MS + 100);

    const ms = await reaccion(page);
    assert(ms !== null, `hubo un cambio visible en pantalla dentro de los ${UMBRAL_MS + 100} ms del toque`);
    assert(ms !== null && ms <= UMBRAL_MS, `la pantalla cambió a los ${ms} ms del toque (umbral ${UMBRAL_MS} ms)`);

    const texto = await page.locator(".sheet-bd").innerText();
    assert(/Preparando/i.test(texto), "y lo que se ve dice que está preparando: " + JSON.stringify(texto.trim().slice(0, 40)));
    assert(await page.locator(".sheet .spin").count() >= 1, "con el mismo indicador de carga que usa «Leyendo…»");
    assert(await page.locator("#im-cancel-prep").count() === 1, "y con un botón para cancelar: la espera no es una trampa");
    assert(await page.evaluate(() => window.__CALLS__.length) === 0, "todavía no se llamó al modelo, claro");

    // Y cuando la plataforma contesta, la hoja se completa sola.
    await page.waitForSelector("#im-caps", { timeout: 8000 });
    assert(await page.locator("#im-caps.warn").count() === 1, "al llegar la respuesta, la hoja se completa con el aviso de la vista sin imágenes");
    assert(await page.locator('[data-pick="im_cam"]').count() === 0, "y sin ofrecer cámara, como corresponde a esa vista");
    assert(await page.locator("#im-cancel-prep").count() === 0, "el estado de carga se fue: no quedan dos pantallas encimadas");
    await page.close();
  });

  /* ---------------------------------------------------------- */
  await test("A · la reacción es inmediata también con la plataforma al instante (no se rompió el camino rápido)", async () => {
    const page = await nuevaPagina(browser, { limits: LIMITS_CON_IMAGENES });
    await armarCronometro(page);
    await page.locator("#imp").click();
    await page.waitForTimeout(UMBRAL_MS + 100);
    const ms = await reaccion(page);
    assert(ms !== null && ms <= UMBRAL_MS, `la pantalla cambió a los ${ms} ms del toque`);
    await page.waitForSelector("#im-caps", { timeout: 5000 });
    assert(await page.locator('[data-pick="im_cam"]').count() === 1, "y termina en la pantalla de siempre, con los tres orígenes");
    await page.close();
  });

  /* ---------------------------------------------------------- */
  await test("A2 · si se cierra la hoja mientras la promesa está en camino, lo que resuelve tarde no reabre nada", async () => {
    const page = await nuevaPagina(browser, { limits: LIMITS_SIN_IMAGENES, demoraUse: 1200, demoraLimits: 1200 });
    await page.locator("#imp").click();
    await page.waitForSelector("#imp-live", { state: "attached", timeout: 1000 });
    await page.locator("#closeSheet").click();          // el gesto: se toca la X
    assert(await page.locator("#imp-live").count() === 0, "al cerrar, la hoja se fue de la pantalla");

    await page.waitForTimeout(3000);                    // las dos promesas ya resolvieron
    assert(await page.locator("#imp-live").count() === 0, "y tres segundos después sigue sin reaparecer");
    assert(await page.evaluate(() => document.getElementById("modal").innerHTML.trim()) === "",
      "el modal quedó vacío: nada se reabrió solo");
    await page.close();
  });

  /* ---------------------------------------------------------- */
  await test("A2 · lo que resuelve tarde tampoco pisa un modal ajeno", async () => {
    const page = await nuevaPagina(browser, { limits: LIMITS_SIN_IMAGENES, demoraUse: 1500, demoraLimits: 1500 });
    await page.locator("#imp").click();
    await page.waitForSelector("#imp-live", { state: "attached", timeout: 1000 });
    await page.locator("#closeSheet").click();
    await page.locator("#additem").click();             // la persona se va a cargar la reserva a mano
    await page.waitForTimeout(300);
    const titulo = () => page.locator(".sheet-hd h2").innerText();
    assert(/Nueva reserva/i.test(await titulo()), "se abrió la hoja de cargar a mano");

    await page.waitForTimeout(3000);
    assert(/Nueva reserva/i.test(await titulo()), "y sigue ahí después de que resolvieron las promesas de importar");
    assert(await page.locator("#imp-live").count() === 0, "la hoja de importar no se metió encima");
    await page.close();
  });

  /* ---------------------------------------------------------- */
  await test("A2 · abrir importar dos veces seguidas: la apertura vieja no pisa a la nueva", async () => {
    const page = await nuevaPagina(browser, { limits: LIMITS_CON_IMAGENES, demoraUse: 1500, demoraLimits: 300 });
    await page.locator("#imp").click();
    await page.waitForSelector("#imp-live", { state: "attached", timeout: 1000 });
    await page.locator("#closeSheet").click();
    await page.locator("#imp").click();                 // se vuelve a tocar enseguida
    await page.waitForSelector("#im-caps", { timeout: 8000 });
    await page.waitForTimeout(2500);                    // la primera apertura ya resolvió
    assert(await page.locator("#imp-live").count() === 1, "hay una sola hoja viva, no dos encimadas");
    assert(await page.locator(".sheet").count() === 1, "y un solo modal");
    assert(await page.locator('[data-pick="im_doc"]').count() === 1, "la pantalla de elegir quedó usable");
    await page.close();
  });

  /* ---------------------------------------------------------- */
  await test("A3 · limits() que no contesta nunca: la hoja se completa igual y no saca nada de la pantalla", async () => {
    const page = await nuevaPagina(browser, { limitsMudo: true });
    await page.locator("#imp").click();
    await page.waitForSelector("#imp-live", { state: "attached", timeout: 1000 });
    assert(await page.locator("#im-cancel-prep").count() === 1, "primero se ve el estado de carga");

    // El techo de espera son 4 s: pasado eso la pantalla se dibuja con lo que hay.
    await page.waitForSelector("#im-caps", { timeout: 9000 });
    assert(await page.locator('[data-pick="im_cam"]').count() === 1, "se ofrece «Sacar foto»: no sabemos, no se saca nada");
    assert(await page.locator('[data-pick="im_gal"]').count() === 1, "se ofrece «Galería»");
    assert(await page.locator("#im-caps.warn").count() === 0, "y no se inventa una restricción que nadie confirmó");
    assert(await page.locator("#im-run").count() === 1, "la hoja quedó completa y usable");
    await page.close();
  });

  /* ---------------------------------------------------------- */
  await test("A3 · si limits() contesta tarde, la respuesta se aplica igual", async () => {
    const page = await nuevaPagina(browser, { limits: LIMITS_SIN_IMAGENES, demoraLimits: 6000 });
    await page.locator("#imp").click();
    await page.waitForSelector("#im-caps", { timeout: 9000 });
    assert(await page.locator('[data-pick="im_cam"]').count() === 1, "mientras no se sabe, la cámara se sigue ofreciendo");

    await page.waitForFunction(() => document.querySelectorAll('[data-pick="im_cam"]').length === 0, null, { timeout: 9000 });
    const aviso = await page.locator("#im-caps").innerText();
    assert(/no puede leer imágenes/i.test(aviso), "cuando la respuesta llega, el aviso aparece: " + JSON.stringify(aviso.slice(0, 50)));
    assert(await page.locator('[data-pick="im_gal"]').count() === 0, "y la galería se saca de la pantalla");
    assert(await page.locator('[data-pick="im_doc"]').count() === 1, "queda el PDF, que sí funciona");
    await page.close();
  });

  /* ---------------------------------------------------------- */
  await test("A3 · una respuesta tardía no le borra a la persona el texto que estaba escribiendo", async () => {
    const page = await nuevaPagina(browser, { limits: LIMITS_SIN_IMAGENES, demoraLimits: 6000 });
    await page.locator("#imp").click();
    await page.waitForSelector("#im-caps", { timeout: 9000 });
    await page.locator(".imp-more summary").click();
    await page.locator("#im_text").click();
    await page.locator("#im_text").type("Vuelo G3 1234 EZE GIG código LB0TKCV5");
    await page.waitForTimeout(6000);                    // llega la respuesta tardía
    assert(await page.locator("#im_text").inputValue() === "Vuelo G3 1234 EZE GIG código LB0TKCV5",
      "el texto sigue entero mientras se escribe");
    assert(await page.evaluate(() => document.activeElement && document.activeElement.id) === "im_text",
      "y el foco no se fue del campo");
    const aviso = await page.locator("#im-caps").innerText();
    assert(/no puede leer imágenes/i.test(aviso), "pero el aviso sí se actualizó: " + JSON.stringify(aviso.slice(0, 45)));
    await page.close();
  });

  /* ---------------------------------------------------------- */
  await test("A4 · a los 7 segundos se dice que tarda y se ofrece cargar a mano", async () => {
    const page = await nuevaPagina(browser, { limits: LIMITS_CON_IMAGENES, demoraUse: 12000 });
    await page.locator("#imp").click();
    await page.waitForSelector("#imp-live", { state: "attached", timeout: 1000 });
    await page.waitForTimeout(4000);
    assert(await page.locator("#im-prep-manual").count() === 0, "a los 4 segundos todavía no molesta con nada");

    await page.waitForSelector("#im-prep-manual", { timeout: 6000 });
    const t = await page.locator("#im-slow").innerText();
    assert(/tardando/i.test(t), "a los 7 dice que está tardando: " + JSON.stringify(t.replace(/\s+/g, " ").slice(0, 60)));
    assert(!/perdón|disculp|lo siento/i.test(t), "sin pedir disculpas");

    await page.locator("#im-prep-manual").click();      // el gesto: se toca la salida
    await page.waitForTimeout(300);
    assert(/Nueva reserva/i.test(await page.locator(".sheet-hd h2").innerText()), "y lleva a cargar la reserva a mano");
    await page.waitForTimeout(9000);                    // resuelve `use()` a los 12 s
    assert(/Nueva reserva/i.test(await page.locator(".sheet-hd h2").innerText()),
      "cuando la plataforma por fin contesta, no le pisa la pantalla a la persona");
    await page.close();
  });

  /* ---------------------------------------------------------- B ---- */
  await test("B · sin pdf.js, con imágenes: se dice antes de subir nada y no se ofrece PDF", async () => {
    const page = await nuevaPagina(browser, { limits: LIMITS_CON_IMAGENES, sinPdfjs: true });
    await page.locator("#imp").click();
    await page.waitForSelector("#im-caps", { timeout: 5000 });

    const aviso = await page.locator("#im-caps").innerText();
    assert(/lector de PDF no cargó/i.test(aviso), "el aviso lo dice arriba de todo: " + JSON.stringify(aviso.slice(0, 60)));
    assert(await page.locator("#im-caps.warn").count() === 1, "marcado como advertencia");
    assert(/pegá el texto del correo/i.test(aviso), "y deja a la vista la vía que sigue funcionando");
    assert(!/perdón|disculp|lo siento/i.test(aviso), "no pide disculpas");
    assert(await page.evaluate(() => window.__CALLS__.length) === 0, "y todo esto antes de subir nada");

    const accept = await page.locator("#im_doc").getAttribute("accept");
    assert(accept.indexOf("application/pdf") < 0, "el selector ya no pide PDF: " + accept);
    assert(/image\//.test(accept), "sigue pidiendo imágenes, que es lo que sí se puede leer");
    assert(await page.locator('[data-pick="im_cam"]').count() === 1, "la cámara se sigue ofreciendo");
    assert(await page.locator(".imp-more").evaluate(e => e.open) === true, "y pegar el texto queda abierto, no escondido");
    await page.close();
  });

  /* ---------------------------------------------------------- */
  await test("B · sin pdf.js, un PDF que igual entra a la cola se marca ahí y no se manda", async () => {
    const page = await nuevaPagina(browser, { limits: LIMITS_CON_IMAGENES, sinPdfjs: true });
    await page.locator("#imp").click();
    await page.waitForSelector("#im-caps", { timeout: 5000 });

    // El `accept` es una sugerencia: varios selectores la ignoran.
    const [chooser] = await Promise.all([
      page.waitForEvent("filechooser", { timeout: 10000 }),
      page.locator('[data-pick="im_doc"]').click()
    ]);
    await chooser.setFiles({ name: "voucher.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 falso") });
    await page.waitForTimeout(300);

    const fila = await page.locator(".imp-file").first().innerText();
    assert(/lector de PDF no cargó/i.test(fila), "la fila lo dice antes de interpretar: " + JSON.stringify(fila.replace(/\s+/g, " ").slice(0, 70)));
    assert(await page.locator(".imp-file.err").count() === 1, "y queda marcada como problema");
    assert(await page.locator("#im-run").isDisabled(), "el botón de interpretar queda deshabilitado");
    assert(await page.evaluate(() => window.__CALLS__.length) === 0, "cero llamadas al modelo: no se sube lo que no se puede leer");
    await page.close();
  });

  /* ---------------------------------------------------------- */
  await test("B · sin pdf.js y sin imágenes: no queda ningún selector, y el texto pegado sigue funcionando", async () => {
    const page = await nuevaPagina(browser, { limits: LIMITS_SIN_IMAGENES, sinPdfjs: true });
    await page.locator("#imp").click();
    await page.waitForSelector("#im-caps", { timeout: 5000 });

    const aviso = await page.locator("#im-caps").innerText();
    assert(/no puedo leer imágenes/i.test(aviso) && /lector de PDF tampoco cargó/i.test(aviso),
      "el aviso dice las dos cosas: " + JSON.stringify(aviso.slice(0, 80)));
    assert(/pegá abajo el texto del correo/i.test(aviso), "y dice qué sí se puede hacer");
    assert(await page.locator("[data-pick]").count() === 0, "no se ofrece ningún botón de archivo que no lleve a ningún lado");
    assert(await page.locator(".imp-more").evaluate(e => e.open) === true, "la vía de pegar el texto está abierta a la vista");
    assert(await page.locator("#im-run").isDisabled(), "sin texto todavía, no hay nada que interpretar");

    // Y el camino que queda funciona de punta a punta.
    await page.locator("#im_text").fill("Tu pasaje está confirmado. Lobos a Buenos Aires, 13/09/2026 19:01. Código LB0TKCV5");
    await page.waitForTimeout(150);
    assert(await page.locator("#im-run").isEnabled(), "pegando el texto se habilita interpretar");
    await page.locator("#im-run").click();
    await page.waitForSelector("#im-save", { timeout: 15000 });
    const llamadas = await page.evaluate(() => window.__CALLS__);
    assert(llamadas.length === 1 && llamadas[0].tieneImages === false, "se interpretó por texto, sin mandar imágenes");
    assert(await page.locator('.stack [data-f="confirmation"]').first().inputValue() === "LB0TKCV5",
      "la reserva aparece para revisar, con su código");
    await page.locator("#im-save").click();
    await page.waitForTimeout(600);
    const guardadas = await page.evaluate(() => Store.itemsOf("t1").map(i => i.confirmation));
    assert(guardadas.length === 1 && guardadas[0] === "LB0TKCV5", "y se guarda: " + JSON.stringify(guardadas));
    await page.close();
  });

  console.log("\n====================================================");
  console.log(`  ${ok} pasaron, ${fail} fallaron`);
  console.log("====================================================\n");
  await browser.close();
  process.exitCode = fail ? 1 : 0;
})();
