/* VAL-96 — El viaje del 10 al 19 se mostraba del 9 al 18 (reporte del PM sobre v41).
 *
 * Causa: parseDT leía "2026-10-10" con new Date(), que toma una fecha pelada como
 * medianoche UTC. En Argentina (UTC−3) eso es el 9 a las 21:00.
 *
 * EL GESTO: crear el viaje con el formulario y leer lo que dice la pantalla.
 * Corre en dos husos: Argentina (donde fallaba) y Londres (donde ya andaba, y tiene
 * que seguir andando). Además, la cuenta regresiva y la lista "Próximos/Pasados"
 * usan la fecha local, no la UTC.
 *
 * Control negativo: con el argumento `control`, corre el build de `git show 11e2230`
 * y EXIGE que reproduzca el defecto. Si el control pasa limpio, el arnés no mira lo
 * que dice que mira.
 *
 *   NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/val96-fechas-del-viaje.js [ruta.html | control]
 */
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path"), os = require("os"), { execSync } = require("child_process");

const CONTROL = process.argv[2] === "control";
let ruta = process.argv[2] && !CONTROL ? process.argv[2] : path.join(__dirname, "..", "valija.html");
if (CONTROL) {
  ruta = path.join(os.tmpdir(), "valija-11e2230.html");
  fs.writeFileSync(ruta, execSync("git show 11e2230:app/valija.html", { cwd: path.join(__dirname, "..", ".."), maxBuffer: 64e6 }));
}
const APP = "file://" + ruta;

let ok = 0, mal = 0; const fallas = [];
const ver = (cond, txt, id) => { if (cond) { ok++; console.log("  ✓ " + txt); } else { mal++; fallas.push(id); console.log("  ✗ " + txt); } };

(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  for (const tz of ["America/Argentina/Buenos_Aires", "Europe/London", "Asia/Tokyo"]) {
    console.log("\n" + tz);
    const p = await b.newPage({ viewport: { width: 390, height: 844 }, timezoneId: tz });
    await p.route("**/*", r => /^file:/.test(r.request().url()) ? r.continue() : r.abort());
    await p.addInitScript(() => {
      if (!localStorage.getItem("valija.v1")) localStorage.setItem("valija.v1", JSON.stringify({ trips: [], items: {}, packing: {} }));
      window.claude = { use: async () => null };
    });
    await p.goto(APP + "#/");
    await p.waitForFunction(() => typeof Store !== "undefined" && Store.ready);
    await p.waitForTimeout(300);

    await p.locator("text=Nuevo viaje").first().click();
    await p.waitForSelector("#t_from");
    await p.locator("#t_name").fill("Prueba fechas");
    await p.locator("#t_from").fill("2026-10-10");
    await p.locator("#t_to").fill("2026-10-19");
    await p.locator("#save").click();
    await p.waitForTimeout(500);

    const t = await p.evaluate(() => { const t = [...Store.trips.values()][0]; return { a: t.startDate, b: t.endDate }; });
    ver(t.a === "2026-10-10" && t.b === "2026-10-19", `se guarda 2026-10-10 → 2026-10-19 (guardó ${t.a} → ${t.b})`);

    const cuerpo = await p.locator("body").innerText();
    const rango = (cuerpo.match(/\d{2} [a-z]{3} [–-] \d{2} [a-z]{3}( \d{2})?/) || ["?"])[0];
    ver(/^10 oct – 19 oct/.test(rango), `en pantalla dice 10 oct – 19 oct (dice «${rango}»)`, "pantalla@" + tz);

    // Las funciones que leen la fecha, desde la página: día de la semana y noches.
    const f = await p.evaluate(() => ({ largo: fmtDateLong("2026-10-10"), noches: nightsBetween("2026-10-10", "2026-10-19"), hoy: typeof hoyLocal === "function" ? hoyLocal() : null }));
    ver(f.largo === "sáb 10 de octubre", `fecha larga: «sáb 10 de octubre» (dice «${f.largo}»)`);
    ver(f.noches === 9, `9 noches (da ${f.noches})`);
    const hoyEsperado = await p.evaluate(() => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); });
    ver(f.hoy === hoyEsperado, `"hoy" es el día local (${f.hoy} vs ${hoyEsperado})`);
    await p.close();
  }
  await b.close();
  console.log(`\n${ok} bien, ${mal} mal${CONTROL ? "  (control: tiene que haber fallas)" : ""}`);
  if (CONTROL) {
    // El control exige EL SÍNTOMA DEL REPORTE: la pantalla en Argentina. Que falte hoyLocal no cuenta.
    const reproduce = fallas.includes("pantalla@America/Argentina/Buenos_Aires") && !fallas.includes("pantalla@Europe/London");
    console.log(reproduce ? "CONTROL OK: el build viejo muestra el día anterior en Argentina y bien en Londres" : "CONTROL FALLÓ: el build viejo no reproduce el síntoma del reporte");
    process.exit(reproduce ? 0 : 1);
  }
  process.exit(mal ? 1 : 0);
})();
