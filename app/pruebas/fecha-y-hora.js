"use strict";
/* VAL-95 · Desde la v43 cada fecha de una reserva son DOS campos que ve la
   persona: el día (#i_start_dia) y la hora (el .fh-t de al lado). El
   `#i_start` que leían las pruebas sigue existiendo, pero oculto: escribir ahí
   saltea justamente el tramo que hay que probar. Este ayudante escribe donde
   escribe la persona.

   `id` es el del campo oculto de siempre ("i_start", "i_end"); `valor` es el
   de siempre ("2026-10-07T10:00"). */
async function llenarFechaHora(page, id, valor) {
  const [dia, hora] = String(valor).split("T");
  const d = page.locator(`#${id}_dia`);
  await d.fill(dia);
  await d.locator("xpath=..").locator(".fh-t").fill(hora || "");
}
/** Para las pruebas que llenan un mapa {id: valor}. */
async function llenarCampo(page, id, valor) {
  if (/^i_(start|end)$/.test(id)) return llenarFechaHora(page, id, valor);
  return page.locator("#" + id).fill(valor);
}
module.exports = { llenarFechaHora, llenarCampo };
