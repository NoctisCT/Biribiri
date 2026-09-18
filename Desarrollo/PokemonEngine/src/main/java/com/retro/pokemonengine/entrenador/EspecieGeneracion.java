package com.retro.pokemonengine.entrenador;

import com.retro.pokemonengine.combate.EspecieCatalogo;

/**
 * Lo que hace falta para crear un Pokemon, que es mas de lo que el combate necesita.
 *
 * Compone la vista de combate en vez de duplicarla, para que los stats base tengan
 * un unico origen.
 *
 * `femaleRatio` es el porcentaje de hembras de la especie: null para las que no
 * tienen genero, 0 para las que son siempre macho y 100 para las que son siempre hembra.
 */
public record EspecieGeneracion(
        EspecieCatalogo base,
        Integer habilidad1Id,
        Integer habilidad2Id,
        Integer habilidadOcultaId,
        Double femaleRatio,
        int amistadBase,
        int pasosHuevo)
{
    public int id()
    {
        return this.base.id();
    }

    public boolean sinGenero()
    {
        return this.femaleRatio == null;
    }

    public TablaExperiencia.Curva curva()
    {
        return TablaExperiencia.porNombre(this.base.growthRate());
    }
}
