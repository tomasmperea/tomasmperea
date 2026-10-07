/* ============================================================
   VAL-87 — ESCRIBÍS LA CIUDAD, LA APP PONE EL CÓDIGO

   Los catorce criterios de docs/briefs/ciudad-o-aeropuerto.md, cada uno
   con el GESTO: se toca el campo, se escribe con el teclado
   (`page.keyboard.type`) y se toca la opción (`click`). Ningún valor se
   setea a mano en el campo bajo prueba y ningún evento se dispara a mano.
   Salir del campo es tocar OTRO campo, que es lo que hace la persona.

   LAS DOS PANTALLAS TIENEN SU PROPIA PRUEBA DE CADA COSA. El formulario
   manual y la revisión de lo importado comparten el componente, y
   justamente por eso cada una se prueba por su lado: el 17/09 el PM
   reportó por dos gestos y el arreglo cubrió uno, y lo que fallaba vivía
   ARRIBA del código compartido. Acá, arriba del componente, cada pantalla
   tiene su propia lectura de lo guardado (`collect` y
   `syncReviewInputsToState`) y su propio guardado (`Store.saveItem` y
   `doSaveReview`, que pasaba todo a mayúsculas).

   LOS FIXTURES SE ESCRIBIERON LEYENDO EL FORMULARIO. Un vuelo tiene
   título, origen, destino, sale y llega (las dos `datetime-local`),
   aerolínea, nº de vuelo y código de reserva. "Llega" es opcional: hay
   vuelos con y sin. Y `to` viene de las cuatro formas del brief: código
   del dato (BRC, MAD), código fuera del dato (TOJ), texto (Villa La
   Angostura, SUECIA) y vacío.

   ------------------------------------------------------------
   LO QUE ESTE ARNÉS NO PRUEBA — dicho de frente
   ------------------------------------------------------------
   · Chromium de escritorio a 390 px sobre `file://` no es el teléfono. No
     hay teclado en pantalla: si la lista queda tapada por el teclado, si el
     scroll la alcanza y si el corrector automático cambia lo escrito, sólo
     lo contesta el teléfono del PM. Ver CLAUDE.md, "La palabra verificado".
   · `claude` es falso: el modelo lo simula este archivo, devolviendo los
     vuelos que cada caso necesita.
   · Las fuentes no cargan (la red está cortada a propósito): los anchos
     son con la tipografía de reserva.

   Los controles negativos están en `val87-controles.js`, que corre este
   mismo arnés contra copias saboteadas del HTML.

       NODE_PATH=/opt/node22/lib/node_modules \
         node app/pruebas/val87-ciudad-o-aeropuerto.js [ruta/al/valija.html]
   ============================================================ */
"use strict";

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const HTML = process.argv[2] ? path.resolve(process.argv[2])
                             : path.resolve(__dirname, "..", "valija.html");
const APP = "file://" + HTML;

let fallos = 0, pasaron = 0;
const ok = (c, m) => { if (c) { pasaron++; console.log("  ok     " + m); }
                       else { fallos++; console.log("  FALLA  " + m); } };
const info = m => console.log("  info   " + m);
/* VAL87_SOLO=<regex> corre sólo los bloques cuyo nombre coincide. Lo usa
   `val87-controles.js` para no correr todo contra cada sabotaje; corrido a
   mano y sin la variable, corre todo. */
const SOLO = process.env.VAL87_SOLO ? new RegExp(process.env.VAL87_SOLO) : null;
async function bloque(nombre, fn) {
  if (SOLO && !SOLO.test(nombre)) return;
  console.log("\n· " + nombre);
  try { await fn(); }
  catch (e) { fallos++; console.log("  FALLA (excepción) " + (e && e.message)); console.log(e && e.stack); }
}

/* ---------- los fixtures ---------- */
const vuelo = (id, from, to, extra) => Object.assign({
  id, type:"flight", title:"Vuelo", from, to,
  start:"2027-07-14T08:40", end:"2027-07-14T11:05",
  provider:"Aerolíneas Argentinas", flightNumber:"AR 1672", confirmation:"XKD9P2"
}, extra || {});

const VIAJE = (id, nombre, destino) => ({ id, name:nombre, destination:destino,
  startDate:"2027-07-14", endDate:"2027-07-21", hue:214, travelers:"Tomás" });

const SEMILLA = {
  trips: [
    VIAJE("tv", "Vacío", "Bariloche"),
    VIAJE("tbrc", "Invierno en el sur", "Bariloche"),
    VIAJE("ttoj", "Japón", "Japón"),
    VIAJE("tvla", "Angostura", "Villa La Angostura"),
    VIAJE("tsue", "Escandinavia", "Suecia"),
    VIAJE("tmad", "Madrid", "Madrid"),
    VIAJE("tsin", "Sin vuelos", "Bariloche")
  ],
  items: {
    tv: [],
    // código del dato, con "llega"
    tbrc: [vuelo("f-brc", "EZE", "BRC")],
    // código fuera del dato, SIN "llega"
    ttoj: [vuelo("f-toj", "NRT", "TOJ", { end:"" })],
    // texto, de los que el campo nuevo guarda tal cual
    tvla: [vuelo("f-vla", "EZE", "Villa La Angostura")],
    // texto en mayúsculas, de antes de VAL-80
    tsue: [vuelo("f-sue", "EZE", "SUECIA", { end:"" })],
    tmad: [vuelo("f-mad", "EZE", "MAD")],
    // vacío: un vuelo sin destino no tiene ruta, así que la etiqueta no lo usa
    tsin: [vuelo("f-vac", "EZE", "")]
  }
};

/* Lo que el modelo devuelve al importar, por caso. Mismo contrato que el
   simulador de `val80-el-codigo-del-vuelo.js`: `sample.json` + `limits`. */
const vueloImportado = (to, extra) => Object.assign({
  type:"flight", title:"Vuelo importado", start:"2027-07-14T08:40", end:"2027-07-14T11:05",
  from:"EZE", to, provider:"Aerolíneas Argentinas", flightNumber:"AR 1672",
  confirmation:"VAL87X", seat:"", terminal:"", gate:"", boardingTime:"",
  address:"", phone:"", cost:"", currency:"", notes:""
}, extra || {});

function simulador(vuelos) {
  window.__VUELOS__ = vuelos || [];
  const sample = {
    limits: async () => ({ maxPromptBytes: 200000 }),
    json: async (prompt) => {
      const p = String(prompt);
      if (/valija|equipaje|empacar/i.test(p)) return { items: [], quitar: [] };
      if (p.indexOf("VAL87") < 0) return { items: [] };
      return { items: window.__VUELOS__ };
    }
  };
  window.claude = { use: async k => (k === "sample" ? sample : null) };
}

async function nuevaPagina(browser, opts) {
  opts = opts || {};
  /* isMobile:false a propósito: la app no trae meta viewport (la pone el
     visor del Artifact), y con isMobile:true Chromium la maqueta a 980 px y
     la achica. Así el ancho de maqueta es de verdad 390 px. */
  const page = await browser.newPage({ viewport:{ width:390, height:844 }, hasTouch:true,
                                       colorScheme: opts.esquema || "light" });
  await page.route("**/*", r => (/^file:/.test(r.request().url()) ? r.continue() : r.abort()));
  page.on("pageerror", e => { console.log("  !! pageerror: " + e.message); fallos++; });
  await page.addInitScript(simulador, opts.vuelos || []);
  await page.addInitScript(([datos, tema]) => {
    try {
      if (!localStorage.getItem("valija.v1")) localStorage.setItem("valija.v1", JSON.stringify(datos));
      if (tema) localStorage.setItem("valija.tema", tema);
    } catch (e) {}
  }, [opts.semilla || SEMILLA, opts.tema || null]);
  return page;
}
async function ir(page, hash) {
  await page.goto(APP + hash);
  await page.waitForFunction(() => typeof Store !== "undefined" && Store.ready, null, { timeout:15000 });
  await page.waitForTimeout(300);
}
const reservasDe = (page, id) => page.evaluate(i => Store.itemsOf(i), id);

/** EL GESTO de escribir: tocar el campo y teclear. */
async function escribir(page, campo, texto) {
  await campo.click();
  await page.keyboard.type(texto, { delay:12 });
  await page.waitForTimeout(120);
}
/** Borrar lo que tiene el campo, con el teclado. */
async function vaciar(page, campo) {
  await campo.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  await page.waitForTimeout(80);
}
/** Lo que el campo muestra, su sello y su línea de "no está en mi lista". */
async function estadoDelCampo(campoWrap) {
  return {
    visible: await campoWrap.locator("input").inputValue(),
    sello: (await campoWrap.locator(".ap-sello").allInnerTexts()).join("|"),
    linea: (await campoWrap.locator(".ap-hint").allInnerTexts()).join("|"),
    lista: await campoWrap.locator(".ap-lista").count()
  };
}
/** Las opciones de la lista abierta: [{cod, ciudad, segunda}]. */
async function opciones(campoWrap) {
  return campoWrap.locator(".ap-op").evaluateAll(bs => bs.map(b => ({
    cod: b.querySelector(".cod").textContent.trim(),
    ciudad: b.querySelector(".ci").textContent.trim(),
    segunda: b.querySelector(".ae").textContent.trim()
  })));
}

/* ---------- las dos pantallas ---------- */
const MANUAL = {
  nombre: "formulario manual",
  async abrir(page) {
    await ir(page, "#/trip/tv");
    await page.locator("#additem").click();
    await page.waitForSelector("#i_to", { timeout:10000 });
    await escribir(page, page.locator("#i_title"), "Vuelo a probar");
  },
  origen: page => page.locator("#fields .ap").filter({ has: page.locator("#i_from") }),
  destino: page => page.locator("#fields .ap").filter({ has: page.locator("#i_to") }),
  /** salir del campo: tocar otro */
  salir: page => page.locator("#i_title").click(),
  aviso: page => page.locator("#i_ruta_aviso").innerText().catch(() => ""),
  async guardar(page) {
    await page.locator("#save").click();
    await page.waitForFunction(() => !document.querySelector("#i_title"), null, { timeout:8000 });
    await page.waitForTimeout(300);
    return (await reservasDe(page, "tv")).find(i => i.type === "flight");
  }
};
const REVISION = {
  nombre: "revisión de lo importado",
  async abrir(page) {
    await ir(page, "#/trip/tv");
    await page.locator("#imp").click();
    await page.waitForSelector("#imp-live", { state:"attached", timeout:10000 });
    await page.waitForTimeout(200);
    const abierta = await page.locator(".imp-more").evaluate(e => e.open);
    if (!abierta) { await page.locator(".imp-more summary").click(); await page.waitForTimeout(150); }
    await page.locator("#im_text").fill("Reserva VAL87\nVuelo EZE\nSale 14/07/2027 08:40");
    await page.locator("#im-run").click();
    await page.waitForSelector("#im-save", { timeout:15000 });
    await page.waitForTimeout(200);
  },
  tarjeta: (page, n) => page.locator(".stack .imp-card").nth(n || 0),
  origen: (page, n) => REVISION.tarjeta(page, n).locator(".ap").filter({ has: page.locator('[data-f="from"]') }),
  destino: (page, n) => REVISION.tarjeta(page, n).locator(".ap").filter({ has: page.locator('[data-f="to"]') }),
  salir: (page, n) => REVISION.tarjeta(page, n).locator(".imp-title").click(),
  aviso: (page, n) => REVISION.tarjeta(page, n).locator("[data-rutaaviso]").innerText().catch(() => ""),
  async guardar(page) {
    await page.locator("#im-save").click();
    await page.waitForFunction(() => Store.itemsOf("tv").some(i => i.type === "flight"), null, { timeout:8000 });
    await page.waitForTimeout(300);
    return (await reservasDe(page, "tv")).find(i => i.type === "flight");
  }
};

const AVISO_VIEJO = /no s[eé] traducir/i;

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
    console.log("HTML bajo prueba: " + HTML);

    /* ═════════ 1 · el formulario manual: bari → Bariloche → BRC ═════════ */
    await bloque("CRITERIO 1 · formulario manual: escribir «bari», tocar Bariloche, guardar", async () => {
      const page = await nuevaPagina(browser);
      await MANUAL.abrir(page);
      await escribir(page, page.locator("#i_from"), "aeroparque");
      await MANUAL.origen(page).locator('.ap-op[data-cod="AEP"]').click();
      await escribir(page, page.locator("#i_to"), "bari");
      const ops = await opciones(MANUAL.destino(page));
      info("opciones: " + ops.map(o => o.cod + " " + o.ciudad).join(" · "));
      ok(ops.some(o => o.cod === "BRC" && o.ciudad === "Bariloche"), "Bariloche (BRC) está entre las opciones");
      ok(ops.length <= 5, `hasta cinco opciones (${ops.length})`);
      await MANUAL.destino(page).locator(".ap-op", { hasText:"Bariloche" }).click();
      await page.waitForTimeout(150);
      const e = await estadoDelCampo(MANUAL.destino(page));
      info("después de tocarla: " + JSON.stringify(e));
      ok(e.visible === "Bariloche", "el campo dice «Bariloche»");
      ok(e.sello === "BRC", "con el sello BRC");
      ok(e.lista === 0, "y la lista se cerró");
      ok((await MANUAL.aviso(page)).trim() === "", "sin aviso: no hay nada que avisar");
      await page.locator("#i_start").fill("2027-07-14T08:40");
      await page.locator("#i_end").fill("2027-07-14T11:05");
      const v = await MANUAL.guardar(page);
      ok(v && v.to === "BRC", `se guardó to: ${JSON.stringify(v && v.to)}`);
      ok(v && v.from === "AEP", `y from: ${JSON.stringify(v && v.from)}`);
      ok(/Reserva guardada/.test(await page.locator("#toast").innerText()), "y el cartel es el de siempre");
      await page.close();
    });

    /* ═════════ 2 · lo mismo en la revisión de lo importado ═════════ */
    await bloque("CRITERIO 2 · revisión de lo importado: escribir «bari», tocar Bariloche, guardar", async () => {
      const page = await nuevaPagina(browser, { vuelos:[vueloImportado("")] });
      await REVISION.abrir(page);
      const campo = REVISION.destino(page);
      await escribir(page, campo.locator("input"), "bari");
      const ops = await opciones(campo);
      ok(ops.some(o => o.cod === "BRC" && o.ciudad === "Bariloche"), "Bariloche (BRC) está entre las opciones");
      await campo.locator(".ap-op", { hasText:"Bariloche" }).click();
      await page.waitForTimeout(150);
      const e = await estadoDelCampo(campo);
      info("después de tocarla: " + JSON.stringify(e));
      ok(e.visible === "Bariloche" && e.sello === "BRC", "el campo dice «Bariloche» con el sello BRC");
      ok((await REVISION.aviso(page)).trim() === "", "sin aviso");
      const v = await REVISION.guardar(page);
      ok(v && v.to === "BRC", `se guardó to: ${JSON.stringify(v && v.to)}`);
      ok(v && v.from === "EZE", `y el origen que trajo el modelo sigue: ${JSON.stringify(v && v.from)}`);
      await page.close();
    });

    /* ═════════ 3 y 4 · lo que encuentra ═════════ */
    for (const P of [MANUAL, REVISION]) {
      await bloque(`CRITERIOS 3 y 4 · ${P.nombre}: buenos aires, ezeiza, aeroparque, pistarini, cordoba, Córdoba`, async () => {
        const page = await nuevaPagina(browser, { vuelos:[vueloImportado("")] });
        await P.abrir(page);
        const campo = P.destino(page), inp = campo.locator("input");
        const buscar = async t => { await vaciar(page, inp); await page.keyboard.type(t, { delay:12 }); await page.waitForTimeout(120); return opciones(campo); };

        const ba = await buscar("buenos aires");
        info("buenos aires → " + ba.map(o => `${o.cod} «${o.segunda}»`).join(" · "));
        ok(ba.some(o => o.cod === "EZE" && /Ezeiza - Ministro Pistarini/.test(o.segunda)), "EZE «Ezeiza - Ministro Pistarini»");
        ok(ba.some(o => o.cod === "AEP" && /Aeroparque Jorge Newbery/.test(o.segunda)), "AEP «Aeroparque Jorge Newbery»");
        ok((await buscar("ezeiza")).some(o => o.cod === "EZE"), "«ezeiza» encuentra EZE");
        ok((await buscar("aeroparque")).some(o => o.cod === "AEP"), "«aeroparque» encuentra AEP");
        ok((await buscar("pistarini")).some(o => o.cod === "EZE"), "«pistarini» encuentra EZE");

        const sin = (await buscar("cordoba")).map(o => o.cod).join(",");
        const con = (await buscar("Córdoba")).map(o => o.cod).join(",");
        info(`cordoba → ${sin} · Córdoba → ${con}`);
        ok(sin.length > 0 && sin === con, "«cordoba» y «Córdoba» devuelven lo mismo");
        ok(/COR/.test(con), "y Córdoba de Argentina está");
        const marca = await campo.locator(".ap-op .ci mark").first().innerText();
        ok(marca === "Córd" || marca === "Córdoba", `lo que coincide va marcado con su tilde («${marca}»)`);

        await vaciar(page, inp); await page.keyboard.type("b"); await page.waitForTimeout(100);
        ok(await campo.locator(".ap-lista").count() === 0, "con una letra todavía no hay lista");
        await page.keyboard.type("a"); await page.waitForTimeout(100);
        ok(await campo.locator(".ap-lista").count() === 1, "con dos, aparece");
        await page.close();
      });
    }

    /* ═════════ 5 · al salir del campo sin tocar ninguna: las cuatro filas ═════════ */
    const FILAS = [
      { escrito:"eze", guarda:"EZE", visible:"Buenos Aires", sello:"EZE", linea:"", aviso:false,
        fila:"tres letras de un código del dato" },
      { escrito:"toj", guarda:"TOJ", visible:"TOJ", sello:"TOJ",
        linea:"TOJ no está en mi lista de aeropuertos. Lo guardo como código igual.", aviso:false,
        fila:"tres letras que el dato no tiene" },
      { escrito:"Villa La Angostura", guarda:"Villa La Angostura", visible:"Villa La Angostura", sello:"", linea:"", aviso:true,
        fila:"cualquier otra cosa" },
      { escrito:"", guarda:"", visible:"", sello:"", linea:"", aviso:false,
        fila:"nada" }
    ];
    for (const P of [MANUAL, REVISION]) {
      for (const F of FILAS) {
        await bloque(`CRITERIO 5 · ${P.nombre} · fila «${F.fila}»: escribir ${JSON.stringify(F.escrito)} y salir`, async () => {
          const page = await nuevaPagina(browser, { vuelos:[vueloImportado("")] });
          await P.abrir(page);
          const campo = P.destino(page);
          if (F.escrito) await escribir(page, campo.locator("input"), F.escrito);
          else await campo.locator("input").click();
          await P.salir(page);
          await page.waitForTimeout(200);
          const e = await estadoDelCampo(campo);
          const aviso = await P.aviso(page);
          info(JSON.stringify(e) + " · aviso: " + JSON.stringify(aviso.slice(0, 70)));
          ok(e.visible === F.visible, `se ve ${JSON.stringify(F.visible)}`);
          ok(e.sello === F.sello, F.sello ? `con el sello ${F.sello}` : "sin sello");
          ok(e.linea === F.linea, F.linea ? "con la línea «no está en mi lista»" : "sin la línea de código fuera de la lista");
          ok(e.lista === 0, "la lista se cerró");
          if (F.aviso) {
            ok(aviso.indexOf(F.escrito) >= 0, "el aviso de VAL-80 nombra lo escrito");
            ok(/no es un aeropuerto de mi lista/.test(aviso) && /pista/.test(aviso) && /eleg[ií] una de las opciones/.test(aviso),
               "y dice qué pasó, qué se hace con eso y qué hacer");
          } else {
            ok(aviso.trim() === "", "sin aviso de VAL-80");
          }
          const v = await P.guardar(page);
          ok(v && v.to === F.guarda, `se guardó to: ${JSON.stringify(v && v.to)} (esperado ${JSON.stringify(F.guarda)})`);
          await page.close();
        });
      }
    }

    /* ═════════ 6 · elegir y después editar ═════════ */
    for (const P of [MANUAL, REVISION]) {
      await bloque(`CRITERIO 6 · ${P.nombre}: elegir Bariloche y después borrarle una letra`, async () => {
        const page = await nuevaPagina(browser, { vuelos:[vueloImportado("")] });
        await P.abrir(page);
        const campo = P.destino(page), inp = campo.locator("input");
        await escribir(page, inp, "bari");
        await campo.locator('.ap-op[data-cod="BRC"]').click();
        await page.waitForTimeout(120);
        ok((await estadoDelCampo(campo)).sello === "BRC", "elegido: sello BRC");
        await P.salir(page);
        await inp.click();
        await page.keyboard.press("End");
        /* VAL-92 (07/10): salir con UNA sola opción la toma, y «Bariloch» tiene una
           (BRC): volvería a Bariloche. Lo que este criterio protege es que editar
           borra la elección; borrando hasta «Bari» quedan cinco opciones. */
        for (let k = 0; k < 5; k++) await page.keyboard.press("Backspace");
        await page.waitForTimeout(150);
        let e = await estadoDelCampo(campo);
        info("editando: " + JSON.stringify(e));
        ok(e.visible === "Bari", "el campo dice «Bari»");
        ok(e.sello === "", "y el sello se fue en la primera tecla");
        await P.salir(page);
        await page.waitForTimeout(200);
        e = await estadoDelCampo(campo);
        ok(e.sello === "", "al salir no vuelve: «Bari» no es un código");
        ok(/Bari/.test(await P.aviso(page)), "y aparece el aviso, como cualquier texto");
        const v = await P.guardar(page);
        ok(v && v.to !== "BRC", `lo guardado dejó de ser BRC: ${JSON.stringify(v && v.to)}`);
        ok(v && v.to === "Bari", "es lo que quedó escrito");
        await page.close();
      });
    }

    /* ═════════ 7 · una reserva que ya existe ═════════ */
    await bloque("CRITERIO 7 · abrir reservas guardadas: MAD, SUECIA, TOJ, Villa La Angostura, vacío", async () => {
      const page = await nuevaPagina(browser);
      const abrir = async (viaje, id) => {
        await ir(page, "#/trip/" + viaje);
        await page.locator(`[data-item="${id}"]`).click();
        await page.waitForSelector("#i_to", { timeout:10000 });
        await page.waitForTimeout(150);
        return { campo: await estadoDelCampo(MANUAL.destino(page)), aviso: await MANUAL.aviso(page) };
      };
      let r = await abrir("tmad", "f-mad");
      info("MAD: " + JSON.stringify(r));
      ok(r.campo.visible === "Madrid" && r.campo.sello === "MAD", "to:\"MAD\" abre con Madrid y el sello MAD");
      ok(r.aviso.trim() === "", "sin aviso");
      ok(r.campo.lista === 0, "y sin lista abierta");
      await page.locator("#cancel").click();

      r = await abrir("tsue", "f-sue");
      info("SUECIA: " + JSON.stringify(r));
      ok(r.campo.visible === "SUECIA" && r.campo.sello === "", "to:\"SUECIA\" abre con SUECIA y sin sello");
      ok(/SUECIA/.test(r.aviso) && /no es un aeropuerto de mi lista/.test(r.aviso), "y con el aviso, de entrada");
      ok(!AVISO_VIEJO.test(r.aviso), "que ya no dice que la app no sabe traducir");
      /* "Se corrige buscando y eligiendo." */
      await vaciar(page, page.locator("#i_to"));
      await page.keyboard.type("estocolmo", { delay:12 });
      await page.waitForTimeout(120);
      await MANUAL.destino(page).locator('.ap-op[data-cod="ARN"]').click();
      await page.waitForTimeout(120);
      ok((await MANUAL.aviso(page)).trim() === "", "elegida Estocolmo, el aviso se va");
      await page.locator("#save").click();
      await page.waitForTimeout(500);
      const sue = (await reservasDe(page, "tsue")).find(i => i.id === "f-sue");
      ok(sue && sue.to === "ARN", `y la reserva queda con to: ${JSON.stringify(sue && sue.to)}`);
      ok(sue && sue.end === "", "sin inventarle la hora de llegada que no tenía");

      r = await abrir("ttoj", "f-toj");
      info("TOJ: " + JSON.stringify(r));
      ok(r.campo.visible === "TOJ" && r.campo.sello === "TOJ" && /no está en mi lista/.test(r.campo.linea),
         "to:\"TOJ\" abre con el código, el sello y la línea");
      ok(r.aviso.trim() === "", "sin el aviso de VAL-80: TOJ es un código");
      await page.locator("#cancel").click();

      r = await abrir("tvla", "f-vla");
      ok(r.campo.visible === "Villa La Angostura" && r.campo.sello === "" && /Villa La Angostura/.test(r.aviso),
         "to:\"Villa La Angostura\" abre con el texto y el aviso");
      await page.locator("#cancel").click();

      r = await abrir("tsin", "f-vac");
      ok(r.campo.visible === "" && r.campo.sello === "" && r.aviso.trim() === "", "to:\"\" abre vacío y sin aviso");
      await page.locator("#cancel").click();
      await page.close();
    });

    /* ═════════ 8 · lo que trajo el modelo ═════════ */
    await bloque("CRITERIO 8 · revisión: el modelo devolvió MAD, SUECIA y TOJ", async () => {
      const page = await nuevaPagina(browser, { vuelos:[
        vueloImportado("MAD"), vueloImportado("SUECIA", { title:"Otro", end:"" }), vueloImportado("TOJ", { title:"Otro más" })
      ] });
      await REVISION.abrir(page);
      const mad = await estadoDelCampo(REVISION.destino(page, 0));
      info("MAD: " + JSON.stringify(mad));
      ok(mad.visible === "Madrid" && mad.sello === "MAD", "MAD se ve como Madrid con el sello");
      ok((await REVISION.aviso(page, 0)).trim() === "", "sin aviso");
      const orig = await estadoDelCampo(REVISION.origen(page, 0));
      ok(orig.visible === "Buenos Aires" && orig.sello === "EZE", "y el origen EZE como Buenos Aires");
      const sue = await estadoDelCampo(REVISION.destino(page, 1));
      ok(sue.visible === "SUECIA" && sue.sello === "" && /SUECIA/.test(await REVISION.aviso(page, 1)),
         "SUECIA se ve como texto, con el aviso");
      const toj = await estadoDelCampo(REVISION.destino(page, 2));
      ok(toj.visible === "TOJ" && toj.sello === "TOJ" && /no está en mi lista/.test(toj.linea), "TOJ, con su sello y la línea");
      // Se guarda sin tocar nada: lo que el modelo trajo tiene que quedar igual.
      await page.locator("#im-save").click();
      await page.waitForFunction(() => Store.itemsOf("tv").length === 3, null, { timeout:8000 });
      const tos = (await reservasDe(page, "tv")).map(i => i.to).sort();
      info("guardado: " + JSON.stringify(tos));
      ok(JSON.stringify(tos) === JSON.stringify(["MAD", "SUECIA", "TOJ"]), "guardar sin tocar deja los tres como estaban");
      await page.close();
    });

    /* ═════════ 9 · la etiqueta del viaje ═════════ */
    await bloque("CRITERIO 9 · la etiqueta del viaje: la ciudad debajo de cada código", async () => {
      const page = await nuevaPagina(browser);
      await ir(page, "#/");
      const etiqueta = async id => {
        const card = page.locator(`.tag-card[data-trip="${id}"]`);
        return {
          codigos: (await card.locator(".route .code").allInnerTexts()).join(" "),
          ciudades: await card.locator(".route-ci span").allInnerTexts(),
          hay: await card.locator(".route-ci").count()
        };
      };
      let e = await etiqueta("tbrc");
      info("EZE → BRC: " + JSON.stringify(e));
      ok(e.codigos === "EZE BRC" && JSON.stringify(e.ciudades) === JSON.stringify(["Buenos Aires", "Bariloche"]),
         "EZE → BRC dice Buenos Aires y Bariloche");
      e = await etiqueta("ttoj");
      info("NRT → TOJ: " + JSON.stringify(e));
      ok(e.codigos === "NRT TOJ" && e.ciudades[0] === "Tokio" && e.ciudades[1] === "",
         "NRT → TOJ: Tokio, y TOJ sin ciudad (el dato no lo tiene)");
      e = await etiqueta("tvla");
      info("EZE → Villa La Angostura: " + JSON.stringify(e));
      ok(e.codigos === "EZE VIL", "un texto se sigue recortando a tres letras, como antes");
      ok(e.ciudades[1] === "", "y no se le inventa ciudad: VIL es Dakhla en el dato y no aparece");
      ok(!/Dakhla/.test(await page.locator(`.tag-card[data-trip="tvla"]`).innerText()), "(Dakhla no figura en la etiqueta)");
      e = await etiqueta("tsue");
      ok(e.codigos === "EZE SUE" && e.ciudades[1] === "", "SUECIA tampoco inventa ciudad");
      e = await etiqueta("tsin");
      ok(e.hay === 0, "un viaje sin vuelo con ruta no agrega el renglón");
      await page.close();
    });

    /* ═════════ 10 · uno debajo del otro ═════════ */
    for (const P of [MANUAL, REVISION]) {
      await bloque(`CRITERIO 10 · ${P.nombre}: origen y destino uno debajo del otro`, async () => {
        const page = await nuevaPagina(browser, { vuelos:[vueloImportado("MAD")] });
        await P.abrir(page);
        const a = await P.origen(page).boundingBox(), b = await P.destino(page).boundingBox();
        info(`origen ${JSON.stringify(a)} · destino ${JSON.stringify(b)}`);
        ok(a && b && b.y >= a.y + a.height, "el destino empieza debajo del origen");
        ok(a && b && Math.abs(a.x - b.x) < 1 && Math.abs(a.width - b.width) < 1, "con el mismo ancho, alineados");
        const fuente = await P.destino(page).locator("input").evaluate(e => getComputedStyle(e).fontFamily + "|" + getComputedStyle(e).textTransform);
        ok(/Public Sans/.test(fuente) && !/DM Mono/.test(fuente) && /\|none$/.test(fuente), `Public Sans y sin mayúsculas forzadas (${fuente})`);
        const rot = await P.destino(page).locator("label").innerText();
        ok(/^destino$/i.test(rot.replace(/[\s·]/g, "")), `el rótulo dice «Destino», sin IATA (${JSON.stringify(rot)})`);
        ok(await P.destino(page).locator("input").getAttribute("placeholder") === "Ciudad o aeropuerto", "placeholder «Ciudad o aeropuerto»");
        await page.close();
      });
    }

    /* ═════════ 11, 12 y 13 ═════════ */
    await bloque("CRITERIO 11 · «Acerca de» lleva la fuente", async () => {
      const page = await nuevaPagina(browser);
      await ir(page, "#/");
      await page.locator("#about").click();
      await page.waitForTimeout(200);
      ok(/Datos de aeropuertos: OurAirports y OpenFlights \(ODbL\)\./.test(await page.locator("#modal").innerText()),
         "la línea está, tal cual el brief");
      await page.close();
    });

    await bloque("CRITERIO 12 · el aviso de VAL-80 ya no dice que la app no sabe traducir", async () => {
      /* Se lee en PANTALLA, por las dos, más el cartel al guardar. No sobre
         el código fuente: el comentario de `avisoRutaHtml` cita el texto viejo
         para explicar por qué cambió, y eso no lo lee nadie más que nosotros. */
      const page = await nuevaPagina(browser, { vuelos:[vueloImportado("SUECIA")] });
      await ir(page, "#/trip/tsue");
      await page.locator('[data-item="f-sue"]').click();
      await page.waitForSelector("#i_to", { timeout:10000 });
      const manual = await MANUAL.aviso(page);
      ok(/SUECIA/.test(manual), "formulario manual: el aviso está");
      ok(!/traduc/i.test(manual), "y no dice nada de traducir");
      await page.locator("#save").click();
      await page.waitForTimeout(400);
      const cartel = await page.locator("#toast").innerText();
      info("cartel: " + JSON.stringify(cartel));
      ok(/SUECIA/.test(cartel) && !/traduc/i.test(cartel), "el cartel al guardar tampoco");
      await REVISION.abrir(page);
      const rev = await REVISION.aviso(page);
      ok(/SUECIA/.test(rev), "revisión de lo importado: el aviso está");
      ok(!/traduc/i.test(rev), "y no dice nada de traducir");
      ok(rev === manual, "y es el mismo texto en las dos pantallas");
      await page.close();
    });

    await bloque("CRITERIO 13 · sin conexión: el dato va adentro y no se pide por red", async () => {
      const src = fs.readFileSync(HTML, "utf8");
      ok(!/\bfetch\s*\(/.test(src), "el HTML no tiene ningún fetch");
      ok(src.indexOf("var AEROPUERTOS_DATO = \"ATL|Atlanta") > 0, "el dato está escrito adentro del HTML");
      const page = await nuevaPagina(browser);
      const pedidos = [];
      page.on("request", r => { if (!/^file:/.test(r.url())) pedidos.push(r.url()); });
      await MANUAL.abrir(page);
      const antes = pedidos.length;
      await escribir(page, page.locator("#i_to"), "bari");
      ok(await MANUAL.destino(page).locator(".ap-op").count() > 0, "con toda la red cortada, la lista aparece");
      ok(pedidos.length === antes, `y escribir no pidió nada a la red (${pedidos.length - antes} pedidos)`);
      ok(await page.evaluate(() => Aeropuertos.total) === 4008, "son los 4.008 aeropuertos del dato");
      await page.close();
    });

    /* ═════════ 14 · temas, foco y área táctil ═════════ */
    const TEMAS = [
      { nombre:"claro (automático, sistema claro)", esquema:"light", tema:null, oscuro:false },
      { nombre:"oscuro (automático, sistema oscuro)", esquema:"dark", tema:null, oscuro:true },
      { nombre:"oscuro elegido, con el sistema claro", esquema:"light", tema:"oscuro", oscuro:true },
      { nombre:"claro elegido, con el sistema oscuro", esquema:"dark", tema:"claro", oscuro:false }
    ];
    const tokensDe = {};
    for (const T of TEMAS) {
      for (const P of [MANUAL, REVISION]) {
        await bloque(`CRITERIO 14 · ${P.nombre} · tema ${T.nombre}, 390 px`, async () => {
          const page = await nuevaPagina(browser, { esquema:T.esquema, tema:T.tema, vuelos:[vueloImportado("")] });
          await P.abrir(page);
          const campo = P.destino(page);
          await escribir(page, campo.locator("input"), "lon");
          const ops = campo.locator(".ap-op");
          const n = await ops.count();
          ok(n === 5, `cinco opciones para «lon» (${n})`);
          const cajas = await ops.evaluateAll(bs => bs.map(b => { const r = b.getBoundingClientRect(); return { h:r.height, w:r.width, x:r.x, d:r.right }; }));
          ok(cajas.every(c => c.h >= 44), `cada opción mide 44 px o más de alto (${cajas.map(c => Math.round(c.h)).join(", ")})`);
          ok(cajas.every(c => c.x >= 0 && c.d <= 390), "y entra en los 390 px");
          const desborde = await ops.evaluateAll(bs => bs.filter(b => b.scrollWidth > b.clientWidth + 1).length);
          ok(desborde === 0, "ningún renglón se sale de su opción");

          // Los colores son los tokens del tema vigente, no literales.
          const c = await page.evaluate(() => {
            const prueba = document.createElement("i");
            document.body.appendChild(prueba);
            const tok = v => { prueba.style.color = `var(${v})`; return getComputedStyle(prueba).color; };
            const t = { accent:tok("--accent"), soft:tok("--accent-soft"), ink:tok("--ink"), surface:tok("--surface") };
            prueba.remove();
            const mark = document.querySelector(".ap-op .ci mark");
            const op = document.querySelector(".ap-op");
            const lista = document.querySelector(".ap-lista");
            return { t, mark: mark && getComputedStyle(mark).color, op: getComputedStyle(op).color,
                     lista: getComputedStyle(lista).backgroundColor };
          });
          ok(c.mark === c.t.accent, `lo que coincide va en --accent (${c.mark})`);
          ok(c.op === c.t.ink, "el texto de la opción es --ink");
          ok(c.lista === c.t.surface, "el fondo de la lista es --surface");
          tokensDe[T.nombre + P.nombre] = c.t;
          const oscuro = await page.evaluate(() => {
            const m = getComputedStyle(document.body).backgroundColor.match(/\d+/g).map(Number);
            return (m[0] + m[1] + m[2]) / 3 < 100;
          });
          ok(oscuro === T.oscuro, `el tema que se pidió es el que se ve (${oscuro ? "oscuro" : "claro"})`);

          // Foco visible: con Tab se llega a la primera opción, y se ve.
          await page.keyboard.press("Tab");
          const foco = await page.evaluate(() => {
            const a = document.activeElement;
            const s = getComputedStyle(a);
            return { op: a.classList.contains("ap-op"), fv: a.matches(":focus-visible"),
                     estilo: s.outlineStyle, ancho: parseFloat(s.outlineWidth), color: s.outlineColor };
          });
          info("foco: " + JSON.stringify(foco));
          ok(foco.op && foco.fv, "Tab lleva el foco a la primera opción");
          ok(foco.estilo !== "none" && foco.ancho >= 2 && foco.color === c.t.accent, "y el foco se ve: contorno de 2 px en --accent");
          ok(await campo.locator(".ap-lista").count() === 1, "pasar a la lista con Tab no la cierra");
          await page.keyboard.press("Enter");
          await page.waitForTimeout(150);
          const e = await estadoDelCampo(campo);
          ok(e.sello === "LHR" && e.visible === "Londres", "Enter sobre la opción la elige (Londres, LHR)");
          ok(await page.evaluate(() => document.activeElement && document.activeElement.closest(".ap") !== null &&
                                       document.activeElement.tagName === "INPUT"),
             "y el foco vuelve al campo, no se pierde");
          const sello = await campo.locator(".ap-sello").evaluate(s => ({ bg:getComputedStyle(s).backgroundColor, fg:getComputedStyle(s).color }));
          ok(sello.bg === c.t.soft && sello.fg === c.t.accent, "el sello usa --accent-soft y --accent");
          await page.screenshot({ path: path.join(require("os").tmpdir(), `val87-${P === MANUAL ? "manual" : "revision"}-${T.esquema}-${T.tema || "auto"}.png`) });
          await page.close();
        });
      }
    }
    await bloque("CRITERIO 14 · los temas de verdad cambian (control del bloque anterior)", async () => {
      const claro = tokensDe[TEMAS[0].nombre + MANUAL.nombre], oscuro = tokensDe[TEMAS[1].nombre + MANUAL.nombre],
            elegido = tokensDe[TEMAS[2].nombre + MANUAL.nombre], claroElegido = tokensDe[TEMAS[3].nombre + MANUAL.nombre];
      ok(claro && oscuro && claro.accent !== oscuro.accent, "el acento del tema oscuro no es el del claro");
      ok(elegido && oscuro && elegido.accent === oscuro.accent, "y el oscuro elegido es el mismo que el del sistema");
      ok(claroElegido && claro && claroElegido.accent === claro.accent, "y el claro elegido, el del claro");
    });

    /* ═════════ los vecinos ═════════
       Lo que este cambio tocó por caminos que la lista del brief no nombra. */
    await bloque("VECINO · al salir, la lista se cierra y NO se come el toque que la cerró", async () => {
      /* La lista empuja: cerrarla sube lo de abajo unos 280 px. Si se cierra
         en el mismo instante en que baja el dedo sobre otra cosa, el toque
         cae en otro lado. Se toca la cruz de la SEGUNDA tarjeta con la lista
         de la primera abierta. */
      const page = await nuevaPagina(browser, { vuelos:[vueloImportado(""), vueloImportado("MAD", { title:"La segunda" })] });
      await REVISION.abrir(page);
      ok(await page.locator(".stack .imp-card").count() === 2, "dos tarjetas para revisar");
      await escribir(page, REVISION.destino(page, 0).locator("input"), "bari");
      ok(await REVISION.destino(page, 0).locator(".ap-op").count() > 0, "la lista de la primera está abierta");
      await REVISION.tarjeta(page, 1).locator("[data-discard]").click();
      await page.waitForTimeout(300);
      const quedan = await page.locator(".stack .imp-card").count();
      ok(quedan === 1, `tocar la cruz de la segunda la descarta (quedan ${quedan})`);
      ok(await page.locator(".stack .imp-card .imp-title").first().inputValue() === "Vuelo importado", "y la que queda es la primera");
      ok(await REVISION.destino(page, 0).locator("input").inputValue() === "bari", "con lo que se había escrito");
      await page.close();

      // Lo mismo en el formulario manual, con el botón de adjuntar.
      const p2 = await nuevaPagina(browser);
      await MANUAL.abrir(p2);
      await escribir(p2, p2.locator("#i_to"), "bari");
      ok(await MANUAL.destino(p2).locator(".ap-op").count() > 0, "formulario: la lista está abierta");
      const elegir = p2.waitForEvent("filechooser", { timeout:3000 }).then(() => true, () => false);
      await p2.locator('[data-pick="doc_file"]').click();
      ok(await elegir, "tocar «Archivo» abre el selector igual");
      await p2.close();
    });

    await bloque("VECINO · cambiar de tipo de reserva no cambia el código por la ciudad", async () => {
      const page = await nuevaPagina(browser);
      await MANUAL.abrir(page);
      await escribir(page, page.locator("#i_to"), "bari");
      await MANUAL.destino(page).locator('.ap-op[data-cod="BRC"]').click();
      await page.locator('#tp button[data-t="transfer"]').click();
      await page.waitForTimeout(150);
      const hasta = await page.locator("#i_to").inputValue();
      ok(hasta === "BRC", `en Traslado, «Hasta» recibe el código y no la ciudad (${JSON.stringify(hasta)})`);
      ok(await page.locator("#fields .ap").count() === 0, "y el traslado sigue siendo texto libre, sin buscador");
      await page.locator('#tp button[data-t="flight"]').click();
      await page.waitForTimeout(150);
      const e = await estadoDelCampo(MANUAL.destino(page));
      ok(e.visible === "Bariloche" && e.sello === "BRC", "y de vuelta en Vuelo es Bariloche con su sello");
      // VAL-92: «Lobos» trae UNA opción (FSD, por una palabra del nombre) y salir la toma.
      // Lo que se prueba es el aviso de un texto: «Lobería» no trae ninguna.
      await escribir(page, page.locator("#i_from"), "Lobería");
      await MANUAL.salir(page);
      await page.waitForTimeout(200);
      ok(/Lobería/.test(await MANUAL.aviso(page)), "el aviso sigue vivo después de cambiar de tipo dos veces");
      await page.close();
    });

    await bloque("VECINO · tocar Guardar con lo escrito, sin salir antes del campo", async () => {
      const page = await nuevaPagina(browser);
      await MANUAL.abrir(page);
      await escribir(page, page.locator("#i_to"), "eze");
      const v = await MANUAL.guardar(page);
      ok(v && v.to === "EZE", `«eze» y Guardar en seguida guarda EZE (${JSON.stringify(v && v.to)})`);
      await page.close();
    });

    await bloque("VECINO · la opción tocada con el dedo (tap), no sólo con el mouse", async () => {
      const page = await nuevaPagina(browser, { vuelos:[vueloImportado("")] });
      await MANUAL.abrir(page);
      await escribir(page, page.locator("#i_to"), "bari");
      await MANUAL.destino(page).locator('.ap-op[data-cod="BRC"]').tap();
      await page.waitForTimeout(200);
      const e = await estadoDelCampo(MANUAL.destino(page));
      ok(e.visible === "Bariloche" && e.sello === "BRC", "tap sobre Bariloche la elige (Chromium emulando toque)");
      await page.close();
    });

    await bloque("VECINO · el traslado importado no cambia: sigue en mayúsculas como antes", async () => {
      const page = await nuevaPagina(browser, { vuelos:[{
        type:"transfer", title:"Remís", start:"2027-07-14T12:00", end:"", from:"Aeropuerto", to:"Hotel Llao Llao",
        provider:"Remises Sur", flightNumber:"", confirmation:"R1", seat:"", terminal:"", gate:"", boardingTime:"",
        address:"", phone:"", cost:"", currency:"", notes:"" }] });
      await REVISION.abrir(page);
      ok(await page.locator(".stack .imp-card .ap").count() === 0, "la tarjeta del traslado no tiene el buscador");
      await page.locator("#im-save").click();
      await page.waitForFunction(() => Store.itemsOf("tv").length === 1, null, { timeout:8000 });
      const t = (await reservasDe(page, "tv"))[0];
      ok(t.to === "HOTEL LLAO LLAO", `guardado igual que antes de VAL-87: ${JSON.stringify(t.to)}`);
      await page.close();
    });

  } catch (e) {
    fallos++;
    console.log("\n  FALLA (excepción fuera de todo bloque) " + (e && e.message));
    console.log(e && e.stack);
  } finally {
    if (browser) await browser.close();
    console.log("\n====================================================");
    console.log(`  ${pasaron} pasaron, ${fallos} fallaron`);
    console.log("====================================================");
    process.exitCode = fallos ? 1 : 0;
  }
})();
