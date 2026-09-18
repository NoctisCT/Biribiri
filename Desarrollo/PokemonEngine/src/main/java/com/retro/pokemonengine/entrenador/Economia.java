package com.retro.pokemonengine.entrenador;

/**
 * Los pokedolares.
 *
 * Es moneda propia del juego, separada de los creditos del hotel: aqui no se
 * toca nada del emulador. Cada cambio produce un movimiento con el saldo que
 * queda, que es lo que se escribe en pokemon_currency_log para poder auditar.
 */
public final class Economia
{
    public static final long SALDO_MAX = 999_999_999L;

    public static final String OK = "OK";
    public static final String SALDO_INSUFICIENTE = "SALDO_INSUFICIENTE";
    public static final String SIN_CAMBIO = "SIN_CAMBIO";

    // Origenes conocidos. La lista crece con cada hito que mueva dinero.
    public static final String ORIGEN_COMBATE = "combate";
    public static final String ORIGEN_TIENDA = "tienda";
    public static final String ORIGEN_VENTA = "venta";
    public static final String ORIGEN_CENTRO = "centro";
    public static final String ORIGEN_TORNEO = "torneo";
    public static final String ORIGEN_ADMIN = "admin";

    private Economia()
    {
    }

    public record Movimiento(
            boolean ok,
            String codigo,
            long delta,
            long saldoResultante,
            String origen,
            String referencia)
    {
        public static Movimiento mal(String codigo, long saldo)
        {
            return new Movimiento(false, codigo, 0L, saldo, null, null);
        }
    }

    public static Movimiento aplicar(long saldo, long delta, String origen, String referencia)
    {
        if(delta == 0L) return Movimiento.mal(SIN_CAMBIO, saldo);

        long base = Math.max(0L, saldo);

        if(delta < 0L && base + delta < 0L) return Movimiento.mal(SALDO_INSUFICIENTE, base);

        // Un ingreso que pasaria del tope se recorta, y el movimiento guarda el
        // delta que de verdad ha entrado, no el que se pidio.
        long nuevo = Math.min(SALDO_MAX, base + delta);
        long aplicado = nuevo - base;

        if(aplicado == 0L) return Movimiento.mal(SIN_CAMBIO, base);

        return new Movimiento(true, OK, aplicado, nuevo, origen, referencia);
    }

    public static Movimiento ingresar(long saldo, long cantidad, String origen, String referencia)
    {
        return aplicar(saldo, Math.abs(cantidad), origen, referencia);
    }

    public static Movimiento gastar(long saldo, long cantidad, String origen, String referencia)
    {
        return aplicar(saldo, -Math.abs(cantidad), origen, referencia);
    }

    public static boolean puedePagar(long saldo, long precio)
    {
        return precio >= 0L && Math.max(0L, saldo) >= precio;
    }
}
