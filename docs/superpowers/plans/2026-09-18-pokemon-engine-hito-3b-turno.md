# PokemonEngine — Hito 3b: resolución del turno

**Goal:** `ServicioCombate` resuelve un turno completo como función pura: recibe un estado y las acciones de ambos bandos, devuelve un estado nuevo y la lista de eventos que el cliente reproducirá.

**Architecture:** Todo en `com.retro.pokemonengine.combate`, sin importar `com.eu.habbo`. El estado tiene los tres niveles del diseño (por Pokémon, por bando, global). El azar entra por un `RngCombate` sembrado, de modo que un combate con la misma semilla y las mismas acciones se reproduce idéntico.

**Nota de formato:** este plan es compacto a propósito. El código completo vive en los ficheros fuente, no duplicado aquí; lo que sí se fija son las interfaces, las decisiones y los casos de prueba, que es lo que no se puede deducir del código después.

## Global Constraints

- Divisiones enteras truncadas, como en los juegos
- `ServicioCombate` no toca base de datos, red ni `Emulator`
- Cada turno produce eventos; el estado nunca se muta, se devuelve uno nuevo
- Todo contra `habbo_pokemon_test_20260918`

---

## Modelo de estado

| Clase | Contenido |
|---|---|
| `PokemonCombate` | Especie, nivel efectivo, stats ya calculados, PS, estado alterado y su contador, 7 etapas (-6..+6), volátiles con turnos, 4 movimientos con PP, tipos, objeto |
| `Bando` | Posiciones activas (1 en individual, 2 en dobles), banquillo, condiciones de bando con turnos restantes |
| `EstadoCombate` | Los dos bandos, clima y sus turnos, terreno y sus turnos, número de turno, RNG |
| `Accion` | Qué hace un bando: movimiento, cambio, objeto o huida, con origen y objetivo |
| `Evento` | Lo que el cliente reproduce: tipo más datos |
| `RngCombate` | `Random` sembrado, con `entre(a,b)`, `porcentaje(p)` y `variacionDano()` |

### Etapas de stat

```
etapa >= 0 → (2 + etapa) / 2
etapa <  0 → 2 / (2 - etapa)
```

Para precisión y evasión el divisor es 3 en vez de 2. Las etapas se topan en ±6.

## Orden del turno

1. Huida, objetos y cambios primero, en ese orden
2. Movimientos por **prioridad** del movimiento, de mayor a menor
3. A igual prioridad, por **Velocidad efectiva** (etapas y parálisis aplicadas)
4. Empate exacto: lo decide el RNG

## Impedimentos antes de mover

| Estado | Regla |
|---|---|
| Congelado | 20% de descongelarse cada turno; si no, no actúa |
| Dormido | Contador de turnos; al llegar a 0 despierta y actúa |
| Paralizado | 25% de no actuar; además la Velocidad se reduce a la mitad |
| Confusión | 33% de golpearse a sí mismo con un físico de potencia 40, sin tipos ni STAB |
| Retroceso | No actúa este turno |

## Precisión

Un movimiento sin precisión declarada **nunca falla**. Si la tiene:

```
probabilidad = precision × etapaPrecision(atacante) / etapaEvasion(defensor)
```

## Las 11 categorías genéricas

`damage`, `damage-ailment`, `damage-lower`, `damage-raise`, `damage-heal`, `ailment`, `net-good-stats`, `heal`, `swagger`, `ohko`, `force-switch`. Todas se resuelven con los datos que el hito 2 dejó en `pokemon_moves`: dolencia y su probabilidad, cambios de stats, drenaje, curación, golpes mínimos y máximos.

## Fin de turno, en orden fijo

Clima → objetos residuales → veneno y quemadura → drenadoras → comprobación de debilitados.

---

## Tareas

| # | Contenido | Pruebas clave |
|---|---|---|
| 1 | Modelo de estado y etapas | Topes en ±6, fórmula de etapas positiva y negativa, precisión con divisor 3 |
| 2 | RNG sembrado y orden del turno | Misma semilla, misma secuencia; prioridad gana a velocidad; parálisis afecta al orden; empate resuelto por RNG |
| 3 | Impedimentos y precisión | Cada estado impide o no según el RNG; movimiento sin precisión nunca falla; evasión reduce |
| 4 | Ejecución de un movimiento de daño | Integra el hito 3a; STAB, tipos, crítico, multigolpe |
| 5 | Las 11 categorías genéricas | Una prueba por categoría con un movimiento real del catálogo |
| 6 | Fin de turno y debilitados | Orden de residuales, veneno grave acumulativo, debilitado marca el fin |

## Hecho cuando

- Un combate completo entre dos Pokémon se resuelve turno a turno solo con llamadas puras
- Dos ejecuciones con la misma semilla y las mismas acciones producen eventos idénticos
- Las pruebas del motor corren sin emulador
