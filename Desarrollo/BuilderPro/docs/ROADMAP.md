# Builder Pro - Roadmap

**Estado:** v1 completada.
**Última actualización:** 2026-09-14.

Este archivo deja de ser una lista de pendientes de implementación y pasa a
ser el registro de cierre del roadmap de Builder Pro v1.

## P0–P9 — Núcleo original

**Estado: CERRADO**

El roadmap original quedó completado:

- núcleo de transformaciones;
- Copy / Duplicate / Paste;
- Undo / Redo atómico;
- precisión X/Y/Z y offsets;
- organización de estructuras;
- grupos persistentes y bloqueo;
- Blueprints;
- selección avanzada;
- previews y UX;
- limpieza técnica inicial.

Las antiguas entradas que figuraban como no completadas ya no representan
el estado actual del proyecto.

## P10–P12 — Expansión de herramientas

**Estado: CERRADO**

La v1 amplió el núcleo con herramientas y persistencia adicionales:

- repetición lineal;
- cuadrícula;
- patrón radial;
- reemplazo por referencia;
- capas;
- capa de trabajo;
- Atravesable;
- bloqueo persistente de furnis;
- espejo y espejo duplicado;
- colocación por referencia;
- mejoras de selección y Outliner;
- previews transitorios unificados.

## P13 — Fill Area + historial/protocolo

**Estado: CERRADO**

Incluye:

- Fill lineal/hasta límite;
- relleno de sala;
- relleno de área seleccionada;
- preview visual;
- sincronización de resultados;
- Undo/Redo compatible;
- correcciones de ownership del historial;
- protocolo final de Fill;
- parsers preparados para cargas grandes.

## P14 — Backup seguro de salas

**Estado: CERRADO**

Incluye:

- un Backup por sala;
- PIN independiente;
- PBKDF2-HMAC-SHA256;
- bloqueo temporal por intentos fallidos;
- furnis del propietario únicamente;
- restauración exacta de items;
- protección de furnis ajenos;
- recuperación de salas eliminadas;
- restauración de layout personalizado;
- rollback;
- integración Nitro.

## P15 — Producción, límites y QA

**Estado: CERRADO**

### P15.1 — Límites y rendimiento

- límite de sala elevado a 4000;
- Builder Pro sincronizado a 4000;
- altura máxima elevada a 100.0;
- rate limit por cantidad real de furnis;
- operaciones pequeñas sin cooldown artificial;
- actualizaciones visuales masivas en chunks.

### P15.2 — Seguridad, ownership y atomicidad

- auditoría de permisos;
- auditoría de ownership;
- packet bounds;
- rollback;
- aislamiento de Undo/Redo por sala;
- presupuesto de historial;
- invariantes de Backup.

### P15.3 — Stress y rendimiento

- modelos 100/250/500/1000/2500;
- eliminación de validaciones globales O(n²) en rutas críticas;
- persistencia normal asíncrona;
- mejoras de Move/Transform/Layout/Offset;
- Fill validado con cargas grandes.

### P15.4 — UI y polish

- tooltip personalizado único;
- eliminación del `title` duplicado;
- textos corregidos;
- feedback compartido;
- ayuda `?` actualizada con atajos actuales.

### P15.5 — Finalización

- máximo global de 4000 furnis;
- parsers Nitro sincronizados;
- presupuesto de historial de 160000 `ItemState`;
- limpieza de trazas temporales;
- builds finales;
- auditoría completa;
- commit y push de producción.

Commit de cierre P15:

`7f80de95561d967cc8b6c1b9569e0455a13e89e4`

## Builder Pro v1

**COMPLETADO**

La v1 queda cerrada con:

- servidor autoritativo;
- operaciones atómicas;
- límite de 4000 furnis;
- herramientas de selección, movimiento, transformación y organización;
- Copy/Paste/Duplicate;
- Repeat y Fill;
- Replace;
- grupos y capas;
- Atravesable y locks;
- Blueprints;
- Undo/Redo;
- Backup seguro de sala;
- UI y protocolo Nitro completos.

## Post-v1 opcional

Estas ideas no bloquean ni reabren Builder Pro v1:

- wall furni;
- Blueprints compartibles;
- import/export;
- colaboración multiusuario más avanzada;
- optimización adicional de Undo/Recoger para operaciones muy grandes;
- nuevas herramientas de construcción que no formen parte del alcance actual.

Cualquier ampliación futura debe abrirse como una nueva fase posterior a v1,
no como deuda pendiente de P15.
