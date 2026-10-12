# v45 — el resultado de la ronda del PM

**Fecha:** 12/10/2026 · **Build:** v45 (app Versión 39, «Valija beta» Versión 3) · **Historias:** VAL-99,
VAL-101, la quita de «Próxima iteración»

Textual: *"todo el guión de beta está validado"*.

| Paso del guion (`docs/qa/v45-guion.md`) | Resultado |
|---|---|
| Beta 1 · «en este dispositivo», v45 y el aviso del teléfono | OK |
| Beta 2 · «Acerca de» sin «Próxima iteración» y con los datos en este teléfono | OK |
| Beta 3 · Compartir sólo con el resumen; Pendientes «guardado en este teléfono» | OK |
| Beta 4 · Importar pegando un mail, aceptando el permiso | OK |
| Beta 5 · Armar la valija | OK |
| Tu app (sección 2 del guion) | **Sin reporte explícito**: el PM validó «el guion de beta» |
| «Contanos» | OK desde el 11/10 (comentario «prueba», anclado a la pantalla de inicio) |

**Verificado en el teléfono del PM:** VAL-99 y VAL-101 en «Valija beta».

**Lo que esto NO contesta**, y sigue siendo trabajo de la primera persona (`docs/beta/una-persona.md`): todo
lo probado acá se probó con **la cuenta del dueño**. Que alguien de afuera pueda abrir el link, que le ande la IA
con su cuenta (o sin pagar), que sus viajes sigan al otro día y que pueda comentar, no se sabe todavía.

## Adenda del 12/10 — la beta abierta en Chrome de incógnito

Idea del PM: incógnito es lo más parecido a una persona de afuera **sin sesión en Claude**. Textual:

> *"la funcionalidad de importar no está disponible (no puedo sacar capturas porque dice que la aplicación no
> lo permite) es decir, está el botón de importar pero me dice que hay que agregar la info manual / valija se
> arma pero dice que no lo puede ajustar al destino"*

| Pregunta del kit | Respuesta, sin sesión en Claude |
|---|---|
| 1 · ¿Se puede abrir el link desde afuera? | **Sí.** Abre sin cuenta |
| 2 · ¿Anda la IA? | **No.** Importar dice que hay que cargar a mano; la valija se arma con reglas y avisa que no pudo ajustarla al destino. Es exactamente lo medido acá con la IA apagada (`docs/decisiones/ia-para-cualquiera.md`) |
| 3 · ¿Los viajes siguen al otro día? | **No se puede contestar en incógnito**: incógnito borra todo al cerrar, a propósito |
| 4 · ¿Aparece «Contanos»? | Sin reporte |

El PM aclara que para feedback de UX esto no sirve («no es una opinión genuina»); sirve para las preguntas de
funcionamiento. Lo que sigue sin saberse es qué pasa con una cuenta de Claude **gratuita**.
