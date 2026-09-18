package com.retro.pokemonengine.entrenador;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * La mochila del jugador, por bolsillos.
 *
 * Un objeto ocupa una sola entrada por mucha cantidad que tenga: no hay pilas
 * sueltas. Anadir por encima del tope no falla del todo, mete lo que cabe y
 * dice cuanto ha sobrado, que es lo que el jugador necesita saber.
 */
public final class Mochila
{
    public static final String OK = "OK";
    public static final String SIN_SITIO = "SIN_SITIO";
    public static final String NO_TIENES = "NO_TIENES";
    public static final String NO_SE_PUEDE_TIRAR = "NO_SE_PUEDE_TIRAR";
    public static final String CANTIDAD_INVALIDA = "CANTIDAD_INVALIDA";

    private final Map<Integer, Entrada> entradas = new LinkedHashMap<>();

    public static final class Entrada
    {
        private final int itemId;
        private final Bolsillo bolsillo;
        private int cantidad;

        public Entrada(int itemId, Bolsillo bolsillo, int cantidad)
        {
            this.itemId = itemId;
            this.bolsillo = bolsillo;
            this.cantidad = cantidad;
        }

        public int itemId() { return this.itemId; }
        public Bolsillo bolsillo() { return this.bolsillo; }
        public int cantidad() { return this.cantidad; }
    }

    public record Resultado(boolean ok, String codigo, int aplicado, int sobrante)
    {
        public static Resultado bien(int aplicado, int sobrante)
        {
            return new Resultado(true, OK, aplicado, sobrante);
        }

        public static Resultado mal(String codigo)
        {
            return new Resultado(false, codigo, 0, 0);
        }
    }

    public int cantidad(int itemId)
    {
        Entrada entrada = this.entradas.get(itemId);

        return entrada == null ? 0 : entrada.cantidad();
    }

    public Bolsillo bolsilloDe(int itemId)
    {
        Entrada entrada = this.entradas.get(itemId);

        return entrada == null ? null : entrada.bolsillo();
    }

    public List<Entrada> todas()
    {
        return new ArrayList<>(this.entradas.values());
    }

    public List<Entrada> delBolsillo(Bolsillo bolsillo)
    {
        List<Entrada> salida = new ArrayList<>();

        for(Entrada entrada : this.entradas.values())
        {
            if(entrada.bolsillo() == bolsillo) salida.add(entrada);
        }

        return salida;
    }

    public Resultado anadir(int itemId, Bolsillo bolsillo, int cantidad)
    {
        if(cantidad <= 0) return Resultado.mal(CANTIDAD_INVALIDA);

        Entrada entrada = this.entradas.get(itemId);
        int actual = entrada == null ? 0 : entrada.cantidad();
        int margen = bolsillo.topePila() - actual;

        if(margen <= 0) return Resultado.mal(SIN_SITIO);

        int aplicado = Math.min(cantidad, margen);

        if(entrada == null)
        {
            this.entradas.put(itemId, new Entrada(itemId, bolsillo, aplicado));
        }
        else
        {
            entrada.cantidad += aplicado;
        }

        return Resultado.bien(aplicado, cantidad - aplicado);
    }

    public Resultado quitar(int itemId, int cantidad)
    {
        if(cantidad <= 0) return Resultado.mal(CANTIDAD_INVALIDA);

        Entrada entrada = this.entradas.get(itemId);

        if(entrada == null || entrada.cantidad() < cantidad) return Resultado.mal(NO_TIENES);

        entrada.cantidad -= cantidad;

        if(entrada.cantidad() <= 0) this.entradas.remove(itemId);

        return Resultado.bien(cantidad, 0);
    }

    /** Tirar es como quitar, pero los objetos clave no se pueden tirar. */
    public Resultado tirar(int itemId, int cantidad)
    {
        Entrada entrada = this.entradas.get(itemId);

        if(entrada == null) return Resultado.mal(NO_TIENES);
        if(!entrada.bolsillo().sePuedeTirar()) return Resultado.mal(NO_SE_PUEDE_TIRAR);

        return quitar(itemId, cantidad);
    }
}
