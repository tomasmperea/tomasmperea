/* ============================================================
   VAL-58 · El documento queda en la reserva, TOCANDO LOS CONTROLES

   Se corre así:

       NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/adjuntar-documento.js
       NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/adjuntar-documento.js /ruta/a/otra/copia.html

   Qué cubre, y con qué gesto:

     1. Adjuntar un documento que ENTRA tal cual: se toca "Agregar", se
        toca el botón "Archivo", se le da el archivo al selector que ese
        botón abrió, y se toca "Guardar". Después se mira lo que quedó
        en `Store`, no lo que dice la pantalla.
     2. Adjuntar una foto que NO entra tal cual y hay que RECOMPRIMIR.
        La foto es un JPEG de verdad, generado con canvas en el mismo
        navegador, y la recompresión corre de verdad.
     3. Adjuntar un PDF que NO entra ni recomprimido: **la reserva se
        guarda igual**. Es el criterio del brief ("el dato vale por sí
        mismo") y es la aserción más importante de este arnés.
     4. La tira del documento en la tarjeta de la reserva: existe sólo
        si hay documento, mide lo que tiene que medir, y su texto NO
        está en la tinta plena del título (que la reserva no se vuelva
        un depósito).
     5. El visor: se abre tocando la tira, dice los datos del archivo,
        descarga con la capacidad `downloads` y, cuando esa capacidad
        no está, muestra la explicación en vez de un botón muerto.
     6. Quitar el documento: se confirma en la misma hoja y después no
        queda ni el metadato en la reserva ni el cuerpo en la base.

   ------------------------------------------------------------
   LO QUE ESTE ARNÉS *NO* PRUEBA — dicho de frente
   ------------------------------------------------------------
   · **Chromium de escritorio no es el teléfono del PM.** La
     recompresión con canvas corre acá de verdad —es la primera vez que
     corre en un navegador— pero iOS tiene topes de área de canvas y
     decodificación de HEIC que este entorno no reproduce. Si la foto
     sale negra en el teléfono, es eso y no el tope.
   · **`claude` es falso.** `db` no existe en la corrida, así que el
     cuerpo del documento va por el camino de `localStorage` de `Store`.
     El camino de la base compartida —y su rechazo por tamaño, que es
     el que produce D12 desde el otro lado— no se ejerce acá.
   · **pdf.js es un simulador** y no dibuja páginas, así que el visor de
     un PDF cae siempre en su variante sin previsualización. Es
     justamente el estado que hay que mirar primero en la app publicada.
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

/** Un PDF falso de `bytes` bytes. El motor de adjuntos nunca mira adentro:
    transporta el archivo, no lo interpreta. */
function pdfDe(bytes, nombre) {
  const buf = Buffer.alloc(bytes, 0x41);
  buf.write("%PDF-1.4");
  return { name: nombre, mimeType: "application/pdf", buffer: buf };
}

async function nuevaPagina(browser, cfg) {
  cfg = cfg || {};
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  /* Este entorno bloquea los hosts externos (fuentes, jsPDF, pdf.js). Sin
     cortar la red cada carga espera un handshake que no llega y aparecen
     fallos que no son del producto. La app está escrita para funcionar sin
     ninguno de los tres. */
  await page.route("**/*", r => (/^file:/.test(r.request().url()) ? r.continue() : r.abort()));
  page.on("pageerror", e => { console.log("  !! pageerror: " + e.message); fail++; });

  await page.addInitScript(({ datos, conDescargas }) => {
    window.__DL__ = [];
    const descargas = {
      save: async ({ filename, data }) => {
        window.__DL__.push({
          filename,
          esBlob: data instanceof Blob,
          tipo: data && data.type,
          bytes: data && data.size
        });
      }
    };
    window.claude = {
      use: async k => {
        if (k === "downloads") return conDescargas ? descargas : null;
        return null;   // ni db ni sample: la app tiene que andar igual
      }
    };
    try {
      if (!localStorage.getItem("valija.v1")) localStorage.setItem("valija.v1", JSON.stringify(datos));
    } catch (e) {}
  }, {
    datos: { trips: [TRIP], items: { t1: [] }, packing: {} },
    conDescargas: cfg.conDescargas !== false
  });

  await page.goto(APP + "#/trip/t1");
  await page.waitForFunction(() => typeof Store !== "undefined" && Store.ready, null, { timeout: 15000 });
  await page.waitForTimeout(200);
  return page;
}

/** El gesto: se toca "Agregar" y se llena el título. */
async function nuevaReserva(page, titulo) {
  await page.locator("#additem").click();
  await page.waitForSelector("#i_title", { timeout: 10000 });
  await page.locator("#i_title").fill(titulo);
}

/** El gesto: se TOCA el botón de origen y se le entrega el archivo al selector
    que ese botón abre. Nunca se dispara el `change` del input a mano: ahí
    vivía el bug de los botones muertos en el teléfono. */
async function tocarYElegir(page, pick, archivo) {
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser", { timeout: 10000 }),
    page.locator(`[data-pick="${pick}"]`).click()
  ]);
  await chooser.setFiles(archivo);
}

/** Una foto de verdad, hecha en el mismo navegador: gradiente con grano, que
    es lo que hace pesar a un JPEG sin volverlo incomprimible. */
async function fotoGrande(page) {
  const b64 = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 3000; c.height = 2000;
    const ctx = c.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, 3000, 2000);
    g.addColorStop(0, "#0b45c4"); g.addColorStop(0.5, "#f0a500"); g.addColorStop(1, "#0f1b2e");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 3000, 2000);
    for (let i = 0; i < 4000; i++) {
      ctx.fillStyle = `rgba(${(i * 37) % 255},${(i * 91) % 255},${(i * 53) % 255},.5)`;
      ctx.fillRect((i * 131) % 3000, (i * 271) % 2000, 24, 18);
    }
    const blob = await new Promise(r => c.toBlob(r, "image/jpeg", 0.95));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  });
  return { name: "foto-tarjeta.jpg", mimeType: "image/jpeg", buffer: Buffer.from(b64, "base64") };
}

const itemsDe = page => page.evaluate(() => Store.itemsOf("t1"));

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

  /* ---------------------------------------------------------- */
  await test("un documento que entra queda adjunto a la reserva al tocar Guardar", async () => {
    const page = await nuevaPagina(browser, {});
    await nuevaReserva(page, "Traslado a Lobos");

    assert(await page.locator('[data-pick="doc_file"]').count() === 1, "la hoja de la reserva ofrece «Archivo»");
    assert(await page.locator('[data-pick="doc_cam"]').count() === 1, "y «Sacar foto»");
    const hint = await page.locator("#doc-block .hint").innerText();
    assert(/190 KB/.test(hint), "el tope se dice ANTES de elegir, y son 190 KB: " + JSON.stringify(hint.slice(0, 48)));
    assert(/tres por reserva/.test(hint), "y cuántos caben");
    const caja = await page.locator('[data-pick="doc_file"]').boundingBox();
    assert(caja.width > 44 && caja.height > 44, `el botón mide ${Math.round(caja.width)}x${Math.round(caja.height)} px: entra el pulgar`);

    await tocarYElegir(page, "doc_file", pdfDe(20921, "voucher-lobos-bus.pdf"));
    await page.waitForSelector("#doc-block .imp-file", { timeout: 10000 });
    const fila = await page.locator("#doc-block .imp-file").innerText();
    /* La fila nombra el documento con el NOMBRE CORTO del motor (diseño 5.3),
       que para un adjunto manual es el nombre del archivo sin la extensión: el
       tipo ya lo dice la línea de al lado y no hace falta repetirlo. */
    assert(/voucher-lobos-bus/.test(fila), "la fila dice el archivo: " + JSON.stringify(fila.replace(/\n/g, " ")));
    assert(/PDF · 20 KB/.test(fila), "y su tipo y su peso");
    assert(await page.locator("#doc-block .imp-file.err").count() === 0, "sin rojo: entró tal cual");
    assert(/Queda adjunto cuando toques Guardar/.test(await page.locator("#doc-block .hint").innerText()),
      "y se dice que todavía falta guardar");
    assert(await page.evaluate(() => Store.itemsOf("t1").length) === 0,
      "nada se escribió todavía: preparar un documento no toca la base");

    await page.locator("#save").click();
    await page.waitForTimeout(400);

    const items = await itemsDe(page);
    assert(items.length === 1, "la reserva se guardó");
    const docs = items[0].docs || [];
    assert(docs.length === 1, "con su documento adjunto");
    assert(docs[0].nombreCorto === "voucher-lobos-bus", "el nombre corto de un adjunto manual es el del archivo, sin extensión: " + docs[0].nombreCorto);
    assert(docs[0].estado === "ok" && docs[0].bytes === 20921, "guardado tal cual, con su peso real");
    const cuerpo = await page.evaluate(id => Store.loadDocBody("t1", id), docs[0].id);
    assert(cuerpo && cuerpo.b64 && cuerpo.b64.length > 20000, "y el cuerpo del archivo está guardado, no sólo el metadato");
    await page.close();
  });

  /* ---------------------------------------------------------- */
  await test("una foto que no entra se REDUCE de verdad, y se dice con los dos números", async () => {
    const page = await nuevaPagina(browser, {});
    const foto = await fotoGrande(page);
    assert(foto.buffer.length > 194560, `la foto de prueba pesa ${Math.round(foto.buffer.length / 1024)} KB: no entra tal cual`);

    await nuevaReserva(page, "Vuelo de ida");
    await tocarYElegir(page, "doc_file", foto);
    await page.waitForSelector("#doc-block .imp-file .meta:not(:has(.spin))", { timeout: 20000 });

    const fila = await page.locator("#doc-block .imp-file").innerText();
    assert(/menor calidad/.test(fila), "la fila dice «menor calidad» pegado al peso: " + JSON.stringify(fila.replace(/\n/g, " ")));
    const aviso = await page.locator("#doc-block .notice.warn").innerText();
    assert(/La guardé más chica/.test(aviso), "y el aviso lo explica");
    assert(/190 KB/.test(aviso), "con el tope");
    assert(/pesaba \d/.test(aviso) && /reduje a \d/.test(aviso), "y los dos números: cuánto pesaba y cuánto pesa");
    assert(await page.locator("#doc-block .imp-file.err").count() === 0, "en ámbar y no en rojo: nada se rompió");

    await page.locator("#save").click();
    await page.waitForTimeout(400);
    const docs = (await itemsDe(page))[0].docs || [];
    assert(docs.length === 1 && docs[0].estado === "recomprimido", "quedó guardada, marcada como recomprimida");
    assert(docs[0].bytes <= 194560, `y entra en el tope: ${docs[0].bytes} bytes`);
    assert(docs[0].bytesOriginales > docs[0].bytes, "con su peso original anotado, para poder decirlo cada vez que se abra");
    assert(docs[0].mime === "image/jpeg", "y se guardó como JPEG");
    await page.close();
  });

  /* ---------------------------------------------------------- */
  await test("un PDF que no entra NO impide guardar la reserva", async () => {
    const page = await nuevaPagina(browser, {});
    await nuevaReserva(page, "Itinerario completo");
    await tocarYElegir(page, "doc_file", pdfDe(1258291, "itinerario-completo.pdf"));
    await page.waitForSelector("#doc-block .imp-file.err", { timeout: 10000 });

    const fila = await page.locator("#doc-block .imp-file.err").innerText();
    assert(/1,2 MB/.test(fila), "la fila dice cuánto pesa: " + JSON.stringify(fila.replace(/\n/g, " ")));
    assert(/190 KB/.test(fila), "y cuál es el tope");
    assert(/no lo puedo reducir sin romperlo/.test(fila), "y por qué un PDF no se puede achicar");
    assert(await page.locator("#doc-otro").count() === 1, "la acción que sigue está ahí mismo: «Elegir otro»");
    assert(/La reserva no cambia/.test(await page.locator("#doc-block .hint").innerText()),
      "y se dice lo único que da tranquilidad: la reserva no cambia");
    assert(await page.locator("#save").isEnabled(), "el botón de guardar sigue habilitado");

    await page.locator("#save").click();
    await page.waitForTimeout(400);
    const items = await itemsDe(page);
    assert(items.length === 1, "LA RESERVA SE GUARDÓ IGUAL: el dato vale por sí mismo");
    assert(items[0].title === "Itinerario completo", "con lo que se había cargado a mano");
    assert((items[0].docs || []).length === 0, "y sin ningún documento a medias colgado de ella");
    await page.close();
  });

  /* ---------------------------------------------------------- */
  await test("la tira del documento en la tarjeta: sólo si hay, y sin robarle la jerarquía al título", async () => {
    const page = await nuevaPagina(browser, {});
    await nuevaReserva(page, "Traslado a Lobos");
    await tocarYElegir(page, "doc_file", pdfDe(20921, "voucher-lobos-bus.pdf"));
    await page.waitForSelector("#doc-block .imp-file", { timeout: 10000 });
    await page.locator("#save").click();
    await page.waitForTimeout(400);

    assert(await page.locator(".pass-docs").count() === 1, "aparece una tira, y una sola");
    const tira = page.locator(".pass-doc").first();
    assert(/voucher-lobos-bus/.test(await tira.innerText()), "dice qué es el documento");
    assert(/PDF · 20 KB/.test(await tira.innerText()), "y cuánto pesa");
    assert(!/Descargar|adjuntado el|menor calidad/.test(await tira.innerText()),
      "y NADA más: la descarga, la fecha y la compresión viven en el visor");
    const caja = await tira.boundingBox();
    assert(caja.height >= 36 && caja.height <= 44, `la tira mide ${Math.round(caja.height)} px de alto`);
    assert(await tira.locator("svg").count() === 1, "con el glifo del clip");

    const colores = await page.evaluate(() => {
      const t = document.querySelector(".pass-title"), n = document.querySelector(".pass-doc .nm");
      return { titulo: getComputedStyle(t).color, doc: getComputedStyle(n).color };
    });
    assert(colores.titulo !== colores.doc,
      `el título sigue siendo lo único en tinta plena (${colores.titulo} vs ${colores.doc})`);

    // Una reserva sin documento no cambia en nada.
    await page.locator("#additem").click();
    await page.waitForSelector("#i_title", { timeout: 10000 });
    await page.locator("#i_title").fill("Pan de Azúcar");
    await page.locator("#save").click();
    await page.waitForTimeout(400);
    assert(await page.locator(".pass").count() === 2, "hay dos reservas");
    assert(await page.locator(".pass-docs").count() === 1, "y la que no tiene documento no dibuja ninguna tira");
    await page.close();
  });

  /* ---------------------------------------------------------- */
  await test("el visor se abre TOCANDO la tira, descarga, y quita el documento", async () => {
    const page = await nuevaPagina(browser, {});
    await nuevaReserva(page, "Traslado a Lobos");
    await tocarYElegir(page, "doc_file", pdfDe(20921, "voucher-lobos-bus.pdf"));
    await page.waitForSelector("#doc-block .imp-file", { timeout: 10000 });
    await page.locator("#save").click();
    await page.waitForTimeout(400);

    await page.locator(".pass-doc").first().click();
    await page.waitForSelector("#doc-live", { state: "attached", timeout: 10000 });
    await page.waitForTimeout(400);

    assert(/voucher-lobos-bus/.test(await page.locator(".sheet-hd h2").innerText()),
      "el título del visor es el nombre corto del documento");
    const meta = await page.locator(".doc-meta").innerText();
    assert(/voucher-lobos-bus\.pdf/.test(meta) && /PDF/.test(meta) && /20 KB/.test(meta),
      "la línea de datos trae el archivo, el tipo y el peso: " + JSON.stringify(meta));
    assert(/adjuntado el/.test(meta), "y cuándo se adjuntó");
    assert(await page.locator(".doc-view .ph").count() === 1,
      "sin pdf.js el marco explica por qué no se ve, en vez de dejar un rectángulo gris");
    assert(/No puedo mostrarte el PDF acá/.test(await page.locator(".doc-view .ph").innerText()),
      "con el texto del diseño");

    const dl = page.locator("#doc-dl");
    assert(await dl.count() === 1 && await dl.isEnabled(), "el botón de descargar está y se puede tocar");
    await dl.click();
    await page.waitForTimeout(300);
    const bajados = await page.evaluate(() => window.__DL__);
    assert(bajados.length === 1, "tocar Descargar llama a la capacidad de descarga");
    assert(bajados[0].filename === "voucher-lobos-bus.pdf", "con el nombre del archivo original: " + bajados[0].filename);
    assert(bajados[0].esBlob && bajados[0].bytes === 20921, "y con el archivo entero, no con el metadato");

    await page.locator("#doc-rm").click();
    await page.waitForTimeout(200);
    const conf = await page.locator(".notice.warn").innerText();
    assert(/¿Quito/.test(conf), "«Quitar» confirma en la misma hoja: " + JSON.stringify(conf.slice(0, 40)));
    assert(/quedan como están/.test(conf), "y aclara lo que NO se pierde");
    assert(await page.locator("#doc-rmok").count() === 1, "la salida destructiva está nombrada, no es un «OK»");
    const idDoc = (await itemsDe(page))[0].docs[0].id;
    await page.locator("#doc-rmok").click();
    await page.waitForTimeout(500);

    const items = await itemsDe(page);
    assert((items[0].docs || []).length === 0, "la reserva se queda sin el documento");
    assert(items[0].title === "Traslado a Lobos", "y con todos sus datos");
    const cuerpo = await page.evaluate(id => Store.loadDocBody("t1", id), idDoc);
    assert(!cuerpo, "y el cuerpo del archivo tampoco queda ocupando lugar");
    assert(await page.locator(".pass-docs").count() === 0, "la tira desaparece de la tarjeta");
    await page.close();
  });

  /* ---------------------------------------------------------- */
  await test("reemplazar cambia el archivo y no deja el viejo ocupando lugar", async () => {
    const page = await nuevaPagina(browser, {});
    await nuevaReserva(page, "Traslado a Lobos");
    await tocarYElegir(page, "doc_file", pdfDe(20921, "voucher-lobos-bus.pdf"));
    await page.waitForSelector("#doc-block .imp-file", { timeout: 10000 });
    await page.locator("#save").click();
    await page.waitForTimeout(400);
    const idViejo = (await itemsDe(page))[0].docs[0].id;

    await page.locator(".pass-doc").first().click();
    await page.waitForSelector("#doc-live", { state: "attached", timeout: 10000 });
    await page.waitForTimeout(300);
    assert(await page.locator('[data-pick="doc_repl"]').count() === 1, "el visor ofrece reemplazar");
    await tocarYElegir(page, "doc_repl", pdfDe(31000, "comprobante-de-pago.pdf"));
    await page.waitForTimeout(700);

    const docs = (await itemsDe(page))[0].docs || [];
    assert(docs.length === 1, "sigue habiendo un solo documento");
    assert(docs[0].nombreCorto === "comprobante-de-pago", "y es el nuevo: " + docs[0].nombreCorto);
    assert(docs[0].bytes === 31000, "con su peso");
    const viejo = await page.evaluate(id => Store.loadDocBody("t1", id), idViejo);
    assert(!viejo, "el cuerpo del archivo viejo se borró: no queda gastando cupo");
    await page.close();
  });

  /* ---------------------------------------------------------- */
  await test("tres documentos por reserva, y al llegar al tope se dice", async () => {
    const page = await nuevaPagina(browser, {});
    await nuevaReserva(page, "Vuelo de ida");
    for (const n of ["pasaje.pdf", "tarjeta.pdf", "comprobante.pdf"]) {
      await tocarYElegir(page, "doc_file", pdfDe(20000, n));
      await page.waitForFunction(
        esperados => document.querySelectorAll("#doc-block .imp-file").length === esperados,
        ["pasaje.pdf", "tarjeta.pdf", "comprobante.pdf"].indexOf(n) + 1,
        { timeout: 10000 }
      );
    }
    assert(await page.locator("#doc-block .imp-file").count() === 3, "los tres están en la lista");
    assert(/documentos · 3 de 3/i.test(await page.locator("#doc-block label").innerText()),   // innerText devuelve el texto renderizado: las etiquetas van en versalitas
      "la etiqueta lleva la cuenta: " + JSON.stringify(await page.locator("#doc-block label").innerText()));
    assert(await page.locator('[data-pick="doc_file"]').count() === 0,
      "los botones de origen DESAPARECEN: no quedan grises ofreciendo algo que no va a poder guardar");
    assert(/quitá uno de estos/.test(await page.locator("#doc-block .hint").innerText()),
      "y en su lugar está la frase que dice qué hacer");

    await page.locator("#doc-block [data-docrm]").first().click();
    await page.waitForTimeout(200);
    assert(await page.locator('[data-pick="doc_file"]').count() === 1, "quitando uno, vuelve a ofrecerse");

    await page.locator("#save").click();
    await page.waitForTimeout(500);
    assert(((await itemsDe(page))[0].docs || []).length === 2, "y se guardan los dos que quedaron");
    assert(await page.locator(".pass-doc").count() === 2, "la tarjeta muestra una tira por documento");
    await page.close();
  });

  /* ---------------------------------------------------------- */
  await test("sin capacidad de descarga no hay botón muerto: hay explicación", async () => {
    const page = await nuevaPagina(browser, { conDescargas: false });
    await nuevaReserva(page, "Traslado a Lobos");
    await tocarYElegir(page, "doc_file", pdfDe(20921, "voucher-lobos-bus.pdf"));
    await page.waitForSelector("#doc-block .imp-file", { timeout: 10000 });
    await page.locator("#save").click();
    await page.waitForTimeout(400);

    await page.locator(".pass-doc").first().click();
    await page.waitForSelector("#doc-live", { state: "attached", timeout: 10000 });
    await page.waitForTimeout(400);

    assert(await page.locator("#doc-dl").count() === 0, "el botón de descargar no está");
    const nota = await page.locator(".sheet-bd .notice").last().innerText();
    assert(/no puedo guardar archivos en el teléfono/.test(nota), "y en su lugar se dice qué hacer: " + JSON.stringify(nota.slice(0, 60)));
    assert(await page.locator("#doc-close").count() === 1, "cerrar sigue estando");
    await page.close();
  });

  /* ---------------------------------------------------------- */
  await test("sólo lectura: se mira y se descarga, no se reemplaza ni se quita", async () => {
    const page = await nuevaPagina(browser, {});
    await nuevaReserva(page, "Traslado a Lobos");
    await tocarYElegir(page, "doc_file", pdfDe(20921, "voucher-lobos-bus.pdf"));
    await page.waitForSelector("#doc-block .imp-file", { timeout: 10000 });
    await page.locator("#save").click();
    await page.waitForTimeout(400);

    /* El permiso lo decide el sondeo de escritura de `Store` contra la base
       compartida, que en esta corrida no existe. Se fija el estado a mano —es
       una precondición, no el gesto que se está probando— y se vuelve a pintar
       la pantalla como lo hace la app. */
    await page.evaluate(() => { Store.canWrite = false; render(); });
    await page.waitForTimeout(200);

    await page.locator(".pass-doc").first().click();
    await page.waitForSelector("#doc-live", { state: "attached", timeout: 10000 });
    await page.waitForTimeout(400);

    assert(/sólo lectura/.test(await page.locator(".sheet-bd").innerText()), "el visor dice que es sólo lectura");
    assert(await page.locator("#doc-rm").count() === 0, "«Quitar» no está deshabilitado: no está");
    assert(await page.locator('[data-pick="doc_repl"]').count() === 0, "«Reemplazar» tampoco");
    assert(await page.locator("#doc-dl").count() === 1, "y descargar sí, que es el sentido de compartir un viaje");
    assert(/lo adjuntó quien te compartió el viaje/.test(await page.locator(".doc-meta").innerText()),
      "la línea de datos dice de dónde salió");

    await page.locator("#doc-close").click();
    await page.waitForTimeout(200);
    await page.locator(".pass-main").first().click();
    await page.waitForSelector("#doc-block", { timeout: 10000 });
    assert(await page.locator('[data-pick="doc_file"]').count() === 0,
      "en la hoja de la reserva tampoco se ofrece adjuntar");
    assert(await page.locator("#doc-block .imp-file").count() === 1,
      "pero el documento que ya está se sigue viendo");
    await page.close();
  });

  console.log("\n====================================================");
  console.log(`  ${ok} pasaron, ${fail} fallaron`);
  console.log("====================================================");
  await browser.close();
  process.exitCode = fail ? 1 : 0;
})();
