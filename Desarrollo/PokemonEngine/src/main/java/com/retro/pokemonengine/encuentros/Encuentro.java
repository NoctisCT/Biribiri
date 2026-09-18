package com.retro.pokemonengine.encuentros;

/**
 * Una fila de la tabla de encuentros de una zona.
 *
 * El peso es relativo al resto de filas de la misma zona, metodo y franja: no
 * es un porcentaje, asi que anadir una especie no obliga a recalcular las demas.
 */
public final class Encuentro
{
    private final int especieId;
    private final int formaId;
    private final int nivelMin;
    private final int nivelMax;
    private final int peso;
    private final MetodoEncuentro metodo;
    private final Franja franja;

    public Encuentro(int especieId, int formaId, int nivelMin, int nivelMax, int peso,
                     MetodoEncuentro metodo, Franja franja)
    {
        if(nivelMin < 1 || nivelMax > 100)
        {
            throw new IllegalArgumentException("Nivel fuera de 1-100: " + nivelMin + "-" + nivelMax);
        }

        if(nivelMax < nivelMin)
        {
            throw new IllegalArgumentException("Nivel maximo menor que el minimo: " + nivelMin + "-" + nivelMax);
        }

        if(peso < 0)
        {
            throw new IllegalArgumentException("Peso negativo: " + peso);
        }

        this.especieId = especieId;
        this.formaId = formaId;
        this.nivelMin = nivelMin;
        this.nivelMax = nivelMax;
        this.peso = peso;
        this.metodo = metodo == null ? MetodoEncuentro.HIERBA : metodo;
        this.franja = franja;
    }

    public static Encuentro de(int especieId, int nivelMin, int nivelMax, int peso)
    {
        return new Encuentro(especieId, 0, nivelMin, nivelMax, peso, MetodoEncuentro.HIERBA, null);
    }

    public int especieId() { return this.especieId; }
    public int formaId() { return this.formaId; }
    public int nivelMin() { return this.nivelMin; }
    public int nivelMax() { return this.nivelMax; }
    public int peso() { return this.peso; }
    public MetodoEncuentro metodo() { return this.metodo; }

    /** null = a cualquier hora. */
    public Franja franja() { return this.franja; }

    public boolean apareceEn(MetodoEncuentro metodo, Franja franja)
    {
        if(metodo != null && this.metodo != metodo) return false;

        return this.franja == null || franja == null || this.franja == franja;
    }
}
