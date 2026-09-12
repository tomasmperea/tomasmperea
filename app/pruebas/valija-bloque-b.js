/* Arnés de pruebas de la valija — toca los botones, no dispara los eventos.
   Usa Playwright sobre el archivo real app/valija.html. */
const { chromium } = require('playwright');
const path = require('path');

const APP = 'file://' + path.resolve(__dirname, '..', 'valija.html');

let ok = 0, fail = 0;
const fs = require('fs');
const LOG = require('path').join(require('os').tmpdir(), 'valija-qa.log');
try{ fs.unlinkSync(LOG); }catch(e){}
/* En pantalla PRIMERO, y además al archivo. La auditoría del 12/09 marcó
   que correr esto como dice LEEME.md no mostraba nada: el resultado vivía
   sólo en un log del directorio temporal. Una prueba cuyo resultado hay
   que ir a buscar es media prueba. */
const log = m => { console.log(m); try{ fs.appendFileSync(LOG, m + '\n'); }catch(e){} };
function assert(cond, msg){
  if(cond){ ok++; log('  ok   ' + msg); }
  else { fail++; log('  FALLA ' + msg); }
}
async function test(nombre, fn){
  log('\n· ' + nombre);
  try{ await fn(); }
  catch(e){ fail++; log('  FALLA (excepción) ' + (e && e.message)); log(e.stack); }
}

const TRIP = {
  id:'t1', name:'Vacaciones en Madrid', destination:'Madrid',
  startDate:'2026-10-05', endDate:'2026-10-15', hue:214,
  createdAt:'2026-09-01T00:00:00.000Z', updatedAt:'2026-09-01T00:00:00.000Z'
};
const VUELO = {
  id:'i1', type:'flight', title:'Vuelo a Madrid', start:'2026-10-05T22:00',
  end:'2026-10-06T14:00', from:'EZE', to:'MAD', provider:'Iberia',
  confirmation:'ABC123', notes:''
};
const AUTO = {
  id:'i2', type:'car', title:'Auto en Madrid', start:'2026-10-07T10:00',
  end:'2026-10-12T10:00', provider:'Europcar', confirmation:'ZZZ999', notes:''
};
const HOTEL = {
  id:'i3', type:'stay', title:'Apart Malasaña', start:'2026-10-06T15:00',
  end:'2026-10-15T11:00', provider:'Airbnb', notes:'El depto no tiene lavarropas'
};

function seed(items){
  return { trips:[TRIP], items:{ t1: items }, packing:{} };
}

/** Inyecta un `claude` falso. sampleRespuesta: null = sin IA. */
async function nuevaPagina(browser, { items = [VUELO], sample = null } = {}){
  const page = await browser.newPage({ viewport:{ width:390, height:780 } });
  /* Este entorno bloquea los hosts externos (fuentes y librerías), así que cada
     carga se quedaba esperando un handshake que nunca llega. Acumulado sobre una
     corrida entera, el navegador se caía a mitad de camino y arrastraba las
     pruebas que faltaban: aparecían como fallos del producto sin serlo. Cortamos
     el pedido de entrada. La app ya está escrita para funcionar sin ellos. */
  await page.route('**/*', r => {
    const u = r.request().url();
    return /^file:/.test(u) ? r.continue() : r.abort();
  });
  page.on('pageerror', e => { log('  !! pageerror: ' + e.message); fail++; });
  page.on('console', m => { const t = m.text(); if(m.type()==='error' && !/net::|Failed to load resource/.test(t)) log('  !! console.error: ' + t); });
  await page.addInitScript(({ datos, sample }) => {
    window.__SAMPLE__ = sample;
    window.claude = {
      use: async (k) => {
        if(k === 'sample' && window.__SAMPLE__){
          return { json: async () => window.__SAMPLE__ };
        }
        return null;   // sin db, sin descargas: el camino real sin plataforma
      }
    };
    // Sembrar SÓLO la primera carga: addInitScript corre en cada recarga y si
    // no, page.reload() borraría lo que la app guardó (que es justo lo que el
    // test de recarga quiere comprobar).
    try{ if(!localStorage.getItem('valija.v1')) localStorage.setItem('valija.v1', JSON.stringify(datos)); }catch(e){}
  }, { datos: seed(items), sample });
  await page.goto(APP);
  await page.waitForFunction(() => typeof Store !== 'undefined' && Store.ready, null, { timeout: 15000 });
  return page;
}

const SAMPLE_OK = { items:[], quitar:[], clima:'Octubre en Madrid: entre 12 y 22 grados.' };

const sel = {
  notice: '#main .notice',
  dock: '#pkdock .pk-dock .notice'
};

async function irAValija(page){
  // Si ya estamos ahí, no recargamos: `App.plan` es memoria y una recarga la borra.
  if(!page.url().endsWith('#/trip/t1/valija')) await page.goto(APP + '#/trip/t1/valija');
  await page.waitForTimeout(150);
}
async function salirDeValija(page){
  await page.goto(APP + '#/trip/t1');
  await page.waitForTimeout(200);
}

/** Arma la lista tocando los botones reales. */
async function armarLista(page){
  await irAValija(page);
  const build = page.locator('#pk-build');
  if(await build.count()){ await build.click(); await page.waitForTimeout(400); }
}

(async () => {
  const browser = await chromium.launch();

  /* ═══════════════════════════════════════════════════════════
     PASO 1 · el motor nuevo, con la pantalla de siempre
     ═══════════════════════════════════════════════════════════ */
  await test('PASO 1 · armar la lista, marcar, descartar, agregar, progreso', async () => {
    const page = await nuevaPagina(browser);
    await armarLista(page);

    const filas = page.locator('.pk-row[data-row]');
    assert(await filas.count() > 5, `la lista se armó (${await filas.count()} filas)`);
    assert(await page.locator('.pk-cat').count() >= 3, 'hay categorías');

    const antes = await page.locator('.pk-prog .n').innerText();

    // marcar tocando el círculo
    const primera = filas.first();
    const clave = await primera.getAttribute('data-row');
    await primera.locator('.pk-mark').click();
    await page.waitForTimeout(150);
    const estado = await page.evaluate(k => Store.packingOf('t1').items[k].estado, clave);
    assert(estado === 'empacado', 'tocar el círculo marca como empacado');
    assert(await page.locator('.pk-prog .n').innerText() !== antes, 'el progreso cambió');

    // descartar tocando el botón de descartar
    const otra = page.locator('.pk-row[data-row]').nth(2);
    const clave2 = await otra.getAttribute('data-row');
    await otra.locator('.pk-drop').click();
    await page.waitForTimeout(150);
    assert(await page.evaluate(k => Store.packingOf('t1').items[k].estado, clave2) === 'descartado',
      'tocar el círculo de descartar descarta');

    // volver a la lista
    await page.locator(`.pk-row[data-row="${clave2}"] .pk-back`).click();
    await page.waitForTimeout(150);
    assert(await page.evaluate(k => Store.packingOf('t1').items[k].estado, clave2) === 'pendiente',
      'el botón volver lo recupera');

    // agregar un ítem propio desde el FAB
    await page.locator('#pk-additem').click();
    await page.fill('#pk_new_nombre', 'Cargador del reloj');
    await page.locator('#save').click();
    await page.waitForTimeout(200);
    const propio = await page.evaluate(() =>
      Object.values(Store.packingOf('t1').items).filter(i => i.origen === 'manual').map(i => i.nombre));
    assert(propio.includes('Cargador del reloj'), 'se agregó un ítem propio');

    // hoja del ítem
    await page.locator('.pk-row[data-row] .pk-txt').first().click();
    await page.waitForTimeout(100);
    assert(await page.locator('.sheet .pk-states').count() === 1, 'la hoja del ítem abre con sus tres estados');
    await page.locator('#cancel').click();

    // plegar una categoría
    const cat = page.locator('.pk-cat-hd').first();
    const abiertoAntes = await page.locator('.pk-cat').first().getAttribute('data-open');
    await cat.click(); await page.waitForTimeout(100);
    assert(await page.locator('.pk-cat').first().getAttribute('data-open') !== abiertoAntes,
      'la categoría se pliega al tocarla');

    // hoja de transparencia
    await page.locator('#pk-info').click(); await page.waitForTimeout(100);
    assert((await page.locator('.sheet-hd h2').innerText()).includes('De dónde sale'), 'abre la hoja 12');
    await page.locator('#closeSheet').click();

    await page.close();
  });

  /* ═══════════════════════════════════════════════════════════
     PASO 2 · VAL-46, el flujo de la actualización
     ═══════════════════════════════════════════════════════════ */
  await test('VAL-46 · guardar una reserva marca la lista como vieja y la tira lo dice (14)', async () => {
    const page = await nuevaPagina(browser, { sample: SAMPLE_OK });
    await armarLista(page);
    await page.goto(APP + '#/trip/t1'); await page.waitForTimeout(150);

    // se agrega el auto TOCANDO los controles de la hoja de reserva
    await page.locator('#additem').click();
    await page.waitForTimeout(120);
    await page.locator('#tp button[data-t="car"]').click();
    await page.fill('#i_title', 'Auto en Madrid');
    await page.fill('#i_provider', 'Europcar');
    await page.fill('#i_start', '2026-10-07T10:00');
    await page.fill('#i_end', '2026-10-12T10:00');
    await page.locator('#save').click();
    await page.waitForTimeout(600);

    const tira = page.locator('#vjentry');
    assert(await tira.count() === 1, 'la tira de entrada sigue ahí');
    const txt = await tira.innerText();
    assert(/cosas? nuevas?/.test(txt), '14 · la tira suma el chip de cosas nuevas — ' + JSON.stringify(txt));
    assert(/Agregaste el auto \(Europcar\)/.test(txt), '14 · el subtítulo nombra la reserva');

    // entrar a la valija: el aviso 15 arriba de la lista
    await tira.click();
    await page.waitForTimeout(250);
    const aviso = page.locator(sel.notice).first();
    assert(await aviso.count() === 1, '15 · hay exactamente un aviso arriba');
    assert((await aviso.innerText()).includes('el auto (Europcar)'), '15 · el aviso nombra la reserva');
    assert(await page.locator('[data-pk="verplan"]').count() === 1, '15 · "Ver qué agrego" existe');
    assert(await page.locator('[data-pk="ahorano"]').count() === 1, '15 · "Ahora no" existe');
    assert(await page.locator('#pkdock .pk-dock').count() === 0, '15 · no entró por el dock');

    await page.close();
  });

  await test('VAL-46 · 17 y 18: ver qué agrego, sumar, marcas y limpieza', async () => {
    const page = await nuevaPagina(browser, { sample: SAMPLE_OK });
    await armarLista(page);
    // el auto se agrega por Store, pero el plan se dispara con la función real
    await page.evaluate(async (auto) => {
      await Store.saveItem('t1', auto);
      await checkPackingPlan(Store.trips.get('t1'));
    }, AUTO);
    await salirDeValija(page);
    await irAValija(page);
    assert(await page.locator('#main [data-pk="verplan"]').count() === 1, '15 · el aviso está arriba de la lista');
    assert(await page.locator('#pkdock .pk-dock').count() === 0, '15 · y no en el dock');

    // GESTO: tocar "Ver qué agrego"
    await page.locator('[data-pk="verplan"]').first().click();
    await page.waitForTimeout(150);
    assert((await page.locator('.sheet-hd h2').innerText()) === 'Lo que le sumo a la valija', '17 · abre la hoja del plan');
    const grupos = await page.locator('.pk-plan-g .pk-plan-hd').allInnerTexts();
    assert(grupos.length >= 1, '17 · hay al menos un grupo');
    assert(grupos.some(g => /Porque agregaste/.test(g)), '17 · el encabezado nombra la causa — ' + JSON.stringify(grupos));
    assert((await page.locator('.sheet-bd .tiny.muted').innerText()).includes('lo descartado no vuelve'),
      '17 · la línea de garantía está');
    const apply = page.locator('#pk-plan-apply');
    assert(/Sumar/.test(await apply.innerText()), '17 · el pie dice Sumar N');

    // GESTO: tocar "Sumar N"
    await apply.click();
    await page.waitForTimeout(400);
    assert(await page.locator('.sheet').count() === 0, '18 · la hoja se cerró');
    const nuevos = await page.evaluate(() =>
      Object.values(Store.packingOf('t1').items).filter(i => i.nuevo).map(i => i.clave));
    assert(nuevos.length > 0, '18 · quedaron ítems marcados como nuevos: ' + nuevos.join(', '));
    assert(await page.locator('.pk-row.is-new').count() === nuevos.length, '18 · las filas llevan la barra');
    assert(await page.locator('.pk-row.is-new .pk-newtag').count() === nuevos.length, '18 · las filas dicen "nuevo"');
    assert(await page.locator('.pk-cat-hd .cnt .chip.soon').count() >= 1, '18 · la categoría suma el chip');
    const av = await page.locator(sel.notice).first().innerText();
    assert(/Sumé/.test(av), '18 · el aviso de confirmación — ' + JSON.stringify(av));
    assert(await page.locator(sel.notice).count() === 1, '25 · sigue habiendo un solo aviso');

    // la categoría con nuevos está abierta sola (§ 4.3)
    const catNueva = await page.evaluate(() => {
      const abiertas = [...document.querySelectorAll('.pk-cat')]
        .filter(c => c.querySelector('.pk-row.is-new'));
      return abiertas.length && abiertas.every(c => c.dataset.open === 'true');
    });
    assert(catNueva, '§4.3 · las categorías con ítems nuevos se abren solas');

    // GESTO: tocar "Listo, ya las vi"
    await page.locator('[data-pk="vistas"]').first().click();
    await page.waitForTimeout(300);
    const quedan = await page.evaluate(() =>
      Object.values(Store.packingOf('t1').items).filter(i => i.nuevo).length);
    assert(quedan === 0, '§4.3 · "Listo, ya las vi" limpia las marcas');
    assert(await page.locator('.pk-row.is-new').count() === 0, '§4.3 · las barras desaparecieron');

    await page.close();
  });

  await test('§4.3 · aceptar y salir al instante NO limpia; recorrer la lista SÍ', async () => {
    const page = await nuevaPagina(browser);
    await armarLista(page);
    await page.evaluate(async (auto) => {
      await Store.saveItem('t1', auto);
      await checkPackingPlan(Store.trips.get('t1'));
    }, AUTO);
    await irAValija(page);
    await page.locator('[data-pk="verplan"]').first().click();
    await page.waitForTimeout(150);
    await page.locator('#pk-plan-apply').click();
    await page.waitForTimeout(300);

    // salir YA, sin mirar nada
    await salirDeValija(page);
    await page.waitForTimeout(200);
    let quedan = await page.evaluate(() =>
      Object.values(Store.packingOf('t1').items).filter(i => i.nuevo).length);
    assert(quedan > 0, 'salir al instante no limpia nada (' + quedan + ' siguen marcados)');

    // volver, recorrer la lista entera, salir
    await irAValija(page);
    await page.waitForTimeout(200);
    const filas = page.locator('.pk-row.is-new');
    const n = await filas.count();
    for(let i = 0; i < n; i++){
      await filas.nth(i).scrollIntoViewIfNeeded();
      await page.waitForTimeout(750);
    }
    await page.goto(APP + '#/trip/t1');
    await page.waitForTimeout(400);
    quedan = await page.evaluate(() =>
      Object.values(Store.packingOf('t1').items).filter(i => i.nuevo).length);
    assert(quedan === 0, 'recorrer la lista y salir limpia las marcas');

    await page.close();
  });

  await test('§4.2 · "Ahora no" aplaza, no vuelve solo, y una clave nueva lo reabre', async () => {
    const page = await nuevaPagina(browser, { sample: SAMPLE_OK });
    await armarLista(page);
    await page.evaluate(async (auto) => {
      await Store.saveItem('t1', auto);
      await checkPackingPlan(Store.trips.get('t1'));
    }, AUTO);
    await salirDeValija(page);
    await irAValija(page);

    // GESTO: tocar "Ahora no" en el aviso
    await page.locator('[data-pk="ahorano"]').first().click();
    await page.waitForTimeout(200);
    const acuse = await page.locator(sel.notice).first().innerText();
    assert(/Listo, no toco nada/.test(acuse), '19 · el acuse aparece — ' + JSON.stringify(acuse));
    assert(await page.locator('[data-pk="verplan"]').count() === 1, '19 · "Verlas igual" está');

    // GESTO: "Verlas igual" reabre la hoja 17
    await page.locator('[data-pk="verplan"]').first().click();
    await page.waitForTimeout(150);
    assert((await page.locator('.sheet-hd h2').innerText()) === 'Lo que le sumo a la valija', '19 · "Verlas igual" reabre la hoja');
    await page.locator('#closeSheet').click();

    // salir y volver: no vuelve solo
    await salirDeValija(page);
    const tira = await page.locator('#vjentry').innerText();
    assert(!/cosas? nuevas?/.test(tira), '19 · la tira ya no insiste — ' + JSON.stringify(tira));
    await irAValija(page);
    assert(await page.locator('[data-pk="ahorano"]').count() === 0, '19 · al volver el aviso no está');
    // pero sigue disponible a pedido en la hoja 12
    await page.locator('#pk-info').click(); await page.waitForTimeout(150);
    assert(await page.locator('#pk-info-plan').count() === 1, '§4.2 · "Novedades sin sumar" en la hoja 12');
    await page.locator('#pk-info-plan').click(); await page.waitForTimeout(150);
    assert((await page.locator('.sheet-hd h2').innerText()) === 'Lo que le sumo a la valija', '§4.2 · se llega a la hoja 17 desde la 12');
    await page.locator('#closeSheet').click();

    // otra reserva distinta: vuelve a ofrecerse
    await page.evaluate(async (hotel) => {
      await Store.saveItem('t1', hotel);
      await Store.saveItem('t1', { id:'i4', type:'act', title:'Trekking en la sierra', start:'2026-10-09T08:00', notes:'' });
      await checkPackingPlan(Store.trips.get('t1'));
    }, HOTEL);
    await page.waitForTimeout(500);
    const hayOferta = await page.evaluate(() => !!planOfrecible('t1'));
    assert(hayOferta, '§4.2 · un plan con una clave nueva vuelve a ofrecerse');

    await page.close();
  });

  await test('16 · si el plan resuelve con la valija abierta, entra por el dock', async () => {
    const page = await nuevaPagina(browser, { sample: SAMPLE_OK });
    await armarLista(page);
    await irAValija(page);
    await page.waitForTimeout(150);
    const scrollAntes = await page.evaluate(() => document.querySelector('.pk-cat').getBoundingClientRect().top);
    await page.evaluate(async (auto) => {
      await Store.saveItem('t1', auto);
      await checkPackingPlan(Store.trips.get('t1'));
    }, AUTO);
    await page.waitForTimeout(400);
    assert(await page.locator('#pkdock .pk-dock').count() === 1, '16 · el aviso entró por el dock');
    assert(await page.locator('#main [data-pk="verplan"]').count() === 0, '16 · el aviso del plan no se insertó arriba de la lista');
    const scrollDespues = await page.evaluate(() => document.querySelector('.pk-cat').getBoundingClientRect().top);
    assert(scrollAntes === scrollDespues, '16 · la lista no se movió ni un píxel');
    assert(await page.evaluate(() => document.getElementById('pkdock').getAttribute('aria-live')) === 'polite',
      '16 · el dock tiene aria-live="polite"');

    // GESTO: tocar "Ver qué agrego" DESDE EL DOCK
    await page.locator('#pkdock [data-pk="verplan"]').click();
    await page.waitForTimeout(150);
    assert((await page.locator('.sheet-hd h2').innerText()) === 'Lo que le sumo a la valija', '16 · el botón del dock abre la hoja');
    await page.locator('#closeSheet').click();
    // GESTO: "Ahora no" desde el dock
    await page.locator('#pkdock [data-pk="ahorano"]').click();
    await page.waitForTimeout(200);
    assert(await page.locator('#pkdock .pk-dock').count() === 0, '16 · "Ahora no" del dock lo cierra');

    await page.close();
  });

  /* ═══════════════════════════════════════════════════════════
     VAL-43 · las propuestas de sacar
     ═══════════════════════════════════════════════════════════ */
  const SAMPLE_QUITAR = {
    items: [{ nombre:'Tarjeta del metro', categoria:'destino', motivo:'En Madrid el metro no vende boletos sueltos.' }],
    quitar: [
      { nombre:'Visa o autorización electrónica', motivo:'Con pasaporte argentino no necesitás visa para España: entrás por hasta 90 días.' },
      { nombre:'DNI', motivo:'No hace falta, tenés pasaporte.' },
      { nombre:'Seguro de viaje', motivo:'Tu tarjeta de crédito ya cubre asistencia al viajero en Europa.' }
    ],
    nota:'Ajusté la lista a Madrid en octubre.'
  };

  await test('VAL-43 · 20/21/22: propuesta en la fila, hoja y hoja del ítem', async () => {
    const page = await nuevaPagina(browser, { sample: SAMPLE_QUITAR });
    await armarLista(page);
    await page.waitForTimeout(900);

    const conSug = await page.evaluate(() =>
      Object.values(Store.packingOf('t1').items).filter(i => i.sugerenciaQuitar).map(i => i.clave));
    assert(conSug.length === 2, 'el motor dejó 2 propuestas y filtró el DNI por crítico: ' + JSON.stringify(conSug));

    // el círculo teñido está en la fila y NO hay marca sobre el DNI
    assert(await page.locator('.pk-drop.sug').count() === 2, '20 · un círculo teñido por propuesta');
    const lbl = await page.locator('.pk-drop.sug').first().getAttribute('aria-label');
    assert(/Te propongo sacarlo/.test(lbl), '20 · el aria-label lleva el motivo completo');
    const filaSug = page.locator('.pk-row', { has: page.locator('.pk-drop.sug') }).first();
    assert((await filaSug.innerText()).includes('lista base'), '20 · la fila conserva su chip de origen y su motivo');

    // el aviso: cerrar el de "ajusté la lista" primero si está
    let avisoTxt = await page.locator(sel.notice).first().innerText();
    if(/Ajusté|ajust/i.test(avisoTxt) && await page.locator('#pk-closefresh').count()){
      // 5.11 · el aviso 07 suma la segunda acción
      assert(/capaz no necesit/.test(avisoTxt), '5.11 · el aviso 07 suma "y hay N que capaz no necesitás" — ' + JSON.stringify(avisoTxt));
      await page.locator('#pk-closefresh').click();
      await page.waitForTimeout(150);
      avisoTxt = await page.locator(sel.notice).first().innerText();
    }
    assert(/capaz no necesitás/.test(avisoTxt), '20 · el aviso de propuestas — ' + JSON.stringify(avisoTxt));
    assert(await page.locator(sel.notice).count() === 1, '25 · un solo aviso');

    // GESTO: "Ver cuáles"
    await page.locator('[data-pk="verquitar"]').first().click();
    await page.waitForTimeout(150);
    assert((await page.locator('.sheet-hd h2').innerText()) === 'Lo que capaz no necesitás', '21 · abre la hoja');
    assert(await page.locator('.pk-prop').count() === 2, '21 · una tarjeta por propuesta');
    assert(await page.locator('#pk-prop-bd').getAttribute('aria-live') === 'polite', '21 · el cuerpo es región viva');

    // GESTO: "Sacarlo"
    await page.locator('[data-out]').first().click();
    await page.waitForTimeout(400);
    assert(await page.locator('.pk-prop.done').count() === 1, '21 · la tarjeta se colapsa, no desaparece');
    assert(await page.locator('.pk-prop').count() === 2, '21 · no hay salto de layout: siguen las dos');
    assert((await page.locator('.pk-prop.done .r').innerText()).includes('lo sacaste'), '21 · dice qué se decidió');
    const doc = await page.evaluate(k => {
      const it = Store.packingOf('t1').items[k];
      return { estado: it.estado, sug: !!it.sugerenciaQuitar };
    }, conSug[0]);
    assert(doc.estado === 'descartado' && doc.sug === false,
      '§4.4 · aceptar hace dismissItem Y clearRemovalSuggestion en la misma escritura');
    // resolver la última lleva al estado vacío
    await page.locator('[data-keep]').first().click();
    await page.waitForTimeout(400);
    assert(/Volver a la lista/.test(await page.locator('.sheet-ft').innerText()), '21 · el pie cambia al resolver la última');
    assert((await page.locator('#pk-prop-bd').innerText()).includes('No queda ninguna'), '21 · estado vacío');
    assert(await page.locator('.sheet').count() === 1, '21 · la hoja NO se cierra sola');
    await page.locator('#pk-prop-close').click();
    await page.waitForTimeout(200);
    assert(await page.locator('.pk-drop.sug').count() === 0, '20 · ya no queda círculo teñido');

    await page.close();
  });

  await test('VAL-43 · "Dejarlo" borra sólo la propuesta, y la hoja del ítem (22)', async () => {
    const page = await nuevaPagina(browser, { sample: SAMPLE_QUITAR });
    await armarLista(page);
    await page.waitForTimeout(900);
    const clave = (await page.evaluate(() =>
      Object.values(Store.packingOf('t1').items).filter(i => i.sugerenciaQuitar).map(i => i.clave)))[0];

    // GESTO: tocar el TEXTO de la fila propuesta -> hoja del ítem (estado 22)
    const fila = page.locator(`.pk-row[data-row="${clave}"]`);
    await fila.locator('.pk-txt').click();
    await page.waitForTimeout(150);
    assert(await page.locator('.pk-sug').count() === 1, '22 · el bloque de propuesta está arriba de todo');
    assert(/te propongo sacarlo/i.test(await page.locator('.pk-sug').innerText()), '22 · el rótulo');
    assert(await page.locator('.sheet-bd .pk-states').count() === 1, '22 · la hoja 11 sigue debajo');
    assert((await page.locator('.sheet-bd .f:last-of-type p').first().innerText()).length > 0, '22 · "De dónde sale" sin cambios');

    // GESTO: "Dejarlo, lo llevo"
    await page.locator('#pk-sug-keep').click();
    await page.waitForTimeout(300);
    const d = await page.evaluate(k => {
      const it = Store.packingOf('t1').items[k];
      return { estado: it.estado, sug: !!it.sugerenciaQuitar };
    }, clave);
    assert(d.sug === false && d.estado !== 'descartado', '22 · rechazar borra sólo la propuesta');
    assert(await page.locator('.pk-drop.sug').count() === 1, '22 · el círculo de ESE ítem se destiñe (queda la otra propuesta)');

    await page.close();
  });

  await test('VAL-43 · aceptar desde la FILA resuelve las dos escrituras', async () => {
    const page = await nuevaPagina(browser, { sample: SAMPLE_QUITAR });
    await armarLista(page);
    await page.waitForTimeout(900);
    const clave = (await page.evaluate(() =>
      Object.values(Store.packingOf('t1').items).filter(i => i.sugerenciaQuitar).map(i => i.clave)))[0];

    // GESTO: tocar el círculo teñido de la fila
    await page.locator(`.pk-row[data-row="${clave}"] .pk-drop.sug`).click();
    await page.waitForTimeout(350);
    const d = await page.evaluate(k => {
      const it = Store.packingOf('t1').items[k];
      return { estado: it.estado, sug: !!it.sugerenciaQuitar };
    }, clave);
    assert(d.estado === 'descartado' && d.sug === false,
      '§4.4 · el círculo teñido descarta Y borra la propuesta');
    await page.close();
  });

  /* ═══════════════════════════════════════════════════════════
     Sólo lectura y caminos degradados
     ═══════════════════════════════════════════════════════════ */
  await test('24 · sólo lectura: se ven las señales, no hay una sola acción', async () => {
    const page = await nuevaPagina(browser, { sample: SAMPLE_QUITAR });
    await armarLista(page);
    await page.waitForTimeout(900);
    // aplicar un plan para tener ítems nuevos
    await page.evaluate(async (auto) => {
      await Store.saveItem('t1', auto);
      await checkPackingPlan(Store.trips.get('t1'));
    }, AUTO);
    await page.waitForTimeout(600);
    await page.evaluate(() => { const p = planDe('t1'); return Store.savePacking('t1', p.listaPropuesta); });
    await page.waitForTimeout(200);

    // ahora sí: sólo lectura
    await page.evaluate(async (auto) => {
      Store.canWrite = false;
      await checkPackingPlan(Store.trips.get('t1'));
    });
    await irAValija(page);
    await page.waitForTimeout(500);

    assert(await page.locator('.pk-row.is-new').count() > 0, '24 · los ítems nuevos siguen marcados');
    assert(await page.locator('.pk-row.is-new .pk-newtag').count() > 0, '24 · con su palabra "nuevo"');
    assert(await page.locator('.pk-drop').count() === 0, '24 · no hay botones de descartar');
    assert(await page.locator('.pk-drop.sug').count() === 0, '24 · ni círculos teñidos');
    assert(await page.locator('#pk-additem').count() === 0, '24 · no hay FAB de agregar');
    assert(await page.locator('[data-pk="verplan"]').count() === 0, '24 · el aviso no tiene "Ver qué agrego"');
    assert(await page.locator('[data-pk="ahorano"]').count() === 0, '24 · ni "Ahora no"');
    assert(await page.locator('#pkdock .pk-dock').count() === 0, '24 · no hay dock');

    const nuevosAntes = await page.evaluate(() =>
      Object.values(Store.packingOf('t1').items).filter(i => i.nuevo).length);
    // recorrer todo y salir: NO tiene que limpiar nada
    const filas = page.locator('.pk-row.is-new');
    for(let i = 0; i < await filas.count(); i++){
      await filas.nth(i).scrollIntoViewIfNeeded(); await page.waitForTimeout(750);
    }
    await page.goto(APP + '#/trip/t1'); await page.waitForTimeout(400);
    const nuevosDespues = await page.evaluate(() =>
      Object.values(Store.packingOf('t1').items).filter(i => i.nuevo).length);
    assert(nuevosDespues === nuevosAntes && nuevosAntes > 0,
      '24 · clearNewFlags NO corre sin permiso de escritura (' + nuevosAntes + ' -> ' + nuevosDespues + ')');

    await page.close();
  });

  await test('sin IA · planListUpdate sincrónico sigue detectando lo que corresponde', async () => {
    const page = await nuevaPagina(browser, { sample: null });
    await armarLista(page);
    await page.waitForTimeout(500);
    const cap = await page.evaluate(() => Store.packingOf('t1').capaInteligente.estado);
    assert(cap === 'no-disponible', 'sin claude.use("sample") la capa de IA queda no-disponible');
    // el aviso 1 gana sobre todo lo demás
    await irAValija(page);
    assert(await page.locator(sel.notice).count() === 1, '25 · un solo aviso también acá');
    assert(/No pude ajustarla/.test(await page.locator(sel.notice).innerText()), '08 · sin plan pendiente, el degradado es el que se muestra');

    await page.evaluate(async (auto) => {
      await Store.saveItem('t1', auto);
      await checkPackingPlan(Store.trips.get('t1'));
    }, AUTO);
    await page.waitForTimeout(500);
    const plan = await page.evaluate(() => {
      const p = planDe('t1');
      return p ? { n: p.nuevos.length, claves: p.nuevos.map(x => x.clave), res: p.nuevos.map(x => x.reserva) } : null;
    });
    assert(plan && plan.n > 0, 'sin IA el plan igual detecta lo del auto: ' + JSON.stringify(plan));
    assert(plan.res.some(r => r && /Europcar/.test(r)), 'y cita la reserva que lo motivó');
    // pero el aviso 08 sigue ganando al 15 según la tabla del estado 25
    await salirDeValija(page); await irAValija(page);
    const avisoConPlan = await page.locator(sel.notice).innerText();
    assert(await page.locator(sel.notice).count() === 1, '25 · sigue habiendo un solo aviso');
    assert(/el auto \(Europcar\)/.test(avisoConPlan),
      '25 · el plan gana al degradado: es puntual y accionable — ' + JSON.stringify(avisoConPlan));
    assert(await page.locator('#main [data-pk="verplan"]').count() === 1,
      '25 · y "Ver qué agrego" está disponible sin capa de IA');
    // resolver el plan devuelve el aviso degradado con su "Probar de nuevo"
    await page.locator('[data-pk="ahorano"]').first().click();
    await page.waitForTimeout(250);
    await salirDeValija(page); await irAValija(page);
    assert(/No pude ajustarla/.test(await page.locator(sel.notice).innerText()),
      '25 · aplazado el plan, vuelve el degradado');
    assert(await page.locator('#pk-retry').count() === 1, '25 · con su "Probar de nuevo"');
    await page.close();
  });

  await test('un ítem descartado no vuelve aunque el viaje crezca', async () => {
    const page = await nuevaPagina(browser, { sample: SAMPLE_OK });
    await armarLista(page);
    // descartar algo tocando el botón
    const fila = page.locator('.pk-row[data-row]').first();
    const clave = await fila.getAttribute('data-row');
    await fila.locator('.pk-drop').click();
    await page.waitForTimeout(200);
    await page.evaluate(async (auto) => {
      await Store.saveItem('t1', auto);
      await Store.saveItem('t1', { id:'i9', type:'act', title:'Trekking al cerro', start:'2026-10-09T08:00', notes:'' });
      await checkPackingPlan(Store.trips.get('t1'));
    }, AUTO);
    await page.waitForTimeout(500);
    const enPlan = await page.evaluate(k => {
      const p = planDe('t1');
      return p ? p.nuevos.some(n => n.clave === k) : false;
    }, clave);
    assert(!enPlan, 'lo descartado no aparece como nuevo en el plan');
    await salirDeValija(page); await irAValija(page);
    await page.locator('[data-pk="verplan"]').first().click(); await page.waitForTimeout(150);
    await page.locator('#pk-plan-apply').click(); await page.waitForTimeout(400);
    const estado = await page.evaluate(k => Store.packingOf('t1').items[k].estado, clave);
    assert(estado === 'descartado', 'después de aplicar el plan sigue descartado');
    await page.close();
  });

  await test('el plan se recalcula al ENTRAR a la valija: sobrevive a recargar la app', async () => {
    const page = await nuevaPagina(browser, { sample: SAMPLE_OK });
    await armarLista(page);
    // se carga el auto y se sale sin mirar la valija
    await page.evaluate(async (auto) => { await Store.saveItem('t1', auto); }, AUTO);
    await salirDeValija(page);
    assert(await page.evaluate(() => App.plan) === null, 'sin disparar nada, no hay plan en memoria');

    // RECARGA de verdad: App.plan se pierde
    await page.reload();
    await page.waitForFunction(() => typeof Store !== 'undefined' && Store.ready, null, { timeout: 15000 });
    await page.waitForTimeout(200);
    assert(await page.evaluate(() => App.plan) === null, 'después de recargar la memoria está vacía');

    // GESTO: entrar a la valija
    await page.goto(APP + '#/trip/t1/valija');
    await page.waitForFunction(() => !!planDe('t1'), null, { timeout: 8000 }).catch(()=>{});
    const diag = await page.evaluate(async () => {
      const list = Store.packingOf('t1'), trip = Store.trips.get('t1');
      const history = await Store.packingHistory('t1');
      const p = list && trip ? PackingEngine.planListUpdate({ list, trip, items: Store.itemsOf('t1'), tipoViaje: list.tipoViaje, history }) : null;
      return { view: App.view, recalc: [...PK_RECALC_HECHO], items: Store.itemsOf('t1').map(i=>i.type),
               hayLista: !!list, aMano: p ? p.nuevos.map(x=>x.clave) : null, appPlan: App.plan ? App.plan.nuevos.length : null };
    });
    log('    diag ' + JSON.stringify(diag));
    const n = await page.evaluate(() => { const p = planDe('t1'); return p ? p.nuevos.length : 0; });
    assert(n > 0, 'entrar a la valija recalcula el plan (' + n + ' nuevos)');
    assert(await page.locator('#main [data-pk="verplan"]').count() === 1, '15 · el aviso entra ARRIBA de la lista');
    assert(await page.locator('#pkdock .pk-dock').count() === 0, '15 · y no por el dock');
    assert((await page.locator(sel.notice).first().innerText()).includes('el auto (Europcar)'), '15 · nombra la reserva');

    // y el aplazamiento persiste entre recargas: aplazar, recargar, entrar
    await page.locator('[data-pk="ahorano"]').first().click();
    await page.waitForTimeout(250);
    await page.reload();
    await page.waitForFunction(() => typeof Store !== 'undefined' && Store.ready, null, { timeout: 15000 });
    await page.goto(APP + '#/trip/t1/valija');
    await page.waitForFunction(() => document.querySelectorAll('#main .pk-cat').length > 0, null, { timeout: 8000 }).catch(()=>{});
    await page.waitForTimeout(600);
    assert(await page.locator('#main [data-pk="ahorano"]').count() === 0,
      '§4.2 · el recálculo respeta el aplazamiento guardado en el dispositivo');
    await page.locator('#pk-info').click(); await page.waitForTimeout(200);
    assert(await page.locator('#pk-info-plan').count() === 1, '§4.2 · pero sigue a pedido en la hoja 12');
    await page.locator('#closeSheet').click();
    await page.close();
  });

  await test('el recálculo al entrar respeta lo suprimido por el historial', async () => {
    const page = await nuevaPagina(browser, { sample: SAMPLE_OK });
    await armarLista(page);
    const conHistorial = await page.evaluate(async (auto) => {
      await Store.saveItem('t1', auto);
      const list = Store.packingOf('t1');
      const history = await Store.packingHistory('t1');
      const conHist = PackingEngine.planListUpdate({ list, trip:Store.trips.get('t1'),
        items:Store.itemsOf('t1'), tipoViaje:list.tipoViaje, history });
      const sinHist = PackingEngine.planListUpdate({ list, trip:Store.trips.get('t1'),
        items:Store.itemsOf('t1'), tipoViaje:list.tipoViaje, history:[] });
      return { conHist:conHist.nuevos.map(n=>n.clave).sort(), sinHist:sinHist.nuevos.map(n=>n.clave).sort() };
    }, AUTO);
    // acá no hay historial cargado, así que dan igual; lo que se verifica es que
    // el recálculo de la app PASA el historial, no un array vacío
    const pasaHistorial = await page.evaluate(() => recalcularPlanAlEntrar.toString().includes('packingHistory'));
    assert(pasaHistorial, 'recalcularPlanAlEntrar lee el historial antes de comparar');
    assert(JSON.stringify(conHistorial.conHist) === JSON.stringify(conHistorial.sinHist),
      'en este viaje sin historial previo los dos caminos coinciden: ' + JSON.stringify(conHistorial.conHist));
    await page.close();
  });

  await test('la app funciona sin base de datos y sin IA de punta a punta', async () => {
    const page = await nuevaPagina(browser, { items: [] });
    assert(await page.evaluate(() => Store.mode) === 'local', 'modo local');
    assert(await page.evaluate(() => Store.db) === null, 'sin db');
    await armarLista(page);
    assert(await page.locator('.pk-row').count() > 0, 'la lista se arma igual');
    await page.goto(APP + '#/'); await page.waitForTimeout(150);
    assert(await page.locator('.tag-card, .vj-entry, .empty').count() > 0, 'el home renderiza');
    await page.close();
  });

  await browser.close();
  log('\n====================================================');
  log(`  ${ok} pasaron, ${fail} fallaron`);
  log('====================================================');
  /* Nada de `process.exit()` acá: con la salida por pantalla, cortar el
     proceso a mano puede truncar lo último que se escribió. Se deja el
     código de salida y el proceso termina solo cuando no queda nada
     pendiente; el temporizador suelto es la red por si algo quedó vivo. */
  process.exitCode = fail ? 1 : 0;
  setTimeout(() => process.exit(fail ? 1 : 0), 3000).unref();
})();
