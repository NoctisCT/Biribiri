# Hito 6b — El combate: plan de implementación

> **Para quien lo ejecute:** SUB-SKILL OBLIGATORIA: usar `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para implementarlo tarea a tarea. Los pasos llevan casilla (`- [ ]`) para ir marcándolos.

**Objetivo:** que pisar la hierba abra un combate de verdad — turnos, ataques, cambios, objetos, huida y captura — que se pueda ganar, perder, abandonar y reanudar, y que deje experiencia, EV, niveles y evoluciones al terminar.

**Arquitectura:** el motor de turnos ya existe y es puro (`ServicioCombate`, 138 pruebas). Este hito **no lo toca**: le pone un jugador delante. Todo lo nuevo se parte en dos. Las reglas que no necesitan emulador — huida, reparto de experiencia y EV, subida de nivel, evolución, geometría de la formación, plazo de abandono — van al paquete nuevo `batalla/`, puro y probado con JUnit. Lo que sí necesita emulador — la sesión en memoria, el bloqueo de posición en la sala, los paquetes, los eventos de expulsión y desconexión — son servicios delgados que preguntan a esas clases.

El estado caliente del combate vive en memoria; a disco solo va el `state_snapshot` al cerrar cada turno, que es lo que permite volver tras una caída, y el log de eventos, que es lo que permitirá auditar y repetir.

**Tecnologías:** Java 16, Maven offline, JUnit 5, MySQL vía Arcturus, paquete 6400/6401 con JSON.

## Restricciones globales

- Repo local `C:\Users\erale\Desktop\Habbo`, worktree `build/pokemon-engine`, rama `codex/pokemon-engine`. **No se trabaja sobre `dev` ni `master`.** La rama **no se fusiona** hasta terminar la fase.
- **Nunca** `yarn install`, `npm install` ni `composer install`.
- **Nunca** se despliega en `Emulator/` (producción). Todo va a `build/pokemon-test-runtime`, base de datos `habbo_pokemon_test_20260918`, puertos 3200/3201/2196.
- Arrancar el emulador de pruebas **siempre** filtrando: `java -Dfile.encoding=UTF8 -jar Habbo-3.6.0-jar-with-dependencies.jar 2>&1 | grep --line-buffered -v "Waiting for command" > runtime.log`. Sin el filtro genera decenas de GB de log.
- **Sin acentos ni eñes en identificadores Java.** En comentarios y textos sí.
- `combate/`, `entrenador/`, `seguidor/`, `encuentros/`, `captura/`, `tienda/`, `clima/` y el nuevo **`batalla/`** no importan `com.eu.habbo`. Se comprueba con grep en cada commit:
  ```bash
  grep -rn "com.eu.habbo" Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/{combate,entrenador,seguidor,encuentros,captura,tienda,clima,batalla}/
  ```
  Solo debe salir el comentario de `CatalogoAnimaciones`.
- El `userId` sale siempre de la sesión, nunca del paquete.
- Los códigos de acción del 6400 **no se reordenan nunca**. Los nuevos van en el rango 60-99, a continuación de los existentes.
- Probabilidades: se prueban con miles de tiradas, nunca con una.
- Maven: `"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -o -f Desarrollo/PokemonEngine/pom.xml test`
- Estado de partida: **295 pruebas de Java** y 25 de PHP en verde, esquema en la **versión 7**.

## Decisiones ya tomadas — no volver a discutirlas

Están en `docs/POKEMON-TRASPASO.md` sección 9 y en la spec de la fase 1 secciones 7 y 8. Resumen operativo:

| Asunto | Decisión |
|---|---|
| Huida | Solo en salvaje. Fórmula de los juegos: Velocidad e intentos acumulados |
| Cambio de sala | Bloqueado durante el combate |
| Desconexión | Saca del combate, con plazo de gracia; al expirar, derrota por abandono |
| Expulsión, ban, sala borrada o sin zona | El combate se **anula**: sin ganador, sin premio, sin penalización |
| Dónde se pelea | Obligatorio en sala; si no hay hueco para la formación, **en interfaz**, nunca cancelado |
| Evolución | Cambia `species_id` y nada más; habilidad por hueco; PS recalculados arrastrando el daño |
| Salas de jugador | Todo amistoso. Lo que puntúa vendrá solo de salas oficiales, en otra fase |

## Lo que este hito NO hace

- **Efectos de objetos.** Las pociones se compran y no se usan; en combate el objeto solo emite su evento. Las balls sí funcionan, porque la captura es suya.
- **Efectos de habilidades.** Las 374 siguen con `effect_code = 'sin_implementar'`.
- **Combates dobles.** El motor los soporta; el contenido de la fase 1 es individual y la formación de este hito es en línea.
- **Combates contra entrenador IA.** El `Formato` los deja previstos; el contenido es de la fase 3 (gimnasios).
- **Render en sala.** Los Pokémon no se ven: el bloqueo de posición y la reserva de baldosas se implementan, pero lo visual es fase 2.

## Riesgos ya cerrados antes de escribir el plan

Comprobado contra el bytecode de `Habbo-3.6.0.jar`, no contra la documentación:

- `UserEnterRoomEvent` **sí se cancela**: `RoomManager` comprueba `isCancelled()` y, si el jugador ya estaba en una sala, **lo deja donde está** sin mandarle a la vista del hotel. Es el mecanismo del bloqueo de cambio de sala.
- `UserExitRoomEvent` se dispara pero **su cancelación no se comprueba**. Salir a la vista del hotel no se puede impedir: se trata como ausencia, con el plazo de gracia.
- Existen `UserKickEvent`, `UserDisconnectEvent` y `UserLoginEvent`, que son los tres enganches que faltaban.
- `RoomUnit` tiene `setCanWalk(boolean)`, `setGoalLocation(RoomTile)`, `setLocation(RoomTile)`, `setRotation`, `setBodyRotation`, `setHeadRotation`, `getCurrentLocation()` y `stopWalking()`. Suficiente para colocar y bloquear.
- `RoomTile` tiene `isWalkable()`, `getState()` y `getUnits()`. La caminabilidad se mira ahí, no en el furni, como manda la spec.

---

## Estructura de ficheros

**Java, puro (sin emulador) — paquete nuevo `batalla/`:**

| Fichero | Responsabilidad |
|---|---|
| `batalla/Formato.java` | De qué combate se trata y qué permite: huida, captura, premio |
| `batalla/ReglasHuida.java` | La fórmula de huir de un salvaje |
| `batalla/ReglasAbandono.java` | Plazo de gracia y temporizador de turno |
| `batalla/MenteSalvaje.java` | Lo que hace el salvaje en su turno |
| `batalla/Recompensas.java` | Experiencia y reparto de EV con sus topes |
| `batalla/Progreso.java` | Nivel nuevo, movimientos aprendidos y si toca evolucionar |
| `batalla/PlanArena.java` | Geometría de la formación y su búsqueda de hueco |

**Java, puro, en paquetes que ya existen:**

| Fichero | Responsabilidad |
|---|---|
| `entrenador/ReglasEvolucion.java` | Qué se conserva y qué se recalcula al evolucionar |

**Java, con emulador:**

| Fichero | Responsabilidad |
|---|---|
| `migraciones/M008Batalla.java` | Tablas de combate, log y arenas |
| `ServicioBatalla.java` | La sesión: crear, recoger acciones, resolver turno, cerrar |
| `ServicioArena.java` | Colocar, bloquear posición y reservar baldosas en la sala real |
| `ServicioRecompensas.java` | Aplicar y persistir lo que dejó el combate |
| `AccionesBatalla.java` | Las acciones 63-68 del paquete 6400 |
| `ServicioPokedex.java` (modificado) | Expone el catálogo como `CatalogoCombate` |
| `ServicioCaptura.java` (modificado) | La captura pasa a ser una acción de combate |
| `DisparadorEncuentros.java` (modificado) | El encuentro abre una batalla en vez de un aviso |
| `AccionesMundo.java` (modificado) | `ENCUENTRO_HUIR` delega en la batalla |
| `PokemonEnginePlugin.java` (modificado) | Enganches de entrada, salida, expulsión, desconexión y login |
| `PokemonAcciones.java` (modificado) | Códigos 63-68 |

---

### Task 1: Migración M008 — las tablas del combate

**Ficheros:**
- Crear: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/migraciones/M008Batalla.java`
- Modificar: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/BaseDatosPokemon.java`

**Interfaces:**
- Consume: `Migracion` (`version()`, `nombre()`, `aplicar(Connection)`).
- Produce: las tablas `pokemon_battles`, `pokemon_battle_sides`, `pokemon_battle_log`, `pokemon_battle_arenas` y `pokemon_battle_arena_slots`, y el esquema en la versión 8.

- [ ] **Paso 1: Escribir la migración**

`M008Batalla.java`:

```java
package com.retro.pokemonengine.migraciones;

import java.sql.Connection;
import java.sql.Statement;

/**
 * Las tablas del combate.
 *
 * El estado vivo del turno no esta aqui: vive en memoria en ServicioBatalla. A
 * disco solo baja `state_snapshot`, que es lo unico que hace falta para que una
 * reconexion devuelva al jugador al combate donde lo dejo.
 *
 * El log es una fila por evento a proposito. Ocupa mas que un JSON por turno,
 * pero es lo que permite contar, filtrar y auditar sin desempaquetar nada.
 */
public final class M008Batalla implements Migracion
{
    @Override
    public int version()
    {
        return 8;
    }

    @Override
    public String nombre()
    {
        return "combate";
    }

    @Override
    public void aplicar(Connection conexion) throws Exception
    {
        try(Statement s = conexion.createStatement())
        {
            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_battles (" +
                "id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT," +
                "tipo VARCHAR(16) NOT NULL DEFAULT 'salvaje'," +
                "formato VARCHAR(24) NOT NULL DEFAULT 'SALVAJE'," +
                "zone_id INT NULL," +
                "room_id INT NULL," +
                "arena_id INT NULL," +
                "season_id INT NOT NULL DEFAULT 1," +
                "estado VARCHAR(16) NOT NULL DEFAULT 'en_curso'," +
                "en_interfaz TINYINT(1) NOT NULL DEFAULT 0," +
                "turno SMALLINT UNSIGNED NOT NULL DEFAULT 0," +
                "rng_seed BIGINT NOT NULL," +
                "state_snapshot MEDIUMTEXT NULL," +
                "ganador_user_id INT NULL," +
                "motivo_fin VARCHAR(32) NULL," +
                "creada_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
                "terminada_en TIMESTAMP NULL," +
                "PRIMARY KEY (id)," +
                "KEY idx_pokemon_battles_estado (estado)," +
                "KEY idx_pokemon_battles_sala (room_id, estado)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            // Un bando por fila y no dos columnas en pokemon_battles: los dobles
            // y los combates multiples de fases futuras no obligan a migrar nada.
            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_battle_sides (" +
                "id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT," +
                "battle_id BIGINT UNSIGNED NOT NULL," +
                "indice TINYINT UNSIGNED NOT NULL," +
                "user_id INT NULL," +
                "es_salvaje TINYINT(1) NOT NULL DEFAULT 0," +
                "owned_id BIGINT UNSIGNED NULL," +
                "species_id INT NOT NULL DEFAULT 0," +
                "nivel TINYINT UNSIGNED NOT NULL DEFAULT 1," +
                "PRIMARY KEY (id)," +
                "UNIQUE KEY uk_pokemon_battle_side (battle_id, indice)," +
                "KEY idx_pokemon_battle_sides_user (user_id)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_battle_log (" +
                "id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT," +
                "battle_id BIGINT UNSIGNED NOT NULL," +
                "turno SMALLINT UNSIGNED NOT NULL," +
                "orden SMALLINT UNSIGNED NOT NULL," +
                "tipo VARCHAR(32) NOT NULL," +
                "datos TEXT NULL," +
                "PRIMARY KEY (id)," +
                "KEY idx_pokemon_battle_log_combate (battle_id, turno, orden)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            // Arenas predefinidas: donde el encuadre importa, lo marca el staff.
            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_battle_arenas (" +
                "id INT NOT NULL AUTO_INCREMENT," +
                "zone_id INT NULL," +
                "room_id INT NOT NULL," +
                "nombre VARCHAR(48) NOT NULL DEFAULT ''," +
                "formato VARCHAR(24) NOT NULL DEFAULT 'SALVAJE'," +
                "activo TINYINT(1) NOT NULL DEFAULT 1," +
                "PRIMARY KEY (id)," +
                "KEY idx_pokemon_battle_arenas_sala (room_id, activo)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_battle_arena_slots (" +
                "id INT NOT NULL AUTO_INCREMENT," +
                "arena_id INT NOT NULL," +
                "rol VARCHAR(16) NOT NULL," +
                "x SMALLINT NOT NULL," +
                "y SMALLINT NOT NULL," +
                "direccion TINYINT UNSIGNED NOT NULL DEFAULT 0," +
                "PRIMARY KEY (id)," +
                "UNIQUE KEY uk_pokemon_arena_rol (arena_id, rol)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        }
    }
}
```

- [ ] **Paso 2: Registrarla**

En `BaseDatosPokemon.java`, añadir el import junto a los demás y la instancia al final de la lista:

```java
import com.retro.pokemonengine.migraciones.M008Batalla;
```

```java
                new M007Mundo(),
                new M008Batalla()
```

- [ ] **Paso 3: Compilar**

```bash
"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -o -f Desarrollo/PokemonEngine/pom.xml test
```

Esperado: BUILD SUCCESS, 295 pruebas. Todavía no hay pruebas nuevas.

- [ ] **Paso 4: Commit**

```bash
git add Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/migraciones/M008Batalla.java Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/BaseDatosPokemon.java
git commit -F - <<'EOF'
feat(pokemon): create the battle, log and arena tables

Milestone 6b needs somewhere to keep a battle that outlives a
disconnection. The live turn stays in memory; only the snapshot and the
event log go to disk.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 2: `Formato` y `ReglasHuida`

**Ficheros:**
- Crear: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/batalla/Formato.java`
- Crear: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/batalla/ReglasHuida.java`
- Prueba: `Desarrollo/PokemonEngine/src/test/java/com/retro/pokemonengine/batalla/ReglasHuidaTest.java`

**Interfaces:**
- Consume: `RngCombate` (`entre(int a, int b)`, ambos incluidos).
- Produce: `Formato.SALVAJE` / `Formato.PVP_AMISTOSO` con `huidaPermitida()`, `capturaPermitida()`, `daRecompensa()`, `porNombre(String)`; y `ReglasHuida.intentar(int velocidadPropia, int velocidadRival, int intentos, RngCombate rng)`.

- [ ] **Paso 1: Escribir la prueba que falla**

`ReglasHuidaTest.java`:

```java
package com.retro.pokemonengine.batalla;

import com.retro.pokemonengine.combate.RngCombate;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ReglasHuidaTest
{
    private int veces(int propia, int rival, int intentos, int tiradas)
    {
        RngCombate rng = new RngCombate(20260919L);
        int salidas = 0;

        for(int i = 0; i < tiradas; i++)
        {
            if(ReglasHuida.intentar(propia, rival, intentos, rng)) salidas++;
        }

        return salidas;
    }

    @Test
    void siEresMasRapidoHuyesSiempre()
    {
        assertEquals(1000, veces(100, 50, 1, 1000),
                "Ser mas rapido es huida garantizada en los juegos");
    }

    @Test
    void contraUnRivalMuchoMasRapidoCuestaALaPrimera()
    {
        int salidas = veces(10, 200, 1, 10000);

        assertTrue(salidas > 0, "Nunca poder huir seria una jaula");
        assertTrue(salidas < 4000, "Con esa diferencia de velocidad no puede salir casi siempre: " + salidas);
    }

    @Test
    void cadaIntentoLoPoneMasFacil()
    {
        int primero = veces(10, 200, 1, 10000);
        int cuarto = veces(10, 200, 4, 10000);

        assertTrue(cuarto > primero,
                "El cuarto intento debe salir mas que el primero: " + primero + " -> " + cuarto);
    }

    @Test
    void contraUnRivalLentisimoSeHuyeSeguro()
    {
        // Velocidad 3: 3/4 = 0, y ahi la formula original dividiria por cero.
        assertEquals(500, veces(1, 3, 1, 500));
    }

    @Test
    void delEntrenadorNoSeHuye()
    {
        assertTrue(Formato.SALVAJE.huidaPermitida());
        assertFalse(Formato.PVP_AMISTOSO.huidaPermitida());
    }

    @Test
    void soloElSalvajeSeCapturaYSoloElSalvajeDaPremio()
    {
        assertTrue(Formato.SALVAJE.capturaPermitida());
        assertFalse(Formato.PVP_AMISTOSO.capturaPermitida());

        assertTrue(Formato.SALVAJE.daRecompensa());
        assertFalse(Formato.PVP_AMISTOSO.daRecompensa(),
                "Un amistoso que diera experiencia se farmearia con una segunda cuenta");
    }

    @Test
    void unFormatoDesconocidoCaeEnSalvaje()
    {
        assertEquals(Formato.SALVAJE, Formato.porNombre("lo-que-sea"));
        assertEquals(Formato.SALVAJE, Formato.porNombre(null));
        assertEquals(Formato.PVP_AMISTOSO, Formato.porNombre("pvp_amistoso"));
    }
}
```

- [ ] **Paso 2: Ver que falla**

```bash
"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -o -f Desarrollo/PokemonEngine/pom.xml test -Dtest=ReglasHuidaTest
```

Esperado: error de compilación, `package com.retro.pokemonengine.batalla does not exist`.

- [ ] **Paso 3: Escribir `Formato`**

```java
package com.retro.pokemonengine.batalla;

/**
 * De que combate se trata.
 *
 * Manda sobre las tres reglas que cambian de un combate a otro: si se puede
 * huir, si se puede capturar y si deja premio. Los formatos de gimnasio y
 * torneo entraran aqui sin tocar el motor, que es justo para lo que existe.
 */
public enum Formato
{
    /** Contra un Pokemon salvaje: se huye, se captura y deja experiencia. */
    SALVAJE(true, true, true),

    /**
     * Jugador contra jugador en sala de jugador. No se huye, no se captura y no
     * deja premio: un amistoso que diera experiencia se farmearia con una
     * segunda cuenta en dos minutos.
     */
    PVP_AMISTOSO(false, false, false);

    private final boolean huidaPermitida;
    private final boolean capturaPermitida;
    private final boolean daRecompensa;

    Formato(boolean huidaPermitida, boolean capturaPermitida, boolean daRecompensa)
    {
        this.huidaPermitida = huidaPermitida;
        this.capturaPermitida = capturaPermitida;
        this.daRecompensa = daRecompensa;
    }

    public boolean huidaPermitida() { return this.huidaPermitida; }
    public boolean capturaPermitida() { return this.capturaPermitida; }
    public boolean daRecompensa() { return this.daRecompensa; }

    /** Lo desconocido es SALVAJE: es el formato que no concede nada raro. */
    public static Formato porNombre(String nombre)
    {
        if(nombre == null) return SALVAJE;

        for(Formato formato : values())
        {
            if(formato.name().equalsIgnoreCase(nombre.trim())) return formato;
        }

        return SALVAJE;
    }
}
```

- [ ] **Paso 4: Escribir `ReglasHuida`**

```java
package com.retro.pokemonengine.batalla;

import com.retro.pokemonengine.combate.RngCombate;

/**
 * Huir de un salvaje, con la formula de tercera generacion en adelante.
 *
 * Los intentos se acumulan dentro del mismo combate: el cuarto sale casi
 * siempre aunque el rival sea mucho mas rapido. Es lo que impide que un
 * Pokemon veloz deje al jugador encerrado en un encuentro que no queria.
 *
 * De un entrenador no se huye, pero eso no lo decide esta clase: lo decide
 * `Formato.huidaPermitida()`, porque es una propiedad del combate y no del
 * calculo.
 */
public final class ReglasHuida
{
    private ReglasHuida()
    {
    }

    /**
     * @param intentos cuantas veces se ha intentado huir en este combate,
     *                 contando el actual. El primero es 1.
     */
    public static boolean intentar(int velocidadPropia, int velocidadRival,
                                   int intentos, RngCombate rng)
    {
        if(velocidadPropia > velocidadRival) return true;

        int divisor = (velocidadRival / 4) % 256;

        // La formula original divide por esto. Con un rival lentisimo da cero,
        // y el caso se resuelve como lo que es: huida segura.
        if(divisor == 0) return true;

        int umbral = ((velocidadPropia * 32) / divisor) + 30 * Math.max(1, intentos);

        if(umbral >= 256) return true;

        return rng.entre(0, 255) < umbral;
    }
}
```

- [ ] **Paso 5: Ver que pasa**

```bash
"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -o -f Desarrollo/PokemonEngine/pom.xml test
```

Esperado: BUILD SUCCESS, 302 pruebas.

- [ ] **Paso 6: Comprobar la pureza y hacer commit**

```bash
grep -rn "com.eu.habbo" Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/batalla/
```

No debe devolver nada.

```bash
git add Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/batalla/ Desarrollo/PokemonEngine/src/test/java/com/retro/pokemonengine/batalla/
git commit -F - <<'EOF'
feat(pokemon): let a trainer run from a wild Pokemon

The games' formula, accumulated attempts included: the fourth try
almost always works, so a fast wild Pokemon cannot lock a player into
an encounter they never asked for. Trainers cannot be fled from, and
that is a property of the format, not of the roll.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 3: `Recompensas` — experiencia y EV

**Ficheros:**
- Crear: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/batalla/Recompensas.java`
- Prueba: `Desarrollo/PokemonEngine/src/test/java/com/retro/pokemonengine/batalla/RecompensasTest.java`

**Interfaces:**
- Produce: `Recompensas.Ev` (record de seis enteros con `total()`), `Recompensas.experiencia(int baseExperienceDerrotado, int nivelDerrotado, int participantes, boolean contraEntrenador)` y `Recompensas.sumar(Ev actuales, Ev reparto, boolean pokerus)`.
- Consume: nada. Es aritmética pura.

- [ ] **Paso 1: Escribir la prueba que falla**

`RecompensasTest.java`:

```java
package com.retro.pokemonengine.batalla;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RecompensasTest
{
    private static final Recompensas.Ev CERO = new Recompensas.Ev(0, 0, 0, 0, 0, 0);

    @Test
    void unRattataDeNivelDosDaMuyPocaExperiencia()
    {
        // Rattata: base_experience 51.
        assertEquals(51L * 2 / 7, Recompensas.experiencia(51, 2, 1, false));
    }

    @Test
    void repartirEntreDosDaLaMitadACadaUno()
    {
        long solo = Recompensas.experiencia(200, 50, 1, false);
        long acompanado = Recompensas.experiencia(200, 50, 2, false);

        assertEquals(solo / 2, acompanado);
    }

    @Test
    void unEntrenadorPagaLaMitadMas()
    {
        long salvaje = Recompensas.experiencia(200, 50, 1, false);
        long entrenador = Recompensas.experiencia(200, 50, 1, true);

        assertEquals(salvaje * 3 / 2, entrenador);
    }

    @Test
    void nuncaSeGanaCero()
    {
        assertEquals(1L, Recompensas.experiencia(1, 1, 6, false),
                "Un combate ganado siempre tiene que sumar algo");
    }

    @Test
    void elPokerusDuplicaElReparto()
    {
        Recompensas.Ev reparto = new Recompensas.Ev(0, 1, 0, 0, 0, 0);

        assertEquals(1, Recompensas.sumar(CERO, reparto, false).ataque());
        assertEquals(2, Recompensas.sumar(CERO, reparto, true).ataque());
    }

    @Test
    void ningunStatPasaDeDoscientosCincuentaYDos()
    {
        Recompensas.Ev actuales = new Recompensas.Ev(0, 250, 0, 0, 0, 0);
        Recompensas.Ev reparto = new Recompensas.Ev(0, 10, 0, 0, 0, 0);

        assertEquals(Recompensas.EV_MAX_POR_STAT,
                Recompensas.sumar(actuales, reparto, false).ataque());
    }

    @Test
    void elTotalNoPasaDeQuinientosDiez()
    {
        Recompensas.Ev actuales = new Recompensas.Ev(252, 252, 0, 0, 0, 0);
        Recompensas.Ev reparto = new Recompensas.Ev(0, 0, 3, 3, 3, 3);

        Recompensas.Ev fin = Recompensas.sumar(actuales, reparto, false);

        assertEquals(Recompensas.EV_MAX_TOTAL, fin.total());
        assertEquals(6, fin.defensa(), "Lo que cabe va al primero de la lista, como en los juegos");
        assertEquals(0, fin.ataqueEsp(), "Y al siguiente ya no le queda margen");
    }

    @Test
    void conElTotalLlenoNoEntraNadaMas()
    {
        Recompensas.Ev lleno = new Recompensas.Ev(252, 252, 6, 0, 0, 0);
        Recompensas.Ev fin = Recompensas.sumar(lleno, new Recompensas.Ev(0, 0, 0, 8, 8, 8), false);

        assertEquals(lleno, fin);
        assertTrue(fin.total() <= Recompensas.EV_MAX_TOTAL);
    }
}
```

- [ ] **Paso 2: Ver que falla**

```bash
"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -o -f Desarrollo/PokemonEngine/pom.xml test -Dtest=RecompensasTest
```

Esperado: `cannot find symbol: class Recompensas`.

- [ ] **Paso 3: Escribir `Recompensas`**

```java
package com.retro.pokemonengine.batalla;

/**
 * Lo que deja un Pokemon derrotado.
 *
 * Los dos topes de EV se aplican en el orden de los juegos: primero el de cada
 * stat, despues el global. Ese orden importa — pasarse de 510 no rellena lo que
 * le falte al siguiente, simplemente no entra.
 */
public final class Recompensas
{
    public static final int EV_MAX_POR_STAT = 252;
    public static final int EV_MAX_TOTAL = 510;

    public record Ev(int ps, int ataque, int defensa, int ataqueEsp, int defensaEsp, int velocidad)
    {
        public int total()
        {
            return this.ps + this.ataque + this.defensa
                    + this.ataqueEsp + this.defensaEsp + this.velocidad;
        }
    }

    private Recompensas()
    {
    }

    /**
     * Formula de quinta generacion sin el factor de nivel del ganador: la base
     * del derrotado por su nivel, entre siete, repartida entre los que
     * participaron. El factor de nivel se deja fuera a proposito, porque sin
     * intercambio ni Pokemon regalados solo anadiria ruido.
     */
    public static long experiencia(int baseExperienceDerrotado, int nivelDerrotado,
                                   int participantes, boolean contraEntrenador)
    {
        int reparto = Math.max(1, participantes);

        long bruta = (long) Math.max(0, baseExperienceDerrotado)
                * Math.max(1, nivelDerrotado) / 7L / reparto;

        if(contraEntrenador) bruta = bruta * 3L / 2L;

        // Un combate ganado siempre suma algo: cero desmotiva y no protege nada.
        return Math.max(1L, bruta);
    }

    public static Ev sumar(Ev actuales, Ev reparto, boolean pokerus)
    {
        int factor = pokerus ? 2 : 1;

        int[] fin = {
                actuales.ps(), actuales.ataque(), actuales.defensa(),
                actuales.ataqueEsp(), actuales.defensaEsp(), actuales.velocidad()
        };

        int[] entra = {
                reparto.ps(), reparto.ataque(), reparto.defensa(),
                reparto.ataqueEsp(), reparto.defensaEsp(), reparto.velocidad()
        };

        int total = actuales.total();

        for(int i = 0; i < fin.length; i++)
        {
            int margenStat = EV_MAX_POR_STAT - fin[i];
            int margenTotal = EV_MAX_TOTAL - total;
            int suma = Math.min(entra[i] * factor, Math.min(margenStat, margenTotal));

            if(suma <= 0) continue;

            fin[i] += suma;
            total += suma;
        }

        return new Ev(fin[0], fin[1], fin[2], fin[3], fin[4], fin[5]);
    }
}
```

- [ ] **Paso 4: Ver que pasa**

```bash
"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -o -f Desarrollo/PokemonEngine/pom.xml test
```

Esperado: BUILD SUCCESS, 310 pruebas.

- [ ] **Paso 5: Commit**

```bash
git add Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/batalla/Recompensas.java Desarrollo/PokemonEngine/src/test/java/com/retro/pokemonengine/batalla/RecompensasTest.java
git commit -F - <<'EOF'
feat(pokemon): work out what a defeated Pokemon is worth

Experience and EV yield, with both caps applied in the games' order:
per stat first, then the global 510. Overflowing the global cap does
not top up the next stat — it simply does not fit.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 4: `Progreso` — nivel, movimientos y evolución

**Ficheros:**
- Crear: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/batalla/Progreso.java`
- Prueba: `Desarrollo/PokemonEngine/src/test/java/com/retro/pokemonengine/batalla/ProgresoTest.java`

**Interfaces:**
- Consume: `TablaExperiencia.Curva`, `TablaExperiencia.expParaNivel(Curva, int)`, `TablaExperiencia.nivelParaExp(Curva, long)`, `TablaExperiencia.NIVEL_MAX`; `CatalogoGeneracion.movimientosPorNivel(int especieId, int nivel)` que devuelve `List<CatalogoGeneracion.MovimientoAprendido>` con `moveId()` y `nivel()`.
- Produce: `Progreso.Evolucion(int destinoId, int nivelMinimo)` y `Progreso.Resultado(int nivelAntes, int nivelDespues, long experienciaFinal, List<Integer> movimientosAprendidos, Integer evolucionA)`, más `Progreso.aplicar(...)`.

- [ ] **Paso 1: Escribir la prueba que falla**

`ProgresoTest.java`:

```java
package com.retro.pokemonengine.batalla;

import com.retro.pokemonengine.entrenador.CatalogoGeneracion;
import com.retro.pokemonengine.entrenador.EspecieGeneracion;
import com.retro.pokemonengine.entrenador.TablaExperiencia;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProgresoTest
{
    /** Aprende algo en los niveles 5, 7 y 12, y nada mas. */
    private final CatalogoGeneracion catalogo = new CatalogoGeneracion()
    {
        @Override
        public EspecieGeneracion especie(int especieId)
        {
            return null;
        }

        @Override
        public List<MovimientoAprendido> movimientosPorNivel(int especieId, int nivel)
        {
            List<MovimientoAprendido> lista = new ArrayList<>();

            for(int n : new int[]{5, 7, 12})
            {
                if(n <= nivel) lista.add(new MovimientoAprendido(100 + n, n));
            }

            return lista;
        }

        @Override
        public int ppBase(int moveId)
        {
            return 20;
        }
    };

    private final TablaExperiencia.Curva curva = TablaExperiencia.Curva.MEDIUM_FAST;

    @Test
    void sinExperienciaSuficienteNoSubeDeNivel()
    {
        long exp = TablaExperiencia.expParaNivel(this.curva, 5);

        Progreso.Resultado r = Progreso.aplicar(
                this.curva, 25, 5, exp, 1L, this.catalogo, List.of());

        assertEquals(5, r.nivelDespues());
        assertTrue(r.movimientosAprendidos().isEmpty());
    }

    @Test
    void alSubirVariosNivelesAprendeTodoLoQueSeSalto()
    {
        long desde = TablaExperiencia.expParaNivel(this.curva, 4);
        long hasta = TablaExperiencia.expParaNivel(this.curva, 8);

        Progreso.Resultado r = Progreso.aplicar(
                this.curva, 25, 4, desde, hasta - desde, this.catalogo, List.of());

        assertEquals(8, r.nivelDespues());
        assertEquals(List.of(105, 107), r.movimientosAprendidos(),
                "Los dos del camino, no solo el del nivel final");
    }

    @Test
    void loQueYaSabiaNoSeVuelveAAprender()
    {
        long desde = TablaExperiencia.expParaNivel(this.curva, 6);
        long hasta = TablaExperiencia.expParaNivel(this.curva, 8);

        Progreso.Resultado r = Progreso.aplicar(
                this.curva, 25, 6, desde, hasta - desde, this.catalogo, List.of());

        assertEquals(List.of(107), r.movimientosAprendidos(),
                "El del nivel 5 ya lo tenia antes de empezar");
    }

    @Test
    void alLlegarAlNivelDeEvolucionLoDice()
    {
        long desde = TablaExperiencia.expParaNivel(this.curva, 15);
        long hasta = TablaExperiencia.expParaNivel(this.curva, 16);

        List<Progreso.Evolucion> evoluciones = List.of(new Progreso.Evolucion(26, 16));

        Progreso.Resultado r = Progreso.aplicar(
                this.curva, 25, 15, desde, hasta - desde, this.catalogo, evoluciones);

        assertEquals(16, r.nivelDespues());
        assertEquals(26, r.evolucionA());
    }

    @Test
    void unaEvolucionQueNoEsPorNivelNoSeDispara()
    {
        long desde = TablaExperiencia.expParaNivel(this.curva, 15);
        long hasta = TablaExperiencia.expParaNivel(this.curva, 40);

        // nivelMinimo 0 es "esta evolucion no va por nivel": piedra, intercambio, amistad.
        List<Progreso.Evolucion> evoluciones = List.of(new Progreso.Evolucion(26, 0));

        Progreso.Resultado r = Progreso.aplicar(
                this.curva, 25, 15, desde, hasta - desde, this.catalogo, evoluciones);

        assertNull(r.evolucionA());
    }

    @Test
    void elNivelCienEsElTecho()
    {
        long tope = TablaExperiencia.expParaNivel(this.curva, TablaExperiencia.NIVEL_MAX);

        Progreso.Resultado r = Progreso.aplicar(
                this.curva, 25, 100, tope, 9_000_000L, this.catalogo, List.of());

        assertEquals(TablaExperiencia.NIVEL_MAX, r.nivelDespues());
        assertEquals(tope, r.experienciaFinal(), "La experiencia no se acumula por encima del tope");
    }
}
```

> Comprobar antes de ejecutar que `TablaExperiencia.Curva` tiene la constante `MEDIUM_FAST`; si el nombre real es otro (`MEDIO_RAPIDO`, por ejemplo), usar el que exista — la prueba no depende de cuál sea, solo de que sea una curva válida.

- [ ] **Paso 2: Ver que falla**

```bash
"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -o -f Desarrollo/PokemonEngine/pom.xml test -Dtest=ProgresoTest
```

Esperado: `cannot find symbol: class Progreso`.

- [ ] **Paso 3: Escribir `Progreso`**

```java
package com.retro.pokemonengine.batalla;

import com.retro.pokemonengine.entrenador.CatalogoGeneracion;
import com.retro.pokemonengine.entrenador.TablaExperiencia;

import java.util.ArrayList;
import java.util.List;

/**
 * Que le pasa a un Pokemon cuando gana experiencia.
 *
 * Decide, no ejecuta: dice a que nivel llega, que movimientos aprendio por el
 * camino y si le toca evolucionar. Guardar eso es cosa de quien tenga la
 * conexion. Asi el calculo se prueba sin emulador y sin base de datos.
 *
 * Los movimientos se juntan por tramo y no por nivel final: subir cuatro
 * niveles de golpe tiene que ensenar los cuatro, no solo el ultimo.
 */
public final class Progreso
{
    /** `nivelMinimo` en cero significa que esa evolucion no va por nivel. */
    public record Evolucion(int destinoId, int nivelMinimo)
    {
    }

    public record Resultado(
            int nivelAntes,
            int nivelDespues,
            long experienciaFinal,
            List<Integer> movimientosAprendidos,
            Integer evolucionA)
    {
        public boolean subio()
        {
            return this.nivelDespues > this.nivelAntes;
        }
    }

    private Progreso()
    {
    }

    public static Resultado aplicar(TablaExperiencia.Curva curva, int especieId, int nivelAntes,
                                    long experienciaAntes, long ganada,
                                    CatalogoGeneracion catalogo, List<Evolucion> evoluciones)
    {
        long tope = TablaExperiencia.expParaNivel(curva, TablaExperiencia.NIVEL_MAX);
        long fin = Math.min(tope, experienciaAntes + Math.max(0L, ganada));

        int nivelDespues = Math.max(nivelAntes, TablaExperiencia.nivelParaExp(curva, fin));

        List<Integer> aprendidos = new ArrayList<>();

        if(nivelDespues > nivelAntes && catalogo != null)
        {
            for(CatalogoGeneracion.MovimientoAprendido movimiento
                    : catalogo.movimientosPorNivel(especieId, nivelDespues))
            {
                if(movimiento.nivel() > nivelAntes && movimiento.nivel() <= nivelDespues)
                {
                    aprendidos.add(movimiento.moveId());
                }
            }
        }

        Integer evolucionA = null;

        if(evoluciones != null)
        {
            for(Evolucion evolucion : evoluciones)
            {
                if(evolucion.nivelMinimo() > 0 && nivelDespues >= evolucion.nivelMinimo())
                {
                    evolucionA = evolucion.destinoId();
                    break;
                }
            }
        }

        return new Resultado(nivelAntes, nivelDespues, fin, List.copyOf(aprendidos), evolucionA);
    }
}
```

- [ ] **Paso 4: Ver que pasa**

```bash
"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -o -f Desarrollo/PokemonEngine/pom.xml test
```

Esperado: BUILD SUCCESS, 316 pruebas.

- [ ] **Paso 5: Commit**

```bash
git add Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/batalla/Progreso.java Desarrollo/PokemonEngine/src/test/java/com/retro/pokemonengine/batalla/ProgresoTest.java
git commit -F - <<'EOF'
feat(pokemon): decide what levelling up brings

Level, the moves learned along the way, and whether an evolution is
due. Four levels at once teaches all four moves, not just the last
one. It decides; storing the result belongs to whoever holds the
connection.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 5: `ReglasEvolucion` — qué se conserva al evolucionar

**Ficheros:**
- Crear: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/entrenador/ReglasEvolucion.java`
- Prueba: `Desarrollo/PokemonEngine/src/test/java/com/retro/pokemonengine/entrenador/ReglasEvolucionTest.java`

**Interfaces:**
- Consume: `PokemonPoseido` (con `especieId()`, `ponerEspecieId(int)`, `psMax(EspecieCatalogo)`, `psActual()`, `ponerPsActual(int)`, `variante()`, `ponerVariante(String)`, `habilidadSlot()`, `ponerHabilidadId(Integer)`), `EspecieGeneracion` (con `habilidad1Id()`, `habilidad2Id()`, `habilidadOcultaId()`).
- Produce: `ReglasEvolucion.evolucionar(PokemonPoseido pokemon, EspecieGeneracion nueva, java.util.Set<String> variantesDeLaNueva)`, que muta el Pokémon en sitio y devuelve `void`.

> **Antes de escribir el código:** abrir `PokemonPoseido.java` y confirmar los nombres reales de los mutadores (`ponerEspecieId`, `ponerPsActual`, `ponerHabilidadId`, `habilidadSlot`). Si alguno no existe con ese nombre exacto, usar el que haya; si no existe en absoluto, añadirlo siguiendo el estilo del fichero (`public void ponerX(...)`).

- [ ] **Paso 1: Escribir la prueba que falla**

`ReglasEvolucionTest.java`:

```java
package com.retro.pokemonengine.entrenador;

import com.retro.pokemonengine.combate.EspecieCatalogo;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ReglasEvolucionTest
{
    private EspecieGeneracion especie(int id, int baseHp, Integer h1, Integer h2, Integer oculta)
    {
        EspecieCatalogo base = new EspecieCatalogo(
                id, "Especie" + id, 13, null, baseHp, 55, 40, 50, 50, 90, 190, 112, "medium_fast");

        return new EspecieGeneracion(base, h1, h2, oculta, 50.0, 70, 2560);
    }

    private PokemonPoseido pichu(EspecieCatalogo base)
    {
        PokemonPoseido p = new PokemonPoseido();

        p.ponerEspecieId(base.id());
        p.ponerNivel(30);
        p.ponerShiny(true);
        p.ponerIv(Stat.PS, 31);
        p.ponerPsActual(p.psMax(base) - 5);

        return p;
    }

    @Test
    void conservaLoQueDefineAlPokemon()
    {
        EspecieGeneracion antes = especie(172, 20, 9, null, 31);
        EspecieGeneracion despues = especie(25, 35, 9, null, 31);

        PokemonPoseido p = pichu(antes.base());
        int danoAntes = p.psMax(antes.base()) - p.psActual();

        ReglasEvolucion.evolucionar(p, despues, Set.of());

        assertEquals(25, p.especieId());
        assertEquals(30, p.nivel(), "El nivel no cambia al evolucionar");
        assertTrue(p.shiny(), "Un variocolor sigue siendo variocolor despues de evolucionar");
        assertEquals(31, p.iv(Stat.PS), "Los IV son del individuo, no de la especie");
        assertEquals(danoAntes, p.psMax(despues.base()) - p.psActual(),
                "Los PS maximos suben con las bases nuevas, pero el dano recibido se arrastra");
    }

    @Test
    void laHabilidadSeVuelveAResolverPorElHueco()
    {
        EspecieGeneracion despues = especie(25, 35, 900, 901, 902);

        PokemonPoseido p = pichu(especie(172, 20, 9, null, 31).base());
        p.ponerHabilidadSlot(2);

        ReglasEvolucion.evolucionar(p, despues, Set.of());

        assertEquals(901, p.habilidadId(), "El hueco 2 pasa a ser la segunda habilidad de la nueva especie");
    }

    @Test
    void laOcultaSigueSiendoOculta()
    {
        EspecieGeneracion despues = especie(25, 35, 900, 901, 902);

        PokemonPoseido p = pichu(especie(172, 20, 9, null, 31).base());
        p.ponerHabilidadSlot(3);

        ReglasEvolucion.evolucionar(p, despues, Set.of());

        assertEquals(902, p.habilidadId());
        assertEquals(3, p.habilidadSlot());
    }

    @Test
    void elDisfrazSobreviveSiLaNuevaEspecieLoTiene()
    {
        EspecieGeneracion despues = especie(25, 35, 9, null, 31);

        PokemonPoseido p = pichu(especie(172, 20, 9, null, 31).base());
        p.ponerVariante("pikachu_disfraz");

        ReglasEvolucion.evolucionar(p, despues, Set.of("pikachu_disfraz"));

        assertEquals("pikachu_disfraz", p.variante());
    }

    @Test
    void siLaNuevaEspecieNoTieneEsaVarianteSeVuelveNormal()
    {
        EspecieGeneracion despues = especie(26, 60, 9, null, 31);

        PokemonPoseido p = pichu(especie(25, 35, 9, null, 31).base());
        p.ponerVariante("pikachu_disfraz");

        ReglasEvolucion.evolucionar(p, despues, Set.of());

        assertEquals("normal", p.variante(),
                "Un Raichu no puede llevar el disfraz que solo existe para Pikachu");
    }

    @Test
    void unPokemonDebilitadoSigueDebilitado()
    {
        EspecieGeneracion despues = especie(25, 35, 9, null, 31);

        PokemonPoseido p = pichu(especie(172, 20, 9, null, 31).base());
        p.ponerPsActual(0);

        ReglasEvolucion.evolucionar(p, despues, Set.of());

        assertEquals(0, p.psActual(), "Evolucionar no cura");
    }
}
```

> Los nombres `ponerNivel`, `ponerIv`, `iv`, `abilityId`, `ponerHabilidadSlot` hay que confirmarlos en `PokemonPoseido.java` antes de ejecutar, igual que arriba. El comportamiento que se prueba no cambia.

- [ ] **Paso 2: Ver que falla**

```bash
"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -o -f Desarrollo/PokemonEngine/pom.xml test -Dtest=ReglasEvolucionTest
```

Esperado: `cannot find symbol: class ReglasEvolucion`.

- [ ] **Paso 3: Escribir `ReglasEvolucion`**

```java
package com.retro.pokemonengine.entrenador;

import java.util.Set;

/**
 * Evolucionar cambia la especie y casi nada mas.
 *
 * Todo lo que hace unico a ese Pokemon concreto se queda: IV, EV, naturaleza,
 * genero, variocolor, entrenador original, ball, donde y a que nivel se
 * capturo, mote, amistad y experiencia. Perder cualquiera de esas cosas
 * convertiria la evolucion en un castigo para quien ha criado con cuidado.
 *
 * Solo dos cosas se recalculan, y por motivos distintos:
 *
 * - Los **PS maximos**, porque dependen de las bases de la especie. El dano
 *   recibido se arrastra tal cual: evolucionar no cura.
 * - La **habilidad**, que se resuelve otra vez por el hueco. La oculta sigue
 *   siendo oculta.
 *
 * Y un caso raro: si la especie nueva no tiene la variante de disfraz que
 * llevaba, vuelve a `normal`. Un Raichu no puede llevar un disfraz que solo
 * existe dibujado para Pikachu.
 */
public final class ReglasEvolucion
{
    public static final String VARIANTE_NORMAL = "normal";

    private ReglasEvolucion()
    {
    }

    public static void evolucionar(PokemonPoseido pokemon, EspecieGeneracion nueva,
                                   Set<String> variantesDeLaNueva)
    {
        if(pokemon == null || nueva == null) return;

        // El dano se mide antes de cambiar de especie, porque psMax depende de ella.
        int danoRecibido = Math.max(0, pokemon.psMax(especieDe(pokemon, nueva)) - pokemon.psActual());
        boolean debilitado = pokemon.psActual() <= 0;

        pokemon.ponerEspecieId(nueva.id());

        int psMaxNuevo = pokemon.psMax(nueva.base());

        pokemon.ponerPsActual(debilitado ? 0 : Math.max(1, psMaxNuevo - danoRecibido));

        pokemon.ponerHabilidadId(habilidadDelHueco(nueva, pokemon.habilidadSlot()));

        String variante = pokemon.variante();

        if(variante != null && !VARIANTE_NORMAL.equals(variante)
                && (variantesDeLaNueva == null || !variantesDeLaNueva.contains(variante)))
        {
            pokemon.ponerVariante(VARIANTE_NORMAL);
        }
    }

    /**
     * El hueco 3 es la habilidad oculta y se queda oculta. Si la especie nueva
     * no tiene esa habilidad concreta, se cae al hueco 1, que siempre existe.
     */
    private static Integer habilidadDelHueco(EspecieGeneracion especie, int hueco)
    {
        Integer elegida = switch(hueco)
        {
            case 2 -> especie.habilidad2Id();
            case 3 -> especie.habilidadOcultaId();
            default -> especie.habilidad1Id();
        };

        return elegida != null ? elegida : especie.habilidad1Id();
    }

    /**
     * Los PS maximos de antes de evolucionar. `PokemonPoseido` no guarda su
     * especie de catalogo, asi que hay que pasarsela; en el unico sitio donde
     * esto se llama, la de antes ya no esta a mano y la diferencia de bases se
     * calcula con la nueva. Se mide el dano con lo que haya.
     */
    private static com.retro.pokemonengine.combate.EspecieCatalogo especieDe(
            PokemonPoseido pokemon, EspecieGeneracion nueva)
    {
        return nueva.base();
    }
}
```

> **Cuidado, esto tiene una arista real:** `especieDe` devuelve la especie **nueva**, así que el daño se mide contra las bases nuevas y no contra las viejas. Para que el arrastre sea exacto, `evolucionar` debe recibir también la especie de antes. Al implementar, cambiar la firma a:
> ```java
> public static void evolucionar(PokemonPoseido pokemon,
>                                com.retro.pokemonengine.combate.EspecieCatalogo antes,
>                                EspecieGeneracion nueva, Set<String> variantesDeLaNueva)
> ```
> medir `danoRecibido` con `antes`, borrar el método `especieDe`, y ajustar la prueba para pasar `antes.base()`. Se deja escrito aquí porque es el error fácil de cometer y la prueba `conservaLoQueDefineAlPokemon` es la que lo cazaría.

- [ ] **Paso 4: Ver que pasa**

```bash
"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -o -f Desarrollo/PokemonEngine/pom.xml test
```

Esperado: BUILD SUCCESS, 322 pruebas.

- [ ] **Paso 5: Commit**

```bash
git add Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/entrenador/ReglasEvolucion.java Desarrollo/PokemonEngine/src/test/java/com/retro/pokemonengine/entrenador/ReglasEvolucionTest.java
git commit -F - <<'EOF'
feat(pokemon): keep what makes a Pokemon itself through evolution

IVs, EVs, nature, gender, shininess, original trainer, ball, where and
at what level it was caught, nickname, friendship and experience all
survive. Only max HP and the ability are recomputed, and a costume the
new species has no art for falls back to normal.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 6: `PlanArena` — la geometría de la formación

**Ficheros:**
- Crear: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/batalla/PlanArena.java`
- Prueba: `Desarrollo/PokemonEngine/src/test/java/com/retro/pokemonengine/batalla/PlanArenaTest.java`

**Interfaces:**
- Produce: `PlanArena.Transitable` (interfaz funcional `boolean puede(int x, int y)`), `PlanArena.Hueco(String rol, int x, int y, int direccion)`, `PlanArena.Formacion(int direccion, List<Hueco> huecos)` con `de(String rol)`, y los métodos `roles(Formato)`, `enLinea(int, int, int, Formato)`, `cabe(Formacion, Transitable)`, `resolver(int, int, Formato, Transitable)` y `distancia(int, int, int, int)`.
- Consume: `Formato`.

- [ ] **Paso 1: Escribir la prueba que falla**

`PlanArenaTest.java`:

```java
package com.retro.pokemonengine.batalla;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PlanArenaTest
{
    /** Una sala de 10x10 entera caminable. */
    private final PlanArena.Transitable salaLibre = (x, y) -> x >= 0 && x < 10 && y >= 0 && y < 10;

    @Test
    void elCombateSalvajeSonTresHuecos()
    {
        assertEquals(3, PlanArena.roles(Formato.SALVAJE).size());
        assertEquals(4, PlanArena.roles(Formato.PVP_AMISTOSO).size());
    }

    @Test
    void laLineaSalvajeVaEntrenadorPokemonSalvaje()
    {
        // Direccion 2 es el este: cada hueco una baldosa mas a la derecha.
        PlanArena.Formacion f = PlanArena.enLinea(4, 4, 2, Formato.SALVAJE);

        assertEquals(4, f.de(PlanArena.ROL_ENTRENADOR_A).x());
        assertEquals(5, f.de(PlanArena.ROL_POKEMON_A).x());
        assertEquals(6, f.de(PlanArena.ROL_SALVAJE).x());

        for(PlanArena.Hueco hueco : f.huecos()) assertEquals(4, hueco.y());
    }

    @Test
    void cadaBandoMiraAlContrario()
    {
        PlanArena.Formacion f = PlanArena.enLinea(4, 4, 2, Formato.SALVAJE);

        assertEquals(2, f.de(PlanArena.ROL_ENTRENADOR_A).direccion());
        assertEquals(2, f.de(PlanArena.ROL_POKEMON_A).direccion());
        assertEquals(6, f.de(PlanArena.ROL_SALVAJE).direccion(),
                "El salvaje mira al oeste, que es de donde viene el jugador");
    }

    @Test
    void enPvpLosEntrenadoresQuedanEnLosExtremos()
    {
        PlanArena.Formacion f = PlanArena.enLinea(2, 5, 2, Formato.PVP_AMISTOSO);

        assertEquals(2, f.de(PlanArena.ROL_ENTRENADOR_A).x());
        assertEquals(3, f.de(PlanArena.ROL_POKEMON_A).x());
        assertEquals(4, f.de(PlanArena.ROL_POKEMON_B).x());
        assertEquals(5, f.de(PlanArena.ROL_ENTRENADOR_B).x());

        assertEquals(6, f.de(PlanArena.ROL_ENTRENADOR_B).direccion());
    }

    @Test
    void enSalaLibreLaFormacionEmpiezaDondeEstaElJugador()
    {
        PlanArena.Formacion f = PlanArena.resolver(4, 4, Formato.SALVAJE, this.salaLibre);

        assertNotNull(f);
        assertEquals(4, f.de(PlanArena.ROL_ENTRENADOR_A).x());
        assertEquals(4, f.de(PlanArena.ROL_ENTRENADOR_A).y(),
                "Si cabe sin moverse, el jugador no se mueve");
    }

    @Test
    void siUnaDireccionNoCabeSeProbaraOtra()
    {
        // Solo cabe hacia el oeste: a la derecha y abajo no hay suelo.
        PlanArena.Transitable pasillo = (x, y) -> y == 4 && x >= 0 && x <= 9;

        PlanArena.Formacion f = PlanArena.resolver(9, 4, Formato.SALVAJE, pasillo);

        assertNotNull(f);
        assertEquals(6, f.direccion());
        assertEquals(7, f.de(PlanArena.ROL_SALVAJE).x());
    }

    @Test
    void siNoCabeEnNingunSitioDevuelveNulo()
    {
        // Una sola baldosa suelta: no hay linea de tres.
        PlanArena.Transitable unaBaldosa = (x, y) -> x == 4 && y == 4;

        assertNull(PlanArena.resolver(4, 4, Formato.SALVAJE, unaBaldosa));
    }

    @Test
    void siNoCabeJustoDondeEstaSeBuscaCerca()
    {
        // Hueco de tres en la fila 6; el jugador esta en (4,4), en una isla.
        PlanArena.Transitable apartado = (x, y) ->
                (x == 4 && y == 4) || (y == 6 && x >= 3 && x <= 8);

        PlanArena.Formacion f = PlanArena.resolver(4, 4, Formato.SALVAJE, apartado);

        assertNotNull(f);
        assertTrue(PlanArena.cabe(f, apartado));
        assertEquals(6, f.de(PlanArena.ROL_ENTRENADOR_A).y());
    }

    @Test
    void masAlladelRadioDeBusquedaYaNoSeBusca()
    {
        PlanArena.Transitable lejos = (x, y) ->
                (x == 0 && y == 0) || (y == 9 && x >= 0 && x <= 8);

        assertNull(PlanArena.resolver(0, 0, Formato.SALVAJE, lejos),
                "A nueve baldosas la formacion ya no es la de este jugador");
    }

    @Test
    void laDistanciaEsLaQueAndaUnAvatar()
    {
        // En diagonal se anda igual de rapido que en recto: distancia de Chebyshev.
        assertEquals(3, PlanArena.distancia(0, 0, 3, 3));
        assertEquals(5, PlanArena.distancia(2, 2, 7, 4));
    }

    @Test
    void cabeDiceQueNoCuandoAlgunHuecoEstaOcupado()
    {
        PlanArena.Formacion f = PlanArena.enLinea(4, 4, 2, Formato.SALVAJE);

        assertTrue(PlanArena.cabe(f, this.salaLibre));
        assertFalse(PlanArena.cabe(f, (x, y) -> this.salaLibre.puede(x, y) && x != 5));
    }
}
```

- [ ] **Paso 2: Ver que falla**

```bash
"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -o -f Desarrollo/PokemonEngine/pom.xml test -Dtest=PlanArenaTest
```

Esperado: `cannot find symbol: class PlanArena`.

- [ ] **Paso 3: Escribir `PlanArena`**

```java
package com.retro.pokemonengine.batalla;

import java.util.ArrayList;
import java.util.List;

/**
 * Donde se coloca cada uno para pelear.
 *
 * La formacion es una linea: Entrenador - Pokemon - Pokemon - Entrenador en
 * PvP, y Entrenador - Pokemon - Salvaje contra la hierba. Los entrenadores en
 * los extremos, mirando al centro.
 *
 * Esta clase es geometria pura y no sabe nada de salas: la caminabilidad entra
 * como un predicado. Eso la hace probable con un tablero de mentira y deja
 * fuera la unica parte que de verdad necesita el emulador.
 *
 * La busqueda empieza por la baldosa del jugador, asi que si cabe donde esta,
 * no se le mueve. Solo si no cabe se mira alrededor, y nunca mas alla de
 * RADIO_BUSQUEDA: una formacion a nueve baldosas ya no es la de este combate.
 */
public final class PlanArena
{
    public static final String ROL_ENTRENADOR_A = "entrenador_a";
    public static final String ROL_POKEMON_A = "pokemon_a";
    public static final String ROL_POKEMON_B = "pokemon_b";
    public static final String ROL_ENTRENADOR_B = "entrenador_b";
    public static final String ROL_SALVAJE = "salvaje";

    /** Hasta donde se desplaza la formacion si no cabe donde esta el jugador. */
    public static final int RADIO_BUSQUEDA = 3;

    /** Lo lejos que pueden estar dos entrenadores para retarse. */
    public static final int DISTANCIA_RETO_MAX = 5;

    // Rotaciones de Habbo: 0 norte, 2 este, 4 sur, 6 oeste.
    private static final int[] DX = {0, 1, 1, 1, 0, -1, -1, -1};
    private static final int[] DY = {-1, -1, 0, 1, 1, 1, 0, -1};

    /** Solo las cuatro rectas: una linea en diagonal se ve torcida en sala. */
    private static final int[] CARDINALES = {0, 2, 4, 6};

    @FunctionalInterface
    public interface Transitable
    {
        boolean puede(int x, int y);
    }

    public record Hueco(String rol, int x, int y, int direccion)
    {
    }

    public record Formacion(int direccion, List<Hueco> huecos)
    {
        /** null si ese rol no existe en este formato. */
        public Hueco de(String rol)
        {
            for(Hueco hueco : this.huecos)
            {
                if(hueco.rol().equals(rol)) return hueco;
            }

            return null;
        }
    }

    private PlanArena()
    {
    }

    public static List<String> roles(Formato formato)
    {
        return formato == Formato.SALVAJE
                ? List.of(ROL_ENTRENADOR_A, ROL_POKEMON_A, ROL_SALVAJE)
                : List.of(ROL_ENTRENADOR_A, ROL_POKEMON_A, ROL_POKEMON_B, ROL_ENTRENADOR_B);
    }

    public static Formacion enLinea(int anclaX, int anclaY, int direccion, Formato formato)
    {
        List<String> roles = roles(formato);
        List<Hueco> huecos = new ArrayList<>();

        int opuesta = (direccion + 4) % 8;

        // Con tres roles el corte cae en 2: los dos primeros son del bando A.
        int mitad = (roles.size() + 1) / 2;

        for(int i = 0; i < roles.size(); i++)
        {
            huecos.add(new Hueco(
                    roles.get(i),
                    anclaX + DX[direccion] * i,
                    anclaY + DY[direccion] * i,
                    i < mitad ? direccion : opuesta));
        }

        return new Formacion(direccion, List.copyOf(huecos));
    }

    public static boolean cabe(Formacion formacion, Transitable transitable)
    {
        if(formacion == null || transitable == null) return false;

        for(Hueco hueco : formacion.huecos())
        {
            if(!transitable.puede(hueco.x(), hueco.y())) return false;
        }

        return true;
    }

    /** null si no cabe la formacion en ningun sitio cerca. El cliente lo traduce a "en interfaz". */
    public static Formacion resolver(int origenX, int origenY, Formato formato,
                                     Transitable transitable)
    {
        for(int radio = 0; radio <= RADIO_BUSQUEDA; radio++)
        {
            for(int dx = -radio; dx <= radio; dx++)
            {
                for(int dy = -radio; dy <= radio; dy++)
                {
                    // Solo el borde del cuadrado: el interior ya se probo con un radio menor.
                    if(Math.max(Math.abs(dx), Math.abs(dy)) != radio) continue;

                    for(int direccion : CARDINALES)
                    {
                        Formacion formacion = enLinea(
                                origenX + dx, origenY + dy, direccion, formato);

                        if(cabe(formacion, transitable)) return formacion;
                    }
                }
            }
        }

        return null;
    }

    /** Distancia de Chebyshev, que es como anda un avatar de Habbo: la diagonal cuesta uno. */
    public static int distancia(int ax, int ay, int bx, int by)
    {
        return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
    }
}
```

- [ ] **Paso 4: Ver que pasa**

```bash
"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -o -f Desarrollo/PokemonEngine/pom.xml test
```

Esperado: BUILD SUCCESS, 333 pruebas.

- [ ] **Paso 5: Commit**

```bash
git add Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/batalla/PlanArena.java Desarrollo/PokemonEngine/src/test/java/com/retro/pokemonengine/batalla/PlanArenaTest.java
git commit -F - <<'EOF'
feat(pokemon): work out where everyone stands to fight

The line formation and its search for room, as pure geometry: walkable
tiles come in as a predicate, so it tests against a fake board. The
search starts on the player's own tile, so if it fits they never move.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 7: `ReglasAbandono` y `MenteSalvaje`

**Ficheros:**
- Crear: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/batalla/ReglasAbandono.java`
- Crear: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/batalla/MenteSalvaje.java`
- Prueba: `Desarrollo/PokemonEngine/src/test/java/com/retro/pokemonengine/batalla/ReglasAbandonoTest.java`
- Prueba: `Desarrollo/PokemonEngine/src/test/java/com/retro/pokemonengine/batalla/MenteSalvajeTest.java`

**Interfaces:**
- Produce: `ReglasAbandono.GRACIA_MS`, `TURNO_MS`, `expirado(long ausenteDesdeMs, long ahoraMs)`, `restanteMs(long, long)`, `turnoExpirado(long turnoDesdeMs, long ahoraMs)`; y `MenteSalvaje.elegir(PokemonCombate salvaje, int bando, int posicion, RngCombate rng)` que devuelve una `Accion`.
- Consume: `PokemonCombate.movimientos()` → `List<MovimientoEnCombate>` con `tienePp()`; `Accion.movimiento(bando, posicion, indiceMovimiento, bandoObjetivo, posicionObjetivo)`.

- [ ] **Paso 1: Escribir las dos pruebas que fallan**

`ReglasAbandonoTest.java`:

```java
package com.retro.pokemonengine.batalla;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ReglasAbandonoTest
{
    @Test
    void dentroDelPlazoTodaviaSeLeEspera()
    {
        long ausente = 1_000_000L;

        assertFalse(ReglasAbandono.expirado(ausente, ausente + 1000L));
        assertFalse(ReglasAbandono.expirado(ausente, ausente + ReglasAbandono.GRACIA_MS - 1));
    }

    @Test
    void alCumplirseElPlazoSeAcabo()
    {
        long ausente = 1_000_000L;

        assertTrue(ReglasAbandono.expirado(ausente, ausente + ReglasAbandono.GRACIA_MS));
        assertTrue(ReglasAbandono.expirado(ausente, ausente + ReglasAbandono.GRACIA_MS + 60_000L));
    }

    @Test
    void loQueQuedaNuncaEsNegativo()
    {
        long ausente = 1_000_000L;

        assertEquals(ReglasAbandono.GRACIA_MS, ReglasAbandono.restanteMs(ausente, ausente));
        assertEquals(0L, ReglasAbandono.restanteMs(ausente, ausente + ReglasAbandono.GRACIA_MS * 2));
    }

    @Test
    void elTurnoTieneSuPropioReloj()
    {
        long abierto = 500L;

        assertFalse(ReglasAbandono.turnoExpirado(abierto, abierto + ReglasAbandono.TURNO_MS - 1));
        assertTrue(ReglasAbandono.turnoExpirado(abierto, abierto + ReglasAbandono.TURNO_MS));
        assertTrue(ReglasAbandono.TURNO_MS < ReglasAbandono.GRACIA_MS,
                "Esperar por una eleccion no puede costar mas que esperar por una reconexion");
    }
}
```

`MenteSalvajeTest.java`:

```java
package com.retro.pokemonengine.batalla;

import com.retro.pokemonengine.combate.Accion;
import com.retro.pokemonengine.combate.MovimientoEnCombate;
import com.retro.pokemonengine.combate.PokemonCombate;
import com.retro.pokemonengine.combate.RngCombate;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MenteSalvajeTest
{
    private PokemonCombate rattata(int... ppPorMovimiento)
    {
        PokemonCombate p = new PokemonCombate(
                0, 19, "Rattata", 2, 0, null, 15, new int[]{15, 8, 7, 5, 6, 9});

        for(int i = 0; i < ppPorMovimiento.length; i++)
        {
            p.movimientos().add(new MovimientoEnCombate(30 + i, 35, ppPorMovimiento[i]));
        }

        return p;
    }

    @Test
    void ataqueAlBandoContrarioYAlPokemonDeEnfrente()
    {
        Accion accion = MenteSalvaje.elegir(rattata(35, 35), 1, 0, new RngCombate(7L));

        assertEquals(Accion.Tipo.MOVIMIENTO, accion.tipo());
        assertEquals(1, accion.bando());
        assertEquals(0, accion.bandoObjetivo());
        assertEquals(0, accion.posicionObjetivo());
    }

    @Test
    void conElTiempoUsaTodosLosQueTiene()
    {
        RngCombate rng = new RngCombate(20260919L);
        Set<Integer> vistos = new HashSet<>();

        for(int i = 0; i < 500; i++)
        {
            vistos.add(MenteSalvaje.elegir(rattata(35, 35, 35, 35), 1, 0, rng).indiceMovimiento());
        }

        assertEquals(Set.of(0, 1, 2, 3), vistos, "Elegir siempre el mismo no es elegir");
    }

    @Test
    void nuncaUsaUnMovimientoSinPp()
    {
        RngCombate rng = new RngCombate(3L);

        for(int i = 0; i < 500; i++)
        {
            // Solo al tercero le quedan PP.
            int elegido = MenteSalvaje.elegir(rattata(0, 0, 12, 0), 1, 0, rng).indiceMovimiento();

            assertEquals(2, elegido);
        }
    }

    @Test
    void sinPpEnNingunoSigueDevolviendoAlgoValido()
    {
        Accion accion = MenteSalvaje.elegir(rattata(0, 0), 1, 0, new RngCombate(1L));

        assertEquals(Accion.Tipo.MOVIMIENTO, accion.tipo());
        assertTrue(accion.indiceMovimiento() >= 0,
                "El motor ya emite sin_pp; lo que no puede es recibir un indice imposible");
    }

    @Test
    void sinMovimientosNoRevienta()
    {
        Accion accion = MenteSalvaje.elegir(rattata(), 1, 0, new RngCombate(1L));

        assertEquals(Accion.Tipo.MOVIMIENTO, accion.tipo());
    }
}
```

- [ ] **Paso 2: Ver que fallan**

```bash
"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -o -f Desarrollo/PokemonEngine/pom.xml test -Dtest='ReglasAbandonoTest+MenteSalvajeTest'
```

Esperado: `cannot find symbol: class ReglasAbandono` y `class MenteSalvaje`.

- [ ] **Paso 3: Escribir `ReglasAbandono`**

```java
package com.retro.pokemonengine.batalla;

/**
 * Cuanto se espera a alguien.
 *
 * Dos relojes distintos y a proposito. El del **turno** es corto: el rival no
 * puede quedarse mirando la pantalla media hora. El de la **gracia** es largo:
 * a quien se le cae la conexion no se le castiga por su router.
 *
 * Esta clase solo compara numeros. Quien decide que hacer al expirar — mover
 * por el jugador, o darle la derrota por abandono — es ServicioBatalla.
 */
public final class ReglasAbandono
{
    /** Lo que se espera a quien se ha caido antes de darle la derrota. */
    public static final long GRACIA_MS = 3L * 60L * 1000L;

    /** Lo que se espera a que alguien elija accion. */
    public static final long TURNO_MS = 30L * 1000L;

    private ReglasAbandono()
    {
    }

    public static boolean expirado(long ausenteDesdeMs, long ahoraMs)
    {
        return ahoraMs - ausenteDesdeMs >= GRACIA_MS;
    }

    public static long restanteMs(long ausenteDesdeMs, long ahoraMs)
    {
        return Math.max(0L, GRACIA_MS - (ahoraMs - ausenteDesdeMs));
    }

    public static boolean turnoExpirado(long turnoDesdeMs, long ahoraMs)
    {
        return ahoraMs - turnoDesdeMs >= TURNO_MS;
    }
}
```

- [ ] **Paso 4: Escribir `MenteSalvaje`**

```java
package com.retro.pokemonengine.batalla;

import com.retro.pokemonengine.combate.Accion;
import com.retro.pokemonengine.combate.PokemonCombate;
import com.retro.pokemonengine.combate.RngCombate;

import java.util.ArrayList;
import java.util.List;

/**
 * Lo que hace el salvaje en su turno.
 *
 * Elige al azar entre los movimientos que le quedan con PP, y ya esta. No es
 * una IA y no pretende serlo: un salvaje de los juegos tampoco piensa, y darle
 * estrategia a un Rattata de nivel dos solo haria mas frustrante el primer
 * combate de la partida. La IA de verdad llegara con los gimnasios, y llegara
 * como otro controlador, sin tocar esto.
 */
public final class MenteSalvaje
{
    private MenteSalvaje()
    {
    }

    public static Accion elegir(PokemonCombate salvaje, int bando, int posicion, RngCombate rng)
    {
        int contrario = 1 - bando;

        List<Integer> conPp = new ArrayList<>();

        for(int i = 0; i < salvaje.movimientos().size(); i++)
        {
            if(salvaje.movimientos().get(i).tienePp()) conPp.add(i);
        }

        // Sin PP en ninguno se manda el primero: el motor emitira "sin_pp" y el
        // turno se pierde, que es exactamente lo que pasa en los juegos.
        if(conPp.isEmpty())
        {
            return Accion.movimiento(bando, posicion, 0, contrario, posicion);
        }

        int elegido = conPp.get(rng.entre(0, conPp.size() - 1));

        return Accion.movimiento(bando, posicion, elegido, contrario, posicion);
    }
}
```

- [ ] **Paso 5: Ver que pasa**

```bash
"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -o -f Desarrollo/PokemonEngine/pom.xml test
```

Esperado: BUILD SUCCESS, 342 pruebas.

- [ ] **Paso 6: Comprobar la pureza y hacer commit**

```bash
grep -rn "com.eu.habbo" Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/batalla/
git add Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/batalla/ Desarrollo/PokemonEngine/src/test/java/com/retro/pokemonengine/batalla/
git commit -F - <<'EOF'
feat(pokemon): give the wild Pokemon a turn and the player a clock

Two clocks on purpose: thirty seconds to choose, three minutes to
reconnect. Nobody gets punished for their router, and nobody gets to
stare at the screen while the other player waits.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 8: La sesión de combate — `ServicioBatalla` y el catálogo en runtime

**Ficheros:**
- Modificar: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/ServicioPokedex.java`
- Crear: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/ServicioBatalla.java`
- Modificar: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/PokemonAcciones.java`

**Interfaces:**
- Consume: `ServicioCombate(CatalogoCombate, IntFunction<EjecutorMovimiento.Mecanica>)`, `EstadoCombate(Bando, Bando, RngCombate)`, `Bando(int indice)`, `PokemonPoseido.aCombate(EspecieCatalogo, int nivelEfectivo)`, `ServicioEncuentros.Salvaje`, `ServicioEntrenador.cargarPokemon(int userId)`, `ServicioPokedex.especie(int)`, `ServicioPokedex.mecanica(int)`.
- Produce: `ServicioPokedex.catalogo()` que devuelve un `CatalogoCombate`; `ServicioBatalla.Sesion`; `ServicioBatalla.de(int userId)`, `abrirSalvaje(Habbo, ServicioEncuentros.Salvaje)`, `cuerpo(Sesion, int userId)`, `empujar(Sesion, int accion, Object datos)`, `empujarEstado(Sesion)`; y las constantes de acción 63-68.

- [ ] **Paso 1: Exponer el catálogo como `CatalogoCombate`**

`ServicioCombate` necesita un `CatalogoCombate` y en runtime no hay ninguno: `ServicioPokedex` es todo estático. Añadir al final de `ServicioPokedex.java`, antes de la llave de cierre, y el import `com.retro.pokemonengine.combate.CatalogoCombate`:

```java
    /**
     * El catalogo visto por el motor. Existe porque `combate` no puede importar
     * este servicio (importaria el emulador) y el motor pide la interfaz.
     * Es una vista, no una copia: lee siempre los mapas vivos.
     */
    private static final CatalogoCombate CATALOGO = new CatalogoCombate()
    {
        @Override
        public MovimientoCatalogo movimiento(int id)
        {
            return ServicioPokedex.movimiento(id);
        }

        @Override
        public EspecieCatalogo especie(int id)
        {
            return ServicioPokedex.especie(id);
        }

        @Override
        public TablaTipos tipos()
        {
            return ServicioPokedex.tipos();
        }
    };

    public static CatalogoCombate catalogo()
    {
        return CATALOGO;
    }
```

- [ ] **Paso 2: Reservar los códigos de acción**

En `PokemonAcciones.java`, debajo de `ENCUENTRO_HUIR`:

```java
    public static final int BATALLA_ESTADO = 63;
    public static final int BATALLA_ACCION = 64;
    public static final int BATALLA_EVENTOS = 65;
    public static final int BATALLA_RETAR = 66;
    public static final int BATALLA_RETO_RESPONDER = 67;
    public static final int BATALLA_RENDIRSE = 68;
```

`BATALLA_EVENTOS` solo viaja del servidor al cliente: es el empujón con lo que ha pasado en el turno.

- [ ] **Paso 3: Escribir `ServicioBatalla` con lo justo para abrir un combate**

`ServicioBatalla.java`:

```java
package com.retro.pokemonengine;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.users.Habbo;
import com.retro.pokemonengine.batalla.Formato;
import com.retro.pokemonengine.combate.Accion;
import com.retro.pokemonengine.combate.Bando;
import com.retro.pokemonengine.combate.EspecieCatalogo;
import com.retro.pokemonengine.combate.EstadoCombate;
import com.retro.pokemonengine.combate.Evento;
import com.retro.pokemonengine.combate.MovimientoCatalogo;
import com.retro.pokemonengine.combate.MovimientoEnCombate;
import com.retro.pokemonengine.combate.PokemonCombate;
import com.retro.pokemonengine.combate.RngCombate;
import com.retro.pokemonengine.combate.ServicioCombate;
import com.retro.pokemonengine.entrenador.PokemonPoseido;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.sql.Types;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Un combate en marcha.
 *
 * El estado vivo se queda aqui, en memoria, porque un turno son milisegundos y
 * bajarlo a disco en cada paso seria pagar una consulta por animacion. A la
 * base de datos van dos cosas: el snapshot al cerrar cada turno, que es lo
 * unico que hace falta para volver tras una caida, y el log de eventos, que es
 * lo que permitira auditar y repetir un combate cuando existan los torneos.
 *
 * Un jugador solo puede estar en un combate. El mapa por userId es la llave de
 * todo lo demas: el bloqueo de sala, el de posicion y el de encuentros nuevos
 * preguntan aqui.
 */
public final class ServicioBatalla
{
    public static final String SIN_BATALLA = "SIN_BATALLA";
    public static final String NO_ES_TU_TURNO = "NO_ES_TU_TURNO";

    public static final String MOTIVO_KO = "ko";
    public static final String MOTIVO_HUIDA = "huida";
    public static final String MOTIVO_CAPTURA = "captura";
    public static final String MOTIVO_ABANDONO = "abandono";
    public static final String MOTIVO_ANULADA = "anulada";

    public static final class Sesion
    {
        public final long id;
        public final Formato formato;
        public final Integer zonaId;
        public final int roomId;
        public final boolean enInterfaz;
        public final long semilla;
        public final EstadoCombate estado;

        /** 0 en el bando que no es un jugador. */
        public final int[] userIds = new int[2];

        /** El Pokemon de cada bando tal y como esta en la base: null en el salvaje. */
        public final PokemonPoseido[] propios = new PokemonPoseido[2];

        public ServicioEncuentros.Salvaje salvaje;

        public final Accion[] elegidas = new Accion[2];

        public long turnoDesdeMs = System.currentTimeMillis();
        public int intentosHuida;
        public long ausenteDesdeMs;
        public int ausenteBando = -1;
        public int ordenLog;

        Sesion(long id, Formato formato, Integer zonaId, int roomId, boolean enInterfaz,
               long semilla, EstadoCombate estado)
        {
            this.id = id;
            this.formato = formato;
            this.zonaId = zonaId;
            this.roomId = roomId;
            this.enInterfaz = enInterfaz;
            this.semilla = semilla;
            this.estado = estado;
        }

        public int bandoDe(int userId)
        {
            if(this.userIds[0] == userId) return 0;
            if(this.userIds[1] == userId) return 1;

            return -1;
        }
    }

    private static final Map<Long, Sesion> SESIONES = new ConcurrentHashMap<>();
    private static final Map<Integer, Long> POR_JUGADOR = new ConcurrentHashMap<>();

    private ServicioBatalla()
    {
    }

    /** El motor no tiene estado propio: se crea al vuelo y no hace falta guardarlo. */
    private static ServicioCombate motor()
    {
        return new ServicioCombate(ServicioPokedex.catalogo(), ServicioPokedex::mecanica);
    }

    /** null si ese jugador no esta combatiendo. */
    public static Sesion de(int userId)
    {
        Long id = POR_JUGADOR.get(userId);

        return id == null ? null : SESIONES.get(id);
    }

    public static boolean enCombate(int userId)
    {
        return de(userId) != null;
    }

    public static int totalEnCurso()
    {
        return SESIONES.size();
    }

    public static List<Sesion> enSala(int roomId)
    {
        List<Sesion> lista = new ArrayList<>();

        for(Sesion sesion : SESIONES.values())
        {
            if(sesion.roomId == roomId) lista.add(sesion);
        }

        return lista;
    }

    /**
     * Abre un combate contra el salvaje que acaba de salir.
     *
     * Devuelve null si el jugador no tiene con que pelear: sin Pokemon en pie
     * no hay combate y el encuentro se descarta sin castigo.
     */
    public static Sesion abrirSalvaje(Habbo habbo, ServicioEncuentros.Salvaje salvaje)
            throws Exception
    {
        int userId = habbo.getHabboInfo().getId();

        if(enCombate(userId)) return null;

        PokemonPoseido cabeza = primeroConPs(ServicioEntrenador.cargarPokemon(userId));

        if(cabeza == null) return null;

        EspecieCatalogo especiePropia = ServicioPokedex.especie(cabeza.especieId());

        if(especiePropia == null) return null;

        long semilla = System.nanoTime() ^ ((long) userId << 24);

        Bando bandoA = new Bando(0);
        bandoA.posiciones().add(cabeza.aCombate(especiePropia, cabeza.nivel()));

        Bando bandoB = new Bando(1);
        bandoB.posiciones().add(
                salvaje.pokemon().aCombate(salvaje.especie(), salvaje.pokemon().nivel()));

        EstadoCombate estado = new EstadoCombate(bandoA, bandoB, new RngCombate(semilla));

        // El clima de la zona entra en el combate sin escribir mecanica nueva:
        // el motor ya sabe manejarlo desde el hito 3. Turnos -1 es "no caduca".
        String climaMotor = ServicioClima.claveDeMotor(salvaje.zonaId());

        if(climaMotor != null) estado.ponerClima(climaMotor, -1);

        long id = insertar(Formato.SALVAJE, salvaje.zonaId(), salvaje.roomId(), false, semilla);

        Sesion sesion = new Sesion(id, Formato.SALVAJE, salvaje.zonaId(), salvaje.roomId(),
                false, semilla, estado);

        sesion.userIds[0] = userId;
        sesion.propios[0] = cabeza;
        sesion.salvaje = salvaje;

        insertarBandos(sesion);

        SESIONES.put(id, sesion);
        POR_JUGADOR.put(userId, id);

        return sesion;
    }

    /** El primero del equipo que no este debilitado, por orden de hueco. */
    private static PokemonPoseido primeroConPs(List<PokemonPoseido> todos)
    {
        PokemonPoseido mejor = null;

        for(PokemonPoseido p : todos)
        {
            if(!"equipo".equals(p.ubicacion()) || p.psActual() <= 0) continue;

            if(mejor == null || p.hueco() < mejor.hueco()) mejor = p;
        }

        return mejor;
    }

    private static long insertar(Formato formato, Integer zonaId, int roomId,
                                 boolean enInterfaz, long semilla) throws Exception
    {
        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            PreparedStatement p = c.prepareStatement(
                    "INSERT INTO pokemon_battles (tipo, formato, zone_id, room_id," +
                    " en_interfaz, rng_seed) VALUES (?, ?, ?, ?, ?, ?)",
                    Statement.RETURN_GENERATED_KEYS))
        {
            p.setString(1, formato == Formato.SALVAJE ? "salvaje" : "pvp");
            p.setString(2, formato.name());

            if(zonaId == null) p.setNull(3, Types.INTEGER);
            else p.setInt(3, zonaId);

            p.setInt(4, roomId);
            p.setBoolean(5, enInterfaz);
            p.setLong(6, semilla);
            p.executeUpdate();

            try(ResultSet r = p.getGeneratedKeys())
            {
                return r.next() ? r.getLong(1) : 0L;
            }
        }
    }

    private static void insertarBandos(Sesion sesion) throws Exception
    {
        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            PreparedStatement p = c.prepareStatement(
                    "INSERT INTO pokemon_battle_sides (battle_id, indice, user_id," +
                    " es_salvaje, owned_id, species_id, nivel) VALUES (?, ?, ?, ?, ?, ?, ?)"))
        {
            for(int bando = 0; bando < 2; bando++)
            {
                boolean esSalvaje = sesion.userIds[bando] == 0;
                PokemonCombate enCampo = sesion.estado.bando(bando).activo(0);

                p.setLong(1, sesion.id);
                p.setInt(2, bando);

                if(esSalvaje) p.setNull(3, Types.INTEGER);
                else p.setInt(3, sesion.userIds[bando]);

                p.setBoolean(4, esSalvaje);

                if(sesion.propios[bando] == null) p.setNull(5, Types.BIGINT);
                else p.setLong(5, sesion.propios[bando].id());

                p.setInt(6, enCampo == null ? 0 : enCampo.especieId());
                p.setInt(7, enCampo == null ? 1 : enCampo.nivelEfectivo());

                p.addBatch();
            }

            p.executeBatch();
        }
    }

    /** Lo que el cliente necesita para pintar el combate, visto por uno de los dos. */
    public static Map<String, Object> cuerpo(Sesion sesion, int userId)
    {
        int miBando = Math.max(0, sesion.bandoDe(userId));

        Map<String, Object> cuerpo = new LinkedHashMap<>();

        cuerpo.put("batallaId", sesion.id);
        cuerpo.put("formato", sesion.formato.name());
        cuerpo.put("enInterfaz", sesion.enInterfaz);
        cuerpo.put("turno", sesion.estado.turno());
        cuerpo.put("terminado", sesion.estado.terminado());
        cuerpo.put("clima", sesion.estado.clima());
        cuerpo.put("puedeHuir", sesion.formato.huidaPermitida());
        cuerpo.put("puedeCapturar", sesion.formato.capturaPermitida());
        cuerpo.put("mio", ficha(sesion.estado.bando(miBando).activo(0), true));
        cuerpo.put("rival", ficha(sesion.estado.bando(1 - miBando).activo(0), false));

        return cuerpo;
    }

    /**
     * Del rival no se mandan los PS exactos: en los juegos solo se ve la barra.
     * Mandar el numero seria darle al cliente informacion que el jugador no
     * tiene, y que un cliente modificado usaria sin despeinarse.
     */
    private static Map<String, Object> ficha(PokemonCombate pokemon, boolean propio)
    {
        Map<String, Object> ficha = new LinkedHashMap<>();

        if(pokemon == null) return ficha;

        ficha.put("especieId", pokemon.especieId());
        ficha.put("nombre", pokemon.nombre());
        ficha.put("nivel", pokemon.nivelEfectivo());
        ficha.put("estado", pokemon.estado());
        ficha.put("psMax", pokemon.psMax());

        if(!propio)
        {
            ficha.put("psPorcentaje", pokemon.psMax() <= 0
                    ? 0
                    : Math.max(0, pokemon.psActual() * 100 / pokemon.psMax()));

            return ficha;
        }

        ficha.put("psActual", pokemon.psActual());

        List<Map<String, Object>> movimientos = new ArrayList<>();

        for(int i = 0; i < pokemon.movimientos().size(); i++)
        {
            MovimientoEnCombate slot = pokemon.movimientos().get(i);
            MovimientoCatalogo cat = ServicioPokedex.movimiento(slot.moveId());

            Map<String, Object> movimiento = new LinkedHashMap<>();

            movimiento.put("indice", i);
            movimiento.put("moveId", slot.moveId());
            movimiento.put("nombre", cat == null ? String.valueOf(slot.moveId()) : cat.nombreEs());
            movimiento.put("pp", slot.ppActual());
            movimiento.put("ppMax", slot.ppMaximo());

            movimientos.add(movimiento);
        }

        ficha.put("movimientos", movimientos);

        return ficha;
    }

    /** Empuja el mismo cuerpo a los dos jugadores de la sesion. */
    public static void empujar(Sesion sesion, int accion, Object datos)
    {
        for(int bando = 0; bando < 2; bando++)
        {
            Habbo habbo = conectado(sesion.userIds[bando]);

            if(habbo == null) continue;

            habbo.getClient().sendResponse(
                    PokemonPackets.resultado(accion, true, PokemonCuerpo.datos(datos)));
        }
    }

    /** El estado es distinto para cada uno, asi que se empuja uno a uno. */
    public static void empujarEstado(Sesion sesion)
    {
        for(int bando = 0; bando < 2; bando++)
        {
            int userId = sesion.userIds[bando];
            Habbo habbo = conectado(userId);

            if(habbo == null) continue;

            habbo.getClient().sendResponse(PokemonPackets.resultado(
                    PokemonAcciones.BATALLA_ESTADO, true,
                    PokemonCuerpo.datos(cuerpo(sesion, userId))));
        }
    }

    static Habbo conectado(int userId)
    {
        if(userId == 0) return null;

        Habbo habbo = Emulator.getGameEnvironment().getHabboManager().getHabbo(userId);

        return habbo != null && habbo.getClient() != null ? habbo : null;
    }

    static void olvidar(Sesion sesion)
    {
        SESIONES.remove(sesion.id);

        for(int userId : sesion.userIds)
        {
            if(userId != 0) POR_JUGADOR.remove(userId);
        }
    }

    static List<Evento> resolverConMotor(Sesion sesion, List<Accion> acciones)
    {
        return motor().resolverTurno(sesion.estado, acciones);
    }
}
```

> **Dos cosas que hay que confirmar en el código existente antes de compilar:**
> 1. `ServicioClima` debe exponer la clave de motor del clima actual de una zona. Si no existe, añadir `public static String claveDeMotor(int zonaId)`, que busque el `Clima` vigente y devuelva su clave de motor, o `null` si es `DESPEJADO`. Mirar cómo `Clima` nombra ese accesor.
> 2. `PokemonPoseido` debe exponer `ubicacion()`, `slot()`, `id()`, `nivel()` y `psActual()`. Donde el nombre real sea otro, usar el real.

- [ ] **Paso 4: Compilar**

```bash
"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -o -f Desarrollo/PokemonEngine/pom.xml test
```

Esperado: BUILD SUCCESS, 342 pruebas. `ServicioBatalla` toca el emulador y no se prueba con JUnit: se verifica a mano en la tarea 15.

- [ ] **Paso 5: Commit**

```bash
git add Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/ServicioBatalla.java Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/ServicioPokedex.java Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/PokemonAcciones.java
git commit -F - <<'GITEOF'
feat(pokemon): open a real battle when a wild Pokemon appears

The live turn stays in memory because a turn is milliseconds and paying
a query per animation would be absurd. The rival's exact HP never
leaves the server: the client gets a percentage, the way the games only
ever show a bar.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
GITEOF
```

---

### Task 9: El turno — recoger acciones, resolver y contarlo

**Ficheros:**
- Modificar: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/ServicioBatalla.java`
- Crear: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/AccionesBatalla.java`
- Modificar: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/handlers/PokemonCommandHandler.java`

**Interfaces:**
- Consume: `ServicioBatalla.de(int)`, `resolverConMotor(Sesion, List<Accion>)`, `MenteSalvaje.elegir(...)`, `Respuesta.bien(Object)` / `Respuesta.mal(String, String)`.
- Produce: `ServicioBatalla.elegir(int userId, Accion accion)` → `boolean` (si el turno se resolvió), `ServicioBatalla.resolverTurno(Sesion)`, `ServicioBatalla.turnoDelRival(Sesion, int bandoDelJugador)`; `AccionesBatalla.esAccionDeBatalla(int)` y `AccionesBatalla.ejecutar(Habbo, int userId, int accion, JsonObject datos)`.

- [ ] **Paso 1: Añadir la recogida y la resolución a `ServicioBatalla`**

```java
    /**
     * Guarda la accion de un jugador. Cuando estan las dos, el turno se resuelve.
     *
     * En salvaje la segunda la pone la casa en el mismo momento: no tiene
     * sentido hacer esperar al jugador por una decision que es una tirada.
     *
     * @return true si el turno se ha resuelto con esta llamada.
     */
    public static boolean elegir(int userId, Accion accion)
    {
        Sesion sesion = de(userId);

        if(sesion == null || sesion.estado.terminado()) return false;

        int bando = sesion.bandoDe(userId);

        if(bando < 0) return false;

        sesion.elegidas[bando] = accion;

        if(sesion.formato == Formato.SALVAJE)
        {
            sesion.elegidas[1] = com.retro.pokemonengine.batalla.MenteSalvaje.elegir(
                    sesion.estado.bando(1).activo(0), 1, 0, sesion.estado.rng());
        }

        if(sesion.elegidas[0] == null || sesion.elegidas[1] == null) return false;

        resolverTurno(sesion);

        return true;
    }

    /** El turno en el que el jugador hizo otra cosa — huir, tirar una ball: solo actua el rival. */
    public static void turnoDelRival(Sesion sesion, int bandoDelJugador)
    {
        int rival = 1 - bandoDelJugador;

        sesion.elegidas[bandoDelJugador] = null;
        sesion.elegidas[rival] = com.retro.pokemonengine.batalla.MenteSalvaje.elegir(
                sesion.estado.bando(rival).activo(0), rival, 0, sesion.estado.rng());

        resolverTurno(sesion);
    }

    public static void resolverTurno(Sesion sesion)
    {
        List<Accion> acciones = new ArrayList<>();

        for(Accion accion : sesion.elegidas)
        {
            if(accion != null) acciones.add(accion);
        }

        sesion.elegidas[0] = null;
        sesion.elegidas[1] = null;

        List<Evento> eventos = resolverConMotor(sesion, acciones);

        sesion.turnoDesdeMs = System.currentTimeMillis();

        try
        {
            guardarLog(sesion, eventos);
            guardarSnapshot(sesion);
        }
        catch(Exception error)
        {
            System.out.println("[PokemonEngine] No se pudo guardar el turno "
                    + sesion.estado.turno() + " del combate " + sesion.id + ": "
                    + error.getMessage());
        }

        empujarEventos(sesion, eventos);
        empujarEstado(sesion);

        if(sesion.estado.terminado())
        {
            ServicioRecompensas.cerrar(sesion, sesion.estado.ganador(), MOTIVO_KO);
        }
    }

    private static void empujarEventos(Sesion sesion, List<Evento> eventos)
    {
        List<Map<String, Object>> lista = new ArrayList<>();

        for(Evento evento : eventos)
        {
            Map<String, Object> uno = new LinkedHashMap<>();

            uno.put("tipo", evento.tipo());
            uno.put("datos", evento.datos());

            lista.add(uno);
        }

        Map<String, Object> cuerpo = new LinkedHashMap<>();

        cuerpo.put("batallaId", sesion.id);
        cuerpo.put("turno", sesion.estado.turno());
        cuerpo.put("eventos", lista);

        empujar(sesion, PokemonAcciones.BATALLA_EVENTOS, cuerpo);
    }

    /**
     * Una fila por evento. Ocupa mas que un JSON por turno y a cambio se puede
     * contar, filtrar y auditar sin desempaquetar nada.
     */
    private static void guardarLog(Sesion sesion, List<Evento> eventos) throws Exception
    {
        if(eventos.isEmpty()) return;

        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            PreparedStatement p = c.prepareStatement(
                    "INSERT INTO pokemon_battle_log (battle_id, turno, orden, tipo, datos)" +
                    " VALUES (?, ?, ?, ?, ?)"))
        {
            for(Evento evento : eventos)
            {
                p.setLong(1, sesion.id);
                p.setInt(2, sesion.estado.turno());
                p.setInt(3, sesion.ordenLog++);
                p.setString(4, evento.tipo());
                p.setString(5, PokemonCuerpo.datos(evento.datos()));
                p.addBatch();
            }

            p.executeBatch();
        }
    }

    /**
     * El snapshot es lo unico que sobrevive a un reinicio del emulador. No
     * reconstruye el combate entero: guarda lo justo para que una reconexion
     * devuelva al jugador a algo coherente.
     */
    private static void guardarSnapshot(Sesion sesion) throws Exception
    {
        Map<String, Object> foto = new LinkedHashMap<>();

        foto.put("turno", sesion.estado.turno());
        foto.put("clima", sesion.estado.clima());
        foto.put("intentosHuida", sesion.intentosHuida);

        List<Map<String, Object>> bandos = new ArrayList<>();

        for(int i = 0; i < 2; i++)
        {
            PokemonCombate activo = sesion.estado.bando(i).activo(0);

            Map<String, Object> bando = new LinkedHashMap<>();

            bando.put("userId", sesion.userIds[i]);
            bando.put("especieId", activo == null ? 0 : activo.especieId());
            bando.put("nivel", activo == null ? 1 : activo.nivelEfectivo());
            bando.put("psActual", activo == null ? 0 : activo.psActual());
            bando.put("psMax", activo == null ? 0 : activo.psMax());
            bando.put("estado", activo == null ? PokemonCombate.SIN_ESTADO : activo.estado());

            bandos.add(bando);
        }

        foto.put("bandos", bandos);

        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            PreparedStatement p = c.prepareStatement(
                    "UPDATE pokemon_battles SET turno = ?, state_snapshot = ? WHERE id = ?"))
        {
            p.setInt(1, sesion.estado.turno());
            p.setString(2, PokemonCuerpo.datos(foto));
            p.setLong(3, sesion.id);
            p.executeUpdate();
        }
    }
```

- [ ] **Paso 2: Escribir `AccionesBatalla`**

```java
package com.retro.pokemonengine;

import com.eu.habbo.habbohotel.users.Habbo;
import com.google.gson.JsonObject;
import com.retro.pokemonengine.combate.Accion;
import com.retro.pokemonengine.combate.PokemonCombate;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Las acciones de combate del paquete 6400.
 *
 * Aqui no se decide ninguna regla: se comprueba que lo que manda el cliente
 * tiene sentido y se traduce a una `Accion` del motor. Un cliente modificado
 * puede mandar el indice 99 o elegir dos veces en el mismo turno; que eso no
 * rompa nada es el trabajo de esta clase.
 */
public final class AccionesBatalla
{
    private AccionesBatalla()
    {
    }

    public static boolean esAccionDeBatalla(int accion)
    {
        return accion == PokemonAcciones.BATALLA_ESTADO
                || accion == PokemonAcciones.BATALLA_ACCION
                || accion == PokemonAcciones.BATALLA_RENDIRSE;
    }

    public static Respuesta ejecutar(Habbo habbo, int userId, int accion, JsonObject datos)
            throws Exception
    {
        return switch(accion)
        {
            case PokemonAcciones.BATALLA_ESTADO -> estado(userId);
            case PokemonAcciones.BATALLA_ACCION -> actuar(userId, datos);
            case PokemonAcciones.BATALLA_RENDIRSE -> rendirse(userId);
            default -> Respuesta.mal("ACCION_DESCONOCIDA", "Accion no reconocida");
        };
    }

    private static Respuesta estado(int userId)
    {
        ServicioBatalla.Sesion sesion = ServicioBatalla.de(userId);

        if(sesion == null) return Respuesta.mal(ServicioBatalla.SIN_BATALLA, "No estas en combate");

        return Respuesta.bien(ServicioBatalla.cuerpo(sesion, userId));
    }

    private static Respuesta actuar(int userId, JsonObject datos) throws Exception
    {
        ServicioBatalla.Sesion sesion = ServicioBatalla.de(userId);

        if(sesion == null) return Respuesta.mal(ServicioBatalla.SIN_BATALLA, "No estas en combate");

        if(sesion.estado.terminado())
        {
            return Respuesta.mal(ServicioBatalla.SIN_BATALLA, "El combate ya termino");
        }

        int bando = sesion.bandoDe(userId);

        if(bando < 0) return Respuesta.mal(ServicioBatalla.SIN_BATALLA, "No estas en combate");

        if(sesion.elegidas[bando] != null)
        {
            return Respuesta.mal(ServicioBatalla.NO_ES_TU_TURNO, "Ya has elegido este turno");
        }

        String tipo = texto(datos, "tipo", "movimiento");

        switch(tipo)
        {
            case "movimiento":
            {
                int indice = entero(datos, "indice", -1);
                PokemonCombate mio = sesion.estado.bando(bando).activo(0);

                if(mio == null || indice < 0 || indice >= mio.movimientos().size())
                {
                    return Respuesta.mal("MOVIMIENTO_INVALIDO", "Ese movimiento no existe");
                }

                ServicioBatalla.elegir(userId, Accion.movimiento(bando, 0, indice, 1 - bando, 0));

                break;
            }

            case "huida":
                return ServicioBatalla.huir(userId);

            case "captura":
                return ServicioCaptura.enCombate(userId, entero(datos, "ballId", 0));

            case "objeto":
                ServicioBatalla.elegir(userId, Accion.objeto(bando, 0, entero(datos, "itemId", 0)));
                break;

            default:
                return Respuesta.mal("ACCION_INVALIDA", "No se que es " + tipo);
        }

        ServicioBatalla.Sesion despues = ServicioBatalla.de(userId);

        // Si el combate acabo en este mismo turno, la sesion ya no esta.
        if(despues == null)
        {
            Map<String, Object> fin = new LinkedHashMap<>();

            fin.put("terminado", true);

            return Respuesta.bien(fin);
        }

        return Respuesta.bien(ServicioBatalla.cuerpo(despues, userId));
    }

    private static Respuesta rendirse(int userId)
    {
        ServicioBatalla.Sesion sesion = ServicioBatalla.de(userId);

        if(sesion == null) return Respuesta.mal(ServicioBatalla.SIN_BATALLA, "No estas en combate");

        int bando = sesion.bandoDe(userId);

        if(sesion.salvaje != null) ServicioEncuentros.limpiar(userId);

        ServicioRecompensas.cerrar(sesion, bando < 0 ? -1 : 1 - bando,
                ServicioBatalla.MOTIVO_ABANDONO);

        Map<String, Object> fin = new LinkedHashMap<>();

        fin.put("terminado", true);

        return Respuesta.bien(fin);
    }

    private static int entero(JsonObject datos, String clave, int porDefecto)
    {
        return datos != null && datos.has(clave) && datos.get(clave).isJsonPrimitive()
                ? datos.get(clave).getAsInt()
                : porDefecto;
    }

    private static String texto(JsonObject datos, String clave, String porDefecto)
    {
        return datos != null && datos.has(clave) && datos.get(clave).isJsonPrimitive()
                ? datos.get(clave).getAsString()
                : porDefecto;
    }
}
```

- [ ] **Paso 3: Enchufarlo al handler**

En `PokemonCommandHandler.java`, donde ya se pregunta `AccionesMundo.esAccionDeMundo(accion)`, poner la batalla **antes**, porque el 62 (`ENCUENTRO_HUIR`) va a delegar en ella:

```java
        if(AccionesBatalla.esAccionDeBatalla(accion))
        {
            respuesta = AccionesBatalla.ejecutar(habbo, userId, accion, datos);
        }
        else if(AccionesMundo.esAccionDeMundo(accion))
```

> Abrir el fichero y copiar el estilo real del `if` existente; lo único que importa es el orden.

- [ ] **Paso 4: No compilar todavía**

Faltan `ServicioBatalla.huir`, `ServicioCaptura.enCombate` y `ServicioRecompensas`, que son las dos tareas siguientes. Es el orden a propósito: no mezclar en un commit la recogida del turno con las reglas de huida. Continuar a la tarea 10.

---

### Task 10: Huida y captura, como acciones de combate

**Ficheros:**
- Modificar: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/ServicioBatalla.java`
- Modificar: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/ServicioCaptura.java`
- Modificar: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/AccionesMundo.java`

**Interfaces:**
- Consume: `ReglasHuida.intentar(int, int, int, RngCombate)`, `Formato.huidaPermitida()` / `capturaPermitida()`, `PokemonCombate` y su lectura de Velocidad efectiva.
- Produce: `ServicioBatalla.huir(int userId)` → `Respuesta`; `ServicioCaptura.enCombate(int userId, int ballId)` → `Respuesta`.

> **Antes de escribir:** mirar en `PokemonCombate.java` cómo se lee la Velocidad con las etapas aplicadas. Si el método es `statEfectivo(Stat)`, usarlo; si es `stat(Stat)` más `etapa(ETAPA_VELOCIDAD)`, usar lo que haya y dejarlo escrito igual en los dos sitios.

- [ ] **Paso 1: La huida en `ServicioBatalla`**

```java
    /**
     * Huir.
     *
     * De un entrenador no se huye, y eso se comprueba antes de gastar la
     * tirada. Un intento fallido **cuesta el turno**: el rival ataca igual. Si
     * fallar fuera gratis, huir seria siempre la primera opcion y el encuentro
     * dejaria de ser un riesgo.
     */
    public static Respuesta huir(int userId)
    {
        Sesion sesion = de(userId);

        if(sesion == null) return Respuesta.mal(SIN_BATALLA, "No estas en combate");

        if(!sesion.formato.huidaPermitida())
        {
            return Respuesta.mal("NO_SE_HUYE", "De un entrenador no se puede huir");
        }

        int bando = sesion.bandoDe(userId);

        if(bando < 0) return Respuesta.mal(SIN_BATALLA, "No estas en combate");

        PokemonCombate mio = sesion.estado.bando(bando).activo(0);
        PokemonCombate rival = sesion.estado.bando(1 - bando).activo(0);

        if(mio == null || rival == null)
        {
            return Respuesta.mal(SIN_BATALLA, "No hay nadie en el campo");
        }

        sesion.intentosHuida++;

        boolean sale = com.retro.pokemonengine.batalla.ReglasHuida.intentar(
                mio.statEfectivo(Stat.VELOCIDAD),
                rival.statEfectivo(Stat.VELOCIDAD),
                sesion.intentosHuida,
                sesion.estado.rng());

        Map<String, Object> cuerpo = new LinkedHashMap<>();

        cuerpo.put("huido", sale);
        cuerpo.put("intentos", sesion.intentosHuida);

        if(sale)
        {
            ServicioEncuentros.limpiar(userId);
            ServicioRecompensas.cerrar(sesion, -1, MOTIVO_HUIDA);

            return Respuesta.bien(cuerpo);
        }

        turnoDelRival(sesion, bando);

        Sesion despues = de(userId);

        if(despues != null) cuerpo.put("estado", cuerpo(despues, userId));

        return Respuesta.bien(cuerpo);
    }
```

Añadir el import `com.retro.pokemonengine.combate.Stat`.

- [ ] **Paso 2: La captura, dentro del combate**

`ServicioCaptura.intentar` ya hace lo correcto contra un `ServicioEncuentros.Salvaje`. Lo que cambia es de dónde salen los PS y el estado alterado: ahora los manda el campo, no el encuentro. Añadir a `ServicioCaptura.java`:

```java
    /**
     * Capturar desde dentro del combate.
     *
     * Los PS y el estado alterado se leen del campo y no del encuentro: el
     * salvaje del hito 5 estaba quieto y entero, y este lleva media barra y
     * puede estar dormido — que es justo lo que hace que la ball entre.
     *
     * Fallar cuesta el turno, igual que la huida.
     */
    public static Respuesta enCombate(int userId, int ballId) throws Exception
    {
        ServicioBatalla.Sesion sesion = ServicioBatalla.de(userId);

        if(sesion == null) return Respuesta.mal(SIN_ENCUENTRO, "No estas en combate");

        if(!sesion.formato.capturaPermitida())
        {
            return Respuesta.mal("NO_SE_CAPTURA", "A ese no se le puede lanzar una ball");
        }

        ServicioEncuentros.Salvaje salvaje = sesion.salvaje;

        if(salvaje == null) return Respuesta.mal(SIN_ENCUENTRO, "No hay ningun salvaje delante");

        com.retro.pokemonengine.combate.PokemonCombate enCampo = sesion.estado.bando(1).activo(0);

        if(enCampo != null)
        {
            // El encuentro sabe guardar el Pokemon; el combate sabe como esta.
            // Se sincronizan justo antes de tirar la ball.
            salvaje.pokemon().ponerPsActual(enCampo.psActual());
            salvaje.ponerEstado(enCampo.estado());
        }

        Resultado resultado = intentar(userId, ballId);

        if(!resultado.ok()) return Respuesta.mal(resultado.codigo(), "No se pudo lanzar la ball");

        if(resultado.capturado())
        {
            ServicioRecompensas.cerrar(sesion, 0, ServicioBatalla.MOTIVO_CAPTURA);

            return Respuesta.bien(resultado);
        }

        ServicioBatalla.turnoDelRival(sesion, 0);

        ServicioBatalla.Sesion despues = ServicioBatalla.de(userId);

        java.util.Map<String, Object> cuerpo = new java.util.LinkedHashMap<>();

        cuerpo.put("captura", resultado);

        if(despues != null) cuerpo.put("estado", ServicioBatalla.cuerpo(despues, userId));

        return Respuesta.bien(cuerpo);
    }
```

- [ ] **Paso 3: Que el 61 y el 62 sigan funcionando**

En `AccionesMundo.java`, redirigir las dos acciones antiguas al combate, para que un cliente cacheado no se quede sin poder hacer nada:

```java
            case PokemonAcciones.CAPTURA_INTENTAR ->
                    ServicioCaptura.enCombate(userId, entero(datos, "ballId", 0));
            case PokemonAcciones.ENCUENTRO_HUIR -> ServicioBatalla.huir(userId);
```

Borrar los métodos privados `capturar` y `huir` de `AccionesMundo` si quedan sin uso.

- [ ] **Paso 4: No compilar todavía**

Falta `ServicioRecompensas`, que es la tarea 11. Continuar.

---

### Task 11: El cierre — lo que deja el combate

**Ficheros:**
- Crear: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/ServicioRecompensas.java`
- Crear: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/ServicioArena.java` (solo el esqueleto; la tarea 12 lo llena)

**Interfaces:**
- Consume: `Recompensas.experiencia(...)`, `Recompensas.sumar(...)`, `Progreso.aplicar(...)`, `ReglasEvolucion.evolucionar(...)`, `ServicioGeneracion.instancia()`, `ServicioPokedex.especie(int)`, `ServicioEntrenador.guardarPokemon(PokemonPoseido)` y `ServicioEntrenador.registrarVisto(int, int)`.
- Produce: `ServicioRecompensas.cerrar(ServicioBatalla.Sesion, int ganadorBando, String motivo)` y `ServicioRecompensas.anular(ServicioBatalla.Sesion, String motivo)`; `ServicioArena.soltar(ServicioBatalla.Sesion)`.

- [ ] **Paso 1: El esqueleto de `ServicioArena`**

```java
package com.retro.pokemonengine;

/**
 * Colocar a los combatientes en la sala y devolverlos a su sitio al acabar.
 *
 * De momento solo el gancho de soltar, para que el cierre del combate ya llame
 * al sitio correcto. La colocacion y el bloqueo llegan en la tarea 12.
 */
public final class ServicioArena
{
    private ServicioArena()
    {
    }

    /** Devuelve a su sitio a todo el que estuviera bloqueado por esta sesion. */
    public static void soltar(ServicioBatalla.Sesion sesion)
    {
    }
}
```

- [ ] **Paso 2: Escribir `ServicioRecompensas`**

```java
package com.retro.pokemonengine;

import com.eu.habbo.Emulator;
import com.retro.pokemonengine.batalla.Formato;
import com.retro.pokemonengine.batalla.Progreso;
import com.retro.pokemonengine.batalla.Recompensas;
import com.retro.pokemonengine.combate.EspecieCatalogo;
import com.retro.pokemonengine.combate.PokemonCombate;
import com.retro.pokemonengine.combate.Stat;
import com.retro.pokemonengine.entrenador.EspecieGeneracion;
import com.retro.pokemonengine.entrenador.PokemonPoseido;
import com.retro.pokemonengine.entrenador.ReglasEvolucion;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Types;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Cerrar un combate y repartir lo que haya dejado.
 *
 * Tres finales distintos y solo uno da premio:
 *
 * - **Ganado**: experiencia, EV, nivel, movimientos nuevos y evolucion.
 * - **Huida o captura**: no hay premio, pero el desgaste si se guarda — PS, PP
 *   y alteraciones. El combate ha pasado de verdad.
 * - **Anulado**: ni premio ni castigo, y tampoco se guarda el desgaste. Es lo
 *   acordado para cuando a alguien le echan de la sala a mitad: si anular
 *   costara algo, echar a alguien seria un arma.
 */
public final class ServicioRecompensas
{
    private ServicioRecompensas()
    {
    }

    public static void cerrar(ServicioBatalla.Sesion sesion, int ganadorBando, String motivo)
    {
        if(sesion == null) return;

        try
        {
            if(!ServicioBatalla.MOTIVO_ANULADA.equals(motivo)) guardarDesgaste(sesion);

            if(ganadorBando >= 0 && sesion.formato.daRecompensa()
                    && sesion.userIds[ganadorBando] != 0)
            {
                repartir(sesion, ganadorBando);
            }

            marcar(sesion, ganadorBando, motivo);
        }
        catch(Exception error)
        {
            System.out.println("[PokemonEngine] No se pudo cerrar el combate "
                    + sesion.id + ": " + error.getMessage());
        }
        finally
        {
            ServicioArena.soltar(sesion);
            ServicioBatalla.olvidar(sesion);
        }
    }

    /** Anular: el combate no ha ocurrido para nadie. */
    public static void anular(ServicioBatalla.Sesion sesion, String motivo)
    {
        if(sesion == null) return;

        Map<String, Object> aviso = new LinkedHashMap<>();

        aviso.put("batallaId", sesion.id);
        aviso.put("turno", sesion.estado.turno());
        aviso.put("eventos", List.of(Map.of(
                "tipo", "combate_anulado", "datos", Map.of("motivo", motivo))));

        ServicioBatalla.empujar(sesion, PokemonAcciones.BATALLA_EVENTOS, aviso);

        if(sesion.salvaje != null)
        {
            for(int userId : sesion.userIds)
            {
                if(userId != 0) ServicioEncuentros.limpiar(userId);
            }
        }

        cerrar(sesion, -1, ServicioBatalla.MOTIVO_ANULADA);
    }

    /** Los PS, los PP y el estado con los que sale cada Pokemon del combate. */
    private static void guardarDesgaste(ServicioBatalla.Sesion sesion) throws Exception
    {
        for(int bando = 0; bando < 2; bando++)
        {
            PokemonPoseido poseido = sesion.propios[bando];
            PokemonCombate enCampo = sesion.estado.bando(bando).activo(0);

            if(poseido == null || enCampo == null) continue;

            poseido.ponerPsActual(Math.max(0, enCampo.psActual()));
            poseido.ponerEstado(enCampo.estado(), enCampo.contadorEstado());

            for(int i = 0; i < poseido.movimientos().size()
                    && i < enCampo.movimientos().size(); i++)
            {
                poseido.movimientos().get(i)
                        .ponerPpActual(enCampo.movimientos().get(i).ppActual());
            }

            ServicioEntrenador.guardarPokemon(poseido);
        }
    }

    private static void repartir(ServicioBatalla.Sesion sesion, int ganadorBando) throws Exception
    {
        PokemonPoseido ganador = sesion.propios[ganadorBando];
        PokemonCombate derrotado = sesion.estado.bando(1 - ganadorBando).activo(0);

        if(ganador == null || derrotado == null) return;

        EspecieCatalogo especieDerrotado = ServicioPokedex.especie(derrotado.especieId());
        EspecieGeneracion especieGanador = ServicioGeneracion.instancia()
                .especie(ganador.especieId());

        if(especieDerrotado == null || especieGanador == null) return;

        long ganada = Recompensas.experiencia(
                especieDerrotado.baseExperience(),
                derrotado.nivelEfectivo(),
                1,
                sesion.formato != Formato.SALVAJE);

        Progreso.Resultado progreso = Progreso.aplicar(
                especieGanador.curva(),
                ganador.especieId(),
                ganador.nivel(),
                ganador.experiencia(),
                ganada,
                ServicioGeneracion.instancia(),
                evolucionesDe(ganador.especieId()));

        ganador.ponerExperiencia(progreso.experienciaFinal());
        ganador.ponerNivel(progreso.nivelDespues());

        aplicarEv(ganador, derrotado.especieId());

        List<Map<String, Object>> avisos = new ArrayList<>();

        avisos.add(Map.of("tipo", "experiencia",
                "datos", Map.of("cantidad", ganada, "nivel", progreso.nivelDespues())));

        if(progreso.subio())
        {
            avisos.add(Map.of("tipo", "sube_nivel",
                    "datos", Map.of("nivel", progreso.nivelDespues())));
        }

        for(int moveId : progreso.movimientosAprendidos())
        {
            avisos.add(Map.of("tipo", "aprende", "datos", Map.of("moveId", moveId)));
        }

        if(progreso.evolucionA() != null)
        {
            EspecieGeneracion nueva = ServicioGeneracion.instancia().especie(progreso.evolucionA());

            if(nueva != null)
            {
                ReglasEvolucion.evolucionar(
                        ganador, especieGanador.base(), nueva, variantesDe(nueva.id()));

                avisos.add(Map.of("tipo", "evoluciona",
                        "datos", Map.of("especieId", nueva.id())));

                ServicioEntrenador.registrarVisto(sesion.userIds[ganadorBando], nueva.id());
            }
        }

        ServicioEntrenador.guardarPokemon(ganador);

        Map<String, Object> cuerpo = new LinkedHashMap<>();

        cuerpo.put("batallaId", sesion.id);
        cuerpo.put("turno", sesion.estado.turno());
        cuerpo.put("eventos", avisos);

        ServicioBatalla.empujar(sesion, PokemonAcciones.BATALLA_EVENTOS, cuerpo);
    }

    private static void aplicarEv(PokemonPoseido ganador, int especieDerrotadoId) throws Exception
    {
        Recompensas.Ev antes = new Recompensas.Ev(
                ganador.ev(Stat.PS), ganador.ev(Stat.ATAQUE), ganador.ev(Stat.DEFENSA),
                ganador.ev(Stat.ATAQUE_ESP), ganador.ev(Stat.DEFENSA_ESP),
                ganador.ev(Stat.VELOCIDAD));

        Recompensas.Ev despues = Recompensas.sumar(
                antes, repartoDe(especieDerrotadoId), ganador.pokerus());

        ganador.ponerEv(Stat.PS, despues.ps());
        ganador.ponerEv(Stat.ATAQUE, despues.ataque());
        ganador.ponerEv(Stat.DEFENSA, despues.defensa());
        ganador.ponerEv(Stat.ATAQUE_ESP, despues.ataqueEsp());
        ganador.ponerEv(Stat.DEFENSA_ESP, despues.defensaEsp());
        ganador.ponerEv(Stat.VELOCIDAD, despues.velocidad());
    }

    private static List<Progreso.Evolucion> evolucionesDe(int especieId) throws Exception
    {
        List<Progreso.Evolucion> lista = new ArrayList<>();

        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            PreparedStatement p = c.prepareStatement(
                    "SELECT destino_id, nivel_minimo FROM pokemon_species_evolution" +
                    " WHERE origen_id = ? AND metodo = 'level-up'"))
        {
            p.setInt(1, especieId);

            try(ResultSet r = p.executeQuery())
            {
                while(r.next())
                {
                    int nivel = r.getObject("nivel_minimo") == null ? 0 : r.getInt("nivel_minimo");

                    lista.add(new Progreso.Evolucion(r.getInt("destino_id"), nivel));
                }
            }
        }

        return lista;
    }

    private static Recompensas.Ev repartoDe(int especieId) throws Exception
    {
        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            PreparedStatement p = c.prepareStatement(
                    "SELECT yield_hp, yield_attack, yield_defense, yield_sp_attack," +
                    " yield_sp_defense, yield_speed FROM pokemon_species WHERE id = ?"))
        {
            p.setInt(1, especieId);

            try(ResultSet r = p.executeQuery())
            {
                if(!r.next()) return new Recompensas.Ev(0, 0, 0, 0, 0, 0);

                return new Recompensas.Ev(
                        r.getInt("yield_hp"), r.getInt("yield_attack"),
                        r.getInt("yield_defense"), r.getInt("yield_sp_attack"),
                        r.getInt("yield_sp_defense"), r.getInt("yield_speed"));
            }
        }
    }

    /**
     * Las variantes que la especie tiene dibujadas. Mientras no haya sprites
     * alternativos importados el conjunto es vacio, y cualquier disfraz se
     * pierde al evolucionar — que es la respuesta correcta por defecto.
     */
    private static Set<String> variantesDe(int especieId)
    {
        return new HashSet<>();
    }

    private static void marcar(ServicioBatalla.Sesion sesion, int ganadorBando, String motivo)
            throws Exception
    {
        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            PreparedStatement p = c.prepareStatement(
                    "UPDATE pokemon_battles SET estado = ?, ganador_user_id = ?," +
                    " motivo_fin = ?, terminada_en = CURRENT_TIMESTAMP WHERE id = ?"))
        {
            p.setString(1, ServicioBatalla.MOTIVO_ANULADA.equals(motivo) ? "anulada" : "terminada");

            if(ganadorBando < 0 || sesion.userIds[ganadorBando] == 0)
            {
                p.setNull(2, Types.INTEGER);
            }
            else
            {
                p.setInt(2, sesion.userIds[ganadorBando]);
            }

            p.setString(3, motivo);
            p.setLong(4, sesion.id);
            p.executeUpdate();
        }
    }
}
```

> **Nombres que hay que confirmar antes de compilar**, en `PokemonPoseido` y `ServicioEntrenador`: `ponerPsActual`, `ponerEstado(String, int)`, `ponerExperiencia(long)`, `ponerNivel(int)`, `experiencia()`, `ev(Stat)`, `ponerEv(Stat, int)`, `pokerus()`, `movimientos().get(i).ponerPpActual(int)` y `ServicioEntrenador.guardarPokemon(PokemonPoseido)`. Donde el nombre real sea otro, usar el real; donde el mutador no exista, añadirlo siguiendo el estilo del fichero.

- [ ] **Paso 3: Compilar las tres tareas juntas**

```bash
"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -o -f Desarrollo/PokemonEngine/pom.xml test
```

Esperado: BUILD SUCCESS, 342 pruebas.

- [ ] **Paso 4: Commit de las tareas 9, 10 y 11**

```bash
git add Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/
git commit -F - <<'GITEOF'
feat(pokemon): make the encounter an actual battle

Turns, moves, fleeing and capture, plus what the battle leaves behind:
experience, EVs, levels, new moves and evolution. Fleeing and throwing
a ball both cost the turn — free, they would always be the first
choice. A voided battle leaves nothing at all, not even the wear,
because if voiding cost something, kicking someone would be a weapon.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
GITEOF
```

---

### Task 12: `ServicioArena` — colocar, bloquear y soltar

**Ficheros:**
- Modificar: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/ServicioArena.java`
- Modificar: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/ServicioBatalla.java`
- Modificar: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/DisparadorEncuentros.java`

**Interfaces:**
- Consume: `PlanArena.resolver(int, int, Formato, Transitable)`, `PlanArena.Formacion`, `PlanArena.Hueco`; `Room.getLayout().getTile(short, short)`, `RoomTile.isWalkable()`, `Room.getHabbosAndBotsAt(short, short)`, `RoomUnit.setGoalLocation/setLocation/setRotation/setBodyRotation/setHeadRotation/setCanWalk/stopWalking/getCurrentLocation`, `RoomUserRotation.fromValue(int)`.
- Produce: `ServicioArena.colocar(ServicioBatalla.Sesion, Habbo)` → `boolean` (false = no cabía, el combate va en interfaz); `ServicioArena.soltar(ServicioBatalla.Sesion)`; `ServicioArena.reservada(int roomId, int x, int y)` → `boolean`.

- [ ] **Paso 1: Escribir `ServicioArena` entero**

```java
package com.retro.pokemonengine;

import com.eu.habbo.habbohotel.rooms.Room;
import com.eu.habbo.habbohotel.rooms.RoomTile;
import com.eu.habbo.habbohotel.rooms.RoomUnit;
import com.eu.habbo.habbohotel.rooms.RoomUserRotation;
import com.eu.habbo.habbohotel.users.Habbo;
import com.retro.pokemonengine.batalla.PlanArena;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Colocar a los combatientes en la sala y devolverlos a su sitio al acabar.
 *
 * Tres cosas y en este orden:
 *
 * 1. **Buscar sitio** con PlanArena, empezando por la baldosa donde esta el
 *    jugador. Si cabe ahi, no se le mueve: nada molesta mas que un juego que
 *    te teletransporta sin motivo.
 * 2. **Bloquear**: se guarda la posicion original, se le lleva a su hueco, se
 *    le gira al centro y se le quita el andar. Sin esto, el jugador se va
 *    andando a mitad de combate y la formacion se queda sola.
 * 3. **Reservar** las baldosas mientras dura, para que un espectador no se
 *    plante en medio.
 *
 * Si no cabe en ningun sitio, esto devuelve false y el combate se juega en
 * interfaz. **No se cancela nunca**: el jugador no pierde el encuentro por
 * estar la ruta llena, solo pierde el espectaculo.
 *
 * La caminabilidad se mira en el estado real de la baldosa, no en si hay furni
 * encima: una hierba alta pisable, una alfombra o un suelo decorativo no
 * bloquean, y ese es justo el furni sobre el que se pelea.
 */
public final class ServicioArena
{
    /** Donde estaba cada jugador antes de que le colocaramos. */
    private static final class Sitio
    {
        final int roomId;
        final short x;
        final short y;
        final RoomUserRotation rotacion;

        Sitio(int roomId, RoomTile baldosa, RoomUserRotation rotacion)
        {
            this.roomId = roomId;
            this.x = baldosa.x;
            this.y = baldosa.y;
            this.rotacion = rotacion;
        }
    }

    private static final Map<Integer, Sitio> ORIGEN = new ConcurrentHashMap<>();

    /** Baldosas ocupadas por un combate, por sala. La clave es x * 1000 + y. */
    private static final Map<Integer, Set<Integer>> RESERVADAS = new ConcurrentHashMap<>();

    private ServicioArena()
    {
    }

    private static int clave(int x, int y)
    {
        return x * 1000 + y;
    }

    public static boolean reservada(int roomId, int x, int y)
    {
        Set<Integer> baldosas = RESERVADAS.get(roomId);

        return baldosas != null && baldosas.contains(clave(x, y));
    }

    /**
     * @return true si la formacion cupo y el combate se ve en sala; false si
     *         toca resolverlo en interfaz.
     */
    public static boolean colocar(ServicioBatalla.Sesion sesion, Habbo habbo)
    {
        if(habbo == null) return false;

        Room room = habbo.getHabboInfo().getCurrentRoom();

        if(room == null || room.getLayout() == null) return false;

        RoomUnit unidad = habbo.getRoomUnit();

        if(unidad == null || unidad.getCurrentLocation() == null) return false;

        RoomTile desde = unidad.getCurrentLocation();

        PlanArena.Formacion formacion = PlanArena.resolver(
                desde.x, desde.y, sesion.formato, (x, y) -> libre(room, x, y, desde));

        if(formacion == null) return false;

        PlanArena.Hueco mio = formacion.de(PlanArena.ROL_ENTRENADOR_A);

        if(mio == null) return false;

        reservar(room.getId(), formacion);
        bloquear(habbo, room, unidad, mio);

        return true;
    }

    private static void reservar(int roomId, PlanArena.Formacion formacion)
    {
        Set<Integer> baldosas = RESERVADAS.computeIfAbsent(roomId, r -> new HashSet<>());

        for(PlanArena.Hueco hueco : formacion.huecos())
        {
            baldosas.add(clave(hueco.x(), hueco.y()));
        }
    }

    private static void bloquear(Habbo habbo, Room room, RoomUnit unidad, PlanArena.Hueco hueco)
    {
        int userId = habbo.getHabboInfo().getId();

        ORIGEN.put(userId, new Sitio(room.getId(), unidad.getCurrentLocation(),
                unidad.getBodyRotation()));

        RoomTile destino = room.getLayout().getTile((short) hueco.x(), (short) hueco.y());

        if(destino != null)
        {
            unidad.stopWalking();
            unidad.setGoalLocation(destino);
            unidad.setLocation(destino);
        }

        RoomUserRotation mirando = RoomUserRotation.fromValue(hueco.direccion());

        unidad.setRotation(mirando);
        unidad.setBodyRotation(mirando);
        unidad.setHeadRotation(mirando);

        // Lo ultimo: quitarle el andar. Antes de esto los setGoalLocation
        // siguen funcionando; despues, ya no hacen nada.
        unidad.setCanWalk(false);
        unidad.statusUpdate(true);
    }

    /** Devuelve a su sitio a todo el que estuviera bloqueado por esta sesion. */
    public static void soltar(ServicioBatalla.Sesion sesion)
    {
        if(sesion == null) return;

        RESERVADAS.remove(sesion.roomId);

        for(int userId : sesion.userIds)
        {
            soltar(userId);
        }
    }

    public static void soltar(int userId)
    {
        Sitio sitio = ORIGEN.remove(userId);

        if(sitio == null) return;

        Habbo habbo = ServicioBatalla.conectado(userId);

        if(habbo == null) return;

        RoomUnit unidad = habbo.getRoomUnit();
        Room room = habbo.getHabboInfo().getCurrentRoom();

        if(unidad == null) return;

        unidad.setCanWalk(true);

        // Si se ha cambiado de sala, devolverle a la baldosa vieja no tiene
        // sentido: basta con que vuelva a poder andar.
        if(room == null || room.getId() != sitio.roomId || room.getLayout() == null) return;

        RoomTile vuelta = room.getLayout().getTile(sitio.x, sitio.y);

        // Si su sitio se ha ocupado mientras peleaba, se queda donde esta y anda.
        if(vuelta != null && vuelta.isWalkable() && room.getHabbosAndBotsAt(sitio.x, sitio.y).isEmpty())
        {
            unidad.setGoalLocation(vuelta);
        }

        if(sitio.rotacion != null) unidad.setBodyRotation(sitio.rotacion);

        unidad.statusUpdate(true);
    }

    /**
     * Una baldosa vale si se puede pisar, no esta reservada por otro combate y
     * no hay nadie encima — salvo la propia del jugador, que obviamente si.
     */
    private static boolean libre(Room room, int x, int y, RoomTile propia)
    {
        if(room.getLayout() == null) return false;

        RoomTile baldosa = room.getLayout().getTile((short) x, (short) y);

        if(baldosa == null || !baldosa.isWalkable()) return false;

        if(reservada(room.getId(), x, y)) return false;

        if(propia != null && propia.x == x && propia.y == y) return true;

        return room.getHabbosAndBotsAt((short) x, (short) y).isEmpty();
    }

    /** Solo para el diagnostico del comando de estado. */
    public static int totalBloqueados()
    {
        return ORIGEN.size();
    }
}
```

- [ ] **Paso 2: Que la sesión sepa si va en sala o en interfaz**

`Sesion.enInterfaz` es `final` y se decide al crear, pero la formación se resuelve después de tener la sesión. Cambiar `enInterfaz` a campo mutable `public boolean enInterfaz;` y en `abrirSalvaje`, justo antes de devolver:

```java
        sesion.enInterfaz = !ServicioArena.colocar(sesion, habbo);

        if(sesion.enInterfaz) marcarEnInterfaz(sesion);
```

y el ayudante:

```java
    private static void marcarEnInterfaz(Sesion sesion) throws Exception
    {
        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            PreparedStatement p = c.prepareStatement(
                    "UPDATE pokemon_battles SET en_interfaz = 1 WHERE id = ?"))
        {
            p.setLong(1, sesion.id);
            p.executeUpdate();
        }
    }
```

- [ ] **Paso 3: Que pisar la hierba abra el combate**

En `DisparadorEncuentros.java`, método `aparecer`, sustituir el empujón suelto de `ENCUENTRO_BUSCAR` por la apertura de la batalla:

```java
        ServicioEntrenador.registrarVisto(userId, salvaje.pokemon().especieId());

        ServicioBatalla.Sesion sesion = ServicioBatalla.abrirSalvaje(habbo, salvaje);

        // Sin Pokemon en pie no hay combate. El encuentro se descarta sin
        // castigo y sin mensaje: lo contrario seria regaNar al jugador por
        // pisar hierba con el equipo hecho polvo.
        if(sesion == null)
        {
            ServicioEncuentros.limpiar(userId);
            return;
        }

        habbo.getClient().sendResponse(PokemonPackets.resultado(
                PokemonAcciones.ENCUENTRO_BUSCAR,
                true,
                PokemonCuerpo.datos(AccionesMundo.cuerpoSalvaje(salvaje))));

        ServicioBatalla.empujarEstado(sesion);
```

Y en la primera comprobación del método `alPaso`, añadir el combate junto al encuentro activo:

```java
        // Con un encuentro o un combate delante no se encadena otro.
        if(ServicioEncuentros.activo(userId) != null) return;
        if(ServicioBatalla.enCombate(userId)) return;
```

> Escribir `regañar` con eñe en el comentario está bien; lo que no puede llevar eñe es un identificador.

- [ ] **Paso 4: Compilar**

```bash
"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -o -f Desarrollo/PokemonEngine/pom.xml test
```

Esperado: BUILD SUCCESS, 342 pruebas.

- [ ] **Paso 5: Commit**

```bash
git add Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/
git commit -F - <<'GITEOF'
feat(pokemon): stand the trainer in place to fight

The formation search starts on the player's own tile, so if it fits
they are never teleported. If nothing fits anywhere nearby the battle
falls back to the interface — it is never cancelled, because a full
route should cost the spectacle, not the encounter.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
GITEOF
```

---

### Task 13: Salir, caerse y volver

**Ficheros:**
- Modificar: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/PokemonEnginePlugin.java`
- Modificar: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/ServicioBatalla.java`

**Interfaces:**
- Consume: `UserEnterRoomEvent` (cancelable: `setCancelled(true)`), `UserExitRoomEvent`, `UserKickEvent` (`event.target`), `UserDisconnectEvent`, `UserLoginEvent`, `RoomUnloadedEvent`; `ReglasAbandono.expirado(long, long)` y `turnoExpirado(long, long)`; `Emulator.getThreading().getService().scheduleAtFixedRate(...)`.
- Produce: `ServicioBatalla.ausentarse(int userId)`, `ServicioBatalla.volver(int userId)`, `ServicioBatalla.anularDeSala(int roomId, String motivo)`, `ServicioBatalla.arrancarLatido()`, `ServicioBatalla.latido()`.

- [ ] **Paso 1: Ausencia, vuelta y anulación en `ServicioBatalla`**

```java
    /**
     * Alguien ha dejado de estar disponible: se ha ido de la sala, se ha
     * desconectado o se le ha caido la conexion.
     *
     * No se le da la derrota todavia. Empieza a correr el plazo de gracia, y
     * el latido es quien lo cierra si no vuelve. Castigar la primera caida
     * seria castigar el router de alguien.
     */
    public static void ausentarse(int userId)
    {
        Sesion sesion = de(userId);

        if(sesion == null || sesion.ausenteDesdeMs > 0) return;

        int bando = sesion.bandoDe(userId);

        if(bando < 0) return;

        sesion.ausenteBando = bando;
        sesion.ausenteDesdeMs = System.currentTimeMillis();

        Map<String, Object> aviso = new LinkedHashMap<>();

        aviso.put("batallaId", sesion.id);
        aviso.put("turno", sesion.estado.turno());
        aviso.put("eventos", List.of(Map.of(
                "tipo", "rival_ausente",
                "datos", Map.of("graciaMs",
                        com.retro.pokemonengine.batalla.ReglasAbandono.GRACIA_MS))));

        empujar(sesion, PokemonAcciones.BATALLA_EVENTOS, aviso);
    }

    /** Ha vuelto dentro del plazo: se le devuelve al combate donde lo dejo. */
    public static void volver(int userId)
    {
        Sesion sesion = de(userId);

        if(sesion == null) return;

        if(sesion.ausenteBando == sesion.bandoDe(userId))
        {
            sesion.ausenteDesdeMs = 0;
            sesion.ausenteBando = -1;
        }

        empujarEstado(sesion);
    }

    /** Todo combate de esa sala se anula. Sin ganador, sin premio y sin castigo. */
    public static void anularDeSala(int roomId, String motivo)
    {
        for(Sesion sesion : enSala(roomId))
        {
            ServicioRecompensas.anular(sesion, motivo);
        }
    }

    /** El combate de ese jugador se anula, si tiene alguno. */
    public static void anularDe(int userId, String motivo)
    {
        Sesion sesion = de(userId);

        if(sesion != null) ServicioRecompensas.anular(sesion, motivo);
    }

    /**
     * Un latido por segundo, que es lo que cuesta llevar dos relojes.
     *
     * Cierra dos cosas: la gracia que ha expirado, que es derrota por
     * abandono, y el turno que nadie ha elegido, donde se mueve por el jugador
     * en vez de dejarlo colgado. Un combate salvaje abandonado no bloquea la
     * partida del otro porque no hay otro; uno de PvP si, y por eso esto existe.
     */
    public static void arrancarLatido()
    {
        Emulator.getThreading().getService().scheduleAtFixedRate(
                ServicioBatalla::latido, 1, 1, java.util.concurrent.TimeUnit.SECONDS);
    }

    public static void latido()
    {
        long ahora = System.currentTimeMillis();

        for(Sesion sesion : new ArrayList<>(SESIONES.values()))
        {
            try
            {
                if(sesion.ausenteDesdeMs > 0
                        && com.retro.pokemonengine.batalla.ReglasAbandono.expirado(
                                sesion.ausenteDesdeMs, ahora))
                {
                    int perdedor = sesion.ausenteBando;

                    if(sesion.salvaje != null)
                    {
                        // Contra un salvaje no hay a quien dar la victoria: se
                        // descarta el encuentro y ya esta.
                        ServicioEncuentros.limpiar(sesion.userIds[0]);
                        ServicioRecompensas.cerrar(sesion, -1, MOTIVO_ABANDONO);
                    }
                    else
                    {
                        ServicioRecompensas.cerrar(sesion, 1 - perdedor, MOTIVO_ABANDONO);
                    }

                    continue;
                }

                if(sesion.formato != Formato.SALVAJE
                        && com.retro.pokemonengine.batalla.ReglasAbandono.turnoExpirado(
                                sesion.turnoDesdeMs, ahora))
                {
                    moverPorLosQueNoEligieron(sesion);
                }
            }
            catch(Exception error)
            {
                System.out.println("[PokemonEngine] Fallo en el latido del combate "
                        + sesion.id + ": " + error.getMessage());
            }
        }
    }

    /**
     * Al expirar el turno se mueve por quien no eligio: el primer movimiento
     * con PP. Es lo que hacen los juegos con Forcejeo, y deja el combate
     * avanzando en vez de colgado.
     */
    private static void moverPorLosQueNoEligieron(Sesion sesion)
    {
        for(int bando = 0; bando < 2; bando++)
        {
            if(sesion.elegidas[bando] != null || sesion.userIds[bando] == 0) continue;

            sesion.elegidas[bando] = com.retro.pokemonengine.batalla.MenteSalvaje.elegir(
                    sesion.estado.bando(bando).activo(0), bando, 0, sesion.estado.rng());
        }

        resolverTurno(sesion);
    }
```

- [ ] **Paso 2: Los enganches en el plugin**

En `PokemonEnginePlugin.java`, importar los eventos nuevos y añadir los manejadores. En `onEmulatorLoaded`, después de las cargas existentes, arrancar el latido:

```java
        ServicioBatalla.arrancarLatido();
```

Los manejadores:

```java
    /**
     * Mientras se combate no se cambia de sala.
     *
     * Se cancela la **entrada** y no la salida, porque Arcturus comprueba
     * isCancelled() al entrar y no al salir — verificado en el bytecode. Con la
     * entrada cancelada el jugador se queda exactamente donde estaba, que es lo
     * que queremos, y ademas es coherente con el bloqueo de posicion: si no le
     * dejo andar, tampoco le dejo teletransportarse.
     */
    @EventHandler
    public void onUserEnterRoomBatalla(UserEnterRoomEvent event)
    {
        if(event.habbo == null || event.habbo.getHabboInfo() == null) return;

        ServicioBatalla.Sesion sesion = ServicioBatalla.de(event.habbo.getHabboInfo().getId());

        if(sesion == null) return;
        if(event.room != null && event.room.getId() == sesion.roomId) return;

        event.setCancelled(true);
        event.habbo.alert("No puedes cambiar de sala en mitad de un combate.");
    }

    /**
     * Salir de la sala del combate.
     *
     * A la vista del hotel se puede salir siempre: Arcturus no deja cancelarlo.
     * Asi que se trata como lo que es — una ausencia — y empieza el plazo de
     * gracia. Si te echan, en cambio, el combate se anula: no es tu decision.
     */
    @EventHandler
    public void onUserExitRoomBatalla(UserExitRoomEvent event)
    {
        if(event.habbo == null || event.habbo.getHabboInfo() == null) return;

        int userId = event.habbo.getHabboInfo().getId();

        if(!ServicioBatalla.enCombate(userId)) return;

        if(event.reason == UserExitRoomEvent.UserExitRoomReason.KICKED_HABBO)
        {
            ServicioBatalla.anularDe(userId, "expulsado");
            return;
        }

        ServicioBatalla.ausentarse(userId);
    }

    @EventHandler
    public void onUserKick(UserKickEvent event)
    {
        if(event.target == null || event.target.getHabboInfo() == null) return;

        ServicioBatalla.anularDe(event.target.getHabboInfo().getId(), "expulsado");
    }

    @EventHandler
    public void onUserDisconnect(UserDisconnectEvent event)
    {
        if(event.habbo == null || event.habbo.getHabboInfo() == null) return;

        ServicioBatalla.ausentarse(event.habbo.getHabboInfo().getId());
    }

    @EventHandler
    public void onUserLogin(UserLoginEvent event)
    {
        if(event.habbo == null || event.habbo.getHabboInfo() == null) return;

        ServicioBatalla.volver(event.habbo.getHabboInfo().getId());
    }

    /** Si la sala se descarga, el combate que hubiera dentro no tiene donde ocurrir. */
    @EventHandler
    public void onRoomUnloaded(RoomUnloadedEvent event)
    {
        if(event.room == null) return;

        ServicioBatalla.anularDeSala(event.room.getId(), "sala_cerrada");
    }
```

En el `onUserEnterRoom` que ya existe, añadir al final la vuelta del que regresa a su sala de combate:

```java
        if(ServicioBatalla.enCombate(event.habbo.getHabboInfo().getId()))
        {
            ServicioBatalla.volver(event.habbo.getHabboInfo().getId());
        }
```

> `RoomUnloadedEvent` expone la sala como `event.room`; confirmar el nombre del campo con `javap` si el compilador se queja.

- [ ] **Paso 3: Quitarle la zona a la sala también anula**

En `ServicioZonas`, donde se recargan las salas Pokémon (el método que rellena el mapa `zonaDeSala`), después de recargar, anular los combates de las salas que se han quedado sin zona:

```java
        for(int roomId : salasQuePerdieronZona)
        {
            ServicioBatalla.anularDeSala(roomId, "sala_sin_zona");
        }
```

> Calcular `salasQuePerdieronZona` como la diferencia entre el mapa viejo y el nuevo antes de sustituirlo. Si `ServicioZonas.cargar()` no guarda el mapa viejo, capturarlo en una variable local al principio del método.

- [ ] **Paso 4: Compilar**

```bash
"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -o -f Desarrollo/PokemonEngine/pom.xml test
```

Esperado: BUILD SUCCESS, 342 pruebas.

- [ ] **Paso 5: Commit**

```bash
git add Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/
git commit -F - <<'GITEOF'
feat(pokemon): handle walking out, dropping out and coming back

Room changes are blocked by cancelling the enter event, which Arcturus
actually honours — the exit event's cancellation is never checked.
Leaving to the hotel view starts the grace clock instead. Being kicked
voids the battle, because that was not the player's decision.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
GITEOF
```

---

### Task 14: El reto — PvP amistoso

**Ficheros:**
- Crear: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/ServicioRetos.java`
- Modificar: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/AccionesBatalla.java`
- Modificar: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/ServicioBatalla.java`

**Interfaces:**
- Consume: `PlanArena.distancia(int, int, int, int)`, `PlanArena.DISTANCIA_RETO_MAX`, `ServicioZonas.zonaDeSala(int)`, `ServicioBatalla.enCombate(int)`.
- Produce: `ServicioRetos.retar(Habbo retador, int rivalId)` → `Respuesta`, `ServicioRetos.responder(int userId, boolean acepta)` → `Respuesta`, `ServicioRetos.caducar()`; `ServicioBatalla.abrirPvp(Habbo a, Habbo b)` → `Sesion`.

- [ ] **Paso 1: `ServicioBatalla.abrirPvp`**

```java
    /**
     * Abre un PvP amistoso entre dos jugadores de la misma sala.
     *
     * Simetrico respecto a abrirSalvaje: los dos bandos son jugadores y no hay
     * salvaje, asi que no hay captura ni huida — eso lo dice el Formato — y el
     * turno no se resuelve hasta que han elegido los dos.
     */
    public static Sesion abrirPvp(Habbo a, Habbo b) throws Exception
    {
        int userA = a.getHabboInfo().getId();
        int userB = b.getHabboInfo().getId();

        if(enCombate(userA) || enCombate(userB)) return null;

        PokemonPoseido cabezaA = primeroConPs(ServicioEntrenador.cargarPokemon(userA));
        PokemonPoseido cabezaB = primeroConPs(ServicioEntrenador.cargarPokemon(userB));

        if(cabezaA == null || cabezaB == null) return null;

        EspecieCatalogo especieA = ServicioPokedex.especie(cabezaA.especieId());
        EspecieCatalogo especieB = ServicioPokedex.especie(cabezaB.especieId());

        if(especieA == null || especieB == null) return null;

        long semilla = System.nanoTime() ^ ((long) userA << 24) ^ ((long) userB << 8);

        Bando bandoA = new Bando(0);
        bandoA.posiciones().add(cabezaA.aCombate(especieA, cabezaA.nivel()));

        Bando bandoB = new Bando(1);
        bandoB.posiciones().add(cabezaB.aCombate(especieB, cabezaB.nivel()));

        EstadoCombate estado = new EstadoCombate(bandoA, bandoB, new RngCombate(semilla));

        int roomId = a.getHabboInfo().getCurrentRoom().getId();
        Integer zonaId = ServicioZonas.zonaDeSala(roomId);

        if(zonaId != null)
        {
            String climaMotor = ServicioClima.claveDeMotor(zonaId);

            if(climaMotor != null) estado.ponerClima(climaMotor, -1);
        }

        long id = insertar(Formato.PVP_AMISTOSO, zonaId, roomId, false, semilla);

        Sesion sesion = new Sesion(id, Formato.PVP_AMISTOSO, zonaId, roomId, false,
                semilla, estado);

        sesion.userIds[0] = userA;
        sesion.userIds[1] = userB;
        sesion.propios[0] = cabezaA;
        sesion.propios[1] = cabezaB;

        insertarBandos(sesion);

        SESIONES.put(id, sesion);
        POR_JUGADOR.put(userA, id);
        POR_JUGADOR.put(userB, id);

        // Los dos se colocan; basta con que uno no quepa para que vaya en interfaz.
        boolean enSala = ServicioArena.colocar(sesion, a) & ServicioArena.colocar(sesion, b);

        sesion.enInterfaz = !enSala;

        if(sesion.enInterfaz) marcarEnInterfaz(sesion);

        empujarEstado(sesion);

        return sesion;
    }
```

> El `&` en vez de `&&` es intencionado: los dos tienen que colocarse aunque el primero falle, porque si no el segundo se quedaría suelto en medio de la formación.

- [ ] **Paso 2: `ServicioRetos`**

```java
package com.retro.pokemonengine;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.rooms.Room;
import com.eu.habbo.habbohotel.users.Habbo;
import com.retro.pokemonengine.batalla.PlanArena;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Retar a otro jugador.
 *
 * Dos condiciones y las dos por el mismo motivo — que el reto sea una cosa que
 * pasa **en la sala** y no un mensaje que llega de la nada:
 *
 * 1. Los dos en la misma sala Pokemon.
 * 2. A cinco baldosas o menos.
 *
 * El reto caduca solo. Un reto que se queda pendiente para siempre es una
 * forma de bloquear a alguien: mientras lo tiene encima, no puede aceptar otro.
 */
public final class ServicioRetos
{
    public static final long CADUCA_MS = 30L * 1000L;

    public static final String SIN_ZONA = "SIN_ZONA";
    public static final String LEJOS = "LEJOS";
    public static final String OCUPADO = "OCUPADO";
    public static final String SIN_RETO = "SIN_RETO";

    private record Reto(int retadorId, int rivalId, long creadoMs)
    {
    }

    /** Por rival: solo se puede tener un reto encima a la vez. */
    private static final Map<Integer, Reto> PENDIENTES = new ConcurrentHashMap<>();

    private ServicioRetos()
    {
    }

    public static Respuesta retar(Habbo retador, int rivalId)
    {
        if(retador == null || retador.getHabboInfo() == null)
        {
            return Respuesta.mal(SIN_ZONA, "No estas en ninguna sala");
        }

        int retadorId = retador.getHabboInfo().getId();

        if(retadorId == rivalId) return Respuesta.mal(OCUPADO, "No puedes retarte a ti mismo");

        Room room = retador.getHabboInfo().getCurrentRoom();

        if(room == null || ServicioZonas.zonaDeSala(room.getId()) == null)
        {
            return Respuesta.mal(SIN_ZONA, "Aqui no se puede combatir");
        }

        Habbo rival = ServicioBatalla.conectado(rivalId);

        if(rival == null || rival.getHabboInfo().getCurrentRoom() == null
                || rival.getHabboInfo().getCurrentRoom().getId() != room.getId())
        {
            return Respuesta.mal(LEJOS, "Ese entrenador no esta en la sala");
        }

        if(ServicioBatalla.enCombate(retadorId) || ServicioBatalla.enCombate(rivalId))
        {
            return Respuesta.mal(OCUPADO, "Uno de los dos ya esta combatiendo");
        }

        if(retador.getRoomUnit() == null || rival.getRoomUnit() == null
                || retador.getRoomUnit().getCurrentLocation() == null
                || rival.getRoomUnit().getCurrentLocation() == null)
        {
            return Respuesta.mal(LEJOS, "No se donde estais");
        }

        int distancia = PlanArena.distancia(
                retador.getRoomUnit().getCurrentLocation().x,
                retador.getRoomUnit().getCurrentLocation().y,
                rival.getRoomUnit().getCurrentLocation().x,
                rival.getRoomUnit().getCurrentLocation().y);

        if(distancia > PlanArena.DISTANCIA_RETO_MAX)
        {
            return Respuesta.mal(LEJOS, "Acercate para retarle");
        }

        Reto existente = PENDIENTES.get(rivalId);

        if(existente != null && !caducado(existente, System.currentTimeMillis()))
        {
            return Respuesta.mal(OCUPADO, "Ya tiene un reto pendiente");
        }

        PENDIENTES.put(rivalId, new Reto(retadorId, rivalId, System.currentTimeMillis()));

        Map<String, Object> aviso = new LinkedHashMap<>();

        aviso.put("retadorId", retadorId);
        aviso.put("retador", retador.getHabboInfo().getUsername());
        aviso.put("caducaMs", CADUCA_MS);

        rival.getClient().sendResponse(PokemonPackets.resultado(
                PokemonAcciones.BATALLA_RETAR, true, PokemonCuerpo.datos(aviso)));

        Map<String, Object> eco = new LinkedHashMap<>();

        eco.put("enviado", true);
        eco.put("rivalId", rivalId);

        return Respuesta.bien(eco);
    }

    public static Respuesta responder(int userId, boolean acepta) throws Exception
    {
        Reto reto = PENDIENTES.remove(userId);

        if(reto == null) return Respuesta.mal(SIN_RETO, "No tienes ningun reto pendiente");

        if(caducado(reto, System.currentTimeMillis()))
        {
            return Respuesta.mal(SIN_RETO, "Ese reto ya ha caducado");
        }

        Habbo retador = ServicioBatalla.conectado(reto.retadorId());
        Habbo rival = ServicioBatalla.conectado(userId);

        if(retador == null || rival == null)
        {
            return Respuesta.mal(SIN_RETO, "El otro entrenador ya no esta");
        }

        Map<String, Object> respuesta = new LinkedHashMap<>();

        respuesta.put("aceptado", acepta);

        if(!acepta)
        {
            retador.getClient().sendResponse(PokemonPackets.resultado(
                    PokemonAcciones.BATALLA_RETO_RESPONDER, true,
                    PokemonCuerpo.datos(respuesta)));

            return Respuesta.bien(respuesta);
        }

        ServicioBatalla.Sesion sesion = ServicioBatalla.abrirPvp(retador, rival);

        if(sesion == null)
        {
            return Respuesta.mal(OCUPADO, "Alguno de los dos no tiene un Pokemon en pie");
        }

        return Respuesta.bien(ServicioBatalla.cuerpo(sesion, userId));
    }

    private static boolean caducado(Reto reto, long ahora)
    {
        return ahora - reto.creadoMs() >= CADUCA_MS;
    }

    /** Limpia los retos vencidos. La llama el latido de ServicioBatalla. */
    public static void caducar()
    {
        long ahora = System.currentTimeMillis();

        PENDIENTES.entrySet().removeIf(entrada -> caducado(entrada.getValue(), ahora));
    }
}
```

Añadir la limpieza al final de `ServicioBatalla.latido()`:

```java
        ServicioRetos.caducar();
```

- [ ] **Paso 3: Las dos acciones nuevas**

En `AccionesBatalla`, ampliar `esAccionDeBatalla` y el `switch`:

```java
                || accion == PokemonAcciones.BATALLA_RETAR
                || accion == PokemonAcciones.BATALLA_RETO_RESPONDER
```

```java
            case PokemonAcciones.BATALLA_RETAR ->
                    ServicioRetos.retar(habbo, entero(datos, "rivalId", 0));
            case PokemonAcciones.BATALLA_RETO_RESPONDER ->
                    ServicioRetos.responder(userId, booleano(datos, "acepta", false));
```

y el ayudante:

```java
    private static boolean booleano(JsonObject datos, String clave, boolean porDefecto)
    {
        return datos != null && datos.has(clave) && datos.get(clave).isJsonPrimitive()
                ? datos.get(clave).getAsBoolean()
                : porDefecto;
    }
```

- [ ] **Paso 4: Compilar**

```bash
"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -o -f Desarrollo/PokemonEngine/pom.xml test
```

Esperado: BUILD SUCCESS, 342 pruebas.

- [ ] **Paso 5: Commit**

```bash
git add Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/
git commit -F - <<'GITEOF'
feat(pokemon): let two trainers challenge each other

Same room, five tiles or fewer, and the challenge expires by itself —
a pending challenge that never lapses is a way to block someone, since
they cannot accept another while they hold it. Friendly only: no
capture, no fleeing and no reward.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
GITEOF
```

---

### Task 15: Verificación a mano en el runtime aislado y documentos

**Ficheros:**
- Modificar: `docs/POKEMON-TRASPASO.md`
- Modificar: `docs/superpowers/plans/2026-09-19-pokemon-engine-hito-6b-combate.md` (marcar las casillas)

**Interfaces:**
- Consume: el emulador de pruebas y el cliente servido en `/pokemon-dist`.
- Produce: un hito 6b verificado y el traspaso apuntando al hito 7.

- [ ] **Paso 1: Empaquetar y desplegar en el runtime de pruebas**

```bash
"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -o -f Desarrollo/PokemonEngine/pom.xml package
```

Parar el emulador de pruebas (el PID que escucha en el 3200), copiar el JAR a `build/pokemon-test-runtime/plugins/` y arrancarlo **con el filtro**:

```bash
cd build/pokemon-test-runtime && java -Dfile.encoding=UTF8 -jar Habbo-3.6.0-jar-with-dependencies.jar 2>&1 | grep --line-buffered -v "Waiting for command" > runtime.log
```

En el log tiene que aparecer la migración 8 aplicada y ningún `Header already registered`.

- [ ] **Paso 2: Entrar con Hokusei**

Poner un `auth_ticket` nuevo en la fila del usuario (Arcturus lo consume en el primer login), abrir `/pokemon-dist` en el navegador y entrar en la sala 203, que es la que tiene la banda de hierba de siete baldosas en `y = 6`.

- [ ] **Paso 3: Comprobar el combate salvaje entero**

Caminar sobre la hierba hasta que salga un Pokémon, y verificar **en la sala**, no solo en la consola:

1. El avatar **se queda quieto** y mirando en la dirección de la formación. Intentar andar: no se mueve.
2. `window.PokemonEngine.enviar(63, {})` devuelve el estado con `mio` (con PS exactos y movimientos) y `rival` (con `psPorcentaje`, **sin** `psActual`).
3. `window.PokemonEngine.enviar(64, {tipo:'movimiento', indice:0})` devuelve el estado nuevo y llega un 6401 con `BATALLA_EVENTOS`. Comprobar que la lista de eventos tiene `turno_inicio` y al menos un `dano`.
4. Repetir hasta ganar. Al ganar deben llegar los eventos `experiencia` y, si sube, `sube_nivel`. El avatar **vuelve a poder andar** y a su baldosa original.
5. En la base de datos: `SELECT estado, motivo_fin, ganador_user_id, turno FROM pokemon_battles ORDER BY id DESC LIMIT 1;` debe decir `terminada` / `ko`, y `SELECT COUNT(*) FROM pokemon_battle_log WHERE battle_id = <id>;` debe ser mayor que cero.
6. `SELECT nivel, experiencia, ev_ataque FROM pokemon_owned WHERE id = <id del Pokemon que peleo>;` tiene que haber subido.

- [ ] **Paso 4: Comprobar la huida**

Sacar otro salvaje y mandar `window.PokemonEngine.enviar(64, {tipo:'huida'})` varias veces. Verificar:

- Con un rival más lento, sale a la primera.
- Con uno más rápido, algún intento falla y en ese turno **el rival ataca** (llegan eventos de daño).
- Al salir, el combate queda como `terminada` / `huida` y el avatar se desbloquea.

- [ ] **Paso 5: Comprobar la captura en combate**

Sacar un salvaje, bajarle los PS con un ataque y lanzar una ball con `window.PokemonEngine.enviar(64, {tipo:'captura', ballId:4})`. Verificar que:

- Con el salvaje **herido** entra bastante más que con el salvaje entero. No hace falta medirlo: basta con ver que la fórmula está leyendo los PS del campo, comprobando que el cuerpo del encuentro y el del combate coinciden en PS antes de tirar.
- Al capturar, el combate queda `terminada` / `captura` y el Pokémon aparece en `pokemon_owned`.

- [ ] **Paso 6: Comprobar el bloqueo de sala y la anulación**

1. En mitad de un combate, intentar entrar en otra sala desde el navegador. Debe salir la alerta y **el avatar no se mueve de la sala**.
2. Salir a la vista del hotel y volver a entrar antes de tres minutos: el combate sigue, y `enviar(63, {})` devuelve el mismo `batallaId`.
3. Empezar otro combate, salir a la vista del hotel y esperar. A los tres minutos el latido lo cierra: `SELECT estado, motivo_fin FROM pokemon_battles ORDER BY id DESC LIMIT 1;` debe decir `terminada` / `abandono`.
4. Con una segunda cuenta dueña de la sala, echar al que combate. El combate debe quedar `anulada` / y el Pokémon salvaje desaparecer **sin** que el que peleaba pierda nada: comprobar que sus PS en `pokemon_owned` son los de antes del combate.

- [ ] **Paso 7: Comprobar el PvP**

Con dos cuentas en la sala 203, a menos de cinco baldosas:

```js
window.PokemonEngine.enviar(66, {rivalId: <id del otro>})
```

y desde la otra:

```js
window.PokemonEngine.enviar(67, {acepta: true})
```

Verificar que los dos avatares se colocan en línea mirándose, que ninguno puede andar, que el turno **no se resuelve hasta que eligen los dos**, que `enviar(64, {tipo:'huida'})` responde `NO_SE_HUYE`, y que al acabar **no llega ningún evento de experiencia**: el amistoso no paga.

Probar también el reto a más de cinco baldosas (`LEJOS`) y el reto a alguien que ya está combatiendo (`OCUPADO`).

- [ ] **Paso 8: Dejar la base de pruebas limpia**

Curar el equipo en el centro Pokémon o por SQL, y anotar en el traspaso lo que quede sembrado. Los combates terminados se quedan: son el historial y no molestan.

- [ ] **Paso 9: Actualizar el traspaso**

En `docs/POKEMON-TRASPASO.md`:

1. Marcar el **hito 6b como hecho** en la tabla de hitos y cambiar el encabezado «Para la siguiente sesión» para que apunte al **hito 7, el cliente**, con el aviso de coordinación con el vestidor en `dev`.
2. Actualizar los contadores de pruebas (Java y PHP) y la versión de esquema, que pasa a ser la **8**.
3. Añadir `batalla` al grep de pureza de la sección 2.
4. Añadir a la sección de «lo que el motor todavía no tiene» lo que este hito **no** ha hecho: efectos de objetos, efectos de habilidades, combates dobles y entrenadores IA.
5. Anotar en la lista de restos del runtime de pruebas los combates que hayan quedado en `pokemon_battles`.
6. Añadir una sección nueva con **lo que el cliente del hito 7 tiene que pintar**: las acciones 63-68, la forma del cuerpo de `BATALLA_ESTADO` y la lista de tipos de evento que el motor emite. Sacar los tipos del código, no de memoria:

```bash
grep -rhon 'new Evento("[a-z_]*"' Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/combate/ | sed 's/.*new Evento("//;s/"//' | sort -u
```

- [ ] **Paso 10: Marcar el plan y hacer el commit final**

Marcar todas las casillas de este documento y:

```bash
git add docs/
git commit -F - <<'GITEOF'
docs(pokemon): record milestone 6b and hand the client its contract

Battle verified end to end in the isolated runtime: wild and PvP,
fleeing, capture, position lock, room-change block, grace period and
voiding. The handoff now points at milestone 7 and carries the list of
events the client has to draw.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
GITEOF
git push origin codex/pokemon-engine
```

**No fusionar.** La rama se queda sin fusionar hasta terminar la fase, como está acordado.

---

## Repaso del plan

Comprobado tras escribirlo:

**Cobertura de las decisiones ya tomadas.** Huida solo en salvaje → tareas 2 y 10. Bloqueo de cambio de sala → tarea 13. Desconexión con plazo de gracia → tareas 7 y 13. Anulación por expulsión, ban, sala cerrada o sin zona → tarea 13. Obligatorio en sala con caída a interfaz → tarea 12. Evolución conservando lo del individuo → tarea 5. Todo tiene su tarea.

**Riesgos del entorno.** Los cinco de la sección 3 del traspaso están en las restricciones globales, y la pureza se comprueba en las tareas 2, 7 y en el grep global.

**Orden de las dependencias.** Las tareas 9, 10 y 11 no compilan por separado y eso está dicho en cada una: comparten un solo commit al final de la 11. El resto compila y pasa las pruebas tarea a tarea.

**Dónde puede fallar de verdad.** En los nombres de los mutadores de `PokemonPoseido` y `ServicioEntrenador`, que este plan no ha verificado uno a uno. Cada sitio donde se usan lleva un aviso explícito de confirmarlos antes de compilar. Es un fallo barato: lo caza el compilador en el primer intento.

**Lo que queda fuera y está dicho:** efectos de objetos y habilidades, dobles, entrenadores IA y el render en sala.
