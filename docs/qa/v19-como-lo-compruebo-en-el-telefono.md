# v19 — cómo lo comprobás en tu teléfono

**Para:** Tomás (PM) · **Escrito el:** 17/09/2026 · **Versión que tiene que decir la app:** `v19`

Son tres gestos y no hay que abrir ninguna consola. El único dato que necesito de vuelta es **una captura
de pantalla**.

---

## Antes de empezar: mirá que sea la v18

Abrí la app y fijate arriba, al lado del título: dice **`v19`**.

Si dice otra cosa, estás viendo una versión vieja y la prueba no sirve.

Y si **no dice ninguna versión**, tampoco sirve, por un motivo que descubrí justo antes de publicar esto:
**el Artifact que estaba arriba era el código de dos commits antes.** No tenía el lector de tres caminos, no
tenía el mensaje nuevo, y no tenía este sello de versión. Tu ronda del 16/09 —"persisten ambos errores con la
versión latest"— corrió contra un build al que le faltaban justo las dos cosas hechas para que esa ronda
diera datos. Yo te pedí una prueba sobre trabajo que nunca había salido.

Esta vez lo verifiqué: leí el archivo publicado y busqué adentro cada uno de los cinco arreglos. Están.
Igual, si arriba no dice `v19`, avisame antes de seguir y no gastes la ronda.

---

## Prueba 1 — el archivo del mail, adjuntándolo a una reserva

Es el gesto con el que lo viste fallar la primera vez.

1. Abrí un viaje y tocá una reserva (o creá una nueva con cualquier título).
2. En el bloque **DOCUMENTO**, tocá **Archivo**.
3. Elegí el mismo PDF que te llegó por mail, desde donde lo venís eligiendo.

**Si funciona:** aparece la fila del documento con su peso, algo como `RLB_CLARA_SANCHEZ · PDF · 5 KB`.

**Si falla:** no va a decir "está vacío". Va a decir que no lo pudo leer, y **debajo una línea gris con
números y palabras raras**, algo como:

> `informa 0 B · arrayBuffer NotReadableError · slice 0 B · FileReader Error · application/pdf · v19`

**Esa línea gris es todo lo que necesito.** Saca la captura de forma que entre completa. No hace falta que la
entiendas: dice cuál de las tres formas de leer el archivo falló y cómo, y eso convierte el próximo intento
en un arreglo en vez de otra apuesta.

---

## Prueba 2 — el mismo archivo, pero importándolo

Es el segundo gesto con el que lo viste, y es el que ayer se me había quedado sin probar.

1. Dentro del viaje, tocá **Importar**.
2. Tocá **Archivo** y elegí el mismo PDF.

**Si funciona:** lee la tarjeta, completa el vuelo con asiento y puerta, y deja el documento adjunto.

**Si falla:** igual que antes — dice que no lo pudo leer, con la línea gris debajo. Lo que **ya no puede
hacer** es decirte "este PDF es un escaneo": eso era una causa inventada sobre un archivo que ni se pudo
abrir, y era el agujero que la auditoría me frenó ayer.

---

## Prueba 3 — que no se rompió lo que ya andaba

Una sola cosa, rápida: adjuntá una **foto sacada con la cámara** a cualquier reserva. Tiene que entrar y
reducirse sola, como el 16/09 (2,7 MB → 112 KB). Si eso sigue andando, no rompí nada al arreglar lo otro.

---

## Un cuarto síntoma, distinto, que también vale reportar

Además de "está vacío", hay una forma de fallar que **no dice nada**, y es la peor porque no parece un
error: el bloque del documento se queda en **"Preparando el archivo…"** y no cambia más, y el botón
**Guardar queda apagado**. Si te pasa eso, la reserva queda trabada: no hay nada que tocar para salir
salvo cancelar y perder lo que escribiste.

Lo encontré hoy buscando otra cosa, y lo arreglé. Va acá por dos motivos: para que si aparece sepas que es
**otro** problema y no el del archivo vacío, y porque el arreglo se probó solamente en este entorno.

**Si lo ves, mandame la captura y decime "quedó colgado en preparando".** Con esas palabras ya sé que es
éste y no el otro, y no perdemos una ronda averiguándolo.

---

## Qué te mando de vuelta

| Si pasó esto | Mandame |
|---|---|
| Los tres gestos andan | "anduvo" y cierro la iteración 3 |
| Alguno falla | la captura con **la línea gris completa** |
| Quedó en "Preparando el archivo…" con Guardar apagado | la captura y **"quedó colgado en preparando"** |
| La app dice algo que no es ni una cosa ni la otra | la captura igual |
| Arriba no dice `v19` | avisame antes de seguir |

---

## Esta vez sí sé qué estaba roto

Y es la primera vez en cuatro rondas que puedo decir eso, así que va con el respaldo.

**Tu captura lo resolvió.** La línea gris decía `informa 123129 B · memoria 0 B`. Un solo intento, sobre un
archivo de 123 KB. Los tres caminos de lectura ni aparecían: nunca corrieron.

El motivo estaba en mi código, no en tu teléfono. Antes de leer el archivo había un atajo: "si este archivo
ya trae los bytes puestos, usalos". La pregunta que hacía era "¿tiene algo llamado `bytes`?" — y resulta que
`bytes` es el nombre de una función que los navegadores nuevos le agregaron a todos los archivos. Tu Chrome
la tiene; el navegador con el que yo pruebo, no. Así que en tu teléfono el atajo respondía "sí, tiene bytes",
agarraba una función en lugar de datos, sacaba cero, **y devolvía sin probar nada más.**

Todo archivo volvía vacío antes de que existiera cualquier otro camino. Los tres arreglos anteriores tocaban
código que ese atajo salteaba. Por eso no cambió nada tres veces seguidas.

**Y explica lo de la foto de la cámara**, que yo había explicado mal. No entraba por ser "del navegador":
entraba porque pesaba 2,7 MB. Arriba de 190 KB el archivo se va a recomprimir y nunca pasa por el atajo.
Tus PDF pesaban 123 KB y 20 KB — debajo del tope, directo a la trampa. **La diferencia era el tamaño, no de
dónde venía el archivo.** Sobre esa confusión mía se construyeron tres rondas tuyas.

### Qué tan probado está

Esta vez el defecto **se reproduce acá**. Le agregué al navegador de pruebas la misma función que tiene el
tuyo, y con el código de la v18 el arnés falla **9 veces**: **8 en los dos gestos** —importar y adjuntar,
mostrando el mismo texto que vos viste— y una novena que es un chequeo directo al motor, fuera de los
gestos. Con el arreglo, las nueve en verde.

(Ese número primero lo escribí como "10 en los dos gestos". Estaba mal en las dos mitades: venía de una
corrida anterior del arnés, antes de que reestructurara las pruebas, y no lo volví a contar antes de
escribirlo. Lo agarró la auditoría. Es la misma clase de exceso de confianza que este mismo arreglo le saca
al mensaje de error de la app, cometido en la línea que lo anuncia.)

Eso es lo que no tuvimos las tres veces anteriores: un arnés que puede decir que **no**.

### Lo que sigue sin estar probado

Que en **tu** teléfono alcance. Sigo sin poder abrir tu Android, y puede haber más de una cosa rota. Si
falla de nuevo, la línea gris va a decir otra cosa distinta de `memoria 0 B` — y esa diferencia ya es el
próximo dato.

Una cosa más, aparte: en tu última captura apareció abajo un cartel del sistema que dice **"Memoria
insuficiente para completar la operación anterior"**. No es de la app, es de Android, y no tengo cómo
mirarlo desde acá. Si vuelve a aparecer, decímelo: puede no ser nada, o puede ser un segundo problema.
