package com.retro.pokemonengine.captura;

import com.retro.pokemonengine.combate.PokemonCombate;
import com.retro.pokemonengine.combate.RngCombate;

/**
 * La formula de captura de gen 3+, con truncado entero en cada paso.
 *
 * Los multiplicadores de ball y de estado llegan multiplicados por diez
 * (una Super Ball es 15, no 1.5) para que el truncado sea el de los juegos y
 * no el que salga de la coma flotante.
 */
public final class FormulaCaptura
{
    /** Ratio de la Master Ball: no multiplica, captura. */
    public static final int RATIO_CAPTURA_SEGURA = -1;

    public static final int SACUDIDAS = 4;

    /** El tope de la formula: con 255 o mas, la ball no falla. */
    public static final int A_MAXIMO = 255;

    private FormulaCaptura()
    {
    }

    public static final class Resultado
    {
        private final boolean capturado;
        private final int sacudidas;
        private final int a;
        private final int b;

        private Resultado(boolean capturado, int sacudidas, int a, int b)
        {
            this.capturado = capturado;
            this.sacudidas = sacudidas;
            this.a = a;
            this.b = b;
        }

        public boolean capturado() { return this.capturado; }

        /** Cuantas sacudidas aguanto la ball, de 0 a 4. Cuatro es captura. */
        public int sacudidas() { return this.sacudidas; }

        public int a() { return this.a; }
        public int b() { return this.b; }
    }

    /**
     * Dormido y congelado multiplican por 2,5; paralizado, envenenado y quemado
     * por 1,5; lo demas no cuenta.
     */
    public static int bonusEstadoX10(String estado)
    {
        if(estado == null) return 10;

        if(PokemonCombate.SUENO.equals(estado) || PokemonCombate.CONGELACION.equals(estado)) return 25;

        if(PokemonCombate.PARALISIS.equals(estado)
                || PokemonCombate.VENENO.equals(estado)
                || PokemonCombate.VENENO_GRAVE.equals(estado)
                || PokemonCombate.QUEMADURA.equals(estado)) return 15;

        return 10;
    }

    public static int valorA(int psMax, int psActual, int catchRate, int ballRatioX10, String estado)
    {
        int max = Math.max(1, psMax);
        int actual = Math.min(max, Math.max(0, psActual));
        int ratio = Math.max(0, ballRatioX10);

        long numerador = (long) (3 * max - 2 * actual) * catchRate * ratio;
        long a = numerador / ((long) 3 * max * 10);

        a = (a * bonusEstadoX10(estado)) / 10;

        if(a < 1) return 1;

        return (int) Math.min(a, A_MAXIMO);
    }

    /**
     * b = 1048560 / raizCuadrada(raizCuadrada(16711680 / a)), con raices enteras.
     */
    public static int valorB(int a)
    {
        int acotado = Math.max(1, Math.min(a, A_MAXIMO));

        return 1048560 / raiz(raiz(16711680 / acotado));
    }

    public static Resultado intentar(int psMax, int psActual, int catchRate, int ballRatioX10,
                                     String estado, RngCombate rng)
    {
        if(ballRatioX10 == RATIO_CAPTURA_SEGURA)
        {
            return new Resultado(true, SACUDIDAS, A_MAXIMO, 65535);
        }

        int a = valorA(psMax, psActual, catchRate, ballRatioX10, estado);

        if(a >= A_MAXIMO)
        {
            return new Resultado(true, SACUDIDAS, a, 65535);
        }

        int b = valorB(a);
        int sacudidas = 0;

        for(int i = 0; i < SACUDIDAS; i++)
        {
            if(rng.entre(0, 65535) >= b) break;

            sacudidas++;
        }

        return new Resultado(sacudidas == SACUDIDAS, sacudidas, a, b);
    }

    /** Raiz cuadrada entera, truncada, sin pasar por el error de la coma flotante. */
    private static int raiz(int valor)
    {
        if(valor <= 0) return 1;

        int r = (int) Math.sqrt(valor);

        while((long) (r + 1) * (r + 1) <= valor) r++;
        while((long) r * r > valor) r--;

        return Math.max(1, r);
    }
}
