/* ============================================================
   VAL-76 · VAL-77a — EL TIPO DE VIAJE, TOCADO CON EL DEDO

   Los SIETE gestos del brief, uno por bloque, todos tocando el control
   real. Ninguno dispara el evento interno que el botón debería producir:
   ese atajo ya mató una entrega en este proyecto.

     1 · tocar el botón del tipo desde la cabecera y llegar al selector
     2 · marcar una sola y armar la lista
     3 · marcar dos y armar la lista, y que entren ítems de las dos
     4 · marcar una tercera con dos ya marcadas, y que no pase nada
     5 · destildar una de las dos
     6 · cambiar el tipo con la lista ya armada, sin perder lo empacado,
         lo descartado ni lo que se agregó a mano
     7 · abrir una lista guardada que dice "mixto"

   EL TOPE (gesto 4) SE TOCA DE VERDAD. El botón apagado lleva
   `pointer-events:none`, así que el dedo que cae ahí no le llega: el
   toque va al contenedor. `force:true` es lo que reproduce eso —manda
   el evento de puntero en las coordenadas del botón sin exigir que el
   botón lo reciba—, que es exactamente lo que hace un pulgar.

   LOS CONTROLES NEGATIVOS, corridos y con lo que dan:

   1 · devolver "Mixto" a la grilla — 3 FALLA limpias ("la grilla tiene 5
       tipos (6)", "«Mixto» ya no está en la grilla", "las otras tres se
       apagan"):
         sed 's/t.key !== "mixto"/true/' app/valija.html > /tmp/con-mixto.html

   2 · sacarle el id al botón del tipo — el arnés ABORTA con
       `locator.innerText: Timeout` sobre `#pk-typebtn`, después de una
       FALLA ("hay un botón del tipo en la cabecera"). Aborta, no pasa:
         sed 's/id="pk-typebtn"/id="pk-viejo"/' app/valija.html > /tmp/sin-boton.html

       NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/val76-el-tipo-con-el-dedo.js [ruta/al/valija.html]
   ============================================================ */
"use strict";
const { chromium } = require("playwright");
const path = require("path");
const APP = "file://" + (process.argv[2] || path.resolve(__dirname, "..", "valija.html"));

let fallos = 0;
const ok   = (c, m) => { console.log((c ? "  ok    " : "  FALLA ") + m); if (!c) fallos++; };
const info = m => console.log("  info   " + m);

/* Los viajes. `tSin` no tiene ninguna pista de tipo en el destino; `tCon` sí
   (Bariloche es montaña). Las reservas se escribieron leyendo el formulario de
   `sheetItem`: un vuelo con hora de llegada y otro sin —es un campo opcional—,
   un alojamiento con check-in, check-out y dirección, un auto con retiro y
   devolución, y un traslado con desde, hasta y fecha. Todas `datetime-local`. */
/* `tnada` no tiene reservas NI pistas en el destino: es el caso donde el motor
   no puede proponer nada y contesta "mixto", que ya no se puede marcar. */
const T_NADA = { id:"tnada", name:"Escapada", destination:"Casa de la abuela",
                 startDate:"2027-03-05", endDate:"2027-03-15", hue:90, travelers:"Tomás" };
const T_SIN = { id:"tsin", name:"Con reservas", destination:"",
                startDate:"2027-03-05", endDate:"2027-03-15", hue:214, travelers:"Tomás" };
const T_CON = { id:"tcon", name:"Sur", destination:"Bariloche",
                startDate:"2027-07-10", endDate:"2027-07-20", hue:180, travelers:"Tomás y Ana" };
const T_MIX = { id:"tmix", name:"Vieja", destination:"Madrid",
                startDate:"2027-05-02", endDate:"2027-05-12", hue:30, travelers:"Tomás" };

const RESERVAS_SIN = [
  { id:"a1", type:"flight", title:"Vuelo de ida", from:"EZE", to:"MAD",
    start:"2027-03-05T22:10", end:"2027-03-06T14:35",
    provider:"Iberia", flightNumber:"IB 6844", confirmation:"XKD9P2", seat:"14A" },
  { id:"a2", type:"flight", title:"Vuelo de vuelta", from:"MAD", to:"EZE",
    start:"2027-03-15T12:00", end:"",                        // sin hora de llegada: es opcional
    provider:"Iberia", flightNumber:"IB 6843", confirmation:"XKD9P3" },
  { id:"a3", type:"lodging", title:"Hotel Atocha",
    start:"2027-03-06T15:00", end:"2027-03-15T10:00",
    provider:"Booking · Hotel Atocha", address:"Calle Atocha 123, Madrid", confirmation:"BK-88123" },
  { id:"a4", type:"car", title:"Auto", start:"2027-03-08T10:00", end:"2027-03-12T10:00",
    provider:"Hertz", address:"Aeropuerto de Madrid T4", confirmation:"HZ-77" },
  { id:"a5", type:"transfer", title:"Traslado", from:"Aeropuerto T4", to:"Calle Atocha 123",
    start:"2027-03-06T15:30", provider:"Cabify" }
];

/* El modelo contesta, pero no suma nada: así la capa de destino cierra en "ok"
   y el aviso de "sin ajuste por destino" —que es permanente— no se queda
   tapando a los avisos que este arnés lee. */
const modelo = () => {
  window.claude = { use: async n => n !== "sample" ? null : {
    limits: async () => ({ maxPromptBytes: 65536 }),
    json: async () => ({ items: [], quitar: [] })
  }};
};

const marcadas = page => page.$$eval('#pk-tp [data-t][aria-pressed="true"]', els => els.map(e => e.dataset.t));
const apagadas = page => page.$$eval('#pk-tp [data-t][aria-disabled="true"]', els => els.map(e => e.dataset.t));
const tipoDe = (page, id) => page.evaluate(i => (Store.packingOf(i) || {}).tipoViaje, id);
const clavesDe = (page, id) => page.evaluate(i => Object.keys((Store.packingOf(i) || {}).items || {}).sort(), id);

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const ctx = await browser.newContext({ viewport:{width:390,height:844}, hasTouch:true, isMobile:true });
  const page = await ctx.newPage();
  await page.route("**/*", r => /^file:/.test(r.request().url()) ? r.continue() : r.abort());
  page.on("pageerror", e => { console.log("  >> PAGEERROR: " + e.message); fallos++; });
  await page.addInitScript(modelo);
  await page.addInitScript(([n, a, b, c, res]) => {
    try{ localStorage.setItem("valija.v1", JSON.stringify({
      trips:[n, a, b, c], items:{ [n.id]:[], [a.id]:res, [b.id]:[], [c.id]:[] }, packing:{}
    })); }catch(e){}
  }, [T_NADA, T_SIN, T_CON, T_MIX, RESERVAS_SIN]);
  await page.goto(APP);
  await page.waitForFunction(() => typeof Store !== "undefined" && Store.ready, null, { timeout:15000 });

  const ir = async h => { await page.goto(APP + h); await page.waitForTimeout(500); };

  /* ═══════════ 2 · MARCAR UNA SOLA Y ARMAR LA LISTA ═══════════ */
  console.log("\n· GESTO 2 · marcar una sola y armar la lista");
  await ir("#/trip/tnada/valija");
  await page.waitForTimeout(400);

  ok(await page.locator("#pk-tp [data-t]").count() === 5,
     `la grilla tiene 5 tipos (${await page.locator("#pk-tp [data-t]").count()})`);
  ok(await page.locator('#pk-tp [data-t="mixto"]').count() === 0,
     "«Mixto» ya no está en la grilla: no es un tipo, es la ausencia de uno");

  /* Este viaje no tiene ninguna pista, así que el motor propone "mixto" y eso
     no se puede marcar. La app lo dice en vez de marcar cualquier cosa. */
  info("marcadas al abrir: " + JSON.stringify(await marcadas(page)));
  ok((await marcadas(page)).length === 0,
     "sin pistas del destino no viene ninguna marcada, y no se inventa un tipo");
  const sinPistas = await page.locator("#main .notice").innerText().catch(()=> "");
  ok(/no tengo pistas/i.test(sinPistas), "y lo dice: " + JSON.stringify(sinPistas.replace(/\n+/g," ").slice(0,90)));

  await page.locator('#pk-tp [data-t="playa"]').click();
  await page.waitForTimeout(300);
  ok(JSON.stringify(await marcadas(page)) === JSON.stringify(["playa"]), "al tocar Playa queda marcada, y sola");
  ok(await page.locator('#pk-tp [data-t="playa"] .pick').isVisible(), "y aparece el tilde en el botón");

  await page.locator("#pk-build").click();
  await page.waitForTimeout(2200);
  ok(await tipoDe(page, "tnada") === "playa", `la lista se guardó como playa (${await tipoDe(page,"tnada")})`);
  const dePlaya = await clavesDe(page, "tnada");
  ok(dePlaya.indexOf("malla") >= 0 && dePlaya.indexOf("ojota") >= 0,
     "y trae lo propio de playa (malla, ojotas)");
  ok(dePlaya.indexOf("bota-o-zapatilla-de-trekking") < 0,
     "control: NO trae lo de montaña, que es lo que probaría que el tipo no se usó");

  /* ═══════════ 1 · EL BOTÓN DEL TIPO, EN LA CABECERA ═══════════ */
  console.log("\n· GESTO 1 · tocar el tipo desde donde se ve el tipo");
  const rotulo = await page.locator("#hdr .brand .tag").innerText();
  info("el rótulo dice: " + JSON.stringify(rotulo));
  ok(!/playa/i.test(rotulo), "el tipo ya no es texto muerto dentro del rótulo");

  const btn = page.locator("#pk-typebtn");
  ok(await btn.count() === 1, "hay un botón del tipo en la cabecera");
  ok(/Playa/.test(await btn.innerText()), `y dice el tipo: ${JSON.stringify((await btn.innerText()).trim())}`);
  const caja = await btn.boundingBox();
  info(`el botón mide ${Math.round(caja.width)}×${Math.round(caja.height)} px`);

  await btn.click();
  await page.waitForTimeout(500);
  ok(await page.locator("#pk-tp").count() === 1,
     "tocarlo lleva al selector, sin pasar por el ⓘ");
  ok(await page.locator("#pk-confirmtype").count() === 1,
     "y el selector abre en modo «rehacer», con su botón de confirmar");
  ok(JSON.stringify(await marcadas(page)) === JSON.stringify(["playa"]),
     "abre mostrando lo que la lista dice hoy");
  await page.locator("#pk-canceltype").click();
  await page.waitForTimeout(400);
  ok(await page.locator("#pk-typebtn").count() === 1 && await tipoDe(page,"tnada") === "playa",
     "cancelar vuelve a la lista sin tocar nada");

  /* ═══════════ LA SUGERENCIA SALE DE LAS RESERVAS (continuidad de VAL-72) ═══════════ */
  console.log("\n· el viaje SIN destino escrito pero CON reservas");
  await ir("#/trip/tsin/valija");
  await page.waitForTimeout(400);
  info("marcadas al abrir: " + JSON.stringify(await marcadas(page)));
  ok(JSON.stringify(await marcadas(page)) === JSON.stringify(["ciudad"]),
     "la sugerencia sale de lo reservado —Madrid— y viene marcada");
  const porReservas = await page.locator("#main .notice").innerText().catch(()=> "");
  ok(/reservado/i.test(porReservas),
     "y el motivo dice de dónde salió: " + JSON.stringify(porReservas.replace(/\n+/g," ").slice(0,80)));

  /* ═══════════ 4 y 5 y 3 · DOS TIPOS, EL TOPE Y DESTILDAR ═══════════ */
  console.log("\n· el viaje con pistas en el destino escrito: la sugerencia viene marcada");
  await ir("#/trip/tcon/valija");
  await page.waitForTimeout(400);
  info("marcadas al abrir: " + JSON.stringify(await marcadas(page)));
  ok(JSON.stringify(await marcadas(page)) === JSON.stringify(["montana"]),
     "Bariloche propone montaña, y viene marcada");

  console.log("\n· GESTO 4 · con dos marcadas, la tercera no hace nada");
  await page.locator('#pk-tp [data-t="ciudad"]').click();
  await page.waitForTimeout(300);
  ok((await marcadas(page)).length === 2, `quedan dos marcadas (${JSON.stringify(await marcadas(page))})`);
  const apag = await apagadas(page);
  info("apagadas: " + JSON.stringify(apag));
  ok(apag.length === 3 && apag.indexOf("playa") >= 0,
     "las otras tres se apagan pero NO se van de la pantalla");
  ok(await page.locator('#pk-tp [data-t="playa"]').count() === 1,
     "y siguen ahí para leerlas: sacarlas sería peor que mostrarlas apagadas");

  const antesDelTercero = JSON.stringify(await marcadas(page));
  await page.locator('#pk-tp [data-t="playa"]').click({ force:true });   // el pulgar cae ahí igual
  await page.waitForTimeout(300);
  ok(JSON.stringify(await marcadas(page)) === antesDelTercero,
     "tocar la tercera no cambia nada: siguen las mismas dos");
  ok(await page.locator('#pk-tp [data-t="playa"][aria-pressed="true"]').count() === 0,
     "y la tercera no quedó marcada");

  console.log("\n· GESTO 5 · destildar una de las dos");
  await page.locator('#pk-tp [data-t="ciudad"]').click();
  await page.waitForTimeout(300);
  ok(JSON.stringify(await marcadas(page)) === JSON.stringify(["montana"]),
     "tocar una marcada la saca, y queda la otra");
  ok((await apagadas(page)).length === 0,
     "y con una sola marcada las demás se vuelven a encender");
  ok(await page.locator('#pk-tp [data-t="playa"] .pick').isVisible() === false,
     "control: la que se destildó no dejó el tilde puesto");

  console.log("\n· GESTO 3 · marcar dos y armar la lista");
  await page.locator('#pk-tp [data-t="ciudad"]').click();
  await page.waitForTimeout(300);
  ok((await marcadas(page)).length === 2, "vuelven a ser dos");
  const avisoDos = await page.locator("#main .notice").innerText().catch(()=> "");
  info("el aviso dice: " + JSON.stringify(avisoDos.replace(/\n+/g," ").slice(0,110)));
  ok(/Montaña y ciudad|Ciudad y montaña/i.test(avisoDos),
     "y la app nombra la combinación en castellano, no \"ciudad+montana\"");

  await page.locator("#pk-build").click();
  await page.waitForTimeout(2200);
  const tipoCombo = await tipoDe(page, "tcon");
  info("tipo guardado: " + JSON.stringify(tipoCombo));
  ok(tipoCombo === "ciudad+montana",
     "se guarda UN string, en forma canónica, y no un campo nuevo en paralelo");
  const combo = await clavesDe(page, "tcon");
  ok(combo.indexOf("bota-o-zapatilla-de-trekking") >= 0, "entran ítems de montaña");
  ok(combo.indexOf("un-par-para-salir") >= 0, "y entran ítems de ciudad: las dos listas suman");
  ok(await page.locator("#pk-typebtn").innerText().then(t => /Ciudad y montaña/i.test(t)),
     `el botón de la cabecera lo lee entero: ${JSON.stringify((await page.locator("#pk-typebtn").innerText()).trim())}`);

  /* ═══════════ 6 · CAMBIAR EL TIPO CON LA LISTA YA ARMADA ═══════════ */
  console.log("\n· GESTO 6 · cambiar el tipo sin perder nada de lo tuyo");
  /* Primero se marca a mano, con el dedo: uno empacado, uno descartado y uno
     agregado por la persona. Es lo que VAL-75 protege y lo que VAL-76 no puede
     romper. */
  const empacar = combo.find(k => k === "dni");
  await page.locator(`.pk-row[data-row="${empacar}"] .pk-mark`).click();
  await page.waitForTimeout(400);
  const descartar = combo.find(k => k === "bota-o-zapatilla-de-trekking");
  await page.locator(`.pk-row[data-row="${descartar}"] [data-dropbtn]`).click();
  await page.waitForTimeout(500);

  await page.locator("#pk-additem").click();
  await page.waitForTimeout(400);
  await page.fill("#pk_new_nombre", "Buzo polar");
  await page.locator("#save").click();
  await page.waitForTimeout(900);

  const antes = await page.evaluate(() => {
    const it = Store.packingOf("tcon").items;
    return {
      empacado:(it["dni"]||{}).estado,
      descartado:(it["bota-o-zapatilla-de-trekking"]||{}).estado,
      manual:!!it["buzo-polar"], manualOrigen:(it["buzo-polar"]||{}).origen
    };
  });
  info("antes de rehacer: " + JSON.stringify(antes));
  ok(antes.empacado === "empacado" && antes.descartado === "descartado" && antes.manual,
     "quedó uno empacado, uno descartado y uno agregado a mano");

  await page.locator("#pk-typebtn").click();
  await page.waitForTimeout(500);
  const rehacer = await page.locator("#main").innerText();
  ok(/Rehago la lista con/i.test(rehacer),
     "el selector dice qué va a pasar ANTES de tocar nada");
  ok(await page.locator("#main .pk-keep-row").count() >= 3,
     `y lo dice con números: ${await page.locator("#main .pk-keep-row").count()} renglones de qué se conserva`);
  ok(/empacado/.test(rehacer) && /descartado/.test(rehacer) && /agregaste vos/.test(rehacer),
     "nombra lo empacado, lo descartado y lo tuyo");

  await page.locator('#pk-tp [data-t="ciudad"]').click(); await page.waitForTimeout(250);
  await page.locator('#pk-tp [data-t="montana"]').click(); await page.waitForTimeout(250);
  await page.locator('#pk-tp [data-t="playa"]').click(); await page.waitForTimeout(250);
  ok(JSON.stringify(await marcadas(page)) === JSON.stringify(["playa"]),
     "se destildan las dos y se marca playa: el viaje de montaña pasa a ser de playa");
  await page.locator("#pk-confirmtype").click();
  await page.waitForTimeout(2600);

  const despues = await page.evaluate(() => {
    const l = Store.packingOf("tcon"), it = l.items;
    return {
      tipo:l.tipoViaje,
      empacado:(it["dni"]||{}).estado,
      descartado:(it["bota-o-zapatilla-de-trekking"]||{}).estado,
      manual:!!it["buzo-polar"], manualOrigen:(it["buzo-polar"]||{}).origen,
      hayPlaya:!!it["malla"]
    };
  });
  info("después de rehacer: " + JSON.stringify(despues));
  ok(despues.tipo === "playa", "la lista quedó de playa, que es el caso del PM");
  ok(despues.hayPlaya, "y aparecieron los ítems de playa");
  ok(despues.empacado === "empacado", "lo que estaba empacado SIGUE empacado");
  ok(despues.descartado === "descartado", "lo descartado SIGUE descartado: no revive");
  ok(despues.manual && despues.manualOrigen === "manual", "y lo que agregó a mano sigue ahí, como suyo");

  /* ═══════════ 7 · LA LISTA GUARDADA QUE DICE "mixto" ═══════════ */
  console.log("\n· GESTO 7 · abrir una lista guardada que dice «mixto»");
  /* Precondición, no gesto: se fabrica una lista como las que quedaron
     guardadas antes de esta iteración. Se escribe por `Store`, que es el único
     que sabe dónde viven los datos. */
  await page.evaluate(async () => {
    const trip = Store.trips.get("tmix");
    const l = PackingEngine.buildPackingList({ trip, items:[], tipoViaje:"mixto" });
    await Store.savePacking("tmix", l);
  });
  await ir("#/trip/tmix/valija");
  await page.waitForTimeout(900);

  ok(await tipoDe(page, "tmix") === "mixto", "el valor guardado sigue siendo \"mixto\"");
  const nItems = (await clavesDe(page, "tmix")).length;
  ok(nItems > 20, `la lista se abre entera, con sus ${nItems} ítems`);
  ok(await page.locator(".pk-cat").count() > 0, "y se ve en pantalla, agrupada por categoría");

  const btnMix = page.locator("#pk-typebtn");
  ok(await btnMix.count() === 1, "el botón del tipo está");
  ok(/Mixto/i.test(await btnMix.innerText()), "y dice «Mixto», que es lo que la lista dice");
  ok(await btnMix.evaluate(e => e.classList.contains("pide")),
     "marcado en ámbar: falta un dato, no está roto");

  const avisoMix = await page.locator("#main .notice").innerText().catch(()=> "");
  info("el aviso dice: " + JSON.stringify(avisoMix.replace(/\n+/g," ").slice(0,120)));
  ok(/no sé de qué dos cosas/i.test(avisoMix), "la app pregunta en vez de adivinar");
  ok(/sigue funcionando igual/i.test(avisoMix), "y aclara que mientras tanto no bloquea nada");

  await page.locator('[data-pk="elegirtipos"]').click();
  await page.waitForTimeout(500);
  ok(await page.locator("#pk-tp").count() === 1, "tocar «Elegir las dos» abre el selector");
  ok((await marcadas(page)).length === 0,
     "y no viene nada marcado: de una lista «mixto» no se puede deducir cuáles eran");
  await page.locator("#pk-canceltype").click();
  await page.waitForTimeout(500);

  /* Y la cruz: el aviso es permanente hasta que se cambie el tipo, así que
     tiene que poder cerrarse sin insistir. */
  await page.locator('[data-pk="cerrarmixto"]').click();
  await page.waitForTimeout(400);
  const despuesDeCerrar = await page.locator("#main").innerText();
  ok(!/no sé de qué dos cosas/i.test(despuesDeCerrar), "y se puede cerrar sin responder");
  ok(await page.locator("#pk-typebtn.pide").count() === 1,
     "el chip ámbar de la cabecera queda igual: desde ahí se llega siempre");

  /* ═══════════ SÓLO LECTURA ═══════════ */
  console.log("\n· sin permiso de edición, el botón no falla: está apagado");
  await page.evaluate(() => { Store.canWrite = false; render(); });
  await page.waitForTimeout(500);
  ok(await page.locator("#pk-typebtn").count() === 1, "el tipo se sigue leyendo");
  ok(await page.locator("#pk-typebtn").isDisabled(), "y el botón está deshabilitado, no muerto");
  await page.locator("#pk-typebtn").click({ force:true });
  await page.waitForTimeout(400);
  ok(await page.locator("#pk-tp").count() === 0, "tocarlo no abre nada ni rompe la pantalla");
  await page.evaluate(() => { Store.canWrite = true; render(); });

  console.log("\n====================================================");
  console.log(fallos ? `  ${fallos} FALLARON` : "  Todo en verde — el tipo se cambia con el dedo, y puede ser dos");
  console.log("====================================================\n");
  await browser.close();
  process.exit(fallos ? 1 : 0);
})();
