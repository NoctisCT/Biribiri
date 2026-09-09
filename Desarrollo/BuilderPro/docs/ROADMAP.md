# Builder Pro - Roadmap

## P0 - Cerrar Transform Core

`ORIENT`, `ROTATE_STRUCTURE`, altura Z, pivote manual y pivote autom?tico ya
est?n implementados.

Antes de cerrar definitivamente el bloque de transformaciones, completar la
matriz final de regresi?n:

- smoke exhaustivo de Z;
- smoke de rotaci?n estructural;
- pivote autom?tico y manual;
- colisiones externas durante rotaci?n;
- pilas con alturas forzadas;
- rollback en rechazo;
- selecci?n rectangular + transformaciones;
- Alt + drag despu?s de transformaciones;
- eliminar edge cases visuales del resaltado.

Cuando pase esta matriz, Transform Core puede considerarse cerrado.

## P1 - Copy / Duplicate / Paste

Implementar representaci?n r?gida relativa de una selecci?n.

Snapshot m?nimo por furni:

- base item;
- offset X;
- offset Y;
- offset Z;
- orientaci?n;
- datos extra necesarios.

El servidor debe validar el inventario completo antes de colocar nada.

Sin inventario suficiente:

- abortar;
- indicar d?ficit exacto;
- cero colocaciones parciales.

## P2 - Undo / Redo at?mico

Crear historial de operaciones Builder Pro.

Una transformaci?n grupal equivale a una sola entrada de historial.

Objetivo:

`operaci?n -> snapshot before -> snapshot after`

Undo y redo deben usar las mismas garant?as de rollback que las operaciones
normales.

## P3 - Precisi?n

A?adir:

- X exacta;
- Y exacta;
- Z exacta;
- offset X/Y/Z;
- mover N casillas;
- subir/bajar cantidad arbitraria.

La UI no debe obligar a repetir clics cuando el usuario ya conoce el valor.

## P4 - Align / Distribute

Align:

- izquierda;
- derecha;
- arriba;
- abajo;
- centro X;
- centro Y;
- opcionalmente Z.

Distribute:

- horizontal;
- vertical;
- distribuci?n uniforme.

Definir claramente qu? furni act?a como referencia y c?mo se conserva Z.

## P5 - Grupos y bloqueo

Permitir guardar una selecci?n como grupo l?gico.

Funciones:

- crear grupo;
- seleccionar grupo;
- renombrar;
- desagrupar;
- bloquear;
- desbloquear.

El bloqueo debe impedir modificaciones accidentales desde Builder Pro.

## P6 - Blueprints

Guardar una construcci?n como plantilla reutilizable.

Debe almacenar geometr?a relativa, no IDs de items de sala.

Al colocar un blueprint:

- comprobar inventario;
- comprobar sala;
- comprobar colisiones;
- comprobar l?mites;
- aplicar todo o nada.

## P7 - Selecci?n avanzada

A?adir:

- seleccionar todo;
- invertir selecci?n;
- filtros;
- selecci?n por tipo;
- dimensiones de selecci?n;
- informaci?n del bounding box;
- mejor feedback de cantidad y estado.

## P8 - Preview y UX profesional

A?adir:

- preview de destino m?s claro;
- preview de rotaci?n;
- preview de bounding box;
- Esc para cancelar;
- indicador de operaci?n pendiente;
- mejor feedback de errores;
- controles compactos para workflows frecuentes.

## P9 - Limpieza t?cnica

Cuando Builder Pro est? estable:

- retirar o reducir requestId trace de desarrollo;
- consolidar helpers duplicados;
- revisar protocolo;
- ampliar tests;
- documentar c?digos de error;
- revisar rendimiento con selecciones de 100 furnis.

## Futuro fuera del MVP

Evaluar posteriormente:

- wall furni;
- compatibilidad con sistemas especiales;
- permisos avanzados;
- colaboraci?n multiusuario;
- blueprints compartibles;
- import/export;
- herramientas de construcci?n adicionales.
