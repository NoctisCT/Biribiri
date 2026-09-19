package com.retro.pokemonengine;

import com.eu.habbo.Emulator;
import com.retro.pokemonengine.clima.Clima;
import com.retro.pokemonengine.combate.EspecieCatalogo;
import com.retro.pokemonengine.combate.PokemonCombate;
import com.retro.pokemonengine.combate.RngCombate;
import com.retro.pokemonengine.encuentros.Encuentro;
import com.retro.pokemonengine.encuentros.Franja;
import com.retro.pokemonengine.encuentros.MetodoEncuentro;
import com.retro.pokemonengine.encuentros.TablaEncuentros;
import com.retro.pokemonengine.encuentros.TiradaEncuentro;
import com.retro.pokemonengine.entrenador.EspecieGeneracion;
import com.retro.pokemonengine.entrenador.GeneradorPokemon;
import com.retro.pokemonengine.entrenador.PokemonPoseido;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Los encuentros salvajes: que sale, de que nivel y con que numeros.
 *
 * Las tablas caben de sobra en memoria y solo cambian cuando un administrador
 * las edita, asi que se cargan al arrancar. El Pokemon salvaje **no se guarda**:
 * vive en memoria hasta que se captura, se huye o el jugador cambia de sala.
 */
public final class ServicioEncuentros
{
    /** Un encuentro en curso. Solo puede haber uno por jugador. */
    public static final class Salvaje
    {
        private final PokemonPoseido pokemon;
        private final EspecieCatalogo especie;
        private final int zonaId;
        private final int roomId;
        private final long semilla;
        private String estado = PokemonCombate.SIN_ESTADO;

        private Salvaje(PokemonPoseido pokemon, EspecieCatalogo especie,
                        int zonaId, int roomId, long semilla)
        {
            this.pokemon = pokemon;
            this.especie = especie;
            this.zonaId = zonaId;
            this.roomId = roomId;
            this.semilla = semilla;
        }

        public PokemonPoseido pokemon() { return this.pokemon; }
        public EspecieCatalogo especie() { return this.especie; }
        public int zonaId() { return this.zonaId; }
        public int roomId() { return this.roomId; }
        public long semilla() { return this.semilla; }
        public String estado() { return this.estado; }
        public void ponerEstado(String estado) { this.estado = estado; }

        public int psMax() { return this.pokemon.psMax(this.especie); }
        public int psActual() { return this.pokemon.psActual(); }
    }

    private static Map<Integer, List<Encuentro>> porZona = Collections.emptyMap();

    /** Probabilidad por paso, por zona y metodo, en milesimas. */
    private static Map<Integer, Map<MetodoEncuentro, Integer>> ratios = Collections.emptyMap();

    private static final Map<Integer, Salvaje> ACTIVOS = new ConcurrentHashMap<>();

    /** El enfriamiento de cada jugador. Se pierde al desconectar, y esta bien asi. */
    private static final Map<Integer, TiradaEncuentro.Estado> TIRADAS = new ConcurrentHashMap<>();

    private ServicioEncuentros()
    {
    }

    public static void cargar() throws Exception
    {
        Map<Integer, List<Encuentro>> nuevos = new HashMap<>();

        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            Statement s = c.createStatement();
            ResultSet r = s.executeQuery(
                    "SELECT zone_id, species_id, form_id, nivel_min, nivel_max, peso, metodo, franja, clima" +
                    " FROM pokemon_zone_encounters ORDER BY zone_id, id"))
        {
            while(r.next())
            {
                nuevos.computeIfAbsent(r.getInt("zone_id"), z -> new ArrayList<>())
                        .add(new Encuentro(
                                r.getInt("species_id"),
                                r.getInt("form_id"),
                                r.getInt("nivel_min"),
                                r.getInt("nivel_max"),
                                r.getInt("peso"),
                                MetodoEncuentro.porNombre(r.getString("metodo")),
                                Franja.porNombre(r.getString("franja")),
                                // porNombre devuelve DESPEJADO ante lo desconocido,
                                // y aqui null significa "con cualquier tiempo".
                                r.getString("clima") == null
                                        ? null
                                        : Clima.porNombre(r.getString("clima"))));
            }
        }

        int total = 0;

        for(List<Encuentro> lista : nuevos.values()) total += lista.size();

        porZona = Collections.unmodifiableMap(nuevos);

        Map<Integer, Map<MetodoEncuentro, Integer>> nuevosRatios = new HashMap<>();

        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            Statement s = c.createStatement();
            ResultSet r = s.executeQuery(
                    "SELECT zone_id, metodo, por_mil FROM pokemon_zone_encounter_rates"))
        {
            while(r.next())
            {
                nuevosRatios
                        .computeIfAbsent(r.getInt("zone_id"), z -> new HashMap<>())
                        .put(MetodoEncuentro.porNombre(r.getString("metodo")), r.getInt("por_mil"));
            }
        }

        ratios = Collections.unmodifiableMap(nuevosRatios);

        System.out.println("[PokemonEngine] Encuentros: " + total
                + " filas en " + porZona.size() + " zonas, "
                + ratios.size() + " zonas con probabilidad por paso.");
    }

    /**
     * Probabilidad por paso en milesimas. Sin fila, cero: una zona nueva no
     * empieza a escupir Pokemon por haberse olvidado de configurarla.
     */
    public static int porMil(int zonaId, MetodoEncuentro metodo)
    {
        Map<MetodoEncuentro, Integer> deZona = ratios.get(zonaId);

        if(deZona == null) return 0;

        Integer valor = deZona.get(metodo);

        return valor == null ? 0 : valor;
    }

    /** Los metodos que esa zona tiene configurados con probabilidad mayor que cero. */
    public static List<String> metodosDe(int zonaId)
    {
        List<String> salida = new ArrayList<>();
        Map<MetodoEncuentro, Integer> deZona = ratios.get(zonaId);

        if(deZona == null) return salida;

        for(Map.Entry<MetodoEncuentro, Integer> entrada : deZona.entrySet())
        {
            if(entrada.getValue() != null && entrada.getValue() > 0) salida.add(entrada.getKey().name());
        }

        Collections.sort(salida);

        return salida;
    }

    public static TiradaEncuentro.Estado estadoTirada(int userId)
    {
        return TIRADAS.getOrDefault(userId, TiradaEncuentro.inicial());
    }

    public static void ponerEstadoTirada(int userId, TiradaEncuentro.Estado estado)
    {
        TIRADAS.put(userId, estado);
    }

    /** El enganche del Repelente: tantos pasos sin tirar nada. */
    public static void silenciar(int userId, int pasos)
    {
        TIRADAS.put(userId, TiradaEncuentro.silenciar(estadoTirada(userId), pasos));
    }

    public static List<Encuentro> deZona(int zonaId)
    {
        return porZona.getOrDefault(zonaId, Collections.emptyList());
    }

    public static boolean zonaTieneEncuentros(int zonaId)
    {
        return !deZona(zonaId).isEmpty();
    }

    /**
     * La hora del hotel es la de Espana, clavada: mudar el emulador de servidor
     * no debe mover el ciclo dia/noche sin que nadie lo toque.
     */
    public static final ZoneId ZONA_HORARIA = ZoneId.of("Europe/Madrid");

    public static Franja franjaActual()
    {
        return Franja.deHora(ZonedDateTime.now(ZONA_HORARIA).getHour());
    }

    /**
     * Sortea un encuentro de la zona y genera el Pokemon entero.
     *
     * Devuelve null si la zona no tiene nada que sacar a esta hora y con este
     * metodo: eso no es un error, es una zona tranquila.
     */
    public static Salvaje buscar(int userId, int zonaId, int roomId, MetodoEncuentro metodo,
                                 int temporadaId)
    {
        List<Encuentro> candidatos = TablaEncuentros.disponibles(
                deZona(zonaId), metodo, franjaActual(), ServicioClima.clima(zonaId));

        long semilla = System.nanoTime() ^ ((long) userId << 20);
        RngCombate rng = new RngCombate(semilla);

        Encuentro encuentro = TablaEncuentros.sortear(candidatos, rng);

        if(encuentro == null) return null;

        EspecieGeneracion especie = ServicioGeneracion.instancia().especie(encuentro.especieId());

        if(especie == null) return null;

        int nivel = TablaEncuentros.nivel(encuentro, rng);

        PokemonPoseido pokemon = GeneradorPokemon.generar(
                especie, nivel, GeneradorPokemon.Opciones.salvaje(userId, zonaId, temporadaId), rng);

        GeneradorPokemon.asignarMovimientosIniciales(pokemon, ServicioGeneracion.instancia());

        Salvaje salvaje = new Salvaje(pokemon, especie.base(), zonaId, roomId, semilla);

        ACTIVOS.put(userId, salvaje);

        return salvaje;
    }

    public static Salvaje activo(int userId)
    {
        return ACTIVOS.get(userId);
    }

    public static void limpiar(int userId)
    {
        ACTIVOS.remove(userId);
    }

    /** Al desconectar: ni encuentro en curso ni enfriamiento pendiente. */
    public static void olvidar(int userId)
    {
        ACTIVOS.remove(userId);
        TIRADAS.remove(userId);
    }

    public static int totalActivos()
    {
        return ACTIVOS.size();
    }
}
