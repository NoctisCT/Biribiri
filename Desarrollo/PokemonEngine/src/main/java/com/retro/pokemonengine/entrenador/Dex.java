package com.retro.pokemonengine.entrenador;

import java.util.Collection;

/**
 * El pokedex del jugador.
 *
 * Las banderas solo suben: ver una especie ya capturada no la degrada a vista,
 * y capturarla marca tambien que se ha visto, porque en los juegos no hay forma
 * de capturar algo sin verlo.
 */
public final class Dex
{
    private Dex()
    {
    }

    public static final class EntradaDex
    {
        private final int especieId;
        private boolean visto;
        private boolean capturado;
        private boolean shinyCapturado;

        public EntradaDex(int especieId)
        {
            this.especieId = especieId;
        }

        public EntradaDex(int especieId, boolean visto, boolean capturado, boolean shinyCapturado)
        {
            this.especieId = especieId;
            this.visto = visto;
            this.capturado = capturado;
            this.shinyCapturado = shinyCapturado;
        }

        public int especieId() { return this.especieId; }
        public boolean visto() { return this.visto; }
        public boolean capturado() { return this.capturado; }
        public boolean shinyCapturado() { return this.shinyCapturado; }

        /** Devuelve true si el registro ha cambiado y hay que escribirlo. */
        public boolean marcarVisto()
        {
            if(this.visto) return false;

            this.visto = true;

            return true;
        }

        public boolean marcarCapturado(boolean shiny)
        {
            boolean cambio = !this.visto || !this.capturado || (shiny && !this.shinyCapturado);

            this.visto = true;
            this.capturado = true;

            if(shiny) this.shinyCapturado = true;

            return cambio;
        }
    }

    /** Especies distintas vistas, no ejemplares. */
    public static int vistos(Collection<EntradaDex> entradas)
    {
        int total = 0;

        for(EntradaDex entrada : entradas)
        {
            if(entrada.visto()) total++;
        }

        return total;
    }

    public static int capturados(Collection<EntradaDex> entradas)
    {
        int total = 0;

        for(EntradaDex entrada : entradas)
        {
            if(entrada.capturado()) total++;
        }

        return total;
    }
}
