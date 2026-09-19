package com.retro.pokemonengine;

import com.eu.habbo.Emulator;
import com.retro.pokemonengine.combate.Naturaleza;
import com.retro.pokemonengine.combate.Stat;
import com.retro.pokemonengine.entrenador.Bolsillo;
import com.retro.pokemonengine.entrenador.Dex;
import com.retro.pokemonengine.entrenador.Mochila;
import com.retro.pokemonengine.entrenador.MovimientoPoseido;
import com.retro.pokemonengine.entrenador.PokemonPoseido;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * El estado permanente del jugador contra la base de datos.
 *
 * No hay cache: los datos del entrenador se tocan poco y una consulta por accion
 * es mas barata que un cache mal invalidado con varias sesiones abiertas. El
 * seguidor si guarda lo suyo en memoria, porque ese si va por pasos.
 */
public final class ServicioEntrenador
{
    private static final String[] COLUMNAS_IV =
            { "iv_hp", "iv_ataque", "iv_defensa", "iv_ataque_esp", "iv_defensa_esp", "iv_velocidad" };

    private static final String[] COLUMNAS_EV =
            { "ev_hp", "ev_ataque", "ev_defensa", "ev_ataque_esp", "ev_defensa_esp", "ev_velocidad" };

    private ServicioEntrenador()
    {
    }

    public static final class Entrenador
    {
        public int userId;
        public long pokedollars;
        public int insignias;
        public Integer zonaActualId;
        public Long seguidorOwnedId;
        public boolean seguidorActivo = true;
        public int dexVistos;
        public int dexCapturados;
        public int temporadaId = 1;
        public int jugadoSegundos;
    }

    /** Lo carga y, si el jugador nunca ha jugado, lo crea. */
    public static Entrenador cargar(int userId) throws Exception
    {
        try(Connection c = Emulator.getDatabase().getDataSource().getConnection())
        {
            Entrenador entrenador = leer(c, userId);

            if(entrenador != null) return entrenador;

            try(PreparedStatement p = c.prepareStatement(
                    "INSERT IGNORE INTO pokemon_trainers (user_id, season_id) VALUES (?, ?)"))
            {
                p.setInt(1, userId);
                p.setInt(2, temporadaActiva(c));
                p.executeUpdate();
            }

            crearCajas(c, userId);

            Entrenador creado = leer(c, userId);

            return creado == null ? nuevo(userId) : creado;
        }
    }

    private static Entrenador nuevo(int userId)
    {
        Entrenador entrenador = new Entrenador();

        entrenador.userId = userId;

        return entrenador;
    }

    private static Entrenador leer(Connection c, int userId) throws Exception
    {
        try(PreparedStatement p = c.prepareStatement(
                "SELECT user_id, pokedollars, badges_bitmask, zona_actual_id, follower_owned_id," +
                " seguidor_activo, dex_vistos, dex_capturados, season_id, jugado_segundos" +
                " FROM pokemon_trainers WHERE user_id = ?"))
        {
            p.setInt(1, userId);

            try(ResultSet r = p.executeQuery())
            {
                if(!r.next()) return null;

                Entrenador entrenador = new Entrenador();

                entrenador.userId = r.getInt("user_id");
                entrenador.pokedollars = r.getLong("pokedollars");
                entrenador.insignias = r.getInt("badges_bitmask");

                int zona = r.getInt("zona_actual_id");
                entrenador.zonaActualId = r.wasNull() ? null : zona;

                long seguidor = r.getLong("follower_owned_id");
                entrenador.seguidorOwnedId = r.wasNull() ? null : seguidor;

                entrenador.seguidorActivo = r.getInt("seguidor_activo") == 1;
                entrenador.dexVistos = r.getInt("dex_vistos");
                entrenador.dexCapturados = r.getInt("dex_capturados");
                entrenador.temporadaId = r.getInt("season_id");
                entrenador.jugadoSegundos = r.getInt("jugado_segundos");

                return entrenador;
            }
        }
    }

    public static int temporadaActiva(Connection c) throws Exception
    {
        try(Statement s = c.createStatement();
            ResultSet r = s.executeQuery(
                    "SELECT id FROM pokemon_seasons WHERE activa = 1 ORDER BY id DESC LIMIT 1"))
        {
            return r.next() ? r.getInt(1) : 1;
        }
    }

    private static void crearCajas(Connection c, int userId) throws Exception
    {
        try(PreparedStatement p = c.prepareStatement(
                "INSERT IGNORE INTO pokemon_boxes (user_id, box_number, nombre) VALUES (?, ?, ?)"))
        {
            for(int caja = 0; caja < com.retro.pokemonengine.entrenador.Almacenamiento.CAJAS; caja++)
            {
                p.setInt(1, userId);
                p.setInt(2, caja);
                p.setString(3, "Caja " + (caja + 1));
                p.addBatch();
            }

            p.executeBatch();
        }
    }

    // --- Pokemon ---

    public static List<PokemonPoseido> cargarPokemon(int userId) throws Exception
    {
        List<PokemonPoseido> salida = new ArrayList<>();
        Map<Long, PokemonPoseido> porId = new LinkedHashMap<>();

        try(Connection c = Emulator.getDatabase().getDataSource().getConnection())
        {
            try(PreparedStatement p = c.prepareStatement(
                    "SELECT * FROM pokemon_owned WHERE user_id = ?" +
                    " ORDER BY ubicacion, box_number, slot"))
            {
                p.setInt(1, userId);

                try(ResultSet r = p.executeQuery())
                {
                    while(r.next())
                    {
                        PokemonPoseido pokemon = desdeFila(r);

                        salida.add(pokemon);
                        porId.put(pokemon.id(), pokemon);
                    }
                }
            }

            if(porId.isEmpty()) return salida;

            try(PreparedStatement p = c.prepareStatement(
                    "SELECT m.owned_id, m.slot, m.move_id, m.pp_actual, m.pp_up, mv.pp AS pp_base" +
                    " FROM pokemon_owned_moves m" +
                    " JOIN pokemon_owned o ON o.id = m.owned_id" +
                    " LEFT JOIN pokemon_moves mv ON mv.id = m.move_id" +
                    " WHERE o.user_id = ? ORDER BY m.owned_id, m.slot"))
            {
                p.setInt(1, userId);

                try(ResultSet r = p.executeQuery())
                {
                    while(r.next())
                    {
                        PokemonPoseido dueno = porId.get(r.getLong("owned_id"));

                        if(dueno == null) continue;

                        int ppBase = r.getInt("pp_base");

                        if(r.wasNull() || ppBase <= 0) ppBase = 5;

                        dueno.movimientos().add(new MovimientoPoseido(
                                r.getInt("move_id"), ppBase, r.getInt("pp_up"), r.getInt("pp_actual")));
                    }
                }
            }
        }

        return salida;
    }

    public static PokemonPoseido cargarUno(int userId, long ownedId) throws Exception
    {
        for(PokemonPoseido pokemon : cargarPokemon(userId))
        {
            if(pokemon.id() == ownedId) return pokemon;
        }

        return null;
    }

    private static PokemonPoseido desdeFila(ResultSet r) throws Exception
    {
        PokemonPoseido pokemon = new PokemonPoseido();

        pokemon.ponerId(r.getLong("id"));
        pokemon.ponerUserId(r.getInt("user_id"));
        pokemon.ponerEspecieId(r.getInt("species_id"));
        pokemon.ponerFormaId(r.getInt("form_id"));
        pokemon.ponerMote(r.getString("mote"));
        pokemon.ponerNivel(r.getInt("nivel"));
        pokemon.ponerExperiencia(r.getLong("experiencia"));

        for(int i = 0; i < COLUMNAS_IV.length; i++)
        {
            pokemon.ivs()[i] = r.getInt(COLUMNAS_IV[i]);
            pokemon.evs()[i] = r.getInt(COLUMNAS_EV[i]);
        }

        pokemon.ponerNaturaleza(naturaleza(r.getString("naturaleza")));
        pokemon.ponerHabilidadSlot(r.getInt("ability_slot"));

        int habilidad = r.getInt("ability_id");
        pokemon.ponerHabilidadId(r.wasNull() ? null : habilidad);

        pokemon.ponerGenero(r.getInt("genero"));
        pokemon.ponerShiny(r.getInt("es_shiny") == 1);
        pokemon.ponerPsActual(r.getInt("ps_actual"));
        pokemon.ponerEstado(r.getString("estado"));
        pokemon.ponerEstadoTurnos(r.getInt("estado_turnos"));
        pokemon.ponerAmistad(r.getInt("amistad"));
        pokemon.ponerPokerus(r.getInt("pokerus") == 1);
        pokemon.ponerPokerusDias(r.getInt("pokerus_dias"));

        int objeto = r.getInt("objeto_id");
        pokemon.ponerObjetoId(r.wasNull() ? null : objeto);

        pokemon.ponerBallId(r.getInt("ball_id"));

        int zona = r.getInt("met_zone_id");
        pokemon.ponerZonaCapturaId(r.wasNull() ? null : zona);

        pokemon.ponerNivelCaptura(r.getInt("met_level"));
        pokemon.ponerEntrenadorOriginalId(r.getInt("original_trainer_user_id"));
        pokemon.ponerUbicacion(r.getString("ubicacion"));
        pokemon.ponerCaja(r.getInt("box_number"));
        pokemon.ponerHueco(r.getInt("slot"));
        pokemon.ponerFavorito(r.getInt("es_favorito") == 1);
        pokemon.ponerVariante(r.getString("variante"));
        pokemon.ponerIntercambiable(r.getInt("intercambiable") == 1);
        pokemon.ponerHuevo(r.getInt("es_huevo") == 1);
        pokemon.ponerPasosHuevo(r.getInt("pasos_huevo"));
        pokemon.ponerTemporadaId(r.getInt("season_id"));

        return pokemon;
    }

    private static Naturaleza naturaleza(String nombre)
    {
        if(nombre != null)
        {
            for(Naturaleza naturaleza : Naturaleza.values())
            {
                if(naturaleza.name().equalsIgnoreCase(nombre)) return naturaleza;
            }
        }

        return Naturaleza.HARDY;
    }

    /** Inserta y deja el id puesto en el objeto. */
    public static void insertar(PokemonPoseido pokemon) throws Exception
    {
        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            PreparedStatement p = c.prepareStatement(
                    "INSERT INTO pokemon_owned (user_id, species_id, form_id, mote, nivel, experiencia," +
                    " iv_hp, iv_ataque, iv_defensa, iv_ataque_esp, iv_defensa_esp, iv_velocidad," +
                    " ev_hp, ev_ataque, ev_defensa, ev_ataque_esp, ev_defensa_esp, ev_velocidad," +
                    " naturaleza, ability_slot, ability_id, genero, es_shiny, ps_actual, estado," +
                    " amistad, pokerus, objeto_id, ball_id, met_zone_id, met_level," +
                    " original_trainer_user_id, ubicacion, box_number, slot, es_huevo, pasos_huevo," +
                    " season_id, variante, intercambiable)" +
                    " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?," +
                    " ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    Statement.RETURN_GENERATED_KEYS))
        {
            int i = 1;

            p.setInt(i++, pokemon.userId());
            p.setInt(i++, pokemon.especieId());
            p.setInt(i++, pokemon.formaId());
            p.setString(i++, pokemon.mote());
            p.setInt(i++, pokemon.nivel());
            p.setLong(i++, pokemon.experiencia());

            for(int iv : pokemon.ivs()) p.setInt(i++, iv);
            for(int ev : pokemon.evs()) p.setInt(i++, ev);

            p.setString(i++, pokemon.naturaleza().name().toLowerCase());
            p.setInt(i++, pokemon.habilidadSlot());

            if(pokemon.habilidadId() == null) p.setNull(i++, java.sql.Types.INTEGER);
            else p.setInt(i++, pokemon.habilidadId());

            p.setInt(i++, pokemon.genero());
            p.setInt(i++, pokemon.shiny() ? 1 : 0);
            p.setInt(i++, pokemon.psActual());
            p.setString(i++, pokemon.estado());
            p.setInt(i++, pokemon.amistad());
            p.setInt(i++, pokemon.pokerus() ? 1 : 0);

            if(pokemon.objetoId() == null) p.setNull(i++, java.sql.Types.INTEGER);
            else p.setInt(i++, pokemon.objetoId());

            p.setInt(i++, pokemon.ballId());

            if(pokemon.zonaCapturaId() == null) p.setNull(i++, java.sql.Types.INTEGER);
            else p.setInt(i++, pokemon.zonaCapturaId());

            p.setInt(i++, pokemon.nivelCaptura());
            p.setInt(i++, pokemon.entrenadorOriginalId());
            p.setString(i++, pokemon.ubicacion());
            p.setInt(i++, pokemon.caja());
            p.setInt(i++, pokemon.hueco());
            p.setInt(i++, pokemon.huevo() ? 1 : 0);
            p.setInt(i++, pokemon.pasosHuevo());
            p.setInt(i++, pokemon.temporadaId());
            p.setString(i++, pokemon.variante());
            p.setInt(i, pokemon.intercambiable() ? 1 : 0);

            p.executeUpdate();

            try(ResultSet r = p.getGeneratedKeys())
            {
                if(r.next()) pokemon.ponerId(r.getLong(1));
            }
        }

        guardarMovimientos(pokemon);
    }

    public static void guardarMovimientos(PokemonPoseido pokemon) throws Exception
    {
        try(Connection c = Emulator.getDatabase().getDataSource().getConnection())
        {
            try(PreparedStatement borrar = c.prepareStatement(
                    "DELETE FROM pokemon_owned_moves WHERE owned_id = ?"))
            {
                borrar.setLong(1, pokemon.id());
                borrar.executeUpdate();
            }

            try(PreparedStatement p = c.prepareStatement(
                    "INSERT INTO pokemon_owned_moves (owned_id, slot, move_id, pp_actual, pp_up)" +
                    " VALUES (?, ?, ?, ?, ?)"))
            {
                List<MovimientoPoseido> movimientos = pokemon.movimientos();

                for(int slot = 0; slot < movimientos.size(); slot++)
                {
                    MovimientoPoseido movimiento = movimientos.get(slot);

                    p.setLong(1, pokemon.id());
                    p.setInt(2, slot);
                    p.setInt(3, movimiento.moveId());
                    p.setInt(4, movimiento.ppActual());
                    p.setInt(5, movimiento.ppUp());
                    p.addBatch();
                }

                p.executeBatch();
            }
        }
    }

    /** Solo los campos que cambian fuera del combate. */
    public static void guardar(PokemonPoseido pokemon) throws Exception
    {
        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            PreparedStatement p = c.prepareStatement(
                    "UPDATE pokemon_owned SET mote = ?, nivel = ?, experiencia = ?," +
                    " ev_hp = ?, ev_ataque = ?, ev_defensa = ?, ev_ataque_esp = ?," +
                    " ev_defensa_esp = ?, ev_velocidad = ?," +
                    " ps_actual = ?, estado = ?, estado_turnos = ?, amistad = ?," +
                    " pokerus = ?, pokerus_dias = ?, objeto_id = ?, ubicacion = ?," +
                    " box_number = ?, slot = ?, es_favorito = ?, es_huevo = ?, pasos_huevo = ?," +
                    " variante = ?, intercambiable = ?" +
                    " WHERE id = ? AND user_id = ?"))
        {
            int i = 1;

            p.setString(i++, pokemon.mote());
            p.setInt(i++, pokemon.nivel());
            p.setLong(i++, pokemon.experiencia());

            for(int ev : pokemon.evs()) p.setInt(i++, ev);

            p.setInt(i++, pokemon.psActual());
            p.setString(i++, pokemon.estado());
            p.setInt(i++, pokemon.estadoTurnos());
            p.setInt(i++, pokemon.amistad());
            p.setInt(i++, pokemon.pokerus() ? 1 : 0);
            p.setInt(i++, pokemon.pokerusDias());

            if(pokemon.objetoId() == null) p.setNull(i++, java.sql.Types.INTEGER);
            else p.setInt(i++, pokemon.objetoId());

            p.setString(i++, pokemon.ubicacion());
            p.setInt(i++, pokemon.caja());
            p.setInt(i++, pokemon.hueco());
            p.setInt(i++, pokemon.favorito() ? 1 : 0);
            p.setInt(i++, pokemon.huevo() ? 1 : 0);
            p.setInt(i++, pokemon.pasosHuevo());
            p.setString(i++, pokemon.variante());
            p.setInt(i++, pokemon.intercambiable() ? 1 : 0);
            p.setLong(i++, pokemon.id());
            p.setInt(i, pokemon.userId());

            p.executeUpdate();
        }
    }

    /** Guarda de golpe las posiciones tras un movimiento de cajas. */
    public static void guardarUbicaciones(List<PokemonPoseido> pokemon) throws Exception
    {
        if(pokemon.isEmpty()) return;

        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            PreparedStatement p = c.prepareStatement(
                    "UPDATE pokemon_owned SET ubicacion = ?, box_number = ?, slot = ?" +
                    " WHERE id = ? AND user_id = ?"))
        {
            for(PokemonPoseido uno : pokemon)
            {
                p.setString(1, uno.ubicacion());
                p.setInt(2, uno.caja());
                p.setInt(3, uno.hueco());
                p.setLong(4, uno.id());
                p.setInt(5, uno.userId());
                p.addBatch();
            }

            p.executeBatch();
        }
    }

    // --- Mochila ---

    public static Mochila cargarMochila(int userId) throws Exception
    {
        Mochila mochila = new Mochila();

        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            PreparedStatement p = c.prepareStatement(
                    "SELECT item_id, bolsillo, cantidad FROM pokemon_bag WHERE user_id = ?"))
        {
            p.setInt(1, userId);

            try(ResultSet r = p.executeQuery())
            {
                while(r.next())
                {
                    mochila.anadir(
                            r.getInt("item_id"),
                            Bolsillo.porNombre(r.getString("bolsillo")),
                            r.getInt("cantidad"));
                }
            }
        }

        return mochila;
    }

    public static void escribirMochila(int userId, Mochila mochila) throws Exception
    {
        try(Connection c = Emulator.getDatabase().getDataSource().getConnection())
        {
            try(PreparedStatement borrar = c.prepareStatement(
                    "DELETE FROM pokemon_bag WHERE user_id = ?"))
            {
                borrar.setInt(1, userId);
                borrar.executeUpdate();
            }

            try(PreparedStatement p = c.prepareStatement(
                    "INSERT INTO pokemon_bag (user_id, item_id, bolsillo, cantidad) VALUES (?, ?, ?, ?)"))
            {
                for(Mochila.Entrada entrada : mochila.todas())
                {
                    p.setInt(1, userId);
                    p.setInt(2, entrada.itemId());
                    p.setString(3, entrada.bolsillo().name());
                    p.setInt(4, entrada.cantidad());
                    p.addBatch();
                }

                p.executeBatch();
            }
        }
    }

    // --- Pokedex ---

    public static Map<Integer, Dex.EntradaDex> cargarDex(int userId) throws Exception
    {
        Map<Integer, Dex.EntradaDex> entradas = new LinkedHashMap<>();

        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            PreparedStatement p = c.prepareStatement(
                    "SELECT species_id, visto, capturado, shiny_capturado FROM pokemon_dex_entries" +
                    " WHERE user_id = ? ORDER BY species_id"))
        {
            p.setInt(1, userId);

            try(ResultSet r = p.executeQuery())
            {
                while(r.next())
                {
                    entradas.put(r.getInt("species_id"), new Dex.EntradaDex(
                            r.getInt("species_id"),
                            r.getInt("visto") == 1,
                            r.getInt("capturado") == 1,
                            r.getInt("shiny_capturado") == 1));
                }
            }
        }

        return entradas;
    }

    public static void registrarVisto(int userId, int especieId) throws Exception
    {
        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            PreparedStatement p = c.prepareStatement(
                    "INSERT INTO pokemon_dex_entries (user_id, species_id, visto, visto_en)" +
                    " VALUES (?, ?, 1, CURRENT_TIMESTAMP)" +
                    " ON DUPLICATE KEY UPDATE visto = 1," +
                    " visto_en = COALESCE(visto_en, CURRENT_TIMESTAMP)"))
        {
            p.setInt(1, userId);
            p.setInt(2, especieId);
            p.executeUpdate();
        }

        recontarDex(userId);
    }

    public static void registrarCapturado(int userId, int especieId, boolean shiny) throws Exception
    {
        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            PreparedStatement p = c.prepareStatement(
                    "INSERT INTO pokemon_dex_entries" +
                    " (user_id, species_id, visto, capturado, shiny_capturado, visto_en, capturado_en)" +
                    " VALUES (?, ?, 1, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)" +
                    " ON DUPLICATE KEY UPDATE visto = 1, capturado = 1," +
                    " shiny_capturado = GREATEST(shiny_capturado, VALUES(shiny_capturado))," +
                    " visto_en = COALESCE(visto_en, CURRENT_TIMESTAMP)," +
                    " capturado_en = COALESCE(capturado_en, CURRENT_TIMESTAMP)"))
        {
            p.setInt(1, userId);
            p.setInt(2, especieId);
            p.setInt(3, shiny ? 1 : 0);
            p.executeUpdate();
        }

        recontarDex(userId);
    }

    private static void recontarDex(int userId) throws Exception
    {
        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            PreparedStatement p = c.prepareStatement(
                    "UPDATE pokemon_trainers SET" +
                    " dex_vistos = (SELECT COUNT(*) FROM pokemon_dex_entries" +
                    "   WHERE user_id = ? AND visto = 1)," +
                    " dex_capturados = (SELECT COUNT(*) FROM pokemon_dex_entries" +
                    "   WHERE user_id = ? AND capturado = 1)" +
                    " WHERE user_id = ?"))
        {
            p.setInt(1, userId);
            p.setInt(2, userId);
            p.setInt(3, userId);
            p.executeUpdate();
        }
    }

    // --- Seguidor y zona ---

    public static void ponerSeguidor(int userId, Long ownedId) throws Exception
    {
        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            PreparedStatement p = c.prepareStatement(
                    "UPDATE pokemon_trainers SET follower_owned_id = ? WHERE user_id = ?"))
        {
            if(ownedId == null) p.setNull(1, java.sql.Types.BIGINT);
            else p.setLong(1, ownedId);

            p.setInt(2, userId);
            p.executeUpdate();
        }
    }

    public static void ponerSeguidorActivo(int userId, boolean activo) throws Exception
    {
        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            PreparedStatement p = c.prepareStatement(
                    "UPDATE pokemon_trainers SET seguidor_activo = ? WHERE user_id = ?"))
        {
            p.setInt(1, activo ? 1 : 0);
            p.setInt(2, userId);
            p.executeUpdate();
        }
    }

    public static void ponerZonaActual(int userId, Integer zonaId) throws Exception
    {
        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            PreparedStatement p = c.prepareStatement(
                    "UPDATE pokemon_trainers SET zona_actual_id = ? WHERE user_id = ?"))
        {
            if(zonaId == null) p.setNull(1, java.sql.Types.INTEGER);
            else p.setInt(1, zonaId);

            p.setInt(2, userId);
            p.executeUpdate();
        }
    }

    public static Map<Integer, String> cajas(int userId) throws Exception
    {
        Map<Integer, String> nombres = new LinkedHashMap<>();

        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            PreparedStatement p = c.prepareStatement(
                    "SELECT box_number, nombre FROM pokemon_boxes WHERE user_id = ? ORDER BY box_number"))
        {
            p.setInt(1, userId);

            try(ResultSet r = p.executeQuery())
            {
                while(r.next()) nombres.put(r.getInt("box_number"), r.getString("nombre"));
            }
        }

        return nombres;
    }

    public static void renombrarCaja(int userId, int caja, String nombre) throws Exception
    {
        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            PreparedStatement p = c.prepareStatement(
                    "INSERT INTO pokemon_boxes (user_id, box_number, nombre) VALUES (?, ?, ?)" +
                    " ON DUPLICATE KEY UPDATE nombre = VALUES(nombre)"))
        {
            p.setInt(1, userId);
            p.setInt(2, caja);
            p.setString(3, nombre);
            p.executeUpdate();
        }
    }

    /** Los stats calculados de un Pokemon, para la ficha del cliente. */
    public static Map<String, Integer> statsDe(PokemonPoseido pokemon) throws Exception
    {
        Map<String, Integer> stats = new LinkedHashMap<>();
        var especie = ServicioPokedex.especie(pokemon.especieId());

        if(especie == null) return stats;

        for(Stat stat : Stat.values())
        {
            stats.put(stat.name().toLowerCase(),
                    stat == Stat.PS ? pokemon.psMax(especie) : pokemon.statCalculado(stat, especie));
        }

        return stats;
    }
}
