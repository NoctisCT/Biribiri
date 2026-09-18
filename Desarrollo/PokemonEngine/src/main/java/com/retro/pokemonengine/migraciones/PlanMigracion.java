package com.retro.pokemonengine.migraciones;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public final class PlanMigracion
{
    private PlanMigracion()
    {
    }

    public static List<Migracion> pendientes(int versionActual, List<Migracion> todas)
    {
        Set<Integer> vistas = new HashSet<>();

        for(Migracion migracion : todas)
        {
            if(!vistas.add(migracion.version()))
            {
                throw new IllegalStateException(
                        "Versión de migración duplicada: " + migracion.version());
            }
        }

        List<Migracion> resultado = new ArrayList<>();

        for(Migracion migracion : todas)
        {
            if(migracion.version() > versionActual) resultado.add(migracion);
        }

        resultado.sort(Comparator.comparingInt(Migracion::version));

        return resultado;
    }
}
