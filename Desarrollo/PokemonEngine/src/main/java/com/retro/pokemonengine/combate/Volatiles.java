package com.retro.pokemonengine.combate;

import java.util.ArrayList;
import java.util.List;

/**
 * Estados volatiles: los que duran mientras el Pokemon sigue en el campo y se
 * pierden al cambiarlo, a diferencia de los estados alterados.
 *
 * Aqui estan los que restringen que movimiento se puede usar (Mofa, Tormento,
 * Anulacion, Embargo) y los que actuan al final del turno (Maldicion,
 * Canto Mortal).
 */
public final class Volatiles
{
    public static final int PROB_ENAMORADO_NO_ATACA = 50;
    public static final int TURNOS_MOFA = 3;
    public static final int TURNOS_ANULACION = 4;
    public static final int TURNOS_EMBARGO = 5;
    public static final int TURNOS_CANTO_MORTAL = 3;

    /** Confusion dura 1-4 turnos en las generaciones recientes. */
    public static final int CONFUSION_MIN = 1;
    public static final int CONFUSION_MAX = 4;

    private Volatiles()
    {
    }

    public record Restriccion(boolean permitido, String motivo)
    {
        public static final Restriccion PERMITIDO = new Restriccion(true, null);

        public static Restriccion prohibido(String motivo)
        {
            return new Restriccion(false, motivo);
        }
    }

    /**
     * Si el Pokemon puede usar ese movimiento concreto.
     *
     * Mofa prohibe los movimientos de estado, Tormento prohibe repetir el
     * anterior y Anulacion prohibe el que quedo deshabilitado.
     */
    public static Restriccion puedeUsar(PokemonCombate quien, MovimientoCatalogo movimiento)
    {
        if(quien.tieneVolatil(PokemonCombate.MOFA) && movimiento.esEstado())
        {
            return Restriccion.prohibido("taunt");
        }

        if(quien.tieneVolatil(PokemonCombate.TORMENTO) && quien.ultimoMovimiento() == movimiento.id())
        {
            return Restriccion.prohibido("torment");
        }

        if(quien.movimientoAnulado() == movimiento.id())
        {
            return Restriccion.prohibido("disable");
        }

        return Restriccion.PERMITIDO;
    }

    /** Si el entrenador puede usarle objetos. Embargo lo impide. */
    public static boolean puedeUsarObjetos(PokemonCombate quien)
    {
        return !quien.tieneVolatil(PokemonCombate.EMBARGO);
    }

    /**
     * Enamorado: la mitad de las veces pierde el turno.
     *
     * Se comprueba junto al resto de impedimentos, despues de la paralisis y
     * antes de la confusion.
     */
    public static boolean enamoradoImpide(PokemonCombate quien, RngCombate rng)
    {
        if(!quien.tieneVolatil(PokemonCombate.ENAMORADO)) return false;

        return rng.porcentaje(PROB_ENAMORADO_NO_ATACA);
    }

    /**
     * Residuales de volatiles al cerrar el turno: Maldicion quita un cuarto y
     * Canto Mortal descuenta su cuenta atras.
     */
    public static List<Evento> alFinDeTurno(EstadoCombate estado)
    {
        List<Evento> eventos = new ArrayList<>();

        for(int i = 0; i < 2; i++)
        {
            for(PokemonCombate p : estado.bando(i).posiciones())
            {
                if(p.debilitado()) continue;

                if(p.tieneVolatil(PokemonCombate.MALDITO))
                {
                    int aplicado = p.recibirDano(Math.max(1, p.psMax() / 4));

                    eventos.add(new Evento("dano_maldicion")
                            .con("pokemon", p.nombre()).con("dano", aplicado));

                    if(p.debilitado())
                    {
                        eventos.add(new Evento("debilitado").con("pokemon", p.nombre()));
                        continue;
                    }
                }

                if(p.tieneVolatil(PokemonCombate.CANTO_MORTAL))
                {
                    int restantes = p.volatil(PokemonCombate.CANTO_MORTAL) - 1;

                    if(restantes <= 0)
                    {
                        p.recibirDano(p.psActual());
                        p.quitarVolatil(PokemonCombate.CANTO_MORTAL);

                        eventos.add(new Evento("canto_mortal_cumplido").con("pokemon", p.nombre()));
                        eventos.add(new Evento("debilitado").con("pokemon", p.nombre()));
                    }
                    else
                    {
                        p.ponerVolatil(PokemonCombate.CANTO_MORTAL, restantes);

                        eventos.add(new Evento("canto_mortal_cuenta")
                                .con("pokemon", p.nombre()).con("turnos", restantes));
                    }
                }

                caducar(p, PokemonCombate.MOFA, "taunt", eventos);
                caducar(p, PokemonCombate.EMBARGO, "embargo", eventos);

                if(p.tieneVolatil(PokemonCombate.ANULACION))
                {
                    int restantes = p.volatil(PokemonCombate.ANULACION) - 1;

                    if(restantes <= 0)
                    {
                        p.quitarVolatil(PokemonCombate.ANULACION);
                        p.anularMovimiento(-1);

                        eventos.add(new Evento("volatil_fin")
                                .con("pokemon", p.nombre()).con("volatil", "disable"));
                    }
                    else
                    {
                        p.ponerVolatil(PokemonCombate.ANULACION, restantes);
                    }
                }

                // El retroceso solo vale para el turno en que se provoca: si el
                // afectado ya habia atacado, no debe arrastrarse al turno siguiente.
                p.quitarVolatil(PokemonCombate.RETROCESO);
            }
        }

        return eventos;
    }

    private static void caducar(PokemonCombate p, String clave, String nombre, List<Evento> eventos)
    {
        if(!p.tieneVolatil(clave)) return;

        int restantes = p.volatil(clave) - 1;

        if(restantes <= 0)
        {
            p.quitarVolatil(clave);
            eventos.add(new Evento("volatil_fin").con("pokemon", p.nombre()).con("volatil", nombre));
        }
        else
        {
            p.ponerVolatil(clave, restantes);
        }
    }
}
