"use strict";
/* VAL-67 · Desde la v49 las categorías de la valija arrancan cerradas. Las
   pruebas escritas antes tocan filas que daban por visibles; este ayudante
   abre las categorías tocando su encabezado, como la persona, antes de que
   la prueba siga con lo suyo. En las versiones anteriores (los controles) ya
   están abiertas y no toca nada. Sólo se llama al llegar a la valija o
   después de armarla: lo que la persona abre queda abierto mientras no se
   recargue la página. */
async function abrirCategorias(page) {
  for (let i = 0; i < 12; i++) {
    const cerrada = page.locator('.pk-cat[data-open="false"] .pk-cat-hd').first();
    if (!(await cerrada.count())) return;
    await cerrada.click();
    await page.waitForTimeout(120);
  }
}
module.exports = { abrirCategorias };
