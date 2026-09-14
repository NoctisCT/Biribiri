# Builder Pro

Builder Pro es el sistema avanzado de construcción de Holo/Nitro.

**Estado:** v1 completada.
**Última actualización:** 2026-09-14.
**Fase final:** P15 cerrada.

Builder Pro permite seleccionar, mover, transformar, organizar, repetir,
reemplazar, agrupar, guardar, restaurar y reutilizar construcciones completas
manteniendo al servidor como autoridad final.

El alcance actual está centrado en **furnis de suelo**.

## Principios

Builder Pro sigue estas reglas:

- una operación grupal debe ser atómica;
- el servidor valida permisos, geometría, inventario y colisiones;
- nunca se inventan furnis ni se duplican IDs existentes;
- las operaciones que consumen inventario validan primero la operación completa;
- una operación fallida debe revertirse;
- Undo/Redo pertenece al usuario y a la sala concreta;
- los furnis ajenos no se modifican en operaciones que requieren propiedad;
- los grupos bloqueados se tratan como unidades lógicas;
- los límites del cliente y del backend deben coincidir con el límite real de la sala.

## Límites de producción

| Límite | Valor |
| --- | ---: |
| Furnis máximos por sala | **4000** |
| Selección máxima Builder Pro | **4000** |
| Tamaño máximo de Blueprint | **4000** |
| Preview/resultado masivo Nitro | **4000** |
| Altura máxima de furni | **100.0** |
| Entradas máximas de historial | **50** |
| Presupuesto de historial | **160000 ItemState** |

Los límites de Repeat, Grid, Fill, grupos, capas, bloqueos, traversables,
Blueprints y parsers Nitro se sincronizan con el máximo de sala cuando
corresponde.

## Protección por volumen

Las operaciones normales pequeñas no deben sentirse más lentas que la
construcción nativa.

El rate limit de operaciones sobre furnis depende de la cantidad real afectada:

| Furnis | Cooldown |
| --- | ---: |
| 1–10 | **0 ms** |
| 11–50 | 75 ms |
| 51–100 | 125 ms |
| 101–250 | 200 ms |
| 251–500 | 300 ms |
| 501–1000 | 450 ms |
| 1001–4000 | 750 ms |

Las operaciones de seguridad, como la restauración de Backup, mantienen
protecciones independientes.

## Herramientas

### Selección

- selección por clic;
- selección rectangular por área;
- selección múltiple;
- selección hasta 4000 furnis;
- inversión y selección por ámbito disponible en la UI;
- respeto de grupos bloqueados;
- capas de trabajo;
- resaltado visual y modo de resaltado oculto.

### Movimiento

- nudges X/Y;
- flechas de teclado;
- movimiento continuo manteniendo flecha;
- Alt + arrastrar;
- offset numérico X/Y/Z;
- igualar altura usando un furni de referencia;
- colocar encima de un furni de referencia;
- preview local antes de aplicar cuando corresponde.

### Transformación

- altura Z;
- orientación nativa de cada furni;
- rotación estructural alrededor de pivote;
- pivote automático;
- pivote manual;
- espejo;
- espejo + duplicado;
- preservación de geometría interna;
- rollback ante rechazo.

`ORIENT` y `ROTATE_STRUCTURE` son operaciones distintas:

- `ORIENT` conserva X/Y/Z y cambia la orientación;
- `ROTATE_STRUCTURE` transforma X/Y alrededor de un pivote y ajusta la orientación.

### Organizar

- fila;
- columna;
- apilar;
- separación configurable;
- validación espacial de colisiones;
- procesamiento preparado para selecciones grandes.

### Copiar, duplicar y pegar

El snapshot conserva la geometría relativa y el estado necesario de cada furni.

Antes de pegar:

1. se calcula la operación completa;
2. se valida el inventario;
3. se valida la sala;
4. se validan colisiones y límites;
5. se coloca todo o no se coloca nada.

No se crean furnis inexistentes.

### Repetición

- repetición lineal;
- cuadrícula;
- patrón radial;
- relleno hasta límite;
- relleno de sala;
- relleno de área seleccionada;
- previews visuales;
- validación previa de inventario;
- límite de 4000 furnis.

Los cálculos de Fill y Organizar usan validación espacial en lugar de una
comparación global O(n²).

### Reemplazar

Permite sustituir una selección usando un furni visible como referencia.

Se conservan, cuando corresponde:

- posición;
- altura;
- orientación compatible;
- capa;
- grupo;
- estado Atravesable.

La sustitución mantiene las reglas de inventario y rollback.

### Grupos

- crear;
- seleccionar;
- renombrar;
- cambiar miembros;
- bloquear/desbloquear;
- eliminar.

Un grupo bloqueado se completa automáticamente cuando una operación necesita
tratarlo como unidad.

### Capas

- crear;
- renombrar;
- eliminar;
- asignar;
- desasignar;
- seleccionar contenido;
- aislar una capa de trabajo;
- atenuar visualmente el resto;
- asignación automática de nuevos furnis a la capa activa cuando procede.

### Colisión / Atravesable

Builder Pro puede marcar furnis como atravesables manteniendo el estado
persistente y refrescando la colisión de la sala.

### Bloqueo de furnis

Existe bloqueo persistente de construcción para impedir modificaciones
accidentales desde acciones humanas compatibles con Builder Pro.

### Blueprints

- guardar una selección;
- listar;
- renombrar;
- eliminar;
- previsualizar;
- colocar;
- hasta 4000 furnis por Blueprint;
- consume inventario real;
- usa geometría relativa;
- colocación todo-o-nada.

El límite de lista de Blueprints es independiente del número de furnis que
puede contener cada Blueprint.

### Undo / Redo

El historial trabaja con operaciones lógicas completas.

Incluye operaciones de movimiento, transformación, colocación, recogida,
reemplazo y otras acciones compatibles.

Características:

- aislamiento por usuario + sala;
- máximo de 50 entradas;
- presupuesto de 160000 `ItemState`;
- una operación de 4000 furnis sigue siendo deshacible;
- las entradas antiguas se podan antes de consumir memoria sin límite;
- la restauración de un Backup invalida el historial activo de la sala.

### Backup de sala

Cada sala puede tener un Backup seguro.

Reglas principales:

- máximo de un Backup por sala;
- solo el propietario de la sala puede gestionarlo;
- guarda únicamente furnis propiedad del creador de la sala;
- los furnis de otros usuarios nunca se guardan, mueven ni restauran;
- si un furni ajeno bloquea una posición necesaria, la restauración se aborta;
- se restauran los IDs reales de los furnis cuando siguen perteneciendo al usuario;
- un furni vendido, eliminado o ya no poseído nunca se recrea;
- el Backup sobrevive a la eliminación de la sala;
- puede reconstruir una sala eliminada con un nuevo room ID;
- conserva configuración de sala y layout personalizado;
- la restauración es transaccional y dispone de rollback.

Seguridad:

- PIN independiente de 6–12 dígitos;
- PBKDF2-HMAC-SHA256;
- salt individual;
- comparación constante;
- 5 intentos fallidos provocan bloqueo temporal de 15 minutos;
- el PIN no se persiste en Nitro.

El paquete de estado de Backup devuelve resúmenes. Los furnis de una
restauración completa se sincronizan mediante el protocolo normal de sala, no
mediante una lista gigante dentro del resultado de Backup.

## Atajos

| Atajo | Acción |
| --- | --- |
| Flechas | mover selección |
| Mantener flecha | movimiento continuo |
| Alt + arrastrar | mover estructura con preview |
| Ctrl + clic en furni | recoger rápido |
| Shift + clic en furni | girar rápido |
| Escape | cancelar modo o preview transitorio |

`Ctrl` y `Shift` se usan por separado.

Si el furni pertenece a un grupo bloqueado, la acción rápida puede aplicarse a
la unidad lógica completa.

## Arquitectura

### Backend

Código principal:

- `BuilderProPlugin`
- `BuilderProPackets`
- servicios `Group*`, `*RepeatService`, `PasteGroupService`,
  `ReplaceGroupService`, `BuilderProBlueprintService`,
  `BuilderProHistoryService` y `BuilderProRoomBackupService`;
- repositorios persistentes de grupos, capas, traversables, bloqueos,
  Blueprints y Backups;
- handlers de protocolo bajo `handlers/`.

### Nitro

Componentes principales:

- `BuilderProView`
- `BuilderProToolRail`
- `BuilderProToolLifecycle`
- `BuilderProToolFlyout`
- `BuilderProOutlinerPanel`
- `BuilderProRoomBackupPanel`
- `BuilderProSelectionVisualizer`
- `BuilderProGhostPreview`

El protocolo personalizado vive en `nitro-renderer` mediante composers,
events y parsers Builder Pro.

### Protocolo

Builder Pro usa el rango de paquetes **6300–6340**.

Incluye familias para:

- Move;
- Transform;
- Copy/Paste;
- History;
- Offset;
- Layout;
- Groups;
- Traversal;
- Blueprints;
- Pickup;
- Layers;
- Reference Placement;
- Mirror Duplicate;
- Replace;
- Linear/Grid/Radial Repeat;
- Fill;
- Item Lock;
- Room Backup.

## Rendimiento

Las operaciones grandes evitan ráfagas innecesarias:

- Move/Transform/Layout/Offset difieren actualizaciones visuales en chunks;
- persistencia normal se programa de forma asíncrona;
- Fill y Organizar usan índices espaciales para validación interna;
- los límites y parsers permiten cargas de hasta 4000 furnis;
- las operaciones pequeñas no reciben cooldown artificial por pertenecer a una
  categoría "masiva".

La optimización futura de Undo/Recoger sobre selecciones muy grandes puede
mejorarse sin afectar a la corrección funcional de v1.

## Build

Backend:

```text
mvn -q clean package -DskipTests
```

Nitro:

```text
yarn build
```

No ejecutar `yarn install` indiscriminadamente sobre esta instalación:
el proyecto contiene integraciones personalizadas de Nitro.

## Estado final

Builder Pro v1 se considera **terminado y listo para producción** tras P15.

Las ampliaciones futuras son opcionales y no forman parte del cierre de v1.
