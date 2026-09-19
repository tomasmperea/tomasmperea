# Re-auditoría VAL-74, tercera ronda

**Commit auditado:** `3351b55372a1b7398af21af44bb5e43010ee2457` · **Árbol:** limpio (`git status --porcelain`
vacío, antes y después) · **Publicado:** no.

## Veredicto: CANDIDATO — 81/100, con una condición concreta antes de publicar

Baja de 84 a 81. No porque el arreglo que pedían esté mal — **está genuinamente bien, lo verifiqué
independientemente y cierra exactamente lo que decía cerrar** — sino porque seguí buscando, como pedían, y
encontré **otra instancia de la misma familia**: un campo que `pesoGuardadoDeItem` sigue sin medir de
verdad, y que en un caso extremo sí cruza el tope. Es más chico y más raro que el de la ronda anterior, pero
es del mismo tipo, y es verificable acá — así que, por la misma regla que usé en la ronda 1 y la ronda 2, no
lo puedo dejar pasar sin decirlo.

**No bajo el veredicto a NO PUBLICAR.** El disparador es mucho menos plausible que los de las rondas
anteriores (necesita que el modelo devuelva una cantidad de veinte dígitos, no una frase larga ni muchos
ítems chicos, que son cosas que un modelo realmente hace). Pero es una condición, no una sugerencia: antes de
publicar como candidato, cerrarían este último cabo de la misma forma que ya cerraron el anterior.

---

## Lo que verifiqué del arreglo que pedían

**El sesgo de `regla`/`orden` desapareció, no se compensó — confirmado, no sólo repetido.** Reproduje el
caso adversarial de la ronda 2 (5.000 propuestos de motivo mínimo) contra el código nuevo:

```
5000 chicos → 835 ítems · 253.790 bytes · margen 8.354   (arnés, corrido por mí)
5000 mínimos, mi propio script → 815 ítems · 253.855 bytes · margen 8.289
```

El margen real quedó prácticamente igual al nominal (8.192), que es lo que tiene que pasar cuando ya no hay
un sesgo sistemático comiéndoselo en silencio. Antes de este commit, el mismo experimento daba 6.704 bytes
de margen real contra 8.192 nominales — un 18% ya perdido antes de admitir el primer ítem. Ahora no.

**La forma de arreglarlo es la correcta, y mejor que un parche puntual.** `pesoGuardadoDeItem` ya no
reconstruye a mano una copia "parecida" del ítem: llama a la misma `makeItem()` que arma el ítem real, con
los mismos valores (`origen:ORIGEN.DESTINO`, `regla:"destino"`, y el `orden` calculado con el mismo
`orderOf(categoria, 800 + items.length)` que va a tener el ítem cuando se agregue de verdad). Comparé los dos
call-sites campo por campo: coinciden. Esto no es un ajuste de números — es estructural: mientras alguien
llame a `makeItem` para construir el ítem real y a `pesoGuardadoDeItem` (que ahora también llama a
`makeItem`) para medirlo, no pueden volver a desincronizarse por accidente. Es la clase de arreglo que
previene la categoría de bug, no sólo la instancia.

**El off-by-one y el recorte 80/280 siguen bien** — no los tocó este commit, y los volví a correr en los
bordes: sin cambios, siguen correctos.

**Las dos copias del motor siguen idénticas** — comparación byte a byte, de nuevo.

**Arneses corridos, sin regresión:** `val74-sin-tope-de-ocho` (32/32, incluye el caso nuevo del enjambre),
`motores-desde-html` (39/39), `valija-bloque-b` (111/111).

---

## Lo que encontré buscando el caso peor de nuevo

El pedido era explícito: "que no haya quedado otra estimación escondida […] no me alcanza con que pase el
que vos ya encontraste." Miré `pesoGuardadoDeItem` campo por campo contra lo que `makeItem` realmente
escribe, y quedó uno:

```js
function pesoGuardadoDeItem(clave, nombre, motivo, categoria, orden) {
  return bytesSerializados(makeItem({
    clave: clave, nombre: nombre, categoria: categoria, cantidad: null,   // ← siempre null
    motivo: motivo, origen: ORIGEN.DESTINO, regla: "destino",
    orden: orden == null ? orderOf(categoria, 800) : orden
  }, "2026-01-01T00:00:00.000Z")) + bytesUtf8(clave) + 4;
}
```

`cantidad` sigue hardcodeado en `null`, pero el ítem real puede tener un número: `parseDestinationItems`
calcula `cantidad = (typeof x.cantidad === "number" && isFinite(x.cantidad) && x.cantidad > 0) ?
Math.round(x.cantidad) : null` **sin ningún techo superior**, y `enrichWithDestination` lo guarda tal cual
(`cantidad:x.cantidad`, línea 3165 de `app/valija.html`). A diferencia de `nombre` y `motivo`, que ahora
pasan por `recortar()`, `cantidad` no tiene ningún tope — ni de medida, ni de plausibilidad.

Para un número de pocos dígitos esto no importa: `"cantidad":null` (15 bytes) pesa más que `"cantidad":3`
(12 bytes), así que el error va para el lado seguro. Probé con un valor que un modelo suelto podría llegar a
escribir (no un valor imposible, un número de más dígitos de los que tiene sentido para una cantidad de
equipaje):

```
5000 propuestos, motivo mínimo, cantidad:99999999999999999999 (20 dígitos)
→ 815 ítems admitidos · 267.710 bytes · tope 262.144 · SE PASA por 5.566 bytes
```

Reproducible con el mismo método que usé en las dos rondas anteriores (motor extraído de `app/valija.html`,
script en el scratchpad de esta sesión). Con la misma cantidad de ítems y motivo mínimo pero SIN el campo
`cantidad` (caso A de esta misma corrida), el resultado da 253.855 bytes, bien adentro del tope — la única
diferencia es ese campo.

**Es más raro que los hallazgos anteriores, y lo digo con precisión, no para minimizarlo.** Una frase con
acentos (ronda 1) o muchos ítems chicos (ronda 2) son cosas que un modelo normal hace todo el tiempo. Un
número de veinte dígitos como cantidad de un ítem de equipaje es un valor que ya no tiene sentido de
producto —nadie lleva "99999999999999999999" pares de medias— así que además de ser una brecha de tamaño es
una brecha de plausibilidad que ni siquiera se está filtrando. Pero **es del mismo linaje que los otros
tres** que ya nombraron en el commit ("el número correcto es el que incluye lo que se agrega después"):
`cantidad` es otro campo que se agrega después y que la medición sigue sin contar.

**A favor de esta entrega:** el comentario de `pesoGuardadoDeItem` no miente sobre esto — dice explícitamente
qué campos usa valores reales (`origen`, `regla`, `orden`) y no incluye `cantidad` en esa lista ni afirma que
está cubierto. No es una afirmación falsa, como sí lo fue "se arma la forma final y se mide" en la ronda 2:
es una cobertura incompleta, declarada implícitamente por omisión, no una promesa rota. Eso pesa a favor en
la dimensión de honestidad, aunque no cambia que el defecto es real y cruza el tope.

**Arreglo sugerido, mismo patrón que el de esta ronda:** pasarle a `pesoGuardadoDeItem` la `cantidad` real
(igual que ahora se le pasa `orden`), y además ponerle un techo de plausibilidad en `parseDestinationItems`
—algo como `Math.min(Math.round(x.cantidad), 99)`— que es defensa en profundidad además de la medición
correcta: una "cantidad" de equipaje de tres dígitos ya no tiene sentido en la interfaz, tenga o no espacio
en el documento.

---

## Tabla de las seis dimensiones

| # | Dimensión | Peso | Puntaje | Por qué |
|---|---|---|---|---|
| 1 | Verificación en el entorno real | 30 | **21** | El arreglo pedido está verificado y funciona: reproduje el caso adversarial de la ronda 2 contra el código nuevo y el margen volvió a ser un margen. Pero seguí buscando —como pedían explícitamente— y encontré otra instancia verificable acá (no en el teléfono) que sí cruza el tope. No es un hallazgo del entorno real: es un hallazgo de Node, con el mismo método que ya venía usando, y eso es justo lo que la dimensión 1 pesa el doble por prevenir. |
| 2 | Diagnóstico de causa raíz | 15 | **13** | El diagnóstico y el arreglo de `regla`/`orden` son ejemplares: no sólo corrigen los dos valores, corrigen la CLASE de error llamando a la función real en vez de copiarla. Eso es tratar la causa, no el síntoma. Pero la generalización — "¿qué otros campos del ítem final no estoy midiendo?" — se quedó corta en `cantidad`, que es exactamente la pregunta que la ronda 2 dejó planteada. |
| 3 | Honestidad de lo verificado | 15 | **14** | El commit es preciso y verificable en cada número que cita (8.354 bytes de margen, coincide con lo que yo medí). El comentario nuevo no promete cubrir `cantidad` y no lo cubre — no hay una afirmación falsa, sólo una cobertura incompleta no señalada. Sube un punto respecto de la ronda 2 por eso mismo: ya no hay ningún comentario que diga "se mide" sobre algo que no se mide. |
| 4 | Cumplimiento del contrato | 15 | **12** | Cumple al 100% lo que la ronda 2 pidió como único punto pendiente. No cumple todavía el pedido explícito de esta ronda de "que no haya quedado otra estimación escondida" — quedó una, la encontré yo, no la entrega. |
| 5 | Calidad interna | 15 | **13** | La solución reduce deuda técnica real (una sola fuente de verdad para la forma del ítem, `makeItem`, usada tanto para construir como para medir) y el arnés incorporó el caso adversarial que expuso el problema. `cantidad` es el único campo del ítem que sigue sin ese tratamiento — una asimetría fácil de ver una vez que se sabe qué mirar. |
| 6 | Diseño y decisiones de producto | 9 | **9 (sobre 10)** | Llamar a `makeItem` en vez de copiar campos es la decisión de diseño correcta y la explican bien. Estoy de acuerdo con no correr `lote-modelo-real.js` en este commit — ver la sección de abajo. |
| | **Total** | **100** | **81** | **CANDIDATO**, con la condición de cerrar el punto de `cantidad` antes de publicar — es chico, del mismo patrón que el que acaban de cerrar bien, y verificable acá sin esperar al teléfono. |

---

## Sobre la pregunta directa: ¿me equivoco al no correr `lote-modelo-real.js` esta ronda?

No, coincido con la decisión. Dos razones, no una:

1. La que ya dieron: el modelo de `lote-modelo-real.js` no es el del teléfono del PM, y un número mal
   etiquetado da más falsa confianza que ningún número. Ya está caveado así en el propio proyecto
   (`docs/briefs/adjuntar.md`: "sigue sin probarse que el modelo del visor del teléfono conteste igual —
   es otro modelo").
2. La que agrego yo: en esta ronda apareció un hallazgo verificable acá (`cantidad`) que todavía no está
   cerrado. Tiene más valor cerrar eso primero —es gratis, no depende de ningún modelo— que gastar el
   esfuerzo de esta ronda en un dato parcial que de todos modos no iba a mover el puntaje de "candidato" a
   "terminado". El momento de considerar `lote-modelo-real.js` como señal parcial es más cerca de publicar
   de verdad, cuando ya no queden hallazgos verificables acá por delante.

---

## Afirmaciones verificadas en esta ronda

| Afirmación | Verificación | Resultado |
|---|---|---|
| "5.000 propuestos de motivo mínimo entran 835 y quedan 8.354 bytes de margen" | Corrí `val74-sin-tope-de-ocho.js` | **Cierto**, exacto |
| "El sesgo desapareció, no se compensó" | Reproduje el mismo experimento con mi propio script, fuera del arnés | **Cierto**: margen real ≈ margen nominal, sin el défice de ~6.700 bytes que había antes |
| "`pesoGuardadoDeItem` ahora llama a `makeItem` con los mismos valores que la capa de IA" | Comparé campo por campo los dos call-sites (`packing-engine.js` y `app/valija.html`) | **Cierto** para `origen`, `regla`, `orden`. **No cierto** para `cantidad`, que sigue hardcodeado en `null` mientras el ítem real puede llevar un número sin techo |
| "No hay otra estimación escondida" | Construí el caso adversarial con `cantidad` de 20 dígitos | **Falso**: 267.710 bytes contra un tope de 262.144 — se pasa por 5.566 bytes |
| Las dos copias del motor siguen idénticas | Diff byte a byte | **Cierto** |
| "12 arneses en verde" (siguen sin romperse) | Corrí `motores-desde-html` (39/39) y `valija-bloque-b` (111/111) además de `val74-sin-tope-de-ocho` (32/32) | **Cierto**, sin regresión |

---

## Lo que falta para llegar a 85

Uno solo, de nuevo, y con la solución ya escrita en este mismo commit como plantilla:

1. **Pasarle a `pesoGuardadoDeItem` la `cantidad` real**, igual que ya se le pasa `orden`, y considerar un
   techo de plausibilidad para `cantidad` en `parseDestinationItems` (por ejemplo, capar a dos dígitos) —
   no sólo por el presupuesto de bytes, sino porque una cantidad de equipaje de veinte dígitos no tiene
   sentido en ningún lugar de la interfaz, tenga o no espacio en el documento.

## Lo que nadie puede verificar desde acá

No cambió respecto de las rondas anteriores, y sigue sin estar vacío:

1. **Cuántos ítems y de qué largo devuelve el modelo real del teléfono del PM.** Ya está declarado en el
   backlog con criterio concreto. Coincido con no forzarlo con `lote-modelo-real.js` en esta ronda.
2. **Si algún modelo real llega a devolver alguna vez una `cantidad` fuera de rango plausible.** Es
   exactamente el tipo de cosa que sólo se sabe con el modelo real — pero, a diferencia del punto 1, el
   arreglo del lado de la app no necesita esperar a esa evidencia: cerrar el punto de arriba no depende de
   saber si el modelo lo hace o no, de la misma forma que capar `motivo` a 280 caracteres no dependió de
   medir primero cuántos caracteres escribe el modelo.
