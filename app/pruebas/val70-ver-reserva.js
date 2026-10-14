"use strict";
/* ============================================================
   VAL-70 + VAL-100 — Ver una reserva sin entrar a editarla, y que un Guardar
   rechazado no cambie nada. Diseño aprobado por el PM el 14/10
   (docs/design/val70-ver-reserva.png), con tres decisiones: «Eliminar» queda
   adentro de Editar; «abrir» en un pendiente va directo a editar; quien sólo
   mira ve únicamente «Cerrar».

   Todo por gesto (tocar la tarjeta, tocar Editar, Cerrar, Guardar, Cancelar):
     1  Tocar un vuelo abre la VISTA, no el formulario: ruta, ciudades, horas,
        talón, costo y notas.
     2  «Editar» abre el formulario de siempre, con «Eliminar» adentro.
     3  «Cerrar» cierra sin tocar nada.
     4  Los seis tipos de reserva abren su vista sin error, con su «cuándo».
     5  Lo obligatorio que falta dice «pendiente»; lo opcional vacío no aparece.
     6  La tira de documentos aparece en la vista.
     7  «abrir» en un pendiente va directo a editar.
     8  Sólo lectura: la vista no ofrece «Editar».
     9  VAL-100: título borrado + Guardar (rechaza) + Cancelar → la tarjeta y lo
        guardado siguen con el título viejo. Y un cambio válido sí se guarda.
    10  La tarjeta del itinerario sigue mostrando el mismo talón que antes.
    11  Tema claro y oscuro: la vista se lee y nada se sale a 390 px.

   Control negativo: `control` corre la v46 (`git show d844ac7`) y exige que
   fallen 1 y 9.

   Uso: NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/val70-ver-reserva.js [ruta.html | control]
   ============================================================ */
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path"), os = require("os"), { execSync } = require("child_process");

const RAIZ = path.join(__dirname, "..", "..");
const CONTROL = process.argv[2] === "control";
let HTML = path.resolve(process.argv[2] && !CONTROL ? process.argv[2] : path.join(RAIZ, "app", "valija.html"));
if (CONTROL) {
  HTML = path.join(os.tmpdir(), "valija-v46-d844ac7.html");
  fs.writeFileSync(HTML, execSync("git show d844ac7:app/valija.html", { cwd:RAIZ, maxBuffer:64e6 }));
}
let fallos = 0, total = 0; const fallaron = new Set();
const ok = (c, m, caso) => { total++; if (c) console.log("  ok    " + m); else { fallos++; if (caso) fallaron.add(caso); console.log("  FALLA " + m); } };
const info = m => console.log("  info  " + m);
const titulo = t => console.log("\n· " + t);

/* Fixtures escritos leyendo el formulario (sheetItem): cada tipo con sus campos. */
const ITEMS = [
  { id:"f1", type:"flight", title:"Buenos Aires → Madrid", from:"EZE", to:"MAD", start:"2026-11-02T22:10", end:"2026-11-03T14:35",
    provider:"Iberia", flightNumber:"IB 6844", confirmation:"XKD9P2", seat:"23A", terminal:"", gate:"", boardingTime:"",
    cost:"985000", currency:"ARS", notes:"Valija de 23 kg incluida",
    docs:[{ id:"d1", nombre:"pase-de-abordar.pdf", nombreCorto:"pase-de-abordar.pdf", tipo:"application/pdf", bytes:120000, paginas:1, en:"2026-10-14T10:00:00Z" }] },
  { id:"s1", type:"stay", title:"Hotel Ópera", start:"2026-11-03T15:00", end:"2026-11-09T11:00", provider:"Hotel Ópera",
    confirmation:"", address:"Cuesta de Santo Domingo 2, Madrid", phone:"+34 915 41 28 00" },
  { id:"c1", type:"car", title:"Auto en Madrid", start:"2026-11-05T10:00", end:"2026-11-07T10:00", provider:"Hertz", confirmation:"HZ123", address:"Atocha" },
  { id:"t1x", type:"transfer", title:"Traslado al hotel", start:"2026-11-03T15:30", from:"Barajas", to:"Hotel Ópera", provider:"Cabify", confirmation:"" },
  { id:"a1", type:"act", title:"Visita al Prado", start:"2026-11-04T10:00", end:"2026-11-04T13:00", address:"Paseo del Prado", confirmation:"PR-77" },
  { id:"n1", type:"note", title:"Comprar adaptador", start:"", notes:"Tipo F" }
];
const SEMILLA = { trips:[{ id:"t1", name:"Madrid", destination:"Madrid", startDate:"2026-11-02", endDate:"2026-11-09", hue:200 }], items:{ t1:ITEMS }, packing:{} };

async function pagina(browser, { tema = null } = {}) {
  const p = await browser.newPage({ viewport:{ width:390, height:844 }, hasTouch:true });
  await p.route("**/*", r => (/^file:/.test(r.request().url()) ? r.continue() : r.abort()));
  p.on("pageerror", e => { fallos++; fallaron.add("error"); console.log("  !! pageerror: " + e.message); });
  await p.addInitScript(([d, t]) => {
    try { if (!localStorage.getItem("valija.v1")) localStorage.setItem("valija.v1", JSON.stringify(d));
          localStorage.setItem("valija.aviso.local", "1"); if (t) localStorage.setItem("valija.tema", t); } catch (e) {}
    window.claude = { use: async () => null };
  }, [SEMILLA, tema]);
  await p.goto("file://" + HTML + "#/trip/t1");
  await p.waitForFunction(() => typeof Store !== "undefined" && Store.ready, null, { timeout:15000 });
  await p.waitForTimeout(500);
  return p;
}
const abierta = p => p.locator(".sheet").count().then(n => n > 0);
const texto = async p => (await p.locator(".sheet").last().innerText().catch(() => "")).replace(/\s+/g, " ");
async function cerrar(p) { const c = p.locator("#cancel"); if (await c.count()) await c.click(); await p.waitForTimeout(300); }

(async () => {
  const browser = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium" });

  titulo("1, 2, 3 y 6 · un vuelo: la vista, «Editar» y «Cerrar»");
  {
    const p = await pagina(browser);
    await p.locator('[data-item="f1"]').click(); await p.waitForTimeout(400);
    const esForm = await p.locator("#i_title").count();
    const t = await texto(p);
    info(t.slice(0, 230));
    ok(esForm === 0 && await p.locator("#vr").count() === 1, "tocar la tarjeta abre la vista, no el formulario", "1");
    ok(/EZE/.test(t) && /MAD/.test(t) && /Buenos Aires/.test(t) && /Madrid/.test(t), "muestra la ruta con las ciudades", "1");
    ok(/22:10/.test(t) && /14:35/.test(t) && /2 de noviembre/.test(t), "muestra las horas y los días", "1");
    ok(/XKD9P2/.test(t) && /23A/.test(t) && /985000/.test(t) && /Valija de 23 kg/.test(t), "muestra reserva, asiento, costo y notas", "1");
    ok(/IB 6844/.test(t) && /Iberia/.test(t), "muestra la aerolínea y el número de vuelo", "1");
    ok(await p.locator('#vr [data-vrdoc="d1"]').count() === 1, "la tira del documento está en la vista", "6");
    ok(await p.locator("#delitem").count() === 0, "en la vista no está «Eliminar»", "2");
    if (await p.locator("#vr-editar").count()) {
      await p.locator("#vr-editar").click(); await p.waitForTimeout(400);
      ok(await p.locator("#i_title").count() === 1 && await p.locator("#delitem").count() === 1, "«Editar» abre el formulario, con «Eliminar» adentro", "2");
    } else ok(false, "está «Editar» en la vista", "2");
    await cerrar(p);
    await p.locator('[data-item="f1"]').click(); await p.waitForTimeout(300);
    await cerrar(p);
    ok(!(await abierta(p)), "«Cerrar» cierra la vista", "3");
    await p.close();
  }

  titulo("4 y 5 · los seis tipos abren su vista; «pendiente» sólo en lo obligatorio");
  {
    const p = await pagina(browser);
    // Los rótulos se ven en mayúsculas por estilo (text-transform), y innerText lo refleja.
    const esperado = { f1:/Sale/i, s1:/Check-in.*Check-out/i, c1:/Retiro.*Devolución/i, t1x:/Fecha y hora/i, a1:/Cuándo.*Termina/i, n1:/Comprar adaptador/ };
    for (const it of ITEMS) {
      await p.locator(`[data-item="${it.id}"]`).click(); await p.waitForTimeout(300);
      const t = await texto(p);
      ok(await p.locator("#vr").count() === 1 && esperado[it.id].test(t), `${it.type} · «${it.title}»: abre la vista con su «cuándo»`, "4");
      if (it.id === "s1") ok(/Reserva pendiente/i.test(t), "alojamiento sin código: «Reserva pendiente» (es obligatorio)", "5");
      if (it.id === "f1") ok(!/Terminal|Puerta|Embarque/i.test(t), "vuelo: terminal, puerta y embarque vacíos no aparecen (son opcionales)", "5");
      await cerrar(p);
    }
    await p.close();
  }

  titulo("7 · «abrir» en un pendiente va directo a editar");
  {
    const p = await pagina(browser);
    await p.locator('[data-tab="todo"]').click(); await p.waitForTimeout(300);
    const ir = p.locator("[data-goto]").first();
    if (await ir.count()) {
      await ir.click(); await p.waitForTimeout(400);
      ok(await p.locator("#i_title").count() === 1 && await p.locator("#vr").count() === 0, "abre el formulario, no la vista", "7");
    } else ok(false, "hay un pendiente con «abrir»", "7");
    await p.close();
  }

  titulo("8 · sólo lectura: la vista no ofrece «Editar»");
  {
    const p = await pagina(browser);
    // La app decide sólo-lectura con un sondeo de escritura contra la base; acá no hay base,
    // así que se fija el resultado de ese sondeo y se re-dibuja.
    await p.evaluate(() => { Store.canWrite = false; render(); });
    await p.locator('[data-item="f1"]').click(); await p.waitForTimeout(300);
    ok(await p.locator("#vr").count() === 1 && await p.locator("#vr-editar").count() === 0, "se ve la reserva y no está «Editar»", "8");
    await p.close();
  }

  titulo("9 · VAL-100: un Guardar rechazado no cambia nada; uno válido sí guarda");
  {
    const p = await pagina(browser);
    const abrirEditar = async () => {
      await p.locator('[data-item="f1"]').click(); await p.waitForTimeout(300);
      if (await p.locator("#vr-editar").count()) { await p.locator("#vr-editar").click(); await p.waitForTimeout(300); }
    };
    await abrirEditar();
    await p.locator("#i_title").fill("");
    await p.locator("#save").click(); await p.waitForTimeout(300);
    ok(/Poné un título/.test(await p.locator(".toast").last().innerText().catch(() => "")), "Guardar rechaza: «Poné un título»", "9");
    await p.locator("#cancel").click(); await p.waitForTimeout(300);
    const mem = await p.evaluate(() => Store.itemsOf("t1").find(i => i.id === "f1").title);
    const tarjeta = await p.locator('[data-item="f1"]').innerText();
    ok(mem === "Buenos Aires → Madrid", `en memoria sigue el título viejo («${mem}»)`, "9");
    ok(/Buenos Aires → Madrid/.test(tarjeta), "la tarjeta sigue mostrando el título viejo", "9");
    await abrirEditar();
    await p.locator("#i_title").fill("Ida a Madrid");
    await p.locator("#save").click(); await p.waitForTimeout(500);
    const g = await p.evaluate(() => JSON.parse(localStorage.getItem("valija.v1")).items.t1.find(i => i.id === "f1"));
    ok(g && g.title === "Ida a Madrid" && g.docs && g.docs.length === 1, "un cambio válido se guarda, con el documento intacto", "9");
    await p.close();
  }

  titulo("10 · la tarjeta del itinerario muestra el mismo talón que antes");
  {
    const p = await pagina(browser);
    const t = (await p.locator('[data-item="f1"]').locator("xpath=..").innerText()).replace(/\s+/g, " ");
    ok(/VUELO IB 6844/i.test(t) && /EZE → MAD/.test(t) && /XKD9P2/.test(t) && /23A/.test(t), "vuelo, ruta, reserva y asiento en la tarjeta", "10");
    await p.close();
  }

  for (const tema of ["claro", "oscuro"]) {
    titulo(`11 · tema ${tema}`);
    const p = await pagina(browser, { tema });
    await p.locator('[data-item="f1"]').click(); await p.waitForTimeout(400);
    const r = await p.evaluate(() => {
      const els = [...document.querySelectorAll("#vr .cod, #vr .v, #vr .k, #vr .t")];
      const fuera = els.filter(e => e.getBoundingClientRect().right > innerWidth - 4).length;
      const cod = document.querySelector("#vr .cod"), hoja = document.querySelector(".sheet");
      if (!cod || !hoja) return { fuera, color:"(sin vista)", fondo:"(sin vista)" };
      const c = getComputedStyle(cod), f = getComputedStyle(hoja);
      return { fuera, color:c.color, fondo:f.backgroundColor };
    });
    info(JSON.stringify(r));
    ok(r.fuera === 0, "nada se sale a 390 px", "11");
    ok(r.color !== r.fondo, "se lee", "11");
    await p.screenshot({ path:path.join(os.tmpdir(), `val70-${tema}.png`) });
    await p.close();
  }

  await browser.close();
  console.log(`\n${total - fallos} de ${total} bien`);
  if (CONTROL) {
    const deben = ["1", "9"];
    const reproduce = deben.every(c => fallaron.has(c));
    console.log(reproduce ? "CONTROL OK: la v46 falla 1 y 9" : "CONTROL FALLÓ: la v46 no falla " + deben.filter(c => !fallaron.has(c)).join(", "));
    process.exit(reproduce ? 0 : 1);
  }
  process.exit(fallos ? 1 : 0);
})();
