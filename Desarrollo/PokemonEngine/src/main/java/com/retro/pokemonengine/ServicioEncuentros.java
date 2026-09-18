package com.retro.pokemonengine;

import com.eu.habbo.Emulator;
import com.retro.pokemonengine.combate.EspecieCatalogo;
import com.retro.pokemonengine.combate.PokemonCombate;
import com.retro.pokemonengine.combate.RngCombate;
import com.retro.pokemonengine.encuentros.Encuentro;
import com.retro.pokemonengine.encuentros.Franja;
import com.retro.pokemonengine.encuentros.MetodoEncuentro;
import com.retro.pokemonengine.encuentros.TablaEncuentros;
import com.retro.pokemonengine.entrenador.EspecieGeneracion;
import com.retro.pokemonengine.entrenador.GeneradorPokemon;
import com.retro.pokemonengine.entrenador.PokemonPoseido;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.time.LocalTime;
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

    private static final Map<Integer, Salvaje> ACTIVOS = new ConcurrentHashMap<>();

    private ServicioEncuentros()
    {
    }

    public static void cargar() throws Exception
    {
        Map<Integer, List<Encuentro>> nuevos = new HashMap<>();

        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            Statement s = c.createStatement();
            ResultSet r = s.executeQuery(
                    "SELECT zone_id, species_id, form_id, nivel_min, nivel_max, peso, metodo, franja" +
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
                                Franja.porNombre(r.getString("franja"))));
            }
        }

        int total = 0;

        for(List<Encuentro> lista : nuevos.values()) total += lista.size();

        porZona = Collections.unmodifiableMap(nuevos);

        System.out.println("[PokemonEngine] Encuentros: " + total
                + " filas en " + porZona.size() + " zonas.");
    }

    public static List<Encuentro> deZona(int zonaId)
    {
        return porZona.getOrDefault(zonaId, Collections.emptyList());
    }

    public static boolean zonaTieneEncuentros(int zonaId)
    {
        return !deZona(zonaId).isEmpty();
    }

    public static Franja franjaActual()
    {
        return Franja.deHora(LocalTime.now().getHour());
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
                deZona(zonaId), metodo, franjaActual());

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

    public static int totalActivos()
    {
        return ACTIVOS.size();
    }
}
