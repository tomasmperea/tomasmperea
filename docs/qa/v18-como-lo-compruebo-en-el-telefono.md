# v18 — cómo lo comprobás en tu teléfono

**Para:** Tomás (PM) · **Escrito el:** 17/09/2026 · **Versión que tiene que decir la app:** `v18`

Son tres gestos y no hay que abrir ninguna consola. El único dato que necesito de vuelta es **una captura
de pantalla**.

---

## Antes de empezar: mirá que sea la v18

Abrí la app y fijate arriba, al lado del título: dice **`v18`**.

Si dice otra cosa, estás viendo una versión vieja y la prueba no sirve. Pasó el 16/09: probaste la v14 tres
veces mientras yo publicaba la 15 y la 16, porque el link compartido te fijaba una versión anterior. Si no
dice `v18`, avisame y lo arreglo antes de que gastes la ronda.

---

## Prueba 1 — el archivo del mail, adjuntándolo a una reserva

Es el gesto con el que lo viste fallar la primera vez.

1. Abrí un viaje y tocá una reserva (o creá una nueva con cualquier título).
2. En el bloque **DOCUMENTO**, tocá **Archivo**.
3. Elegí el mismo PDF que te llegó por mail, desde donde lo venís eligiendo.

**Si funciona:** aparece la fila del documento con su peso, algo como `RLB_CLARA_SANCHEZ · PDF · 5 KB`.

**Si falla:** no va a decir "está vacío". Va a decir que no lo pudo leer, y **debajo una línea gris con
números y palabras raras**, algo como:

> `informa 0 B · arrayBuffer NotReadableError · slice 0 B · FileReader Error · application/pdf · v18`

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

## Qué te mando de vuelta

| Si pasó esto | Mandame |
|---|---|
| Los tres gestos andan | "anduvo" y cierro la iteración 3 |
| Alguno falla | la captura con **la línea gris completa** |
| La app dice algo que no es ni una cosa ni la otra | la captura igual |
| Arriba no dice `v18` | avisame antes de seguir |

---

## Lo que NO te estoy diciendo

Que esto está arreglado. **No lo sé, y no puedo saberlo desde acá.**

El defecto vive en tu teléfono y este entorno no lo puede reproducir: ni yo ni el auditor podemos mirar ahí.
Los tres arreglos anteriores fallaron exactamente por dar por bueno lo que un simulador escrito por mí me
confirmaba.

Entonces lo que la v18 cambia es de otra clase:

- **La app ya no depende de una sola forma de leer un archivo.** Prueba las tres que existen, una tras otra.
  Esto vale sin saber cuál falla en tu teléfono, y por eso se puede publicar.
- **Ya no concluye "está vacío" de que el archivo no diga cuánto mide.** Son dos cosas distintas y las
  confundía. Ese era un error de lógica, no una conjetura sobre Android.
- **Y si falla, te dice qué observó** en vez de inventar un motivo. Esa es la línea gris.

Puede que igual falle. Lo que no va a pasar es que falle sin dejar datos: con esa captura, la próxima ronda
la arreglo o te digo por qué no puedo, sin una cuarta apuesta.
