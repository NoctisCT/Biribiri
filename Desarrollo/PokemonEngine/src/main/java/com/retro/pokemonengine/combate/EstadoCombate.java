package com.retro.pokemonengine.combate;

public final class EstadoCombate
{
    public static final String SIN_CLIMA = "none";
    public static final String SIN_TERRENO = "none";

    private final Bando[] bandos = new Bando[2];
    private final RngCombate rng;

    private String clima = SIN_CLIMA;
    private int climaTurnos;
    private String terreno = SIN_TERRENO;
    private int terrenoTurnos;
    private int turno;
    private boolean terminado;
    private int ganador = -1;

    public EstadoCombate(Bando bandoA, Bando bandoB, RngCombate rng)
    {
        this.bandos[0] = bandoA;
        this.bandos[1] = bandoB;
        this.rng = rng;
    }

    public Bando bando(int indice) { return this.bandos[indice]; }
    public RngCombate rng() { return this.rng; }
    public String clima() { return this.clima; }
    public int climaTurnos() { return this.climaTurnos; }
    public String terreno() { return this.terreno; }
    public int terrenoTurnos() { return this.terrenoTurnos; }
    public int turno() { return this.turno; }
    public boolean terminado() { return this.terminado; }
    public int ganador() { return this.ganador; }

    public void avanzarTurno()
    {
        this.turno++;
    }

    public void ponerClima(String clima, int turnos)
    {
        this.clima = clima;
        this.climaTurnos = turnos;
    }

    public void ponerTerreno(String terreno, int turnos)
    {
        this.terreno = terreno;
        this.terrenoTurnos = turnos;
    }

    public void reducirClimaYTerreno()
    {
        if(this.climaTurnos > 0 && --this.climaTurnos == 0) this.clima = SIN_CLIMA;
        if(this.terrenoTurnos > 0 && --this.terrenoTurnos == 0) this.terreno = SIN_TERRENO;
    }

    public void terminar(int ganador)
    {
        this.terminado = true;
        this.ganador = ganador;
    }

    /** El bando contrario al dado. Con dos bandos es trivial, pero deja el motor legible. */
    public Bando contrario(int indice)
    {
        return this.bandos[1 - indice];
    }
}
