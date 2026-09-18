package com.retro.pokemonengine.combate;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

/**
 * Lo que ocurre al cerrar el turno, en el orden fijo de los juegos:
 * clima, veneno y quemadura, drenadoras, caducidad de condiciones de bando
 * y comprobación de debilitados.
 */
public final class FinDeTurno
{
    public static final String DRENADORAS = "leechseed";

    private FinDeTurno()
    {
    }

    public static List<Evento> resolver(EstadoCombate estado)
    {
        List<Evento> eventos = new ArrayList<>();

        aplicarClima(estado, eventos);
        aplicarTerreno(estado, eventos);
        aplicarResiduales(estado, eventos);
        aplicarDrenadoras(estado, eventos);
        eventos.addAll(Volatiles.alFinDeTurno(estado));
        caducarCondiciones(estado, eventos);

        estado.reducirClimaYTerreno();

        comprobarFin(estado, eventos);

        return eventos;
    }

    private static void aplicarClima(EstadoCombate estado, List<Evento> eventos)
    {
        String clima = estado.clima();

        if(EstadoCombate.SIN_CLIMA.equals(clima)) return;

        for(PokemonCombate p : activos(estado))
        {
            if(p.debilitado()) continue;
            if(!Campo.leDanaElClima(clima, p)) continue;

            int dano = Math.max(1, p.psMax() / 16);
            int aplicado = p.recibirDano(dano);

            eventos.add(new Evento("dano_clima")
                    .con("pokemon", p.nombre())
                    .con("clima", clima)
                    .con("dano", aplicado));
        }
    }

    /** El terreno de planta cura un dieciseisavo por turno a quien pisa el suelo. */
    private static void aplicarTerreno(EstadoCombate estado, List<Evento> eventos)
    {
        if(!Campo.TERRENO_PLANTA.equals(Campo.normalizar(estado.terreno()))) return;

        for(PokemonCombate p : activos(estado))
        {
            if(p.debilitado() || !Campo.pisaSuelo(p)) continue;

            int curado = p.curar(Math.max(1, p.psMax() / 16));

            if(curado > 0)
            {
                eventos.add(new Evento("cura_terreno")
                        .con("pokemon", p.nombre()).con("terreno", "grassyterrain").con("ps", curado));
            }
        }
    }

    private static void aplicarResiduales(EstadoCombate estado, List<Evento> eventos)
    {
        for(PokemonCombate p : activos(estado))
        {
            if(p.debilitado()) continue;

            if(PokemonCombate.QUEMADURA.equals(p.estado()))
            {
                int aplicado = p.recibirDano(Math.max(1, p.psMax() / 16));

                eventos.add(new Evento("dano_estado")
                        .con("pokemon", p.nombre()).con("estado", "burn").con("dano", aplicado));
            }
            else if(PokemonCombate.VENENO.equals(p.estado()))
            {
                int aplicado = p.recibirDano(Math.max(1, p.psMax() / 8));

                eventos.add(new Evento("dano_estado")
                        .con("pokemon", p.nombre()).con("estado", "poison").con("dano", aplicado));
            }
            else if(PokemonCombate.VENENO_GRAVE.equals(p.estado()))
            {
                // El veneno grave sube un dieciseisavo por turno: 1/16, 2/16, 3/16...
                p.aumentarContadorEstado();

                int capas = Math.max(1, p.contadorEstado());
                int aplicado = p.recibirDano(Math.max(1, p.psMax() * capas / 16));

                eventos.add(new Evento("dano_estado")
                        .con("pokemon", p.nombre()).con("estado", "toxic")
                        .con("capas", capas).con("dano", aplicado));
            }
        }
    }

    private static void aplicarDrenadoras(EstadoCombate estado, List<Evento> eventos)
    {
        for(int i = 0; i < 2; i++)
        {
            for(PokemonCombate p : estado.bando(i).posiciones())
            {
                if(p.debilitado() || !p.tieneVolatil(DRENADORAS)) continue;

                int robado = p.recibirDano(Math.max(1, p.psMax() / 8));

                eventos.add(new Evento("drenadoras").con("pokemon", p.nombre()).con("dano", robado));

                for(PokemonCombate rival : estado.contrario(i).posiciones())
                {
                    if(rival.debilitado()) continue;

                    int curado = rival.curar(robado);

                    if(curado > 0)
                    {
                        eventos.add(new Evento("drenadoras_cura")
                                .con("pokemon", rival.nombre()).con("ps", curado));
                    }

                    break;
                }
            }
        }
    }

    private static void caducarCondiciones(EstadoCombate estado, List<Evento> eventos)
    {
        for(int i = 0; i < 2; i++)
        {
            Map<String, Integer> condiciones = estado.bando(i).condiciones();
            Iterator<Map.Entry<String, Integer>> it = condiciones.entrySet().iterator();

            while(it.hasNext())
            {
                Map.Entry<String, Integer> entrada = it.next();

                // Las condiciones sin límite de turnos, como Púas, valen 0 y no caducan.
                if(entrada.getValue() <= 0) continue;

                int restantes = entrada.getValue() - 1;

                if(restantes <= 0)
                {
                    it.remove();
                    eventos.add(new Evento("condicion_bando_fin")
                            .con("bando", i).con("condicion", entrada.getKey()));
                }
                else
                {
                    entrada.setValue(restantes);
                }
            }
        }
    }

    private static void comprobarFin(EstadoCombate estado, List<Evento> eventos)
    {
        boolean puedeA = estado.bando(0).puedeSeguir();
        boolean puedeB = estado.bando(1).puedeSeguir();

        if(puedeA && puedeB) return;

        int ganador = puedeA ? 0 : (puedeB ? 1 : -1);

        estado.terminar(ganador);

        eventos.add(new Evento("combate_terminado").con("ganador", ganador));
    }

    private static List<PokemonCombate> activos(EstadoCombate estado)
    {
        List<PokemonCombate> todos = new ArrayList<>();

        todos.addAll(estado.bando(0).posiciones());
        todos.addAll(estado.bando(1).posiciones());

        return todos;
    }
}
