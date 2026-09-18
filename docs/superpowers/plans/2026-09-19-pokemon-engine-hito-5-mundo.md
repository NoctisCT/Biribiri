# Hito 5 — Kanto: zonas, encuentros, captura y tiendas

> Plan compacto: interfaces y casos de prueba. El código va directo a los fuentes.

**Objetivo:** que Kanto exista. Zonas con sus salas, encuentros con Pokémon salvajes, captura con la fórmula real, centros Pokémon que curan y el modelo de tiendas con su inventario.

**Rama:** `codex/pokemon-engine` · **Base de datos:** `habbo_pokemon_test_20260918`

**Punto de partida:** leer `docs/POKEMON-TRASPASO.md` entero. Ahí están las restricciones del entorno, las trampas ya pagadas y el estado real.

## Restricciones globales

- `combate/`, `entrenador/` y `seguidor/` **no importan `com.eu.habbo`**. Se verifica con grep en cada commit.
- Rangos de acción del 6400 ya usados: 1-6, 20-30, 40-43, 100-101. Este hito usa **120-139 (tiendas)** y añade en **1-19** lo de zona.
- `userId` siempre de la sesión, nunca del paquete.
- Truncado entero en todas las fórmulas.
- Probar contra el runtime aislado, **nunca contra el emulador de producción**.

---

## Lo que ya está y no hay que rehacer

| | |
|---|---|
| `pokemon_zones` y `pokemon_zone_rooms` | Creadas en M004. El gating funciona: sin fila, la sala no es Pokémon |
| `pokemon_items` | Creada en M004 y **vacía** |
| `ServicioZonas` | Carga zonas y salas en memoria al arrancar, con `recargar()` pendiente de exponer |
| `GeneradorPokemon` | Crea un Pokémon salvaje entero: IV, naturaleza, género, shiny, habilidad, movimientos por nivel |
| `Almacenamiento.anadir` | Ya decide equipo o primera caja libre, y devuelve `ALMACEN_LLENO` |
| `ServicioEconomia` | Cobros y pagos con la fila bloqueada y registro en la misma transacción |
| `Mochila` | Bolsillos, topes y objetos clave |

---

## Tarea 5a — Importar el catálogo de objetos

**Ficheros:** `xampp/htdocs/app/Services/Pokemon/MapeadorObjeto.php`, `app/Console/Commands/PokemonImportItems.php`, ampliación de `PokemonVerifyCatalog`.

PokéAPI `/item` da nombre, coste, categoría, efecto y sprite. El bolsillo sale de la categoría: `standard-balls` y `special-balls` → `BALLS`, `healing`/`status-cures`/`revival`/`pp-recovery` → `MEDICINAS`, `all-machines` → `MO_MT`, `effort-drop`/`medicine` con baya → `BAYAS`, `key-items`/`plot-advancement`/`event-items` → `CLAVE`, el resto → `OBJETOS`.

Las balls necesitan su multiplicador para la fórmula de captura y PokéAPI **no lo da**: se siembra a mano el puñado de Kanto (Poké 1, Súper 1,5, Ultra 2, Honor 1,5, Máster captura segura).

**Pruebas (PHPUnit):** el mapeo de categoría a bolsillo cubre las seis; una categoría desconocida cae en `OBJETOS`; el precio de venta es la mitad del de compra; una ball sin multiplicador sembrado se marca y el verificador la lista.

---

## Tarea 5b — Encuentros

**Ficheros:** `migraciones/M006Mundo.java`, `encuentros/` (puro), `ServicioEncuentros.java`.

M006 crea `pokemon_zone_encounters` (zona × especie × rango de nivel × peso × método × franja horaria) y `pokemon_zone_obstacles`.

| Clase (pura) | Responsabilidad |
|---|---|
| `TablaEncuentros` | `sortear(List<Encuentro>, RngCombate)` por peso acumulado |
| `Encuentro` | Especie, nivel mínimo y máximo, peso, método, franja |
| `Franja` | Mañana, día, tarde, noche, a partir de la hora del servidor |

### Casos de prueba

`TablaEncuentrosTest`
- Con pesos 70/25/5 y 10.000 tiradas, cada especie sale dentro de ±3 puntos de su peso
- Una lista vacía devuelve `null` y no revienta
- Un solo encuentro sale siempre
- Los pesos a cero nunca salen
- La misma semilla da la misma secuencia
- El nivel cae dentro del rango, extremos incluidos
- Solo entran los encuentros de la franja actual y del método pedido

---

## Tarea 5c — Captura

**Ficheros:** `captura/FormulaCaptura.java` (puro), acciones nuevas en el rango de combate.

La fórmula de gen 3+, con truncado entero en cada paso:

```
a = ((3 * psMax - 2 * psActual) * catchRate * ballBonus) / (3 * psMax) * estadoBonus
b = 1048560 / raizCuadrada(raizCuadrada(16711680 / a))
```

Cuatro sacudidas: si `a >= 255` captura directa; si no, cuatro tiradas de `rng.entre(0, 65535) < b`.

Bonus de estado: dormido y congelado ×2,5; paralizado, envenenado y quemado ×1,5; el resto ×1.

### Casos de prueba

`FormulaCapturaTest`
- Máster ball captura siempre, incluso a PS llenos y con `catchRate` 3
- `catchRate` 255 a 1 PS con Ultra ball captura casi siempre (>95% en 10.000 tiradas)
- Un legendario a PS llenos con Poké ball casi nunca (<2% en 10.000 tiradas)
- Bajar los PS sube la probabilidad de forma monótona
- Dormir sube la probabilidad frente al mismo caso sin estado
- La misma semilla da el mismo resultado y el mismo número de sacudidas
- `psActual` 0 no divide por cero ni supera el 100%
- El número de sacudidas informadas cuadra con si al final captura o no

---

## Tarea 5d — Centros Pokémon y tiendas

**Ficheros:** M006 añade `pokemon_shops` y `pokemon_shop_stock`; `ServicioTienda.java`, acciones 120-139.

- **Centro:** cura el equipo entero (PS al máximo, estados a `none`, PP al máximo). Es gratis y no toca la economía.
- **Tienda:** `pokemon_shop_stock` con precio, `badge_requirement` y límite de existencias. Comprar cobra con `ServicioEconomia` y mete en la mochila **en la misma transacción**; si la mochila está llena, se devuelve el dinero.

### Casos de prueba

`ServicioTiendaTest` (puro, sobre la parte de reglas)
- Comprar más de lo que cabe en el bolsillo falla y no cobra
- Sin saldo suficiente falla y no entrega
- Un objeto con insignia requerida se rechaza sin ella
- El límite de existencias se respeta y baja al comprar
- Vender da la mitad del precio de compra
- Los objetos clave no se venden

---

## Tarea 5e — Protocolo y datos de Kanto

Acciones nuevas: `ZONA_INFO` (en 1-19), `ENCUENTRO_BUSCAR`, `CAPTURA_INTENTAR` (rango de combate), `TIENDA_VER`, `TIENDA_COMPRAR`, `TIENDA_VENDER`, `CENTRO_CURAR`.

Sembrar las zonas de Kanto que el hotel ya tenga como salas, empezando por Ruta 1, Pueblo Paleta y Ciudad Verde. **La tabla `pokemon_zone_rooms` es la que manda**: dar de alta una sala es meter una fila.

---

## Orden sugerido

1. **5a** primero: sin objetos no hay balls, y sin balls no hay captura.
2. **5b** y **5c** son puras y se pueden hacer con pruebas antes de tocar nada del emulador.
3. **5d** y **5e** al final, que son los que necesitan el runtime levantado.

## Antes de dar el hito por cerrado

- `mvn -o test` en verde y el grep de pureza sin resultados.
- Arrancar el runtime aislado y comprobar los mensajes de carga.
- Capturar un Pokémon de verdad en la sala 203 y verlo aparecer en el equipo.
