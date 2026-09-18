package com.retro.pokemonengine.combate;

import java.util.ArrayList;
import java.util.List;

/**
 * Ejecuta un movimiento ya decidido: golpes, daño, efectos secundarios y estados.
 *
 * Aquí viven las once categorías genéricas de PokéAPI. Todo lo que hacen sale de
 * los datos del catálogo, así que un movimiento nuevo de una categoría ya cubierta
 * funciona sin tocar este código.
 */
public final class EjecutorMovimiento
{
    private EjecutorMovimiento()
    {
    }

    /** Lo que el catálogo aporta más allá de lo que cabe en MovimientoCatalogo. */
    public record Mecanica(
            String categoria,
            String dolencia,
            int dolenciaChance,
            Integer golpesMin,
            Integer golpesMax,
            Integer turnosMin,
            Integer turnosMax,
            int drenaje,
            int curacion,
            int ratioCritico,
            int retrocesoChance,
            int statChance,
            List<CambioStat> cambiosStats,
            String statOfensivoForzado,
            String statDefensivoForzado)
    {
        public static Mecanica simple(String categoria)
        {
            return new Mecanica(categoria, "none", 0, null, null, null, null,
                    0, 0, 0, 0, 0, List.of(), null, null);
        }
    }

    public record CambioStat(Stat stat, int cambio)
    {
    }

    public static List<Evento> ejecutar(
            EstadoCombate estado,
            PokemonCombate atacante,
            PokemonCombate defensor,
            MovimientoCatalogo movimiento,
            Mecanica mecanica,
            CatalogoCombate catalogo)
    {
        List<Evento> eventos = new ArrayList<>();
        RngCombate rng = estado.rng();

        eventos.add(new Evento("usa_movimiento")
                .con("pokemon", atacante.nombre())
                .con("movimiento", movimiento.nombreEs()));

        if(!Impedimentos.acierta(movimiento, atacante, defensor, rng))
        {
            eventos.add(new Evento("fallo").con("pokemon", atacante.nombre()));
            return eventos;
        }

        double efectividad = catalogo.tipos().multiplicador(
                movimiento.tipoId(), defensor.tipo1(), defensor.tipo2());

        if(!movimiento.esEstado() && efectividad == 0.0)
        {
            eventos.add(new Evento("sin_efecto").con("pokemon", defensor.nombre()));
            return eventos;
        }

        int danoTotal = 0;

        if(!movimiento.esEstado() && movimiento.potencia() != null && movimiento.potencia() > 0)
        {
            int golpes = numeroDeGolpes(mecanica, rng);

            for(int i = 0; i < golpes && !defensor.debilitado(); i++)
            {
                danoTotal += golpear(estado, atacante, defensor, movimiento, mecanica, efectividad, eventos);
            }

            if(golpes > 1)
            {
                eventos.add(new Evento("multigolpe").con("golpes", golpes).con("dano", danoTotal));
            }

            if(efectividad > 1.0) eventos.add(new Evento("muy_eficaz"));
            else if(efectividad < 1.0) eventos.add(new Evento("poco_eficaz"));
        }

        aplicarDrenajeYRetroceso(atacante, mecanica, danoTotal, eventos);
        aplicarCuracion(atacante, mecanica, eventos);
        aplicarDolencia(defensor, mecanica, movimiento, rng, eventos);
        aplicarCambiosDeStats(atacante, defensor, mecanica, movimiento, rng, eventos);
        aplicarRetrocesoDelDefensor(defensor, mecanica, rng, eventos);

        if(defensor.debilitado())
        {
            eventos.add(new Evento("debilitado").con("pokemon", defensor.nombre()));
        }

        return eventos;
    }

    private static int numeroDeGolpes(Mecanica mecanica, RngCombate rng)
    {
        if(mecanica.golpesMin() == null || mecanica.golpesMax() == null) return 1;

        int min = mecanica.golpesMin();
        int max = mecanica.golpesMax();

        if(min == max) return Math.max(1, min);

        // Distribución de los juegos para los de 2 a 5: 2 y 3 son mucho más comunes.
        if(min == 2 && max == 5)
        {
            int tirada = rng.entre(1, 8);

            if(tirada <= 3) return 2;
            if(tirada <= 6) return 3;
            if(tirada == 7) return 4;

            return 5;
        }

        return rng.entre(min, max);
    }

    private static int golpear(
            EstadoCombate estado, PokemonCombate atacante, PokemonCombate defensor,
            MovimientoCatalogo movimiento, Mecanica mecanica, double efectividad, List<Evento> eventos)
    {
        RngCombate rng = estado.rng();

        boolean fisico = movimiento.esFisico();

        Stat statAtaque = statOfensivo(movimiento, mecanica);
        Stat statDefensa = statDefensivo(movimiento, mecanica);

        boolean critico = rng.porcentaje(probabilidadCritico(mecanica.ratioCritico()));

        boolean stab = movimiento.tipoId() == atacante.tipo1()
                || (atacante.tipo2() != null && movimiento.tipoId() == atacante.tipo2());

        int dano = CalculadoraDano.calcular(new CalculadoraDano.EntradaDano(
                atacante.nivelEfectivo(),
                movimiento.potencia(),
                atacante.statEfectivo(statAtaque),
                defensor.statEfectivo(statDefensa),
                efectividad,
                stab,
                critico,
                PokemonCombate.QUEMADURA.equals(atacante.estado()),
                fisico,
                1.0,
                rng.variacionDano()));

        int aplicado = defensor.recibirDano(dano);

        Evento golpe = new Evento("dano")
                .con("pokemon", defensor.nombre())
                .con("dano", aplicado)
                .con("psRestantes", defensor.psActual());

        if(critico) golpe.con("critico", true);

        eventos.add(golpe);

        return aplicado;
    }

    /** Ratio 0 es 1/24 en los juegos modernos; cada punto sube un escalón. */
    public static int probabilidadCritico(int ratio)
    {
        return switch(Math.max(0, ratio))
        {
            case 0 -> 4;
            case 1 -> 13;
            case 2 -> 50;
            default -> 100;
        };
    }

    private static Stat statOfensivo(MovimientoCatalogo movimiento, Mecanica mecanica)
    {
        if("def".equals(mecanica.statOfensivoForzado())) return Stat.DEFENSA;

        return movimiento.esFisico() ? Stat.ATAQUE : Stat.ATAQUE_ESP;
    }

    private static Stat statDefensivo(MovimientoCatalogo movimiento, Mecanica mecanica)
    {
        if("def".equals(mecanica.statDefensivoForzado())) return Stat.DEFENSA;

        return movimiento.esFisico() ? Stat.DEFENSA : Stat.DEFENSA_ESP;
    }

    private static void aplicarDrenajeYRetroceso(
            PokemonCombate atacante, Mecanica mecanica, int danoTotal, List<Evento> eventos)
    {
        if(danoTotal <= 0 || mecanica.drenaje() == 0) return;

        int cantidad = (int) Math.floor(danoTotal * Math.abs(mecanica.drenaje()) / 100.0);

        if(cantidad <= 0) cantidad = 1;

        if(mecanica.drenaje() > 0)
        {
            int curado = atacante.curar(cantidad);
            eventos.add(new Evento("drenaje").con("pokemon", atacante.nombre()).con("ps", curado));
        }
        else
        {
            int recibido = atacante.recibirDano(cantidad);
            eventos.add(new Evento("retroceso_dano").con("pokemon", atacante.nombre()).con("dano", recibido));
        }
    }

    private static void aplicarCuracion(PokemonCombate atacante, Mecanica mecanica, List<Evento> eventos)
    {
        if(mecanica.curacion() == 0) return;

        int cantidad = (int) Math.floor(atacante.psMax() * Math.abs(mecanica.curacion()) / 100.0);

        if(mecanica.curacion() > 0)
        {
            int curado = atacante.curar(cantidad);

            if(curado > 0) eventos.add(new Evento("curado").con("pokemon", atacante.nombre()).con("ps", curado));
        }
        else
        {
            int recibido = atacante.recibirDano(cantidad);
            eventos.add(new Evento("autodano").con("pokemon", atacante.nombre()).con("dano", recibido));
        }
    }

    private static void aplicarDolencia(
            PokemonCombate defensor, Mecanica mecanica, MovimientoCatalogo movimiento,
            RngCombate rng, List<Evento> eventos)
    {
        String dolencia = mecanica.dolencia();

        if(dolencia == null || "none".equals(dolencia)) return;
        if(defensor.debilitado()) return;

        int probabilidad = mecanica.dolenciaChance() > 0 ? mecanica.dolenciaChance() : 100;

        if(!rng.porcentaje(probabilidad)) return;

        if(PokemonCombate.CONFUSION.equals(dolencia))
        {
            if(defensor.tieneVolatil(PokemonCombate.CONFUSION)) return;

            int turnos = rng.entre(
                    mecanica.turnosMin() == null ? 2 : mecanica.turnosMin(),
                    mecanica.turnosMax() == null ? 5 : mecanica.turnosMax());

            defensor.ponerVolatil(PokemonCombate.CONFUSION, turnos);
            eventos.add(new Evento("confundido").con("pokemon", defensor.nombre()).con("turnos", turnos));

            return;
        }

        int contador = 0;

        if(PokemonCombate.SUENO.equals(dolencia))
        {
            contador = rng.entre(
                    mecanica.turnosMin() == null ? 1 : mecanica.turnosMin(),
                    mecanica.turnosMax() == null ? 3 : mecanica.turnosMax());
        }

        if(defensor.aplicarEstado(dolencia, contador))
        {
            eventos.add(new Evento("estado_aplicado")
                    .con("pokemon", defensor.nombre())
                    .con("estado", dolencia));
        }
    }

    private static void aplicarCambiosDeStats(
            PokemonCombate atacante, PokemonCombate defensor, Mecanica mecanica,
            MovimientoCatalogo movimiento, RngCombate rng, List<Evento> eventos)
    {
        if(mecanica.cambiosStats().isEmpty()) return;

        int probabilidad = mecanica.statChance() > 0 ? mecanica.statChance() : 100;

        if(!rng.porcentaje(probabilidad)) return;

        for(CambioStat cambio : mecanica.cambiosStats())
        {
            // Un cambio positivo en un movimiento de estado se lo aplica quien lo usa;
            // uno negativo va siempre al rival.
            boolean aUnoMismo = cambio.cambio() > 0;
            PokemonCombate objetivo = aUnoMismo ? atacante : defensor;

            if(objetivo.debilitado()) continue;

            int indice = indiceEtapa(cambio.stat());

            if(indice < 0) continue;

            int movido = objetivo.cambiarEtapa(indice, cambio.cambio());

            eventos.add(new Evento(movido == 0 ? "stat_sin_cambio" : "stat_cambiado")
                    .con("pokemon", objetivo.nombre())
                    .con("stat", cambio.stat().name())
                    .con("etapas", movido));
        }
    }

    private static void aplicarRetrocesoDelDefensor(
            PokemonCombate defensor, Mecanica mecanica, RngCombate rng, List<Evento> eventos)
    {
        if(mecanica.retrocesoChance() <= 0) return;
        if(defensor.debilitado()) return;

        if(rng.porcentaje(mecanica.retrocesoChance()))
        {
            defensor.ponerVolatil(PokemonCombate.RETROCESO, 1);
            eventos.add(new Evento("retroceso").con("pokemon", defensor.nombre()));
        }
    }

    public static int indiceEtapa(Stat stat)
    {
        return switch(stat)
        {
            case ATAQUE -> PokemonCombate.ETAPA_ATAQUE;
            case DEFENSA -> PokemonCombate.ETAPA_DEFENSA;
            case ATAQUE_ESP -> PokemonCombate.ETAPA_ATAQUE_ESP;
            case DEFENSA_ESP -> PokemonCombate.ETAPA_DEFENSA_ESP;
            case VELOCIDAD -> PokemonCombate.ETAPA_VELOCIDAD;
            case PS -> -1;
        };
    }
}
