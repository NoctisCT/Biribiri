package com.retro.pokemonengine.entrenador;

import com.retro.pokemonengine.combate.EspecieCatalogo;

import java.util.Set;

/**
 * Evolucionar cambia la especie y casi nada mas.
 *
 * Todo lo que hace unico a ese Pokemon concreto se queda: IV, EV, naturaleza,
 * genero, variocolor, entrenador original, ball, donde y a que nivel se
 * capturo, mote, amistad y experiencia. Perder cualquiera de esas cosas
 * convertiria la evolucion en un castigo para quien ha criado con cuidado.
 *
 * Solo dos cosas se recalculan, y por motivos distintos:
 *
 * - Los **PS maximos**, porque dependen de las bases de la especie. El dano
 *   recibido se arrastra tal cual: evolucionar no cura.
 * - La **habilidad**, que se vuelve a resolver por el hueco. La oculta sigue
 *   siendo oculta.
 *
 * Y un caso raro: si la especie nueva no tiene la variante de disfraz que
 * llevaba, vuelve a `normal`. Un Raichu no puede llevar un disfraz que solo
 * existe dibujado para Pikachu.
 */
public final class ReglasEvolucion
{
    public static final String VARIANTE_NORMAL = "normal";

    private ReglasEvolucion()
    {
    }

    /**
     * @param antes la especie de la que viene, que hace falta para medir el
     *              dano recibido con las bases correctas.
     */
    public static void evolucionar(PokemonPoseido pokemon, EspecieCatalogo antes,
                                   EspecieGeneracion nueva, Set<String> variantesDeLaNueva)
    {
        if(pokemon == null || nueva == null) return;

        boolean debilitado = pokemon.psActual() <= 0;

        // El dano se mide antes de cambiar de especie, con las bases viejas.
        int danoRecibido = antes == null
                ? 0
                : Math.max(0, pokemon.psMax(antes) - pokemon.psActual());

        pokemon.ponerEspecieId(nueva.id());

        int psMaxNuevo = pokemon.psMax(nueva.base());

        pokemon.ponerPsActual(debilitado ? 0 : Math.max(1, psMaxNuevo - danoRecibido));
        pokemon.ponerHabilidadId(habilidadDelHueco(nueva, pokemon.habilidadSlot()));

        String variante = pokemon.variante();

        if(variante != null && !VARIANTE_NORMAL.equals(variante)
                && (variantesDeLaNueva == null || !variantesDeLaNueva.contains(variante)))
        {
            pokemon.ponerVariante(VARIANTE_NORMAL);
        }
    }

    /**
     * El hueco 3 es la habilidad oculta y se queda oculta. Si la especie nueva
     * no tiene esa habilidad concreta, se cae al hueco 1, que siempre existe.
     */
    private static Integer habilidadDelHueco(EspecieGeneracion especie, int hueco)
    {
        Integer elegida = switch(hueco)
        {
            case 2 -> especie.habilidad2Id();
            case 3 -> especie.habilidadOcultaId();
            default -> especie.habilidad1Id();
        };

        return elegida != null ? elegida : especie.habilidad1Id();
    }
}
