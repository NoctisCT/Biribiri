package com.retro.pokemonengine.entrenador;

import com.retro.pokemonengine.combate.CalculadoraStats;
import com.retro.pokemonengine.combate.EspecieCatalogo;
import com.retro.pokemonengine.combate.MovimientoEnCombate;
import com.retro.pokemonengine.combate.Naturaleza;
import com.retro.pokemonengine.combate.PokemonCombate;
import com.retro.pokemonengine.combate.Stat;

import java.util.ArrayList;
import java.util.List;

/**
 * Un Pokemon del jugador, tal y como vive fuera del combate.
 *
 * A diferencia de PokemonCombate esta clase si sabe de IV, EV y naturaleza:
 * es la que persiste y la que convierte a numeros de combate cuando hace falta.
 */
public final class PokemonPoseido
{
    public static final int EQUIPO_MAX = 6;
    public static final int EV_MAX_POR_STAT = 255;
    public static final int EV_MAX_TOTAL = 510;
    public static final int IV_MAX = 31;
    public static final int AMISTAD_MAX = 255;

    public static final String EQUIPO = "equipo";
    public static final String CAJA = "caja";

    private long id;
    private int userId;
    private int especieId;
    private int formaId;
    private String mote;

    private int nivel = 1;
    private long experiencia;

    private final int[] ivs = new int[6];
    private final int[] evs = new int[6];

    private Naturaleza naturaleza = Naturaleza.HARDY;
    private int habilidadSlot = 1;
    private Integer habilidadId;

    private int genero = PokemonCombate.GENERO_NINGUNO;
    private boolean shiny;

    private int psActual;
    private String estado = PokemonCombate.SIN_ESTADO;
    private int estadoTurnos;

    private int amistad = 70;
    private boolean pokerus;
    private int pokerusDias;

    private Integer objetoId;
    private int ballId = 4;
    private Integer zonaCapturaId;
    private int nivelCaptura = 1;
    private int entrenadorOriginalId;

    private String ubicacion = EQUIPO;
    private int caja;
    private int hueco;
    private boolean favorito;

    private boolean huevo;
    private int pasosHuevo;

    private int temporadaId = 1;

    private final List<MovimientoPoseido> movimientos = new ArrayList<>();

    public long id() { return this.id; }
    public void ponerId(long id) { this.id = id; }

    public int userId() { return this.userId; }
    public void ponerUserId(int userId) { this.userId = userId; }

    public int especieId() { return this.especieId; }
    public void ponerEspecieId(int especieId) { this.especieId = especieId; }

    public int formaId() { return this.formaId; }
    public void ponerFormaId(int formaId) { this.formaId = formaId; }

    public String mote() { return this.mote; }
    public void ponerMote(String mote) { this.mote = mote; }

    public int nivel() { return this.nivel; }
    public void ponerNivel(int nivel) { this.nivel = Math.max(1, Math.min(TablaExperiencia.NIVEL_MAX, nivel)); }

    public long experiencia() { return this.experiencia; }
    public void ponerExperiencia(long experiencia) { this.experiencia = Math.max(0L, experiencia); }

    public int[] ivs() { return this.ivs; }
    public int[] evs() { return this.evs; }

    public int iv(Stat stat) { return this.ivs[stat.ordinal()]; }
    public int ev(Stat stat) { return this.evs[stat.ordinal()]; }

    public Naturaleza naturaleza() { return this.naturaleza; }
    public void ponerNaturaleza(Naturaleza naturaleza) { this.naturaleza = naturaleza; }

    public int habilidadSlot() { return this.habilidadSlot; }
    public void ponerHabilidadSlot(int slot) { this.habilidadSlot = slot; }

    public Integer habilidadId() { return this.habilidadId; }
    public void ponerHabilidadId(Integer id) { this.habilidadId = id; }

    public int genero() { return this.genero; }
    public void ponerGenero(int genero) { this.genero = genero; }

    public boolean shiny() { return this.shiny; }
    public void ponerShiny(boolean shiny) { this.shiny = shiny; }

    public int psActual() { return this.psActual; }
    public void ponerPsActual(int ps) { this.psActual = Math.max(0, ps); }

    public String estado() { return this.estado; }
    public void ponerEstado(String estado) { this.estado = estado == null ? PokemonCombate.SIN_ESTADO : estado; }

    public int estadoTurnos() { return this.estadoTurnos; }
    public void ponerEstadoTurnos(int turnos) { this.estadoTurnos = turnos; }

    public int amistad() { return this.amistad; }
    public void ponerAmistad(int amistad) { this.amistad = Math.max(0, Math.min(AMISTAD_MAX, amistad)); }

    public boolean pokerus() { return this.pokerus; }
    public void ponerPokerus(boolean pokerus) { this.pokerus = pokerus; }

    public int pokerusDias() { return this.pokerusDias; }
    public void ponerPokerusDias(int dias) { this.pokerusDias = dias; }

    public Integer objetoId() { return this.objetoId; }
    public void ponerObjetoId(Integer objetoId) { this.objetoId = objetoId; }

    public int ballId() { return this.ballId; }
    public void ponerBallId(int ballId) { this.ballId = ballId; }

    public Integer zonaCapturaId() { return this.zonaCapturaId; }
    public void ponerZonaCapturaId(Integer zonaId) { this.zonaCapturaId = zonaId; }

    public int nivelCaptura() { return this.nivelCaptura; }
    public void ponerNivelCaptura(int nivel) { this.nivelCaptura = nivel; }

    public int entrenadorOriginalId() { return this.entrenadorOriginalId; }
    public void ponerEntrenadorOriginalId(int userId) { this.entrenadorOriginalId = userId; }

    public String ubicacion() { return this.ubicacion; }
    public void ponerUbicacion(String ubicacion) { this.ubicacion = ubicacion; }

    public int caja() { return this.caja; }
    public void ponerCaja(int caja) { this.caja = caja; }

    public int hueco() { return this.hueco; }
    public void ponerHueco(int hueco) { this.hueco = hueco; }

    public boolean favorito() { return this.favorito; }
    public void ponerFavorito(boolean favorito) { this.favorito = favorito; }

    public boolean huevo() { return this.huevo; }
    public void ponerHuevo(boolean huevo) { this.huevo = huevo; }

    public int pasosHuevo() { return this.pasosHuevo; }
    public void ponerPasosHuevo(int pasos) { this.pasosHuevo = pasos; }

    public int temporadaId() { return this.temporadaId; }
    public void ponerTemporadaId(int temporadaId) { this.temporadaId = temporadaId; }

    public List<MovimientoPoseido> movimientos() { return this.movimientos; }

    public boolean enEquipo()
    {
        return EQUIPO.equals(this.ubicacion);
    }

    public boolean debilitado()
    {
        return this.psActual <= 0;
    }

    /** Un huevo y un debilitado no valen para combatir; de eso depende poder depositar. */
    public boolean puedeCombatir()
    {
        return !this.huevo && !this.debilitado();
    }

    public int psMax(EspecieCatalogo especie)
    {
        return CalculadoraStats.ps(especie.baseHp(), iv(Stat.PS), ev(Stat.PS), this.nivel);
    }

    public int statCalculado(Stat stat, EspecieCatalogo especie)
    {
        return CalculadoraStats.otro(
                stat, especie.base(stat), iv(stat), ev(stat), this.nivel, this.naturaleza);
    }

    /**
     * La conversion al modelo de combate.
     *
     * El nivel efectivo llega de fuera porque en torneos se juega a 50 aunque el
     * Pokemon este a 100.
     */
    public PokemonCombate aCombate(EspecieCatalogo especie, int nivelEfectivo)
    {
        int nivelOriginal = this.nivel;
        this.nivel = Math.max(1, Math.min(TablaExperiencia.NIVEL_MAX, nivelEfectivo));

        int psMax = psMax(especie);

        int[] stats = new int[6];

        for(Stat stat : Stat.values())
        {
            stats[stat.ordinal()] = stat == Stat.PS ? psMax : statCalculado(stat, especie);
        }

        this.nivel = nivelOriginal;

        PokemonCombate combatiente = new PokemonCombate(
                (int) this.id, this.especieId, nombreMostrado(especie), nivelEfectivo,
                especie.tipo1(), especie.tipo2(), psMax, stats);

        combatiente.ponerGenero(this.genero);

        // Los PS y el estado se arrastran: en los juegos un Pokemon entra al combate
        // tal y como salio del anterior.
        combatiente.recibirDano(Math.max(0, psMax - Math.min(this.psActual, psMax)));

        if(!PokemonCombate.SIN_ESTADO.equals(this.estado))
        {
            combatiente.aplicarEstado(this.estado, this.estadoTurnos);
        }

        for(MovimientoPoseido movimiento : this.movimientos)
        {
            combatiente.movimientos().add(new MovimientoEnCombate(
                    movimiento.moveId(), movimiento.ppMaximo(), movimiento.ppActual()));
        }

        return combatiente;
    }

    public String nombreMostrado(EspecieCatalogo especie)
    {
        if(this.mote != null && !this.mote.isBlank()) return this.mote;

        return especie == null ? String.valueOf(this.especieId) : especie.nombreEs();
    }

    public int evTotal()
    {
        int total = 0;

        for(int ev : this.evs) total += ev;

        return total;
    }

    /** Devuelve cuanto EV ha entrado de verdad, respetando el tope por stat y el total. */
    public int sumarEv(Stat stat, int cantidad)
    {
        if(cantidad <= 0) return 0;

        int indice = stat.ordinal();
        int margenStat = EV_MAX_POR_STAT - this.evs[indice];
        int margenTotal = EV_MAX_TOTAL - evTotal();
        int aplicado = Math.min(cantidad, Math.min(margenStat, margenTotal));

        if(aplicado <= 0) return 0;

        this.evs[indice] += aplicado;

        return aplicado;
    }
}
