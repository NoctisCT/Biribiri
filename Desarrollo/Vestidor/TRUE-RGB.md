# Biribiri Vestidor — Color libre HEX/RGB

## Implementación

La V3 introduce color libre real, no una aproximación a la paleta Habbo.

Los colores personalizados se codifican dentro del propio `figure string` como IDs positivos deterministas:

`100000000 + RGB_24_BITS`

Ejemplo conceptual:

- HEX `#7B3FF2`
- RGB entero `0x7B3FF2`
- ID Biribiri `100000000 + 0x7B3FF2`

Esto mantiene la forma estándar del figure string (`ch-215-ID`) y permite que Arcturus lo persista y lo retransmita como cualquier otro look.

## Renderer

`Palette.getColor()` reconoce el rango reservado de Biribiri. Cuando encuentra uno de esos IDs, genera dinámicamente un `PartColor` cuyo `rgb` es el color de 24 bits codificado.

El pipeline normal del avatar usa después `container.color.rgb`, por lo que el tinte es real y pasa por el mismo renderizado que los colores oficiales.

## Editor

El selector mantiene la paleta clásica y añade:

- selector visual nativo;
- HEX;
- R;
- G;
- B.

Al elegir un color libre, `CategoryData` crea un item sintético seleccionable para que el estado del editor siga siendo consistente y el ID personalizado forme parte de `FigureData.getFigureString()`.

## Persistencia

No se usa `localStorage`.

Los colores viajan dentro del look:

- look actual del usuario;
- `users_wardrobe`;
- datos de usuario enviados a sala;
- previews que utilicen el renderer Biribiri.

## Compatibilidad

El rango reservado es:

- mínimo: `100000000`
- máximo: `116777215`

Los IDs normales de paleta siguen funcionando sin cambios.

Si el servidor activa `ClothingValidationManager.VALIDATE_ON_CHANGE_LOOKS`, Arcturus puede sustituir IDs de color que no existan en su figuredata. La instalación no desactiva esa validación global automáticamente. Si Biribiri la activa en el futuro, habrá que extender la validación server-side para reconocer el rango reservado en vez de deshabilitar seguridad.

## V3.1 — pulido de interacción

- La barra libre queda separada visualmente de la paleta clásica.
- Los campos R/G/B inline se eliminan; el selector nativo ya ofrece edición avanzada y el HEX permanece visible.
- El arrastre del selector usa preview ligero limitado a ~25 FPS y commit diferido, evitando regenerar todos los thumbnails en cada micro-movimiento.
- Cada paleta mantiene como máximo un item sintético RGB reutilizable; arrastrar ya no acumula cientos de colores artificiales en memoria.
- En `hd` (caras/piel), el color libre actualiza el avatar y el figure string, pero no fuerza regeneración de todos los thumbnails de caras con el color sintético. Así permanecen visibles.
- Los slots EXTRA no muestran números individuales; la navegación inferior ya identifica la página.

## V3.2 — thumbnails RGB + rendimiento

- Los thumbnails de todas las categorías, incluido `hd`, vuelven a reflejar el color RGB libre.
- El avatar principal mantiene preview en vivo durante el arrastre.
- Los thumbnails no se regeneran por cada movimiento del ratón: se actualizan al confirmar/cerrar el selector.
- La regeneración de thumbnails se reparte en lotes por `requestAnimationFrame`, evitando bloquear el hilo principal durante varios cientos de milisegundos.
- El input de color deja de ser controlado por estado React durante el arrastre. HEX y picker se sincronizan por refs, reduciendo renders del editor.
- La paleta de presets se memoiza y no se recalcula en cada evento del picker.

## V3.3 — aplicar RGB al soltar

El selector nativo ya no modifica el avatar ni los thumbnails mientras el usuario arrastra por la paleta.

Comportamiento:

1. Durante `input`: solo cambia la muestra nativa y el texto HEX.
2. El figure string permanece intacto mientras se arrastra.
3. En `change` (confirmar/soltar/cerrar el selector): se aplica una sola vez el RGB al avatar y se regeneran los thumbnails.
4. Esto evita que las caras desaparezcan temporalmente durante el movimiento y elimina trabajo de render innecesario.

## V3.4 — color diferido + carga progresiva

### Selector RGB

Chrome puede emitir `change` repetidamente dentro de su selector nativo, por lo que `change` no equivale necesariamente a "soltar".

Biribiri V3.4 trata tanto `input` como `change` como **valor pendiente**. Durante el movimiento:

- no cambia el figure string;
- no cambia el avatar;
- no se regeneran thumbnails;
- únicamente se refleja el HEX.

El color se confirma después de 450 ms sin nuevos eventos o inmediatamente al cerrar/perder foco.

### Cambio de categoría

La primera apertura de una categoría podía inicializar todos sus thumbnails de forma seguida y bloquear el hilo principal.

Ahora:

- se cancelan inicializaciones pendientes de la categoría anterior;
- la categoría activa inicializa un pequeño primer lote;
- el resto de thumbnails se genera por lotes mediante `requestAnimationFrame`;
- el selector HEX se sincroniza con `useLayoutEffect`, antes del paint, evitando el flash blanco.

## V3.5 — pipeline específico para caras (`hd`)

Se identificó la causa concreta del bug: las caras no siguen el mismo pipeline que la ropa.

Nitro crea `FACE` con `usesColors = false` y `BodyModel` genera cada preview creando un `AvatarImage` de tipo `HEAD`. La ruta RGB genérica estaba forzando `partColors` también sobre `hd`, lo que hacía que `AvatarEditorGridPartItem` reutilizara un `thumbContainer` especial de cara por la ruta equivocada.

V3.5 corrige esto:

- `hd` deja de usar la regeneración genérica de `partColors`.
- colores normales y RGB libre regeneran las caras mediante `BodyModel` + `AvatarSetType.HEAD`;
- los previews de caras se generan en lotes de 2 por frame;
- al salir de la pestaña de caras se cancela cualquier trabajo pendiente;
- al volver, se reconstruyen desde el color actual;
- esto reduce también la carga que podía seguir ejecutándose al abrir camisetas.

## V3.6 — prueba de carga instantánea de caras

Prueba controlada sobre el estado V3.5 estable:

- se mantiene el pipeline correcto `BodyModel -> AvatarImage -> HEAD`;
- se elimina únicamente el reparto de 2 caras por `requestAnimationFrame`;
- todas las miniaturas de `hd` se regeneran en la misma pasada;
- se conserva el `generation token` y la cancelación al abandonar la pestaña;
- el resto del lazy init de categorías permanece intacto.

Objetivo: comprobar si el coste real de las caras es suficientemente bajo como para cargarlas todas de golpe sin reintroducir lag perceptible.

## V3.7 — todas las categorías instantáneas + refresh al reabrir

Después de comprobar que `FACE/hd` funciona correctamente sin batching, se elimina también el lazy init de las categorías normales.

Cambios:

- `CategoryData.init()` inicializa todos los thumbnails de la categoría en la misma pasada.
- Se elimina la cola de `requestAnimationFrame` de 6 en 6 usada por V3.4.
- `AvatarEditorModelView` deja de cancelar colas de init porque ya no existen.
- `AvatarEditorGridPartItem.init()` vuelve a ejecutar `update()` si el item ya estaba inicializado.
- Esto corrige el caso en el que se cerraba y reabría el editor y algunos thumbnails quedaban vacíos hasta cambiar un color: si el asset terminó de estar disponible después del primer intento, al reabrir se fuerza un nuevo render.

Se mantiene intacto:

- pipeline específico FACE/HEAD de V3.5;
- caras instantáneas de V3.6;
- batching de cambios de color de prendas;
- RGB libre y persistencia actual.

## V4.0 FIX2 — recuperación exacta a V3.7

Se descartan por completo los experimentos V3.8/V3.9 de prewarm/downloader.

La fuente del avatar editor se restaura desde el snapshot completo
`Desarrollo-AvatarEditor.before` guardado justo antes de V3.8, es decir,
el estado V3.7 que sí cargaba camisetas, pantalones, pelo y caras.

El renderer se restaura desde el backup previo a V3.9.

No se aplican optimizaciones nuevas en esta recuperación: primero se recupera
el último estado funcional conocido. El cold-load inicial se estudiará aparte
sin tocar de nuevo el ciclo de descarga de Nitro.

