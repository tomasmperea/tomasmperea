/* ============================================================
   VAL-75 — SACAR DE LA VALIJA, TOCANDO LA PANTALLA

   `val75-la-lista-se-limpia.js` prueba el motor llamando funciones. Esto
   prueba lo otro, que es lo que la auditoría marcó como hueco: la rama
   "sólo sacar" de la interfaz —el aviso, la hoja, el botón, la
   confirmación— no la había tocado nadie con el dedo.

   Es la regla del proyecto que ya se pagó una vez: los botones de importar
   quedaron muertos en el teléfono y ninguna prueba lo vio, porque todas
   disparaban el evento interno sin tocar nunca el botón.

   EL GESTO, entero, como lo hace el PM:
     crear el viaje a Noruega → armar la valija (el modelo contesta cosas
     de Noruega) → empacar una → cambiar el destino a Argentina → tocar el
     aviso → tocar el botón de sacar.

   Los selectores se copian de `val63-cambia-el-viaje.js`, que ya funciona,
   en vez de deducirlos del código.

       node app/pruebas/val75-sacar-con-el-dedo.js [ruta/absoluta/al/valija.html]
   ============================================================ */
"use strict";
const { chromium } = require("playwright");
const path = require("path");
const APP = process.argv[2] || path.resolve(__dirname, "..", "valija.html");

let fallos = 0;
const ok   = (c, m) => { console.log((c ? "  ok    " : "  FALLA ") + m); if (!c) fallos++; };
const info = m => console.log("  info   " + m);

/* El modelo contesta cosas de Noruega mientras el viaje sea a Noruega, y
   NADA cuando ya es Argentina. Ese "nada" es a propósito: es el caso que el
   defecto dejaba afuera, porque sin nada para sumar la app decía que la
   lista estaba al día. */
const modelo = () => {
  window.__CONSULTAS__ = [];
  window.claude = { use: async n => {
    if (n !== "sample") return null;
    return {
      limits: async () => ({ maxPromptBytes: 65536 }),
      json: async (prompt) => {
        window.__CONSULTAS__.push(prompt);
        if (/Brasil/i.test(prompt)) return { items: [
          { nombre:"Repelente de mosquitos", categoria:"salud", cantidad:1,
            motivo:"El norte de Brasil tiene mosquitos todo el año." }
        ], quitar: [] };
        if (/Argentina/i.test(prompt)) return { items: [], quitar: [] };
        return { items: [
          { nombre:"Pantalón impermeable", categoria:"ropa", cantidad:1,
            motivo:"En Noruega la lluvia es frecuente en septiembre." },
          { nombre:"Capas intermedias de polar", categoria:"ropa", cantidad:2,
            motivo:"Fin de septiembre en la montaña noruega es frío." },
          { nombre:"Buff o cuello", categoria:"ropa", cantidad:1,
            motivo:"El viento de montaña en Noruega corta la cara." }
        ], quitar: [] };
      }
    };
  }};
};

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const ctx = await browser.newContext({ viewport:{width:390,height:844}, hasTouch:true, isMobile:true });
  const page = await ctx.newPage();
  await page.route("**/*", r => /^file:/.test(r.request().url()) ? r.continue() : r.abort());
  page.on("pageerror", e => { console.log("  >> PAGEERROR: " + e.message); fallos++; });
  await page.addInitScript(modelo);
  /* Los carteles duran 2.600 ms: mirarlos al final es llegar tarde. Se anota
     lo que va apareciendo, que es lo que la persona alcanza a leer. */
  await page.addInitScript(() => {
    window.__CARTELES__ = [];
    const arranca = () => {
      const caja = document.getElementById("toast");
      if(!caja){ setTimeout(arranca, 50); return; }
      new MutationObserver(() => {
        const t = caja.innerText.trim(); if(t) window.__CARTELES__.push(t);
      }).observe(caja, { childList:true, subtree:true, characterData:true });
    };
    arranca();
  });
  await page.goto("file://" + APP);
  await page.waitForTimeout(1200);

  /* ---------- el viaje a Noruega, y su valija ---------- */
  console.log("\n· el viaje a Noruega, con la valija armada");
  await page.click("#newtrip"); await page.waitForTimeout(400);
  await page.fill("#t_name","Noruega");
  await page.fill("#t_dest","Noruega");
  await page.fill("#t_from","2026-09-14");
  await page.fill("#t_to","2026-09-24");
  await page.fill("#t_people","Tomás");
  await page.click("#save"); await page.waitForTimeout(1200);

  const tripId = await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem("valija.v1") || "{}");
    return (d.trips && d.trips[0] && d.trips[0].id) || null;
  });
  ok(!!tripId, "el viaje quedó guardado");

  await page.evaluate(id => { location.hash = `#/trip/${id}/valija`; }, tripId);
  await page.waitForTimeout(900);
  for (const s of ["#pk-confirmtype", "#pk-build"]) {
    const b = await page.$(s);
    if (b) { await b.click(); await page.waitForTimeout(2500); }
  }
  const b2 = await page.$("#pk-build");
  if (b2) { await b2.click(); await page.waitForTimeout(2500); }

  const deNoruega = await page.evaluate(id =>
    Object.values((Store.packingOf(id) || {}).items || {})
      .filter(i => i.origen === "destino")
      .map(i => ({ clave:i.clave, nombre:i.nombre, porDestino:i.porDestino })), tripId);
  info("ítems de la capa de destino: " + JSON.stringify(deNoruega.map(x=>x.nombre)));
  ok(deNoruega.length === 3, `la capa de destino puso sus tres ítems (${deNoruega.length})`);
  ok(deNoruega.every(x => x.porDestino === "Noruega"),
     "y cada uno guarda que se lo razonó por Noruega");

  /* EL CHIP, que es el defecto B del reporte, leído de la PANTALLA. */
  const chip = await page.evaluate(clave => {
    const fila = document.querySelector(`.pk-row[data-row="${clave}"]`);
    const c = fila && fila.querySelector(".chip");
    return c ? c.innerText.trim() : null;
  }, deNoruega[0].clave);
  info("el chip en pantalla dice: " + JSON.stringify(chip));
  ok(chip === "por Noruega", "el chip dice el destino con el que se generó el ítem");

  /* ---------- se empaca UNA, que es la que no se puede tocar ---------- */
  console.log("\n· se empaca una de las tres, tocando el círculo");
  await page.click(`.pk-row[data-row="${deNoruega[1].clave}"] .pk-mark`);
  await page.waitForTimeout(400);
  const estado = await page.evaluate(([id,k]) => Store.packingOf(id).items[k].estado, [tripId, deNoruega[1].clave]);
  ok(estado === "empacado", `«${deNoruega[1].nombre}» quedó empacada`);

  /* ---------- EL GESTO: cambiar el destino a Argentina ---------- */
  console.log("\n· EL GESTO · se cambia el destino a Argentina desde la pantalla del viaje");
  await page.evaluate(id => { location.hash = `#/trip/${id}`; }, tripId);
  await page.waitForTimeout(700);
  const editar = await page.$("#edittrip");
  ok(!!editar, "el botón de editar el viaje está donde dice el arnés de VAL-63");
  if (editar) { await editar.click(); await page.waitForTimeout(700); }
  await page.fill("#t_dest","Argentina");
  await page.click("#save");
  await page.waitForTimeout(3500);

  const carteles = await page.evaluate(() => window.__CARTELES__ || []);
  info("carteles: " + JSON.stringify(carteles));
  ok(carteles.some(t => /para sacar de la valija/i.test(t)),
     "la app le avisa que tiene cosas para SACAR, no para sumarle");

  /* ---------- tocar el aviso y leer la hoja ---------- */
  console.log("\n· se toca el aviso y se abre la hoja");
  await page.evaluate(id => { location.hash = `#/trip/${id}/valija`; }, tripId);
  await page.waitForTimeout(1200);

  const textoBoton = await page.evaluate(() => {
    const b = document.querySelector('[data-pk="verplan"]');
    return b ? b.innerText.trim() : null;
  });
  info("el botón del aviso dice: " + JSON.stringify(textoBoton));
  ok(textoBoton === "Ver qué saco", "el botón no promete agregar nada: este plan sólo saca");

  await page.click('[data-pk="verplan"]');
  await page.waitForTimeout(700);

  const hoja = await page.evaluate(() => {
    const s = document.querySelector(".sheet, #sheet");
    return s ? s.innerText : null;
  });
  ok(!!hoja && /Saco/.test(hoja), "la hoja tiene el bloque de lo que se saca");
  ok(!!hoja && /Lo había sugerido por Noruega/.test(hoja),
     "y cada ítem dice por qué destino lo había sugerido");
  ok(!!hoja && !new RegExp(deNoruega[1].nombre).test(hoja),
     `lo que la persona empacó («${deNoruega[1].nombre}») NO aparece en lo que se saca`);

  const textoAplicar = await page.evaluate(() => {
    const b = document.getElementById("pk-plan-apply");
    return b ? b.innerText.trim() : null;
  });
  info("el botón de la hoja dice: " + JSON.stringify(textoAplicar));
  ok(/^Sacar \d+$/.test(textoAplicar || ""), "el botón dice sacar, con el número");

  /* ---------- EL GESTO FINAL: tocarlo ---------- */
  console.log("\n· se toca el botón, que es lo que nadie había probado");
  await page.click("#pk-plan-apply");
  await page.waitForTimeout(2500);

  const despues = await page.evaluate(id => {
    const l = Store.packingOf(id) || {};
    const items = Object.values(l.items || {});
    return {
      claves: items.map(i => i.clave),
      motivosConNoruega: items.filter(i => /[Nn]oruega/.test(i.motivo || "")).map(i => i.nombre),
      empacados: items.filter(i => i.estado === "empacado").map(i => i.nombre)
    };
  }, tripId);
  info("siguen empacados: " + JSON.stringify(despues.empacados));

  ok(despues.claves.indexOf(deNoruega[0].clave) < 0 && despues.claves.indexOf(deNoruega[2].clave) < 0,
     "los dos que no había tocado se fueron de la lista guardada");
  ok(despues.claves.indexOf(deNoruega[1].clave) >= 0,
     "el que empacó sigue en la lista");
  ok(despues.empacados.indexOf(deNoruega[1].nombre) >= 0,
     "y sigue empacado: la valija de verdad no se toca");
  ok(despues.motivosConNoruega.length === 1 &&
     despues.motivosConNoruega[0] === deNoruega[1].nombre,
     `el único motivo que todavía habla de Noruega es el del ítem empacado (${JSON.stringify(despues.motivosConNoruega)})`);

  const cartelesFin = await page.evaluate(() => window.__CARTELES__ || []);
  ok(cartelesFin.some(t => /Saqué \d+ cosas? que ya no correspondían?/.test(t)),
     "y la app confirma lo que hizo, en vez de cerrar la hoja sin decir nada");

  /* ---- EL PLAN MIXTO, que es el que el PM vio en su teléfono ---- */
  console.log("\n· EL PLAN MIXTO · cuando suma Y saca, el cartel tiene que decir las dos cosas");
  /* Lo encontró el PM el 22/09 con una captura: un plan de 14 para sumar y 10
     para sacar se aplicó, y el único cartel decía "Sumé 14 cosas". Los 10 que
     se fueron no los nombró nadie.

     El toast de `aplicarPlan` no lo cubría: dispara sólo cuando el plan es
     SÓLO sacar, que es el caso que yo había probado con el dedo. El mixto —el
     más común cuando cambia el destino— quedaba mudo sobre la mitad de lo que
     hacía. Misma clase de error que el barrido de textos: arreglé la instancia
     que estaba mirando. */
  /* Para que el plan sea MIXTO hace falta que haya algo para sacar. Se
     desmarca el ítem que estaba empacado —tocando el mismo círculo, que es un
     interruptor— y vuelve a ser un pendiente sugerido: lo único que el
     recálculo puede sacar. Es precondición, y se arma con el dedo igual. */
  await page.evaluate(id => { location.hash = `#/trip/${id}/valija`; }, tripId);
  await page.waitForTimeout(900);
  await page.click(`.pk-row[data-row="${deNoruega[1].clave}"] .pk-mark`);
  await page.waitForTimeout(500);
  const volvioAPendiente = await page.evaluate(([id,k]) =>
    (Store.packingOf(id).items[k] || {}).estado, [tripId, deNoruega[1].clave]);
  ok(volvioAPendiente === "pendiente", `«${deNoruega[1].nombre}» vuelve a pendiente al tocar el círculo`);

  await page.evaluate(id => { location.hash = `#/trip/${id}`; }, tripId);
  await page.waitForTimeout(700);
  const editar2 = await page.$("#edittrip");
  if (editar2) { await editar2.click(); await page.waitForTimeout(700); }
  await page.fill("#t_dest","Brasil");
  await page.click("#save");
  await page.waitForTimeout(3500);

  await page.evaluate(id => { location.hash = `#/trip/${id}/valija`; }, tripId);
  await page.waitForTimeout(1200);

  const cuentas = await page.evaluate(id => {
    const p = planDe(id); return p ? planCuentas(p) : null;
  }, tripId);
  info("el plan ofrece: " + JSON.stringify(cuentas));
  ok(!!cuentas && cuentas.suma > 0 && cuentas.saca > 0,
     "el plan suma Y saca: es el caso mixto, el que el cartel se callaba");

  if (cuentas && cuentas.suma && cuentas.saca) {
    await page.click('[data-pk="verplan"]');
    await page.waitForTimeout(600);
    const botonMixto = await page.evaluate(() => {
      const b = document.getElementById("pk-plan-apply");
      return b ? b.innerText.trim() : null;
    });
    info("el botón de la hoja dice: " + JSON.stringify(botonMixto));
    ok(/^Sumar \d+ y sacar \d+$/.test(botonMixto || ""),
       "el botón nombra las dos acciones, no una sola");

    await page.click("#pk-plan-apply");
    await page.waitForTimeout(2500);

    const cartel = await page.evaluate(() => {
      const n = document.querySelector("#main .notice.ok");
      return n ? n.innerText.replace(/\n+/g, " ") : null;
    });
    info("el cartel de confirmación dice: " + JSON.stringify(cartel));
    ok(!!cartel && /Sum[ée]/.test(cartel), "el cartel nombra lo que sumó");
    ok(!!cartel && /saqu[ée]/i.test(cartel),
       "y TAMBIÉN lo que sacó, que es lo que se callaba");
    /* El número tiene que estar PEGADO a "saqué", no suelto en el cartel: la
       primera versión de esta línea buscaba el número en cualquier parte y
       pasaba con el sabotaje puesto, porque "Sumé 1 cosa" ya tiene un 1. Una
       aserción que sobrevive al sabotaje no prueba nada. */
    ok(!!cartel && new RegExp("saqu[ée] " + cuentas.saca + "\\b", "i").test(cartel),
       `y el número va con el verbo: "saqué ${cuentas.saca}"`);
  }

  console.log("\n====================================================");
  console.log(fallos ? `  ${fallos} FALLARON` : "  Todo en verde — sacar de la valija funciona con el dedo");
  console.log("====================================================\n");
  await browser.close();
  process.exit(fallos ? 1 : 0);
})();
