/* Los dos hallazgos de docs/qa/valija-bloque-b.md, reproducidos con los mismos
   gestos que usó QA: se toca el control, nunca se dispara el evento interno. */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const APP = 'file://' + path.resolve(__dirname, '..', 'valija.html');
const LOG = require('path').join(require('os').tmpdir(), 'valija-qa.log');
try{ fs.unlinkSync(LOG); }catch(e){}
const log = m => { try{ fs.appendFileSync(LOG, m + '\n'); }catch(e){} };
let ok = 0, fail = 0;
const A = (c, m) => { if(c){ ok++; log('  ok   ' + m); } else { fail++; log('  FALLA ' + m); } };
async function test(n, fn){ log('\n· ' + n); try{ await fn(); }catch(e){ fail++; log('  FALLA (excepción) ' + e.message); log(e.stack); } }

const TRIP = { id:'t1', name:'Vacaciones', destination:'Madrid', startDate:'2026-10-05', endDate:'2026-10-15', hue:214 };
const VUELO = { id:'i1', type:'flight', title:'Vuelo a Madrid', start:'2026-10-05T22:00', end:'2026-10-06T14:00', from:'EZE', to:'MAD' };
const SAMPLE_OK = { items:[], quitar:[], clima:'Octubre en Madrid: entre 12 y 22 grados.' };

async function abrir(browser, { sample = null } = {}){
  const page = await browser.newPage({ viewport:{ width:390, height:800 } });
  page.on('pageerror', e => { log('  !! pageerror: ' + e.message); fail++; });
  await page.addInitScript(({ sample, trip, vuelo }) => {
    window.__S__ = sample;
    window.claude = { use: async k => (k === 'sample' && window.__S__) ? { json: async () => window.__S__ } : null };
    try{
      if(!localStorage.getItem('valija.v1')) localStorage.setItem('valija.v1',
        JSON.stringify({ trips:[trip], items:{ t1:[vuelo] }, packing:{} }));
    }catch(e){}
  }, { sample, trip:TRIP, vuelo:VUELO });
  await page.goto(APP);
  await page.waitForFunction(() => typeof Store !== 'undefined' && Store.ready, null, { timeout:15000 });
  return page;
}
const irValija = async page => {
  if(!page.url().endsWith('#/trip/t1/valija')) await page.goto(APP + '#/trip/t1/valija');
  await page.waitForTimeout(200);
};
const salirValija = async page => { await page.goto(APP + '#/trip/t1'); await page.waitForTimeout(250); };

/** Arma la lista tocando "Armar la lista", con el tipo que se pida. */
async function armar(page, tipo){
  await irValija(page);
  if(tipo) await page.locator(`#pk-tp [data-t="${tipo}"]`).click();
  await page.locator('#pk-build').click();
  await page.waitForTimeout(1100);
}
/** Carga el auto llenando el formulario real de reserva. */
async function cargarAuto(page, proveedor){
  await salirValija(page);
  await page.locator('#additem').click();
  await page.waitForTimeout(150);
  await page.locator('#tp button[data-t="car"]').click();
  await page.fill('#i_title', 'Auto en Madrid');
  await page.fill('#i_start', '2026-10-07T10:00');
  await page.fill('#i_end', '2026-10-12T10:00');
  await page.fill('#i_provider', proveedor || 'Europcar');
  await page.locator('#save').click();
  await page.waitForTimeout(1200);
}
const claves = page => page.evaluate(() => Object.keys(Store.packingOf('t1').items).sort());
const tipoDe = page => page.evaluate(() => Store.packingOf('t1').tipoViaje);

(async () => {
  const browser = await chromium.launch();

  /* ═════════════ H1 · bloqueante ═════════════ */
  await test('H1 · cambiar el tipo de viaje con el aviso pendiente no puede perder nada', async () => {
    const page = await abrir(browser, { sample: SAMPLE_OK });
    await armar(page, 'ciudad');
    const ciudad = await claves(page);
    A(await tipoDe(page) === 'ciudad', 'la lista se armó como Ciudad (' + ciudad.length + ' ítems)');

    await cargarAuto(page);
    await irValija(page);
    A(await page.locator('#main [data-pk="verplan"]').count() === 1, 'paso 3 · el aviso está, sin tocarlo');
    await page.evaluate(() => { window.__PLANVIEJO__ = App.plan; });   // la foto que QA vio aplicarse

    // paso 4: cambiar el tipo a Playa, con los gestos reales
    await page.locator('#pk-info').click(); await page.waitForTimeout(200);
    await page.locator('#pk-changetype').click(); await page.waitForTimeout(300);
    await page.locator('#pk-tp [data-t="playa"]').click();
    await page.locator('#pk-confirmtype').click();
    await page.waitForTimeout(1400);
    const playa = await claves(page);
    A(await tipoDe(page) === 'playa', 'paso 4 · la lista se regeneró como Playa (' + playa.length + ' ítems)');
    const soloPlaya = playa.filter(k => !ciudad.includes(k));
    A(soloPlaya.length > 0, 'paso 4 · aparecieron ítems propios de playa: ' + soloPlaya.join(', '));

    // paso 5: el aviso viejo NO debe seguir ahí (capa 1)
    A(await page.locator('#main [data-pk="verplan"]').count() === 0 || await page.evaluate(() => App.planDesde !== null),
      'paso 5 · el aviso viejo no sobrevive a la regeneración tal cual estaba');
    A(await page.evaluate(() => App.plan === null || App.planDesde !== null),
      'capa 1 · App.plan quedó invalidado o revalidable');

    // El recálculo al entrar mira contra la lista de Playa: como la regeneración
    // ya incorporó lo del auto, no queda nada que ofrecer y el aviso no vuelve.
    // Eso cierra el camino por gesto: ya no hay ningún botón que aplique la foto vieja.
    await salirValija(page); await irValija(page);
    await page.waitForTimeout(900);
    A(await page.locator('#main [data-pk="verplan"]').count() === 0,
      'capa 1 · no queda ningún botón que aplique el plan viejo');
    A(playa.includes('licencia-de-conducir'),
      'y no hace falta: la regeneración ya incorporó lo del auto');

    // paso 6, el peor caso: se aplica a mano la MISMA foto que QA vio aplicarse.
    // No hay gesto que llegue acá; es el piso que cubre los caminos que no
    // podemos enumerar. Nada de Playa se puede perder ni el tipo volver atrás.
    await page.evaluate(() => aplicarPlan(Store.trips.get('t1'), window.__PLANVIEJO__));
    await page.waitForTimeout(2500);
    const despues = await claves(page);
    A(await tipoDe(page) === 'playa', 'paso 6 · el tipo de viaje SIGUE siendo Playa');
    const perdidos = playa.filter(k => !despues.includes(k));
    A(perdidos.length === 0, 'paso 6 · no se perdió ni un ítem de la lista de Playa' + (perdidos.length ? ' — perdidos: ' + perdidos.join(', ') : ''));
    A(despues.includes('licencia-de-conducir'), 'paso 6 · y lo del auto sigue ahí');
    const t = await page.locator('#toast .toast').innerText().catch(()=> '');
    A(!/Sumé/.test(t), 'paso 6 · no se muestra un cartel de éxito falso — ' + JSON.stringify(t));
    await page.close();
  });

  await test('H1 · aplicar un plan calculado antes de "Rehacer la lista" no pisa la regeneración', async () => {
    const page = await abrir(browser, { sample: SAMPLE_OK });
    await armar(page, 'ciudad');
    await cargarAuto(page);
    await irValija(page);
    A(await page.locator('#main [data-pk="verplan"]').count() === 1, 'hay un plan ofrecido');

    // se guarda una referencia al plan viejo ANTES de rehacer, y se fuerza el
    // camino peor: aplicar ese objeto exacto después de regenerar
    await page.evaluate(() => { window.__PLANVIEJO__ = App.plan; });
    await page.locator('#pk-info').click(); await page.waitForTimeout(200);
    await page.locator('#pk-redo').click();
    await page.waitForTimeout(1600);
    const trasRehacer = await claves(page);

    // se agrega un ítem propio DESPUÉS de rehacer: si el set a ciegas ocurriera,
    // este ítem desaparecería
    await page.locator('#pk-additem').click(); await page.waitForTimeout(150);
    await page.fill('#pk_new_nombre', 'Cargador del reloj');
    await page.locator('#save').click(); await page.waitForTimeout(400);
    A((await claves(page)).includes('cargador-del-reloj'), 'se agregó un ítem propio después de rehacer');

    // ahora sí: aplicar el plan VIEJO a mano, el peor caso posible
    await page.evaluate(() => aplicarPlan(Store.trips.get('t1'), window.__PLANVIEJO__));
    await page.waitForTimeout(2200);
    const despues = await claves(page);
    A(despues.includes('cargador-del-reloj'), 'capa 2 · el ítem propio sobrevivió a aplicar el plan viejo');
    const perdidos = trasRehacer.filter(k => !despues.includes(k));
    A(perdidos.length === 0, 'capa 2 · no se perdió nada de la lista rehecha' + (perdidos.length ? ' — ' + perdidos.join(', ') : ''));
    await page.close();
  });

  await test('H1 · si lo que se ofrece cambió, no se escribe: se muestra el plan actualizado', async () => {
    const page = await abrir(browser, { sample: SAMPLE_OK });
    await armar(page, 'ciudad');
    await cargarAuto(page);
    await irValija(page);
    await page.evaluate(() => { window.__PLANVIEJO__ = App.plan; });
    const antes = await claves(page);

    // se aplica el plan de verdad, tocando el botón
    await page.locator('#main [data-pk="verplan"]').click(); await page.waitForTimeout(300);
    await page.locator('#pk-plan-apply').click(); await page.waitForTimeout(1600);
    const conAuto = await claves(page);
    A(conAuto.length > antes.length, 'el plan se aplicó (' + antes.length + ' -> ' + conAuto.length + ')');

    // y ahora se intenta aplicar OTRA VEZ el mismo plan viejo: ya no hay nada
    // que sumar, así que no se puede escribir nada
    await page.evaluate(() => aplicarPlan(Store.trips.get('t1'), window.__PLANVIEJO__));
    await page.waitForTimeout(2200);
    const despues = await claves(page);
    A(JSON.stringify(despues) === JSON.stringify(conAuto), 'aplicar dos veces el mismo plan no cambia nada');
    const t = await page.locator('#toast .toast').innerText().catch(()=> '');
    A(/al día/.test(t), 'y lo dice en vez de mentir un éxito — ' + JSON.stringify(t));
    await page.close();
  });

  await test('H1 · la huella detecta un cambio que no pasó por ningún camino nuestro', async () => {
    const page = await abrir(browser, { sample: SAMPLE_OK });
    await armar(page, 'ciudad');
    await cargarAuto(page);
    await irValija(page);
    // se simula lo que haría el snapshot de otra persona del viaje: la lista
    // guardada cambia sin que ninguna función de la app la haya tocado
    const cambio = await page.evaluate(() => {
      const l = JSON.parse(JSON.stringify(Store.packingOf('t1')));
      l.items['mate-y-termo'] = { clave:'mate-y-termo', nombre:'Mate y termo', categoria:'otros',
        cantidad:null, motivo:'Lo puso otra persona del viaje.', origen:'manual', estado:'pendiente',
        empacadoEn:null, cantidadEditada:false, nota:'', orden:9999,
        agregadoEn:new Date().toISOString(), actualizadoEn:new Date().toISOString() };
      Store.packing.set('t1', l);
      const igual = App.planDesde === firmaEstable(Store.packingOf('t1'));
      Store.emit();
      return igual;
    });
    A(cambio === false, 'la huella ya no coincide con la lista guardada');

    await page.locator('#main [data-pk="verplan"]').click().catch(()=>{});
    await page.waitForTimeout(300);
    if(await page.locator('#pk-plan-apply').count()){
      await page.locator('#pk-plan-apply').click();
      await page.waitForTimeout(2200);
    }
    const despues = await claves(page);
    A(despues.includes('mate-y-termo'), 'el ítem de la otra persona sobrevivió a aplicar el plan');
    A(despues.includes('licencia-de-conducir'), 'y lo del auto se sumó igual');
    await page.close();
  });

  /* ═════════════ H2 · importante ═════════════ */
  await test('H2 · una categoría plegada a mano no se reabre sola', async () => {
    const page = await abrir(browser, { sample: SAMPLE_OK });
    await armar(page, 'ciudad');
    // paso 2: plegar "Documentación" tocando su encabezado
    await page.locator('.pk-cat-hd[data-cat="documentacion"]').click();
    await page.waitForTimeout(250);
    A(await page.locator('.pk-cat', { has: page.locator('[data-cat="documentacion"]') }).getAttribute('data-open') === 'false',
      'paso 2 · la categoría quedó plegada (data-open="false")');

    await cargarAuto(page);
    await irValija(page);
    await page.locator('#main [data-pk="verplan"]').click(); await page.waitForTimeout(300);
    await page.locator('#pk-plan-apply').click(); await page.waitForTimeout(1600);

    const cat = page.locator('.pk-cat', { has: page.locator('[data-cat="documentacion"]') });
    A(await cat.getAttribute('data-open') === 'false', 'paso 5 · sigue plegada: el gesto de la persona manda');
    A((await cat.locator('.pk-cat-hd .cnt').innerText()).includes('nuevos'), 'paso 5 · el chip "N nuevos" se ve igual, plegada');
    A(await page.locator('.pk-cat-hd[data-newclaves]').count() === 1, 'el encabezado declara qué ítems tapa');
    await page.close();
  });

  await test('H2 · el chip visible de una categoría plegada cuenta como haberlos visto', async () => {
    const page = await abrir(browser, { sample: SAMPLE_OK });
    await armar(page, 'ciudad');
    await page.locator('.pk-cat-hd[data-cat="documentacion"]').click();
    await page.waitForTimeout(250);
    await cargarAuto(page);
    await irValija(page);
    await page.locator('#main [data-pk="verplan"]').click(); await page.waitForTimeout(300);
    await page.locator('#pk-plan-apply').click(); await page.waitForTimeout(1600);

    const marcados = await page.evaluate(() => Object.values(Store.packingOf('t1').items).filter(i => i.nuevo).length);
    A(marcados > 0, 'quedaron ' + marcados + ' ítems marcados, tapados por la categoría plegada');
    A(await page.locator('.pk-row.is-new').count() > 0 &&
      await page.evaluate(() => [...document.querySelectorAll('.pk-row.is-new')].every(r => r.offsetParent === null)),
      'sus filas están en el DOM pero ocultas: nunca podrían intersectar');

    // GESTO: dejar el encabezado con su chip a la vista el tiempo de permanencia
    await page.locator('.pk-cat-hd[data-newclaves]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
    const vistos = await page.evaluate(() => [...PK.seenNew]);
    A(vistos.length === marcados, 'el chip a la vista dio por vistos los ' + marcados + ' ítems: ' + vistos.join(', '));

    // al salir de la pantalla, las marcas se limpian
    await salirValija(page);
    await page.waitForTimeout(400);
    const quedan = await page.evaluate(() => Object.values(Store.packingOf('t1').items).filter(i => i.nuevo).length);
    A(quedan === 0, 'al salir, la marca se limpió (' + quedan + ') — ya no queda atrapada');
    await page.close();
  });

  await test('H2 · el encabezado NO cuenta cuando la categoría está abierta', async () => {
    const page = await abrir(browser, { sample: SAMPLE_OK });
    await armar(page, 'ciudad');
    await cargarAuto(page);
    await irValija(page);
    await page.locator('#main [data-pk="verplan"]').click(); await page.waitForTimeout(300);
    await page.locator('#pk-plan-apply').click(); await page.waitForTimeout(1600);
    A(await page.locator('.pk-cat-hd[data-newclaves]').count() === 0,
      'con la categoría abierta no hay atajo: se cuentan las filas, una por una');
    await page.close();
  });

  await browser.close();
  log(`\n====================================================\n  ${ok} pasaron, ${fail} fallaron\n====================================================`);
  process.exit(fail ? 1 : 0);
})();
