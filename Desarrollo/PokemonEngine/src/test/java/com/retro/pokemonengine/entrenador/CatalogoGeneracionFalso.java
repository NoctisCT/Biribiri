package com.retro.pokemonengine.entrenador;

import com.retro.pokemonengine.combate.EspecieCatalogo;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Catalogo de mentira para las pruebas de generacion: sin base de datos. */
final class CatalogoGeneracionFalso implements CatalogoGeneracion
{
    static final int NORMAL = 1;
    static final int ELECTRICO = 13;

    private final Map<Integer, EspecieGeneracion> especies = new HashMap<>();
    private final Map<Integer, List<MovimientoAprendido>> learnsets = new HashMap<>();
    private final Map<Integer, Integer> pps = new HashMap<>();

    static EspecieCatalogo base(int id, String nombre, String curva)
    {
        return new EspecieCatalogo(
                id, nombre, NORMAL, null,
                50, 50, 50, 50, 50, 50,
                255, 100, curva);
    }

    static EspecieGeneracion especie(
            int id, String nombre, String curva,
            Integer hab1, Integer hab2, Integer oculta, Double femaleRatio, int amistad)
    {
        return new EspecieGeneracion(
                base(id, nombre, curva), hab1, hab2, oculta, femaleRatio, amistad, 5120);
    }

    CatalogoGeneracionFalso con(EspecieGeneracion especie)
    {
        this.especies.put(especie.id(), especie);
        return this;
    }

    CatalogoGeneracionFalso aprende(int especieId, int moveId, int nivel, int ppBase)
    {
        this.learnsets.computeIfAbsent(especieId, k -> new ArrayList<>())
                .add(new MovimientoAprendido(moveId, nivel));

        this.pps.put(moveId, ppBase);

        return this;
    }

    @Override
    public EspecieGeneracion especie(int especieId)
    {
        return this.especies.get(especieId);
    }

    @Override
    public List<MovimientoAprendido> movimientosPorNivel(int especieId, int nivel)
    {
        List<MovimientoAprendido> salida = new ArrayList<>();

        for(MovimientoAprendido m : this.learnsets.getOrDefault(especieId, List.of()))
        {
            if(m.nivel() <= nivel) salida.add(m);
        }

        salida.sort(Comparator.comparingInt(MovimientoAprendido::nivel));

        return salida;
    }

    @Override
    public int ppBase(int moveId)
    {
        return this.pps.getOrDefault(moveId, 15);
    }
}
