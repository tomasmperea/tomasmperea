/* ============================================================
   VAL-63 — LA LISTA SE ENTERA DE QUE CAMBIÓ EL VIAJE

   De dónde sale, textual del PM el 19/09:

     "cree un viaje con noruega como destino principal para viajar ahora
      (otoño) y luego lo cambié para verano pero la lista no actualizó
      automáticamente"

   Y el dato que acotó el arreglo, también suyo: con el viaje en
   septiembre la app SUPO que en Noruega es otoño. O sea que la capa de
   IA razona sobre la estación; lo que nunca pasaba era que se le
   volviera a preguntar.

   La causa: `checkPackingPlan` se llamaba al guardar una reserva y al
   importar, nunca al guardar el viaje.

   Este arnés toca los GESTOS: abre la hoja del viaje, cambia la fecha y
   toca Guardar. No dispara eventos internos — es la regla del proyecto,
   y es justo el tramo donde vivía el bug.

   El modelo se simula, pero NO para decidir si acierta: se simula para
   poder ver SI SE LE PREGUNTA y CON QUÉ. Lo que este arnés prueba es que
   la pregunta se hace con las fechas nuevas. Que la respuesta sea buena
   es de VAL-66 y se prueba contra un modelo real.

       node app/pruebas/val63-cambia-el-viaje.js [ruta/absoluta/al/valija.html]
   ============================================================ */
"use strict";
const { chromium } = require("playwright");
const path = require("path");
const APP = process.argv[2] || path.resolve(__dirname, "..", "valija.html");

let fallos = 0;
const ok   = (c, m) => { console.log((c ? "  ok    " : "  FALLA ") + m); if (!c) fallos++; };
const info = m => console.log("  info   " + m);

/* El modelo simulado anota cada consulta y contesta según la fecha que
   recibe. Está escrito así a propósito: si la app le pregunta con las
   fechas VIEJAS, la respuesta va a ser la de otoño y el arnés lo ve. */
const modelo = () => {
  window.__CONSULTAS__ = [];
  window.claude = { use: async n => {
    if (n !== "sample") return null;
    return {
      limits: async () => ({ maxPromptBytes: 65536 }),
      json: async (prompt) => {
        window.__CONSULTAS__.push(prompt);
        const junio = /2027-06|junio/i.test(prompt);
        return { items: junio
          ? [{ clave:"repelente-de-mosquitos", nombre:"Repelente de mosquitos", cantidad:1,
               categoria:"salud", motivo:"el verano noruego tiene mosquitos en el norte" }]
          : [{ clave:"campera-impermeable", nombre:"Campera impermeable", cantidad:1,
               categoria:"ropa", motivo:"el otoño noruego es lluvioso" }] };
      }
    };
  }};
};

/** Abre la hoja del viaje TOCANDO el botón de editar de la pantalla del
    viaje, que es `#edittrip`. No se llama a `sheetTrip()` a mano: el bug de
    VAL-63 vivía en el handler de Guardar de esa hoja, y llegar por otro
    camino saltea justo el tramo que importa. */
async function abrirHojaDelViaje(page, tripId){
  await page.evaluate(id => { location.hash = `#/trip/${id}`; }, tripId);
  await page.waitForTimeout(700);
  const editar = await page.$("#edittrip");
  if (editar) { await editar.click(); await page.waitForTimeout(700); }
  return !!editar;
}

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const ctx = await browser.newContext({ viewport:{width:390,height:844}, hasTouch:true, isMobile:true });
  const page = await ctx.newPage();
  await page.route("**/*", r => /^file:/.test(r.request().url()) ? r.continue() : r.abort());
  page.on("pageerror", e => { console.log("  >> PAGEERROR:", e.message); fallos++; });
  await page.addInitScript(modelo);
  /* Los carteles duran 2.600 ms y se borran solos. Mirar el DOM al final
     equivale a llegar tarde: la primera versión de esta prueba leía el toast
     tres segundos después de guardar y lo encontraba vacío, con la app
     funcionando bien. Así que se anota lo que va apareciendo, que es lo que
     la persona alcanza a leer. */
  await page.addInitScript(() => {
    window.__CARTELES__ = [];
    const arranca = () => {
      const caja = document.getElementById("toast");
      if(!caja){ setTimeout(arranca, 50); return; }
      new MutationObserver(() => {
        const t = caja.innerText.trim();
        if(t) window.__CARTELES__.push(t);
      }).observe(caja, { childList:true, subtree:true, characterData:true });
    };
    arranca();
  });
  await page.goto("file://" + APP);
  await page.waitForTimeout(1200);

  /* ---------- el viaje del PM ---------- */
  console.log("\n· el viaje a Noruega, para septiembre");
  await page.click("#newtrip"); await page.waitForTimeout(400);
  await page.fill("#t_name","Noruega");
  await page.fill("#t_dest","Noruega");
  await page.fill("#t_from","2026-09-14");
  await page.fill("#t_to","2026-09-24");
  await page.fill("#t_people","Tomás");
  await page.click("#save"); await page.waitForTimeout(1200);

  /* Se genera la valija, que es la precondición: sin lista guardada
     `checkPackingPlan` sale por su primera guarda y no hay nada que probar.
     La ruta y el botón son los mismos que usa `valija-bloque-b.js`: se copian
     de un arnés que ya funciona en vez de deducirlos. */
  const tripId = await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem("valija.v1") || "{}");
    return (d.trips && d.trips[0] && d.trips[0].id) || null;
  });
  info("id del viaje: " + tripId);
  ok(!!tripId, "el viaje quedó guardado");

  await page.evaluate(id => { location.hash = `#/trip/${id}/valija`; }, tripId);
  await page.waitForTimeout(900);
  const build = await page.$("#pk-build");
  if (build) { await build.click(); await page.waitForTimeout(2500); }
  else {
    /* Puede pedir confirmar el tipo de viaje antes de armar. */
    const conf = await page.$("#pk-confirmtype");
    if (conf) { await conf.click(); await page.waitForTimeout(2500); }
    const b2 = await page.$("#pk-build");
    if (b2) { await b2.click(); await page.waitForTimeout(2500); }
  }

  const hayLista = await page.evaluate(() => {
    const raw = localStorage.getItem("valija.v1"); if(!raw) return false;
    const d = JSON.parse(raw);
    return Object.keys(d.packing || {}).length > 0;
  });
  const filas = await page.evaluate(() => document.querySelectorAll(".pk-row[data-row]").length);
  info(`lista guardada: ${hayLista} · filas en pantalla: ${filas}`);
  ok(hayLista && filas > 0, "hay una valija generada: es la precondición de esta prueba");

  const antes = await page.evaluate(() => window.__CONSULTAS__.length);
  info("consultas al modelo hasta acá: " + antes);

  /* ---------- EL GESTO: cambiar la fecha a junio ---------- */
  console.log("\n· se cambia la fecha a junio de 2027, tocando la pantalla");
  await abrirHojaDelViaje(page, tripId);
  const hayForm = await page.$("#t_from");
  ok(!!hayForm, "se abrió la hoja del viaje para editarlo");
  if (hayForm) {
    await page.fill("#t_from","2027-06-10");
    await page.fill("#t_to","2027-06-20");
    await page.click("#save");
    await page.waitForTimeout(3000);
  }

  const consultas = await page.evaluate(() => window.__CONSULTAS__);
  info("consultas al modelo después de guardar: " + consultas.length);
  ok(consultas.length > antes, `cambiar la fecha VOLVIÓ a preguntarle al modelo (${antes} → ${consultas.length})`);

  const ultima = consultas[consultas.length - 1] || "";
  ok(/2027-06|junio/i.test(ultima),
     "y le preguntó con la fecha NUEVA, no con la vieja");

  /* LO QUE VE LA PERSONA, que es lo único que cuenta.

     Acá había una aserción que miraba si el texto de la pantalla contenía
     "valija|lista|actualiz". Pasaba en verde TAMBIÉN con el cable sacado:
     esas palabras están en cualquier pantalla de la app. Era una aserción que
     no podía fallar, o sea que no probaba nada, y la destapó justamente el
     control negativo — es para eso que existe.

     Lo que se mira ahora es el aviso concreto: el `.notice` que ofrece
     actualizar la lista, que es el que la app pinta cuando `App.plan` quedó
     cargado. Los selectores son los de `valija-bloque-b.js`. */
  const aviso = await page.evaluate(() => {
    const n = document.querySelector("#main .notice") || document.querySelector("#pkdock .notice");
    return n ? n.innerText.replace(/\n+/g, " / ") : null;
  });
  /* OJO: `App` se declara con `const`, así que NO existe en `window`. La
     primera versión de esta línea preguntaba por `window.App && App.plan` y
     daba false siempre — la app estaba bien y la aserción estaba rota. Dentro
     de `page.evaluate` el nombre se resuelve igual, sin el prefijo. */
  const planEnMemoria = await page.evaluate(() => {
    try { return !!(App && App.plan); } catch(e) { return false; }
  });
  info("aviso en pantalla: " + JSON.stringify(aviso));
  info("plan en memoria: " + planEnMemoria);
  ok(planEnMemoria || !!aviso,
     "la app quedó con algo para ofrecer: el cambio no se lo guardó para sí misma");

  /* Y QUE SE ENTERE. Tener el plan en memoria no sirve de nada si la persona
     cambió la fecha desde la pantalla del viaje y se fue a otro lado: la
     oferta la esperaría adentro de la valija sin que nadie le avise. Sería el
     mismo síntoma de VAL-63 con otro disfraz. */
  const carteles = await page.evaluate(() => window.__CARTELES__ || []);
  info("carteles que aparecieron: " + JSON.stringify(carteles));
  ok(carteles.some(t => /sumarte a la valija/i.test(t)),
     "la app le avisó que tiene algo para sumarle, sin que tenga que ir a buscarlo");

  /* Y QUE EL AVISO LLEVE A ALGÚN LADO.

     El PM lo probó en su teléfono el 19/09 y el cartel resultó peor que no
     avisar: aparecía tarde —preguntarle al modelo tarda segundos y él ya se
     había ido a otra pantalla— y no se podía tocar. Su palabra: "no me
     actualizó los items ni me mostró cuáles son los que se agregan".

     Que la lista no se actualice sola es a propósito y él lo confirmó: la app
     propone, no pisa lo que ya marcaste. Lo que estaba mal era el camino para
     verlo. Ahora el cartel se toca y lleva a la valija, donde vive el aviso
     con "Ver qué agrego". */
  const tocable = await page.evaluate(() => {
    const c = document.querySelector(".toast.tocable");
    return c ? { hay:true, dice:c.innerText.replace(/\n+/g," ").trim(), rol:c.getAttribute("role") } : { hay:false };
  });
  info("cartel tocable: " + JSON.stringify(tocable));
  ok(tocable.hay, "el cartel se puede tocar: no es un callejón");
  ok(tocable.rol === "button", "y se anuncia como botón, para quien usa lector de pantalla");

  if (tocable.hay) {
    await page.click(".toast.tocable");
    await page.waitForTimeout(1200);
    const donde = await page.evaluate(() => ({
      hash: location.hash,
      aviso: (document.querySelector("#main .notice") || {}).innerText || null,
      verPlan: document.querySelectorAll('[data-pk="verplan"]').length
    }));
    info("después de tocarlo: " + JSON.stringify(donde));
    ok(/\/valija$/.test(donde.hash), "tocarlo lleva a la valija");
    ok(donde.verPlan === 1 && /Ver qué agrego/i.test(donde.aviso || ""),
       "y ahí está el aviso con «Ver qué agrego», que es lo que el PM no encontraba");
  }

  /* ---------- cambiar SÓLO las notas ----------
     Esta prueba existe por un error mío. La primera versión de VAL-63 dejaba
     las notas afuera del disparador, con el comentario "hoy no las lee nadie".
     Es falso y se mide en cuatro líneas de node: cambiar sólo las notas deja
     la lista desactualizada con 3 ítems nuevos, porque `tripContext` las mete
     en el `textBlob` del que salen los `facts`, y además viajan al modelo. */
  console.log("\n· cambiar SÓLO las notas también mueve la valija");
  const q0 = await page.evaluate(() => window.__CONSULTAS__.length);
  await abrirHojaDelViaje(page, tripId);
  if (await page.$("#t_notes")) {
    await page.fill("#t_notes","vamos a hacer trekking y kayak");
    await page.click("#save");
    await page.waitForTimeout(3000);
  }
  const q1 = await page.evaluate(() => window.__CONSULTAS__.length);
  info(`consultas: ${q0} → ${q1}`);
  ok(q1 > q0, "cambiar las notas volvió a preguntarle al modelo");

  /* ---------- y el nombre, que TAMPOCO era una etiqueta ----------
     La primera versión de esta prueba exigía lo contrario: que renombrar NO
     costara una consulta, "porque el nombre es una etiqueta". También falso.
     Renombrar deja la lista con 5 ítems nuevos AUNQUE el destino esté puesto,
     porque el nombre entra en el mismo `textBlob`.

     Queda anotado como pregunta de producto en VAL-72: que el nombre mueva
     las sugerencias es raro. Pero mientras el motor lo use, el disparador
     tiene que respetarlo — ignorarlo sería el bug original por otra puerta. */
  console.log("\n· renombrar el viaje también, porque el motor usa el nombre");
  const n0 = await page.evaluate(() => window.__CONSULTAS__.length);
  await abrirHojaDelViaje(page, tripId);
  if (await page.$("#t_name")) {
    await page.fill("#t_name","Noruega 2027");
    await page.click("#save");
    await page.waitForTimeout(3000);
  }
  const n1 = await page.evaluate(() => window.__CONSULTAS__.length);
  info(`consultas: ${n0} → ${n1}`);
  ok(n1 > n0, "renombrar volvió a preguntarle al modelo: el nombre alimenta el motor");

  /* ---------- y guardar sin tocar nada, tampoco ----------
     Esta es la que falla si la comparación de fechas está mal hecha: el
     formulario muestra `dayKey(...)` y guarda `YYYY-MM-DD`, así que una fecha
     que vino con hora parecería cambiar sola en cada Guardar. */
  console.log("\n· guardar sin cambiar nada, tampoco");
  const m0 = await page.evaluate(() => window.__CONSULTAS__.length);
  await abrirHojaDelViaje(page, tripId);
  if (await page.$("#save")) { await page.click("#save"); await page.waitForTimeout(2500); }
  const m1 = await page.evaluate(() => window.__CONSULTAS__.length);
  info(`consultas: ${m0} → ${m1}`);
  ok(m1 === m0, "abrir y guardar sin tocar nada no dispara ninguna consulta");

  console.log("\n====================================================");
  console.log(fallos ? `  ${fallos} FALLARON` : "  Todo en verde — la lista se entera de que cambió el viaje");
  console.log("====================================================\n");
  await browser.close();
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error("ERROR:", e); process.exit(1); });
