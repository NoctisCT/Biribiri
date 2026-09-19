# Hito 6a — El mundo se mueve: plan de implementación

> **Para quien lo ejecute:** SUB-SKILL OBLIGATORIA: usar `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para implementarlo tarea a tarea. Los pasos llevan casilla (`- [ ]`) para ir marcándolos.

**Objetivo:** que un Pokémon salvaje aparezca porque el jugador ha pisado hierba alta en una sala Pokémon, con la probabilidad, la hora y el clima de esa zona, en vez de porque el cliente lo haya pedido.

**Arquitectura:** las decisiones puras (¿toca encuentro?, ¿qué clima sale?) van en clases sin `com.eu.habbo` que se prueban con miles de tiradas. Lo que toca el emulador — el evento de paso, la consulta del furni en la baldosa, el latido del clima — son servicios delgados que consultan a esas clases. El estado caliente (enfriamiento por jugador) vive en memoria; el que debe sobrevivir a un reinicio (clima actual) vive en base de datos.

**Tecnologías:** Java 16, Maven offline, JUnit 5, MySQL vía Arcturus, y del lado PHP Laravel con PHPUnit para el importador.

## Restricciones globales

- Repo local `C:\Users\erale\Desktop\Habbo`, worktree `build/pokemon-engine`, rama `codex/pokemon-engine`. **No se trabaja sobre `dev` ni `master`.**
- **Nunca** `yarn install`, `npm install` ni `composer install`.
- **Nunca** se despliega en `Emulator/` (producción). Todo va a `build/pokemon-test-runtime`, base de datos `habbo_pokemon_test_20260918`, puertos 3200/3201/2196.
- Arrancar el emulador de pruebas **siempre** filtrando: `java -Dfile.encoding=UTF8 -jar Habbo-3.6.0-jar-with-dependencies.jar 2>&1 | grep --line-buffered -v "Waiting for command" > runtime.log`. Sin el filtro genera decenas de GB de log.
- **Sin acentos ni eñes en identificadores Java.** En comentarios y textos sí.
- `combate/`, `entrenador/`, `seguidor/`, `encuentros/`, `captura/`, `tienda/` y el nuevo `clima/` **no importan `com.eu.habbo`**. Se comprueba con grep en cada commit.
- El `userId` sale siempre de la sesión, nunca del paquete.
- Probabilidades: se prueban con miles de tiradas, nunca con una.
- Maven: `"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -o -f Desarrollo/PokemonEngine/pom.xml test`
- PHP: `/c/Users/erale/Desktop/Habbo/xampp/php/php.exe` (el worktree no tiene copia propia de PHP).
- Estado de partida: 263 pruebas de Java y 25 de PHP en verde, esquema en la versión 6.

---

## Estructura de ficheros

**Java, puro (sin emulador):**

| Fichero | Responsabilidad |
|---|---|
| `encuentros/TiradaEncuentro.java` | Decide si un paso produce encuentro: probabilidad, enfriamiento y silenciado |
| `clima/Clima.java` | Los cinco climas del mundo y su traducción al motor de combate |
| `clima/RuletaClima.java` | Sorteo por pesos, sembrado |
| `entrenador/EscalaVisual.java` | Tamaño de sprite a partir de la altura, con anulación manual |
| `entrenador/ReglasIntercambio.java` | Si un Pokémon y su dueño pueden intercambiar |

**Java, con emulador:**

| Fichero | Responsabilidad |
|---|---|
| `migraciones/M007Mundo.java` | Tablas y columnas nuevas, y su siembra |
| `ServicioFurniEncuentro.java` | Catálogo en memoria de furni → método |
| `ServicioClima.java` | Clima actual por zona, ciclo, persistencia y aviso |
| `DisparadorEncuentros.java` | El paso: doble llave, tirada y empujón al cliente |
| `ServicioTiempoJugado.java` | Acumula minutos en salas Pokémon |
| `ServicioEncuentros.java` (modificado) | Filtra por clima y guarda el estado de tirada por jugador |
| `AccionesMundo.java` (modificado) | `ZONA_INFO` con clima; el 60 restringido a rango 7 |

**PHP:**

| Fichero | Responsabilidad |
|---|---|
| `app/Services/Pokemon/MapeadorEspecie.php` (modificado) | Descripción, categoría, número regional y cry |
| `app/Console/Commands/PokemonImportCatalog.php` (modificado) | Pasa el índice de Pokédex al mapeador |

---

### Task 1: Migración M007

**Ficheros:**
- Crear: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/migraciones/M007Mundo.java`
- Modificar: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/BaseDatosPokemon.java`

**Interfaces:**
- Consume: `Migracion` (`version()`, `nombre()`, `aplicar(Connection)`).
- Produce: las tablas `pokemon_encounter_furni`, `pokemon_zone_encounter_rates`, `pokemon_zone_weather`, `pokemon_zone_weather_state`; las columnas `pokemon_zone_encounters.clima`, `pokemon_species.descripcion_es|categoria_es|numero_regional|cry_url|escala_visual`, `pokemon_owned.variante|intercambiable`.

- [ ] **Step 1: Escribir la migración**

Sigue el patrón de `M006Mundo.java`: `Statement`, `CREATE TABLE IF NOT EXISTS` y siembras con `INSERT IGNORE`. Para las columnas hace falta comprobar antes si existen, porque MySQL 10.4 no acepta `ADD COLUMN IF NOT EXISTS` de forma fiable en todas las versiones:

```java
private void columna(Connection c, Statement s, String tabla, String columna, String definicion)
        throws Exception
{
    try(ResultSet r = c.getMetaData().getColumns(null, null, tabla, columna))
    {
        if(r.next()) return;
    }

    s.executeUpdate("ALTER TABLE " + tabla + " ADD COLUMN " + columna + " " + definicion);
}
```

Tablas nuevas, con los tipos de la spec §3.3, §4.1 y §5.2:

```java
s.executeUpdate(
    "CREATE TABLE IF NOT EXISTS pokemon_encounter_furni (" +
    "sprite_id INT NOT NULL," +
    "metodo VARCHAR(16) NOT NULL DEFAULT 'HIERBA'," +
    "activo TINYINT(1) NOT NULL DEFAULT 1," +
    "nota VARCHAR(80) NULL," +
    "PRIMARY KEY (sprite_id)" +
    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

s.executeUpdate(
    "CREATE TABLE IF NOT EXISTS pokemon_zone_encounter_rates (" +
    "zone_id INT NOT NULL," +
    "metodo VARCHAR(16) NOT NULL," +
    "por_mil SMALLINT UNSIGNED NOT NULL DEFAULT 0," +
    "PRIMARY KEY (zone_id, metodo)" +
    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

s.executeUpdate(
    "CREATE TABLE IF NOT EXISTS pokemon_zone_weather (" +
    "zone_id INT NOT NULL," +
    "clima VARCHAR(16) NOT NULL," +
    "peso SMALLINT UNSIGNED NOT NULL DEFAULT 0," +
    "PRIMARY KEY (zone_id, clima)" +
    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

s.executeUpdate(
    "CREATE TABLE IF NOT EXISTS pokemon_zone_weather_state (" +
    "zone_id INT NOT NULL," +
    "clima VARCHAR(16) NOT NULL DEFAULT 'DESPEJADO'," +
    "desde TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
    "hasta TIMESTAMP NULL DEFAULT NULL," +
    "PRIMARY KEY (zone_id)" +
    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
```

Columnas:

```java
columna(conexion, s, "pokemon_zone_encounters", "clima", "VARCHAR(16) NULL");
columna(conexion, s, "pokemon_species", "descripcion_es", "TEXT NULL");
columna(conexion, s, "pokemon_species", "categoria_es", "VARCHAR(40) NULL");
columna(conexion, s, "pokemon_species", "numero_regional", "SMALLINT UNSIGNED NULL");
columna(conexion, s, "pokemon_species", "cry_url", "VARCHAR(255) NULL");
columna(conexion, s, "pokemon_species", "escala_visual", "VARCHAR(12) NULL");
columna(conexion, s, "pokemon_owned", "variante", "VARCHAR(24) NOT NULL DEFAULT 'normal'");
columna(conexion, s, "pokemon_owned", "intercambiable", "TINYINT(1) NOT NULL DEFAULT 1");
```

Siembra, con la Ruta 1 de la spec §4.1 y §5.3:

```java
s.executeUpdate(
    "INSERT IGNORE INTO pokemon_zone_encounter_rates (zone_id, metodo, por_mil)" +
    " SELECT z.id, 'HIERBA', 120 FROM pokemon_zones z WHERE z.codigo = 'ruta-1'");

s.executeUpdate(
    "INSERT IGNORE INTO pokemon_zone_weather (zone_id, clima, peso)" +
    " SELECT z.id, c.clima, c.peso FROM pokemon_zones z JOIN (" +
    " SELECT 'DESPEJADO' clima, 70 peso UNION ALL" +
    " SELECT 'LLUVIA', 20 UNION ALL" +
    " SELECT 'SOL', 8 UNION ALL" +
    " SELECT 'TORMENTA_ARENA', 2) c" +
    " WHERE z.codigo = 'ruta-1'");
```

**El furni disparador no se siembra aquí**: el sprite lo decide el propietario (spec §3.3). Se da de alta a mano en la tarea 7.

- [ ] **Step 2: Registrar la migración**

En `BaseDatosPokemon.java`, añade el import y la entrada a la lista, detrás de `new M006Mundo()`:

```java
import com.retro.pokemonengine.migraciones.M007Mundo;
```

```java
                new M006Mundo(),
                new M007Mundo()
```

- [ ] **Step 3: Compilar**

Run: `"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -o -f Desarrollo/PokemonEngine/pom.xml test`
Expected: `Tests run: 263, Failures: 0` y `BUILD SUCCESS`.

- [ ] **Step 4: Aplicar en el runtime aislado**

```bash
"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -o -f Desarrollo/PokemonEngine/pom.xml package -DskipTests
PID=$(netstat -ano | grep ":3200 " | head -1 | awk '{print $NF}')
powershell.exe -NoProfile -Command "Stop-Process -Id $PID -Force"
cp Desarrollo/PokemonEngine/target/pokemon-engine-1.0.0.jar ../pokemon-test-runtime/plugins/
cd ../pokemon-test-runtime && java -Dfile.encoding=UTF8 -jar Habbo-3.6.0-jar-with-dependencies.jar 2>&1 | grep --line-buffered -v "Waiting for command" > runtime.log &
```

Expected en `runtime.log`: `[PokemonEngine] Migracion 7 (mundo) aplicada.`

- [ ] **Step 5: Comprobar idempotencia**

Reinicia el emulador una segunda vez.
Expected: `[PokemonEngine] Esquema al dia en la version 7.` — sin errores de columna duplicada.

- [ ] **Step 6: Commit**

```bash
git add Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/migraciones/M007Mundo.java Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/BaseDatosPokemon.java
git commit -m "feat(pokemon): add the world tables and the columns that cannot wait"
```

---

### Task 2: TiradaEncuentro

**Ficheros:**
- Crear: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/encuentros/TiradaEncuentro.java`
- Test: `Desarrollo/PokemonEngine/src/test/java/com/retro/pokemonengine/encuentros/TiradaEncuentroTest.java`

**Interfaces:**
- Consume: `com.retro.pokemonengine.combate.RngCombate` (`entre(int, int)`).
- Produce:
  - `TiradaEncuentro.Estado` con `pasosEnfriamiento()`, `esperaHastaMs()`, `pasosSilenciados()` y la estática `inicial()`
  - `TiradaEncuentro.Resultado` con `toca()` y `estado()`
  - `TiradaEncuentro.paso(int porMil, Estado estado, long ahoraMs, RngCombate rng)`
  - `TiradaEncuentro.silenciar(Estado estado, int pasos)`
  - Constantes `ENFRIAMIENTO_PASOS = 8` y `ENFRIAMIENTO_MS = 5000`

- [ ] **Step 1: Escribir las pruebas que fallan**

```java
package com.retro.pokemonengine.encuentros;

import com.retro.pokemonengine.combate.RngCombate;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TiradaEncuentroTest
{
    private static final int PASOS = 10_000;

    private int cuentaEncuentros(int porMil, long semilla)
    {
        RngCombate rng = new RngCombate(semilla);
        TiradaEncuentro.Estado estado = TiradaEncuentro.inicial();
        int encuentros = 0;
        long ahora = 0L;

        for(int i = 0; i < PASOS; i++)
        {
            // Tiempo de sobra entre pasos para que el enfriamiento por ms nunca mande.
            ahora += TiradaEncuentro.ENFRIAMIENTO_MS + 1;

            TiradaEncuentro.Resultado resultado = TiradaEncuentro.paso(porMil, estado, ahora, rng);

            estado = resultado.estado();

            if(resultado.toca()) encuentros++;
        }

        return encuentros;
    }

    @Test
    void laProbabilidadSaleDentroDeMargen()
    {
        // Con enfriamiento de 8 pasos, de cada encuentro se pierden 8 tiradas.
        // No se comprueba el porcentaje crudo sino que esta en un rango sensato.
        int encuentros = cuentaEncuentros(120, 20260919L);

        assertTrue(encuentros > 500, "Demasiado pocos encuentros: " + encuentros);
        assertTrue(encuentros < 1_400, "Demasiados encuentros: " + encuentros);
    }

    @Test
    void probabilidadCeroNoDisparaNunca()
    {
        assertEquals(0, cuentaEncuentros(0, 7L));
    }

    @Test
    void probabilidadMilDisparaEnCuantoPuede()
    {
        // 1000 por mil es certeza: encuentro, ocho pasos de enfriamiento, encuentro.
        int encuentros = cuentaEncuentros(1000, 3L);

        assertTrue(encuentros >= PASOS / (TiradaEncuentro.ENFRIAMIENTO_PASOS + 1) - 1,
                "Con certeza deberia disparar cada nueve pasos: " + encuentros);
    }

    @Test
    void elEnfriamientoPorPasosBloqueaLosSiguientes()
    {
        RngCombate rng = new RngCombate(1L);
        TiradaEncuentro.Resultado primero = TiradaEncuentro.paso(
                1000, TiradaEncuentro.inicial(), 0L, rng);

        assertTrue(primero.toca());

        TiradaEncuentro.Estado estado = primero.estado();

        assertEquals(TiradaEncuentro.ENFRIAMIENTO_PASOS, estado.pasosEnfriamiento());

        for(int i = 0; i < TiradaEncuentro.ENFRIAMIENTO_PASOS; i++)
        {
            TiradaEncuentro.Resultado siguiente = TiradaEncuentro.paso(
                    1000, estado, TiradaEncuentro.ENFRIAMIENTO_MS * 10L, rng);

            assertFalse(siguiente.toca(), "El paso " + i + " no deberia disparar");

            estado = siguiente.estado();
        }

        assertTrue(TiradaEncuentro.paso(1000, estado, TiradaEncuentro.ENFRIAMIENTO_MS * 20L, rng).toca(),
                "Pasado el enfriamiento vuelve a disparar");
    }

    @Test
    void elEnfriamientoPorTiempoBloqueaAunqueSobrenPasos()
    {
        RngCombate rng = new RngCombate(1L);
        TiradaEncuentro.Estado estado = TiradaEncuentro.paso(
                1000, TiradaEncuentro.inicial(), 1_000L, rng).estado();

        // Se agotan los pasos de enfriamiento pero sin dejar pasar el tiempo.
        for(int i = 0; i < TiradaEncuentro.ENFRIAMIENTO_PASOS; i++)
        {
            estado = TiradaEncuentro.paso(1000, estado, 1_001L, rng).estado();
        }

        assertFalse(TiradaEncuentro.paso(1000, estado, 1_002L, rng).toca(),
                "El reloj todavia no ha pasado");
        assertTrue(TiradaEncuentro.paso(1000, estado, 1_000L + TiradaEncuentro.ENFRIAMIENTO_MS + 1, rng).toca());
    }

    @Test
    void elSilenciadoGanaAlEnfriamiento()
    {
        RngCombate rng = new RngCombate(1L);
        TiradaEncuentro.Estado estado = TiradaEncuentro.silenciar(TiradaEncuentro.inicial(), 3);

        for(int i = 0; i < 3; i++)
        {
            TiradaEncuentro.Resultado resultado = TiradaEncuentro.paso(1000, estado, i * 10_000L, rng);

            assertFalse(resultado.toca(), "Silenciado no puede disparar");

            estado = resultado.estado();
        }

        assertTrue(TiradaEncuentro.paso(1000, estado, 100_000L, rng).toca(),
                "Agotado el silenciado, vuelve a disparar");
    }

    @Test
    void laMismaSemillaDaLaMismaSecuencia()
    {
        assertEquals(cuentaEncuentros(120, 42L), cuentaEncuentros(120, 42L));
    }
}
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -o -f Desarrollo/PokemonEngine/pom.xml test -Dtest=TiradaEncuentroTest`
Expected: error de compilación, `cannot find symbol: class TiradaEncuentro`.

- [ ] **Step 3: Escribir la implementación**

```java
package com.retro.pokemonengine.encuentros;

import com.retro.pokemonengine.combate.RngCombate;

/**
 * Decide si un paso produce un encuentro.
 *
 * No sabe de zonas, de salas ni de jugadores: recibe la probabilidad y el estado
 * de ese jugador y devuelve el estado nuevo. Asi se puede probar con diez mil
 * pasos seguidos sin levantar el emulador.
 */
public final class TiradaEncuentro
{
    /** Pasos sin tirar despues de un encuentro. */
    public static final int ENFRIAMIENTO_PASOS = 8;

    /** Milisegundos sin tirar despues de un encuentro, ademas de los pasos. */
    public static final long ENFRIAMIENTO_MS = 5000L;

    private TiradaEncuentro()
    {
    }

    public record Estado(int pasosEnfriamiento, long esperaHastaMs, int pasosSilenciados)
    {
    }

    public record Resultado(boolean toca, Estado estado)
    {
    }

    public static Estado inicial()
    {
        return new Estado(0, 0L, 0);
    }

    /** Rellena el contador del Repelente. Sustituye al que hubiera, no suma. */
    public static Estado silenciar(Estado estado, int pasos)
    {
        Estado actual = estado == null ? inicial() : estado;

        return new Estado(actual.pasosEnfriamiento(), actual.esperaHastaMs(), Math.max(0, pasos));
    }

    public static Resultado paso(int porMil, Estado estado, long ahoraMs, RngCombate rng)
    {
        Estado actual = estado == null ? inicial() : estado;

        int silenciados = Math.max(0, actual.pasosSilenciados());
        int enfriamiento = Math.max(0, actual.pasosEnfriamiento());

        // El silenciado se gasta aunque no se tire: el Repelente cuenta pasos,
        // no encuentros evitados.
        if(silenciados > 0)
        {
            return new Resultado(false,
                    new Estado(Math.max(0, enfriamiento - 1), actual.esperaHastaMs(), silenciados - 1));
        }

        if(enfriamiento > 0)
        {
            return new Resultado(false,
                    new Estado(enfriamiento - 1, actual.esperaHastaMs(), 0));
        }

        if(ahoraMs < actual.esperaHastaMs())
        {
            return new Resultado(false, new Estado(0, actual.esperaHastaMs(), 0));
        }

        if(porMil <= 0 || rng.entre(1, 1000) > porMil)
        {
            return new Resultado(false, new Estado(0, actual.esperaHastaMs(), 0));
        }

        return new Resultado(true,
                new Estado(ENFRIAMIENTO_PASOS, ahoraMs + ENFRIAMIENTO_MS, 0));
    }
}
```

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -o -f Desarrollo/PokemonEngine/pom.xml test -Dtest=TiradaEncuentroTest`
Expected: `Tests run: 7, Failures: 0`.

- [ ] **Step 5: Comprobar la pureza**

Run: `grep -rn "com.eu.habbo" Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/encuentros/`
Expected: sin resultados.

- [ ] **Step 6: Commit**

```bash
git add Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/encuentros/TiradaEncuentro.java Desarrollo/PokemonEngine/src/test/java/com/retro/pokemonengine/encuentros/TiradaEncuentroTest.java
git commit -m "feat(pokemon): decide encounters per step, with cooldown and repel"
```

---

### Task 3: Clima y RuletaClima

**Ficheros:**
- Crear: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/clima/Clima.java`
- Crear: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/clima/RuletaClima.java`
- Test: `Desarrollo/PokemonEngine/src/test/java/com/retro/pokemonengine/clima/RuletaClimaTest.java`

**Interfaces:**
- Consume: `RngCombate`, y las constantes de `com.retro.pokemonengine.combate.Campo` (`SOL`, `LLUVIA`, `TORMENTA_ARENA`, `NIEVE`) y `EstadoCombate.SIN_CLIMA`.
- Produce:
  - `Clima` enum: `DESPEJADO`, `SOL`, `LLUVIA`, `TORMENTA_ARENA`, `NIEVE`, `GRANIZO`, con `porNombre(String)`, `aCampo()` y `nombreEs()`
  - `RuletaClima.Peso(Clima clima, int peso)`
  - `RuletaClima.sortear(List<Peso>, RngCombate)` → `Clima`, `DESPEJADO` si la lista esta vacia o todos los pesos son cero

- [ ] **Step 1: Escribir la prueba que falla**

```java
package com.retro.pokemonengine.clima;

import com.retro.pokemonengine.combate.EstadoCombate;
import com.retro.pokemonengine.combate.RngCombate;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

class RuletaClimaTest
{
    private static final int TIRADAS = 10_000;

    private final List<RuletaClima.Peso> rutaUno = List.of(
            new RuletaClima.Peso(Clima.DESPEJADO, 70),
            new RuletaClima.Peso(Clima.LLUVIA, 20),
            new RuletaClima.Peso(Clima.SOL, 8),
            new RuletaClima.Peso(Clima.TORMENTA_ARENA, 2));

    private Map<Clima, Integer> reparto(List<RuletaClima.Peso> pesos, long semilla)
    {
        RngCombate rng = new RngCombate(semilla);
        Map<Clima, Integer> cuenta = new HashMap<>();

        for(int i = 0; i < TIRADAS; i++)
        {
            cuenta.merge(RuletaClima.sortear(pesos, rng), 1, Integer::sum);
        }

        return cuenta;
    }

    @Test
    void cadaClimaSaleEnProporcionASuPeso()
    {
        Map<Clima, Integer> cuenta = reparto(rutaUno, 20260919L);

        for(RuletaClima.Peso peso : rutaUno)
        {
            double porcentaje = (cuenta.getOrDefault(peso.clima(), 0) * 100.0) / TIRADAS;

            org.junit.jupiter.api.Assertions.assertTrue(Math.abs(porcentaje - peso.peso()) <= 3.0,
                    peso.clima() + " sale un " + porcentaje + "% y su peso es " + peso.peso());
        }
    }

    @Test
    void sinPesosSiempreEstaDespejado()
    {
        assertEquals(Clima.DESPEJADO, RuletaClima.sortear(List.of(), new RngCombate(1L)));
        assertEquals(Clima.DESPEJADO, RuletaClima.sortear(null, new RngCombate(1L)));
    }

    @Test
    void todosLosPesosACeroDejanDespejado()
    {
        List<RuletaClima.Peso> pesos = List.of(
                new RuletaClima.Peso(Clima.LLUVIA, 0),
                new RuletaClima.Peso(Clima.NIEVE, 0));

        assertEquals(Clima.DESPEJADO, RuletaClima.sortear(pesos, new RngCombate(1L)));
    }

    @Test
    void unPesoACeroNuncaSale()
    {
        List<RuletaClima.Peso> pesos = List.of(
                new RuletaClima.Peso(Clima.DESPEJADO, 100),
                new RuletaClima.Peso(Clima.NIEVE, 0));

        assertEquals(0, reparto(pesos, 5L).getOrDefault(Clima.NIEVE, 0));
    }

    @Test
    void laMismaSemillaDaLaMismaSecuencia()
    {
        assertEquals(reparto(rutaUno, 42L), reparto(rutaUno, 42L));
    }

    @Test
    void elClimaSeTraduceAlMotorDeCombate()
    {
        assertEquals(EstadoCombate.SIN_CLIMA, Clima.DESPEJADO.aCampo());
        assertEquals("raindance", Clima.LLUVIA.aCampo());
        assertEquals("sunnyday", Clima.SOL.aCampo());
        assertEquals("sandstorm", Clima.TORMENTA_ARENA.aCampo());
        assertEquals("snowscape", Clima.NIEVE.aCampo());
        assertEquals("hail", Clima.GRANIZO.aCampo());
        assertEquals("Granizo", Clima.GRANIZO.nombreEs());
        assertEquals("Nieve", Clima.NIEVE.nombreEs());
        assertNotEquals(Clima.DESPEJADO, Clima.porNombre("LLUVIA"));
        assertEquals(Clima.DESPEJADO, Clima.porNombre("no-existe"));
        assertEquals(Clima.DESPEJADO, Clima.porNombre(null));
    }
}
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -o -f Desarrollo/PokemonEngine/pom.xml test -Dtest=RuletaClimaTest`
Expected: error de compilación, `package com.retro.pokemonengine.clima does not exist`.

- [ ] **Step 3: Escribir el enum**

```java
package com.retro.pokemonengine.clima;

import com.retro.pokemonengine.combate.Campo;
import com.retro.pokemonengine.combate.EstadoCombate;

/**
 * El tiempo que hace en una zona.
 *
 * Los nombres son los del motor de combate, sin sinonimos: NIEVE y no GRANIZO,
 * porque el motor usa `snowscape`. Asi el clima del mundo entra en el combate
 * sin tabla de traduccion que se pueda desincronizar.
 */
public enum Clima
{
    DESPEJADO(EstadoCombate.SIN_CLIMA, "Despejado"),
    SOL(Campo.SOL, "Sol"),
    LLUVIA(Campo.LLUVIA, "Lluvia"),
    TORMENTA_ARENA(Campo.TORMENTA_ARENA, "Tormenta de arena"),
    NIEVE(Campo.NIEVE, "Nieve"),
    GRANIZO(Campo.GRANIZO, "Granizo");

    private final String enCampo;
    private final String nombreEs;

    Clima(String enCampo, String nombreEs)
    {
        this.enCampo = enCampo;
        this.nombreEs = nombreEs;
    }

    public String aCampo()
    {
        return this.enCampo;
    }

    /** El nombre que ve el jugador, con el nombre del juego en espanol. */
    public String nombreEs()
    {
        return this.nombreEs;
    }

    public static Clima porNombre(String nombre)
    {
        if(nombre != null)
        {
            for(Clima clima : values())
            {
                if(clima.name().equalsIgnoreCase(nombre)) return clima;
            }
        }

        return DESPEJADO;
    }
}
```

- [ ] **Step 4: Escribir la ruleta**

```java
package com.retro.pokemonengine.clima;

import com.retro.pokemonengine.combate.RngCombate;

import java.util.List;

/**
 * Sorteo del clima por pesos, igual que la tabla de encuentros.
 *
 * Una zona sin pesos esta siempre despejada: es lo que resuelve las cuevas y
 * los interiores sin necesidad de codigo especial.
 */
public final class RuletaClima
{
    private RuletaClima()
    {
    }

    public record Peso(Clima clima, int peso)
    {
    }

    public static Clima sortear(List<Peso> pesos, RngCombate rng)
    {
        if(pesos == null || pesos.isEmpty()) return Clima.DESPEJADO;

        int total = 0;

        for(Peso peso : pesos)
        {
            if(peso != null && peso.peso() > 0) total += peso.peso();
        }

        if(total <= 0) return Clima.DESPEJADO;

        int tirada = rng.entre(1, total);
        int acumulado = 0;

        for(Peso peso : pesos)
        {
            if(peso == null || peso.peso() <= 0) continue;

            acumulado += peso.peso();

            if(tirada <= acumulado) return peso.clima();
        }

        return Clima.DESPEJADO;
    }
}
```

- [ ] **Step 5: Ejecutar y ver que pasa**

Run: `"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -o -f Desarrollo/PokemonEngine/pom.xml test -Dtest=RuletaClimaTest`
Expected: `Tests run: 6, Failures: 0`.

Si `EstadoCombate.SIN_CLIMA` no fuera accesible, comprueba su nombre exacto con:
`grep -n "SIN_CLIMA" Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/combate/EstadoCombate.java`

- [ ] **Step 6: Comprobar la pureza y commit**

```bash
grep -rn "com.eu.habbo" Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/clima/
git add Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/clima/ Desarrollo/PokemonEngine/src/test/java/com/retro/pokemonengine/clima/
git commit -m "feat(pokemon): roll zone weather with the engine's own names"
```

---

### Task 4: La franja en Europe/Madrid

**Ficheros:**
- Modificar: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/ServicioEncuentros.java:129` (método `franjaActual`)
- Test: `Desarrollo/PokemonEngine/src/test/java/com/retro/pokemonengine/encuentros/TablaEncuentrosTest.java` (ampliar)

**Interfaces:**
- Produce: `ServicioEncuentros.franjaActual()` deja de depender de la zona horaria de la máquina.

- [ ] **Step 1: Ampliar la prueba de franja**

Añade a `TablaEncuentrosTest`:

```java
    @Test
    void laFranjaSaleDeUnaHoraDada()
    {
        // La hora la aporta quien llama: asi la tabla se prueba sin depender
        // del reloj de la maquina ni de la zona horaria.
        assertEquals(Franja.NOCHE, Franja.deHora(2));
        assertEquals(Franja.MANANA, Franja.deHora(7));
        assertEquals(Franja.DIA, Franja.deHora(14));
        assertEquals(Franja.TARDE, Franja.deHora(19));
    }
```

- [ ] **Step 2: Cambiar el origen de la hora**

En `ServicioEncuentros.java`, sustituye:

```java
    public static Franja franjaActual()
    {
        return Franja.deHora(LocalTime.now().getHour());
    }
```

por:

```java
    /** La hora del hotel es la de Espana, clavada: mudar de servidor no debe mover el ciclo dia/noche. */
    public static final ZoneId ZONA_HORARIA = ZoneId.of("Europe/Madrid");

    public static Franja franjaActual()
    {
        return Franja.deHora(ZonedDateTime.now(ZONA_HORARIA).getHour());
    }
```

Cambia el import `java.time.LocalTime` por `java.time.ZoneId` y `java.time.ZonedDateTime`.

- [ ] **Step 3: Ejecutar**

Run: `"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -o -f Desarrollo/PokemonEngine/pom.xml test -Dtest=TablaEncuentrosTest`
Expected: `Tests run: 13, Failures: 0`.

- [ ] **Step 4: Commit**

```bash
git add Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/ServicioEncuentros.java Desarrollo/PokemonEngine/src/test/java/com/retro/pokemonengine/encuentros/TablaEncuentrosTest.java
git commit -m "fix(pokemon): pin the day/night cycle to Madrid time"
```

---

### Task 5: Encuentros condicionados por clima

**Ficheros:**
- Modificar: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/encuentros/Encuentro.java`
- Modificar: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/encuentros/TablaEncuentros.java`
- Modificar: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/ServicioEncuentros.java` (lectura de la columna `clima`)
- Test: `Desarrollo/PokemonEngine/src/test/java/com/retro/pokemonengine/encuentros/TablaEncuentrosTest.java`

**Interfaces:**
- Produce:
  - `Encuentro` gana un parámetro `Clima clima` al final del constructor largo y el accesor `clima()`; `Encuentro.de(...)` sigue existiendo y lo deja a `null`
  - `Encuentro.apareceEn(MetodoEncuentro, Franja, Clima)`
  - `TablaEncuentros.disponibles(List<Encuentro>, MetodoEncuentro, Franja, Clima)`

**Cuidado:** `TablaEncuentros.disponibles` con tres argumentos se usa hoy en `ServicioEncuentros.buscar`. Cambia también esa llamada.

- [ ] **Step 1: Escribir las pruebas que fallan**

Añade a `TablaEncuentrosTest`:

```java
    @Test
    void soloEntranLosEncuentrosDelClimaActual()
    {
        List<Encuentro> tabla = List.of(
                new Encuentro(16, 0, 2, 4, 70, MetodoEncuentro.HIERBA, null, null),
                new Encuentro(60, 0, 3, 5, 30, MetodoEncuentro.HIERBA, null, Clima.LLUVIA));

        List<Encuentro> conSol = TablaEncuentros.disponibles(
                tabla, MetodoEncuentro.HIERBA, Franja.DIA, Clima.SOL);

        assertEquals(1, conSol.size(), "Poliwag solo sale con lluvia");
        assertEquals(16, conSol.get(0).especieId());

        List<Encuentro> conLluvia = TablaEncuentros.disponibles(
                tabla, MetodoEncuentro.HIERBA, Franja.DIA, Clima.LLUVIA);

        assertEquals(2, conLluvia.size(), "El que no pide clima sale con cualquiera");
    }

    @Test
    void unEncuentroPuedePedirFranjaYClimaALaVez()
    {
        Encuentro exigente = new Encuentro(
                37, 0, 5, 7, 10, MetodoEncuentro.HIERBA, Franja.NOCHE, Clima.SOL);

        assertTrue(exigente.apareceEn(MetodoEncuentro.HIERBA, Franja.NOCHE, Clima.SOL));
        assertFalse(exigente.apareceEn(MetodoEncuentro.HIERBA, Franja.DIA, Clima.SOL));
        assertFalse(exigente.apareceEn(MetodoEncuentro.HIERBA, Franja.NOCHE, Clima.LLUVIA));
    }
```

Añade el import `com.retro.pokemonengine.clima.Clima` al test.

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -o -f Desarrollo/PokemonEngine/pom.xml test -Dtest=TablaEncuentrosTest`
Expected: error de compilación, constructor de `Encuentro` con 8 argumentos no encontrado.

- [ ] **Step 3: Ampliar `Encuentro`**

Añade el campo, el parámetro final del constructor y el accesor, y sustituye `apareceEn`:

```java
    public boolean apareceEn(MetodoEncuentro metodo, Franja franja, Clima clima)
    {
        if(metodo != null && this.metodo != metodo) return false;

        if(this.franja != null && franja != null && this.franja != franja) return false;

        // Sin clima exigido, aparece con cualquiera. Con clima exigido y sin
        // clima conocido, se deja pasar: es preferible un encuentro de mas que
        // que una zona sin estado de clima se quede muda.
        return this.clima == null || clima == null || this.clima == clima;
    }
```

En `Encuentro.de(...)`, pasa `null` como clima.

- [ ] **Step 4: Ampliar `TablaEncuentros.disponibles`**

```java
    public static List<Encuentro> disponibles(List<Encuentro> encuentros, MetodoEncuentro metodo,
                                              Franja franja, Clima clima)
    {
        List<Encuentro> resultado = new ArrayList<>();

        if(encuentros == null) return resultado;

        for(Encuentro encuentro : encuentros)
        {
            if(encuentro != null && encuentro.apareceEn(metodo, franja, clima)) resultado.add(encuentro);
        }

        return resultado;
    }
```

- [ ] **Step 5: Leer la columna en `ServicioEncuentros.cargar`**

Añade `clima` al `SELECT` y al constructor:

```java
                    "SELECT zone_id, species_id, form_id, nivel_min, nivel_max, peso, metodo, franja, clima" +
                    " FROM pokemon_zone_encounters ORDER BY zone_id, id"
```

```java
                                Franja.porNombre(r.getString("franja")),
                                Clima.porNombre(r.getString("clima"))
```

**Ojo:** `Clima.porNombre(null)` devuelve `DESPEJADO`, no `null`, y aquí hace falta `null` para decir "cualquier clima". Usa:

```java
                                r.getString("clima") == null
                                        ? null
                                        : Clima.porNombre(r.getString("clima"))
```

- [ ] **Step 6: Ejecutar la suite entera**

Run: `"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -o -f Desarrollo/PokemonEngine/pom.xml test`
Expected: `BUILD SUCCESS`, con las dos pruebas nuevas y sin romper `ServicioEncuentros`.

- [ ] **Step 7: Commit**

```bash
git add Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/encuentros/ Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/ServicioEncuentros.java Desarrollo/PokemonEngine/src/test/java/com/retro/pokemonengine/encuentros/TablaEncuentrosTest.java
git commit -m "feat(pokemon): let an encounter ask for a given weather"
```

---

### Task 6: ServicioClima

**Ficheros:**
- Crear: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/ServicioClima.java`
- Modificar: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/PokemonEnginePlugin.java`

**Interfaces:**
- Consume: `RuletaClima.sortear`, `Clima`, `ServicioZonas.zona(int)`, `PokemonPackets.resultado(int, boolean, String)`.
- Produce:
  - `ServicioClima.cargar()` — lee pesos y estado al arrancar
  - `ServicioClima.clima(int zonaId)` → `Clima`, nunca `null`
  - `ServicioClima.hasta(int zonaId)` → `long` epoch ms, 0 si no hay estado
  - `ServicioClima.iniciar()` — arranca el latido de un minuto
  - `ServicioClima.parar()`
  - Constante `VENTANA_MS = 4 * 60 * 60 * 1000L`

- [ ] **Step 1: Escribir el servicio**

Sigue el patrón de `ServicioSeguidor` para el latido (`Emulator.getThreading().run(...)` o un `ScheduledExecutorService` propio; mira cómo lo hace hoy `ServicioSeguidor.iniciar()` y **usa el mismo mecanismo**).

Estructura:

```java
public final class ServicioClima
{
    public static final long VENTANA_MS = 4L * 60L * 60L * 1000L;

    private static Map<Integer, List<RuletaClima.Peso>> pesos = Collections.emptyMap();
    private static final Map<Integer, Clima> ACTUAL = new ConcurrentHashMap<>();
    private static final Map<Integer, Long> HASTA = new ConcurrentHashMap<>();

    public static void cargar() throws Exception { /* pesos + estado */ }

    public static Clima clima(int zonaId)
    {
        return ACTUAL.getOrDefault(zonaId, Clima.DESPEJADO);
    }

    public static long hasta(int zonaId)
    {
        return HASTA.getOrDefault(zonaId, 0L);
    }

    /** Sortea las zonas con la ventana vencida. Devuelve las que han cambiado. */
    public static List<Integer> repasar() { /* ... */ }
}
```

Reglas que no se pueden saltar:

- Una zona sin filas en `pokemon_zone_weather` queda en `DESPEJADO` y **no se sortea nunca**: no se le escribe estado.
- Al arrancar, si `hasta` ya pasó, se sortea de nuevo; **no se compensan ventanas perdidas** aunque el emulador estuviera caído dos días.
- El sorteo escribe `pokemon_zone_weather_state` con `INSERT ... ON DUPLICATE KEY UPDATE`.
- La semilla del `RngCombate` para sortear: `System.nanoTime() ^ ((long) zonaId << 24)`.

- [ ] **Step 2: Avisar a quien esté en la zona**

Cuando `repasar()` devuelva zonas cambiadas, por cada sala de esa zona (`ServicioZonas` sabe qué salas hay) se manda un `ZONA_INFO` no solicitado con el cuerpo que ya construye `AccionesMundo`. Para no duplicar el cuerpo, extrae el mapa de `AccionesMundo.zonaInfo` a un método estático reutilizable:

```java
public static Map<String, Object> cuerpoZona(int roomId)
```

y llámalo desde las dos partes.

El envío usa `room.sendComposer(PokemonPackets.resultado(PokemonAcciones.ZONA_INFO, true, PokemonCuerpo.datos(cuerpo)).compose())`, igual que hace `ServicioSeguidor` al difundir a la sala.

- [ ] **Step 3: Arrancar el servicio**

En `PokemonEnginePlugin.onEmulatorLoaded`, detrás de `ServicioTienda.cargar();`:

```java
        ServicioClima.cargar();
        ServicioClima.iniciar();
```

Y en `onDisable()`, `ServicioClima.parar();`.

- [ ] **Step 4: Compilar y desplegar**

Run: `"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -o -f Desarrollo/PokemonEngine/pom.xml package`
Despliega y arranca el runtime como en la tarea 1.
Expected en el log: `[PokemonEngine] Clima: N zonas con pesos.` y, a la primera vuelta del latido, una línea por zona sorteada.

- [ ] **Step 5: Comprobar que sobrevive al reinicio**

```bash
/c/Users/erale/Desktop/Habbo/xampp/mysql/bin/mysql.exe -u root --protocol=tcp habbo_pokemon_test_20260918 -e "SELECT * FROM pokemon_zone_weather_state;"
```

Anota el clima de la Ruta 1, reinicia el emulador y vuelve a consultar.
Expected: el mismo clima, con la misma fecha `hasta`.

- [ ] **Step 6: Commit**

```bash
git add Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/ServicioClima.java Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/PokemonEnginePlugin.java Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/AccionesMundo.java
git commit -m "feat(pokemon): give every zone its own weather, rolled every four hours"
```

---

### Task 7: El disparador de encuentros

**Ficheros:**
- Crear: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/ServicioFurniEncuentro.java`
- Crear: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/DisparadorEncuentros.java`
- Modificar: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/ServicioEncuentros.java`
- Modificar: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/PokemonEnginePlugin.java`

**Interfaces:**
- Consume: `Room.getItemsAt(int, int)` → `THashSet<HabboItem>`; `HabboItem.getBaseItem()` → `Item`; `Item.getSpriteId()`; `UserTakeStepEvent.toLocation` (`RoomTile` con `x` e `y` públicos, `short`).
- Produce:
  - `ServicioFurniEncuentro.cargar()`, `ServicioFurniEncuentro.metodo(int spriteId)` → `MetodoEncuentro` o `null`, `ServicioFurniEncuentro.total()`
  - `ServicioEncuentros.porMil(int zonaId, MetodoEncuentro)` → `int`
  - `ServicioEncuentros.estadoTirada(int userId)` / `ponerEstadoTirada(int, TiradaEncuentro.Estado)` / `silenciar(int userId, int pasos)`
  - `DisparadorEncuentros.alPaso(Habbo, RoomTile)`

- [ ] **Step 1: Catálogo de furnis**

`ServicioFurniEncuentro` es gemelo de `ServicioObjetos`: un `Map<Integer, MetodoEncuentro>` inmutable cargado al arrancar desde `pokemon_encounter_furni` con `activo = 1`, y una línea de log con el total.

- [ ] **Step 2: Probabilidad y estado por jugador en `ServicioEncuentros`**

Añade un `Map<Integer, Integer>` de probabilidades cargado desde `pokemon_zone_encounter_rates` (clave compuesta `zonaId * 100 + metodo.ordinal()` o un `Map<Integer, Map<MetodoEncuentro, Integer>>`, lo que quede más claro), y un `ConcurrentHashMap<Integer, TiradaEncuentro.Estado>` para el estado por jugador, que se limpia en `limpiar(userId)`.

- [ ] **Step 3: El disparador**

```java
public final class DisparadorEncuentros
{
    private DisparadorEncuentros()
    {
    }

    public static void alPaso(Habbo habbo, RoomTile hacia)
    {
        if(habbo == null || hacia == null) return;

        Room room = habbo.getHabboInfo().getCurrentRoom();

        if(room == null) return;

        // Primera llave, y la mas barata: si la sala no es Pokemon no se hace nada mas.
        Integer zonaId = ServicioZonas.zonaDeSala(room.getId());

        if(zonaId == null) return;

        // Segunda llave: que haya un furni disparador en la baldosa de destino.
        MetodoEncuentro metodo = metodoEn(room, hacia);

        if(metodo == null) return;

        int userId = habbo.getHabboInfo().getId();

        // Ya hay un encuentro en curso: no se encadenan.
        if(ServicioEncuentros.activo(userId) != null) return;

        int porMil = ServicioEncuentros.porMil(zonaId, metodo);

        TiradaEncuentro.Resultado resultado = TiradaEncuentro.paso(
                porMil,
                ServicioEncuentros.estadoTirada(userId),
                System.currentTimeMillis(),
                new RngCombate(System.nanoTime() ^ ((long) userId << 16)));

        ServicioEncuentros.ponerEstadoTirada(userId, resultado.estado());

        if(!resultado.toca()) return;

        // De aqui en adelante, lo mismo que hace hoy la accion 60.
    }

    private static MetodoEncuentro metodoEn(Room room, RoomTile baldosa)
    {
        for(HabboItem item : room.getItemsAt(baldosa.x, baldosa.y))
        {
            if(item == null || item.getBaseItem() == null) continue;

            MetodoEncuentro metodo = ServicioFurniEncuentro.metodo(item.getBaseItem().getSpriteId());

            if(metodo != null) return metodo;
        }

        return null;
    }
}
```

El cuerpo del encuentro (generar el salvaje, registrar el visto, empujar al cliente) **se reutiliza**: extrae de `AccionesMundo.buscarEncuentro` un método estático que reciba `userId`, `zonaId`, `roomId` y `metodo` y devuelva el mapa del cuerpo, y llámalo desde las dos partes. El empujón es `habbo.getClient().sendResponse(PokemonPackets.resultado(PokemonAcciones.ENCUENTRO_BUSCAR, true, cuerpo))`.

- [ ] **Step 4: Engancharlo, después del seguidor**

En `PokemonEnginePlugin.onUserTakeStep`, **detrás** de la línea del seguidor:

```java
        ServicioSeguidor.alPaso(event.habbo, event.fromLocation, event.toLocation);
        DisparadorEncuentros.alPaso(event.habbo, event.toLocation);
```

Y en `onEmulatorLoaded`, `ServicioFurniEncuentro.cargar();` junto al resto de catálogos.

- [ ] **Step 5: Dar de alta el furni de hierba**

Pregunta al propietario qué furni quiere usar. Con el nombre, saca su sprite:

```bash
/c/Users/erale/Desktop/Habbo/xampp/mysql/bin/mysql.exe -u root --protocol=tcp habbo_pokemon_test_20260918 -e "SELECT id, sprite_id, item_name, public_name FROM items_base WHERE item_name LIKE '%<nombre>%';"
```

```sql
INSERT INTO pokemon_encounter_furni (sprite_id, metodo, nota)
VALUES (<sprite>, 'HIERBA', '<nombre del furni>');
```

Reinicia el emulador para que entre en memoria.

- [ ] **Step 6: Probar a mano**

Coloca ese furni en varias baldosas de la sala 203, entra y camina por encima.
Expected: al cabo de unos pasos, en la consola del navegador aparece `[PokemonEngine] resultado {action: 60, ...}` sin haber pedido nada.

Luego comprueba las dos llaves:
1. Camina por baldosas sin el furni → no salta nunca.
2. Pon el mismo furni en una sala **sin** fila en `pokemon_zone_rooms` → no salta nunca.
3. Encadena: tras un encuentro, los ocho pasos siguientes no disparan.

- [ ] **Step 7: Commit**

```bash
git add Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/
git commit -m "feat(pokemon): make tall grass spawn Pokemon when you walk on it"
```

---

### Task 8: Restringir la acción 60 a rango 7

**Ficheros:**
- Modificar: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/AccionesMundo.java`

**Interfaces:**
- Consume: `habbo.getHabboInfo().getRank().getId()` (comprueba el nombre exacto con `javap -classpath Emulator/extracted_jar com.eu.habbo.habbohotel.users.HabboInfo | grep -i rank`).
- Produce: `ENCUENTRO_BUSCAR` responde `SIN_PERMISO` a quien no sea rango 7.

- [ ] **Step 1: Añadir la comprobación**

```java
    private static final int RANGO_STAFF = 7;

    private static Respuesta buscarEncuentro(Habbo habbo, int userId, JsonObject datos) throws Exception
    {
        // Pedir un encuentro a mano es herramienta de pruebas: mientras se pueda,
        // la hierba es decorativa. Rango 7 y no 6, porque los co-administradores
        // son jugadores y deben poder jugar sin ese boton.
        if(habbo.getHabboInfo().getRank().getId() < RANGO_STAFF)
        {
            return Respuesta.mal("SIN_PERMISO", "Camina por la hierba");
        }

        ...
    }
```

- [ ] **Step 2: Probar a mano**

Con la cuenta de rango 7: `PokemonEngine.enviar(60)` responde con el encuentro.
Con una cuenta de rango 1: responde `success: false`, `code: "SIN_PERMISO"`.

- [ ] **Step 3: Commit**

```bash
git add Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/AccionesMundo.java
git commit -m "feat(pokemon): keep the manual encounter button for the owner only"
```

---

### Task 9: El clima en ZONA_INFO

**Ficheros:**
- Modificar: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/AccionesMundo.java`

**Interfaces:**
- Consume: `ServicioClima.clima(int)`, `ServicioClima.hasta(int)`, `ServicioEncuentros.franjaActual()`.
- Produce: el cuerpo de `ZONA_INFO` gana `clima`, `climaHasta` y `metodos`.

- [ ] **Step 1: Ampliar el cuerpo**

En el método extraído en la tarea 6 (`cuerpoZona`):

```java
        salida.put("clima", ServicioClima.clima(zonaId).name());
        salida.put("climaNombre", ServicioClima.clima(zonaId).nombreEs());
        salida.put("climaHasta", ServicioClima.hasta(zonaId));
        salida.put("metodos", ServicioEncuentros.metodosDe(zonaId));
```

`metodosDe` devuelve la lista de métodos con probabilidad mayor que cero en esa zona, para que el cliente sepa si tiene sentido enseñar una caña o una tabla de surf.

- [ ] **Step 2: Probar a mano**

`PokemonEngine.enviar(7)` en la sala 203.
Expected: el cuerpo incluye `clima`, `climaHasta` y `metodos: ["HIERBA"]`.

- [ ] **Step 3: Commit**

```bash
git add Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/AccionesMundo.java Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/ServicioEncuentros.java
git commit -m "feat(pokemon): report the zone's weather to the client"
```

---

### Task 10: Ampliar el catálogo de especies

**Ficheros:**
- Modificar: `xampp/htdocs/app/Services/Pokemon/MapeadorEspecie.php`
- Modificar: `xampp/htdocs/app/Console/Commands/PokemonImportCatalog.php`
- Test: `xampp/htdocs/tests/Unit/Pokemon/MapeadorEspecieTest.php`

**Interfaces:**
- Produce: `MapeadorEspecie::fila()` devuelve además `descripcion_es`, `categoria_es`, `numero_regional` y `cry_url`.

- [ ] **Step 1: Escribir las pruebas que fallan**

Añade a `MapeadorEspecieTest`:

```php
    public function test_descripcion_categoria_y_numero_regional(): void
    {
        $fila = MapeadorEspecie::fila($this->especie(), $this->pokemon(), $this->tipos);

        $this->assertSame('Pokémon Ratón', $fila['categoria_es']);
        $this->assertStringContainsString('cola', $fila['descripcion_es']);
        $this->assertSame(25, $fila['numero_regional'], 'En Kanto coincide con el nacional');
        $this->assertStringEndsWith('25.ogg', $fila['cry_url']);
    }

    public function test_una_especie_sin_datos_en_espanol_no_revienta(): void
    {
        $especie = $this->especie();
        $especie['genera'] = [];
        $especie['flavor_text_entries'] = [];
        $especie['pokedex_numbers'] = [];

        $fila = MapeadorEspecie::fila($especie, $this->pokemon(), $this->tipos);

        $this->assertNull($fila['categoria_es']);
        $this->assertNull($fila['descripcion_es']);
        $this->assertNull($fila['numero_regional']);
    }
```

Usa los métodos `especie()`/`pokemon()`/`$tipos` que ya existan en ese test; si no existen, léelos de las fixtures `species-25.json` y `pokemon-25.json` igual que hace `MapeadorMovimientoTest`.

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `cd xampp/htdocs && /c/Users/erale/Desktop/Habbo/xampp/php/php.exe vendor/bin/phpunit tests/Unit/Pokemon/MapeadorEspecieTest.php`
Expected: `Undefined array key "categoria_es"`.

- [ ] **Step 3: Implementar**

En `MapeadorEspecie`, añade al array devuelto:

```php
            'descripcion_es' => self::textoEs($especie),
            'categoria_es' => self::categoriaEs($especie),
            'numero_regional' => self::numeroRegional($especie, 'kanto'),
            'cry_url' => $pokemon['cries']['latest'] ?? null,
```

y los helpers:

```php
    private static function categoriaEs(array $especie): ?string
    {
        foreach ($especie['genera'] ?? [] as $entrada) {
            if (($entrada['language']['name'] ?? null) === 'es') {
                return $entrada['genus'];
            }
        }

        return null;
    }

    private static function textoEs(array $especie): ?string
    {
        // Los textos de especie usan `flavor_text`, no `text` como los objetos.
        foreach ($especie['flavor_text_entries'] ?? [] as $entrada) {
            if (($entrada['language']['name'] ?? null) === 'es') {
                return trim(str_replace(["\n", "\f"], ' ', $entrada['flavor_text']));
            }
        }

        return null;
    }

    private static function numeroRegional(array $especie, string $pokedex): ?int
    {
        foreach ($especie['pokedex_numbers'] ?? [] as $entrada) {
            if (($entrada['pokedex']['name'] ?? null) === $pokedex) {
                return (int) $entrada['entry_number'];
            }
        }

        return null;
    }
```

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `cd xampp/htdocs && /c/Users/erale/Desktop/Habbo/xampp/php/php.exe vendor/bin/phpunit tests/Unit/Pokemon/`
Expected: `OK (27 tests, ...)`.

- [ ] **Step 5: Reimportar las especies**

Run: `cd xampp/htdocs && /c/Users/erale/Desktop/Habbo/xampp/php/php.exe artisan pokemon:import-catalog --solo=especies`
Expected: barra al 100% sin errores. Tarda, porque son 1.025 especies (van en caché, así que no vuelve a descargar).

Comprueba:

```bash
/c/Users/erale/Desktop/Habbo/xampp/mysql/bin/mysql.exe -u root --protocol=tcp habbo_pokemon_test_20260918 -e "SELECT id, nombre_es, categoria_es, numero_regional, LEFT(descripcion_es, 40) descripcion FROM pokemon_species WHERE id IN (25, 143);"
```

- [ ] **Step 6: Commit**

```bash
git add xampp/htdocs/app/Services/Pokemon/MapeadorEspecie.php xampp/htdocs/tests/Unit/Pokemon/MapeadorEspecieTest.php
git commit -m "feat(pokemon): import the Pokedex text, genus, regional number and cry"
```

---

### Task 11: EscalaVisual

**Ficheros:**
- Crear: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/entrenador/EscalaVisual.java`
- Test: `Desarrollo/PokemonEngine/src/test/java/com/retro/pokemonengine/entrenador/EscalaVisualTest.java`

**Interfaces:**
- Produce: `EscalaVisual.de(double alturaMetros, String anulacion)` → `String` de entre `pequeno`, `mediano`, `grande`, `muy_grande`.

- [ ] **Step 1: Escribir la prueba que falla**

```java
package com.retro.pokemonengine.entrenador;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class EscalaVisualTest
{
    @Test
    void losCuatroTamanosSalenDeLaAltura()
    {
        assertEquals("pequeno", EscalaVisual.de(0.30, null), "Pichu");
        assertEquals("mediano", EscalaVisual.de(0.40, null), "Pikachu");
        assertEquals("grande", EscalaVisual.de(1.20, null), "Lucario");
        assertEquals("muy_grande", EscalaVisual.de(2.10, null), "Snorlax");
    }

    @Test
    void losBordesCaenDelLadoCorrecto()
    {
        assertEquals("pequeno", EscalaVisual.de(0.34, null));
        assertEquals("mediano", EscalaVisual.de(0.35, null));
        assertEquals("mediano", EscalaVisual.de(0.79, null));
        assertEquals("grande", EscalaVisual.de(0.80, null));
        assertEquals("grande", EscalaVisual.de(1.49, null));
        assertEquals("muy_grande", EscalaVisual.de(1.50, null));
    }

    @Test
    void laAnulacionManualMandaSobreLaAltura()
    {
        // Onix mide 8,8 m y no puede ocupar media sala.
        assertEquals("grande", EscalaVisual.de(8.80, "grande"));
        assertEquals("muy_grande", EscalaVisual.de(8.80, null));
    }

    @Test
    void unaAnulacionInvalidaSeIgnora()
    {
        assertEquals("mediano", EscalaVisual.de(0.40, "gigantesco"));
        assertEquals("mediano", EscalaVisual.de(0.40, ""));
    }

    @Test
    void unaAlturaAusenteCaeEnMediano()
    {
        assertEquals("mediano", EscalaVisual.de(0.0, null));
        assertEquals("mediano", EscalaVisual.de(-1.0, null));
    }
}
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -o -f Desarrollo/PokemonEngine/pom.xml test -Dtest=EscalaVisualTest`
Expected: `cannot find symbol: class EscalaVisual`.

- [ ] **Step 3: Implementar**

```java
package com.retro.pokemonengine.entrenador;

/**
 * El tamano con el que se dibuja un Pokemon.
 *
 * Sale de la altura, que ya esta importada, para no etiquetar 1.025 especies a
 * mano. La anulacion existe porque la altura miente: Onix mide 8,8 metros.
 */
public final class EscalaVisual
{
    public static final String PEQUENO = "pequeno";
    public static final String MEDIANO = "mediano";
    public static final String GRANDE = "grande";
    public static final String MUY_GRANDE = "muy_grande";

    private EscalaVisual()
    {
    }

    public static String de(double alturaMetros, String anulacion)
    {
        if(anulacion != null)
        {
            for(String valida : new String[] { PEQUENO, MEDIANO, GRANDE, MUY_GRANDE })
            {
                if(valida.equalsIgnoreCase(anulacion)) return valida;
            }
        }

        if(alturaMetros <= 0.0) return MEDIANO;
        if(alturaMetros < 0.35) return PEQUENO;
        if(alturaMetros < 0.80) return MEDIANO;
        if(alturaMetros < 1.50) return GRANDE;

        return MUY_GRANDE;
    }
}
```

- [ ] **Step 4: Ejecutar y commit**

Run: `"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -o -f Desarrollo/PokemonEngine/pom.xml test -Dtest=EscalaVisualTest`
Expected: `Tests run: 5, Failures: 0`.

```bash
git add Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/entrenador/EscalaVisual.java Desarrollo/PokemonEngine/src/test/java/com/retro/pokemonengine/entrenador/EscalaVisualTest.java
git commit -m "feat(pokemon): size a Pokemon's sprite from its height"
```

---

### Task 12: Variante, intercambiable y las llaves del intercambio

**Ficheros:**
- Modificar: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/entrenador/PokemonPoseido.java`
- Modificar: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/ServicioEntrenador.java` (`cargarPokemon`, `cargarUno`, `insertar`, `guardar`)
- Crear: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/entrenador/ReglasIntercambio.java`
- Test: `Desarrollo/PokemonEngine/src/test/java/com/retro/pokemonengine/entrenador/ReglasIntercambioTest.java`

**Interfaces:**
- Produce:
  - `PokemonPoseido.variante()` / `ponerVariante(String)`, por defecto `"normal"`
  - `PokemonPoseido.intercambiable()` / `ponerIntercambiable(boolean)`, por defecto `true`
  - `ReglasIntercambio.Requisitos(int dexCapturadosMinimos, int insigniasMinimas)`
  - `ReglasIntercambio.puede(PokemonPoseido, int dexCapturados, int insignias, Requisitos)` → `String` código: `OK`, `NO_INTERCAMBIABLE`, `FALTA_DEX`, `FALTAN_INSIGNIAS`

- [ ] **Step 1: Escribir la prueba que falla**

```java
package com.retro.pokemonengine.entrenador;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ReglasIntercambioTest
{
    private final ReglasIntercambio.Requisitos requisitos = new ReglasIntercambio.Requisitos(5, 0);

    private PokemonPoseido pokemon(boolean intercambiable)
    {
        PokemonPoseido p = new PokemonPoseido();

        p.ponerEspecieId(25);
        p.ponerIntercambiable(intercambiable);

        return p;
    }

    @Test
    void unPokemonMarcadoNoSeIntercambiaNiConTodoCumplido()
    {
        assertEquals(ReglasIntercambio.NO_INTERCAMBIABLE,
                ReglasIntercambio.puede(pokemon(false), 50, 8, requisitos));
    }

    @Test
    void sinLasCapturasMinimasNoSeIntercambia()
    {
        assertEquals(ReglasIntercambio.FALTA_DEX,
                ReglasIntercambio.puede(pokemon(true), 4, 8, requisitos));
    }

    @Test
    void conLasCapturasJustasSiSeIntercambia()
    {
        assertEquals(ReglasIntercambio.OK,
                ReglasIntercambio.puede(pokemon(true), 5, 0, requisitos));
    }

    @Test
    void lasInsigniasSoloFrenanCuandoSeExigen()
    {
        ReglasIntercambio.Requisitos conMedallas = new ReglasIntercambio.Requisitos(5, 3);

        assertEquals(ReglasIntercambio.FALTAN_INSIGNIAS,
                ReglasIntercambio.puede(pokemon(true), 10, 2, conMedallas));
        assertEquals(ReglasIntercambio.OK,
                ReglasIntercambio.puede(pokemon(true), 10, 3, conMedallas));
    }

    @Test
    void porDefectoUnPokemonNaceIntercambiable()
    {
        assertEquals(true, new PokemonPoseido().intercambiable());
        assertEquals("normal", new PokemonPoseido().variante());
    }
}
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -o -f Desarrollo/PokemonEngine/pom.xml test -Dtest=ReglasIntercambioTest`
Expected: `cannot find symbol: method ponerIntercambiable`.

- [ ] **Step 3: Añadir los campos a `PokemonPoseido`**

```java
    private String variante = "normal";
    private boolean intercambiable = true;

    public String variante() { return this.variante; }

    public void ponerVariante(String variante)
    {
        this.variante = (variante == null || variante.isBlank()) ? "normal" : variante;
    }

    public boolean intercambiable() { return this.intercambiable; }
    public void ponerIntercambiable(boolean intercambiable) { this.intercambiable = intercambiable; }
```

- [ ] **Step 4: Escribir las reglas**

```java
package com.retro.pokemonengine.entrenador;

/**
 * Quien puede intercambiar y que.
 *
 * La marca del Pokemon manda sobre todo lo demas: un premio de evento nace
 * intransferible y no hay requisito que lo desbloquee. Es lo que hace inutil
 * reclamarlo con diez cuentas.
 */
public final class ReglasIntercambio
{
    public static final String OK = "OK";
    public static final String NO_INTERCAMBIABLE = "NO_INTERCAMBIABLE";
    public static final String FALTA_DEX = "FALTA_DEX";
    public static final String FALTAN_INSIGNIAS = "FALTAN_INSIGNIAS";

    private ReglasIntercambio()
    {
    }

    /** Las insignias son fase 3: hasta entonces, cero. */
    public record Requisitos(int dexCapturadosMinimos, int insigniasMinimas)
    {
    }

    public static String puede(PokemonPoseido pokemon, int dexCapturados, int insignias,
                               Requisitos requisitos)
    {
        if(pokemon == null || !pokemon.intercambiable()) return NO_INTERCAMBIABLE;

        if(dexCapturados < requisitos.dexCapturadosMinimos()) return FALTA_DEX;

        if(insignias < requisitos.insigniasMinimas()) return FALTAN_INSIGNIAS;

        return OK;
    }
}
```

- [ ] **Step 5: Persistir las dos columnas**

En `ServicioEntrenador`:
- `cargarPokemon` y `cargarUno`: añade `variante, intercambiable` al `SELECT` y al mapeo (`p.ponerVariante(r.getString("variante"))`, `p.ponerIntercambiable(r.getInt("intercambiable") == 1)`).
- `insertar`: añade las dos columnas a la lista y sus dos `?` al `VALUES`, con los valores del objeto.
- `guardar`: añade `variante = ?, intercambiable = ?` al `UPDATE`.

**Cuenta los `?` después de tocarlos.** Un desajuste aquí no falla al compilar, falla en tiempo de ejecución con un índice de parámetro fuera de rango.

- [ ] **Step 6: Ejecutar la suite y probar la ida y vuelta**

Run: `"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -o -f Desarrollo/PokemonEngine/pom.xml test`
Expected: `BUILD SUCCESS`.

Despliega, captura un Pokémon en el runtime y comprueba:

```bash
/c/Users/erale/Desktop/Habbo/xampp/mysql/bin/mysql.exe -u root --protocol=tcp habbo_pokemon_test_20260918 -e "SELECT id, species_id, variante, intercambiable FROM pokemon_owned ORDER BY id DESC LIMIT 3;"
```

Expected: `variante = normal`, `intercambiable = 1`.

- [ ] **Step 7: Commit**

```bash
git add Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/entrenador/ Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/ServicioEntrenador.java Desarrollo/PokemonEngine/src/test/java/com/retro/pokemonengine/entrenador/ReglasIntercambioTest.java
git commit -m "feat(pokemon): mark event Pokemon as untradeable and leave the trade keys ready"
```

---

### Task 13: Tiempo jugado en salas Pokémon

**Ficheros:**
- Crear: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/ServicioTiempoJugado.java`
- Modificar: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/PokemonEnginePlugin.java`

**Interfaces:**
- Produce: `ServicioTiempoJugado.alEntrar(Habbo, Room)`, `alSalir(Habbo)`, y `TOPE_SESION_SEGUNDOS = 4 * 3600`.

- [ ] **Step 1: Escribir el servicio**

Un `ConcurrentHashMap<Integer, Long>` con el instante de entrada. Al salir de una sala **con zona**, se suma el tramo a `pokemon_trainers.jugado_segundos` con un `UPDATE ... SET jugado_segundos = jugado_segundos + ?`, recortando el tramo a `TOPE_SESION_SEGUNDOS` para que una conexión caída no regale ocho horas.

Al entrar en una sala sin zona, se cierra el tramo anterior y no se abre uno nuevo.

- [ ] **Step 2: Engancharlo**

En `onUserEnterRoom` y `onUserExitRoom` de `PokemonEnginePlugin`, junto a las llamadas del seguidor.

- [ ] **Step 3: Probar a mano**

Entra en la sala 203, quédate un minuto, sal.

```bash
/c/Users/erale/Desktop/Habbo/xampp/mysql/bin/mysql.exe -u root --protocol=tcp habbo_pokemon_test_20260918 -e "SELECT user_id, jugado_segundos FROM pokemon_trainers;"
```

Expected: unos 60 segundos, no cero.

Luego entra en una sala **sin** zona y comprueba que no sube.

- [ ] **Step 4: Commit**

```bash
git add Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/ServicioTiempoJugado.java Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/PokemonEnginePlugin.java
git commit -m "feat(pokemon): count the time played inside Pokemon rooms"
```

---

### Task 14: Cierre del hito

- [ ] **Step 1: Suite completa**

```bash
"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -o -f Desarrollo/PokemonEngine/pom.xml test
cd xampp/htdocs && /c/Users/erale/Desktop/Habbo/xampp/php/php.exe vendor/bin/phpunit tests/Unit/Pokemon/
```

Expected: Java en verde con unas 285 pruebas; PHP en verde con 27.

- [ ] **Step 2: Invariante de pureza**

```bash
grep -rn "com.eu.habbo" Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/{combate,entrenador,seguidor,encuentros,captura,tienda,clima}/
```

Expected: solo el comentario de `CatalogoAnimaciones`.

- [ ] **Step 3: Lista de comprobación en sala**

La de la spec §11, los siete puntos, en el runtime aislado.

- [ ] **Step 4: Actualizar el traspaso**

En `docs/POKEMON-TRASPASO.md`: el hito 6a a la tabla de hecho, el recuento de pruebas, el esquema en la versión 7, y en la deuda que los objetos siguen sin efecto y que el Repelente no rellena el silenciado todavía.

- [ ] **Step 5: Commit y push**

```bash
git add docs/POKEMON-TRASPASO.md
git commit -m "docs(pokemon): record milestone 6a"
git push origin codex/pokemon-engine
```

---

## Notas para quien lo ejecute

**El orden importa.** Las tareas 2, 3 y 11 son puras y se pueden hacer en cualquier momento. La 7 depende de la 1, la 2 y la 6. La 9 depende de la 6.

**Lo que más se rompe.** El `SELECT` y el `INSERT` de `ServicioEntrenador` son largos y con parámetros posicionales: añadir dos columnas mal descuadra todo lo demás y el fallo aparece lejos del cambio.

**Lo que no se puede probar solo.** El disparador, el clima y el tiempo jugado necesitan el emulador. Reserva tiempo para la lista de comprobación manual y no la des por hecha.
