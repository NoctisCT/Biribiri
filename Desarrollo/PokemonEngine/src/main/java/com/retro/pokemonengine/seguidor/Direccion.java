package com.retro.pokemonengine.seguidor;

/**
 * Las ocho direcciones de Habbo, en su orden: 0 norte y girando en el sentido
 * de las agujas del reloj.
 *
 * Reproduce exactamente `Rotation.Calculate` del emulador, pero sin importarlo,
 * para que este paquete se pueda probar sin el. La prueba compara las ocho
 * salidas contra la implementacion real.
 */
public final class Direccion
{
    public static final int NORTE = 0;
    public static final int NORESTE = 1;
    public static final int ESTE = 2;
    public static final int SURESTE = 3;
    public static final int SUR = 4;
    public static final int SUROESTE = 5;
    public static final int OESTE = 6;
    public static final int NOROESTE = 7;

    public static final int SIN_CAMBIO = -1;

    private Direccion()
    {
    }

    /** -1 cuando no hay desplazamiento: quien llama conserva la direccion anterior. */
    public static int desde(int dx, int dy)
    {
        if(dx < 0 && dy < 0) return NOROESTE;
        if(dx > 0 && dy > 0) return SURESTE;
        if(dx < 0 && dy > 0) return SUROESTE;
        if(dx > 0 && dy < 0) return NORESTE;
        if(dx < 0) return OESTE;
        if(dx > 0) return ESTE;
        if(dy > 0) return SUR;
        if(dy < 0) return NORTE;

        return SIN_CAMBIO;
    }

    public static int entre(int desdeX, int desdeY, int haciaX, int haciaY)
    {
        return desde(haciaX - desdeX, haciaY - desdeY);
    }

    public static int opuesta(int direccion)
    {
        if(direccion < 0) return SIN_CAMBIO;

        return (direccion + 4) % 8;
    }

    /** Distancia de rey: cuantos pasos hacen falta pudiendo ir en diagonal. */
    public static int distancia(int x1, int y1, int x2, int y2)
    {
        return Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
    }
}
