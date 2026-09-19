package com.retro.pokemonengine.batalla;

import com.retro.pokemonengine.combate.Accion;
import com.retro.pokemonengine.combate.PokemonCombate;
import com.retro.pokemonengine.combate.RngCombate;

import java.util.ArrayList;
import java.util.List;

/**
 * Lo que hace el salvaje en su turno.
 *
 * Elige al azar entre los movimientos que le quedan con PP, y ya esta. No es
 * una IA y no pretende serlo: un salvaje de los juegos tampoco piensa, y darle
 * estrategia a un Rattata de nivel dos solo haria mas frustrante el primer
 * combate de la partida. La IA de verdad llegara con los gimnasios, y llegara
 * como otro controlador, sin tocar esto.
 */
public final class MenteSalvaje
{
    private MenteSalvaje()
    {
    }

    public static Accion elegir(PokemonCombate salvaje, int bando, int posicion, RngCombate rng)
    {
        int contrario = 1 - bando;

        List<Integer> conPp = new ArrayList<>();

        if(salvaje != null)
        {
            for(int i = 0; i < salvaje.movimientos().size(); i++)
            {
                if(salvaje.movimientos().get(i).tienePp()) conPp.add(i);
            }
        }

        // Sin PP en ninguno se manda el primero: el motor emitira "sin_pp" y el
        // turno se pierde, que es exactamente lo que pasa en los juegos.
        if(conPp.isEmpty())
        {
            return Accion.movimiento(bando, posicion, 0, contrario, posicion);
        }

        int elegido = conPp.get(rng.entre(0, conPp.size() - 1));

        return Accion.movimiento(bando, posicion, elegido, contrario, posicion);
    }
}
