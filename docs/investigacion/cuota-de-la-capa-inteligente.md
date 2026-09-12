# La cuota de la capa inteligente: ¿hay que preocuparse?

**Pedido por:** el PM, después de que un PDF fallara con "Demasiados pedidos seguidos"
**Fecha:** 12 de septiembre de 2026
**Fuente:** el contrato de la plataforma, `artifact-capabilities` 0.2.41, `sample.d.ts`.
Todo lo que sigue está citado de ahí, no inferido.

---

## La respuesta corta

**No para el crecimiento de la app. Sí para vos mientras seas el único que la prueba.**

Y hay desperdicio nuestro que sí conviene arreglar, independientemente de todo esto.

---

## 1 · Quién paga

> *"A call that reaches Claude spends the VIEWER's own Claude usage."*

**Cada persona que abre la app gasta su propia cuota, no la del dueño.** Si mañana la
usan veinte personas, no se acumula nada sobre el PM: son veinte cuotas distintas.

Esto es lo que contesta la pregunta de fondo: **la cuota no es un techo al crecimiento
de la app.** Es un techo por persona, y se reparte solo.

Consecuencia de diseño: la primera llamada le pide permiso al visitante, y si dice que
no, queda rechazada para toda la visita. Ya está manejado.

## 2 · Qué significa exactamente el error que vio el PM

`rate_limited`, tres causas posibles, textual:

> *"too many calls (a flood from this page beyond the few that wait their turn;
> **another open copy of this artifact using the viewer's slots**), too often, or
> **the viewer's own usage limit** (which can also end an answer part-way)."*

De las tres:

1. **Inundación desde la página.** No es nuestro caso: se llama una vez por archivo, a
   partir de un toque explícito. Nunca desde un bucle ni desde un temporizador.
2. **Otra copia del mismo artifact abierta, usando los cupos del visitante.** Ésta es
   verificable y probable: en la captura del PM se ven **78 pestañas abiertas**. Si hay
   más de una copia de la app abierta, compiten por sus cupos.
3. **El límite de uso propio del visitante.** Lo más probable de las tres ese día: la
   sesión de desarrollo consumió la cuota de la cuenta varias veces hasta agotarla
   durante la jornada.

**La causa 3 fue nuestra, no de la app.** La 2 se descarta cerrando pestañas.

## 3 · Lo que sí es desperdicio nuestro

Acá está lo accionable, y no depende de ninguna cuota ajena.

### 3.1 Pedimos el modelo más caro para una tarea que no lo necesita

Las tres llamadas de la app usan `modelTier:"complex"`. El contrato lo describe así:

> *`"complex"`: the most capable, for hard reasoning (thinks longest).*
> *`"quick"`: the fastest, for short routine work — classification, tags, one-line
> rewrites, **small JSON** (…) it does not think first.*

Sacar los campos de una reserva de un texto ya limpio **es** "small JSON". No es
razonamiento difícil: es extracción. Estamos pagando el modelo que piensa más largo
para leer un voucher que ya dice "CODIGO LB0TKCV5".

**Propuesta:** el camino de texto baja a `"default"`, y se mide si `"quick"` alcanza.
La lectura de imágenes, cuando exista, se queda en el tier alto: ahí sí hay
interpretación visual difícil. La sugerencia de equipaje también se queda alta: ahí sí
hay razonamiento.

Ojo con un detalle del contrato: `modelTierApplied` dice **qué tier contestó de
verdad**, porque la plataforma puede servir uno más barato si el plan del visitante no
tiene el pedido. Hoy no lo leemos: convendría registrarlo para saber qué está pasando
en serio.

### 3.2 Una llamada por archivo, cuando podría ser una por lote

> *"For a list of items prefer ONE call that returns a JSON array over one call per
> item."*

Hoy `interpretFile` corre una vez por archivo. Subir cuatro documentos son cuatro
llamadas. Se eligió así para poder mostrar el progreso fila por fila, que es una razón
de diseño válida, pero **cuadruplica el consumo de una carga múltiple.**

**Propuesta:** un solo pedido por lote para los archivos que ya son texto, conservando
el progreso por fila con lo que ya sabemos antes de llamar. Los que necesitan imagen
siguen sueltos.

### 3.3 Lo que ya estamos haciendo bien

- **La caché está prendida por defecto y no la desactivamos.** El mismo archivo dentro
  de cinco minutos se responde sin gastar nada: *"no usage is spent, Claude is not
  contacted"*. Por eso "Reintentar" sobre el mismo documento puede salir gratis.
- Se llama a partir de un gesto explícito, nunca desde un bucle ni un temporizador, que
  es exactamente lo que el contrato pide.

## 4 · Lo que no se puede saber desde acá

- **Cuánta cuota tiene el PM ni cuánto le queda.** El contrato no expone el saldo, y
  `limits()` sólo informa el tamaño máximo del prompt y si hay imágenes: *"Cheap and
  local — no usage is spent"*. No hay forma de mostrar "te quedan N".
- **Cuánto consume una llamada.** No hay contador de consumo en el contrato.
- Por lo tanto **no podemos avisar antes de gastar**. Lo único honesto es no gastar de
  más, y explicar bien cuando el límite aparece.

## 5 · La conclusión para decidir

| Pregunta | Respuesta |
|---|---|
| ¿La cuota limita cuánta gente puede usar la app? | **No.** Cada visitante paga la suya |
| ¿Limita cuánto puede usarla una persona por día? | **Sí**, y no lo controlamos |
| ¿Podemos saber cuánto queda o cuánto gastamos? | **No.** El contrato no lo expone |
| ¿Estamos gastando más de lo necesario? | **Sí**, y es arreglable: el tier y el lote |
| ¿El error que vio el PM era de la app? | **No.** Era su límite de cuenta, agotado por la sesión de desarrollo |

**Recomendación:** el desperdicio se arregla en la próxima iteración junto con lo demás
(VAL-57, VAL-58). No es urgente —no rompe nada— pero es la diferencia entre que el
límite aparezca cada cinco documentos o cada veinte.
