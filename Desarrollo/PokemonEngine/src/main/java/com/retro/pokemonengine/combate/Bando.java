package com.retro.pokemonengine.combate;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Un lado del combate.
 *
 * Las posiciones son una lista desde el primer día, no un unico activo: es lo que
 * permite que los combates dobles no exijan reescribir el motor.
 */
public final class Bando
{
    private final int indice;
    private final List<PokemonCombate> posiciones = new ArrayList<>();
    private final List<PokemonCombate> banquillo = new ArrayList<>();
    private final Map<String, Integer> condiciones = new HashMap<>();

    public Bando(int indice)
    {
        this.indice = indice;
    }

    public int indice() { return this.indice; }
    public List<PokemonCombate> posiciones() { return this.posiciones; }
    public List<PokemonCombate> banquillo() { return this.banquillo; }
    public Map<String, Integer> condiciones() { return this.condiciones; }

    public PokemonCombate activo(int posicion)
    {
        return posicion >= 0 && posicion < this.posiciones.size() ? this.posiciones.get(posicion) : null;
    }

    public boolean tieneCondicion(String clave)
    {
        return this.condiciones.containsKey(clave);
    }

    public boolean ponerCondicion(String clave, int turnos)
    {
        if(this.condiciones.containsKey(clave)) return false;

        this.condiciones.put(clave, turnos);

        return true;
    }

    public void quitarCondicion(String clave)
    {
        this.condiciones.remove(clave);
    }

    /** true si queda alguien con PS, dentro o fuera del campo. */
    public boolean puedeSeguir()
    {
        for(PokemonCombate p : this.posiciones) if(!p.debilitado()) return true;
        for(PokemonCombate p : this.banquillo) if(!p.debilitado()) return true;

        return false;
    }
}
