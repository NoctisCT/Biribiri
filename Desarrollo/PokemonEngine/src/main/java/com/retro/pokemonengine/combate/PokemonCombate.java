package com.retro.pokemonengine.combate;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Un Pokémon dentro de un combate.
 *
 * Los stats llegan ya calculados: esta clase no sabe de IV, EV ni naturalezas,
 * solo de los números con los que se pelea.
 */
public final class PokemonCombate
{
    public static final String SIN_ESTADO = "none";
    public static final String PARALISIS = "paralysis";
    public static final String SUENO = "sleep";
    public static final String QUEMADURA = "burn";
    public static final String CONGELACION = "freeze";
    public static final String VENENO = "poison";
    public static final String VENENO_GRAVE = "toxic";

    // Volatiles. Duran mientras el Pokemon siga en el campo.
    public static final String CONFUSION = "confusion";
    public static final String RETROCESO = "flinch";
    public static final String ENAMORADO = "attract";
    public static final String MOFA = "taunt";
    public static final String MALDITO = "curse";
    public static final String CANTO_MORTAL = "perishsong";
    public static final String DRENADORAS = "leechseed";
    public static final String TORMENTO = "torment";
    public static final String ANULACION = "disable";
    public static final String EMBARGO = "embargo";

    public static final int GENERO_MACHO = 0;
    public static final int GENERO_HEMBRA = 1;
    public static final int GENERO_NINGUNO = 2;

    private final int ownedId;
    private final int especieId;
    private final String nombre;
    private final int nivelEfectivo;
    private final int tipo1;
    private final Integer tipo2;

    private final int psMax;
    private int psActual;

    private final int[] stats;
    private final int[] etapas = new int[7];

    private String estado = SIN_ESTADO;
    private int contadorEstado;

    private final Map<String, Integer> volatiles = new HashMap<>();
    private final List<MovimientoEnCombate> movimientos = new ArrayList<>();

    private int genero = GENERO_NINGUNO;
    private int enamoradoDe = -1;
    private int ultimoMovimiento = -1;
    private int movimientoAnulado = -1;

    public static final int ETAPA_ATAQUE = 0;
    public static final int ETAPA_DEFENSA = 1;
    public static final int ETAPA_ATAQUE_ESP = 2;
    public static final int ETAPA_DEFENSA_ESP = 3;
    public static final int ETAPA_VELOCIDAD = 4;
    public static final int ETAPA_PRECISION = 5;
    public static final int ETAPA_EVASION = 6;

    public PokemonCombate(
            int ownedId, int especieId, String nombre, int nivelEfectivo,
            int tipo1, Integer tipo2, int psMax, int[] stats)
    {
        this.ownedId = ownedId;
        this.especieId = especieId;
        this.nombre = nombre;
        this.nivelEfectivo = nivelEfectivo;
        this.tipo1 = tipo1;
        this.tipo2 = tipo2;
        this.psMax = psMax;
        this.psActual = psMax;
        this.stats = stats.clone();
    }

    public int ownedId() { return this.ownedId; }
    public int especieId() { return this.especieId; }
    public String nombre() { return this.nombre; }
    public int nivelEfectivo() { return this.nivelEfectivo; }
    public int tipo1() { return this.tipo1; }
    public Integer tipo2() { return this.tipo2; }
    public int psMax() { return this.psMax; }
    public int psActual() { return this.psActual; }
    public String estado() { return this.estado; }
    public int contadorEstado() { return this.contadorEstado; }
    public List<MovimientoEnCombate> movimientos() { return this.movimientos; }
    public int genero() { return this.genero; }
    public int enamoradoDe() { return this.enamoradoDe; }
    public int ultimoMovimiento() { return this.ultimoMovimiento; }
    public int movimientoAnulado() { return this.movimientoAnulado; }

    public void ponerGenero(int genero)
    {
        this.genero = genero;
    }

    public void registrarMovimientoUsado(int moveId)
    {
        this.ultimoMovimiento = moveId;
    }

    public void anularMovimiento(int moveId)
    {
        this.movimientoAnulado = moveId;
    }

    /**
     * Enamorarse exige generos opuestos y definidos: los Pokemon sin genero son
     * inmunes a Atraccion, y dos del mismo genero tampoco se enamoran.
     */
    public boolean enamorarseDe(PokemonCombate otro)
    {
        if(this.genero == GENERO_NINGUNO || otro.genero == GENERO_NINGUNO) return false;
        if(this.genero == otro.genero) return false;
        if(this.tieneVolatil(ENAMORADO)) return false;

        this.ponerVolatil(ENAMORADO, 1);
        this.enamoradoDe = otro.ownedId;

        return true;
    }

    public int statBase(Stat stat)
    {
        return this.stats[stat.ordinal()];
    }

    /** Stat con las etapas aplicadas. La parálisis reduce la Velocidad a la mitad. */
    public int statEfectivo(Stat stat)
    {
        int indice = switch(stat)
        {
            case ATAQUE -> ETAPA_ATAQUE;
            case DEFENSA -> ETAPA_DEFENSA;
            case ATAQUE_ESP -> ETAPA_ATAQUE_ESP;
            case DEFENSA_ESP -> ETAPA_DEFENSA_ESP;
            case VELOCIDAD -> ETAPA_VELOCIDAD;
            case PS -> -1;
        };

        if(indice < 0) return this.psMax;

        int valor = (int) Math.floor(this.stats[stat.ordinal()] * Etapas.multiplicador(this.etapas[indice]));

        if(stat == Stat.VELOCIDAD && PARALISIS.equals(this.estado))
        {
            valor = valor / 2;
        }

        return Math.max(1, valor);
    }

    public int etapa(int indice)
    {
        return this.etapas[indice];
    }

    /** Devuelve cuántas etapas se movió de verdad, que puede ser menos por el tope. */
    public int cambiarEtapa(int indice, int delta)
    {
        int antes = this.etapas[indice];
        this.etapas[indice] = Etapas.acotar(antes + delta);

        return this.etapas[indice] - antes;
    }

    public boolean aplicarEstado(String nuevo, int contador)
    {
        if(!SIN_ESTADO.equals(this.estado)) return false;
        if(this.debilitado()) return false;

        this.estado = nuevo;
        this.contadorEstado = contador;

        return true;
    }

    public void curarEstado()
    {
        this.estado = SIN_ESTADO;
        this.contadorEstado = 0;
    }

    public void reducirContadorEstado()
    {
        if(this.contadorEstado > 0) this.contadorEstado--;
    }

    public void aumentarContadorEstado()
    {
        this.contadorEstado++;
    }

    public boolean tieneVolatil(String clave)
    {
        return this.volatiles.containsKey(clave);
    }

    public Integer volatil(String clave)
    {
        return this.volatiles.get(clave);
    }

    public void ponerVolatil(String clave, int turnos)
    {
        this.volatiles.put(clave, turnos);
    }

    public void quitarVolatil(String clave)
    {
        this.volatiles.remove(clave);
    }

    public Map<String, Integer> volatiles()
    {
        return this.volatiles;
    }

    /** Devuelve el daño realmente aplicado, que nunca baja de 0 PS. */
    public int recibirDano(int dano)
    {
        int aplicado = Math.min(Math.max(0, dano), this.psActual);
        this.psActual -= aplicado;

        return aplicado;
    }

    /** Devuelve los PS realmente curados, que nunca superan el máximo. */
    public int curar(int cantidad)
    {
        int aplicado = Math.min(Math.max(0, cantidad), this.psMax - this.psActual);
        this.psActual += aplicado;

        return aplicado;
    }

    public boolean debilitado()
    {
        return this.psActual <= 0;
    }

    /** Al salir del combate se pierden etapas y volátiles, pero no el estado alterado. */
    public void alSalir()
    {
        java.util.Arrays.fill(this.etapas, 0);
        this.volatiles.clear();
        this.enamoradoDe = -1;
        this.ultimoMovimiento = -1;
        this.movimientoAnulado = -1;
    }
}
