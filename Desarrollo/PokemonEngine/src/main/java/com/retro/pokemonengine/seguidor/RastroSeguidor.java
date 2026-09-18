package com.retro.pokemonengine.seguidor;

/**
 * La estela del seguidor.
 *
 * Regla unica, la misma que en los juegos: el Pokemon ocupa la baldosa que el
 * entrenador acaba de dejar. No hay pathfinding ni persecucion, y por eso nunca
 * se queda atascado ni se separa: siempre esta exactamente a un paso.
 *
 * El rodillo y el teletransporte mueven al jugador mas de una baldosa de golpe;
 * en ese caso el seguidor aparece encima de el en vez de caminar hasta alli.
 */
public final class RastroSeguidor
{
    private int x;
    private int y;
    private int direccion = Direccion.SUR;
    private boolean colocado;

    public int x() { return this.x; }
    public int y() { return this.y; }
    public int direccion() { return this.direccion; }
    public boolean colocado() { return this.colocado; }

    public record Paso(int x, int y, int direccion, boolean teletransporte)
    {
    }

    /** Al salir a la sala aparece sobre el jugador, sin paso previo. */
    public Paso aparecer(int x, int y, int direccion)
    {
        this.x = x;
        this.y = y;

        if(direccion >= 0) this.direccion = direccion;

        this.colocado = true;

        return new Paso(this.x, this.y, this.direccion, true);
    }

    public void retirar()
    {
        this.colocado = false;
    }

    public Paso alPasar(int desdeX, int desdeY, int haciaX, int haciaY)
    {
        if(!this.colocado)
        {
            return aparecer(desdeX, desdeY, Direccion.entre(desdeX, desdeY, haciaX, haciaY));
        }

        // El jugador no ha caminado, lo han movido: el seguidor va con el.
        if(Direccion.distancia(desdeX, desdeY, haciaX, haciaY) > 1)
        {
            return aparecer(haciaX, haciaY, Direccion.entre(desdeX, desdeY, haciaX, haciaY));
        }

        int nueva = Direccion.entre(this.x, this.y, desdeX, desdeY);
        boolean salto = Direccion.distancia(this.x, this.y, desdeX, desdeY) > 1;

        this.x = desdeX;
        this.y = desdeY;

        if(nueva >= 0) this.direccion = nueva;

        return new Paso(this.x, this.y, this.direccion, salto);
    }

    /** Cuando el jugador gira sin moverse, el seguidor lo mira. */
    public void mirarA(int haciaX, int haciaY)
    {
        int nueva = Direccion.entre(this.x, this.y, haciaX, haciaY);

        if(nueva >= 0) this.direccion = nueva;
    }
}
