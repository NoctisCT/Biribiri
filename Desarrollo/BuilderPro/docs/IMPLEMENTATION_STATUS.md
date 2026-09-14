# Builder Pro - Implementation Status

**Última actualización:** 2026-09-14
**Versión:** v1
**Estado general:** **COMPLETADO / PRODUCCIÓN**

## Resumen

| Área | Estado | Notas |
| --- | --- | --- |
| UI Builder Pro | HECHO | Tool rail, flyouts, paneles, Outliner y feedback |
| Selección múltiple | HECHO | Hasta 4000 furnis |
| Selección rectangular | HECHO | Área sobre canvas |
| Selección avanzada | HECHO | Inversión, ámbitos y grupos/capas |
| Movimiento X/Y | HECHO | Backend autoritativo |
| Movimiento continuo | HECHO | Flechas mantenidas |
| Alt + drag | HECHO | Preview local |
| Offset X/Y/Z | HECHO | Valores numéricos |
| Igualar altura | HECHO | Referencia visible |
| Colocar encima | HECHO | Referencia visible |
| Altura Z | HECHO | Operación grupal |
| Orientación nativa | HECHO | Conserva X/Y/Z |
| Rotación estructural | HECHO | Pivote automático/manual |
| Espejo | HECHO | Transformación |
| Espejo + duplicado | HECHO | Consume inventario |
| Organizar fila | HECHO | Izquierda/derecha |
| Organizar columna | HECHO | Arriba/abajo |
| Apilar | HECHO | Altura máxima global 100.0 |
| Copy | HECHO | Snapshot relativo |
| Paste | HECHO | Inventario real, todo-o-nada |
| Duplicate | HECHO | Basado en Copy/Paste |
| Replace | HECHO | Referencia + rollback |
| Repeat lineal | HECHO | Preview + execute |
| Grid Repeat | HECHO | Preview + execute |
| Radial Repeat | HECHO | Preview + execute |
| Relleno hasta límite | HECHO | Hasta 4000 furnis |
| Relleno de sala | HECHO | Validación espacial |
| Relleno de área | HECHO | Área seleccionada |
| Grupos persistentes | HECHO | CRUD |
| Grupos bloqueados | HECHO | Unidad lógica |
| Capas | HECHO | CRUD + asignación |
| Capa de trabajo | HECHO | Aislar/atenuar |
| Atravesable | HECHO | Persistente |
| Bloqueo de furnis | HECHO | Persistente |
| Blueprints | HECHO | Hasta 4000 furnis |
| Preview Blueprint | HECHO | Ghost placement |
| Undo / Redo | HECHO | Usuario + sala |
| Pickup con Undo | HECHO | Ownership validado |
| Backup de sala | HECHO | Un Backup por sala |
| PIN de Backup | HECHO | PBKDF2-HMAC-SHA256 |
| Recuperar sala eliminada | HECHO | Nuevo room ID |
| Layout personalizado en Backup | HECHO | Restaurable |
| Protección de furnis ajenos | HECHO | Nunca se modifican |
| Escape cancelar | HECHO | Política unificada |
| Ayuda `?` | HECHO | Atajos actuales |
| Tooltip propio | HECHO | Sin tooltip nativo duplicado |
| Rate limit por volumen | HECHO | Sin penalizar operaciones pequeñas |
| Chunks visuales | HECHO | Move/Transform/Layout/Offset |
| Parser de cargas masivas | HECHO | Hasta 4000 furnis |
| Historial acotado | HECHO | 50 entradas / 160000 ItemState |
| Build backend | PASS | P15 final |
| Build Nitro | PASS | P15 final |
| Auditoría estática P15 | PASS | Seguridad/ownership/atomicidad |
| Stress P15 | PASS | Escenarios masivos |
| Wall furni | FUERA v1 | Posible ampliación futura |

## Límites actuales

| Concepto | Valor |
| --- | ---: |
| `Room.MAXIMUM_FURNI` | **4000** |
| `MAX_SELECTION` | **4000** |
| Blueprint máximo | **4000** |
| Repeat/Fill máximo | **4000** |
| Parsers Nitro de furnis | **4000** |
| Altura máxima | **100.0** |
| Historial máximo | **50 entradas** |
| Presupuesto historial | **160000 ItemState** |

## Invariantes principales

### Movimiento

La estructura conserva sus diferencias internas X/Y/Z.

Las colisiones externas se validan antes de confirmar el movimiento.

### Transformación

`ORIENT` conserva X/Y/Z.

`ROTATE_STRUCTURE` transforma físicamente X/Y alrededor del pivote.

Las operaciones grupales revierten ante fallo.

### Copy / Paste / Repeat / Blueprint

Nunca pueden inventar furnis.

Antes de crear una estructura se valida:

1. inventario;
2. capacidad de sala;
3. geometría;
4. colisiones;
5. operación completa.

La colocación es todo-o-nada.

### Replace

Solo reemplaza furnis que cumplen las reglas de propiedad e inventario.

Mantiene metadata compatible y dispone de rollback.

### Undo / Redo

La clave de historial combina usuario y sala.

El historial no puede aplicarse a otra sala.

La restauración de un Backup invalida el historial activo.

### Backup

El Backup contiene exclusivamente furnis propiedad del propietario de la sala.

Un furni ajeno:

- no se guarda;
- no se mueve;
- no se elimina;
- no se restaura;
- puede bloquear una restauración si ocupa un destino necesario.

No se fabrica un furni vendido, eliminado o que ya no pertenece al usuario.

## Seguridad del Backup

- PIN de 6–12 dígitos;
- salt por Backup;
- PBKDF2-HMAC-SHA256;
- iteraciones de derivación elevadas;
- comparación constante;
- 5 fallos → bloqueo temporal de 15 minutos;
- PIN no persistido en el cliente.

## Rendimiento

P15 eliminó cuellos de botella importantes:

- validación espacial para Fill;
- validación espacial para Organizar;
- updates visuales diferidos por chunks;
- persistencia normal asíncrona;
- rate limit por cantidad real;
- parsers Nitro sincronizados con el límite de sala.

Prueba real de Fill con varios cientos de furnis completó la colocación sin
bloqueo grave de sala.

Undo/Recoger sobre operaciones grandes todavía puede optimizarse más en una
fase post-v1, pero funciona correctamente y no bloquea el cierre funcional.

## Atajos

| Atajo | Acción |
| --- | --- |
| Flechas | Mover |
| Mantener flecha | Movimiento continuo |
| Alt + arrastrar | Mover con preview |
| Ctrl + clic | Recoger |
| Shift + clic | Girar |
| Escape | Cancelar modo/preview |

## Cierre

P15 quedó cerrado en:

`7f80de95561d967cc8b6c1b9569e0455a13e89e4`

Builder Pro v1 se considera oficialmente terminado.
