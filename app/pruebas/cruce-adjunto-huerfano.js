/* ============================================================
   QA · cruce VAL-58 × VAL-60: dos archivos del mismo lote con el
   MISMO NOMBRE (colisión de nombre de archivo), TOCANDO LOS CONTROLES.

   Por qué existe: el motor de adjuntar (doSaveReview, ~línea 9522 de
   valija.html) asocia cada documento a su reserva por STRING de nombre
   de archivo (`card.meta.archivo === src.name`), no por un id único de
   selección. Dos archivos elegidos en el mismo lote de "Importar" que
   compartan el mismo `name` -algo que pasa de verdad: varios navegadores
   móviles le ponen el mismo nombre genérico a una foto recién sacada con
   la cámara ("image.jpg") cada vez que se toca "Sacar foto"- pueden hacer
   que:
     1. Las DOS reservas terminen etiquetadas con el mismo chip de archivo.
     2. `cards.find(...)` devuelva siempre la MISMA tarjeta para las dos
        entradas de `st.sources`, así que se preparan y se guardan DOS
        cuerpos de documento (dos `Store.saveDocBody`), pero sólo UNO
        queda referenciado en `docs` de algún ítem: el otro es un cuerpo
        huérfano que nadie vuelve a nombrar ni a borrar.

   Se corre así:

       NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/cruce-adjunto-huerfano.js
       NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/cruce-adjunto-huerfano.js /ruta/a/otra/copia.html

   ------------------------------------------------------------
   LO QUE ESTE ARNÉS *NO* PRUEBA
   ------------------------------------------------------------
   · Que el navegador de un teléfono real efectivamente entregue el mismo
     `File.name` para dos capturas de cámara distintas. Es un patrón
     conocido de `<input capture>` en Android/iOS, pero no se comprobó acá:
     se lo fuerza a mano dándole a Playwright dos archivos con el mismo
     nombre, que es el gesto equivalente una vez que el navegador ya
     entregó el nombre repetido.
   · Chromium de escritorio no es el teléfono del PM.
   · `claude` es falso: el cuerpo va a `localStorage`, no a la base
     compartida ni a su tope de 5.000 documentos.
   ============================================================ */
"use strict";

const { chromium } = require("playwright");
const path = require("path");

const APP = "file://" + (process.argv[2] || path.resolve(__dirname, "..", "valija.html"));

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

const DOCS = {
  A: {
    marca: "MARCA-VOUCHER-A",
    texto: [
      "COMPROBANTE DE PASAJE - MARCA-VOUCHER-A",
      "LOBOS BUS   Codigo de reserva LB0AAA11",
      "Lobos  ->  Buenos Aires    13/09/2026 19:01 a 20:31",
      "Pasajero: Clara Sanchez. Presentarse quince minutos antes de la salida en la boleteria."
    ].join("\n"),
    reserva: {
      type: "transfer", title: "Lobos → Buenos Aires", start: "2026-09-13T19:01", end: "2026-09-13T20:31",
      from: "Lobos", to: "Buenos Aires", provider: "Lobos Bus", confirmation: "LB0AAA11",
      flightNumber: "", seat: "", terminal: "", gate: "", boardingTime: "",
      address: "", phone: "", cost: "", currency: "", notes: ""
    }
  },
  B: {
    marca: "MARCA-VOUCHER-B",
    texto: [
      "RESERVA DE ALOJAMIENTO - MARCA-VOUCHER-B",
      "Hotel Arpoador  codigo BBB22222",
      "Check-in 20/09/2026 14:00   Check-out 27/09/2026 10:00",
      "Rua Francisco Otaviano 177, Rio de Janeiro. Cancelacion gratuita hasta 48 horas antes."
    ].join("\n"),
    reserva: {
      type: "stay", title: "Hotel Arpoador", start: "2026-09-20T14:00", end: "2026-09-27T10:00",
      from: "", to: "", provider: "Hotel Arpoador", confirmation: "BBB22222",
      flightNumber: "", seat: "", terminal: "", gate: "", boardingTime: "",
      address: "Rua Francisco Otaviano 177", phone: "", cost: "", currency: "", notes: ""
    }
  }
};

/** Un PDF falso que lleva su marca adentro, para que el pdf.js simulado la lea. */
function pdfDe(doc, nombre, bytes) {
  const buf = Buffer.alloc(bytes || 20000, 0x41);
  buf.write("%PDF-1.4 " + doc.marca);
  return { name: nombre, mimeType: "application/pdf", buffer: buf };
}

const LIMITS_SIN_IMAGENES = { maxPromptBytes: 200000 };

async function nuevaPagina(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await page.route("**/*", r => (/^file:/.test(r.request().url()) ? r.continue() : r.abort()));
  page.on("pageerror", e => { console.log("  !! pageerror: " + e.message); fail++; });

  await page.addInitScript(({ datos, docs, limits }) => {
    window.__CALLS__ = [];
    const sample = {
      limits: async () => limits,
      json: async (prompt, opts) => {
        const presentes = docs.filter(d => String(prompt).indexOf(d.marca) >= 0);
        window.__CALLS__.push({ documentos: presentes.map(d => d.marca) });
        if (!presentes.length) return { items: [] };
        if (/"documentos"/.test(String(prompt))) {
          return { documentos: presentes.map((d, i) => ({ documento: i + 1, items: [d.reserva] })) };
        }
        return { items: [presentes[0].reserva] };
      }
    };
    window.claude = { use: async k => (k === "sample" ? sample : null) };

    window.pdfjsLib = {
      version: "3.11.174-simulado",
      GlobalWorkerOptions: {},
      getDocument: function (params) {
        const bytes = new Uint8Array(params.data);
        let cabeza = "";
        for (let i = 0; i < Math.min(bytes.length, 200); i++) cabeza += String.fromCharCode(bytes[i]);
        const doc = docs.find(d => cabeza.indexOf(d.marca) >= 0);
        const paginas = [doc ? doc.texto : ""];
        return { promise: Promise.resolve({
          numPages: paginas.length,
          getPage: n => Promise.resolve({
            getTextContent: () => Promise.resolve({
              items: String(paginas[n - 1]).split("\n").map(str => ({ str: str, hasEOL: true })),
              styles: {}
            })
          }),
          destroy: function () {}
        }) };
      }
    };

    try {
      if (!localStorage.getItem("valija.v1")) localStorage.setItem("valija.v1", JSON.stringify(datos));
    } catch (e) {}
  }, {
    datos: { trips: [TRIP], items: { t1: [] }, packing: {} },
    docs: Object.keys(DOCS).map(k => DOCS[k]),
    limits: LIMITS_SIN_IMAGENES
  });

  await page.goto(APP + "#/trip/t1");
  await page.waitForFunction(() => typeof Store !== "undefined" && Store.ready, null, { timeout: 15000 });
  await page.waitForTimeout(250);
  return page;
}

async function abrirImportar(page) {
  await page.locator("#imp").click();
  await page.waitForSelector("#imp-live", { state: "attached", timeout: 10000 });
  await page.waitForSelector('[data-pick="im_doc"]', { timeout: 10000 });
}
async function tocarYElegir(page, archivos) {
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser", { timeout: 10000 }),
    page.locator('[data-pick="im_doc"]').click()
  ]);
  await chooser.setFiles(archivos);
  await page.waitForTimeout(250);
}
async function interpretar(page) { await page.locator("#im-run").click(); }
const itemsDe = page => page.evaluate(() => Store.itemsOf("t1"));
const clavesDoc = page => page.evaluate(() => Object.keys(localStorage).filter(k => k.indexOf("valija.doc.") === 0));

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

  await test("dos archivos del lote CON EL MISMO NOMBRE: ¿el documento va a la reserva correcta y sin huérfanos?", async () => {
    const page = await nuevaPagina(browser);
    await abrirImportar(page);
    // El gesto real de la persona sería tocar "Sacar foto" dos veces y que el
    // navegador le devuelva el mismo `name` las dos veces. Se fuerza acá dándole
    // a Playwright dos archivos distintos (contenido distinto, DOS reservas
    // distintas) con el string de nombre idéntico: "comprobante.pdf".
    await tocarYElegir(page, [
      pdfDe(DOCS.A, "comprobante.pdf"),
      pdfDe(DOCS.B, "comprobante.pdf")
    ]);
    await interpretar(page);
    await page.waitForSelector("#im-save", { timeout: 20000 });

    const tarjetas = await page.evaluate(() => [...document.querySelectorAll(".imp-card")].map(c => ({
      titulo: (c.querySelector(".imp-title") || {}).value || ""
    })));
    assert(tarjetas.length === 2, `hay dos reservas para revisar (hubo ${tarjetas.length})`);

    await page.locator("#im-save").click();
    await page.waitForTimeout(700);

    const items = await itemsDe(page);
    assert(items.length === 2, `se guardaron las dos reservas (hubo ${items.length})`);

    const conDoc = items.filter(i => (i.docs || []).length > 0);
    const sinDoc = items.filter(i => (i.docs || []).length === 0);
    console.log(`  info   reservas con documento: ${conDoc.length} · sin documento: ${sinDoc.length}`);
    if (sinDoc.length) {
      console.log(`  info   la reserva "${sinDoc[0].title}" se guardó SIN avisar que su comprobante no quedó adjunto`);
    }

    const claves = await clavesDoc(page);
    console.log(`  info   cuerpos de documento en localStorage: ${claves.length}`);
    const idsReferenciados = new Set(items.flatMap(i => (i.docs || []).map(d => d.id)));
    const huerfanos = claves.filter(k => {
      const id = k.split(".").pop();
      return !idsReferenciados.has(id);
    });

    assert(conDoc.length === 2,
      `LAS DOS reservas deberían tener su documento adjunto propio (sólo ${conDoc.length} lo tiene) — con nombres de archivo iguales, el motor asocia por string y pisa la atribución`);
    assert(huerfanos.length === 0,
      `no debería quedar ningún cuerpo de documento sin referenciar por un ítem (quedaron ${huerfanos.length}: ${JSON.stringify(huerfanos)}) — un cuerpo huérfano ocupa cupo de la base para siempre, porque delItem/delTrip sólo borran lo que está en item.docs`);

    await page.close();
  });

  console.log("\n====================================================");
  console.log(`  ${ok} pasaron, ${fail} fallaron`);
  console.log("====================================================");
  await browser.close();
  process.exitCode = fail ? 1 : 0;
})();
