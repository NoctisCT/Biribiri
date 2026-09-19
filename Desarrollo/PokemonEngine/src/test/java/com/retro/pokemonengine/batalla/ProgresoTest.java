package com.retro.pokemonengine.batalla;

import com.retro.pokemonengine.entrenador.CatalogoGeneracion;
import com.retro.pokemonengine.entrenador.EspecieGeneracion;
import com.retro.pokemonengine.entrenador.TablaExperiencia;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProgresoTest
{
    /** Aprende algo en los niveles 5, 7 y 12, y nada mas. */
    private final CatalogoGeneracion catalogo = new CatalogoGeneracion()
    {
        @Override
        public EspecieGeneracion especie(int especieId)
        {
            return null;
        }

        @Override
        public List<MovimientoAprendido> movimientosPorNivel(int especieId, int nivel)
        {
            List<MovimientoAprendido> lista = new ArrayList<>();

            for(int n : new int[]{5, 7, 12})
            {
                if(n <= nivel) lista.add(new MovimientoAprendido(100 + n, n));
            }

            return lista;
        }

        @Override
        public int ppBase(int moveId)
        {
            return 20;
        }
    };

    private final TablaExperiencia.Curva curva = TablaExperiencia.Curva.MEDIA;

    @Test
    void sinExperienciaSuficienteNoSubeDeNivel()
    {
        long exp = TablaExperiencia.expParaNivel(this.curva, 5);

        Progreso.Resultado r = Progreso.aplicar(
                this.curva, 25, 5, exp, 1L, this.catalogo, List.of());

        assertEquals(5, r.nivelDespues());
        assertTrue(r.movimientosAprendidos().isEmpty());
    }

    @Test
    void alSubirVariosNivelesAprendeTodoLoQueSeSalto()
    {
        long desde = TablaExperiencia.expParaNivel(this.curva, 4);
        long hasta = TablaExperiencia.expParaNivel(this.curva, 8);

        Progreso.Resultado r = Progreso.aplicar(
                this.curva, 25, 4, desde, hasta - desde, this.catalogo, List.of());

        assertEquals(8, r.nivelDespues());
        assertEquals(List.of(105, 107), r.movimientosAprendidos(),
                "Los dos del camino, no solo el del nivel final");
    }

    @Test
    void loQueYaSabiaNoSeVuelveAAprender()
    {
        long desde = TablaExperiencia.expParaNivel(this.curva, 6);
        long hasta = TablaExperiencia.expParaNivel(this.curva, 8);

        Progreso.Resultado r = Progreso.aplicar(
                this.curva, 25, 6, desde, hasta - desde, this.catalogo, List.of());

        assertEquals(List.of(107), r.movimientosAprendidos(),
                "El del nivel 5 ya lo tenia antes de empezar");
    }

    @Test
    void alLlegarAlNivelDeEvolucionLoDice()
    {
        long desde = TablaExperiencia.expParaNivel(this.curva, 15);
        long hasta = TablaExperiencia.expParaNivel(this.curva, 16);

        List<Progreso.Evolucion> evoluciones = List.of(new Progreso.Evolucion(26, 16));

        Progreso.Resultado r = Progreso.aplicar(
                this.curva, 25, 15, desde, hasta - desde, this.catalogo, evoluciones);

        assertEquals(16, r.nivelDespues());
        assertEquals(26, r.evolucionA());
    }

    @Test
    void unaEvolucionQueNoEsPorNivelNoSeDispara()
    {
        long desde = TablaExperiencia.expParaNivel(this.curva, 15);
        long hasta = TablaExperiencia.expParaNivel(this.curva, 40);

        // nivelMinimo 0 es "esta evolucion no va por nivel": piedra, intercambio, amistad.
        List<Progreso.Evolucion> evoluciones = List.of(new Progreso.Evolucion(26, 0));

        Progreso.Resultado r = Progreso.aplicar(
                this.curva, 25, 15, desde, hasta - desde, this.catalogo, evoluciones);

        assertNull(r.evolucionA());
    }

    @Test
    void elNivelCienEsElTecho()
    {
        long tope = TablaExperiencia.expParaNivel(this.curva, TablaExperiencia.NIVEL_MAX);

        Progreso.Resultado r = Progreso.aplicar(
                this.curva, 25, 100, tope, 9_000_000L, this.catalogo, List.of());

        assertEquals(TablaExperiencia.NIVEL_MAX, r.nivelDespues());
        assertEquals(tope, r.experienciaFinal(),
                "La experiencia no se acumula por encima del tope");
    }
}
