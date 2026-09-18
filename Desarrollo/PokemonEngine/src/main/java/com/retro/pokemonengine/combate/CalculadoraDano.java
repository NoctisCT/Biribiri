package com.retro.pokemonengine.combate;

/**
 * Fórmula de daño de gen 3 en adelante.
 *
 * La variación aleatoria (85-100) la aporta quien llama, no esta clase: así el
 * cálculo es determinista y probable, y el azar vive en el RNG sembrado del combate.
 */
public final class CalculadoraDano
{
    private CalculadoraDano()
    {
    }

    public record EntradaDano(
            int nivel,
            int potencia,
            int ataque,
            int defensa,
            double efectividad,
            boolean stab,
            boolean critico,
            boolean quemado,
            boolean fisico,
            double modificadorClima,
            int variacion)
    {
    }

    public static int base(int nivel, int potencia, int ataque, int defensa)
    {
        if(defensa <= 0) defensa = 1;

        long paso = (long) ((2 * nivel) / 5 + 2) * potencia * ataque / defensa;

        return (int) (paso / 50) + 2;
    }

    public static int calcular(EntradaDano e)
    {
        if(e.efectividad() == 0.0) return 0;

        double dano = base(e.nivel(), e.potencia(), e.ataque(), e.defensa());

        if(e.critico()) dano = Math.floor(dano * 1.5);

        dano = Math.floor(dano * e.variacion() / 100.0);

        if(e.stab()) dano = Math.floor(dano * 1.5);

        dano = Math.floor(dano * e.efectividad());
        dano = Math.floor(dano * e.modificadorClima());

        if(e.quemado() && e.fisico()) dano = Math.floor(dano * 0.5);

        return Math.max(1, (int) dano);
    }
}
