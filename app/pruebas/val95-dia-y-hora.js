"use strict";
/* ============================================================
   VAL-95 — Día y hora por separado (opción B, elegida por el PM el 10/10).

   El reporte: "el formato de día/hora de los vuelos es incómodo y no restringe
   la vuelta si ya elegí una fecha de ida". Medido en la v42: «Llega» se salía
   de la pantalla a 390 px.

   Todo por gesto: se toca «Agregar», se escribe en el campo del DÍA y en el de
   la HORA (los que ve la persona), y se toca «Guardar». El campo oculto que
   guarda el valor se lee recién al final, en lo guardado.

     1  Vuelo: la llegada arranca en el día de la salida y no deja uno anterior.
     2  Mover la salida después de la llegada arrastra la llegada.
     3  Día sin hora: Guardar no guarda y dice qué falta.
     4  Alojamiento: el check-out no se completa solo (no hay noches cero),
        pero tampoco deja un día anterior al check-in.
     5  Abrir una reserva guardada la muestra partida; guardar sin tocar la deja
        idéntica, incluida una vieja con fecha sin hora.
     6  Revisar lo importado: los mismos dos campos, y lo que se corrige se guarda.
     7  A 390 px nada se sale de la pantalla, en tema claro y oscuro.

   Control negativo: `control` corre la v42 (`git show f01c9bf`) y exige que
   falle 1 y 7 (no hay día y hora separados, y «Llega» se sale).

   Uso: NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/val95-dia-y-hora.js [ruta.html | control]
   ============================================================ */
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path"), os = require("os"), { execSync } = require("child_process");

const CONTROL = process.argv[2] === "control";
let HTML = path.resolve(process.argv[2] && !CONTROL ? process.argv[2] : "app/valija.html");
if (CONTROL) {
  HTML = path.join(os.tmpdir(), "valija-v42-f01c9bf.html");
  fs.writeFileSync(HTML, execSync("git show f01c9bf:app/valija.html", { maxBuffer:64e6 }));
}
let fallos = 0, total = 0; const fallaron = new Set();
const ok = (c, m, caso) => { total++; if (c) console.log("  ok    " + m); else { fallos++; if (caso) fallaron.add(caso); console.log("  FALLA " + m); } };
const info = m => console.log("  info  " + m);
const titulo = t => console.log("\n· " + t);

const VIEJO = { id:"v1", type:"flight", title:"Vuelo viejo", from:"EZE", to:"MAD", start:"2026-10-20T22:10", end:"2026-10-21T14:35", provider:"Iberia", confirmation:"IB1" };
const SIN_HORA = { id:"v2", type:"activity", title:"Excursión", start:"2026-10-22", end:"", provider:"", confirmation:"" };
const SEMILLA = { trips:[{ id:"t1", name:"Prueba", destination:"Madrid", startDate:"2026-10-20", endDate:"2026-10-30", hue:200 }],
  items:{ t1:[VIEJO, SIN_HORA] }, packing:{} };

function simulador() {
  const sample = {
    limits: async () => ({ maxPromptBytes:200000 }),
    json: async pr => {
      const p = String(pr);
      if (/equipaje/i.test(p)) return { items:[], quitar:[] };
      if (p.indexOf("IB6844") < 0) return { items:[] };
      return { items:[{ type:"flight", title:"Madrid → Roma", start:"2026-10-25T09:00", end:"2026-10-25T11:30",
        from:"MAD", to:"FCO", provider:"Iberia", flightNumber:"IB 6844", confirmation:"IB6844", seat:"", terminal:"",
        gate:"", boardingTime:"", address:"", phone:"", cost:"", currency:"", notes:"" }] };
    }
  };
  window.claude = { use: async k => (k === "sample" ? sample : null) };
}
/* `isMobile:false` a propósito, como en val87: la app no trae meta viewport y
   con `isMobile:true` el ancho de diseño pasa a 980 px — ahí nada se sale y la
   medición del caso 7 no mide nada (el control lo destapó). */
async function pagina(browser, tema) {
  const p = await browser.newPage({ viewport:{ width:390, height:844 }, hasTouch:true, isMobile:false });
  await p.route("**/*", r => (/^file:/.test(r.request().url()) ? r.continue() : r.abort()));
  p.on("pageerror", e => { fallos++; console.log("  !! pageerror: " + e.message); });
  await p.addInitScript(simulador);
  await p.addInitScript(([d, t]) => { try { if (!localStorage.getItem("valija.v1")) localStorage.setItem("valija.v1", JSON.stringify(d));
    if (t) localStorage.setItem("valija.tema", t); } catch (e) {} }, [SEMILLA, tema || null]);
  await p.goto("file://" + HTML + "#/trip/t1");
  await p.waitForFunction(() => typeof Store !== "undefined" && Store.ready, null, { timeout:15000 });
  await p.waitForTimeout(400);
  return p;
}
const dia = id => `#${id}_dia`;
const hora = (p, id) => p.locator(dia(id)).locator("xpath=..").locator(".fh-t");
const guardadas = p => p.evaluate(() => Store.itemsOf("t1"));
async function nuevaReserva(p, tipo) {
  await p.locator("#additem").click();
  await p.waitForSelector("#i_title", { timeout:10000 });
  await p.locator(`#tp button[data-t="${tipo}"]`).click();
  await p.waitForTimeout(150);
}
const existe = async (p, sel) => (await p.locator(sel).count()) > 0;

(async () => {
  const browser = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium" });

  titulo("1 · vuelo: la llegada arranca en el día de la salida y no deja uno anterior");
  {
    const p = await pagina(browser);
    await nuevaReserva(p, "flight");
    const hay = await existe(p, dia("i_start"));
    ok(hay, "el vuelo tiene un campo de día y uno de hora para «Sale»", "1");
    if (hay) {
      await p.locator("#i_title").fill("Madrid a Roma");
      await p.locator("#i_from").fill("MAD"); await p.locator("#i_to").fill("FCO");
      await p.locator(dia("i_start")).fill("2026-10-24");
      await hora(p, "i_start").fill("10:00");
      const llega = await p.locator(dia("i_end")).inputValue();
      const min = await p.locator(dia("i_end")).getAttribute("min");
      ok(llega === "2026-10-24", `«Llega» arranca en el día de la salida (dice ${llega})`, "1");
      ok(min === "2026-10-24", `y no deja elegir un día anterior (min ${min})`, "1");
      await hora(p, "i_end").fill("11:05");
      await p.locator("#i_provider").fill("Iberia");
      await p.locator("#save").click(); await p.waitForTimeout(700);
      const v = (await guardadas(p)).find(i => i.title === "Madrid a Roma");
      ok(v && v.start === "2026-10-24T10:00" && v.end === "2026-10-24T11:05",
         `se guarda como siempre: ${v && v.start} → ${v && v.end}`, "1");
    }
    await p.close();
  }

  titulo("2 · mover la salida después de la llegada arrastra la llegada");
  {
    const p = await pagina(browser);
    await nuevaReserva(p, "flight");
    if (await existe(p, dia("i_start"))) {
      await p.locator(dia("i_start")).fill("2026-10-24"); await hora(p, "i_start").fill("10:00");
      await hora(p, "i_end").fill("11:05");
      await p.locator(dia("i_start")).fill("2026-10-27");
      const llega = await p.locator(dia("i_end")).inputValue();
      ok(llega === "2026-10-27", `«Llega» sigue a la salida (dice ${llega})`, "2");
      await p.locator(dia("i_start")).fill("2026-10-25");
      ok(await p.locator(dia("i_end")).inputValue() === "2026-10-27", "volver la salida para atrás no mueve la llegada", "2");
    } else ok(false, "hay día y hora separados", "2");
    await p.close();
  }

  titulo("3 · un día sin hora no se guarda en silencio");
  {
    const p = await pagina(browser);
    await nuevaReserva(p, "flight");
    if (await existe(p, dia("i_start"))) {
      await p.locator("#i_title").fill("Sin hora");
      await p.locator(dia("i_start")).fill("2026-10-24");
      await p.locator("#save").click(); await p.waitForTimeout(400);
      const toast = await p.locator(".toast").last().innerText().catch(() => "");
      info("cartel: " + toast);
      ok(/Falta la hora de «Sale»/.test(toast), "dice «Falta la hora de «Sale»»", "3");
      ok(!(await guardadas(p)).some(i => i.title === "Sin hora"), "no guardó nada", "3");
      ok(await p.evaluate(() => document.activeElement && document.activeElement.classList.contains("fh-t")), "el foco queda en la hora", "3");
      ok(/Falta la hora/.test(await p.locator(dia("i_start")).locator("xpath=../..").locator(".fh-msg").innerText()), "y el campo lo dice abajo", "3");
      await hora(p, "i_start").fill("10:00");
      await p.locator("#save").click(); await p.waitForTimeout(600);
      ok((await guardadas(p)).some(i => i.title === "Sin hora" && i.start === "2026-10-24T10:00" && !i.end),
         "con la hora, se guarda; la llegada que completó la app sin hora no lo frena y no se inventa", "3");
    } else ok(false, "hay día y hora separados", "3");
    await p.close();
  }

  titulo("3b · si la persona TOCA el día de llegada y no pone hora, sí falta");
  {
    const p = await pagina(browser);
    await nuevaReserva(p, "flight");
    if (await existe(p, dia("i_start"))) {
      await p.locator("#i_title").fill("Llega a medias");
      await p.locator(dia("i_start")).fill("2026-10-24"); await hora(p, "i_start").fill("10:00");
      await p.locator(dia("i_end")).fill("2026-10-25");
      await p.locator("#save").click(); await p.waitForTimeout(400);
      const toast = await p.locator(".toast").last().innerText().catch(() => "");
      ok(/Falta la hora de «Llega»/.test(toast), `dice «Falta la hora de «Llega»» (dice «${toast}»)`, "3");
      ok(!(await guardadas(p)).some(i => i.title === "Llega a medias"), "no guardó nada", "3");
    } else ok(false, "hay día y hora separados", "3");
    await p.close();
  }

  titulo("4 · alojamiento: el check-out no se completa solo, pero tiene límite");
  {
    const p = await pagina(browser);
    await nuevaReserva(p, "stay");
    if (await existe(p, dia("i_start"))) {
      await p.locator(dia("i_start")).fill("2026-10-24"); await hora(p, "i_start").fill("15:00");
      ok(await p.locator(dia("i_end")).inputValue() === "", "el check-out queda vacío (no hay noches cero)", "4");
      ok(await p.locator(dia("i_end")).getAttribute("min") === "2026-10-24", "y no deja un día anterior al check-in", "4");
    } else ok(false, "hay día y hora separados", "4");
    await p.close();
  }

  titulo("5 · abrir una reserva guardada y guardar sin tocar la deja idéntica");
  {
    const p = await pagina(browser);
    for (const [id, item] of [["v1", VIEJO], ["v2", SIN_HORA]]) {
      await p.locator(`[data-item="${id}"]`).click();
      await p.waitForSelector("#i_title", { timeout:8000 });
      if (await existe(p, dia("i_start"))) {
        const d = await p.locator(dia("i_start")).inputValue(), h = await hora(p, "i_start").inputValue();
        info(`${item.title}: día ${d} · hora «${h}»`);
        ok(d === item.start.slice(0, 10), `«${item.title}» se abre con su día`, "5");
      }
      await p.locator("#save").click(); await p.waitForTimeout(600);
      const g = (await guardadas(p)).find(i => i.id === id);
      ok(g && g.start === item.start && (g.end || "") === (item.end || ""), `«${item.title}» queda idéntica: ${g && g.start} → ${g && g.end}`, "5");
    }
    await p.close();
  }

  titulo("6 · revisar lo importado: los mismos dos campos");
  {
    const p = await pagina(browser);
    await p.locator("#imp").click();
    await p.waitForSelector("#imp-live", { state:"attached", timeout:10000 });
    await p.waitForTimeout(200);
    if (!(await p.locator(".imp-more").evaluate(e => e.open))) { await p.locator(".imp-more summary").click(); await p.waitForTimeout(150); }
    await p.locator("#im_text").fill("Reserva IB6844 · Madrid a Roma · 25/10/2026 09:00 a 11:30");
    await p.locator("#im-run").click();
    await p.waitForSelector("#im-save", { timeout:15000 });
    const tarjeta = p.locator(".stack [data-card]").first();
    const d = tarjeta.locator('[data-fh="start"] .fh-d');
    const hay = (await d.count()) > 0;
    ok(hay, "la tarjeta tiene día y hora separados", "6");
    if (hay) {
      ok(await d.inputValue() === "2026-10-25", "con el día que trajo la lectura", "6");
      await tarjeta.locator('[data-fh="start"] .fh-t').fill("09:40");
      await d.fill("2026-10-26");
      ok(await tarjeta.locator('[data-fh="end"] .fh-d').inputValue() === "2026-10-26", "mover la salida arrastra la llegada", "6");
      await p.locator("#im-save").click(); await p.waitForTimeout(900);
      const v = (await guardadas(p)).find(i => i.confirmation === "IB6844");
      ok(v && v.start === "2026-10-26T09:40" && v.end === "2026-10-26T11:30", `se guarda lo corregido: ${v && v.start} → ${v && v.end}`, "6");
    }
    await p.close();
  }

  for (const tema of ["claro", "oscuro"]) {
    titulo(`7 · tema ${tema} · a 390 px nada se sale de la pantalla`);
    const p = await pagina(browser, tema);
    await nuevaReserva(p, "flight");
    // Se mide con los campos COMPLETOS: vacío, un campo de fecha y hora es más angosto.
    if (await existe(p, dia("i_start"))) {
      await p.locator(dia("i_start")).fill("2026-10-24"); await hora(p, "i_start").fill("10:00"); await hora(p, "i_end").fill("11:05");
    } else {
      await p.locator("#i_start").fill("2026-10-24T10:00"); await p.locator("#i_end").fill("2026-10-24T11:05");
    }
    /* Contra la COLUMNA de cada campo, no contra la pantalla: en la v42 «Llega»
       medía 250 px en una columna de ~110 y terminaba justo en 390 — tapaba el
       margen y quedaba cortado, sin "pasar" del borde. */
    const anchos = await p.evaluate(() => [...document.querySelectorAll("#fields input:not([type=hidden])")]
      .map(i => { const r = i.getBoundingClientRect(), c = i.closest(".f").getBoundingClientRect();
        return { id:i.id || i.className, der:Math.round(r.right), columna:Math.round(c.right) }; })
      .filter(x => x.der > x.columna + 1 || x.der > window.innerWidth - 8));
    info("se salen: " + JSON.stringify(anchos));
    ok(anchos.length === 0, "ningún campo se sale de su columna ni toca el borde", "7");
    if (await existe(p, dia("i_start"))) {
      await p.locator(dia("i_start")).scrollIntoViewIfNeeded();
      await p.screenshot({ path:path.join(os.tmpdir(), `val95-${tema}.png`) });
      const c = await p.locator(dia("i_start")).evaluate(e => { const s = getComputedStyle(e); return { color:s.color, fondo:s.backgroundColor }; });
      ok(c.color !== c.fondo, `el texto se lee (${c.color} sobre ${c.fondo})`, "7");
    }
    await p.close();
  }

  await browser.close();
  console.log(`\n${total - fallos} de ${total} bien`);
  if (CONTROL) {
    const deben = ["1", "7"];
    const reproduce = deben.every(c => fallaron.has(c));
    console.log(reproduce ? "CONTROL OK: la v42 falla 1 y 7" : "CONTROL FALLÓ: la v42 no falla " + deben.filter(c => !fallaron.has(c)).join(", "));
    process.exit(reproduce ? 0 : 1);
  }
  process.exit(fallos ? 1 : 0);
})();
