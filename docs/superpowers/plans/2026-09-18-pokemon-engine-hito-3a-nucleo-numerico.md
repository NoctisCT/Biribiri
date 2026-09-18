# PokemonEngine — Hito 3a: núcleo numérico del combate

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tener en el plugin el catálogo cargado en memoria y las tres piezas numéricas puras del combate —cálculo de stats, tabla de tipos y fórmula de daño— con pruebas contra valores conocidos de los juegos.

**Architecture:** Cuatro clases Java sin estado compartido ni acceso a red. `ServicioPokedex` lee las tablas del catálogo una sola vez al arrancar y las deja inmutables en memoria; `CalculadoraStats`, `TablaTipos` y `CalculadoraDano` son funciones puras que solo reciben números. Nada de esto depende de `Emulator`, así que todo se prueba con JUnit sin levantar el emulador.

**Tech Stack:** Java 16, JUnit 5.10.2, MariaDB (solo en la carga inicial).

## Global Constraints

- Paquete raíz `com.retro.pokemonengine`; el combate vive en `com.retro.pokemonengine.combate`
- **Ninguna clase de `combate` puede importar `com.eu.habbo`**: es la regla que mantiene el motor probable y reutilizable en la fase 2
- Todas las divisiones son **enteras y truncadas hacia abajo**, como en los juegos. Usar `int` y `Math.floor`, nunca `double` intermedio sin truncar
- El esquema debe estar en la versión 3 y el catálogo importado (hito 2)
- Todo contra `habbo_pokemon_test_20260918`, nunca producción

## Fórmulas de referencia

Las de gen 3 en adelante, que son las que usa el juego actual.

**PS:**

```
PS = floor((2 × base + IV + floor(EV / 4)) × nivel / 100) + nivel + 10
```

**Resto de stats:**

```
stat = floor((floor((2 × base + IV + floor(EV / 4)) × nivel / 100) + 5) × naturaleza)
```

donde naturaleza vale 1.1, 1.0 o 0.9.

**Daño:**

```
base = floor(floor(floor(2 × nivel / 5 + 2) × potencia × A / D) / 50) + 2
daño = base × modificadores
```

Modificadores, en este orden: crítico (×1.5), variación aleatoria (85-100 en centésimas), STAB (×1.5, o ×2 con Adaptable), efectividad de tipos, quemadura (×0.5 en físicos), clima.

**Caso de prueba conocido, y por qué sirve**: un Pikachu de nivel 50 con 31 IV y 0 EV en Velocidad tiene 90 base → `floor((2×90 + 31 + 0) × 50 / 100) = floor(105.5) = 105`, más 5, son **110** con naturaleza neutra. Ese truncado intermedio es justo el que se pierde si se calcula en coma flotante de una sola pasada, así que la prueba detecta el error más típico de esta fórmula.

---

## Estructura de archivos

`Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/combate/`

| Archivo | Responsabilidad |
|---|---|
| `Naturaleza.java` | Las 25 naturalezas: qué stat suben y cuál bajan |
| `Stat.java` | Enumeración de los seis stats |
| `CalculadoraStats.java` | Stats reales a partir de base, IV, EV, naturaleza y nivel efectivo |
| `TablaTipos.java` | Multiplicador de un tipo atacante contra uno o dos defensores |
| `CalculadoraDano.java` | Fórmula de daño con sus modificadores |
| `EspecieCatalogo.java` | Especie inmutable en memoria |
| `MovimientoCatalogo.java` | Movimiento inmutable en memoria |

`.../pokemonengine/ServicioPokedex.java` — carga y acceso al catálogo.

Pruebas en `src/test/java/com/retro/pokemonengine/combate/`.

---

### Task 1: Naturalezas y stats

**Files:**
- Create: `combate/Stat.java`, `combate/Naturaleza.java`, `combate/CalculadoraStats.java`
- Test: `src/test/java/com/retro/pokemonengine/combate/CalculadoraStatsTest.java`

**Interfaces:**
- Produces:
  - `enum Stat { PS, ATAQUE, DEFENSA, ATAQUE_ESP, DEFENSA_ESP, VELOCIDAD }`
  - `Naturaleza.porNombre(String)`, `double Naturaleza.multiplicador(Stat)`
  - `int CalculadoraStats.ps(int base, int iv, int ev, int nivel)`
  - `int CalculadoraStats.otro(Stat stat, int base, int iv, int ev, int nivel, Naturaleza naturaleza)`

- [ ] **Step 1: Escribir la prueba que falla**

```java
package com.retro.pokemonengine.combate;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class CalculadoraStatsTest
{
    @Test
    void velocidadDePikachuNivel50ConIvMaximo()
    {
        int velocidad = CalculadoraStats.otro(
                Stat.VELOCIDAD, 90, 31, 0, 50, Naturaleza.porNombre("hardy"));

        assertEquals(110, velocidad);
    }

    @Test
    void elTruncadoIntermedioImporta()
    {
        // Sin truncar el paso intermedio saldría 111, no 110.
        int conTruncado = CalculadoraStats.otro(
                Stat.VELOCIDAD, 90, 31, 0, 50, Naturaleza.porNombre("hardy"));

        assertEquals(110, conTruncado);
    }

    @Test
    void naturalezaPositivaYNegativaSobreLaMismaBase()
    {
        int neutra = CalculadoraStats.otro(Stat.ATAQUE, 100, 31, 252, 100, Naturaleza.porNombre("hardy"));
        int sube = CalculadoraStats.otro(Stat.ATAQUE, 100, 31, 252, 100, Naturaleza.porNombre("adamant"));
        int baja = CalculadoraStats.otro(Stat.ATAQUE, 100, 31, 252, 100, Naturaleza.porNombre("modest"));

        assertEquals(299, neutra);
        assertEquals(328, sube);
        assertEquals(269, baja);
    }

    @Test
    void psUsaSuPropiaFormula()
    {
        // Blissey nivel 100, base 255, IV 31, EV 0
        assertEquals(651, CalculadoraStats.ps(255, 31, 0, 100));
    }

    @Test
    void shedinjaNoEsUnCasoEspecialAqui()
    {
        // La regla de 1 PS de Shedinja es del motor, no de la fórmula.
        assertEquals(143, CalculadoraStats.ps(1, 31, 0, 100));
    }

    @Test
    void losEvSeCuentanEnCuartos()
    {
        int sinEv = CalculadoraStats.otro(Stat.ATAQUE, 100, 31, 0, 100, Naturaleza.porNombre("hardy"));
        int conTres = CalculadoraStats.otro(Stat.ATAQUE, 100, 31, 3, 100, Naturaleza.porNombre("hardy"));
        int conCuatro = CalculadoraStats.otro(Stat.ATAQUE, 100, 31, 4, 100, Naturaleza.porNombre("hardy"));

        assertEquals(sinEv, conTres, "Tres EV no llegan a sumar un punto");
        assertEquals(sinEv + 1, conCuatro);
    }

    @Test
    void hayVeinticincoNaturalezas()
    {
        assertEquals(25, Naturaleza.values().length);
    }
}
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run:
```bash
"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -f "Desarrollo/PokemonEngine/pom.xml" test
```
Expected: FALLO de compilación, `cannot find symbol: class Stat`.

- [ ] **Step 3: Escribir `Stat`**

```java
package com.retro.pokemonengine.combate;

public enum Stat
{
    PS,
    ATAQUE,
    DEFENSA,
    ATAQUE_ESP,
    DEFENSA_ESP,
    VELOCIDAD
}
```

- [ ] **Step 4: Escribir `Naturaleza`**

```java
package com.retro.pokemonengine.combate;

public enum Naturaleza
{
    HARDY("hardy", null, null),
    LONELY("lonely", Stat.ATAQUE, Stat.DEFENSA),
    BRAVE("brave", Stat.ATAQUE, Stat.VELOCIDAD),
    ADAMANT("adamant", Stat.ATAQUE, Stat.ATAQUE_ESP),
    NAUGHTY("naughty", Stat.ATAQUE, Stat.DEFENSA_ESP),
    BOLD("bold", Stat.DEFENSA, Stat.ATAQUE),
    DOCILE("docile", null, null),
    RELAXED("relaxed", Stat.DEFENSA, Stat.VELOCIDAD),
    IMPISH("impish", Stat.DEFENSA, Stat.ATAQUE_ESP),
    LAX("lax", Stat.DEFENSA, Stat.DEFENSA_ESP),
    TIMID("timid", Stat.VELOCIDAD, Stat.ATAQUE),
    HASTY("hasty", Stat.VELOCIDAD, Stat.DEFENSA),
    SERIOUS("serious", null, null),
    JOLLY("jolly", Stat.VELOCIDAD, Stat.ATAQUE_ESP),
    NAIVE("naive", Stat.VELOCIDAD, Stat.DEFENSA_ESP),
    MODEST("modest", Stat.ATAQUE_ESP, Stat.ATAQUE),
    MILD("mild", Stat.ATAQUE_ESP, Stat.DEFENSA),
    QUIET("quiet", Stat.ATAQUE_ESP, Stat.VELOCIDAD),
    BASHFUL("bashful", null, null),
    RASH("rash", Stat.ATAQUE_ESP, Stat.DEFENSA_ESP),
    CALM("calm", Stat.DEFENSA_ESP, Stat.ATAQUE),
    GENTLE("gentle", Stat.DEFENSA_ESP, Stat.DEFENSA),
    SASSY("sassy", Stat.DEFENSA_ESP, Stat.VELOCIDAD),
    CAREFUL("careful", Stat.DEFENSA_ESP, Stat.ATAQUE_ESP),
    QUIRKY("quirky", null, null);

    private final String nombre;
    private final Stat sube;
    private final Stat baja;

    Naturaleza(String nombre, Stat sube, Stat baja)
    {
        this.nombre = nombre;
        this.sube = sube;
        this.baja = baja;
    }

    public String nombre()
    {
        return this.nombre;
    }

    public static Naturaleza porNombre(String nombre)
    {
        if(nombre != null)
        {
            for(Naturaleza naturaleza : values())
            {
                if(naturaleza.nombre.equalsIgnoreCase(nombre)) return naturaleza;
            }
        }

        return HARDY;
    }

    public double multiplicador(Stat stat)
    {
        if(stat == Stat.PS) return 1.0;
        if(stat == this.sube) return 1.1;
        if(stat == this.baja) return 0.9;

        return 1.0;
    }
}
```

- [ ] **Step 5: Escribir `CalculadoraStats`**

```java
package com.retro.pokemonengine.combate;

public final class CalculadoraStats
{
    private CalculadoraStats()
    {
    }

    public static int ps(int base, int iv, int ev, int nivel)
    {
        return ((2 * base + iv + (ev / 4)) * nivel) / 100 + nivel + 10;
    }

    public static int otro(Stat stat, int base, int iv, int ev, int nivel, Naturaleza naturaleza)
    {
        if(stat == Stat.PS) return ps(base, iv, ev, nivel);

        int sinNaturaleza = ((2 * base + iv + (ev / 4)) * nivel) / 100 + 5;

        return (int) Math.floor(sinNaturaleza * naturaleza.multiplicador(stat));
    }
}
```

- [ ] **Step 6: Ejecutar y verificar que pasa**

Run:
```bash
"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -f "Desarrollo/PokemonEngine/pom.xml" test
```
Expected: `Tests run: 15, Failures: 0, Errors: 0` (las 8 anteriores más las 7 nuevas).

- [ ] **Step 7: Commit**

```bash
git add Desarrollo/PokemonEngine/src
git commit -m "feat(pokemon): add stat calculation with natures"
```

---

### Task 2: Tabla de tipos

**Files:**
- Create: `combate/TablaTipos.java`
- Test: `src/test/java/com/retro/pokemonengine/combate/TablaTiposTest.java`

**Interfaces:**
- Produces:
  - `TablaTipos(Map<Long, Double> multiplicadores)` donde la clave es `atacanteId * 1000L + defensorId`
  - `double TablaTipos.multiplicador(int atacante, int defensor1, Integer defensor2)`
  - `static long TablaTipos.clave(int atacante, int defensor)`

La clave combinada evita un mapa de mapas y deja la búsqueda en un solo acceso, que importa porque esto se llama en cada golpe.

- [ ] **Step 1: Escribir la prueba que falla**

```java
package com.retro.pokemonengine.combate;

import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class TablaTiposTest
{
    private static final int ELECTRICO = 13;
    private static final int AGUA = 11;
    private static final int VOLADOR = 3;
    private static final int TIERRA = 5;
    private static final int PLANTA = 12;

    private TablaTipos tabla()
    {
        Map<Long, Double> m = new HashMap<>();

        m.put(TablaTipos.clave(ELECTRICO, AGUA), 2.0);
        m.put(TablaTipos.clave(ELECTRICO, VOLADOR), 2.0);
        m.put(TablaTipos.clave(ELECTRICO, TIERRA), 0.0);
        m.put(TablaTipos.clave(ELECTRICO, PLANTA), 0.5);

        return new TablaTipos(m);
    }

    @Test
    void unSoloTipoDefensor()
    {
        assertEquals(2.0, tabla().multiplicador(ELECTRICO, AGUA, null));
    }

    @Test
    void losDosTiposSeMultiplican()
    {
        // Gyarados es Agua/Volador: doblemente débil a Eléctrico.
        assertEquals(4.0, tabla().multiplicador(ELECTRICO, AGUA, VOLADOR));
    }

    @Test
    void laInmunidadGanaSobreLaDebilidad()
    {
        // Un Tierra/Volador es inmune a Eléctrico pese al x2 de Volador.
        assertEquals(0.0, tabla().multiplicador(ELECTRICO, TIERRA, VOLADOR));
    }

    @Test
    void debilidadYResistenciaSeCancelan()
    {
        assertEquals(1.0, tabla().multiplicador(ELECTRICO, AGUA, PLANTA));
    }

    @Test
    void loNoDeclaradoEsNeutro()
    {
        assertEquals(1.0, tabla().multiplicador(ELECTRICO, 99, null));
    }
}
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run:
```bash
"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -f "Desarrollo/PokemonEngine/pom.xml" test
```
Expected: FALLO, `cannot find symbol: class TablaTipos`.

- [ ] **Step 3: Escribir `TablaTipos`**

```java
package com.retro.pokemonengine.combate;

import java.util.Collections;
import java.util.Map;

public final class TablaTipos
{
    private final Map<Long, Double> multiplicadores;

    public TablaTipos(Map<Long, Double> multiplicadores)
    {
        this.multiplicadores = Collections.unmodifiableMap(multiplicadores);
    }

    public static long clave(int atacante, int defensor)
    {
        return atacante * 1000L + defensor;
    }

    public double multiplicador(int atacante, int defensor1, Integer defensor2)
    {
        double total = this.multiplicadores.getOrDefault(clave(atacante, defensor1), 1.0);

        if(defensor2 != null)
        {
            total *= this.multiplicadores.getOrDefault(clave(atacante, defensor2), 1.0);
        }

        return total;
    }
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run:
```bash
"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -f "Desarrollo/PokemonEngine/pom.xml" test
```
Expected: `Tests run: 20, Failures: 0, Errors: 0`.

- [ ] **Step 5: Commit**

```bash
git add Desarrollo/PokemonEngine/src
git commit -m "feat(pokemon): add type effectiveness table"
```

---

### Task 3: Fórmula de daño

**Files:**
- Create: `combate/CalculadoraDano.java`
- Test: `src/test/java/com/retro/pokemonengine/combate/CalculadoraDanoTest.java`

**Interfaces:**
- Produces:
  - `record EntradaDano(int nivel, int potencia, int ataque, int defensa, double efectividad, boolean stab, boolean critico, boolean quemado, boolean fisico, double modificadorClima, int variacion)`
  - `int CalculadoraDano.calcular(EntradaDano entrada)`
  - `int CalculadoraDano.base(int nivel, int potencia, int ataque, int defensa)`

`variacion` va de 85 a 100 y lo aporta quien llama, no la propia calculadora: así la fórmula queda determinista y probable, y el azar vive en el RNG sembrado del combate.

- [ ] **Step 1: Escribir la prueba que falla**

```java
package com.retro.pokemonengine.combate;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CalculadoraDanoTest
{
    private CalculadoraDano.EntradaDano basica()
    {
        return new CalculadoraDano.EntradaDano(
                50, 90, 120, 100, 1.0, false, false, false, true, 1.0, 100);
    }

    @Test
    void elDanoBaseSigueLaFormulaDeLosJuegos()
    {
        // floor(floor(floor(2*50/5 + 2) * 90 * 120 / 100) / 50) + 2
        // = floor(floor(22 * 90 * 120 / 100) / 50) + 2 = floor(2376 / 50) + 2 = 47 + 2 = 49
        assertEquals(49, CalculadoraDano.base(50, 90, 120, 100));
    }

    @Test
    void sinModificadoresElDanoEsElBase()
    {
        assertEquals(49, CalculadoraDano.calcular(basica()));
    }

    @Test
    void elStabMultiplicaPorUnoComaCinco()
    {
        CalculadoraDano.EntradaDano e = new CalculadoraDano.EntradaDano(
                50, 90, 120, 100, 1.0, true, false, false, true, 1.0, 100);

        assertEquals(73, CalculadoraDano.calcular(e));
    }

    @Test
    void laEfectividadCeroAnulaElDano()
    {
        CalculadoraDano.EntradaDano e = new CalculadoraDano.EntradaDano(
                50, 90, 120, 100, 0.0, true, true, false, true, 1.0, 100);

        assertEquals(0, CalculadoraDano.calcular(e));
    }

    @Test
    void elCriticoMultiplicaPorUnoComaCinco()
    {
        CalculadoraDano.EntradaDano e = new CalculadoraDano.EntradaDano(
                50, 90, 120, 100, 1.0, false, true, false, true, 1.0, 100);

        assertEquals(73, CalculadoraDano.calcular(e));
    }

    @Test
    void laQuemaduraSoloAfectaAMovimientosFisicos()
    {
        CalculadoraDano.EntradaDano fisico = new CalculadoraDano.EntradaDano(
                50, 90, 120, 100, 1.0, false, false, true, true, 1.0, 100);
        CalculadoraDano.EntradaDano especial = new CalculadoraDano.EntradaDano(
                50, 90, 120, 100, 1.0, false, false, true, false, 1.0, 100);

        assertEquals(24, CalculadoraDano.calcular(fisico));
        assertEquals(49, CalculadoraDano.calcular(especial));
    }

    @Test
    void laVariacionReduceElDanoHastaUnQuincePorCiento()
    {
        CalculadoraDano.EntradaDano minima = new CalculadoraDano.EntradaDano(
                50, 90, 120, 100, 1.0, false, false, false, true, 1.0, 85);

        assertEquals(41, CalculadoraDano.calcular(minima));
    }

    @Test
    void unGolpeQueAciertaNuncaHaceCeroSalvoInmunidad()
    {
        CalculadoraDano.EntradaDano flojo = new CalculadoraDano.EntradaDano(
                1, 10, 1, 255, 0.25, false, false, true, true, 1.0, 85);

        assertTrue(CalculadoraDano.calcular(flojo) >= 1);
    }
}
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run:
```bash
"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -f "Desarrollo/PokemonEngine/pom.xml" test
```
Expected: FALLO, `cannot find symbol: class CalculadoraDano`.

- [ ] **Step 3: Escribir `CalculadoraDano`**

El suelo de 1 punto existe en los juegos: un golpe que acierta y no es inmune siempre quita algo.

```java
package com.retro.pokemonengine.combate;

public final class CalculadoraDano
{
    private CalculadoraDano()
    {
    }

    public record EntradaDano(
            int nivel,
            int potencia,
            int ataque,
            int defensa,
            double efectividad,
            boolean stab,
            boolean critico,
            boolean quemado,
            boolean fisico,
            double modificadorClima,
            int variacion)
    {
    }

    public static int base(int nivel, int potencia, int ataque, int defensa)
    {
        if(defensa <= 0) defensa = 1;

        long paso = (long) ((2 * nivel) / 5 + 2) * potencia * ataque / defensa;

        return (int) (paso / 50) + 2;
    }

    public static int calcular(EntradaDano e)
    {
        if(e.efectividad() == 0.0) return 0;

        double dano = base(e.nivel(), e.potencia(), e.ataque(), e.defensa());

        if(e.critico()) dano = Math.floor(dano * 1.5);

        dano = Math.floor(dano * e.variacion() / 100.0);

        if(e.stab()) dano = Math.floor(dano * 1.5);

        dano = Math.floor(dano * e.efectividad());
        dano = Math.floor(dano * e.modificadorClima());

        if(e.quemado() && e.fisico()) dano = Math.floor(dano * 0.5);

        return Math.max(1, (int) dano);
    }
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run:
```bash
"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -f "Desarrollo/PokemonEngine/pom.xml" test
```
Expected: `Tests run: 28, Failures: 0, Errors: 0`.

- [ ] **Step 5: Commit**

```bash
git add Desarrollo/PokemonEngine/src
git commit -m "feat(pokemon): add damage formula"
```

---

### Task 4: Catálogo en memoria

**Files:**
- Create: `combate/EspecieCatalogo.java`, `combate/MovimientoCatalogo.java`
- Create: `ServicioPokedex.java`
- Modify: `PokemonEnginePlugin.java`

**Interfaces:**
- Consumes: `BaseDatosPokemon`, `TablaTipos`
- Produces:
  - `static void ServicioPokedex.cargar()`
  - `static EspecieCatalogo ServicioPokedex.especie(int id)`
  - `static MovimientoCatalogo ServicioPokedex.movimiento(int id)`
  - `static TablaTipos ServicioPokedex.tipos()`
  - `static int ServicioPokedex.totalEspecies()`, `totalMovimientos()`

- [ ] **Step 1: Escribir los dos registros del catálogo**

```java
package com.retro.pokemonengine.combate;

public record EspecieCatalogo(
        int id,
        String nombreEs,
        int tipo1,
        Integer tipo2,
        int baseHp,
        int baseAtaque,
        int baseDefensa,
        int baseAtaqueEsp,
        int baseDefensaEsp,
        int baseVelocidad,
        int catchRate,
        int baseExperience,
        String growthRate)
{
    public int base(Stat stat)
    {
        return switch(stat)
        {
            case PS -> this.baseHp;
            case ATAQUE -> this.baseAtaque;
            case DEFENSA -> this.baseDefensa;
            case ATAQUE_ESP -> this.baseAtaqueEsp;
            case DEFENSA_ESP -> this.baseDefensaEsp;
            case VELOCIDAD -> this.baseVelocidad;
        };
    }
}
```

```java
package com.retro.pokemonengine.combate;

public record MovimientoCatalogo(
        int id,
        String nombreEs,
        int tipoId,
        String clase,
        Integer potencia,
        Integer precision,
        int pp,
        int prioridad,
        String objetivo,
        String effectCode,
        boolean vigente)
{
    public boolean esFisico()
    {
        return "physical".equals(this.clase);
    }

    public boolean esEstado()
    {
        return "status".equals(this.clase);
    }
}
```

- [ ] **Step 2: Escribir `ServicioPokedex`**

```java
package com.retro.pokemonengine;

import com.eu.habbo.Emulator;
import com.retro.pokemonengine.combate.EspecieCatalogo;
import com.retro.pokemonengine.combate.MovimientoCatalogo;
import com.retro.pokemonengine.combate.TablaTipos;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

public final class ServicioPokedex
{
    private static Map<Integer, EspecieCatalogo> especies = Collections.emptyMap();
    private static Map<Integer, MovimientoCatalogo> movimientos = Collections.emptyMap();
    private static TablaTipos tipos = new TablaTipos(Collections.emptyMap());

    private ServicioPokedex()
    {
    }

    public static void cargar() throws Exception
    {
        Map<Integer, EspecieCatalogo> nuevasEspecies = new HashMap<>();
        Map<Integer, MovimientoCatalogo> nuevosMovimientos = new HashMap<>();
        Map<Long, Double> nuevaTabla = new HashMap<>();

        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            Statement s = c.createStatement())
        {
            try(ResultSet r = s.executeQuery(
                    "SELECT id, nombre_es, type_1_id, type_2_id, base_hp, base_attack, base_defense," +
                    " base_sp_attack, base_sp_defense, base_speed, catch_rate, base_experience, growth_rate" +
                    " FROM pokemon_species WHERE form_id = 0"))
            {
                while(r.next())
                {
                    int tipo2 = r.getInt("type_2_id");

                    nuevasEspecies.put(r.getInt("id"), new EspecieCatalogo(
                            r.getInt("id"),
                            r.getString("nombre_es"),
                            r.getInt("type_1_id"),
                            r.wasNull() ? null : tipo2,
                            r.getInt("base_hp"),
                            r.getInt("base_attack"),
                            r.getInt("base_defense"),
                            r.getInt("base_sp_attack"),
                            r.getInt("base_sp_defense"),
                            r.getInt("base_speed"),
                            r.getInt("catch_rate"),
                            r.getInt("base_experience"),
                            r.getString("growth_rate")));
                }
            }
        }

        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            Statement s = c.createStatement();
            ResultSet r = s.executeQuery(
                    "SELECT id, nombre_es, type_id, clase, potencia, precision_pct, pp, prioridad," +
                    " objetivo, effect_code, vigente FROM pokemon_moves"))
        {
            while(r.next())
            {
                Integer potencia = r.getObject("potencia") == null ? null : r.getInt("potencia");
                Integer precision = r.getObject("precision_pct") == null ? null : r.getInt("precision_pct");

                nuevosMovimientos.put(r.getInt("id"), new MovimientoCatalogo(
                        r.getInt("id"),
                        r.getString("nombre_es"),
                        r.getInt("type_id"),
                        r.getString("clase"),
                        potencia,
                        precision,
                        r.getInt("pp"),
                        r.getInt("prioridad"),
                        r.getString("objetivo"),
                        r.getString("effect_code"),
                        r.getInt("vigente") == 1));
            }
        }

        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            Statement s = c.createStatement();
            ResultSet r = s.executeQuery(
                    "SELECT atacante_id, defensor_id, multiplicador FROM pokemon_type_chart"))
        {
            while(r.next())
            {
                nuevaTabla.put(
                        TablaTipos.clave(r.getInt("atacante_id"), r.getInt("defensor_id")),
                        r.getDouble("multiplicador"));
            }
        }

        especies = Collections.unmodifiableMap(nuevasEspecies);
        movimientos = Collections.unmodifiableMap(nuevosMovimientos);
        tipos = new TablaTipos(nuevaTabla);

        System.out.println("[PokemonEngine] Catálogo en memoria: "
                + especies.size() + " especies, "
                + movimientos.size() + " movimientos, "
                + nuevaTabla.size() + " combinaciones de tipos.");
    }

    public static EspecieCatalogo especie(int id)
    {
        return especies.get(id);
    }

    public static MovimientoCatalogo movimiento(int id)
    {
        return movimientos.get(id);
    }

    public static TablaTipos tipos()
    {
        return tipos;
    }

    public static int totalEspecies()
    {
        return especies.size();
    }

    public static int totalMovimientos()
    {
        return movimientos.size();
    }
}
```

- [ ] **Step 3: Cargar el catálogo al arrancar**

En `PokemonEnginePlugin.onEmulatorLoaded`, entre las migraciones y el registro del handler:

```java
        BaseDatosPokemon.inicializar();

        ServicioPokedex.cargar();

        Emulator.getGameServer().getPacketManager()
                .registerHandler(PACKET_POKEMON_COMMAND, PokemonCommandHandler.class);
```

- [ ] **Step 4: Añadir la acción de diagnóstico al handler**

En `PokemonAcciones`:

```java
    public static final int CATALOGO = 2;
```

Y en `PokemonCommandHandler`, un caso nuevo antes del `default`:

```java
                case PokemonAcciones.CATALOGO:
                {
                    Map<String, Object> datos = new LinkedHashMap<>();

                    datos.put("especies", com.retro.pokemonengine.ServicioPokedex.totalEspecies());
                    datos.put("movimientos", com.retro.pokemonengine.ServicioPokedex.totalMovimientos());

                    exito = true;
                    cuerpo = PokemonCuerpo.datos(datos);
                    break;
                }
```

- [ ] **Step 5: Compilar y desplegar**

Run:
```bash
"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -f "Desarrollo/PokemonEngine/pom.xml" clean package
cp Desarrollo/PokemonEngine/target/pokemon-engine-1.0.0.jar ../pokemon-test-runtime/plugins/
```
Expected: `Tests run: 28, Failures: 0` y `BUILD SUCCESS`.

- [ ] **Step 6: Reiniciar el runtime y comprobar la carga**

Expected en la salida del runtime:

```
[PokemonEngine] Catálogo en memoria: 1025 especies, 937 movimientos, 361 combinaciones de tipos.
```

- [ ] **Step 7: Commit**

```bash
git add Desarrollo/PokemonEngine/src
git commit -m "feat(pokemon): load catalog into memory at startup"
```

---

## Hecho cuando

- Las 28 pruebas pasan sin levantar el emulador
- El runtime imprime el catálogo cargado con 1025 especies, 937 movimientos y 361 combinaciones
- Ninguna clase de `com.retro.pokemonengine.combate` importa `com.eu.habbo`
- La acción 2 del protocolo devuelve los recuentos del catálogo

## Siguiente hito

Hito 3b: resolución del turno — orden por prioridad y velocidad, precisión, estados alterados y las 11 categorías genéricas de efecto.
