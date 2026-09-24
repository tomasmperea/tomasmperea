# v35 — el resultado de la ronda del PM

**Fecha:** 24/09/2026 · **Build:** v35, Artifact Versión 29 · **Historias:** VAL-76 y VAL-77a

**Resultado textual del PM:** *"todo el guión funciona correctamente"*.

Los cinco pasos de `docs/qa/v35-guion.md`, en su teléfono:

| | Qué contestaba | Resultado |
|---|---|---|
| 1 | El renglón propio del tipo se ve, y la lista sigue entrando | OK |
| 2 | El botón se abre al primer toque, con el pulgar y sin apuntar | OK |
| 3 | Dos se marcan, la tercera no hace nada y no desaparece, se destilda | OK |
| 4 | Los números de qué se conserva coinciden, y entran ítems de los dos tipos | OK |
| 5 | Tema oscuro explícito, y una valija vieja que dice «mixto» | OK |

## Qué cierra esto, exactamente

**El paso 2 es el que no se podía contestar de ninguna otra forma.** El área táctil del botón del tipo se
amplía por debajo del borde visible con un pseudo-elemento; acá se midió la caja visible (91×28 px) y quedó
declarado que el área efectiva sólo la mide un dedo. La mide, y anda.

**El paso 5 cerró las dos brechas de tema** que la entrega declaró: el tercer estado del botón (elección
explícita, no preferencia del sistema) no se había mirado en pantalla, y los dos temas se habían visto en
capturas de Chromium y no en un aparato.

**El paso 4 confirmó lo que ninguna prueba de acá puede confirmar del todo:** que con dos tipos marcados la
lista trae ítems de los dos. Los arneses lo verifican por clave sobre el documento guardado; el PM lo
verificó leyendo la lista en pantalla.

## La auditoría, y por qué no se vuelve a correr

La auditoría del 23/09 (`docs/auditoria/2026-09-23-val76-val77a.md`) puntuó **81/100 — candidato**, sin
bloqueantes de los cuatro que frenan una publicación. Nombró dos cosas como la distancia hasta 85:

1. **Dimensión 1, el entorno real** (20/30) — *"nada probado en el entorno real todavía"*. **Cerrada por esta
   ronda.**
2. **Un hueco de honestidad** (11/15) — la entrega no declaraba explícitamente "esto es candidato, falta el
   teléfono" ni mencionaba el sello sin subir. **Cerradas las dos**: el sello subió a 35 en el commit que se
   publicó, y la brecha quedó declarada en el guion y en la entrega al PM.

No se vuelve a auditar. La regla del 22/09 es explícita: **una auditoría por entrega, no una cadena** —
lo que infló VAL-72 a dieciséis rondas fue que cada confirmación era una auditoría completa nueva. No hubo
bloqueantes que arreglar, así que no hay delta de código que confirmar: lo que faltaba era el aparato, y el
aparato contestó.

## VAL-76 y VAL-77a quedan TERMINADAS

Con la definición del proyecto: criterios de aceptación cumplidos, funcionando en un teléfono, e igual en
tema claro y oscuro.

**Lo que sigue sin estar probado, y se dice:** el conteo de viajes por combinación se ejercitó con
historiales fabricados, no con viajes guardados de verdad. Aparece recién cuando el PM tenga dos viajes de la
misma combinación, y no bloquea nada.
