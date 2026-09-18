package com.retro.pokemonengine.entrenador;

import com.retro.pokemonengine.combate.Naturaleza;
import com.retro.pokemonengine.combate.PokemonCombate;
import com.retro.pokemonengine.combate.RngCombate;
import com.retro.pokemonengine.combate.Stat;

import java.util.List;

/**
 * Crea un Pokemon nuevo: salvaje, regalado o de un entrenador.
 *
 * Todo el azar entra por el RNG sembrado, asi que un encuentro se puede reproducir
 * entero a partir de su semilla. La habilidad oculta no sale sola: hay que pedirla,
 * igual que en los juegos, donde solo llega por metodos concretos.
 */
public final class GeneradorPokemon
{
    public static final int PROB_SHINY = 4096;
    public static final int PROB_POKERUS = 21845;
    public static final int MOVIMIENTOS_MAX = 4;

    private GeneradorPokemon()
    {
    }

    /**
     * @param probabilidadHabilidadOculta de 0 a 100. Cero en los encuentros normales.
     * @param multiplicadorShiny numero de tiradas de shiny; 1 es la probabilidad base.
     */
    public record Opciones(
            int userId,
            int probabilidadHabilidadOculta,
            int multiplicadorShiny,
            Integer zonaId,
            int ballId,
            int temporadaId)
    {
        public static Opciones salvaje(int userId, Integer zonaId, int temporadaId)
        {
            return new Opciones(userId, 0, 1, zonaId, 4, temporadaId);
        }
    }

    public static PokemonPoseido generar(
            EspecieGeneracion especie, int nivel, Opciones opciones, RngCombate rng)
    {
        PokemonPoseido pokemon = new PokemonPoseido();

        pokemon.ponerUserId(opciones.userId());
        pokemon.ponerEntrenadorOriginalId(opciones.userId());
        pokemon.ponerEspecieId(especie.id());
        pokemon.ponerNivel(nivel);
        pokemon.ponerExperiencia(TablaExperiencia.expParaNivel(especie.curva(), nivel));
        pokemon.ponerTemporadaId(opciones.temporadaId());
        pokemon.ponerBallId(opciones.ballId());
        pokemon.ponerZonaCapturaId(opciones.zonaId());
        pokemon.ponerNivelCaptura(nivel);
        pokemon.ponerAmistad(especie.amistadBase());
        pokemon.ponerPasosHuevo(especie.pasosHuevo());

        for(Stat stat : Stat.values())
        {
            pokemon.ivs()[stat.ordinal()] = rng.entre(0, PokemonPoseido.IV_MAX);
        }

        pokemon.ponerNaturaleza(Naturaleza.values()[rng.entre(0, Naturaleza.values().length - 1)]);
        pokemon.ponerGenero(genero(especie, rng));
        pokemon.ponerShiny(tiradaShiny(opciones.multiplicadorShiny(), rng));
        pokemon.ponerPokerus(rng.entre(1, PROB_POKERUS) == 1);
        pokemon.ponerPsActual(pokemon.psMax(especie.base()));

        asignarHabilidad(pokemon, especie, opciones.probabilidadHabilidadOculta(), rng);

        return pokemon;
    }

    /** Los cuatro ultimos movimientos que la especie aprende hasta ese nivel. */
    public static void asignarMovimientosIniciales(
            PokemonPoseido pokemon, CatalogoGeneracion catalogo)
    {
        List<CatalogoGeneracion.MovimientoAprendido> aprendidos =
                catalogo.movimientosPorNivel(pokemon.especieId(), pokemon.nivel());

        pokemon.movimientos().clear();

        int desde = Math.max(0, aprendidos.size() - MOVIMIENTOS_MAX);

        for(int i = desde; i < aprendidos.size(); i++)
        {
            int moveId = aprendidos.get(i).moveId();

            pokemon.movimientos().add(MovimientoPoseido.nuevo(moveId, catalogo.ppBase(moveId)));
        }
    }

    private static int genero(EspecieGeneracion especie, RngCombate rng)
    {
        if(especie.sinGenero()) return PokemonCombate.GENERO_NINGUNO;

        double hembras = especie.femaleRatio();

        if(hembras <= 0.0) return PokemonCombate.GENERO_MACHO;
        if(hembras >= 100.0) return PokemonCombate.GENERO_HEMBRA;

        // Los juegos reparten el genero en octavos de 256; se usa la misma escala
        // para que un 12,5% sea exactamente uno de cada ocho y no un redondeo.
        int umbral = (int) Math.round(hembras * 256.0 / 100.0);

        return rng.entre(0, 255) < umbral ? PokemonCombate.GENERO_HEMBRA : PokemonCombate.GENERO_MACHO;
    }

    private static boolean tiradaShiny(int multiplicador, RngCombate rng)
    {
        int tiradas = Math.max(1, multiplicador);

        for(int i = 0; i < tiradas; i++)
        {
            if(rng.entre(1, PROB_SHINY) == 1) return true;
        }

        return false;
    }

    private static void asignarHabilidad(
            PokemonPoseido pokemon, EspecieGeneracion especie, int probabilidadOculta, RngCombate rng)
    {
        if(especie.habilidadOcultaId() != null
                && probabilidadOculta > 0
                && rng.porcentaje(probabilidadOculta))
        {
            pokemon.ponerHabilidadSlot(3);
            pokemon.ponerHabilidadId(especie.habilidadOcultaId());
            return;
        }

        boolean tieneSegunda = especie.habilidad2Id() != null;

        if(tieneSegunda && rng.entre(0, 1) == 1)
        {
            pokemon.ponerHabilidadSlot(2);
            pokemon.ponerHabilidadId(especie.habilidad2Id());
            return;
        }

        if(especie.habilidad1Id() != null)
        {
            pokemon.ponerHabilidadSlot(1);
            pokemon.ponerHabilidadId(especie.habilidad1Id());
            return;
        }

        // Especie sin primera habilidad en el catalogo: se queda con la segunda si la hay.
        pokemon.ponerHabilidadSlot(tieneSegunda ? 2 : 1);
        pokemon.ponerHabilidadId(especie.habilidad2Id());
    }
}
