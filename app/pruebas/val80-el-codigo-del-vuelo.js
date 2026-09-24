/* ============================================================
   VAL-80 — EL CAMPO DEL VUELO TE COME LETRAS

   Los SEIS gestos del brief, cada uno con su bloque. Todos tocan el
   control de verdad: se escribe en el campo y se toca Guardar. Ninguno
   llama a la función por dentro — ese atajo ya mató una entrega acá.

     1 · escribir SUECIA en Destino (IATA) y guardar: no se comen letras,
         y la app dice algo
     2 · escribir ARN y guardar: no dice nada, y sigue mandando
         (el caso de éxito de VAL-72, corrido DESPUÉS del arreglo)
     3 · el multidestino MAD · CDG · FCO: los tres siguen mandando y el
         aviso de multidestino sigue apareciendo
     4 · un `to` que no es código, ya guardado: llega al modelo como
         pista, CON SUS FECHAS, y el destino escrito vuelve a mandar
     5 · lo mismo entrando por la pantalla de revisar lo importado
     6 · una lista guardada antes de este cambio se comporta igual

   Y el barrido de formatos que pide el brief, todo por el campo: `to` de
   2, 3 y 4 caracteres, en minúscula y en mayúscula.

   LOS FIXTURES SE ESCRIBIERON LEYENDO EL FORMULARIO, no de memoria. Un
   vuelo de `sheetItem` tiene título, origen, destino, sale, llega,
   aerolínea, nº de vuelo y código de reserva; "llega" es opcional, así que
   hay un caso con y un caso sin. Las dos fechas son `datetime-local`.

   ------------------------------------------------------------
   LO QUE ESTE ARNÉS NO PRUEBA — dicho de frente
   ------------------------------------------------------------
   · `claude` es falso: lo inyecta este archivo. Lo que se asevera es qué
     PROMPT recibió `sample.json()`, no qué hace el modelo con él.
   · Chromium de escritorio sobre `file://` no es el teléfono. Ver
     CLAUDE.md, "La palabra verificado".

   ------------------------------------------------------------
   EL CONTROL NEGATIVO — corrido, y con lo que da
   ------------------------------------------------------------
   Un arnés que no puede fallar no prueba nada. Se corre contra una copia
   del HTML con la guarda sacada, que es volver al defecto:

     sed 's/var codigo = esCodigoIATA(f.to);/var codigo = true;/' \
       app/valija.html > /tmp/val80-sin-guarda.html
     NODE_PATH=/opt/node22/lib/node_modules \
       node app/pruebas/val80-el-codigo-del-vuelo.js /tmp/val80-sin-guarda.html

   Y el segundo, que devuelve el truncado del campo:

     sed 's|placeholder="MAD" autocomplete|placeholder="MAD" maxlength="4" autocomplete|' \
       app/valija.html > /tmp/val80-con-maxlength.html

       NODE_PATH=/opt/node22/lib/node_modules \
         node app/pruebas/val80-el-codigo-del-vuelo.js [ruta/al/valija.html]
   ============================================================ */
"use strict";

const { chromium } = require("playwright");
const path = require("path");

const HTML = process.argv[2] ? path.resolve(process.argv[2])
                             : path.resolve(__dirname, "..", "valija.html");
const APP = "file://" + HTML;

let fallos = 0, pasaron = 0;
const ok = (c, m) => { if (c) { pasaron++; console.log("  ok     " + m); }
                       else { fallos++; console.log("  FALLA  " + m); } };
const info = m => console.log("  info   " + m);
async function bloque(nombre, fn) {
  console.log("\n· " + nombre);
  try { await fn(); }
  catch (e) { fallos++; console.log("  FALLA (excepción) " + (e && e.message)); console.log(e && e.stack); }
}

/* ---------- los viajes ---------- */
const T_VACIO = { id:"tv", name:"Escandinavia", destination:"Noruega",
                  startDate:"2027-03-01", endDate:"2027-03-10", hue:214, travelers:"Tomás" };
const T_SUECIA = { id:"ts", name:"Escandinavia", destination:"Noruega",
                   startDate:"2027-03-01", endDate:"2027-03-10", hue:214, travelers:"Tomás" };
const T_EUROPA = { id:"te", name:"Europa", destination:"Europa",
                   startDate:"2027-04-01", endDate:"2027-04-17", hue:30, travelers:"Tomás y Ana" };
const T_VIEJA = { id:"tvj", name:"Escandinavia vieja", destination:"Noruega",
                  startDate:"2027-03-01", endDate:"2027-03-10", hue:180, travelers:"Tomás" };
const T_VIEJA_OK = { id:"tvk", name:"Madrid viejo", destination:"Madrid",
                     startDate:"2027-05-02", endDate:"2027-05-12", hue:90, travelers:"Tomás" };

/* Un vuelo tal como lo escribe el formulario: con "llega" cargado. */
const vuelo = (id, from, to, extra) => Object.assign({
  id, type:"flight", title:"Vuelo", from, to,
  start:"2027-03-01T22:10", end:"2027-03-02T14:35",
  provider:"SAS", flightNumber:"SK 1234", confirmation:"XKD9P2"
}, extra || {});

/* El caso sin "llega": es un campo opcional del formulario y tiene que
   existir un fixture sin él. */
const VUELO_SUECIA = vuelo("s1", "EZE", "SUECIA");
const VUELO_SUECIA_SIN_LLEGA = vuelo("s2", "ARN", "OSLO", { start:"2027-03-08T09:00", end:"" });

const VUELOS_EUROPA = [
  vuelo("e1", "EZE", "MAD", { start:"2027-04-01T08:00", end:"2027-04-01T23:30", title:"Vuelo a Madrid" }),
  vuelo("e2", "MAD", "CDG", { start:"2027-04-06T09:00", end:"2027-04-06T11:00", title:"Vuelo a París" }),
  vuelo("e3", "CDG", "FCO", { start:"2027-04-11T14:00", end:"2027-04-11T16:00", title:"Vuelo a Roma" })
];

/* La lista "de antes de este cambio": se guardó cuando el `to` sin código
   todavía mandaba, así que sus ítems dicen que los razonó con SUEC y que
   ese destino venía de las reservas. Es exactamente el dato que el cambio
   podría hacer caducar de golpe. */
const ITEM = (clave, nombre, porDestino, fuente) => ({
  clave, nombre, categoria:"otros", cantidad:1, estado:"pendiente",
  origen:"destino", regla:"destino", motivo:"Por el destino.",
  porDestino, porDestinoFuente:fuente, orden:800, sug:false, nuevo:false
});
const LISTA_VIEJA = {
  tripId:"tvj", tipoViaje:"ciudad", actualizadaEn:"2027-02-01T00:00:00.000Z",
  items:{ "adaptador":ITEM("adaptador","Adaptador de enchufe","SUEC","reservas"),
          "campera":ITEM("campera","Campera de abrigo","SUEC","reservas") }
};
const LISTA_VIEJA_OK = {
  tripId:"tvk", tipoViaje:"ciudad", actualizadaEn:"2027-02-01T00:00:00.000Z",
  items:{ "adaptador":ITEM("adaptador","Adaptador de enchufe","MAD","reservas"),
          "campera":ITEM("campera","Campera de abrigo","MAD","reservas") }
};

/* El texto que se pega en Importar. El stub del modelo contesta un vuelo
   sólo si el prompt lo trae, que es lo que prueba que el prompt viajó. */
const TEXTO_PEGADO = [
  "CONFIRMACION SK9090",
  "Vuelo Buenos Aires (EZE) a Suecia",
  "Sale 01/03/2027 22:10 — Llega 02/03/2027 14:35",
  "SAS · SK 1234"
].join("\n");

/* ---------- el simulador de la plataforma ----------
   Escrito contra el contrato de `sample` (json + limits), y registrando
   el PROMPT entero: es lo único sobre lo que se asevera en los gestos 3
   y 4. El vuelo que contesta para importar trae `to` sin código a
   propósito, que es el caso del PM. */
function simulador() {
  window.__PROMPTS__ = [];
  const sample = {
    limits: async () => ({ maxPromptBytes: 200000 }),
    json: async (prompt) => {
      const p = String(prompt);
      window.__PROMPTS__.push(p);
      if (/valija|equipaje|empacar/i.test(p)) return { items: [], quitar: [] };
      if (p.indexOf("SK9090") < 0) return { items: [] };
      return { items: [{
        type:"flight", title:"Buenos Aires → Suecia",
        start:"2027-03-01T22:10", end:"2027-03-02T14:35",
        from:"EZE", to:"SUECIA", provider:"SAS", flightNumber:"SK 1234",
        confirmation:"SK9090", seat:"", terminal:"", gate:"", boardingTime:"",
        address:"", phone:"", cost:"", currency:"", notes:""
      }] };
    }
  };
  window.claude = { use: async k => (k === "sample" ? sample : null) };
}

async function nuevaPagina(browser, semilla) {
  const page = await browser.newPage({ viewport:{ width:390, height:844 }, hasTouch:true, isMobile:true });
  await page.route("**/*", r => (/^file:/.test(r.request().url()) ? r.continue() : r.abort()));
  page.on("pageerror", e => { console.log("  !! pageerror: " + e.message); fallos++; });
  await page.addInitScript(simulador);
  await page.addInitScript(datos => {
    try { if (!localStorage.getItem("valija.v1")) localStorage.setItem("valija.v1", JSON.stringify(datos)); }
    catch (e) {}
  }, semilla);
  return page;
}

const SEMILLA = {
  trips: [T_VACIO, T_SUECIA, T_EUROPA, T_VIEJA, T_VIEJA_OK],
  items: {
    tv: [],
    ts: [VUELO_SUECIA, VUELO_SUECIA_SIN_LLEGA],
    te: VUELOS_EUROPA,
    tvj: [vuelo("v1", "EZE", "SUEC")],
    tvk: [vuelo("k1", "EZE", "MAD")]
  },
  packing: { tvj: LISTA_VIEJA, tvk: LISTA_VIEJA_OK }
};

async function ir(page, hash) {
  await page.goto(APP + hash);
  await page.waitForFunction(() => typeof Store !== "undefined" && Store.ready, null, { timeout:15000 });
  await page.waitForTimeout(400);
}

/** EL GESTO de cargar un vuelo a mano: se toca "Agregar", se escribe en
    cada campo y se toca "Guardar". Nada de disparar eventos internos. */
async function cargarVueloAMano(page, campos) {
  await page.locator("#additem").click();
  await page.waitForSelector("#i_to", { timeout:10000 });
  await page.locator("#i_title").fill(campos.title || "Vuelo");
  await page.locator("#i_from").fill(campos.from || "EZE");
  await page.locator("#i_to").fill(campos.to || "");
  await page.locator("#i_start").fill(campos.start || "2027-03-01T22:10");
  if (campos.end !== undefined) await page.locator("#i_end").fill(campos.end);
  await page.locator("#i_provider").fill(campos.provider || "SAS");
  await page.waitForTimeout(120);
}
const avisoEnLaHoja = page => page.locator("#i_ruta_aviso").innerText().catch(() => "");
const guardar = async page => {
  await page.locator("#save").click();
  await page.waitForTimeout(500);
};
const cartel = page => page.locator("#toast").innerText().catch(() => "");
const reservasDe = (page, id) => page.evaluate(i => Store.itemsOf(i), id);

/** EL GESTO de armar la valija: entrar, marcar un tipo si lo pide y tocar
    el botón. Devuelve el prompt que recibió el modelo. */
async function armarLaValija(page, tripId) {
  await ir(page, "#/trip/" + tripId + "/valija");
  const grilla = await page.locator('#pk-tp [data-t]').count();
  if (grilla) { await page.locator('#pk-tp [data-t="ciudad"]').click(); await page.waitForTimeout(200); }
  const build = page.locator("#pk-build");
  if (await build.count()) await build.click();
  else await page.locator("#pk-confirmtype").click();
  await page.waitForTimeout(1200);
  const ps = await page.evaluate(() => window.__PROMPTS__ || []);
  const equipaje = ps.filter(p => /valija|equipaje|empacar/i.test(p));
  const ultimo = equipaje[equipaje.length - 1] || "";
  return (ultimo.split("\n").find(l => /^- Destino/.test(l)) || "");
}

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
    console.log("HTML bajo prueba: " + HTML);

    /* ═════════ GESTO 1 · SUECIA en Destino (IATA) ═════════ */
    await bloque("GESTO 1 · escribir SUECIA en Destino (IATA) y guardar", async () => {
      const page = await nuevaPagina(browser, SEMILLA);
      await ir(page, "#/trip/tv");
      await cargarVueloAMano(page, { title:"Vuelo a Suecia", from:"EZE", to:"SUECIA",
                                     start:"2027-03-01T22:10", end:"2027-03-02T14:35" });

      /* Lo que la persona ve en la pantalla ANTES de tocar Guardar: el campo
         tiene las seis letras que escribió, no cuatro. */
      const enPantalla = await page.locator("#i_to").inputValue();
      info("el campo dice: " + JSON.stringify(enPantalla));
      ok(enPantalla === "SUECIA", `el campo NO come letras: quedaron las 6 (${enPantalla.length})`);

      const aviso = await avisoEnLaHoja(page);
      info("aviso al lado del campo: " + JSON.stringify(aviso.slice(0, 90)));
      ok(/SUECIA/.test(aviso), "y la app dice algo, ahí mismo, nombrando lo que escribió");
      ok(/tres letras/.test(aviso), "el aviso dice qué va en ese campo");
      ok(!/perd[oó]n|disculp/i.test(aviso), "y no pide disculpas");

      await guardar(page);
      const its = await reservasDe(page, "tv");
      const v = its.find(i => i.type === "flight");
      ok(!!v, "la reserva se guardó: avisar no bloquea el guardado");
      ok(v && v.to === "SUECIA", `y se guardó entera: ${JSON.stringify(v && v.to)}`);

      const t = await cartel(page);
      info("cartel al guardar: " + JSON.stringify(t));
      ok(/SUECIA/.test(t) && /pista/.test(t), "el cartel al guardar dice qué va a hacer con eso");
      await page.close();
    });

    /* ═════════ 2, 3 y 4 caracteres, en minúscula y en mayúscula ═════════ */
    await bloque("el barrido de formatos, todo por el campo", async () => {
      const casos = [
        { to:"OS",   codigo:false, por:"dos letras no alcanzan" },
        { to:"ARN",  codigo:true,  por:"tres en mayúscula es el caso bueno" },
        { to:"arn",  codigo:true,  por:"tres en minúscula: el campo las sube" },
        { to:"SUEC", codigo:false, por:"cuatro: lo que el maxlength dejaba pasar" },
        { to:"oslo", codigo:false, por:"cuatro en minúscula" }
      ];
      for (const c of casos) {
        const page = await nuevaPagina(browser, SEMILLA);
        await ir(page, "#/trip/tv");
        await cargarVueloAMano(page, { title:"Vuelo", from:"EZE", to:c.to, end:"" });
        const enPantalla = await page.locator("#i_to").inputValue();
        const aviso = await avisoEnLaHoja(page);
        await guardar(page);
        const v = (await reservasDe(page, "tv")).find(i => i.type === "flight");
        ok(enPantalla.length === c.to.length, `«${c.to}» entra entero en el campo (${c.por})`);
        ok(v && v.to === c.to.toUpperCase(), `«${c.to}» se guarda como ${c.to.toUpperCase()}`);
        ok(c.codigo ? aviso.trim() === "" : /tres letras/.test(aviso),
           `«${c.to}» ${c.codigo ? "NO dispara aviso" : "dispara el aviso"}`);
        await page.close();
      }
    });

    /* ═════════ LOS DOS VECINOS QUE ESTE ARREGLO TOCÓ ═════════
       El aviso vive dentro de `#fields`, que el selector de tipo reemplaza
       entero. Y el formulario también se abre sobre una reserva YA guardada,
       que puede traer el dato malo de antes. Ninguno de los dos está en la
       lista del brief, y los dos los toca el dedo por caminos que este
       cambio modificó: la pregunta "¿qué caso vecino comparte la causa?". */
    await bloque("los vecinos · cambiar el tipo de reserva, y abrir una ya guardada", async () => {
      const page = await nuevaPagina(browser, SEMILLA);
      await ir(page, "#/trip/tv");
      await page.locator("#additem").click();
      await page.waitForSelector("#i_to", { timeout:10000 });

      // Vuelo → Traslado → Vuelo, tocando los botones del selector.
      await page.locator('#tp button[data-t="transfer"]').click();
      await page.waitForTimeout(200);
      ok(await page.locator("#i_ruta_aviso").count() === 0,
         "un traslado no tiene el aviso: su «hasta» es texto libre a propósito");
      await page.locator('#tp button[data-t="flight"]').click();
      await page.waitForTimeout(200);
      await page.locator("#i_to").fill("SUECIA");
      await page.waitForTimeout(200);
      ok(/SUECIA/.test(await avisoEnLaHoja(page)),
         "y al volver a Vuelo el aviso sigue vivo: el campo reemplazado se vuelve a enganchar");
      await page.locator("#cancel").click();
      await page.waitForTimeout(250);

      // Abrir una reserva ya guardada con el dato malo adentro.
      await ir(page, "#/trip/ts");
      await page.locator(".pass").first().click();
      await page.waitForSelector("#i_to", { timeout:10000 });
      const abierto = await page.locator("#i_to").inputValue();
      info("la reserva guardada trae: " + JSON.stringify(abierto));
      ok(/SUECIA|OSLO/.test(abierto), "la reserva guardada se abre con su destino entero");
      ok(/tres letras/.test(await avisoEnLaHoja(page)),
         "y el aviso está puesto de entrada, sin tocar nada");
      await page.close();
    });

    /* ═════════ GESTO 2 · ARN: el caso de éxito de VAL-72 ═════════ */
    await bloque("GESTO 2 · escribir ARN y guardar: no dice nada, y sigue mandando", async () => {
      const page = await nuevaPagina(browser, SEMILLA);
      await ir(page, "#/trip/tv");
      await cargarVueloAMano(page, { title:"Vuelo a Estocolmo", from:"EZE", to:"ARN",
                                     start:"2027-03-01T22:10", end:"2027-03-02T14:35" });
      const aviso = await avisoEnLaHoja(page);
      ok(aviso.trim() === "", "con un código de verdad no aparece ningún aviso");
      await guardar(page);
      const t = await cartel(page);
      info("cartel: " + JSON.stringify(t));
      ok(/Reserva guardada/.test(t), "el cartel es el de siempre");

      const linea = await armarLaValija(page, "tv");
      info(linea.slice(0, 160));
      ok(/ARN/.test(linea), "ARN llega al modelo");
      ok(/que son lo que manda/.test(linea), "y sigue siendo destino en firme: manda sobre el escrito");
      ok(/NUNCA por encima/.test(linea), "«Noruega» queda como contexto, que es lo que cerró VAL-72");
      await page.close();
    });

    /* ═════════ GESTO 3 · el multidestino de VAL-72 ═════════ */
    await bloque("GESTO 3 · MAD · CDG · FCO: los tres siguen mandando", async () => {
      const page = await nuevaPagina(browser, SEMILLA);
      const linea = await armarLaValija(page, "te");
      info(linea.slice(0, 200));
      ok(/MAD/.test(linea) && /CDG/.test(linea) && /FCO/.test(linea), "la línea nombra los tres");
      ok(/que son lo que manda/.test(linea), "y dice que las reservas mandan");
      ok(/multidestino/.test(linea), "y el aviso de multidestino sigue apareciendo");
      ok(!/Europa \(escrito/.test(linea), "«Europa» no se metió entre los destinos");
      ok(/NUNCA por encima/.test(linea), "«Europa» queda como contexto");
      await page.close();
    });

    /* ═════════ GESTO 4 · un `to` sin código, ya guardado ═════════ */
    await bloque("GESTO 4 · un destino sin código, ya guardado: llega como pista con sus fechas", async () => {
      const page = await nuevaPagina(browser, SEMILLA);
      const linea = await armarLaValija(page, "ts");
      info(linea.slice(0, 260));
      /* Se asevera sobre el ENCABEZADO de la línea, no sobre que "Noruega"
         aparezca en algún lado: sin la guarda también aparece, al final, como
         el contexto que el modelo tiene que ignorar. El control negativo lo
         destapó — la primera versión de esta aserción pasaba con el defecto
         puesto. */
      ok(/^- Destino: Noruega \(escrito-a-mano\)/.test(linea),
         "«Noruega», que es lo que la persona escribió, encabeza la línea: vuelve a mandar");
      ok(!/que son lo que manda/.test(linea), "y NO hay ningún destino en firme que lo desplace");
      ok(/SUECIA/.test(linea), "SUECIA llega igual: callarla sería perder información");
      ok(/\(vuelo/.test(linea), "y llega diciendo que salió de un vuelo");
      ok(/2027-03-01T22:10/.test(linea), "con sus fechas, que es lo que el modelo necesita para leerla");
      ok(/OSLO/.test(linea), "el segundo vuelo sin código también llega");
      ok(!/no dicen adónde llegan/.test(linea),
         "y la línea no afirma que los vuelos no digan adónde llegan: sí lo dicen, sin código");
      await page.close();
    });

    /* ═════════ GESTO 5 · por la pantalla de revisar lo importado ═════════ */
    await bloque("GESTO 5 · lo mismo entrando por revisar lo importado", async () => {
      const page = await nuevaPagina(browser, SEMILLA);
      await ir(page, "#/trip/tv");
      await page.locator("#imp").click();
      await page.waitForSelector("#imp-live", { state:"attached", timeout:10000 });
      await page.waitForTimeout(200);
      const abierta = await page.locator(".imp-more").evaluate(e => e.open);
      if (!abierta) { await page.locator(".imp-more summary").click(); await page.waitForTimeout(150); }
      await page.locator("#im_text").fill(TEXTO_PEGADO);
      await page.waitForTimeout(150);
      await page.locator("#im-run").click();
      await page.waitForSelector("#im-save", { timeout:15000 });

      const enCampo = await page.locator('.stack [data-f="to"]').first().inputValue();
      info("el campo Destino de la tarjeta dice: " + JSON.stringify(enCampo));
      ok(enCampo === "SUECIA", "el campo de la tarjeta tampoco come letras");
      const avisoTarjeta = await page.locator("[data-rutaaviso]").first().innerText();
      info("aviso en la tarjeta: " + JSON.stringify(avisoTarjeta.slice(0, 90)));
      ok(/SUECIA/.test(avisoTarjeta) && /tres letras/.test(avisoTarjeta),
         "y la pantalla de revisar dice lo mismo que el formulario manual");

      /* El aviso está VIVO: se corrige a un código y desaparece. Es el gesto
         que sigue al aviso, y sin esto el aviso sería un cartel muerto. */
      await page.locator('.stack [data-f="to"]').first().fill("ARN");
      await page.waitForTimeout(150);
      ok((await page.locator("[data-rutaaviso]").first().innerText()).trim() === "",
         "y se apaga solo al escribir un código de verdad");
      await page.locator('.stack [data-f="to"]').first().fill("SUECIA");
      await page.waitForTimeout(150);
      ok(/SUECIA/.test(await page.locator("[data-rutaaviso]").first().innerText()),
         "y vuelve si se vuelve a escribir lo otro");

      await page.locator("#im-save").click();
      await page.waitForTimeout(900);
      const v = (await reservasDe(page, "tv")).find(i => i.type === "flight");
      ok(!!v, "la reserva entró: el aviso no bloquea");
      ok(v && v.to === "SUECIA", `y entró entera: ${JSON.stringify(v && v.to)}`);

      const linea = await armarLaValija(page, "tv");
      info(linea.slice(0, 200));
      ok(/^- Destino: Noruega \(escrito-a-mano\)/.test(linea) && !/que son lo que manda/.test(linea),
         "y el motor la trata igual que si hubiera entrado a mano: pista, no destino");
      ok(/SUECIA/.test(linea), "SUECIA llega al modelo igual");
      await page.close();
    });

    /* ═════════ GESTO 6 · una lista guardada antes de este cambio ═════════ */
    await bloque("GESTO 6 · una lista guardada antes de este cambio se comporta igual", async () => {
      const page = await nuevaPagina(browser, SEMILLA);

      /* 6a · el viaje de siempre, con códigos de verdad. Nada se mueve. */
      await ir(page, "#/trip/tvk/valija");
      await page.waitForTimeout(1200);
      const clavesOk = await page.evaluate(() => Object.keys((Store.packingOf("tvk") || {}).items || {}).sort());
      info("claves de la lista con códigos: " + JSON.stringify(clavesOk));
      ok(clavesOk.join(",") === "adaptador,campera", "la lista con códigos queda igual que como se guardó");
      ok(await page.locator(".pk-drop.sug").count() === 0, "y no aparece ninguna propuesta de sacar");

      /* 6b · el viaje cuyo destino en firme era `SUEC`. Con la guarda, ese
         destino pasa a pista y lo que manda vuelve a ser "Noruega": lo que
         NO puede pasar es que la app proponga tirar lo que ya tenía. */
      await ir(page, "#/trip/tvj/valija");
      await page.waitForTimeout(1200);
      const claves = await page.evaluate(() => Object.keys((Store.packingOf("tvj") || {}).items || {}).sort());
      info("claves de la lista vieja: " + JSON.stringify(claves));
      ok(claves.join(",") === "adaptador,campera", "los ítems de la lista vieja siguen ahí");
      ok(await page.locator(".pk-drop.sug").count() === 0,
         "y cambiar de fuente no hace que la app proponga tirarlos");
      const vivos = await page.evaluate(() =>
        Object.values((Store.packingOf("tvj") || {}).items || {}).map(i => i.estado).sort());
      ok(vivos.join(",") === "pendiente,pendiente", "y conservan su estado");
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
