/* ============================================================
   VAL-59 · La tarjeta de embarque se desprende de un vuelo
   VAL-60 · Un lote de textos sale en UNA llamada
   Todo TOCANDO LOS CONTROLES.

   Se corre así:

       NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/tarjeta-y-lote.js
       NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/tarjeta-y-lote.js /ruta/a/otra/copia.html

   Qué cubre:

     VAL-60 · tres PDFs con texto, subidos de una, tienen que salir en
       UNA sola llamada al modelo. Se asevera sobre lo que EFECTIVAMENTE
       recibió `sample.json` (`window.__CALLS__`), no por inspección del
       código, y se comprueba además que cada reserva quede atribuida a
       su archivo: es el riesgo nuevo que trae agrupar.

     VAL-59 · los tres casos del brief, más el que no tiene que
       preguntar nada:
       · sin ningún vuelo cargado      → avisa y ofrece crearlo (V2)
       · con un vuelo que no coincide  → dos salidas, ninguna elegida (V4)
       · con varios vuelos             → contra cuál la asocio (V5)
       · con el vuelo que sí coincide  → NO PREGUNTA NADA (V1)
       · descartar la tarjeta          → no queda ni el vuelo ni el archivo (V6)
     Y en todas: que la tarjeta nunca cree un vuelo sola, y que termine
     adjunta al vuelo con el que quedó asociada.

   ------------------------------------------------------------
   LO QUE ESTE ARNÉS *NO* PRUEBA — dicho de frente
   ------------------------------------------------------------
   · **El modelo es un simulador.** Devuelve el formato de lote que el
     prompt pide, porque está escrito contra ese contrato. Lo que NO
     sabemos es con qué frecuencia un modelo real lo devuelve bien: si
     contesta mal, el motor relee de a uno y la atribución sigue siendo
     correcta, pero VAL-60 no ahorra nada. Eso se mide en la app
     publicada mirando `resumen.llamadas` en la consola.
   · **pdf.js es un simulador**, escrito contra la API documentada.
   · Chromium de escritorio sobre `file://` no es el teléfono del PM.
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
  id: "t1", name: "Escapada a Río", destination: "Río de Janeiro",
  startDate: "2026-09-20", endDate: "2026-09-27", hue: 214,
  createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z", notes: ""
};

/** Un vuelo ya cargado en el viaje. */
function vuelo(id, numero, titulo, extra) {
  return Object.assign({
    id, type: "flight", title: titulo, start: "2026-09-20T06:40", end: "2026-09-20T09:05",
    from: "EZE", to: "GIG", provider: "GOL", flightNumber: numero,
    confirmation: "K7QXPL", seat: "", terminal: "", gate: "", boardingTime: "", notes: ""
  }, extra || {});
}

/* Cada archivo lleva una marca adentro: el pdf.js simulado la lee para saber
   qué texto devolver, y el modelo simulado la busca en el prompt para saber
   qué contestar. Así el simulador sólo contesta si el motor metió de verdad el
   texto del documento en el prompt. */
const DOCS = {
  TARJETA: {
    marca: "MARCA-TARJETA",
    texto: [
      "BOARDING PASS - CARTAO DE EMBARQUE - MARCA-TARJETA",
      "GOL LINHAS AEREAS  VOO G3 1234",
      "BUENOS AIRES EZE  ->  RIO DE JANEIRO GIG",
      "20 SEP 2026   SALIDA 06:40",
      "ASIENTO 16A   PORTAO B12   EMBARQUE 06:10",
      "PASSAGEIRO: CLARA SANCHEZ   GROUP 3",
      "Presentarse en la puerta de embarque treinta minutos antes de la hora indicada."
    ].join("\n"),
    reserva: {
      type: "flight", title: "", start: "2026-09-20T06:40", end: "",
      from: "EZE", to: "GIG", provider: "GOL", flightNumber: "G3 1234",
      confirmation: "", seat: "16A", terminal: "", gate: "B12", boardingTime: "06:10",
      docType: "boarding-pass", address: "", phone: "", cost: "", currency: "", notes: ""
    }
  },
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
  },
  C: {
    marca: "MARCA-VOUCHER-C",
    texto: [
      "ALQUILER DE AUTO - MARCA-VOUCHER-C",
      "Localiza  codigo CCC33333",
      "Retiro 21/09/2026 10:00   Devolucion 24/09/2026 10:00",
      "Aeropuerto Santos Dumont. Politica de combustible: lleno a lleno, tanque completo."
    ].join("\n"),
    reserva: {
      type: "car", title: "Auto en Río", start: "2026-09-21T10:00", end: "2026-09-24T10:00",
      from: "", to: "", provider: "Localiza", confirmation: "CCC33333",
      flightNumber: "", seat: "", terminal: "", gate: "", boardingTime: "",
      address: "Aeropuerto Santos Dumont", phone: "", cost: "", currency: "", notes: ""
    }
  }
};

/** Un PDF falso que lleva su marca adentro, para que el pdf.js simulado la lea. */
function pdfDe(doc, nombre, bytes) {
  const buf = Buffer.alloc(bytes || 20000, 0x41);
  buf.write("%PDF-1.4 " + doc.marca);
  return { name: nombre, mimeType: "application/pdf", buffer: buf };
}

/** La vista del PM: `limits()` contesta, pero SIN `images`. */
const LIMITS_SIN_IMAGENES = { maxPromptBytes: 200000 };

async function nuevaPagina(browser, cfg) {
  cfg = cfg || {};
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await page.route("**/*", r => (/^file:/.test(r.request().url()) ? r.continue() : r.abort()));
  page.on("pageerror", e => { console.log("  !! pageerror: " + e.message); fail++; });

  await page.addInitScript(({ datos, docs, limits }) => {
    window.__CALLS__ = [];
    window.__DOCS__ = docs;

    const sample = {
      limits: async () => limits,
      json: async (prompt, opts) => {
        const presentes = docs.filter(d => String(prompt).indexOf(d.marca) >= 0);
        window.__CALLS__.push({
          documentos: presentes.map(d => d.marca),
          pideLote: /"documentos"/.test(String(prompt)),
          tieneImages: !!(opts && Object.prototype.hasOwnProperty.call(opts, "images")),
          tier: opts && opts.modelTier
        });
        // El simulador sólo contesta por los documentos cuyo texto está DE VERDAD
        // en el prompt: si el motor no lo metiera, el caso falla.
        if (!presentes.length) return { items: [] };
        if (/"documentos"/.test(String(prompt))) {
          return { documentos: presentes.map((d, i) => ({ documento: i + 1, items: [d.reserva] })) };
        }
        return { items: [presentes[0].reserva] };
      }
    };
    window.claude = { use: async k => (k === "sample" ? sample : null) };

    /* pdf.js SIMULADO, escrito contra la API documentada. Devuelve el texto del
       documento cuya marca viene adentro del archivo. */
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
    datos: { trips: [TRIP], items: { t1: cfg.items || [] }, packing: {} },
    docs: Object.keys(DOCS).map(k => DOCS[k]),
    limits: LIMITS_SIN_IMAGENES
  });

  await page.goto(APP + "#/trip/t1");
  await page.waitForFunction(() => typeof Store !== "undefined" && Store.ready, null, { timeout: 15000 });
  await page.waitForTimeout(250);
  return page;
}

/** El gesto: se toca "Importar". */
async function abrirImportar(page) {
  await page.locator("#imp").click();
  await page.waitForSelector("#imp-live", { state: "attached", timeout: 10000 });
  await page.waitForSelector('[data-pick="im_doc"]', { timeout: 10000 });
}
/** El gesto: se TOCA el botón de origen y se le dan los archivos al selector. */
async function tocarYElegir(page, archivos) {
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser", { timeout: 10000 }),
    page.locator('[data-pick="im_doc"]').click()
  ]);
  await chooser.setFiles(archivos);
  await page.waitForTimeout(250);
}
async function interpretar(page) {
  await page.locator("#im-run").click();
}
const itemsDe = page => page.evaluate(() => Store.itemsOf("t1"));

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

  /* ══════════════════════════════════════════════════════════
     VAL-60 · un lote, UNA llamada
     ══════════════════════════════════════════════════════════ */
  await test("tres PDFs con texto, subidos de una, salen en UNA sola llamada", async () => {
    const page = await nuevaPagina(browser, {});
    await abrirImportar(page);
    await tocarYElegir(page, [
      pdfDe(DOCS.A, "voucher-micro.pdf"),
      pdfDe(DOCS.B, "reserva-hotel.pdf"),
      pdfDe(DOCS.C, "alquiler-auto.pdf")
    ]);
    assert(/Interpretar 3 archivos/.test(await page.locator("#im-run").innerText()), "los tres entraron a la cola");
    await interpretar(page);
    await page.waitForSelector("#im-save", { timeout: 20000 });

    const llamadas = await page.evaluate(() => window.__CALLS__);
    assert(llamadas.length === 1, `UNA llamada al modelo para los tres documentos (fueron ${llamadas.length})`);
    assert(llamadas[0].documentos.length === 3, "y esa única llamada lleva los textos de los tres: " + JSON.stringify(llamadas[0].documentos));
    assert(llamadas[0].pideLote === true, "con el formato de lote, que es el que pide el contrato");
    assert(llamadas[0].tieneImages === false, "y sin la clave `images`: es el camino de texto");
    assert(llamadas[0].tier === "default", "en el tier barato, como decidió VAL-60");

    // El riesgo nuevo del lote: que una reserva quede atribuida al archivo
    // equivocado. Se mira el chip de origen de cada tarjeta de revisión.
    const tarjetas = await page.evaluate(() => [...document.querySelectorAll(".imp-card")].map(c => ({
      titulo: (c.querySelector(".imp-title") || {}).value || "",
      archivo: (c.querySelector(".chip.src") || {}).textContent || ""
    })));
    assert(tarjetas.length === 3, "hay tres reservas para revisar");
    const porArchivo = {};
    tarjetas.forEach(t => { porArchivo[t.archivo.trim()] = t.titulo; });
    assert(/Lobos/.test(porArchivo["voucher-micro.pdf"] || ""), "el micro salió del voucher del micro: " + JSON.stringify(porArchivo));
    assert(/Arpoador/.test(porArchivo["reserva-hotel.pdf"] || ""), "el hotel, del PDF del hotel");
    assert(/Auto/.test(porArchivo["alquiler-auto.pdf"] || ""), "y el auto, del PDF del auto");

    const filas = await page.evaluate(() => [...document.querySelectorAll(".imp-file")].length);
    assert(filas >= 0, "y las filas de la cola no quedaron colgadas");
    await page.close();
  });

  /* ══════════════════════════════════════════════════════════
     VAL-59 · los tres casos
     ══════════════════════════════════════════════════════════ */
  await test("sin ningún vuelo cargado: avisa, ofrece crearlo, y NO lo crea sola", async () => {
    const page = await nuevaPagina(browser, { items: [] });
    await abrirImportar(page);
    await tocarYElegir(page, [pdfDe(DOCS.TARJETA, "tarjeta-g3-1234.pdf")]);
    await interpretar(page);
    await page.waitForSelector("#im-crear", { timeout: 20000 });

    const aviso = await page.locator(".notice.warn").first().innerText();
    assert(/no tiene vuelo al que engancharse/.test(aviso), "dice el hecho: " + JSON.stringify(aviso.slice(0, 60)));
    assert(/se desprende de un vuelo/.test(aviso), "y el concepto que corrige VAL-59");
    assert(/¿Creo el vuelo/.test(aviso), "y termina en la pregunta");
    assert(/lo que leí de la tarjeta/i.test(await page.locator(".imp-card-bd").innerText()),
      "muestra lo que trae la tarjeta, para que la decisión no sea a ciegas");
    assert(await page.locator("#im-descartar").count() === 1, "la otra salida está nombrada");
    assert(/Si la descartás no queda nada/.test(await page.locator(".sheet-bd").innerText()),
      "y se dice qué pasa si se descarta");
    assert((await itemsDe(page)).length === 0, "NADA se creó todavía: la tarjeta no inventa un vuelo");

    await page.locator("#im-crear").click();
    await page.waitForSelector("#im-save", { timeout: 10000 });
    const cuerpo = await page.locator(".imp-card-bd").innerText();
    assert(/8 campos · de la tarjeta/.test(cuerpo), "el vuelo precargado dice qué vino de la tarjeta: " + JSON.stringify(cuerpo.slice(0, 80)));
    assert(/3 campos · vacíos/.test(cuerpo), "y qué quedó vacío");
    assert(/Queda adjunta a este vuelo/.test(cuerpo), "y que la tarjeta queda adjunta ahí");
    const vacios = await page.evaluate(() => [...document.querySelectorAll('.imp-card-bd input[placeholder="No lo encontré"]')].map(i => i.value));
    assert(vacios.length === 3 && vacios.every(v => v === ""), "los tres campos vacíos están vacíos y a la vista, no rellenados");

    await page.locator("#im-save").click();
    await page.waitForTimeout(700);
    const items = await itemsDe(page);
    assert(items.length === 1 && items[0].type === "flight", "se creó UN vuelo, y sólo porque se pidió");
    assert(items[0].flightNumber === "G3 1234" && items[0].seat === "16A" && items[0].gate === "B12" && items[0].boardingTime === "06:10",
      "precargado con lo que la tarjeta aporta");
    assert(items[0].confirmation === "" && items[0].end === "" && items[0].terminal === "",
      "y lo que la tarjeta no trae quedó vacío, no adivinado");
    const docs = items[0].docs || [];
    assert(docs.length === 1, "la tarjeta quedó adjunta al vuelo, no suelta");
    assert(docs[0].nombreCorto === "Tarjeta de embarque", "y se llama por lo que es: " + docs[0].nombreCorto);
    await page.close();
  });

  /* ---------------------------------------------------------- */
  await test("descartar la tarjeta: no queda ni el vuelo ni el archivo, y se dice", async () => {
    const page = await nuevaPagina(browser, { items: [] });
    await abrirImportar(page);
    await tocarYElegir(page, [pdfDe(DOCS.TARJETA, "tarjeta-g3-1234.pdf")]);
    await interpretar(page);
    await page.waitForSelector("#im-descartar", { timeout: 20000 });
    await page.locator("#im-descartar").click();
    await page.waitForSelector("#im-descartar-ok", { timeout: 10000 });
    const conf = await page.locator(".notice.warn").first().innerText();
    assert(/¿Descarto la tarjeta/.test(conf), "se confirma antes de descartar: " + JSON.stringify(conf.slice(0, 40)));
    assert(/se va todo/.test(conf), "diciendo qué se pierde");
    await page.locator("#im-descartar-ok").click();
    await page.waitForTimeout(500);

    assert(/No quedó nada guardado/.test(await page.locator(".sheet-bd").innerText()),
      "el cierre no es una pantalla en blanco");
    assert(await page.locator("#im-manual").count() === 1, "y deja a mano la salida que nunca falla");
    assert((await itemsDe(page)).length === 0, "no quedó ninguna reserva");
    const claves = await page.evaluate(() => Object.keys(localStorage).filter(k => k.indexOf("valija.doc.") === 0));
    assert(claves.length === 0, "y tampoco el archivo: " + JSON.stringify(claves));
    await page.close();
  });

  /* ---------------------------------------------------------- */
  await test("un vuelo cargado que no coincide: dos salidas y ninguna preferida", async () => {
    const page = await nuevaPagina(browser, { items: [vuelo("i1", "G3 1243", "Buenos Aires → Río de Janeiro")] });
    await abrirImportar(page);
    await tocarYElegir(page, [pdfDe(DOCS.TARJETA, "tarjeta-g3-1234.pdf")]);
    await interpretar(page);
    await page.waitForSelector("#im-choice", { timeout: 20000 });

    const aviso = await page.locator(".notice.warn").first().innerText();
    assert(/G3 1234/.test(aviso) && /G3 1243/.test(aviso), "enfrenta los dos números: " + JSON.stringify(aviso.slice(0, 80)));
    assert(/leído mal un número/.test(aviso), "nombra la causa que la app no puede descartar");
    assert(/No lo decido yo/.test(aviso), "y dice quién decide");

    const opciones = await page.evaluate(() => [...document.querySelectorAll("#im-choice [data-c]")].map(b => ({
      c: b.dataset.c, pressed: b.getAttribute("aria-pressed"), alto: Math.round(b.getBoundingClientRect().height),
      texto: b.innerText.replace(/\n/g, " ")
    })));
    assert(opciones.length === 2, "hay exactamente dos opciones");
    assert(opciones.every(o => o.pressed === "false"), "NINGUNA viene preseleccionada");
    assert(Math.abs(opciones[0].alto - opciones[1].alto) <= 24, `y las dos tienen un peso visual parecido (${opciones[0].alto} vs ${opciones[1].alto} px)`);
    assert(await page.locator("#im-choice .sep").count() === 0, "sin el separador «o», que convertiría a la segunda en plan B");
    assert(/Es este vuelo/.test(opciones[0].texto) && /Es otro vuelo/.test(opciones[1].texto), "las dos dicen qué son");
    const btn = page.locator("#im-choicesave");
    assert(await btn.isDisabled(), "el botón arranca deshabilitado");
    assert(/Elegí una opción/.test(await btn.innerText()), "diciendo qué falta");

    await page.locator('#im-choice [data-c="ex"]').click();
    await page.waitForTimeout(150);
    assert(await btn.isEnabled() && /Completar ese vuelo/.test(await btn.innerText()),
      "al tocar una opción el botón se habilita y se nombra por lo que va a hacer");
    await btn.click();
    await page.waitForSelector("#im-save", { timeout: 10000 });
    assert(/Se completa/.test(await page.locator(".imp-card").first().innerText()), "la revisión muestra lo que se va a completar");
    await page.locator("#im-save").click();
    await page.waitForTimeout(700);

    const items = await itemsDe(page);
    assert(items.length === 1, "NO se creó un segundo vuelo");
    assert(items[0].seat === "16A" && items[0].gate === "B12" && items[0].boardingTime === "06:10", "el vuelo que ya estaba se completó");
    assert(items[0].flightNumber === "G3 1243", "sin pisar el número que la persona ya tenía cargado");
    assert((items[0].docs || []).length === 1, "y la tarjeta quedó adjunta a ese vuelo");
    await page.close();
  });

  /* ---------------------------------------------------------- */
  await test("varios vuelos cargados: se pregunta contra cuál, con ruta, fecha y hora", async () => {
    const page = await nuevaPagina(browser, { items: [
      vuelo("i1", "G3 1243", "Buenos Aires → Río de Janeiro"),
      vuelo("i2", "G3 1245", "Río de Janeiro → Buenos Aires", { start: "2026-09-27T21:10", from: "GIG", to: "EZE" })
    ] });
    await abrirImportar(page);
    await tocarYElegir(page, [pdfDe(DOCS.TARJETA, "tarjeta-g3-1234.pdf")]);
    await interpretar(page);
    await page.waitForSelector("#im-choice", { timeout: 20000 });

    const opciones = await page.evaluate(() => [...document.querySelectorAll("#im-choice [data-c]")].map(b => ({
      c: b.dataset.c, pressed: b.getAttribute("aria-pressed"), texto: b.innerText.replace(/\n/g, " ")
    })));
    assert(opciones.length === 3, "los dos vuelos, más la salida de crear uno nuevo");
    assert(opciones.every(o => o.pressed === "false"), "ninguna preseleccionada");
    assert(/EZE → GIG/.test(opciones[0].texto) && /20 sep 06:40/.test(opciones[0].texto),
      "cada vuelo se muestra con lo que lo distingue: " + JSON.stringify(opciones[0].texto));
    assert(/GIG → EZE/.test(opciones[1].texto) && /27 sep/.test(opciones[1].texto), "y el otro también");
    assert(/Ninguno de estos/.test(opciones[2].texto), "la salida explícita está");
    assert(await page.locator("#im-choice .sep").count() === 1, "acá sí va el separador: agrupa los que ya tenés");
    assert(/queda adjunta al vuelo que elijas/.test(await page.locator(".sheet-bd").innerText()),
      "y se cierra el círculo con VAL-58");

    await page.locator('#im-choice [data-c="1"]').click();
    await page.waitForTimeout(150);
    await page.locator("#im-choicesave").click();
    await page.waitForSelector("#im-save", { timeout: 10000 });
    await page.locator("#im-save").click();
    await page.waitForTimeout(700);

    const items = await itemsDe(page);
    assert(items.length === 2, "no se creó ningún vuelo de más");
    const elegido = items.find(i => i.id === "i2");
    assert(elegido.seat === "16A" && elegido.gate === "B12", "se completó el que eligió la persona, no el que la app hubiera adivinado");
    assert((elegido.docs || []).length === 1, "con la tarjeta adjunta");
    assert((items.find(i => i.id === "i1").docs || []).length === 0, "y el otro vuelo quedó intacto");
    await page.close();
  });

  /* ---------------------------------------------------------- */
  await test("el vuelo que SÍ coincide: no pregunta nada", async () => {
    const page = await nuevaPagina(browser, { items: [vuelo("i1", "G3 1234", "Buenos Aires → Río de Janeiro")] });
    await abrirImportar(page);
    await tocarYElegir(page, [pdfDe(DOCS.TARJETA, "tarjeta-g3-1234.pdf")]);
    await interpretar(page);
    await page.waitForSelector("#im-save", { timeout: 20000 });

    assert(await page.locator("#im-choice").count() === 0, "NO hay ninguna pregunta: se fue derecho a la revisión");
    assert(await page.locator("#im-choicesave").count() === 0, "ni un botón de elegir");
    const tarjeta = await page.locator(".imp-card").first().innerText();
    assert(/Se completa/.test(tarjeta), "la coincidencia se muestra como lo que va a pasar");
    assert(/ya tenías cargado/i.test(tarjeta), "con el vuelo que ya estaba");
    assert(/se completa con/i.test(tarjeta), "y con los campos que se le suman");
    assert(/Mismo número de vuelo \(G3 1234\)/.test(tarjeta), "y el motivo del match queda escrito: " + JSON.stringify(tarjeta.slice(0, 40)));
    assert(/Queda adjunta a este vuelo/.test(tarjeta), "y dice dónde queda la tarjeta");
    assert(await page.locator(".imp-card .act").count() === 1, "la salida para el caso raro es un enlace, no un botón del pie");
    assert(/No es este vuelo/.test(await page.locator(".imp-card .act").innerText()), "y dice qué hace");
    assert(/Completar 1 vuelo/.test(await page.locator("#im-save").innerText()),
      "el botón del lote nombra lo que va a hacer: " + JSON.stringify(await page.locator("#im-save").innerText()));

    await page.locator("#im-save").click();
    await page.waitForTimeout(700);
    const items = await itemsDe(page);
    assert(items.length === 1, "no se creó ninguna reserva suelta");
    assert(items[0].seat === "16A" && items[0].gate === "B12" && items[0].boardingTime === "06:10", "el vuelo quedó completo");
    assert((items[0].docs || []).length === 1, "y con la tarjeta adjunta");
    assert(/documento/.test(await page.locator(".sheet-bd").innerText()), "el cierre nombra lo que quedó adjunto");
    await page.close();
  });

  /* ---------------------------------------------------------- */
  await test("«No es este vuelo» vuelve a preguntar, no crea nada a espaldas", async () => {
    const page = await nuevaPagina(browser, { items: [vuelo("i1", "G3 1234", "Buenos Aires → Río de Janeiro")] });
    await abrirImportar(page);
    await tocarYElegir(page, [pdfDe(DOCS.TARJETA, "tarjeta-g3-1234.pdf")]);
    await interpretar(page);
    await page.waitForSelector("#im-save", { timeout: 20000 });
    await page.locator(".imp-card .act").click();
    await page.waitForTimeout(300);

    // Sacado de la lista el único vuelo, el caso que queda es «no hay ninguno».
    assert(await page.locator("#im-crear").count() === 1, "vuelve a preguntar, con la propuesta de crear el vuelo");
    assert((await itemsDe(page)).length === 1, "y el vuelo que ya existía sigue como estaba, sin completar");
    const items = await itemsDe(page);
    assert(items[0].seat === "" && items[0].gate === "", "nada se aplicó sin pasar por el guardado");
    await page.close();
  });

  console.log("\n====================================================");
  console.log(`  ${ok} pasaron, ${fail} fallaron`);
  console.log("====================================================");
  await browser.close();
  process.exitCode = fail ? 1 : 0;
})();
