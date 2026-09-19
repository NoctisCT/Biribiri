package com.retro.pokemonengine;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.users.Habbo;
import com.retro.pokemonengine.batalla.Formato;
import com.retro.pokemonengine.batalla.MenteSalvaje;
import com.retro.pokemonengine.batalla.ReglasAbandono;
import com.retro.pokemonengine.batalla.ReglasHuida;
import com.retro.pokemonengine.clima.Clima;
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
import com.retro.pokemonengine.combate.Stat;
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
import java.util.concurrent.TimeUnit;

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

    /** Motivos que anulan: ninguno de ellos es decision del que combate. */
    public static final String MOTIVO_EXPULSADO = "expulsado";
    public static final String MOTIVO_SALA_CERRADA = "sala_cerrada";
    public static final String MOTIVO_SALA_SIN_ZONA = "sala_sin_zona";

    /**
     * Si ese final cuenta como anulacion.
     *
     * Se compara contra una lista y no contra una sola constante porque el
     * motivo que se guarda es el real — "expulsado", "sala_cerrada" — y no un
     * generico que borraria la unica informacion util.
     */
    public static boolean esAnulacion(String motivo)
    {
        return MOTIVO_ANULADA.equals(motivo)
                || MOTIVO_EXPULSADO.equals(motivo)
                || MOTIVO_SALA_CERRADA.equals(motivo)
                || MOTIVO_SALA_SIN_ZONA.equals(motivo);
    }

    /** Cada cuanto se miran los dos relojes. */
    public static final long LATIDO_MS = 1000L;

    public static final class Sesion
    {
        public final long id;
        public final Formato formato;
        public final Integer zonaId;
        public final int roomId;
        public final long semilla;
        public final EstadoCombate estado;

        /** Se decide despues de crear la sesion, cuando se busca sitio en la sala. */
        public boolean enInterfaz;

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

        Sesion(long id, Formato formato, Integer zonaId, int roomId, long semilla,
               EstadoCombate estado)
        {
            this.id = id;
            this.formato = formato;
            this.zonaId = zonaId;
            this.roomId = roomId;
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

    private static boolean latiendo;

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

    // --- Abrir ---

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

        ponerClimaDeZona(estado, salvaje.zonaId());

        long id = insertar(Formato.SALVAJE, salvaje.zonaId(), salvaje.roomId(), semilla);

        Sesion sesion = new Sesion(id, Formato.SALVAJE, salvaje.zonaId(), salvaje.roomId(),
                semilla, estado);

        sesion.userIds[0] = userId;
        sesion.propios[0] = cabeza;
        sesion.salvaje = salvaje;

        insertarBandos(sesion);

        SESIONES.put(id, sesion);
        POR_JUGADOR.put(userId, id);

        colocarOInterfaz(sesion, habbo, null);

        return sesion;
    }

    /**
     * Abre un PvP amistoso entre dos jugadores de la misma sala.
     *
     * Simetrico respecto a abrirSalvaje: los dos bandos son jugadores, no hay
     * salvaje — asi que no hay captura ni huida, y eso lo dice el Formato — y
     * el turno no se resuelve hasta que han elegido los dos.
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

        if(a.getHabboInfo().getCurrentRoom() == null) return null;

        int roomId = a.getHabboInfo().getCurrentRoom().getId();
        Integer zonaId = ServicioZonas.zonaDeSala(roomId);

        long semilla = System.nanoTime() ^ ((long) userA << 24) ^ ((long) userB << 8);

        Bando bandoA = new Bando(0);
        bandoA.posiciones().add(cabezaA.aCombate(especieA, cabezaA.nivel()));

        Bando bandoB = new Bando(1);
        bandoB.posiciones().add(cabezaB.aCombate(especieB, cabezaB.nivel()));

        EstadoCombate estado = new EstadoCombate(bandoA, bandoB, new RngCombate(semilla));

        if(zonaId != null) ponerClimaDeZona(estado, zonaId);

        long id = insertar(Formato.PVP_AMISTOSO, zonaId, roomId, semilla);

        Sesion sesion = new Sesion(id, Formato.PVP_AMISTOSO, zonaId, roomId, semilla, estado);

        sesion.userIds[0] = userA;
        sesion.userIds[1] = userB;
        sesion.propios[0] = cabezaA;
        sesion.propios[1] = cabezaB;

        insertarBandos(sesion);

        SESIONES.put(id, sesion);
        POR_JUGADOR.put(userA, id);
        POR_JUGADOR.put(userB, id);

        // Ancla el que acepta y camina el que reto: quien busca pelea es quien
        // se acerca.
        colocarOInterfaz(sesion, b, a);
        empujarEstado(sesion);

        return sesion;
    }

    /**
     * El clima de la zona entra en el combate sin escribir mecanica nueva: el
     * motor ya sabe manejarlo desde el hito 3. Turnos -1 es "no caduca", porque
     * este no lo ha puesto un movimiento, lo pone el cielo.
     */
    private static void ponerClimaDeZona(EstadoCombate estado, int zonaId)
    {
        Clima clima = ServicioClima.clima(zonaId);

        if(clima == null) return;

        String enCampo = clima.aCampo();

        if(!EstadoCombate.SIN_CLIMA.equals(enCampo)) estado.ponerClima(enCampo, -1);
    }

    /**
     * Busca sitio para la formacion. Si no cabe, el combate se juega en
     * interfaz: **no se cancela nunca**. El jugador no puede perder el
     * encuentro por estar la ruta llena, solo el espectaculo.
     *
     * @param anclaje   el que no se mueve
     * @param queCamina el que se acerca, o null contra un salvaje
     */
    private static void colocarOInterfaz(Sesion sesion, Habbo anclaje, Habbo queCamina)
    {
        if(ServicioArena.colocar(sesion, anclaje, queCamina)) return;

        ServicioArena.soltar(sesion);
        pasarAInterfaz(sesion.id);
    }

    /**
     * El combate se resuelve en interfaz.
     *
     * Pasa cuando la formacion no cabe o cuando alguien no llega andando a su
     * hueco. Nunca cancela nada: se pierde el espectaculo, no el combate.
     */
    public static void pasarAInterfaz(long batallaId)
    {
        Sesion sesion = SESIONES.get(batallaId);

        if(sesion == null || sesion.enInterfaz) return;

        sesion.enInterfaz = true;

        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            PreparedStatement p = c.prepareStatement(
                    "UPDATE pokemon_battles SET en_interfaz = 1 WHERE id = ?"))
        {
            p.setLong(1, sesion.id);
            p.executeUpdate();
        }
        catch(Exception error)
        {
            System.out.println("[PokemonEngine] No se pudo marcar en interfaz el combate "
                    + batallaId + ": " + error.getMessage());
        }

        empujarEstado(sesion);
    }

    /** El primero del equipo que no este debilitado, por orden de hueco. */
    private static PokemonPoseido primeroConPs(List<PokemonPoseido> todos)
    {
        PokemonPoseido mejor = null;

        for(PokemonPoseido p : todos)
        {
            if(!PokemonPoseido.EQUIPO.equals(p.ubicacion()) || p.psActual() <= 0) continue;

            if(mejor == null || p.hueco() < mejor.hueco()) mejor = p;
        }

        return mejor;
    }

    private static long insertar(Formato formato, Integer zonaId, int roomId, long semilla)
            throws Exception
    {
        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            PreparedStatement p = c.prepareStatement(
                    "INSERT INTO pokemon_battles (tipo, formato, zone_id, room_id, rng_seed)" +
                    " VALUES (?, ?, ?, ?, ?)",
                    Statement.RETURN_GENERATED_KEYS))
        {
            p.setString(1, formato == Formato.SALVAJE ? "salvaje" : "pvp");
            p.setString(2, formato.name());

            if(zonaId == null) p.setNull(3, Types.INTEGER);
            else p.setInt(3, zonaId);

            p.setInt(4, roomId);
            p.setLong(5, semilla);
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

    // --- El turno ---

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
            sesion.elegidas[1] = MenteSalvaje.elegir(
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
        sesion.elegidas[rival] = MenteSalvaje.elegir(
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

        List<Evento> eventos = motor().resolverTurno(sesion.estado, acciones);

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

    // --- Huida ---

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

        boolean sale = ReglasHuida.intentar(
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

    // --- Ausencia, vuelta y anulacion ---

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

        empujar(sesion, PokemonAcciones.BATALLA_EVENTOS, unEvento(sesion, "rival_ausente",
                Map.of("graciaMs", ReglasAbandono.GRACIA_MS)));
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
     * en vez de dejar el combate colgado para el otro.
     */
    public static void iniciarLatido()
    {
        if(latiendo) return;

        latiendo = true;

        Emulator.getThreading().getService().scheduleAtFixedRate(
                ServicioBatalla::latido, LATIDO_MS, LATIDO_MS, TimeUnit.MILLISECONDS);
    }

    public static void pararLatido()
    {
        latiendo = false;
    }

    static void latido()
    {
        if(!latiendo) return;

        long ahora = System.currentTimeMillis();

        for(Sesion sesion : new ArrayList<>(SESIONES.values()))
        {
            try
            {
                if(sesion.ausenteDesdeMs > 0
                        && ReglasAbandono.expirado(sesion.ausenteDesdeMs, ahora))
                {
                    cerrarPorAbandono(sesion);
                    continue;
                }

                if(sesion.formato != Formato.SALVAJE
                        && ReglasAbandono.turnoExpirado(sesion.turnoDesdeMs, ahora))
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

        ServicioArena.repasar();
        ServicioRetos.caducar();
    }

    private static void cerrarPorAbandono(Sesion sesion)
    {
        int perdedor = sesion.ausenteBando;

        if(sesion.salvaje != null)
        {
            // Contra un salvaje no hay a quien dar la victoria: se descarta el
            // encuentro y ya esta.
            ServicioEncuentros.limpiar(sesion.userIds[0]);
            ServicioRecompensas.cerrar(sesion, -1, MOTIVO_ABANDONO);

            return;
        }

        ServicioRecompensas.cerrar(sesion, 1 - perdedor, MOTIVO_ABANDONO);
    }

    /**
     * Al expirar el turno se mueve por quien no eligio: uno de los que tienen
     * PP, al azar. Deja el combate avanzando en vez de colgado, que es lo
     * unico que el otro jugador no puede arreglar por su cuenta.
     */
    private static void moverPorLosQueNoEligieron(Sesion sesion)
    {
        for(int bando = 0; bando < 2; bando++)
        {
            if(sesion.elegidas[bando] != null || sesion.userIds[bando] == 0) continue;

            sesion.elegidas[bando] = MenteSalvaje.elegir(
                    sesion.estado.bando(bando).activo(0), bando, 0, sesion.estado.rng());
        }

        resolverTurno(sesion);
    }

    // --- Lo que ve el cliente ---

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

    /** El sobre con el que viajan los eventos de un turno. */
    static Map<String, Object> sobre(Sesion sesion, List<Map<String, Object>> eventos)
    {
        Map<String, Object> cuerpo = new LinkedHashMap<>();

        cuerpo.put("batallaId", sesion.id);
        cuerpo.put("turno", sesion.estado.turno());
        cuerpo.put("eventos", eventos);

        return cuerpo;
    }

    static Map<String, Object> unEvento(Sesion sesion, String tipo, Map<String, Object> datos)
    {
        Map<String, Object> evento = new LinkedHashMap<>();

        evento.put("tipo", tipo);
        evento.put("datos", datos);

        return sobre(sesion, List.of(evento));
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

        empujar(sesion, PokemonAcciones.BATALLA_EVENTOS, sobre(sesion, lista));
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

    // --- Persistencia del turno ---

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
}
