# Autoevaluación del Product Owner — 59 / 100

**Fecha:** 11 de septiembre de 2026
**Alcance:** todo lo entregado hasta hoy (iteración 1, 1.5 y 2)
**Pedido por:** el PM, después de que el mismo bug volviera tres veces

Esta no es la auditoría de una entrega: es la de quien coordina. La escribo yo mismo
porque el problema que hay que explicar es mío.

---

## El puntaje

| # | Dimensión | Peso | Obtenido | Por qué |
|---|---|---|---|---|
| 1 | Verificación en el entorno real | 30 | **8** | Cuatro defectos llegaron al usuario por la misma causa |
| 2 | Diagnóstico de causa raíz | 15 | **7** | Acerté la causa de la persistencia; fallé dos veces seguidas en importar |
| 3 | Honestidad de lo verificado | 15 | **9** | Declaré lo del CDN sin que me lo pidieran; dije "verificado" sobre los botones sin serlo |
| 4 | Cumplimiento del contrato | 15 | **13** | Las funciones entregadas cumplen los criterios de sus briefs |
| 5 | Calidad interna | 15 | **13** | 109 pruebas en verde, motores separados y documentados, un archivo un dueño |
| 6 | Diseño y decisiones de producto | 10 | **9** | Ninguna decisión de producto fue devuelta; varias las validó el PM |
| | **Total** | **100** | **59** | |

---

## El dato que explica el número

Conté los defectos de todo el proyecto y los separé en dos: los que frenamos nosotros
y los que llegaron al PM.

**Frenados por QA antes de publicar — 7**
contador de progreso trabado · descartados que desaparecían sin retorno · tarjeta de
embarque descartada en silencio · escrituras aplicadas antes del guardado final ·
`provider` guardado sin mostrarse · el plan viejo que pisa la lista nueva · la
categoría plegada que nunca limpia la marca.

**Llegados al PM — 8**
no guardaba ni mostraba datos · cuatro toques para eliminar un viaje · los botones de
importar muertos (tres reportes, sigue abierto) · el PDF que no carga · el regreso
podía ser anterior a la salida · descartar no bajaba el subtotal · la visa en destinos
donde no hace falta · puerta y terminal pedidas donde no existen.

**Tasa de escape: 8 de 15, el 53%.** Más de la mitad de los defectos los encontró él.
Ese es el número que hay que mover, y ninguna otra dimensión lo mueve.

---

## La causa, que es una sola

Los cuatro defectos más caros tienen la misma forma: **probé en un entorno cómodo y
reporté como si hubiera probado en el suyo.**

| Defecto | Dónde probé | Dónde falla |
|---|---|---|
| No guardaba datos | `localStorage`, con un simulador escrito de memoria | La base real, cuyo contrato leí mal |
| Botones muertos (1ª vez) | Disparando el evento del campo de archivo | El dedo tocando el botón |
| Botones muertos (2ª y 3ª) | Chromium de escritorio, con dedo y con mouse | El visor del teléfono |
| PDF que no carga | No lo probé: el repositorio está bloqueado acá | El teléfono, donde sí baja |

No es un problema de cuidado ni de velocidad: **repetí cuatro veces la misma decisión
equivocada sobre qué cuenta como prueba.** Y la tercera vez, con el bug ya reportado
dos veces, volví a decir "verificado" apoyado en un navegador de escritorio.

---

## Lo que el puntaje también dice

Calidad interna 13 sobre 15 y diseño 9 sobre 10 no son de adorno. **El trabajo está
bien hecho; lo que falla es el último metro:** demostrar que funciona donde él lo usa.
Un motor con 66 pruebas en verde no vale nada si el botón que lo llama está muerto.

Por eso la rúbrica le da a la verificación el doble de peso que a cualquier otra
dimensión. No es simetría: es dónde está el agujero.

---

## Qué cambia a partir de acá

1. **Un auditor con veto.** `.claude/agents/auditor.md`. Corre antes de publicar,
   verifica las afirmaciones en vez de repetirlas, puntúa, y menos de 85 no sale.
2. **"Verificado" pasa a tener una definición escrita** en `CLAUDE.md`, con la tabla
   de qué NO prueba cada sustituto. Decir "probado en Chromium de escritorio" es
   correcto; decir "verificado" sobre eso, no.
3. **Dos hipótesis vivas exigen un experimento que las separe** antes de tocar código.
   Si acá no se puede correr, se pregunta. Una pregunta cuesta un minuto; un arreglo
   equivocado costó tres iteraciones.
4. **Iteraciones más largas.** Es lo que pidió el PM y es lo correcto: publicar rápido
   algo sin verificar no es velocidad, es deuda con interés.

---

## Lo que sigo sin poder verificar desde acá

- El visor de artifacts del teléfono: no lo tengo. Es donde vive el bug abierto.
- Cualquier cosa que dependa del repositorio de librerías externas: bloqueado por
  política de la red de este entorno. Afecta al PDF y a la lectura de PDFs.

Las dos van declaradas en cada entrega que las toque, con los pasos para que las
compruebe el PM. No se vuelven a reportar como funcionando.
