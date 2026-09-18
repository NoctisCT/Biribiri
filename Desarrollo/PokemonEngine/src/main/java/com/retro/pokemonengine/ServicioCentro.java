package com.retro.pokemonengine;

import com.retro.pokemonengine.combate.EspecieCatalogo;
import com.retro.pokemonengine.combate.PokemonCombate;
import com.retro.pokemonengine.entrenador.Almacenamiento;
import com.retro.pokemonengine.entrenador.MovimientoPoseido;
import com.retro.pokemonengine.entrenador.PokemonPoseido;

import java.util.List;

/**
 * El Centro Pokemon: cura el equipo entero.
 *
 * Es gratis y no toca la economia. Cura solo el equipo, no las cajas: un Pokemon
 * guardado no se pelea, y curarlo todo escondería que al jugador le queda trabajo.
 */
public final class ServicioCentro
{
    private ServicioCentro()
    {
    }

    public record Curacion(int curados, int total)
    {
    }

    public static Curacion curar(int userId) throws Exception
    {
        List<PokemonPoseido> todos = ServicioEntrenador.cargarPokemon(userId);
        List<PokemonPoseido> equipo = Almacenamiento.equipo(todos);
        int curados = 0;

        for(PokemonPoseido pokemon : equipo)
        {
            if(curarUno(pokemon)) curados++;
        }

        return new Curacion(curados, equipo.size());
    }

    private static boolean curarUno(PokemonPoseido pokemon) throws Exception
    {
        EspecieCatalogo especie = ServicioPokedex.especie(pokemon.especieId());

        if(especie == null) return false;

        int psMax = pokemon.psMax(especie);
        boolean cambiado = pokemon.psActual() < psMax
                || !PokemonCombate.SIN_ESTADO.equals(pokemon.estado());

        pokemon.ponerPsActual(psMax);
        pokemon.ponerEstado(PokemonCombate.SIN_ESTADO);
        pokemon.ponerEstadoTurnos(0);

        for(MovimientoPoseido movimiento : pokemon.movimientos())
        {
            if(movimiento.ppActual() < movimiento.ppMaximo()) cambiado = true;

            movimiento.restaurarTodo();
        }

        ServicioEntrenador.guardar(pokemon);
        ServicioEntrenador.guardarMovimientos(pokemon);

        return cambiado;
    }
}
