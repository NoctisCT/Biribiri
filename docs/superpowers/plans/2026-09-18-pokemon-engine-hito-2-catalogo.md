# PokemonEngine — Hito 2: catálogo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tener en base de datos el catálogo Pokémon completo —especies, tipos, tabla de efectividades, habilidades, movimientos con su mecánica, learnsets y evoluciones— importado de forma idempotente y reanudable, con un verificador que diga exactamente qué queda sin implementar.

**Architecture:** El **plugin Java es el dueño del esquema** (migración `M002Catalogo` en su runner idempotente) y el **comando Artisan solo rellena datos**. El importador usa **dos fuentes**: PokéAPI para el catálogo y los nombres en español, y los datos de Pokémon Showdown para la mecánica de combate. Ambas se descargan a una caché local en disco y luego se proyectan a las tablas, de modo que una segunda pasada no pide nada a la red. La traducción de JSON a fila vive en clases puras sin base de datos, que son las que se prueban.

**Tech Stack:** Java 16 (migración), PHP 8 / Laravel 12.1.1 (importador), PokéAPI v2, datos de Pokémon Showdown, Node (solo para convertir el fichero JS de Showdown a JSON), MariaDB.

## Global Constraints

- Packet del plugin: **6400/6401** (bloque 6400-6419). Ver `docs/REGISTRO-PACKET-IDS.md`
- **Todo se ejecuta contra `habbo_pokemon_test_20260918`**, nunca contra `habbo`. El `.env` del worktree ya apunta ahí
- **Prohibido `yarn install` y `composer install`**: `vendor/` y `node_modules` se copian de la copia principal (ver `docs/RUNTIME-AISLADO.md`)
- El catálogo es **solo lectura en caliente**: lo escribe el importador, el plugin solo lo lee
- Motor de tablas: `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
- Nombres de especies y movimientos **en español**, tomados de `names[].language.name == 'es'`, con respaldo al inglés cuando no exista

## Datos de partida, ya verificados contra la API

Comprobado el 18/09/2026 pidiendo movimientos reales a PokéAPI:

- **Rayo** (id 85) trae potencia 90, precisión 100, PP 15, prioridad 0, tipo `electric`, clase `special`, `effect_chance` 10, objetivo `selected-pokemon`, y un bloque `meta` con dolencia `paralysis`, probabilidad 10, golpes mínimos y máximos, turnos, drenaje, curación, ratio de crítico, retroceso y probabilidad de cambio de stats
- **Rayo Confuso** → categoría `ailment`, dolencia `confusion`, **2-5 turnos**. La confusión sale entera de los datos
- **Tóxico** → dolencia `poison`, 15 turnos
- **Velo Aurora** y **Reflejo** → categoría `field-effect`, objetivo `users-field`, **sin turnos y sin semántica**. Que duren 5 turnos y reduzcan el daño hay que escribirlo a mano

Reparto de los 827 movimientos clasificados:

| Categoría | Movimientos | Resolución |
|---|---|---|
| `damage` | 391 | Genérica |
| `damage-ailment` | 84 | Genérica |
| `net-good-stats` | 68 | Genérica |
| `damage-lower` | 52 | Genérica |
| `ailment` | 31 | Genérica |
| `damage-raise` | 28 | Genérica |
| `heal` | 14 | Genérica |
| `damage-heal` | 11 | Genérica |
| `swagger` | 4 | Genérica |
| `ohko` | 4 | Genérica |
| `force-switch` | 2 | Genérica |
| **`unique`** | **106** | **A mano** |
| **`whole-field-effect`** | **17** | **A mano** |
| **`field-effect`** | **15** | **A mano** |

**689 genéricos (83%) y 138 a mano (17%)** si solo se usara PokéAPI. Pero con la segunda fuente ese reparto mejora mucho.

### Lo que PokéAPI no tiene, y por qué hace falta Showdown

PokéAPI **no expone los flags de los movimientos**. Sus claves son `accuracy, contest_*, damage_class, effect_chance, effect_changes, effect_entries, flavor_text_entries, generation, id, learned_by_pokemon, machines, meta, name, names, past_values, power, pp, priority, stat_changes, target, type`. No hay contacto, sonido, puño, mordisco, bala, bloqueable por Protección, reflejable ni atraviesa-Sustituto.

Sin eso no funcionan Piel Tosca, Casco Dentado, Insonorizar, Puño Férreo, Mandíbula Fuerte, Protección ni Capa Mágica.

Los datos de Showdown (`https://play.pokemonshowdown.com/data/moves.js`, 451 KB, 954 movimientos) sí los tienen. Verificado el 18/09/2026:

- **37 flags**: `contact, protect, mirror, sound, punch, bite, bullet, powder, pulse, slicing, wind, dance, bypasssub, reflectable, snatch, heal, gravity, defrost, charge, recharge, distance, nonsky, minimize, futuremove, …`
- **Campos mecánicos legibles por máquina**: `breaksProtect, ignoreAbility, ignoreDefensive, ignoreEvasion, ignoreImmunity, critRatio, willCrit, multihit, multiaccuracy, recoil, drain, heal, boosts, secondary/secondaries, forceSwitch, selfSwitch, ohko, stallingMove, selfdestruct, thawsTarget, overrideOffensiveStat, overrideDefensiveStat`
- **Condiciones con duración**: `sideCondition`, `slotCondition`, `volatileStatus`, `weather`, `terrain`, `pseudoWeather`, y `condition.duration`
- **Filtros de vigencia**: `isNonstandard`, `isZ`, `isMax`

Casos comprobados uno a uno:

| Movimiento | Dato de Showdown |
|---|---|
| Velo Aurora | `sideCondition: "auroraveil"`, `condition.duration: 5` |
| Reflejo | `sideCondition: "reflect"`, `condition.duration: 5` |
| Púas | `sideCondition: "spikes"`, flag `reflectable` |
| Velocidad Extrema | `priority: 2`, flags `contact` y `protect` |
| Amago | `breaksProtect: true`, **sin** flag `protect` |
| Psicocorte | `overrideDefensiveStat: "def"` |
| Plancha Corporal | `overrideOffensiveStat: "def"` |

**Consecuencia para el diseño**: lo que se escribe a mano deja de ser una lista de 138 movimientos y pasa a ser un **conjunto cerrado de primitivas reutilizables** — unas 15 condiciones de bando, los climas y terrenos, y los estados volátiles. Un movimiento nuevo que declare `sideCondition: "reflect"` funciona sin tocar código.

**685 movimientos vigentes** una vez descartados `isZ`, `isMax` e `isNonstandard`. El importador guarda los 954 pero marca `vigente = 0` en el resto, y los movesets salvajes solo usan los vigentes.

El reparto de categorías de PokéAPI se conserva en la columna `categoria` porque sigue siendo útil para clasificar y para el informe del verificador.

## Volumen y estrategia de descarga

| Recurso | Peticiones |
|---|---|
| `/pokemon-species/{id}` | ~1.025 |
| `/pokemon/{id}` (learnsets) | ~1.025 |
| `/move/{id}` | ~937 |
| `/evolution-chain/{id}` | ~540 |
| `/ability/{id}` | ~367 |
| `/type/{id}` | 18 |
| Showdown `moves.js` | **1** |

Unas **3.900 peticiones** a PokéAPI más **una sola descarga** de Showdown. Con caché en disco la primera pasada tarda minutos y las siguientes son instantáneas. La caché vive en `storage/app/pokemon-cache/` y se versiona por ruta de API.

El fichero de Showdown es JavaScript con claves sin comillas (`exports.BattleMovedex = {absorb:{num:71,…}}`), así que no se puede parsear como JSON. Se convierte con Node, que ya está en el proyecto, en lugar de con expresiones regulares:

```bash
node -e "console.log(JSON.stringify(require('./moves.js').BattleMovedex))" > moves.json
```

---

## Estructura de archivos

**Plugin** — `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/`

| Archivo | Responsabilidad |
|---|---|
| `migraciones/M002Catalogo.java` | Crea las 8 tablas del catálogo |
| `BaseDatosPokemon.java` (modificar) | Añadir `M002Catalogo` a la lista |

**Importador** — `xampp/htdocs/app/`

| Archivo | Responsabilidad |
|---|---|
| `Services/Pokemon/CachePokeApi.php` | Descarga con caché en disco y concurrencia |
| `Services/Pokemon/MapeadorEspecie.php` | JSON de especie → fila. Puro |
| `Services/Pokemon/MapeadorMovimiento.php` | JSON de movimiento → fila, incluida la clasificación del efecto. Puro |
| `Services/Pokemon/MapeadorEvolucion.php` | Cadena de evolución → filas. Puro |
| `Console/Commands/PokemonImportCatalog.php` | `pokemon:import-catalog` |
| `Console/Commands/PokemonVerifyCatalog.php` | `pokemon:verify-catalog` |

**Pruebas** — `xampp/htdocs/tests/Unit/Pokemon/`

| Archivo | Responsabilidad |
|---|---|
| `MapeadorMovimientoTest.php` | Clasificación de efectos y campos de mecánica |
| `MapeadorEspecieTest.php` | Stats base, tipos, yields de EV, nombres en español |
| `MapeadorEvolucionTest.php` | Cadenas ramificadas (Eevee) y métodos no estándar |

Las pruebas usan **ficheros de ejemplo guardados en `tests/Fixtures/Pokemon/`**, nunca la API en vivo.

---

### Task 1: Migración del esquema del catálogo

**Files:**
- Create: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/migraciones/M002Catalogo.java`
- Modify: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/BaseDatosPokemon.java`

**Interfaces:**
- Consumes: `Migracion`, `PlanMigracion`, `BaseDatosPokemon` del hito 1
- Produces: tablas `pokemon_types`, `pokemon_type_chart`, `pokemon_abilities_cat`, `pokemon_species`, `pokemon_species_evolution`, `pokemon_moves`, `pokemon_move_effects`, `pokemon_learnsets`; esquema en versión **2**

`pokemon_abilities_cat` lleva sufijo porque `pokemon_abilities` ya existe como prototipo con 8 filas y se retira en un hito posterior; crear una tabla nueva evita romper el backend viejo mientras siga vivo.

- [ ] **Step 1: Escribir la migración**

```java
package com.retro.pokemonengine.migraciones;

import java.sql.Connection;
import java.sql.Statement;

public final class M002Catalogo implements Migracion
{
    @Override
    public int version()
    {
        return 2;
    }

    @Override
    public String nombre()
    {
        return "catalogo";
    }

    @Override
    public void aplicar(Connection conexion) throws Exception
    {
        try(Statement s = conexion.createStatement())
        {
            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_types (" +
                "id INT NOT NULL," +
                "nombre VARCHAR(20) NOT NULL," +
                "nombre_es VARCHAR(20) NOT NULL," +
                "PRIMARY KEY (id)," +
                "UNIQUE KEY uq_pokemon_types_nombre (nombre)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_type_chart (" +
                "atacante_id INT NOT NULL," +
                "defensor_id INT NOT NULL," +
                "multiplicador DECIMAL(3,2) NOT NULL," +
                "PRIMARY KEY (atacante_id, defensor_id)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_abilities_cat (" +
                "id INT NOT NULL," +
                "nombre VARCHAR(60) NOT NULL," +
                "nombre_es VARCHAR(60) NOT NULL," +
                "descripcion_es TEXT NULL," +
                "effect_code VARCHAR(48) NOT NULL DEFAULT 'sin_implementar'," +
                "implemented TINYINT(1) NOT NULL DEFAULT 0," +
                "PRIMARY KEY (id)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_species (" +
                "id INT NOT NULL," +
                "form_id INT NOT NULL DEFAULT 0," +
                "nombre VARCHAR(60) NOT NULL," +
                "nombre_es VARCHAR(60) NOT NULL," +
                "generacion TINYINT UNSIGNED NOT NULL DEFAULT 1," +
                "type_1_id INT NOT NULL," +
                "type_2_id INT NULL," +
                "base_hp SMALLINT UNSIGNED NOT NULL," +
                "base_attack SMALLINT UNSIGNED NOT NULL," +
                "base_defense SMALLINT UNSIGNED NOT NULL," +
                "base_sp_attack SMALLINT UNSIGNED NOT NULL," +
                "base_sp_defense SMALLINT UNSIGNED NOT NULL," +
                "base_speed SMALLINT UNSIGNED NOT NULL," +
                "yield_hp TINYINT UNSIGNED NOT NULL DEFAULT 0," +
                "yield_attack TINYINT UNSIGNED NOT NULL DEFAULT 0," +
                "yield_defense TINYINT UNSIGNED NOT NULL DEFAULT 0," +
                "yield_sp_attack TINYINT UNSIGNED NOT NULL DEFAULT 0," +
                "yield_sp_defense TINYINT UNSIGNED NOT NULL DEFAULT 0," +
                "yield_speed TINYINT UNSIGNED NOT NULL DEFAULT 0," +
                "ability_1_id INT NULL," +
                "ability_2_id INT NULL," +
                "ability_hidden_id INT NULL," +
                "catch_rate SMALLINT UNSIGNED NOT NULL DEFAULT 255," +
                "base_experience SMALLINT UNSIGNED NOT NULL DEFAULT 50," +
                "growth_rate VARCHAR(24) NOT NULL DEFAULT 'medium'," +
                "female_ratio DECIMAL(4,1) NULL," +
                "egg_group_1 VARCHAR(30) NULL," +
                "egg_group_2 VARCHAR(30) NULL," +
                "egg_steps SMALLINT UNSIGNED NOT NULL DEFAULT 5120," +
                "base_friendship TINYINT UNSIGNED NOT NULL DEFAULT 70," +
                "altura DECIMAL(5,2) NOT NULL DEFAULT 0," +
                "peso DECIMAL(6,2) NOT NULL DEFAULT 0," +
                "es_legendario TINYINT(1) NOT NULL DEFAULT 0," +
                "es_singular TINYINT(1) NOT NULL DEFAULT 0," +
                "PRIMARY KEY (id, form_id)," +
                "KEY idx_pokemon_species_gen (generacion)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_species_evolution (" +
                "id INT NOT NULL AUTO_INCREMENT," +
                "origen_id INT NOT NULL," +
                "destino_id INT NOT NULL," +
                "metodo VARCHAR(32) NOT NULL," +
                "parametro VARCHAR(64) NULL," +
                "nivel_minimo TINYINT UNSIGNED NULL," +
                "condicion VARCHAR(128) NULL," +
                "PRIMARY KEY (id)," +
                "KEY idx_pokemon_evolution_origen (origen_id)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_moves (" +
                "id INT NOT NULL," +
                "nombre VARCHAR(60) NOT NULL," +
                "nombre_es VARCHAR(60) NOT NULL," +
                "type_id INT NOT NULL," +
                "clase VARCHAR(12) NOT NULL," +
                "potencia SMALLINT UNSIGNED NULL," +
                "precision_pct SMALLINT UNSIGNED NULL," +
                "pp TINYINT UNSIGNED NOT NULL DEFAULT 5," +
                "prioridad TINYINT NOT NULL DEFAULT 0," +
                "objetivo VARCHAR(32) NOT NULL," +
                "categoria VARCHAR(32) NOT NULL," +
                "effect_code VARCHAR(48) NOT NULL," +
                "effect_chance SMALLINT UNSIGNED NULL," +
                "dolencia VARCHAR(24) NOT NULL DEFAULT 'none'," +
                "dolencia_chance SMALLINT UNSIGNED NOT NULL DEFAULT 0," +
                "golpes_min TINYINT UNSIGNED NULL," +
                "golpes_max TINYINT UNSIGNED NULL," +
                "turnos_min TINYINT UNSIGNED NULL," +
                "turnos_max TINYINT UNSIGNED NULL," +
                "drenaje SMALLINT NOT NULL DEFAULT 0," +
                "curacion SMALLINT NOT NULL DEFAULT 0," +
                "ratio_critico TINYINT UNSIGNED NOT NULL DEFAULT 0," +
                "retroceso_chance SMALLINT UNSIGNED NOT NULL DEFAULT 0," +
                "stat_chance SMALLINT UNSIGNED NOT NULL DEFAULT 0," +
                "cambios_stats TEXT NULL," +
                // --- mecánica procedente de Showdown ---
                "vigente TINYINT(1) NOT NULL DEFAULT 1," +
                "flags TEXT NULL," +                      // JSON: {"contact":1,"protect":1,…}
                "rompe_proteccion TINYINT(1) NOT NULL DEFAULT 0," +
                "ignora_habilidad TINYINT(1) NOT NULL DEFAULT 0," +
                "ignora_defensa TINYINT(1) NOT NULL DEFAULT 0," +
                "ignora_evasion TINYINT(1) NOT NULL DEFAULT 0," +
                "ignora_inmunidad TINYINT(1) NOT NULL DEFAULT 0," +
                "critico_seguro TINYINT(1) NOT NULL DEFAULT 0," +
                "retroceso_dano VARCHAR(16) NULL," +      // recoil, p. ej. "33/100"
                "stat_ofensivo_forzado VARCHAR(8) NULL," + // overrideOffensiveStat
                "stat_defensivo_forzado VARCHAR(8) NULL," +// overrideDefensiveStat
                "condicion_bando VARCHAR(32) NULL," +      // sideCondition
                "condicion_hueco VARCHAR(32) NULL," +      // slotCondition
                "estado_volatil VARCHAR(32) NULL," +       // volatileStatus
                "estado VARCHAR(24) NULL," +               // status
                "clima VARCHAR(24) NULL," +
                "terreno VARCHAR(24) NULL," +
                "duracion TINYINT UNSIGNED NULL," +        // condition.duration
                "cambio_forzado TINYINT(1) NOT NULL DEFAULT 0," +
                "autocambio TINYINT(1) NOT NULL DEFAULT 0," +
                "PRIMARY KEY (id)," +
                "KEY idx_pokemon_moves_effect (effect_code)," +
                "KEY idx_pokemon_moves_vigente (vigente)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_move_effects (" +
                "effect_code VARCHAR(48) NOT NULL," +
                "descripcion VARCHAR(160) NOT NULL," +
                "implemented TINYINT(1) NOT NULL DEFAULT 0," +
                "PRIMARY KEY (effect_code)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_learnsets (" +
                "species_id INT NOT NULL," +
                "form_id INT NOT NULL DEFAULT 0," +
                "move_id INT NOT NULL," +
                "metodo VARCHAR(24) NOT NULL," +
                "nivel TINYINT UNSIGNED NOT NULL DEFAULT 0," +
                "PRIMARY KEY (species_id, form_id, move_id, metodo, nivel)," +
                "KEY idx_pokemon_learnsets_species (species_id, form_id)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        }
    }
}
```

- [ ] **Step 2: Registrar la migración**

En `BaseDatosPokemon.java`, sustituir el método `migraciones()`:

```java
    private static List<Migracion> migraciones()
    {
        return Arrays.asList(
                new M001Base(),
                new M002Catalogo()
        );
    }
```

Y añadir el import:

```java
import com.retro.pokemonengine.migraciones.M002Catalogo;
```

- [ ] **Step 3: Compilar y desplegar al runtime aislado**

Run:
```bash
"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -f "Desarrollo/PokemonEngine/pom.xml" clean package
cp Desarrollo/PokemonEngine/target/pokemon-engine-1.0.0.jar ../pokemon-test-runtime/plugins/
```
Expected: `Tests run: 8, Failures: 0` y `BUILD SUCCESS`.

- [ ] **Step 4: Reiniciar el runtime aislado y comprobar la migración**

Parar el runtime, arrancarlo de nuevo y buscar en su salida:

```
[PokemonEngine] Migración 2 (catalogo) aplicada.
```

Un segundo reinicio debe decir `Esquema al día en la versión 2`.

- [ ] **Step 5: Comprobar las tablas**

Run:
```bash
./xampp/mysql/bin/mysql.exe -u root habbo_pokemon_test_20260918 -e "SELECT version,nombre FROM pokemon_schema_version ORDER BY version; SHOW TABLES LIKE 'pokemon_%';"
```
Expected: dos filas de versión (1 base, 2 catalogo) y las 8 tablas nuevas presentes.

- [ ] **Step 6: Commit**

```bash
git add Desarrollo/PokemonEngine/src
git commit -m "feat(pokemon): add catalog schema migration"
```

---

### Task 2: Caché de descarga de PokéAPI

**Files:**
- Create: `xampp/htdocs/app/Services/Pokemon/CachePokeApi.php`
- Test: `xampp/htdocs/tests/Unit/Pokemon/CachePokeApiTest.php`

**Interfaces:**
- Consumes: nada
- Produces:
  - `CachePokeApi::__construct(string $directorio, ?callable $descargador = null)`
  - `public function obtener(string $ruta): array` — devuelve el JSON decodificado de `https://pokeapi.co/api/v2/{ruta}`, sirviéndolo de disco si ya está
  - `public function obtenerVarias(array $rutas, int $concurrencia = 8): array` — mapa ruta → JSON
  - `public function estaEnCache(string $ruta): bool`

El `$descargador` inyectable es lo que permite probar sin red.

- [ ] **Step 1: Escribir la prueba que falla**

```php
<?php

namespace Tests\Unit\Pokemon;

use App\Services\Pokemon\CachePokeApi;
use PHPUnit\Framework\TestCase;

class CachePokeApiTest extends TestCase
{
    private string $dir;

    protected function setUp(): void
    {
        $this->dir = sys_get_temp_dir() . '/pkcache-' . uniqid();
        mkdir($this->dir, 0777, true);
    }

    protected function tearDown(): void
    {
        array_map('unlink', glob($this->dir . '/*') ?: []);
        @rmdir($this->dir);
    }

    public function test_descarga_una_vez_y_luego_sirve_de_disco(): void
    {
        $llamadas = 0;

        $cache = new CachePokeApi($this->dir, function (string $ruta) use (&$llamadas) {
            $llamadas++;
            return ['ruta' => $ruta, 'ok' => true];
        });

        $primera = $cache->obtener('move/85');
        $segunda = $cache->obtener('move/85');

        $this->assertSame(1, $llamadas, 'La segunda lectura no debe tocar la red');
        $this->assertSame('move/85', $primera['ruta']);
        $this->assertSame($primera, $segunda);
        $this->assertTrue($cache->estaEnCache('move/85'));
    }

    public function test_rutas_distintas_no_colisionan_en_disco(): void
    {
        $cache = new CachePokeApi($this->dir, fn (string $ruta) => ['ruta' => $ruta]);

        $cache->obtener('move/85');
        $cache->obtener('pokemon/85');

        $this->assertSame('move/85', $cache->obtener('move/85')['ruta']);
        $this->assertSame('pokemon/85', $cache->obtener('pokemon/85')['ruta']);
    }

    public function test_obtener_varias_devuelve_mapa_por_ruta(): void
    {
        $cache = new CachePokeApi($this->dir, fn (string $ruta) => ['ruta' => $ruta]);

        $resultado = $cache->obtenerVarias(['type/1', 'type/2']);

        $this->assertSame(['type/1', 'type/2'], array_keys($resultado));
        $this->assertSame('type/2', $resultado['type/2']['ruta']);
    }
}
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run:
```bash
cd xampp/htdocs && ../php/php.exe vendor/bin/phpunit tests/Unit/Pokemon/CachePokeApiTest.php
```
Expected: FALLO, `Class "App\Services\Pokemon\CachePokeApi" not found`.

- [ ] **Step 3: Implementar la caché**

```php
<?php

namespace App\Services\Pokemon;

use Illuminate\Support\Facades\Http;
use RuntimeException;

class CachePokeApi
{
    private const BASE = 'https://pokeapi.co/api/v2/';

    /** @var callable(string): array */
    private $descargador;

    public function __construct(
        private readonly string $directorio,
        ?callable $descargador = null
    ) {
        if (!is_dir($this->directorio)) {
            mkdir($this->directorio, 0777, true);
        }

        $this->descargador = $descargador ?? function (string $ruta): array {
            $respuesta = Http::timeout(30)->retry(3, 500)->get(self::BASE . $ruta);

            if (!$respuesta->successful()) {
                throw new RuntimeException("PokéAPI devolvió {$respuesta->status()} para {$ruta}");
            }

            return $respuesta->json();
        };
    }

    public function estaEnCache(string $ruta): bool
    {
        return is_file($this->rutaEnDisco($ruta));
    }

    public function obtener(string $ruta): array
    {
        $fichero = $this->rutaEnDisco($ruta);

        if (is_file($fichero)) {
            $contenido = json_decode(file_get_contents($fichero), true);

            if (is_array($contenido)) {
                return $contenido;
            }
        }

        $datos = ($this->descargador)($ruta);

        file_put_contents($fichero, json_encode($datos, JSON_UNESCAPED_UNICODE));

        return $datos;
    }

    /**
     * @param string[] $rutas
     * @return array<string, array>
     */
    public function obtenerVarias(array $rutas, int $concurrencia = 8): array
    {
        $resultado = [];

        foreach (array_chunk($rutas, max(1, $concurrencia)) as $lote) {
            foreach ($lote as $ruta) {
                $resultado[$ruta] = $this->obtener($ruta);
            }
        }

        return $resultado;
    }

    private function rutaEnDisco(string $ruta): string
    {
        return $this->directorio . '/' . str_replace(['/', '\\'], '_', trim($ruta, '/')) . '.json';
    }
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run:
```bash
cd xampp/htdocs && ../php/php.exe vendor/bin/phpunit tests/Unit/Pokemon/CachePokeApiTest.php
```
Expected: `OK (3 tests)`.

- [ ] **Step 5: Commit**

```bash
git add xampp/htdocs/app/Services/Pokemon xampp/htdocs/tests/Unit/Pokemon
git commit -m "feat(pokemon): add pokeapi disk cache"
```

---

### Task 3: Mapeador de movimientos y clasificación de efectos

**Files:**
- Create: `xampp/htdocs/app/Services/Pokemon/MapeadorMovimiento.php`
- Create: `xampp/htdocs/tests/Fixtures/Pokemon/move-85.json` (copiar desde la caché tras el primer import, o desde `https://pokeapi.co/api/v2/move/85`)
- Create: `xampp/htdocs/tests/Fixtures/Pokemon/move-aurora-veil.json`
- Test: `xampp/htdocs/tests/Unit/Pokemon/MapeadorMovimientoTest.php`

**Interfaces:**
- Consumes: JSON crudo de `/move/{id}` (PokéAPI) y la entrada del mismo movimiento en `BattleMovedex` (Showdown)
- Produces:
  - `MapeadorMovimiento::fila(array $json, ?array $sd, array $tiposPorNombre): array` — fila lista para `pokemon_moves`
  - `MapeadorMovimiento::CATEGORIAS_GENERICAS` — las 11 categorías resolubles por datos
  - `MapeadorMovimiento::CATEGORIAS_MANUALES` — `field-effect`, `whole-field-effect`, `unique`
  - `MapeadorMovimiento::claveShowdown(string $nombre): string` — `aurora-veil` → `auroraveil`

Dos claves del diseño:

1. `effect_code` sale de `meta.category` para las genéricas, y vale `manual_<nombre>` para las tres manuales, **salvo** que Showdown aporte una primitiva (`sideCondition`, `weather`, `terrain`, `volatileStatus`), en cuyo caso el código es `bando_<x>`, `clima_<x>`, `terreno_<x>` o `volatil_<x>`. Eso convierte movimientos "manuales" en instancias de primitivas reutilizables.
2. El `$sd` es opcional: si Showdown no tiene el movimiento, la fila se rellena igual con lo de PokéAPI y queda `vigente = 0`.

- [ ] **Step 1: Escribir la prueba que falla**

```php
<?php

namespace Tests\Unit\Pokemon;

use App\Services\Pokemon\MapeadorMovimiento;
use PHPUnit\Framework\TestCase;

class MapeadorMovimientoTest extends TestCase
{
    private array $tipos = ['electric' => 13, 'ice' => 15, 'psychic' => 14];

    private function fixture(string $nombre): array
    {
        return json_decode(file_get_contents(__DIR__ . '/../../Fixtures/Pokemon/' . $nombre . '.json'), true);
    }

    private function showdown(string $clave): array
    {
        $todos = json_decode(file_get_contents(__DIR__ . '/../../Fixtures/Pokemon/showdown-moves.json'), true);

        return $todos[$clave];
    }

    public function test_movimiento_de_dano_con_estado(): void
    {
        $fila = MapeadorMovimiento::fila($this->fixture('move-85'), $this->showdown('thunderbolt'), $this->tipos);

        $this->assertSame(85, $fila['id']);
        $this->assertSame('Rayo', $fila['nombre_es']);
        $this->assertSame(13, $fila['type_id']);
        $this->assertSame('special', $fila['clase']);
        $this->assertSame(90, $fila['potencia']);
        $this->assertSame(100, $fila['precision_pct']);
        $this->assertSame(15, $fila['pp']);
        $this->assertSame(0, $fila['prioridad']);
        $this->assertSame('damage-ailment', $fila['categoria']);
        $this->assertSame('damage-ailment', $fila['effect_code']);
        $this->assertSame('paralysis', $fila['dolencia']);
        $this->assertSame(10, $fila['dolencia_chance']);
        $this->assertSame(1, $fila['vigente']);
        $this->assertSame(1, json_decode($fila['flags'], true)['protect'] ?? 0, 'Rayo es bloqueable por Protección');
    }

    public function test_velo_aurora_se_resuelve_como_condicion_de_bando(): void
    {
        $fila = MapeadorMovimiento::fila(
            $this->fixture('move-aurora-veil'),
            $this->showdown('auroraveil'),
            $this->tipos
        );

        $this->assertSame('Velo Aurora', $fila['nombre_es']);
        $this->assertSame('field-effect', $fila['categoria']);
        $this->assertSame('users-field', $fila['objetivo']);
        $this->assertSame('auroraveil', $fila['condicion_bando']);
        $this->assertSame(5, $fila['duracion'], 'La duración viene en los datos, no se escribe a mano');
        $this->assertSame('bando_auroraveil', $fila['effect_code']);
    }

    public function test_amago_rompe_proteccion_y_no_es_bloqueable(): void
    {
        $fila = MapeadorMovimiento::fila(
            $this->fixture('move-feint'),
            $this->showdown('feint'),
            $this->tipos
        );

        $this->assertSame(2, $fila['prioridad']);
        $this->assertSame(1, $fila['rompe_proteccion']);
        $this->assertSame(0, json_decode($fila['flags'], true)['protect'] ?? 0);
    }

    public function test_sin_datos_de_showdown_la_fila_queda_no_vigente(): void
    {
        $fila = MapeadorMovimiento::fila($this->fixture('move-85'), null, $this->tipos);

        $this->assertSame(0, $fila['vigente']);
        $this->assertSame(85, $fila['id']);
    }

    public function test_clave_showdown_normaliza_el_nombre(): void
    {
        $this->assertSame('auroraveil', MapeadorMovimiento::claveShowdown('aurora-veil'));
        $this->assertSame('thunderbolt', MapeadorMovimiento::claveShowdown('thunderbolt'));
        $this->assertSame('kingsshield', MapeadorMovimiento::claveShowdown("king's-shield"));
    }

    public function test_el_reparto_de_categorias_no_solapa(): void
    {
        $solape = array_intersect(
            MapeadorMovimiento::CATEGORIAS_GENERICAS,
            MapeadorMovimiento::CATEGORIAS_MANUALES
        );

        $this->assertSame([], $solape);
        $this->assertCount(
            14,
            array_merge(MapeadorMovimiento::CATEGORIAS_GENERICAS, MapeadorMovimiento::CATEGORIAS_MANUALES)
        );
    }
}
```

- [ ] **Step 2: Descargar los ficheros de ejemplo de las dos fuentes**

Run:
```bash
cd xampp/htdocs && mkdir -p tests/Fixtures/Pokemon
curl -s "https://pokeapi.co/api/v2/move/85" -o tests/Fixtures/Pokemon/move-85.json
curl -s "https://pokeapi.co/api/v2/move/aurora-veil" -o tests/Fixtures/Pokemon/move-aurora-veil.json
curl -s "https://pokeapi.co/api/v2/move/feint" -o tests/Fixtures/Pokemon/move-feint.json

curl -s "https://play.pokemonshowdown.com/data/moves.js" -o tests/Fixtures/Pokemon/showdown-moves.js
node -e "const m=require('./tests/Fixtures/Pokemon/showdown-moves.js').BattleMovedex; const k=['thunderbolt','auroraveil','feint']; const o={}; for(const n of k) o[n]=m[n]; require('fs').writeFileSync('tests/Fixtures/Pokemon/showdown-moves.json', JSON.stringify(o));"
rm tests/Fixtures/Pokemon/showdown-moves.js
```

Expected: cuatro ficheros JSON. Solo se guardan tres entradas de Showdown, no las 954, para que el fichero de ejemplo sea pequeño.

Comprobar:
```bash
cd xampp/htdocs && node -e "const o=require('./tests/Fixtures/Pokemon/showdown-moves.json'); console.log(Object.keys(o), o.auroraveil.sideCondition, o.auroraveil.condition.duration, o.feint.breaksProtect);"
```
Expected: `[ 'thunderbolt', 'auroraveil', 'feint' ] auroraveil 5 true`.

- [ ] **Step 3: Ejecutar y verificar que falla**

Run:
```bash
cd xampp/htdocs && ../php/php.exe vendor/bin/phpunit tests/Unit/Pokemon/MapeadorMovimientoTest.php
```
Expected: FALLO, `Class "App\Services\Pokemon\MapeadorMovimiento" not found`.

- [ ] **Step 4: Implementar el mapeador**

```php
<?php

namespace App\Services\Pokemon;

class MapeadorMovimiento
{
    public const CATEGORIAS_GENERICAS = [
        'damage',
        'ailment',
        'net-good-stats',
        'heal',
        'damage-ailment',
        'swagger',
        'damage-lower',
        'damage-raise',
        'damage-heal',
        'ohko',
        'force-switch',
    ];

    public const CATEGORIAS_MANUALES = [
        'whole-field-effect',
        'field-effect',
        'unique',
    ];

    /**
     * @param array|null $sd Entrada del movimiento en BattleMovedex de Showdown, o null si no existe
     * @param array<string, int> $tiposPorNombre
     */
    public static function fila(array $json, ?array $sd, array $tiposPorNombre): array
    {
        $meta = $json['meta'] ?? [];
        $categoria = $meta['category']['name'] ?? 'unique';
        $sd = $sd ?? [];

        $condicionBando = $sd['sideCondition'] ?? null;
        $clima = $sd['weather'] ?? null;
        $terreno = $sd['terrain'] ?? null;
        $volatil = $sd['volatileStatus'] ?? null;

        return [
            'id' => (int) $json['id'],
            'nombre' => $json['name'],
            'nombre_es' => self::nombreEs($json),
            'type_id' => $tiposPorNombre[$json['type']['name']] ?? 1,
            'clase' => $json['damage_class']['name'] ?? 'status',
            'potencia' => $json['power'],
            'precision_pct' => $json['accuracy'],
            'pp' => (int) ($json['pp'] ?? 5),
            'prioridad' => (int) ($json['priority'] ?? 0),
            'objetivo' => $json['target']['name'] ?? 'selected-pokemon',
            'categoria' => $categoria,
            'effect_code' => self::codigoDeEfecto($categoria, $json['name'], $sd),
            'effect_chance' => $json['effect_chance'],
            'dolencia' => $meta['ailment']['name'] ?? 'none',
            'dolencia_chance' => (int) ($meta['ailment_chance'] ?? 0),
            'golpes_min' => $meta['min_hits'] ?? null,
            'golpes_max' => $meta['max_hits'] ?? null,
            'turnos_min' => $meta['min_turns'] ?? null,
            'turnos_max' => $meta['max_turns'] ?? null,
            'drenaje' => (int) ($meta['drain'] ?? 0),
            'curacion' => (int) ($meta['healing'] ?? 0),
            'ratio_critico' => (int) ($meta['crit_rate'] ?? 0),
            'retroceso_chance' => (int) ($meta['flinch_chance'] ?? 0),
            'stat_chance' => (int) ($meta['stat_chance'] ?? 0),
            'cambios_stats' => json_encode(array_map(
                fn (array $c) => ['stat' => $c['stat']['name'], 'cambio' => $c['change']],
                $json['stat_changes'] ?? []
            ), JSON_UNESCAPED_UNICODE),

            // --- mecánica de Showdown ---
            'vigente' => self::esVigente($sd) ? 1 : 0,
            'flags' => json_encode($sd['flags'] ?? [], JSON_UNESCAPED_UNICODE),
            'rompe_proteccion' => !empty($sd['breaksProtect']) ? 1 : 0,
            'ignora_habilidad' => !empty($sd['ignoreAbility']) ? 1 : 0,
            'ignora_defensa' => !empty($sd['ignoreDefensive']) ? 1 : 0,
            'ignora_evasion' => !empty($sd['ignoreEvasion']) ? 1 : 0,
            'ignora_inmunidad' => !empty($sd['ignoreImmunity']) ? 1 : 0,
            'critico_seguro' => !empty($sd['willCrit']) ? 1 : 0,
            'retroceso_dano' => isset($sd['recoil']) ? implode('/', $sd['recoil']) : null,
            'stat_ofensivo_forzado' => $sd['overrideOffensiveStat'] ?? null,
            'stat_defensivo_forzado' => $sd['overrideDefensiveStat'] ?? null,
            'condicion_bando' => $condicionBando,
            'condicion_hueco' => $sd['slotCondition'] ?? null,
            'estado_volatil' => $volatil,
            'estado' => $sd['status'] ?? null,
            'clima' => $clima,
            'terreno' => $terreno,
            'duracion' => $sd['condition']['duration'] ?? null,
            'cambio_forzado' => !empty($sd['forceSwitch']) ? 1 : 0,
            'autocambio' => !empty($sd['selfSwitch']) ? 1 : 0,
        ];
    }

    /**
     * Un movimiento es vigente si Showdown lo conoce y no es Z, Dinamax ni retirado.
     */
    public static function esVigente(array $sd): bool
    {
        if ($sd === []) {
            return false;
        }

        return empty($sd['isZ']) && empty($sd['isMax']) && empty($sd['isNonstandard']);
    }

    /**
     * El código de efecto prefiere la primitiva reutilizable de Showdown sobre
     * marcar el movimiento como manual, para no escribir código por movimiento.
     */
    public static function codigoDeEfecto(string $categoria, string $nombreMovimiento, array $sd = []): string
    {
        if (!empty($sd['sideCondition'])) return 'bando_' . $sd['sideCondition'];
        if (!empty($sd['weather'])) return 'clima_' . strtolower($sd['weather']);
        if (!empty($sd['terrain'])) return 'terreno_' . strtolower($sd['terrain']);
        if (!empty($sd['slotCondition'])) return 'hueco_' . $sd['slotCondition'];
        if (!empty($sd['volatileStatus'])) return 'volatil_' . $sd['volatileStatus'];

        return in_array($categoria, self::CATEGORIAS_MANUALES, true)
            ? 'manual_' . $nombreMovimiento
            : $categoria;
    }

    /**
     * PokéAPI usa `aurora-veil`; Showdown usa `auroraveil`.
     */
    public static function claveShowdown(string $nombre): string
    {
        return preg_replace('/[^a-z0-9]/', '', strtolower($nombre));
    }

    private static function nombreEs(array $json): string
    {
        foreach ($json['names'] ?? [] as $nombre) {
            if (($nombre['language']['name'] ?? null) === 'es') {
                return $nombre['name'];
            }
        }

        foreach ($json['names'] ?? [] as $nombre) {
            if (($nombre['language']['name'] ?? null) === 'en') {
                return $nombre['name'];
            }
        }

        return $json['name'];
    }
}
```

- [ ] **Step 5: Ejecutar y verificar que pasa**

Run:
```bash
cd xampp/htdocs && ../php/php.exe vendor/bin/phpunit tests/Unit/Pokemon/MapeadorMovimientoTest.php
```
Expected: `OK (3 tests)`.

- [ ] **Step 6: Commit**

```bash
git add xampp/htdocs/app/Services/Pokemon xampp/htdocs/tests
git commit -m "feat(pokemon): add move mapper with effect classification"
```

---

### Task 4: Mapeador de especies

**Files:**
- Create: `xampp/htdocs/app/Services/Pokemon/MapeadorEspecie.php`
- Create: `xampp/htdocs/tests/Fixtures/Pokemon/species-25.json` y `pokemon-25.json`
- Test: `xampp/htdocs/tests/Unit/Pokemon/MapeadorEspecieTest.php`

**Interfaces:**
- Consumes: JSON de `/pokemon-species/{id}` y de `/pokemon/{id}`
- Produces: `MapeadorEspecie::fila(array $especie, array $pokemon, array $tiposPorNombre): array`

Los dos JSON hacen falta porque PokéAPI reparte los datos: la especie trae catch_rate, ratio de género, egg groups, growth rate y legendario; el pokémon trae stats base, tipos, habilidades, altura y peso.

- [ ] **Step 1: Descargar los ficheros de ejemplo**

Run:
```bash
cd xampp/htdocs
curl -s "https://pokeapi.co/api/v2/pokemon-species/25" -o tests/Fixtures/Pokemon/species-25.json
curl -s "https://pokeapi.co/api/v2/pokemon/25" -o tests/Fixtures/Pokemon/pokemon-25.json
```

- [ ] **Step 2: Escribir la prueba que falla**

```php
<?php

namespace Tests\Unit\Pokemon;

use App\Services\Pokemon\MapeadorEspecie;
use PHPUnit\Framework\TestCase;

class MapeadorEspecieTest extends TestCase
{
    private function fixture(string $nombre): array
    {
        return json_decode(file_get_contents(__DIR__ . '/../../Fixtures/Pokemon/' . $nombre . '.json'), true);
    }

    public function test_mapea_pikachu(): void
    {
        $fila = MapeadorEspecie::fila(
            $this->fixture('species-25'),
            $this->fixture('pokemon-25'),
            ['electric' => 13]
        );

        $this->assertSame(25, $fila['id']);
        $this->assertSame('Pikachu', $fila['nombre_es']);
        $this->assertSame(13, $fila['type_id']);
        $this->assertNull($fila['type_2_id']);
        $this->assertSame(35, $fila['base_hp']);
        $this->assertSame(55, $fila['base_attack']);
        $this->assertSame(90, $fila['base_speed']);
        $this->assertSame(2, $fila['yield_speed'], 'Pikachu da 2 EV de Velocidad');
        $this->assertSame(190, $fila['catch_rate']);
        $this->assertSame(50.0, $fila['female_ratio']);
        $this->assertSame(0, $fila['es_legendario']);
    }

    public function test_el_ratio_de_genero_negativo_significa_sin_genero(): void
    {
        $especie = $this->fixture('species-25');
        $especie['gender_rate'] = -1;

        $fila = MapeadorEspecie::fila($especie, $this->fixture('pokemon-25'), ['electric' => 13]);

        $this->assertNull($fila['female_ratio']);
    }
}
```

- [ ] **Step 3: Ejecutar y verificar que falla**

Run:
```bash
cd xampp/htdocs && ../php/php.exe vendor/bin/phpunit tests/Unit/Pokemon/MapeadorEspecieTest.php
```
Expected: FALLO, clase no encontrada.

- [ ] **Step 4: Implementar el mapeador**

`gender_rate` de PokéAPI viene en octavos de hembra: `-1` es sin género y `4` es 50%.

```php
<?php

namespace App\Services\Pokemon;

class MapeadorEspecie
{
    /**
     * @param array<string, int> $tiposPorNombre
     */
    public static function fila(array $especie, array $pokemon, array $tiposPorNombre): array
    {
        $stats = self::stats($pokemon);
        $yields = self::yields($pokemon);
        $tipos = self::tipos($pokemon, $tiposPorNombre);
        $habilidades = self::habilidades($pokemon);

        return [
            'id' => (int) $especie['id'],
            'form_id' => 0,
            'nombre' => $especie['name'],
            'nombre_es' => self::nombreEs($especie),
            'generacion' => self::generacion($especie),
            'type_1_id' => $tipos[0],
            'type_2_id' => $tipos[1],
            'base_hp' => $stats['hp'],
            'base_attack' => $stats['attack'],
            'base_defense' => $stats['defense'],
            'base_sp_attack' => $stats['special-attack'],
            'base_sp_defense' => $stats['special-defense'],
            'base_speed' => $stats['speed'],
            'yield_hp' => $yields['hp'],
            'yield_attack' => $yields['attack'],
            'yield_defense' => $yields['defense'],
            'yield_sp_attack' => $yields['special-attack'],
            'yield_sp_defense' => $yields['special-defense'],
            'yield_speed' => $yields['speed'],
            'ability_1_id' => $habilidades['normal'][0] ?? null,
            'ability_2_id' => $habilidades['normal'][1] ?? null,
            'ability_hidden_id' => $habilidades['oculta'] ?? null,
            'catch_rate' => (int) ($especie['capture_rate'] ?? 255),
            'base_experience' => (int) ($pokemon['base_experience'] ?? 50),
            'growth_rate' => $especie['growth_rate']['name'] ?? 'medium',
            'female_ratio' => self::ratioHembra($especie),
            'egg_group_1' => $especie['egg_groups'][0]['name'] ?? null,
            'egg_group_2' => $especie['egg_groups'][1]['name'] ?? null,
            'egg_steps' => (int) (($especie['hatch_counter'] ?? 20) + 1) * 255,
            'base_friendship' => (int) ($especie['base_happiness'] ?? 70),
            'altura' => ((int) ($pokemon['height'] ?? 0)) / 10,
            'peso' => ((int) ($pokemon['weight'] ?? 0)) / 10,
            'es_legendario' => !empty($especie['is_legendary']) ? 1 : 0,
            'es_singular' => !empty($especie['is_mythical']) ? 1 : 0,
        ];
    }

    private static function stats(array $pokemon): array
    {
        $salida = [];

        foreach ($pokemon['stats'] ?? [] as $stat) {
            $salida[$stat['stat']['name']] = (int) $stat['base_stat'];
        }

        return $salida + [
            'hp' => 1, 'attack' => 1, 'defense' => 1,
            'special-attack' => 1, 'special-defense' => 1, 'speed' => 1,
        ];
    }

    private static function yields(array $pokemon): array
    {
        $salida = [];

        foreach ($pokemon['stats'] ?? [] as $stat) {
            $salida[$stat['stat']['name']] = (int) $stat['effort'];
        }

        return $salida + [
            'hp' => 0, 'attack' => 0, 'defense' => 0,
            'special-attack' => 0, 'special-defense' => 0, 'speed' => 0,
        ];
    }

    /**
     * @return array{0: int, 1: ?int}
     */
    private static function tipos(array $pokemon, array $tiposPorNombre): array
    {
        $ids = [];

        foreach ($pokemon['types'] ?? [] as $tipo) {
            $ids[] = $tiposPorNombre[$tipo['type']['name']] ?? 1;
        }

        return [$ids[0] ?? 1, $ids[1] ?? null];
    }

    /**
     * @return array{normal: int[], oculta: ?int}
     */
    private static function habilidades(array $pokemon): array
    {
        $normales = [];
        $oculta = null;

        foreach ($pokemon['abilities'] ?? [] as $habilidad) {
            $id = (int) basename(rtrim($habilidad['ability']['url'], '/'));

            if (!empty($habilidad['is_hidden'])) {
                $oculta = $id;
                continue;
            }

            $normales[] = $id;
        }

        return ['normal' => $normales, 'oculta' => $oculta];
    }

    private static function ratioHembra(array $especie): ?float
    {
        $tasa = $especie['gender_rate'] ?? -1;

        return $tasa < 0 ? null : round($tasa * 12.5, 1);
    }

    private static function generacion(array $especie): int
    {
        $nombre = $especie['generation']['name'] ?? 'generation-i';
        $romanos = [
            'i' => 1, 'ii' => 2, 'iii' => 3, 'iv' => 4, 'v' => 5,
            'vi' => 6, 'vii' => 7, 'viii' => 8, 'ix' => 9,
        ];

        $sufijo = substr($nombre, strlen('generation-'));

        return $romanos[$sufijo] ?? 1;
    }

    private static function nombreEs(array $especie): string
    {
        foreach ($especie['names'] ?? [] as $nombre) {
            if (($nombre['language']['name'] ?? null) === 'es') {
                return $nombre['name'];
            }
        }

        return ucfirst($especie['name']);
    }
}
```

- [ ] **Step 5: Ejecutar y verificar que pasa**

Run:
```bash
cd xampp/htdocs && ../php/php.exe vendor/bin/phpunit tests/Unit/Pokemon/MapeadorEspecieTest.php
```
Expected: `OK (2 tests)`.

- [ ] **Step 6: Commit**

```bash
git add xampp/htdocs/app/Services/Pokemon xampp/htdocs/tests
git commit -m "feat(pokemon): add species mapper"
```

---

### Task 5: Comando de importación

**Files:**
- Create: `xampp/htdocs/app/Console/Commands/PokemonImportCatalog.php`

**Interfaces:**
- Consumes: `CachePokeApi`, `MapeadorEspecie`, `MapeadorMovimiento`
- Produces: comando `pokemon:import-catalog` con opciones `--solo=` (tipos|habilidades|especies|movimientos|learnsets|evoluciones) y `--limite=` para pruebas

El comando **aborta si la versión de esquema es menor que 2**, porque el dueño del esquema es el plugin y no debe adivinarlo.

- [ ] **Step 1: Escribir el comando**

```php
<?php

namespace App\Console\Commands;

use App\Services\Pokemon\CachePokeApi;
use App\Services\Pokemon\MapeadorEspecie;
use App\Services\Pokemon\MapeadorMovimiento;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class PokemonImportCatalog extends Command
{
    protected $signature = 'pokemon:import-catalog
        {--solo= : tipos|habilidades|especies|movimientos|learnsets|evoluciones}
        {--limite=0 : Importar solo los N primeros de cada recurso, para pruebas}';

    protected $description = 'Importa el catálogo Pokémon desde PokéAPI a las tablas del plugin';

    private CachePokeApi $cache;

    public function handle(): int
    {
        if (!$this->esquemaListo()) {
            $this->error('El esquema no está en la versión 2. Arranca el plugin PokemonEngine primero.');
            return self::FAILURE;
        }

        $this->cache = new CachePokeApi(storage_path('app/pokemon-cache'));

        $solo = $this->option('solo');
        $pasos = ['tipos', 'habilidades', 'especies', 'movimientos', 'learnsets', 'evoluciones'];

        foreach ($pasos as $paso) {
            if ($solo && $solo !== $paso) {
                continue;
            }

            $this->info("Importando {$paso}…");
            $this->{'importar' . ucfirst($paso)}();
        }

        $this->info('Catálogo importado.');

        return self::SUCCESS;
    }

    private function esquemaListo(): bool
    {
        try {
            return (int) DB::table('pokemon_schema_version')->max('version') >= 2;
        } catch (\Throwable) {
            return false;
        }
    }

    private function limite(int $total): int
    {
        $limite = (int) $this->option('limite');

        return $limite > 0 ? min($limite, $total) : $total;
    }

    private function tiposPorNombre(): array
    {
        return DB::table('pokemon_types')->pluck('id', 'nombre')->all();
    }

    private function importarTipos(): void
    {
        $indice = $this->cache->obtener('type?limit=100');

        foreach ($indice['results'] as $entrada) {
            $tipo = $this->cache->obtener('type/' . basename(rtrim($entrada['url'], '/')));

            if ($tipo['id'] > 10000) {
                continue;
            }

            DB::table('pokemon_types')->updateOrInsert(
                ['id' => $tipo['id']],
                ['nombre' => $tipo['name'], 'nombre_es' => $this->nombreEs($tipo, $tipo['name'])]
            );
        }

        $this->importarTablaDeTipos();
    }

    private function importarTablaDeTipos(): void
    {
        $ids = DB::table('pokemon_types')->pluck('id', 'nombre')->all();
        $filas = [];

        foreach ($ids as $nombre => $id) {
            $tipo = $this->cache->obtener('type/' . $id);
            $relaciones = $tipo['damage_relations'];

            foreach ($ids as $nombreDefensor => $idDefensor) {
                $multiplicador = 1.0;

                foreach ($relaciones['no_damage_to'] as $r) {
                    if ($r['name'] === $nombreDefensor) $multiplicador = 0.0;
                }
                foreach ($relaciones['half_damage_to'] as $r) {
                    if ($r['name'] === $nombreDefensor) $multiplicador = 0.5;
                }
                foreach ($relaciones['double_damage_to'] as $r) {
                    if ($r['name'] === $nombreDefensor) $multiplicador = 2.0;
                }

                $filas[] = [
                    'atacante_id' => $id,
                    'defensor_id' => $idDefensor,
                    'multiplicador' => $multiplicador,
                ];
            }
        }

        DB::table('pokemon_type_chart')->upsert($filas, ['atacante_id', 'defensor_id'], ['multiplicador']);

        $this->line('  Tabla de tipos: ' . count($filas) . ' combinaciones');
    }

    private function importarHabilidades(): void
    {
        $indice = $this->cache->obtener('ability?limit=400');
        $total = $this->limite(count($indice['results']));
        $barra = $this->output->createProgressBar($total);

        foreach (array_slice($indice['results'], 0, $total) as $entrada) {
            $id = (int) basename(rtrim($entrada['url'], '/'));
            $habilidad = $this->cache->obtener('ability/' . $id);

            DB::table('pokemon_abilities_cat')->updateOrInsert(
                ['id' => $id],
                [
                    'nombre' => $habilidad['name'],
                    'nombre_es' => $this->nombreEs($habilidad, $habilidad['name']),
                    'descripcion_es' => $this->textoEs($habilidad),
                ]
            );

            $barra->advance();
        }

        $barra->finish();
        $this->newLine();
    }

    private function importarEspecies(): void
    {
        $indice = $this->cache->obtener('pokemon-species?limit=1100');
        $total = $this->limite(count($indice['results']));
        $tipos = $this->tiposPorNombre();
        $barra = $this->output->createProgressBar($total);

        foreach (array_slice($indice['results'], 0, $total) as $entrada) {
            $id = (int) basename(rtrim($entrada['url'], '/'));

            $especie = $this->cache->obtener('pokemon-species/' . $id);
            $pokemon = $this->cache->obtener('pokemon/' . $id);

            $fila = MapeadorEspecie::fila($especie, $pokemon, $tipos);

            DB::table('pokemon_species')->updateOrInsert(
                ['id' => $fila['id'], 'form_id' => $fila['form_id']],
                $fila
            );

            $barra->advance();
        }

        $barra->finish();
        $this->newLine();
    }

    /**
     * Descarga el moves.js de Showdown una sola vez y lo convierte a JSON con Node,
     * porque es JavaScript con claves sin comillas y no se puede parsear como JSON.
     *
     * @return array<string, array>
     */
    private function movimientosShowdown(): array
    {
        $destinoJson = storage_path('app/pokemon-cache/showdown-moves.json');

        if (is_file($destinoJson)) {
            return json_decode(file_get_contents($destinoJson), true);
        }

        $destinoJs = storage_path('app/pokemon-cache/showdown-moves.js');

        if (!is_file($destinoJs)) {
            $this->line('  Descargando datos de Showdown…');
            file_put_contents($destinoJs, file_get_contents('https://play.pokemonshowdown.com/data/moves.js'));
        }

        $script = sprintf(
            'console.log(JSON.stringify(require(%s).BattleMovedex))',
            json_encode(str_replace('\\', '/', $destinoJs))
        );

        $salida = shell_exec('node -e ' . escapeshellarg($script));

        if (!$salida) {
            throw new \RuntimeException('No se pudo convertir moves.js con Node. ¿Está node en el PATH?');
        }

        file_put_contents($destinoJson, $salida);

        return json_decode($salida, true);
    }

    private function importarMovimientos(): void
    {
        $indice = $this->cache->obtener('move?limit=1000');
        $total = $this->limite(count($indice['results']));
        $tipos = $this->tiposPorNombre();
        $showdown = $this->movimientosShowdown();
        $barra = $this->output->createProgressBar($total);
        $efectos = [];
        $sinShowdown = 0;

        foreach (array_slice($indice['results'], 0, $total) as $entrada) {
            $id = (int) basename(rtrim($entrada['url'], '/'));
            $movimiento = $this->cache->obtener('move/' . $id);

            $clave = MapeadorMovimiento::claveShowdown($movimiento['name']);
            $sd = $showdown[$clave] ?? null;

            if ($sd === null) {
                $sinShowdown++;
            }

            $fila = MapeadorMovimiento::fila($movimiento, $sd, $tipos);

            DB::table('pokemon_moves')->updateOrInsert(['id' => $fila['id']], $fila);

            $efectos[$fila['effect_code']] = $fila['categoria'];

            $barra->advance();
        }

        $barra->finish();
        $this->newLine();

        foreach ($efectos as $codigo => $categoria) {
            DB::table('pokemon_move_effects')->updateOrInsert(
                ['effect_code' => $codigo],
                ['descripcion' => 'Categoría ' . $categoria]
            );
        }

        $this->line('  Efectos distintos: ' . count($efectos));
        $this->line('  Movimientos sin entrada en Showdown: ' . $sinShowdown . ' (quedan como no vigentes)');
    }

    private function importarLearnsets(): void
    {
        $indice = $this->cache->obtener('pokemon-species?limit=1100');
        $total = $this->limite(count($indice['results']));
        $barra = $this->output->createProgressBar($total);

        foreach (array_slice($indice['results'], 0, $total) as $entrada) {
            $id = (int) basename(rtrim($entrada['url'], '/'));
            $pokemon = $this->cache->obtener('pokemon/' . $id);
            $filas = [];

            foreach ($pokemon['moves'] ?? [] as $movimiento) {
                $moveId = (int) basename(rtrim($movimiento['move']['url'], '/'));

                foreach ($movimiento['version_group_details'] as $detalle) {
                    $filas[] = [
                        'species_id' => $id,
                        'form_id' => 0,
                        'move_id' => $moveId,
                        'metodo' => $detalle['move_learn_method']['name'],
                        'nivel' => (int) $detalle['level_learned_at'],
                    ];
                }
            }

            $unicas = array_values(array_unique($filas, SORT_REGULAR));

            foreach (array_chunk($unicas, 500) as $lote) {
                DB::table('pokemon_learnsets')->upsert(
                    $lote,
                    ['species_id', 'form_id', 'move_id', 'metodo', 'nivel'],
                    ['nivel']
                );
            }

            $barra->advance();
        }

        $barra->finish();
        $this->newLine();
    }

    private function importarEvoluciones(): void
    {
        $indice = $this->cache->obtener('evolution-chain?limit=600');
        $total = $this->limite(count($indice['results']));
        $barra = $this->output->createProgressBar($total);

        DB::table('pokemon_species_evolution')->truncate();

        foreach (array_slice($indice['results'], 0, $total) as $entrada) {
            $id = (int) basename(rtrim($entrada['url'], '/'));
            $cadena = $this->cache->obtener('evolution-chain/' . $id);

            $this->recorrerCadena($cadena['chain']);

            $barra->advance();
        }

        $barra->finish();
        $this->newLine();
    }

    private function recorrerCadena(array $nodo): void
    {
        $origenId = (int) basename(rtrim($nodo['species']['url'], '/'));

        foreach ($nodo['evolves_to'] ?? [] as $hijo) {
            $destinoId = (int) basename(rtrim($hijo['species']['url'], '/'));

            foreach ($hijo['evolution_details'] ?? [] as $detalle) {
                DB::table('pokemon_species_evolution')->insert([
                    'origen_id' => $origenId,
                    'destino_id' => $destinoId,
                    'metodo' => $detalle['trigger']['name'] ?? 'level-up',
                    'parametro' => $detalle['item']['name'] ?? ($detalle['held_item']['name'] ?? null),
                    'nivel_minimo' => $detalle['min_level'] ?? null,
                    'condicion' => $this->condicion($detalle),
                ]);
            }

            $this->recorrerCadena($hijo);
        }
    }

    private function condicion(array $detalle): ?string
    {
        $partes = [];

        if (!empty($detalle['min_happiness'])) $partes[] = 'amistad>=' . $detalle['min_happiness'];
        if (!empty($detalle['time_of_day'])) $partes[] = 'hora=' . $detalle['time_of_day'];
        if (!empty($detalle['known_move']['name'])) $partes[] = 'sabe=' . $detalle['known_move']['name'];
        if (!empty($detalle['location']['name'])) $partes[] = 'lugar=' . $detalle['location']['name'];
        if (isset($detalle['gender']) && $detalle['gender'] !== null) $partes[] = 'genero=' . $detalle['gender'];

        return $partes === [] ? null : implode(',', $partes);
    }

    private function nombreEs(array $json, string $porDefecto): string
    {
        foreach ($json['names'] ?? [] as $nombre) {
            if (($nombre['language']['name'] ?? null) === 'es') {
                return $nombre['name'];
            }
        }

        return $porDefecto;
    }

    private function textoEs(array $json): ?string
    {
        foreach ($json['flavor_text_entries'] ?? [] as $entrada) {
            if (($entrada['language']['name'] ?? null) === 'es') {
                return $entrada['flavor_text'];
            }
        }

        return null;
    }
}
```

- [ ] **Step 2: Probar con un límite pequeño**

Run:
```bash
cd xampp/htdocs && ../php/php.exe artisan pokemon:import-catalog --limite=5
```
Expected: importa tipos y tabla de tipos completos, y 5 de cada recurso. Termina con `Catálogo importado.`

- [ ] **Step 3: Comprobar los datos de la prueba corta**

Run:
```bash
./xampp/mysql/bin/mysql.exe -u root habbo_pokemon_test_20260918 -e "SELECT (SELECT COUNT(*) FROM pokemon_types) tipos, (SELECT COUNT(*) FROM pokemon_type_chart) tabla, (SELECT COUNT(*) FROM pokemon_species) especies, (SELECT COUNT(*) FROM pokemon_moves) movimientos; SELECT id,nombre_es,base_speed,yield_speed FROM pokemon_species LIMIT 3;"
```
Expected: 18 tipos, 324 combinaciones en la tabla, 5 especies, 5 movimientos, y nombres en español.

- [ ] **Step 4: Importación completa**

Run:
```bash
cd xampp/htdocs && ../php/php.exe artisan pokemon:import-catalog
```
Expected: barras de progreso hasta el final. La primera pasada tarda varios minutos por la descarga; la caché queda en `storage/app/pokemon-cache/`.

- [ ] **Step 5: Comprobar la idempotencia**

Run:
```bash
cd xampp/htdocs && ../php/php.exe artisan pokemon:import-catalog
```
Expected: mucho más rápido (todo de caché) y los recuentos de la tarea 6 no cambian.

- [ ] **Step 6: Commit**

```bash
git add xampp/htdocs/app/Console/Commands/PokemonImportCatalog.php
git commit -m "feat(pokemon): add catalog import command"
```

---

### Task 6: Verificador del catálogo

**Files:**
- Create: `xampp/htdocs/app/Console/Commands/PokemonVerifyCatalog.php`

**Interfaces:**
- Consumes: las tablas del catálogo
- Produces: comando `pokemon:verify-catalog`, que devuelve código de salida 1 si encuentra incoherencias

- [ ] **Step 1: Escribir el verificador**

```php
<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class PokemonVerifyCatalog extends Command
{
    protected $signature = 'pokemon:verify-catalog';
    protected $description = 'Comprueba la coherencia del catálogo Pokémon y lo que falta por implementar';

    public function handle(): int
    {
        $problemas = 0;

        $this->info('Recuentos');
        $this->table(['Tabla', 'Filas'], [
            ['pokemon_types', DB::table('pokemon_types')->count()],
            ['pokemon_type_chart', DB::table('pokemon_type_chart')->count()],
            ['pokemon_abilities_cat', DB::table('pokemon_abilities_cat')->count()],
            ['pokemon_species', DB::table('pokemon_species')->count()],
            ['pokemon_species_evolution', DB::table('pokemon_species_evolution')->count()],
            ['pokemon_moves', DB::table('pokemon_moves')->count()],
            ['pokemon_learnsets', DB::table('pokemon_learnsets')->count()],
        ]);

        $tabla = DB::table('pokemon_type_chart')->count();
        $tipos = DB::table('pokemon_types')->count();

        if ($tabla !== $tipos * $tipos) {
            $this->error("La tabla de tipos tiene {$tabla} filas y debería tener " . ($tipos * $tipos));
            $problemas++;
        }

        $huerfanos = DB::table('pokemon_learnsets as l')
            ->leftJoin('pokemon_moves as m', 'l.move_id', '=', 'm.id')
            ->whereNull('m.id')
            ->count();

        if ($huerfanos > 0) {
            $this->error("{$huerfanos} filas de learnset apuntan a movimientos inexistentes");
            $problemas++;
        }

        $sinTipo = DB::table('pokemon_species as s')
            ->leftJoin('pokemon_types as t', 's.type_1_id', '=', 't.id')
            ->whereNull('t.id')
            ->count();

        if ($sinTipo > 0) {
            $this->error("{$sinTipo} especies tienen un tipo primario inexistente");
            $problemas++;
        }

        $this->newLine();
        $this->info('Efectos de movimiento');

        $porImplementar = DB::table('pokemon_move_effects')->where('implemented', 0)->count();
        $implementados = DB::table('pokemon_move_effects')->where('implemented', 1)->count();

        $vigentes = DB::table('pokemon_moves')->where('vigente', 1)->count();
        $noVigentes = DB::table('pokemon_moves')->where('vigente', 0)->count();

        $this->line("  Movimientos vigentes: {$vigentes}");
        $this->line("  No vigentes (Z, Dinamax, retirados o sin datos de Showdown): {$noVigentes}");
        $this->line("  Efectos implementados: {$implementados}");
        $this->line("  Efectos sin implementar: {$porImplementar}");

        $this->newLine();
        $this->info('Primitivas que el motor debe implementar');

        foreach ([
            'condicion_bando' => 'Condiciones de bando',
            'clima' => 'Climas',
            'terreno' => 'Terrenos',
            'estado_volatil' => 'Estados volátiles',
            'condicion_hueco' => 'Condiciones de hueco',
        ] as $columna => $titulo) {
            $filas = DB::table('pokemon_moves')
                ->select($columna, DB::raw('COUNT(*) as total'))
                ->whereNotNull($columna)
                ->where('vigente', 1)
                ->groupBy($columna)
                ->orderBy($columna)
                ->get();

            $this->line("  {$titulo}: " . $filas->count() . ' distintas en ' . $filas->sum('total') . ' movimientos');
        }

        $this->newLine();
        $this->info('Movimientos que siguen necesitando código propio');
        $sueltos = DB::table('pokemon_moves')
            ->where('vigente', 1)
            ->where('effect_code', 'like', 'manual_%')
            ->count();

        $this->line("  {$sueltos} movimientos con efecto único sin primitiva asociada");

        if ($problemas > 0) {
            $this->error("{$problemas} problemas de coherencia.");
            return self::FAILURE;
        }

        $this->info('Catálogo coherente.');

        return self::SUCCESS;
    }
}
```

- [ ] **Step 2: Ejecutarlo**

Run:
```bash
cd xampp/htdocs && ../php/php.exe artisan pokemon:verify-catalog
```
Expected: 18 tipos, 324 combinaciones, ~1.025 especies, ~937 movimientos importados de los que **~685 vigentes**, y unas 100.000 filas de learnset. Sin errores de coherencia.

El número que decide el trabajo del hito 3 es el último: **cuántos movimientos vigentes siguen con `manual_`** una vez descontadas las primitivas. Ese recuento, y no el 138 de la estimación inicial con solo PokéAPI, es el alcance real del motor.

- [ ] **Step 3: Commit**

```bash
git add xampp/htdocs/app/Console/Commands/PokemonVerifyCatalog.php
git commit -m "feat(pokemon): add catalog verifier command"
```

---

## Hecho cuando

- El esquema está en la versión 2 y un segundo arranque del runtime dice `Esquema al día en la versión 2`
- `pokemon:import-catalog` termina sin error y una segunda pasada es idempotente
- `pokemon:verify-catalog` devuelve `Catálogo coherente.` con ~1.025 especies y ~937 movimientos
- Las pruebas unitarias de los tres mapeadores pasan
- Ningún dato se ha escrito en la base `habbo` de producción

## Siguiente hito

Hito 3: `ServicioCombate`, el motor de turnos puro, con los 11 efectos genéricos primero y los manuales prioritarios después.
