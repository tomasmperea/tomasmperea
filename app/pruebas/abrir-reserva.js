"use strict";
/* VAL-70 · Desde la v47 tocar una reserva guardada abre una VISTA, y editar es
   tocar «Editar». Este ayudante hace los dos toques, como la persona. Si
   «Editar» no aparece (los controles corren versiones anteriores, donde la
   tarjeta abría el formulario directo), sigue sin él. */
async function abrirParaEditar(page, tarjeta) {
  await tarjeta.click();
  const editar = page.locator("#vr-editar");
  try { await editar.waitFor({ state:"visible", timeout:3000 }); } catch (e) { return; }
  await editar.click();
}
module.exports = { abrirParaEditar };
