package com.retro.pokemonengine.encuentros;

import com.retro.pokemonengine.clima.Clima;

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
    private final Clima clima;

    public Encuentro(int especieId, int formaId, int nivelMin, int nivelMax, int peso,
                     MetodoEncuentro metodo, Franja franja, Clima clima)
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
        this.clima = clima;
    }

    public static Encuentro de(int especieId, int nivelMin, int nivelMax, int peso)
    {
        return new Encuentro(especieId, 0, nivelMin, nivelMax, peso, MetodoEncuentro.HIERBA, null, null);
    }

    public int especieId() { return this.especieId; }
    public int formaId() { return this.formaId; }
    public int nivelMin() { return this.nivelMin; }
    public int nivelMax() { return this.nivelMax; }
    public int peso() { return this.peso; }
    public MetodoEncuentro metodo() { return this.metodo; }

    /** null = a cualquier hora. */
    public Franja franja() { return this.franja; }

    /** null = con cualquier tiempo. */
    public Clima clima() { return this.clima; }

    public boolean apareceEn(MetodoEncuentro metodo, Franja franja, Clima clima)
    {
        if(metodo != null && this.metodo != metodo) return false;

        if(this.franja != null && franja != null && this.franja != franja) return false;

        // Sin clima exigido aparece con cualquiera. Con clima exigido y sin clima
        // conocido se deja pasar: mas vale un encuentro de mas que una zona muda
        // porque su estado de clima todavia no se haya sorteado.
        return this.clima == null || clima == null || this.clima == clima;
    }
}
