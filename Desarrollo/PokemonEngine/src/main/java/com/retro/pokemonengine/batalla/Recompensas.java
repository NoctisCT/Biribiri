package com.retro.pokemonengine.batalla;

/**
 * Lo que deja un Pokemon derrotado.
 *
 * Los dos topes de EV se aplican en el orden de los juegos: primero el de cada
 * stat, despues el global. Ese orden importa — pasarse de 510 no rellena lo
 * que le falte al siguiente, simplemente no entra.
 */
public final class Recompensas
{
    public static final int EV_MAX_POR_STAT = 252;
    public static final int EV_MAX_TOTAL = 510;

    public record Ev(int ps, int ataque, int defensa, int ataqueEsp, int defensaEsp, int velocidad)
    {
        public int total()
        {
            return this.ps + this.ataque + this.defensa
                    + this.ataqueEsp + this.defensaEsp + this.velocidad;
        }
    }

    private Recompensas()
    {
    }

    /**
     * Formula de quinta generacion sin el factor de nivel del ganador: la base
     * del derrotado por su nivel, entre siete, repartida entre los que
     * participaron. El factor se deja fuera a proposito: sin intercambio ni
     * Pokemon regalados solo anadiria ruido.
     */
    public static long experiencia(int baseExperienceDerrotado, int nivelDerrotado,
                                   int participantes, boolean contraEntrenador)
    {
        int reparto = Math.max(1, participantes);

        long bruta = (long) Math.max(0, baseExperienceDerrotado)
                * Math.max(1, nivelDerrotado) / 7L / reparto;

        if(contraEntrenador) bruta = bruta * 3L / 2L;

        // Un combate ganado siempre suma algo: cero desmotiva y no protege nada.
        return Math.max(1L, bruta);
    }

    public static Ev sumar(Ev actuales, Ev reparto, boolean pokerus)
    {
        int factor = pokerus ? 2 : 1;

        int[] fin = {
                actuales.ps(), actuales.ataque(), actuales.defensa(),
                actuales.ataqueEsp(), actuales.defensaEsp(), actuales.velocidad()
        };

        int[] entra = {
                reparto.ps(), reparto.ataque(), reparto.defensa(),
                reparto.ataqueEsp(), reparto.defensaEsp(), reparto.velocidad()
        };

        int total = actuales.total();

        for(int i = 0; i < fin.length; i++)
        {
            int margenStat = EV_MAX_POR_STAT - fin[i];
            int margenTotal = EV_MAX_TOTAL - total;
            int suma = Math.min(entra[i] * factor, Math.min(margenStat, margenTotal));

            if(suma <= 0) continue;

            fin[i] += suma;
            total += suma;
        }

        return new Ev(fin[0], fin[1], fin[2], fin[3], fin[4], fin[5]);
    }
}
