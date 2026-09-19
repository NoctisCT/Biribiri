package com.retro.pokemonengine.batalla;

import com.retro.pokemonengine.entrenador.CatalogoGeneracion;
import com.retro.pokemonengine.entrenador.TablaExperiencia;

import java.util.ArrayList;
import java.util.List;

/**
 * Que le pasa a un Pokemon cuando gana experiencia.
 *
 * Decide, no ejecuta: dice a que nivel llega, que movimientos aprendio por el
 * camino y si le toca evolucionar. Guardar eso es cosa de quien tenga la
 * conexion, y asi el calculo se prueba sin emulador y sin base de datos.
 *
 * Los movimientos se juntan por tramo y no por nivel final: subir cuatro
 * niveles de golpe tiene que ensenar los cuatro, no solo el ultimo.
 */
public final class Progreso
{
    /** `nivelMinimo` en cero significa que esa evolucion no va por nivel. */
    public record Evolucion(int destinoId, int nivelMinimo)
    {
    }

    public record Resultado(
            int nivelAntes,
            int nivelDespues,
            long experienciaFinal,
            List<Integer> movimientosAprendidos,
            Integer evolucionA)
    {
        public boolean subio()
        {
            return this.nivelDespues > this.nivelAntes;
        }
    }

    private Progreso()
    {
    }

    public static Resultado aplicar(TablaExperiencia.Curva curva, int especieId, int nivelAntes,
                                    long experienciaAntes, long ganada,
                                    CatalogoGeneracion catalogo, List<Evolucion> evoluciones)
    {
        long tope = TablaExperiencia.expParaNivel(curva, TablaExperiencia.NIVEL_MAX);
        long fin = Math.min(tope, experienciaAntes + Math.max(0L, ganada));

        int nivelDespues = Math.max(nivelAntes, TablaExperiencia.nivelParaExp(curva, fin));

        List<Integer> aprendidos = new ArrayList<>();

        if(nivelDespues > nivelAntes && catalogo != null)
        {
            for(CatalogoGeneracion.MovimientoAprendido movimiento
                    : catalogo.movimientosPorNivel(especieId, nivelDespues))
            {
                if(movimiento.nivel() > nivelAntes && movimiento.nivel() <= nivelDespues)
                {
                    aprendidos.add(movimiento.moveId());
                }
            }
        }

        Integer evolucionA = null;

        if(evoluciones != null)
        {
            for(Evolucion evolucion : evoluciones)
            {
                if(evolucion.nivelMinimo() > 0 && nivelDespues >= evolucion.nivelMinimo())
                {
                    evolucionA = evolucion.destinoId();
                    break;
                }
            }
        }

        return new Resultado(nivelAntes, nivelDespues, fin, List.copyOf(aprendidos), evolucionA);
    }
}
