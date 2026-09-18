package com.retro.pokemonengine;

import com.retro.pokemonengine.captura.FormulaCaptura;
import com.retro.pokemonengine.combate.RngCombate;
import com.retro.pokemonengine.entrenador.Almacenamiento;
import com.retro.pokemonengine.entrenador.Mochila;
import com.retro.pokemonengine.entrenador.PokemonPoseido;

import java.util.List;

/**
 * Tirar una ball a un encuentro salvaje.
 *
 * El orden importa: primero se comprueba que el Pokemon tendria donde caer y
 * despues se gasta la ball. Al reves, una captura con el almacen lleno gastaria
 * la ball y perderia el Pokemon.
 */
public final class ServicioCaptura
{
    public static final String SIN_ENCUENTRO = "SIN_ENCUENTRO";
    public static final String NO_ES_BALL = "NO_ES_BALL";
    public static final String NO_TIENES = "NO_TIENES";
    public static final String ALMACEN_LLENO = "ALMACEN_LLENO";

    private ServicioCaptura()
    {
    }

    public record Resultado(
            boolean ok,
            String codigo,
            boolean capturado,
            int sacudidas,
            Integer especieId,
            String ubicacion,
            int ballsRestantes)
    {
        public static Resultado mal(String codigo)
        {
            return new Resultado(false, codigo, false, 0, null, null, 0);
        }
    }

    public static Resultado intentar(int userId, int ballId) throws Exception
    {
        ServicioEncuentros.Salvaje salvaje = ServicioEncuentros.activo(userId);

        if(salvaje == null) return Resultado.mal(SIN_ENCUENTRO);

        ServicioObjetos.Objeto ball = ServicioObjetos.objeto(ballId);

        if(ball == null || !ball.esBall()) return Resultado.mal(NO_ES_BALL);

        List<PokemonPoseido> todos = ServicioEntrenador.cargarPokemon(userId);

        if(Almacenamiento.huecoLibreEnEquipo(todos) < 0
                && Almacenamiento.primerHuecoLibreEnCajas(todos) == null)
        {
            return Resultado.mal(ALMACEN_LLENO);
        }

        Mochila mochila = ServicioEntrenador.cargarMochila(userId);

        if(!mochila.quitar(ballId, 1).ok()) return Resultado.mal(NO_TIENES);

        ServicioEntrenador.escribirMochila(userId, mochila);

        int restantes = mochila.cantidad(ballId);

        FormulaCaptura.Resultado tirada = FormulaCaptura.intentar(
                salvaje.psMax(),
                salvaje.psActual(),
                salvaje.especie().catchRate(),
                ball.ballRatioX10(),
                salvaje.estado(),
                new RngCombate(System.nanoTime() ^ ((long) userId << 16)));

        if(!tirada.capturado())
        {
            return new Resultado(true, "OK", false, tirada.sacudidas(),
                    salvaje.especie().id(), null, restantes);
        }

        PokemonPoseido capturado = salvaje.pokemon();

        capturado.ponerBallId(ballId);
        capturado.ponerUserId(userId);
        capturado.ponerEntrenadorOriginalId(userId);

        Almacenamiento.Resultado sitio = Almacenamiento.anadir(todos, capturado);

        if(!sitio.ok()) return Resultado.mal(sitio.codigo());

        ServicioEntrenador.insertar(capturado);
        ServicioEntrenador.guardarMovimientos(capturado);
        ServicioEntrenador.registrarCapturado(userId, capturado.especieId(), capturado.shiny());

        ServicioEncuentros.limpiar(userId);

        return new Resultado(true, "OK", true, tirada.sacudidas(),
                capturado.especieId(), capturado.ubicacion(), restantes);
    }
}
