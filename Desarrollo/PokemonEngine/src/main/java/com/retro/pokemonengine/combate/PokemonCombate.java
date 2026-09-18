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

    public static final String CONFUSION = "confusion";
    public static final String RETROCESO = "flinch";

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
    }
}
