package com.retro.pokemonengine.combate;

import java.util.ArrayList;
import java.util.List;

/**
 * Lo que puede impedir que un Pokémon actúe en su turno, y la comprobación de
 * precisión del movimiento.
 *
 * Se resuelve en el orden de los juegos: congelación, sueño, parálisis,
 * retroceso y confusión.
 */
public final class Impedimentos
{
    public static final int PROB_DESCONGELAR = 20;
    public static final int PROB_PARALISIS_FALLA = 25;
    public static final int PROB_CONFUSION_SE_GOLPEA = 33;
    public static final int POTENCIA_GOLPE_CONFUSION = 40;

    private Impedimentos()
    {
    }

    public record Resultado(boolean puedeActuar, List<Evento> eventos)
    {
    }

    public static Resultado comprobar(PokemonCombate quien, RngCombate rng)
    {
        List<Evento> eventos = new ArrayList<>();

        if(PokemonCombate.CONGELACION.equals(quien.estado()))
        {
            if(rng.porcentaje(PROB_DESCONGELAR))
            {
                quien.curarEstado();
                eventos.add(new Evento("estado_curado").con("pokemon", quien.nombre()).con("estado", "freeze"));
            }
            else
            {
                eventos.add(new Evento("impedido").con("pokemon", quien.nombre()).con("motivo", "freeze"));
                return new Resultado(false, eventos);
            }
        }

        if(PokemonCombate.SUENO.equals(quien.estado()))
        {
            quien.reducirContadorEstado();

            if(quien.contadorEstado() <= 0)
            {
                quien.curarEstado();
                eventos.add(new Evento("estado_curado").con("pokemon", quien.nombre()).con("estado", "sleep"));
            }
            else
            {
                eventos.add(new Evento("impedido").con("pokemon", quien.nombre()).con("motivo", "sleep"));
                return new Resultado(false, eventos);
            }
        }

        if(quien.tieneVolatil(PokemonCombate.RETROCESO))
        {
            quien.quitarVolatil(PokemonCombate.RETROCESO);
            eventos.add(new Evento("impedido").con("pokemon", quien.nombre()).con("motivo", "flinch"));
            return new Resultado(false, eventos);
        }

        if(PokemonCombate.PARALISIS.equals(quien.estado()) && rng.porcentaje(PROB_PARALISIS_FALLA))
        {
            eventos.add(new Evento("impedido").con("pokemon", quien.nombre()).con("motivo", "paralysis"));
            return new Resultado(false, eventos);
        }

        if(quien.tieneVolatil(PokemonCombate.CONFUSION))
        {
            int turnos = quien.volatil(PokemonCombate.CONFUSION) - 1;

            if(turnos <= 0)
            {
                quien.quitarVolatil(PokemonCombate.CONFUSION);
                eventos.add(new Evento("confusion_fin").con("pokemon", quien.nombre()));
            }
            else
            {
                quien.ponerVolatil(PokemonCombate.CONFUSION, turnos);

                if(rng.porcentaje(PROB_CONFUSION_SE_GOLPEA))
                {
                    int dano = CalculadoraDano.calcular(new CalculadoraDano.EntradaDano(
                            quien.nivelEfectivo(),
                            POTENCIA_GOLPE_CONFUSION,
                            quien.statEfectivo(Stat.ATAQUE),
                            quien.statEfectivo(Stat.DEFENSA),
                            1.0, false, false, false, true, 1.0,
                            rng.variacionDano()));

                    int aplicado = quien.recibirDano(dano);

                    eventos.add(new Evento("confusion_autogolpe")
                            .con("pokemon", quien.nombre())
                            .con("dano", aplicado));

                    return new Resultado(false, eventos);
                }
            }
        }

        return new Resultado(true, eventos);
    }

    /**
     * Un movimiento sin precisión declarada nunca falla: así están modelados en
     * el catálogo los que en los juegos no pueden fallar.
     */
    public static boolean acierta(MovimientoCatalogo movimiento, PokemonCombate atacante,
                                  PokemonCombate defensor, RngCombate rng)
    {
        if(movimiento.precision() == null) return true;

        double punteria = Etapas.multiplicadorPunteria(atacante.etapa(PokemonCombate.ETAPA_PRECISION));
        double evasion = Etapas.multiplicadorPunteria(defensor.etapa(PokemonCombate.ETAPA_EVASION));

        int probabilidad = (int) Math.floor(movimiento.precision() * punteria / evasion);

        return rng.porcentaje(Math.max(1, Math.min(100, probabilidad)));
    }
}
