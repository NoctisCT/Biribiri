# Builder Pro - Implementation Status

?ltima actualizaci?n: 2026-09-09

| ?rea | Estado | Notas |
| --- | --- | --- |
| UI base Builder Pro | HECHO | Panel Nitro operativo |
| Multiselecci?n | HECHO | Clic normal additive/toggle |
| Selecci?n rectangular | HECHO | Captura sobre canvas |
| Movimiento grupal X/Y | HECHO | Backend autoritativo |
| Pasos X/Y | HECHO | Configurables |
| Teclado / flechas | HECHO | ACK-chain + 200 ms |
| Watchdog movimiento | HECHO | Recupera UI ante p?rdida de ACK |
| Alt + drag | HECHO | Preview local + env?o ?nico al soltar |
| Preview de movimiento | HECHO | No spamea MOVE_GROUP |
| Colisiones 3D | HECHO | Volumen de construcci?n |
| Preservar pilas imposibles | HECHO | X/Y/Z relativo intacto |
| Altura Z grupal | HECHO | 0.1 / 0.5 / 1 |
| Ocultar resaltado | HECHO | La selecci?n permanece activa |
| Rotar estructura | HECHO | Operaci?n independiente |
| Pivote autom?tico | HECHO | Primer furni ordenado |
| Pivote manual | HECHO | Selecci?n expl?cita |
| Indicador de pivote | HECHO | ?mbar |
| Girar furnis localmente | HECHO | Giro nativo Nitro/Holo; diagonales y X/Y/Z preservados |
| RequestId trace | HECHO DEV | Pendiente limpieza futura |
| Copy / Paste | PENDIENTE | Debe consumir inventario real |
| Duplicar | PENDIENTE | Misma regla de inventario |
| Undo / Redo | PENDIENTE | Operaciones at?micas |
| Align | PENDIENTE | X/Y/Z seg?n modo |
| Distribute | PENDIENTE | Espaciado uniforme |
| Grupos persistentes | PENDIENTE | Agrupar/desagrupar |
| Lock de grupos | PENDIENTE | Evitar modificaciones accidentales |
| Blueprints | PENDIENTE | Guardar estructuras reutilizables |
| Editor X/Y/Z exacto | PENDIENTE | Inputs num?ricos |
| Offset num?rico | PENDIENTE | Transformaciones precisas |
| Select all | PENDIENTE | Selecci?n r?pida |
| Invert selection | PENDIENTE | Complemento de selecci?n |
| Filtros de selecci?n | PENDIENTE | Tipo/categor?a/etc. |
| Dimensiones selecci?n | PENDIENTE | Bounding box |
| Preview rotaci?n profesional | PENDIENTE | Mejor feedback visual |
| Esc cancelar preview | PENDIENTE | Restauraci?n inmediata |
| Wall furni | FUERA MVP | Builder Pro actual es floor furni |

## Invariantes

### MOVE

`MOVE` conserva exactamente Z y las diferencias X/Y/Z internas.

### HEIGHT

`HEIGHT` modifica Z de forma uniforme y conserva X/Y.

### ORIENT

`ORIENT` conserva exactamente X/Y/Z y cambia ?nicamente la direcci?n.

Est? implementado y validado manualmente.

Nitro calcula para cada furni su siguiente direcci?n permitida usando la
sem?ntica nativa de giro. El servidor recibe la orientaci?n destino exacta y
la aplica dentro de la operaci?n grupal autoritativa.

### ROTATE_STRUCTURE

`ROTATE_STRUCTURE` modifica X/Y alrededor de un pivote y cambia la orientaci?n
para acompa?ar la rotaci?n de la estructura.

Es una operaci?n distinta de `ORIENT`.

## Copy / Paste

Nunca puede inventar furnis.

Antes de colocar una copia:

1. el servidor calcula todos los furnis necesarios;
2. valida el inventario real del usuario;
3. si falta cualquier cantidad, aborta;
4. devuelve el d?ficit exacto;
5. no coloca ninguna parte de la estructura.

Ejemplo conceptual:

`Faltan 2 Wired Trigger y 1 Divider.`

La operaci?n debe ser todo-o-nada.

## Undo / Redo

El historial futuro debe trabajar sobre operaciones l?gicas completas, no sobre
cada furni individual.

Tipos previstos:

- MOVE
- HEIGHT
- ORIENT
- ROTATE_STRUCTURE
- DUPLICATE
- ALIGN
- DISTRIBUTE

Cada entrada debe contener snapshot anterior y posterior suficientes para
rollback at?mico.
