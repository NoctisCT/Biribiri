package com.retro.pokemonengine.seguidor;

/**
 * Un estado del seguidor y la animacion PMD con la que se dibuja.
 *
 * `animacion` y `respaldo` son nombres reales del AnimData.xml de
 * PMDCollab/SpriteCollab. No todas las especies traen las 35 animaciones, asi que
 * el cliente prueba primero la principal y cae al respaldo; `Idle` y `Walk` estan
 * en todas.
 *
 * `vinculo` es el estado del avatar de Habbo que lo dispara. Los estados sin
 * vinculo son los interactivos: se piden pulsando el seguidor.
 */
public record EstadoSeguidor(
        String codigo,
        String nombreEs,
        String animacion,
        String respaldo,
        String vinculo,
        boolean interactivo,
        int duracionMs,
        int orden)
{
    /** Un estado con duracion vuelve solo a `parado` cuando se agota. */
    public boolean esPuntual()
    {
        return this.duracionMs > 0;
    }
}
