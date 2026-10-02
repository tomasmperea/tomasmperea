# VAL-85 — lo que se aprendió a sacar también dice "el viaje cambió"

Brief de trabajo. Lo que está acá se construye; lo que no está acá, no.

**Prioridad del PM (02/10):** primero esto, después VAL-66.

## Qué pasa, reproducido

Una lista armada antes de aprender nada trae «Cámara y cargador» pendiente. La persona la descartó en dos
viajes de la misma combinación. Abre la lista sin tocar el viaje:

```
sacados: Cámara y cargador · nuevos: 0
motivo: «El viaje cambió: saco 1 que ya no corresponde.»
```

Idéntico contra el motor de antes y de después de VAL-77b: es anterior. El viaje no cambió; **se aprendió a no
sugerirlo**. Es la misma causa inventada que VAL-77b arregló del lado de lo que se suma.

## El dato ya existe

`buildPackingList` guarda en la lista nueva `aprendizaje.suprimidos`: las claves que se dejaron de sugerir por
lo aprendido. Un ítem de `sacados` cuya clave canónica está ahí **se saca por lo aprendido**. No hay que
inventar nada: hay que leerlo.

**El vecino que hay que decidir leyendo:** un ítem puede estar suprimido Y además su regla puede haber dejado
de aplicar porque el viaje sí cambió. Atribuirlo a "lo aprendido" sería medio falso. Decidí con qué criterio se
distingue y escribí por qué. Si no se puede distinguir con confianza, el texto no afirma ninguna de las dos.

## Lo que tiene que pasar

1. Cada ítem de `sacados` lleva su causa, igual que cada ítem de `nuevos` lleva su origen.
2. `planSoloAprendido` deja de exigir `sacados` vacío: es verdadera cuando **todo** lo que el plan suma viene
   del historial y **todo** lo que saca viene de lo suprimido, y hay al menos una de las dos cosas.
3. Los cinco sitios que VAL-77b ya tocó —`motivoDelPlan`, la tira de entrada, `planAvisoTexto`, el aviso de
   sólo lectura y la hoja «De dónde sale»— cubren las tres formas de un plan "sólo aprendido": sólo suma, sólo
   saca, y las dos. Texto en la voz del proyecto, que nombre la causa real: lo que descartaste en otros viajes.
4. **`planListUpdateAsync` recalcula `sacados`** después de la capa de IA. La causa tiene que sobrevivir a ese
   recálculo. Y lo que saca o suma la IA no es "lo aprendido".
5. Cuando hay al menos un cambio que no es de lo aprendido, el texto de hoy se queda como está.

## Lo que NO entra

Cambiar cómo se suprime (la decisión 4 de VAL-77b sigue en pie). Rediseñar los avisos. VAL-66.

## Cómo se prueba

- **El gesto:** dos viajes de la misma combinación donde se descarta un ítem tocando el botón de descartar; un
  tercero armado antes; abrirlo. Por los dos disparadores: entrar a la valija y guardar una reserva.
- Las tres formas: sólo saca, sólo suma, las dos.
- **El control:** un cambio real del viaje que saca algo sigue diciendo que el viaje cambió.
- El vecino del ítem suprimido cuya regla además dejó de aplicar.
- Un control negativo por cada sitio, y uno que falle si la causa no sobrevive al recálculo de la IA.
- Las regresiones enteras, `las-dos-copias.js`, y los arneses de VAL-77b corridos después.

## Antes de commitear

Las cuatro preguntas de CLAUDE.md. En particular la 2: los arneses de VAL-77b —`val77b-lo-aprendido-no-es-un-cambio.js`
sobre todo— se corren **después** del arreglo, explícitamente.

**70 candidato, 85 terminado.** `git add` con rutas exactas.
