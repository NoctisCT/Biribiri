package com.retro.pokemonengine.seguidor;

/**
 * Decide que hace el seguidor a partir de lo que hace el avatar.
 *
 * La precedencia es fija y de arriba abajo, porque en Habbo varias cosas son
 * ciertas a la vez: un avatar sentado tambien puede estar en idle, y uno que
 * baila tambien esta quieto. Gana siempre la mas especifica.
 *
 * Los estados puntuales (un saludo, una interaccion) caducan solos: la maquina
 * no tiene reloj, recibe el instante y decide.
 */
public final class MaquinaAnimacion
{
    /** La foto del avatar en un instante. Nada de esto viene del emulador directamente. */
    public record EntradaAvatar(
            boolean enCombate,
            boolean debilitado,
            boolean tumbado,
            boolean sentado,
            boolean idle,
            boolean bailando,
            boolean caminando,
            String gestoPuntual,
            long gestoHastaMs,
            String interaccion,
            long interaccionHastaMs,
            long ahoraMs)
    {
    }

    private String anterior = CatalogoAnimaciones.PARADO;
    private long despertarHastaMs;

    public String anterior()
    {
        return this.anterior;
    }

    public EstadoSeguidor resolver(EntradaAvatar avatar)
    {
        EstadoSeguidor estado = calcular(avatar);

        this.anterior = estado.codigo();

        return estado;
    }

    private EstadoSeguidor calcular(EntradaAvatar a)
    {
        if(a.debilitado()) return estado(CatalogoAnimaciones.DEBILITADO);
        if(a.enCombate()) return estado(CatalogoAnimaciones.PARADO);

        // Lo que el jugador ha pedido a mano gana a lo automatico mientras dure.
        if(vigente(a.interaccion(), a.interaccionHastaMs(), a.ahoraMs()))
        {
            EstadoSeguidor pedido = CatalogoAnimaciones.por(a.interaccion());

            if(pedido != null) return pedido;
        }

        if(a.tumbado()) return estado(CatalogoAnimaciones.TUMBADO);
        if(a.sentado()) return estado(CatalogoAnimaciones.SENTADO);

        if(a.idle()) return estado(CatalogoAnimaciones.DURMIENDO);

        // Salir del idle no devuelve a parado de golpe: primero se despereza.
        if(CatalogoAnimaciones.DURMIENDO.equals(this.anterior))
        {
            this.despertarHastaMs = a.ahoraMs() + duracion(CatalogoAnimaciones.DESPERTANDO);

            return estado(CatalogoAnimaciones.DESPERTANDO);
        }

        if(CatalogoAnimaciones.DESPERTANDO.equals(this.anterior)
                && this.despertarHastaMs > a.ahoraMs())
        {
            return estado(CatalogoAnimaciones.DESPERTANDO);
        }

        if(a.bailando()) return estado(CatalogoAnimaciones.BAILANDO);

        if(vigente(a.gestoPuntual(), a.gestoHastaMs(), a.ahoraMs()))
        {
            EstadoSeguidor gesto = CatalogoAnimaciones.por(a.gestoPuntual());

            if(gesto != null) return gesto;
        }

        if(a.caminando()) return estado(CatalogoAnimaciones.CAMINANDO);

        return estado(CatalogoAnimaciones.PARADO);
    }

    private static boolean vigente(String codigo, long hastaMs, long ahoraMs)
    {
        return codigo != null && !codigo.isBlank() && hastaMs > ahoraMs;
    }

    private static int duracion(String codigo)
    {
        EstadoSeguidor estado = CatalogoAnimaciones.por(codigo);

        return estado == null ? 0 : estado.duracionMs();
    }

    private static EstadoSeguidor estado(String codigo)
    {
        EstadoSeguidor estado = CatalogoAnimaciones.por(codigo);

        return estado == null ? CatalogoAnimaciones.parado() : estado;
    }
}
