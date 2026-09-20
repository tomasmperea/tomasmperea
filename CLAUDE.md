# Valija — contexto del proyecto

App de planificación de viajes. Consolida en un solo lugar toda la información de un viaje, que hoy queda
repartida entre las distintas plataformas de servicios donde se contrató cada cosa.

**App publicada:** https://claude.ai/code/artifact/136a6d7e-9952-4edb-b6d3-11f6e69c8cb4
**Rama de trabajo:** `claude/travel-planning-app-mvp-jag9be`

## Estructura

| Ruta | Qué es |
|---|---|
| `app/valija.html` | La app completa. Un solo archivo, sin build ni framework. |
| `app/parts/` | Piezas en desarrollo, antes de integrarse a `valija.html`. |
| `docs/PRD.md` | Alcance, limitaciones conocidas y métricas. |
| `docs/roadmap.md` | Cuatro iteraciones con la pregunta que responde cada una. |
| `docs/backlog.md` | Historias con criterios de aceptación. |
| `docs/briefs/` | Brief de la iteración en curso. Es el contrato de trabajo. |
| `docs/design/` | Especificaciones de diseño. |
| `docs/qa/` | Casos de prueba y reportes de validación. |
| `docs/arquitectura.md` | Notas técnicas. |

## Regla de coordinación

Varios agentes trabajan en paralelo sobre este repo. **Un archivo tiene un solo dueño por iteración.**

Nadie edita `app/valija.html` salvo el rol de integración. El trabajo en paralelo se entrega en `app/parts/`
como piezas autónomas, y se integra en un paso posterior. Un agente que necesita cambiar algo en
`valija.html` lo describe en su entrega en lugar de editarlo.

**Y no se commitea el árbol entero mientras alguien más está trabajando.** La regla escrita el 12/09 decía
"se agregan los archivos por nombre" y **se rompió al día siguiente**: `git add docs/` se llevó 368 líneas a
medio escribir de otro agente dentro de un commit que hablaba de otra cosa, describiendo un comportamiento
que el código de ese commit todavía no tenía. Dos veces en dos días, con la regla ya escrita.

Así que la regla deja de ser una intención y pasa a ser mecánica: **mientras haya un agente corriendo, sólo
`git add` con rutas de archivo exactas.** Ni `-A`, ni un punto, ni un directorio — `docs/` es un directorio y
por eso falló. Si no se puede nombrar cada archivo, es señal de que no se sabe qué se está commiteando, y
entonces no se commitea: se espera.

## Sistema de diseño

Ya está definido en `app/valija.html` y no se reinventa. Se usan los tokens existentes.

**Color.** Tinta azul noche, fondo gris azulado, azul de señalética como acento, ámbar de tablero de salidas
para destacados. Verde, ámbar y rojo semánticos, separados del acento. Todos los colores salen de variables
CSS declaradas en `:root`, nunca literales. Cada token se redefine para tema oscuro en dos bloques: por
preferencia del sistema y por elección explícita del usuario.

El botón de la cabecera cicla entre automático, claro y oscuro, y la elección se guarda en el dispositivo.
Automático no estampa atributo y sigue al sistema. Cualquier color nuevo tiene que existir en los tres
bloques o va a fallar en uno de los tres estados.

**Tipografía.** Bricolage Grotesque para títulos, Public Sans para texto, DM Mono para datos: códigos IATA,
horarios, códigos de reserva y cantidades.

**Metáfora visual.** El mundo del viaje físico. Los viajes son etiquetas de equipaje con banda de color. Las
reservas son tarjetas de embarque con troquelado. Se mantiene esa línea.

**Mobile primero.** El contenedor es de 460px máximo. Se diseña para el pulgar, no para el mouse.

## Convenciones de código

- Vanilla JavaScript, sin frameworks. La única dependencia externa es jsPDF por CDN con versión fija.
- Funciones de render puras: reciben estado y devuelven HTML.
- Todo lo que viene de datos pasa por `esc()` antes de ir al HTML.
- La capa de datos está aislada en el objeto `Store`. Nada fuera de `Store` sabe si los datos vienen de la
  base compartida o de `localStorage`.
- Las capacidades de plataforma se piden con `claude.use()` y **siempre** se maneja el caso en que devuelve
  `null`. La app tiene que funcionar sin ellas.
- Foco visible en todo lo interactivo. Se respeta `prefers-reduced-motion`.

## Idioma

La interfaz habla español rioplatense, en segunda persona del singular con voseo. "Cargá", "pegá", "tenés".

Los mensajes de error dicen qué pasó y qué hacer. Nunca piden disculpas ni culpan al usuario.

Los nombres de campos en la interfaz son los que usa un viajero, no los del modelo de datos. Se dice "código
de reserva", no "confirmation".

## Cómo se prueba

Dos errores llegaron a la app publicada por probar mal, no por programar mal. Los dos son el mismo patrón:
una prueba que valida lo que suponemos en vez de lo que pasa.

**Empezá por el gesto, no por el evento.** Si la función se usa tocando un botón, la prueba toca el botón.
Disparar a mano el evento interno que ese botón debería producir saltea justamente el tramo donde vive el
bug. Los botones de importar quedaron muertos en el teléfono y ninguna prueba lo vio, porque todas
disparaban el evento del campo de archivo sin tocar nunca el botón.

Antes de dar por buena una función, preguntá: ¿qué toca la persona, y mi prueba toca eso?

**Un simulador replica el contrato, no lo que creemos.** Cuando algo se prueba contra una pieza de la
plataforma que no está disponible acá, el simulador se escribe leyendo el contrato, no de memoria. El primero
que escribimos copió una suposición equivocada sobre cómo se leen los datos, así que las pruebas pasaban
mientras la app se veía vacía. Queda `app/parts/db-mock.js` como referencia de cómo se hace.

**Lo que no se pudo verificar se dice.** Este entorno bloquea el repositorio de librerías externas, así que
nada que dependa de esa descarga se puede dar por funcionando. Se declara pendiente de la app publicada, con
los pasos para comprobarlo.

## Qué significa terminado

Una entrega está lista cuando cumple los criterios de aceptación del brief de la iteración, funciona en un
teléfono, y funciona igual en tema claro y oscuro.

**Y cuando pasó la auditoría.** Ninguna entrega se publica sin puntaje del rol `auditor`. La rúbrica está
en `docs/auditoria/rubrica.md` y cada auditoría queda escrita en `docs/auditoria/`. No hay excepción por
urgencia: el arreglo urgente mal verificado ya costó tres iteraciones seguidas en el mismo bug.

### PUBLICAR y TERMINAR no son lo mismo, y el puntaje que hace falta tampoco

La regla decía "menos de 85 no se publica", y el 19/09 se topó con su propio callejón. VAL-63 sacó 76. Lo
que le faltaba para 85 eran dos cosas: **confirmar que estaba publicada, y que el PM la probara en su
teléfono.** Las dos exigen que esté publicada. La regla se pedía a sí misma algo imposible, y el auditor
—que la aplica— fue el que señaló la salida.

Entonces se separa lo que siempre fueron dos cosas distintas:

| | Qué significa | Puntaje |
|---|---|---|
| **Candidato** | Sale al Artifact para que el PM lo pruebe. La brecha va declarada y hay un guion para cerrarla. | **70**, y sólo si lo único que falta es el entorno real |
| **Terminado** | La historia se da por cumplida y se cierra la iteración. | **85**, sin excepción |

**Lo que NO cambia, y es lo que la regla protegía:**

- Un candidato con un defecto conocido, una causa sin determinar o una afirmación sin respaldo **no sale**.
  El piso de 70 vale cuando la única dimensión floja es la 1, y porque está floja por definición: nada se
  prueba en el teléfono antes de estar arriba.
- **Terminado sigue exigiendo el teléfono.** Publicar no cierra nada. VAL-63 no está terminada hasta que
  vuelva el resultado del PM, y eso se escribe en la entrega, no se da por hecho.
- Si el auditor baja el puntaje por **cualquier motivo que no sea la indisponibilidad del entorno real**, no
  hay piso de 70 que valga: eso se arregla antes de publicar, como siempre.

  La primera redacción de esta regla listaba "causa raíz, honestidad, calidad interna" y **se olvidaba de
  las otras dos dimensiones**, contrato y diseño. El auditor lo marcó el mismo día: tal como estaba escrita,
  alguien podía publicar con un criterio de aceptación incumplido —uno que no tuviera nada que ver con el
  teléfono— y defenderlo diciendo que esa dimensión no figuraba en la lista.

  Por eso la regla deja de enumerar dimensiones y nombra la única excepción que existe: **que la dimensión
  esté floja porque todavía no se pudo probar en el aparato.** Si la 4 baja porque el criterio de aceptación
  exige el teléfono, eso no rompe el candidato. Si baja porque el criterio no se cumple por otra cosa, sí.

La decisión de separarlo la tomó el PM el 19/09, con el callejón a la vista.

## La palabra "verificado"

Tiene una sola definición en este proyecto: **probado en el entorno donde la persona lo usa.** Para Valija,
eso es el Artifact publicado, abierto desde el teléfono.

Todo lo demás son sustitutos, y cada uno tiene una brecha conocida:

| Dónde se probó | Qué NO prueba |
|---|---|
| `node` sobre un módulo | Nada del DOM, del visor ni del gesto |
| Chromium de escritorio con el archivo local | El visor del teléfono, sus permisos y su sandbox |
| El Artifact publicado, en una computadora | El navegador y el visor del teléfono |
| El Artifact publicado, en el teléfono | Nada: es el entorno real |

Una entrega puede apoyarse en un sustituto. Lo que no puede hacer es **llamarlo verificado**. Se dice dónde
se probó, qué queda sin cubrir y cómo comprobarlo. Declarar una brecha nunca es una mala nota; afirmar sin
respaldo sí.

## Un defecto que sólo aparece en el teléfono del PM

Tres arreglos seguidos fallaron sobre el mismo síntoma, en septiembre. No fue mala
suerte: fue el mismo error de método tres veces.

Cada arreglo nació de una hipótesis sobre qué hace el Android del PM. Para probarla se
escribió un simulador **desde esa hipótesis**, el simulador reprodujo el síntoma, el
arreglo lo puso en verde y se publicó. Pero un simulador escrito desde una hipótesis
**sólo puede darle la razón a quien lo escribió**. Nunca puede avisar que la hipótesis
es falsa. Las tres veces el arnés decía la verdad y la entrega estaba equivocada.

La auditoría no lo habría frenado: el auditor corre en el mismo entorno ciego. Habría
confirmado que la prueba pasa, que el control negativo falla y que las regresiones
están verdes — todo cierto y todo irrelevante, porque el defecto vive donde ninguno de
los dos puede mirar.

**Entonces, para un defecto que no se puede reproducir acá:**

1. **No se publica un arreglo que dependa de acertar la causa.** Si la causa no se
   puede observar, cualquier arreglo es una apuesta, y el costo de perderla lo paga el
   PM con una ronda de pruebas.

2. **Se publica lo que convierte la próxima ronda en datos:** que la app diga qué
   observó, en una línea que entre en una captura de pantalla, y que diga de qué
   versión es. Un reporte con datos cierra el problema; tres reportes con síntomas, no.

3. **Se puede publicar un arreglo que NO dependa de la causa.** Agotar los caminos
   documentados —leer un archivo de las tres formas que existen, en vez de una— no es
   una hipótesis: vale sin saber cuál falla. Eso sí se publica.

4. **Nunca concluir de un dato lo que se puede determinar leyendo.** "El archivo
   informa cero" no es "el archivo está vacío". Confundirlos costó tres iteraciones.

5. **El mensaje de error no inventa una causa.** Dice qué pasó, y aparte muestra qué se
   observó. Si no se sabe por qué, se dice que no se sabe.

**Y una que vale para todo arnés, no sólo para estos:** un escenario que espera que
todo salga bien puede pasar porque el sabotaje no se aplicó. Cuatro escenarios de
`app/pruebas/tres-caminos-de-lectura.js` pasaron en falso porque la función de sabotaje
se pasaba como closure y `addInitScript` no se lleva el closure. Lo destapó el único
escenario que esperaba una falla. **Todo arnés que rompe algo a propósito necesita al
menos un caso que falle si el sabotaje no llegó.**

## El arreglo no recibe el mismo ataque que el defecto

Cinco rondas de auditoría sobre VAL-72, el 19 y 20/09. Los puntajes: 57, 51, 70, 59, 51. **No es que no se
avanzara: cada ronda cerró de verdad lo que la anterior había encontrado.** Lo que pasó es otra cosa, y la
nombró el auditor en la quinta:

> Es la cuarta ronda seguida en que el commit que cierra la auditoría introduce un defecto nuevo. Los
> hallazgos anteriores se cierran bien; lo que se agrega encima no recibe el mismo ataque que lo que se
> arregla.

Es exacto. Al hallazgo se lo persigue: se reproduce antes de tocar nada, se mide contra la versión anterior,
se le escribe un control negativo. Al **arreglo** se lo prueba una vez, se lo ve andar, y se lo commitea.

Los cuatro defectos nuevos salieron de ahí:

| Lo que se arregló | Lo que el arreglo rompió |
|---|---|
| Que un traslado no pise el destino escrito | El alojamiento quedó pisándolo igual: no le hice la misma pregunta al cajón de al lado |
| Que la línea no cortara antes de las pistas | Saqué una guarda sin preguntar qué más protegía: una pista podía borrar el destino escrito |
| Que una escala no cuente como destino | Marcó como escala las tres ciudades del viaje multidestino |
| Lo mismo, segundo intento | Marcó como escala el único destino de una ida y vuelta |

**Entonces, antes de commitear un arreglo, se le hacen las mismas tres cosas que se le hicieron al defecto:**

1. **¿Qué caso vecino comparte la causa?** Si el arreglo distingue A de B, hay que preguntarse por C. Dos
   veces seguidas el arreglo trató un cajón y dejó intacto el de al lado, a cinco líneas de distancia.
2. **¿El arreglo puede romper el caso que la historia vino a resolver?** Correr el caso de éxito DESPUÉS del
   arreglo, explícitamente, y no confiar en que alguna prueba lo cubre. Las dos versiones de la marca de
   escala rompieron el caso de éxito de su propia historia.
3. **¿El fixture se parece a lo que la app escribe?** Ver abajo, porque es la que más caro salió.

## Un fixture al que le falta un campo hace pasar una prueba que debería fallar

El caso de la ida y vuelta vivió **dos rondas** de auditoría sin que ningún arnés lo viera, y el arnés tenía
una aserción escrita exactamente para eso. Pasaba porque el fixture de vuelos **no tenía hora de llegada**, y
la app la escribe por tres caminos distintos: el formulario manual, la pantalla de revisar lo importado, y el
prompt con el que se le pide al modelo que complete los datos.

O sea: el control declaraba un caso de éxito, y pasaba porque al dato le faltaba un campo, no porque el
código estuviera bien.

Ya está escrito más arriba que *un escenario que espera que todo salga bien puede pasar porque el sabotaje no
se aplicó*. Esto es la misma regla con el agravante de que **acá el sabotaje era el dato real**. No hacía
falta romper nada: alcanzaba con que el fixture se pareciera a lo que la persona carga.

**Entonces un fixture se escribe leyendo el formulario, no de memoria.** Antes de dar por bueno un arnés:
abrir la pantalla donde se carga ese dato, listar los campos, y comprobar que el fixture los tiene. Si un
campo es opcional, tiene que haber un caso con y un caso sin.

Para Valija, hoy: un vuelo tiene origen, destino, sale y **llega**; un alojamiento tiene check-in,
**check-out** y dirección; un auto tiene retiro, **devolución** y lugar; un traslado tiene **desde**, hasta y
fecha. Y todas las fechas son `datetime-local`: nunca una fecha pelada.

## Antes de dar algo por resuelto

Tres preguntas, en este orden. Si alguna no tiene respuesta, la entrega no está lista:

1. **¿Qué toca la persona, y mi prueba toca eso?**
2. **¿Qué otra causa explicaría el mismo síntoma, y qué hice para descartarla?** Dos hipótesis vivas exigen
   un experimento que las separe antes de tocar código. Si acá no se puede correr, se le pregunta al PM.
3. **¿Qué estoy afirmando que no comprobé?** Eso va escrito en la entrega, no en la cabeza.

## La auditoría se hace contra el reporte, no contra el código

El veto de 45/100 del 17/09 encontró un arreglo que funcionaba en un camino y mentía en el otro. El código
estaba bien escrito y las pruebas estaban en verde. Lo que faltaba era una pregunta.

El PM había reportado el mismo síntoma por **dos gestos distintos**: adjuntar un archivo a una reserva, e
importar. El arreglo se probó sobre el primero. El segundo quedó diciendo "Este PDF es un escaneo" sobre un
archivo que no se pudo leer — una causa inventada, exactamente lo que la regla anterior prohíbe, en el
camino que nadie miró.

Entonces la auditoría no arranca leyendo el diff. Arranca leyendo el reporte:

1. **Listar los gestos con los que la persona vio el síntoma.** Textual, de su mensaje o su captura. Si
   reportó dos caminos, son dos, aunque el código los comparta.
2. **Para cada gesto, señalar la prueba que lo ejercita.** Si un gesto no tiene prueba propia, no está
   cubierto. "Comparten el motor" no alcanza: el bug de importar vivía arriba del motor.
3. **Recién entonces, el código.**

Un gesto sin prueba es un hallazgo bloqueante, no una observación.

**Y no se commitea mientras el auditor está auditando.** El 17/09 la primera ronda se vetó en 70 en parte
porque llegó un commit nuevo encima del árbol que el auditor estaba puntuando. Hizo bien en no puntuarlo: un
puntaje sobre un árbol que se movió no vale. El árbol se queda quieto hasta que vuelve el puntaje.

## Publicar no es haber publicado

El 17/09, antes de publicar la v18, comparé el Artifact que estaba arriba contra el repo. No tenía el lector
de tres caminos, no tenía el mensaje nuevo y **no tenía el sello de versión**: era el código de dos commits
antes. Yo venía diciendo "publicá y probá" sobre trabajo que nunca había salido.

El costo lo pagó el PM. Su ronda del 16/09 —"persisten ambos errores con la versión latest"— corrió contra
un build **sin** las dos cosas diseñadas para que esa ronda diera datos. Un reporte perfecto sobre el
binario equivocado no dice nada, y encima parece decir que el arreglo falló.

Dos causas distintas, las dos ya vistas en este proyecto: el link compartido puede quedar **fijado** a una
versión anterior, y un `git commit` **no publica nada**. La segunda es la que pasó acá.

Entonces, mecánica, y va antes de pedirle una prueba a nadie:

1. **Leer lo que está publicado.** No el repo, no el último commit: el archivo que sirve el Artifact.
2. **Buscar en ese archivo una marca del cambio que se quiere probar.** Una cadena que exista sólo en la
   versión nueva. Si no está, no está publicado, y no hay nada que pedirle al PM.
3. **Buscar el sello de versión**, y que coincida con el que se le va a pedir que mire en pantalla.
4. **Confirmar que el link compartido sirve la última**, no una fijada.

Ninguno de los cuatro es una opinión: son cuatro `grep`. Pedir una prueba sin hacerlos es gastar una ronda
del PM a cambio de nada.

## La compuerta que convertía cualquier sorpresa en "archivo vacío"

El 17/09 la línea de observación de la v18 cerró en UNA ronda lo que tres arreglos no habían movido en
tres. La captura del PM decía:

```
informa 123129 B · memoria 0 B · application/pdf · v18
```

Un solo intento, sobre un archivo que informa 123 KB. Los tres caminos de lectura no aparecen porque nunca
corrieron. La causa estaba arriba de ellos:

```js
if (file && file.bytes) { ...usar esos bytes...; return; }
```

`bytes` es el nombre de un **método de Blob**. `Blob.prototype.bytes()` existe en los navegadores nuevos y
no en el Chromium de este entorno. En el teléfono del PM, `file.bytes` era esa función: verdadera, así que
la guarda entraba, y normalizar una función da cero bytes. **Todo archivo devolvía vacío antes de que
existiera cualquier otro camino.** Los tres arreglos anteriores tocaban código que ese `return` salteaba.

Tres reglas salen de acá, y ninguna es sobre Android:

**1. Una guarda que devuelve convierte cualquier sorpresa en su propio diagnóstico.** La compuerta no decía
"no pude leer": decía "leí, y no había nada". Un atajo que corta el camino tiene que fallar hacia el camino
largo, no hacia una conclusión. Si el atajo no sirvió, se anota por qué y se sigue probando.

**2. No se pregunta por "verdadero" sobre un nombre que le pertenece a la plataforma.** `bytes`, `slice`,
`text`, `stream`, `arrayBuffer` son métodos de Blob. Una propiedad nuestra que se llame igual va a chocar
con la plataforma el día que la plataforma la implemente — y el choque no avisa: se ve como un dato vacío.
Se pregunta por lo que se necesita (¿son bytes?), no por si existe algo.

**3. Cuando un caso anda y otro falla, se enumeran TODAS las diferencias antes de elegir una.** La foto de
la cámara entraba y el PDF del mail no. Elegí "el origen del archivo" y escribí tres arreglos sobre esa
elección. La diferencia real era el **tamaño**: 2,7 MB está arriba del tope y se va a recomprimir por
canvas sin pasar nunca por el lector; 123 KB está abajo y pasa. Estaba a un `if` de distancia, en nuestro
propio código, y no lo miré porque ya tenía una explicación que me gustaba.

**Y la que las paga todas:** la instrumentación valió más que los tres arreglos juntos. No hay que
"arreglar y ver": hay que **publicar lo que hace hablar al defecto** y dejar que el dato elija. Está escrito
como regla 2 más arriba; acá está la factura que lo demuestra.
