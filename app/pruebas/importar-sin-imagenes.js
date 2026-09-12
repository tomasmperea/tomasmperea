/* ============================================================
   La pantalla de importar cuando la vista NO acepta imágenes
   (motor de importación v2 — bloque A de docs/briefs/interpretar.md)

   Se corre así:

       NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/importar-sin-imagenes.js

   Qué cubre, TOCANDO LOS CONTROLES (se toca "Importar", se toca el
   botón de origen del archivo, se le entrega el archivo al selector
   que ese botón abre):

     1. Vista sin imágenes: la pantalla lo dice ANTES de subir nada, y
        no ofrece cámara ni galería. Es el bug del PM: subió tres
        archivos, esperó, y recién ahí le dijeron que no se podía.
     2. Vista con imágenes: todo sigue exactamente como antes.
     3. Plataforma sin `limits()` (certeza "desconocida"): tampoco
        cambia nada. No sabemos, no se saca nada de la pantalla.
     4. Un PDF con capa de texto se interpreta SIN mandar imágenes,
        incluso en la vista que no las acepta.
     5. Una imagen que igual entra a la cola (el `accept` es una
        sugerencia que varios selectores ignoran) se marca ahí mismo y
        no se manda: cero llamadas al modelo.

   ------------------------------------------------------------
   LO QUE ESTE ARNÉS *NO* PRUEBA — dicho de frente
   ------------------------------------------------------------
   · **pdf.js es un simulador.** cdnjs está bloqueado en este entorno,
     así que `window.pdfjsLib` se inyecta acá escrito contra la API
     documentada (`getDocument({data}).promise` → `{numPages,
     getPage(n).getTextContent()}` → `{items:[{str, hasEOL}]}`). Un
     simulador replica el contrato, no lo verifica: que el pdf.js real
     devuelva esa forma en un teléfono lo comprueba el PM con los pasos
     de docs/design/import-engine.md §5.
   · **`claude` es falso.** `limits()` y `json()` los inyecta este
     archivo. Que la vista del teléfono responda `limits()` sin
     `images` es la hipótesis confirmada por el mensaje de error que
     vio el PM, no algo leído todavía.
   · Chromium de escritorio sobre `file://` no es el entorno real. Ver
     CLAUDE.md, "La palabra verificado".
   ============================================================ */
"use strict";

const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const APP = "file://" + path.resolve(__dirname, "..", "valija.html");
const VOUCHER = fs.readFileSync(path.resolve(__dirname, "fixtures", "voucher-lobos-bus.txt"), "utf8");

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

/** Lo que devuelve `sample.limits()` en una vista que SÍ acepta imágenes.
    La forma sale del contrato (sample.d.ts 0.2.41): el miembro `images`
    está presente sólo cuando esa vista puede mandarlas. */
const LIMITS_CON_IMAGENES = {
  maxPromptBytes: 200000,
  images: { maxCount: 5, maxInputBytes: 20971520, mediaTypes: ["image/jpeg", "image/png", "image/webp"] }
};
/** La misma llamada en la vista del PM: responde, pero SIN `images`. */
const LIMITS_SIN_IMAGENES = { maxPromptBytes: 200000 };

/**
 * @param {Object} cfg
 * @param {Object|null} cfg.limits  qué resuelve sample.limits()
 * @param {boolean} cfg.conLimits   si `sample` expone el método `limits`
 * @param {string[]} cfg.paginasPdf texto por página del pdf.js simulado
 */
async function nuevaPagina(browser, cfg) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  /* Este entorno bloquea los hosts externos (fuentes, jspdf, pdf.js). Sin
     esto cada carga se queda esperando un handshake que nunca llega y el
     navegador se cae a mitad de la corrida: aparecen fallos que no son del
     producto. La app ya está escrita para funcionar sin ninguno de los tres. */
  await page.route("**/*", r => (/^file:/.test(r.request().url()) ? r.continue() : r.abort()));

  page.on("pageerror", e => { console.log("  !! pageerror: " + e.message); fail++; });

  await page.addInitScript(({ datos, limits, conLimits, paginas, voucher }) => {
    window.__CALLS__ = [];        // cada llamada al modelo, con sus opciones
    window.__LIMITS__ = 0;        // cuántas veces se consultó limits() DE VERDAD

    const sample = {
      json: async (prompt, opts) => {
        window.__CALLS__.push({
          tieneImages: !!(opts && Object.prototype.hasOwnProperty.call(opts, "images")),
          traeElCodigo: String(prompt).indexOf("LB0TKCV5") >= 0,
          traeLaFecha: String(prompt).indexOf("13/09/2026") >= 0
        });
        // Igual que en las pruebas del motor: la reserva sale SÓLO si el
        // prompt trae de verdad el texto del voucher. Si el motor no metiera
        // el texto extraído en el prompt, este caso falla.
        if (String(prompt).indexOf("LB0TKCV5") < 0) return { items: [] };
        return { items: [{
          type: "transfer", title: "Lobos → Buenos Aires",
          start: "2026-09-13T19:01", end: "2026-09-13T20:31",
          from: "Lobos", to: "Buenos Aires", provider: "Lobos Bus",
          confirmation: "LB0TKCV5", flightNumber: "", seat: "", terminal: "", gate: "",
          boardingTime: "", address: "", phone: "", cost: "", currency: "", notes: ""
        }] };
      }
    };
    if (conLimits) sample.limits = async () => { window.__LIMITS__++; return limits; };

    window.claude = { use: async k => (k === "sample" ? sample : null) };

    /* pdf.js SIMULADO, escrito contra la API documentada. No es pdf.js. */
    if (paginas) {
      window.pdfjsLib = {
        version: "3.11.174-simulado",
        GlobalWorkerOptions: {},
        getDocument: function (params) {
          const textos = paginas.map(p => (p === "__VOUCHER__" ? voucher : p));
          return { promise: Promise.resolve({
            numPages: textos.length,
            getPage: n => Promise.resolve({
              getTextContent: () => Promise.resolve({
                items: String(textos[n - 1]).split("\n").map(str => ({ str: str, hasEOL: true })),
                styles: {}
              })
            }),
            destroy: function () {}
          }) };
        }
      };
    }

    try {
      if (!localStorage.getItem("valija.v1")) {
        localStorage.setItem("valija.v1", JSON.stringify(datos));
      }
    } catch (e) {}
  }, {
    datos: { trips: [TRIP], items: { t1: [] }, packing: {} },
    limits: cfg.limits || null,
    conLimits: cfg.conLimits !== false,
    paginas: cfg.paginasPdf || null,
    voucher: VOUCHER
  });

  await page.goto(APP + "#/trip/t1");
  await page.waitForFunction(() => typeof Store !== "undefined" && Store.ready, null, { timeout: 15000 });
  await page.waitForTimeout(300);
  return page;
}

/** El gesto: se toca el botón "Importar" de la barra de abajo. */
async function abrirImportar(page) {
  await page.locator("#imp").click();
  await page.waitForSelector("#imp-live", { state: "attached", timeout: 10000 });
  await page.waitForTimeout(150);
}

/** El gesto: se TOCA el botón de origen y se le da el archivo al selector
    que ese botón abre. Nunca se dispara el `change` del input a mano: ahí
    justamente vivía el bug de los botones muertos en el teléfono. */
async function tocarYElegir(page, pick, archivo) {
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser", { timeout: 10000 }),
    page.locator(`[data-pick="${pick}"]`).click()
  ]);
  await chooser.setFiles(archivo);
  await page.waitForTimeout(250);
}

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

  /* ---------------------------------------------------------- */
  await test("vista SIN imágenes: la pantalla lo dice antes de subir nada", async () => {
    const page = await nuevaPagina(browser, { limits: LIMITS_SIN_IMAGENES });
    await abrirImportar(page);

    const aviso = await page.locator("#im-caps").innerText();
    assert(/no puede leer imágenes/i.test(aviso), "el aviso está arriba de todo, antes de cualquier archivo: " + JSON.stringify(aviso.slice(0, 70)));
    assert(await page.locator("#im-caps.warn").count() === 1, "y está marcado como advertencia, no como sugerencia");
    assert(/pegá el texto/i.test(aviso), "dice la otra vía que sí funciona: pegar el texto");
    assert(!/perdón|disculp|lo siento/i.test(aviso), "no pide disculpas");

    assert(await page.locator('[data-pick="im_cam"]').count() === 0, "no se ofrece «Sacar foto»");
    assert(await page.locator('[data-pick="im_gal"]').count() === 0, "no se ofrece «Galería»");
    assert(await page.locator('[data-pick="im_doc"]').count() === 1, "queda el botón del PDF, que es lo que sí funciona");
    assert(/PDF/i.test(await page.locator('[data-pick="im_doc"]').innerText()), "y el botón dice PDF, no «Archivo»");
    assert(await page.locator("#im_doc").getAttribute("accept") === "application/pdf",
      "el selector de archivos pide sólo PDF");
    assert(await page.locator(".imp-more").evaluate(e => e.open) === true,
      "la vía de pegar el texto queda abierta, no escondida detrás de un resumen");
    assert(await page.evaluate(() => window.__LIMITS__) === 1,
      "limits() se consultó UNA vez al abrir la hoja");
    assert(await page.evaluate(() => window.__CALLS__.length) === 0,
      "y no se llamó al modelo ni una vez: todavía no se subió nada");

    const caja = await page.locator('[data-pick="im_doc"]').boundingBox();
    assert(caja.width > 44 && caja.height > 44, `el botón mide ${Math.round(caja.width)}x${Math.round(caja.height)} px: entra el pulgar`);
    await page.close();
  });

  /* ---------------------------------------------------------- */
  await test("vista CON imágenes: todo sigue como hoy", async () => {
    const page = await nuevaPagina(browser, { limits: LIMITS_CON_IMAGENES });
    await abrirImportar(page);

    assert(await page.locator('[data-pick="im_cam"]').count() === 1, "se ofrece «Sacar foto»");
    assert(await page.locator('[data-pick="im_gal"]').count() === 1, "se ofrece «Galería»");
    assert(await page.locator('[data-pick="im_doc"]').count() === 1, "se ofrece «Archivo»");
    assert(await page.locator("#im-caps.warn").count() === 0, "no aparece ninguna advertencia que no corresponde");
    assert(/Sacale una foto/i.test(await page.locator("#im-caps").innerText()), "el texto de siempre queda intacto");
    const accept = await page.locator("#im_doc").getAttribute("accept");
    assert(/application\/pdf/.test(accept) && /image\//.test(accept), "el selector acepta PDF e imágenes: " + accept);
    assert(await page.locator(".imp-more").evaluate(e => e.open) === false, "y pegar el texto sigue siendo la vía secundaria");
    await page.close();
  });

  /* ---------------------------------------------------------- */
  await test("plataforma sin limits(): certeza desconocida, no se saca nada de la pantalla", async () => {
    const page = await nuevaPagina(browser, { conLimits: false });
    await abrirImportar(page);
    assert(await page.locator('[data-pick="im_cam"]').count() === 1, "se sigue ofreciendo «Sacar foto»");
    assert(await page.locator('[data-pick="im_gal"]').count() === 1, "se sigue ofreciendo «Galería»");
    assert(await page.locator("#im-caps.warn").count() === 0, "no se inventa una restricción que nadie confirmó");
    assert(await page.evaluate(() => window.__LIMITS__) === 0, "y no se consultó nada, porque no hay qué consultar");
    await page.close();
  });

  /* ---------------------------------------------------------- */
  await test("un PDF con capa de texto se interpreta SIN imágenes, en la vista que no las acepta", async () => {
    const page = await nuevaPagina(browser, { limits: LIMITS_SIN_IMAGENES, paginasPdf: ["__VOUCHER__"] });
    await abrirImportar(page);
    await tocarYElegir(page, "im_doc", {
      name: "RLB_CLARA_SANCHEZ.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 falso")
    });

    assert((await page.locator(".imp-file .nm").first().innerText()).indexOf("RLB_CLARA") === 0,
      "el archivo entró a la cola");
    const botonRun = page.locator("#im-run");
    assert(await botonRun.isEnabled(), "el botón de interpretar se habilita");
    await botonRun.click();
    await page.waitForSelector("#im-save", { timeout: 15000 });

    const llamadas = await page.evaluate(() => window.__CALLS__);
    assert(llamadas.length === 1, "se llamó al modelo una sola vez, no una por página");
    assert(llamadas[0] && llamadas[0].tieneImages === false,
      "la llamada NO lleva la clave `images`: es el camino de texto");
    assert(llamadas[0] && llamadas[0].traeElCodigo === true,
      "el prompt lleva el texto extraído del PDF (trae el código LB0TKCV5)");
    assert(await page.evaluate(() => window.__LIMITS__) === 1,
      "limits() no se volvió a consultar: un PDF con texto ni pregunta");

    // El código vive en un <input>, así que se lee su valor: `innerText` no
    // devuelve lo que hay escrito adentro de un campo.
    const codigo = await page.locator('.stack [data-f="confirmation"]').first().inputValue();
    const desde = await page.locator('.stack [data-f="from"]').first().inputValue();
    assert(codigo === "LB0TKCV5", "la reserva aparece para revisar, con su código: " + JSON.stringify(codigo));
    assert(desde === "Lobos", "y con el origen que salió del texto del PDF: " + JSON.stringify(desde));
    assert(await page.locator(".stack .imp-card").count() === 1, "una sola tarjeta, no una por página");
    assert(/Guardar/.test(await page.locator("#im-save").innerText()), "y el botón de guardar ofrece guardarla");

    // Nada se guardó todavía: eso lo decide la persona.
    assert(await page.evaluate(() => Store.itemsOf("t1").length) === 0,
      "nada se escribió sin que la persona confirme");
    await page.locator("#im-save").click();
    await page.waitForTimeout(600);
    const guardadas = await page.evaluate(() => Store.itemsOf("t1").map(i => i.confirmation));
    assert(guardadas.length === 1 && guardadas[0] === "LB0TKCV5",
      "y al confirmar se guarda la reserva leída del texto: " + JSON.stringify(guardadas));
    await page.close();
  });

  /* ---------------------------------------------------------- */
  await test("el mismo PDF con la vista que SÍ acepta imágenes: igual va por texto", async () => {
    const page = await nuevaPagina(browser, { limits: LIMITS_CON_IMAGENES, paginasPdf: ["__VOUCHER__"] });
    await abrirImportar(page);
    await tocarYElegir(page, "im_doc", {
      name: "voucher.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 falso")
    });
    await page.locator("#im-run").click();
    await page.waitForSelector("#im-save", { timeout: 15000 });
    const llamadas = await page.evaluate(() => window.__CALLS__);
    assert(llamadas.length === 1 && llamadas[0].tieneImages === false,
      "el texto es mejor que la imagen aunque la vista las acepte: no se mandó ninguna");
    assert(await page.locator('.stack [data-f="confirmation"]').first().inputValue() === "LB0TKCV5",
      "y la reserva sale igual");
    await page.close();
  });

  /* ---------------------------------------------------------- */
  await test("una imagen que igual entra a la cola se marca ahí, sin llamar al modelo", async () => {
    const page = await nuevaPagina(browser, { limits: LIMITS_SIN_IMAGENES });
    await abrirImportar(page);
    // El `accept` del input es una sugerencia: varios selectores la ignoran.
    await tocarYElegir(page, "im_doc", {
      name: "foto-del-voucher.jpg", mimeType: "image/jpeg", buffer: Buffer.from("falso")
    });
    const fila = await page.locator(".imp-file").first().innerText();
    assert(/no se pueden leer imágenes/i.test(fila), "la fila lo dice antes de interpretar: " + JSON.stringify(fila.replace(/\s+/g, " ").slice(0, 90)));
    assert(await page.locator(".imp-file.err").count() === 1, "y queda marcada como problema");
    assert(await page.locator("#im-run").isDisabled(), "el botón de interpretar queda deshabilitado: no hay nada legible");
    assert(await page.evaluate(() => window.__CALLS__.length) === 0, "cero llamadas al modelo");

    // Y la salida sigue estando a mano: se pega el texto y se habilita.
    await page.locator("#im_text").fill("Vuelo G3 1234 EZE GIG 20 de septiembre 06:40 código K7QXPL");
    await page.waitForTimeout(120);
    assert(await page.locator("#im-run").isEnabled(), "pegando el texto, la vía que sí funciona se habilita");
    await page.close();
  });

  /* ---------------------------------------------------------- */
  await test("sin IA no se ofrece importar, y la app no se rompe", async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.route("**/*", r => (/^file:/.test(r.request().url()) ? r.continue() : r.abort()));
    page.on("pageerror", e => { console.log("  !! pageerror: " + e.message); fail++; });
    await page.addInitScript(datos => {
      window.claude = { use: async () => null };
      try { if (!localStorage.getItem("valija.v1")) localStorage.setItem("valija.v1", JSON.stringify(datos)); } catch (e) {}
    }, { trips: [TRIP], items: { t1: [] }, packing: {} });
    await page.goto(APP + "#/trip/t1");
    await page.waitForFunction(() => typeof Store !== "undefined" && Store.ready, null, { timeout: 15000 });
    await page.locator("#imp").click();
    await page.waitForTimeout(400);
    const txt = await page.locator(".sheet, #sheet").first().innerText();
    assert(/no está disponible/i.test(txt), "se explica y se manda a la carga manual: " + JSON.stringify(txt.replace(/\s+/g, " ").slice(0, 80)));
    assert(await page.locator('[data-pick="im_doc"]').count() === 0, "no se dibuja el selector de archivos");
    await page.close();
  });

  console.log("\n====================================================");
  console.log(`  ${ok} pasaron, ${fail} fallaron`);
  console.log("====================================================\n");
  await browser.close();
  process.exitCode = fail ? 1 : 0;
})();
