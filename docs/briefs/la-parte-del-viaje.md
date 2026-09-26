# VAL-77b — cada ítem sabe a qué parte del viaje pertenece

Brief de trabajo. Lo que está acá se construye; lo que no está acá, no.

**El pedido del PM (23/09):** *"el motor tiene que ser lo suficientemente inteligente para entender que si
agregué un buzo polar es para montaña y si agregué una remera común o unas zapatillas cómodas es para
ciudad"*.

**Su decisión sobre cómo (24/09):** *"pregunté a qué pertenece al agregarlo así el modelo aprende"*.

**Diseño aprobado (26/09):** variante **A**, la fila de chips debajo del campo. El muestrario es
`app/parts/parte-del-viaje-ui.html`, seis estados, con la A marcada como elegida y la B como descartada.
El CSS nuevo está en su Bloque C y se copia, no se reinventa.

---

## Lo que se arregla

VAL-77a dejó escrita esta limitación, y es la razón de ser de esta historia:

> con dos tipos, `learnFromHistory` sólo mira viajes de *esa misma combinación*. Un viaje montaña+ciudad no
> aprende de los viajes de montaña a secas. No se rompe nada, pero se fragmenta, y a más combinaciones menos
> muestra por combinación.

Hoy, en el código: una lista pasada cuenta **si y sólo si** `canonicalTripType(lista) === canonicalTripType(nuevo)`.

---

## Las decisiones de modelo, ya tomadas

No son para rediscutir. Cada una tiene su motivo.

### 1 · El campo

Un ítem **manual** guarda `paraTipos`: un array de **cero a dos** claves de tipo, sacadas de las partes del
viaje donde se agregó.

- `[]` — no declarado. Es lo que tienen **todos** los ítems guardados hoy, y lo que queda si la persona no
  elige. No se inventa ninguna parte.
- `["montana"]` — para una parte.
- `["montana","ciudad"]` — «las dos». Se guardan las dos claves explícitas, no un valor especial que diga
  "ambas": así sigue significando lo mismo si después cambia el tipo del viaje.

Sólo los ítems manuales. Los de regla, destino e historial no lo llevan: el aprendizaje sólo lee lo manual
para promover, y no hace falta más.

### 2 · Cuándo se pregunta

**Sólo en un viaje de dos tipos.** Con un tipo no hay nada que preguntar: el ítem se guarda con
`paraTipos:[esaParte]` sin mostrar nada. Es la mitad del diseño — el gesto más frecuente de la app no paga
ni un toque. Una lista vieja que dice `"mixto"` es de una sola parte (`tripTypeParts("mixto")` da
`["mixto"]`), así que tampoco pregunta.

**Sin selección por defecto**, y «Agregar» **siempre** habilitado. Si no elige, se guarda `[]`.

### 3 · Cómo se PROMUEVE — la regla nueva

Para un viaje nuevo con partes `P`, un ítem manual de una lista pasada con partes `Q` cuenta así:

| El ítem | Cuenta si |
|---|---|
| tiene `paraTipos` | alguna de sus claves está en `P` |
| no tiene (`[]` o ausente) | `canonical(Q) === canonical(P)` — **exactamente la regla de hoy** |
| no tiene, y `Q` es de **una sola** parte | esa parte está en `P` |
| no tiene, y `Q` es de dos partes distintas de `P` | **no cuenta** — no se sabe para cuál era |

Sigue contando una sola vez por viaje (`seenAdd`), y el umbral sigue siendo `HISTORY_PROMOTE_AT`.

**La propiedad que esta regla tiene que cumplir, y que es una prueba y no una intención:** para todo lo
guardado HOY —o sea, ítems sin `paraTipos`— lo que promueve la función nueva **incluye** todo lo que promovía
la vieja. Nadie pierde lo aprendido. Es lo que el estado 6 del muestrario le afirma al PM (*"0 ítems pierden
lo que habían aprendido"*), y **esa afirmación tiene que ser verdad**, no aproximadamente verdad.

Se prueba mecánicamente: la función vieja se saca de `git show 38ae74f:app/valija.html`, se corren las dos
sobre una batería de historiales sin `paraTipos`, y se asevera que el conjunto promovido por la nueva es un
superconjunto del de la vieja, para cada viaje destino.

### 4 · Cómo se SUPRIME — no cambia

Lo descartado sigue exactamente con la regla de 77a: cuenta sólo en la **misma combinación**.

Es una decisión y va escrita en el código con su motivo: suprimir es **sacar** algo de la lista, y en este
proyecto sacar de más es el error caro — *"retener de más es una lista un poco vieja; sacar de más es la app
tirando algo que la persona necesita"*. El pedido del PM es sobre lo que se **agrega**. Lo que se aprende a
sacar no se amplía hasta que alguien lo pida con un caso a la vista.

Consecuencia que hay que declarar: promover se vuelve más amplio que suprimir, y la precedencia de hoy
("si fue agregado dos veces Y descartado dos veces, gana la promoción") puede disparar en más casos. Es el
lado correcto del error, y va dicho.

### 5 · El motivo de un ítem promovido

Hoy dice *"Lo agregaste a mano en N viajes de montaña"*. Con dos partes tiene que nombrar **la parte por la
que se aprendió**, no la combinación del viaje nuevo. Un buzo polar aprendido para montaña, sugerido en un
montaña+ciudad, dice "de montaña".

---

## Las pantallas

Las del muestrario, variante A:

- **El formulario de adentro de la categoría** — la fila `.pk-para` debajo del campo, con las dos partes del
  viaje más «Las dos». Sólo en viajes de dos tipos: con uno la fila **no se renderiza**, no queda un hueco.
- **La hoja «Agregar ítem»** — el mismo control como campo del formulario, con el hint del muestrario.
- **La fila del ítem** — el chip `.chip.parte` ("para montaña", "para ciudad", "para las dos") en la línea de
  motivo. Sólo en viajes de dos tipos y sólo en ítems con `paraTipos`.

---

## Los vecinos que hay que decidir leyendo

No los resuelvo acá porque se deciden mejor mirando el sitio. Lo que pido es que cada uno quede decidido y
**escrito por qué**:

1. **Los dos caminos para agregar.** El formulario de la categoría y la hoja del FAB. Si uno pregunta y el
   otro no, la mitad de lo que se agrega llega sin parte y el aprendizaje queda medio ciego.
2. **`addManualItem` cuando el ítem ya existe.** Hoy lo vuelve a pendiente y no le toca nada más. Si ya existía
   como manual sin parte y ahora la persona eligió una, ¿se guarda?
3. **El viaje cambia de tipo después.** Un ítem "para montaña" en un viaje que pasó a ser playa+ciudad. El chip
   no puede afirmar algo falso; el dato guardado es lo que la persona declaró y no se reescribe.
4. **`mergeLists` y todo lo que rehace un ítem.** El campo tiene que sobrevivir a regenerar la lista. Barrido
   de la forma: cada lugar que arma o copia un ítem campo por campo.
5. **La hoja "De dónde sale esta lista".** Dice "N viajes de {tipo} anteriores". Con la regla nueva cuentan
   viajes que antes no contaban: que el número diga la verdad.

---

## Cómo se prueba

**Empezá por el gesto.** La prueba toca el chip y toca «Agregar»; no llama a `addManualItem` por dentro.

**Y el gesto que importa de esta historia no se ve en la pantalla donde ocurre: se ve en el viaje siguiente.**
Así que la prueba tiene que armar más de un viaje:

1. Viaje 1, montaña+ciudad: agregar «Buzo polar» tocando **Montaña**.
2. Viaje 2, montaña sola: agregar «Buzo polar» — sin pregunta, se guarda para montaña.
3. Viaje 3, **montaña sola**: armar la lista → «Buzo polar» aparece, de origen historial, y el motivo dice
   montaña. **Éste es el caso de éxito**: hoy no aparece, porque el viaje 1 no cuenta.
4. Viaje 3 bis, **ciudad sola**: armar la lista → «Buzo polar» **no** aparece. Es el control.
5. **Lo guardado hoy no pierde nada**: dos viajes montaña+ciudad con un ítem manual SIN parte → un tercer
   montaña+ciudad lo sigue sugiriendo, igual que hoy. Más la prueba mecánica del superconjunto del punto 3.
6. Un viaje de **un tipo**: el formulario no tiene la fila de chips, y el alto es el de hoy.
7. **«Las dos»**: cuenta para montaña y para ciudad.
8. **Sin elegir**: se agrega igual, sin chip, y no cuenta para ninguna parte en un viaje nuevo de otra
   combinación.
9. **Lo descartado no cambia**: una batería donde la supresión da idéntico antes y después.

**Los fixtures se escriben leyendo el formulario**, y de cada campo opcional que el motor lee hay un caso con
y un caso sin — `paraTipos` incluido: presente, vacío y **ausente**, que son tres cosas distintas y las tres
existen en datos reales.

**Todo arnés que rompe algo a propósito necesita al menos un caso que falle si el sabotaje no llegó.**

**Y ojo con un fixture que ya existe y está mal:** `app/pruebas/val76-el-tipo-con-el-dedo.js:69` declara un
alojamiento con `type:"lodging"`, que no existe (es `stay`). Es VAL-82, está en el backlog y no es de esta
historia — pero si copiás fixtures de ahí, no copies ése.

Las regresiones de `app/pruebas/` corren **enteras** y en verde antes de decir que está listo. Todas aceptan
correr sin argumento desde el 24/09.

---

## Antes de commitear cada arreglo

1. **¿Qué caso vecino comparte la causa?** Con `grep` de la estructura en todo el archivo.
2. **¿El arreglo puede romper el caso que la historia vino a resolver?** El caso de éxito (punto 3 de las
   pruebas) se corre **después** de cada arreglo, explícitamente.
3. **¿Qué condición saqué, y qué caso la necesitaba?** Acá es especialmente fácil: la condición
   `canonical(Q) === canonical(P)` se reemplaza por otra más amplia, y la tentación es borrarla. **No se
   borra**: es la fila 2 de la tabla, y sin ella lo guardado pierde lo aprendido.
4. **¿El fixture se parece a lo que la app escribe?**

## Lo que NO entra

- **Que los ítems de regla tengan parte.** No hace falta para promover y es mucho más difícil: una regla puede
  disparar por hechos del viaje y no por el tipo.
- **Ampliar la supresión.** Decisión 4.
- **VAL-82**, el fixture con `lodging`.

## Qué significa terminado

Criterios cumplidos, andando en un teléfono, e igual en claro y oscuro. **70 para candidato, 85 para
terminado.** Lo que no se comprobó se declara.

`git add` con rutas exactas. Ni `-A`, ni un punto, ni un directorio.
