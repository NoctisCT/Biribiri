package com.retro.pokemonengine.tienda;

import com.retro.pokemonengine.entrenador.Bolsillo;
import com.retro.pokemonengine.entrenador.Mochila;

/**
 * Las reglas de comprar y vender, sin base de datos ni emulador.
 *
 * Nada se cobra ni se entrega a medias: primero se comprueba todo y despues se
 * toca la mochila. El cobro real lo hace ServicioTienda en la misma transaccion.
 */
public final class ReglasTienda
{
    public static final String OK = "OK";
    public static final String CANTIDAD_INVALIDA = "CANTIDAD_INVALIDA";
    public static final String SIN_INSIGNIAS = "SIN_INSIGNIAS";
    public static final String SIN_EXISTENCIAS = "SIN_EXISTENCIAS";
    public static final String SIN_SALDO = "SIN_SALDO";
    public static final String SIN_SITIO = "SIN_SITIO";
    public static final String NO_TIENES = "NO_TIENES";
    public static final String NO_SE_VENDE = "NO_SE_VENDE";
    public static final String NO_ESTA_A_LA_VENTA = "NO_ESTA_A_LA_VENTA";

    /** Tope por compra, para que un cliente manipulado no pida un millon. */
    public static final int UNIDADES_MAX = 99;

    /** existencias = -1 significa que la tienda no se queda sin ese objeto. */
    public static final int EXISTENCIAS_ILIMITADAS = -1;

    private ReglasTienda()
    {
    }

    public record Articulo(
            int itemId,
            Bolsillo bolsillo,
            int precio,
            int precioVenta,
            int insigniasRequeridas,
            int existencias)
    {
    }

    public record Resultado(boolean ok, String codigo, int unidades, int dinero)
    {
        public static Resultado bien(int unidades, int dinero)
        {
            return new Resultado(true, OK, unidades, dinero);
        }

        public static Resultado mal(String codigo)
        {
            return new Resultado(false, codigo, 0, 0);
        }
    }

    /**
     * Comprueba la compra entera y solo entonces mete el objeto en la mochila.
     * El dinero del resultado es lo que hay que cobrar.
     */
    public static Resultado comprar(Articulo articulo, int cantidad, long saldo, int insignias,
                                    Mochila mochila)
    {
        if(articulo == null) return Resultado.mal(NO_ESTA_A_LA_VENTA);

        if(cantidad <= 0 || cantidad > UNIDADES_MAX) return Resultado.mal(CANTIDAD_INVALIDA);

        if(articulo.precio() <= 0) return Resultado.mal(NO_ESTA_A_LA_VENTA);

        if(insignias < articulo.insigniasRequeridas()) return Resultado.mal(SIN_INSIGNIAS);

        if(articulo.existencias() != EXISTENCIAS_ILIMITADAS && articulo.existencias() < cantidad)
        {
            return Resultado.mal(SIN_EXISTENCIAS);
        }

        long coste = (long) articulo.precio() * cantidad;

        if(coste > saldo) return Resultado.mal(SIN_SALDO);

        if(!mochila.cabe(articulo.itemId(), articulo.bolsillo(), cantidad))
        {
            return Resultado.mal(SIN_SITIO);
        }

        mochila.anadir(articulo.itemId(), articulo.bolsillo(), cantidad);

        return Resultado.bien(cantidad, (int) coste);
    }

    /**
     * Vender saca el objeto de la mochila y devuelve lo que hay que ingresar.
     * El precio de venta ya viene siendo la mitad del de compra: aqui no se divide.
     */
    public static Resultado vender(Articulo articulo, int cantidad, Mochila mochila)
    {
        if(articulo == null) return Resultado.mal(NO_SE_VENDE);

        if(cantidad <= 0 || cantidad > UNIDADES_MAX) return Resultado.mal(CANTIDAD_INVALIDA);

        if(!articulo.bolsillo().sePuedeVender()) return Resultado.mal(NO_SE_VENDE);

        if(mochila.cantidad(articulo.itemId()) < cantidad) return Resultado.mal(NO_TIENES);

        Mochila.Resultado quitado = mochila.quitar(articulo.itemId(), cantidad);

        if(!quitado.ok()) return Resultado.mal(quitado.codigo());

        return Resultado.bien(cantidad, Math.max(0, articulo.precioVenta()) * cantidad);
    }
}
