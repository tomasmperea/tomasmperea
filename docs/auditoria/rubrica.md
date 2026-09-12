# Rúbrica de auditoría de entregables

**Escribe:** Product Owner · **Aplica a:** toda entrega antes de publicarse

Toda entrega se puntúa de 0 a 100 antes de llegar al PM. Menos de 85 no se publica.

La rúbrica no es decorativa: las seis dimensiones y sus pesos salen de los errores
reales que ya llegaron al usuario, no de una lista genérica de buenas prácticas.

---

## Las seis dimensiones

| # | Dimensión | Peso | Qué mide |
|---|---|---|---|
| 1 | Verificación en el entorno real | 30 | Si se probó donde la persona lo usa, o en un sustituto |
| 2 | Diagnóstico de causa raíz | 15 | Si se arregló la causa o el síntoma |
| 3 | Honestidad de lo verificado | 15 | Si lo no comprobado se declara como tal |
| 4 | Cumplimiento del contrato | 15 | Si cumple los criterios del brief, completos |
| 5 | Calidad interna | 15 | Código, pruebas, documentación, coordinación |
| 6 | Diseño y decisiones de producto | 10 | Si la decisión es defendible y está argumentada |

**El peso de la dimensión 1 es el doble que el de cualquier otra, a propósito.**
Es la única que explica todos los defectos que llegaron al usuario.

---

## 1 · Verificación en el entorno real — 30 puntos

| Puntos | Situación |
|---|---|
| 30 | Se probó en el entorno real del usuario, tocando los controles, y quedó registro |
| 20 | Se probó en un sustituto fiel y se declaró explícitamente qué NO cubre ese sustituto |
| 10 | Se probó en un sustituto sin declarar la brecha |
| 0 | Se probó el código, no el gesto: se disparó el evento interno en vez de tocar el control |

**El entorno real de este proyecto es el Artifact publicado, abierto desde el
teléfono del PM.** Node, Chromium de escritorio y un archivo local son sustitutos.
Ninguno prueba el visor donde la app se usa.

Restas obligatorias:
- −10 si la función se usa tocando algo y la prueba no tocó eso.
- −10 si el simulador se escribió de memoria en vez de leyendo el contrato.
- −30 si se reportó como "verificado" algo probado sólo en un sustituto.

## 2 · Diagnóstico de causa raíz — 15 puntos

| Puntos | Situación |
|---|---|
| 15 | Se reprodujo el fallo, se identificó la causa y se probó que el arreglo la elimina |
| 10 | Se identificó la causa por lectura del código, sin reproducir |
| 5 | Se arregló el síntoma más probable sin descartar las alternativas |
| 0 | Se arregló a ciegas, o se dio por buena la primera hipótesis |

**Dos hipótesis que explican el mismo síntoma exigen un experimento que las separe
antes de tocar código.** Si ese experimento no se puede correr acá, se le pregunta
al PM: una pregunta cuesta un minuto, un arreglo equivocado cuesta una iteración.

## 3 · Honestidad de lo verificado — 15 puntos

| Puntos | Situación |
|---|---|
| 15 | Cada afirmación distingue verificado / inferido / no comprobado, sin que lo pidan |
| 8 | Se declara lo no comprobado pero mezclado con lo verificado |
| 0 | Se afirma "funciona" sobre algo que no se probó donde importa |

Un entregable que dice "no pude verificar esto y así se comprueba" vale **más** que
uno que dice "está listo" sin respaldo. Declarar una brecha nunca baja el puntaje.

## 4 · Cumplimiento del contrato — 15 puntos

Cada criterio de aceptación del brief, verificado uno por uno. Un criterio que no se
pudo verificar cuenta como no cumplido, no como cumplido por defecto.

## 5 · Calidad interna — 15 puntos

Pruebas que pasan y que prueban lo que dicen probar; el código embebido idéntico a su
fuente; documentación que describe lo que el código hace hoy; un archivo, un dueño.

## 6 · Diseño y decisiones de producto — 10 puntos

Cada decisión con su porqué y con lo que se descartó. Una decisión que contradice el
brief suma si está argumentada y declarada; resta si está escondida.

---

## Cómo se usa

1. El rol que entrega se autopuntúa y entrega la tabla con el trabajo.
2. El auditor puntúa por separado, sin ver la autopuntuación.
3. Si difieren más de 15 puntos, gana el auditor y la diferencia se anota: es señal
   de que quien entrega no ve su propio punto ciego.
4. **Menos de 85 no se da por terminado.** No hay excepción por urgencia: un arreglo
   urgente mal verificado ya costó tres iteraciones.

## El candado que tenía esta rúbrica, y cómo se abre

La primera versión decía "menos de 85 no se publica". Combinado con una dimensión 1
que sólo llega a 30 probando en el teléfono, eso era un candado: **no se puede llegar
a 85 sin publicar, y no se puede publicar sin 85.** Lo destapó la segunda auditoría.

La confusión era tratar publicar como el final del trabajo. No lo es: **publicar es
cómo se consigue la evidencia de la dimensión 1.** Son dos decisiones distintas:

| Decisión | Qué exige |
|---|---|
| **Publicar como candidato** | Todo lo verificable acá, verificado. El único hueco que queda es el entorno real, declarado, con el guion de pruebas para el PM |
| **Dar la iteración por terminada** | Lo anterior **más** la prueba en el teléfono, con su resultado escrito |

Un candidato se publica diciendo que es un candidato y para qué se publica. Lo que el
puntaje bajo de la dimensión 1 impide no es publicar: impide **cantar victoria**.

Lo que el veto sigue frenando, sin excepción:

- Que algo se publique sin probar lo que **sí** se podía probar acá.
- Que una afirmación sin respaldo se reporte como verificada.
- Que un hallazgo de una auditoría anterior siga abierto sin decisión escrita.

Un candidato con la dimensión 1 en 18 sobre 30 se publica. Uno con 8, no: ése no probó
lo que tenía a mano.

El resultado de cada auditoría vive en `docs/auditoria/AAAA-MM-DD-<entrega>.md`.
