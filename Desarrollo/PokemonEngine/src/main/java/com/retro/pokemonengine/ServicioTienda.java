package com.retro.pokemonengine;

import com.eu.habbo.Emulator;
import com.retro.pokemonengine.entrenador.Economia;
import com.retro.pokemonengine.entrenador.Mochila;
import com.retro.pokemonengine.tienda.ReglasTienda;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Las tiendas contra la base de datos.
 *
 * Las cabeceras se cargan al arrancar porque no cambian; las existencias se leen
 * en cada operacion, porque si son limitadas cambian con cada compra.
 *
 * Las reglas estan en ReglasTienda, que es pura. Aqui solo se ordena lo que no
 * se puede probar sin base de datos: reservar existencias antes de cobrar y
 * devolver el dinero si algo falla despues.
 */
public final class ServicioTienda
{
    public static final String TIPO_CENTRO = "centro";
    public static final String TIPO_TIENDA = "tienda";

    public static final String NO_EXISTE = "NO_EXISTE";
    public static final String CERRADA = "CERRADA";

    public record Tienda(
            int id,
            String codigo,
            String nombreEs,
            String tipo,
            Integer zonaId,
            Integer roomId,
            int insigniasRequeridas,
            boolean activa)
    {
    }

    public record Articulo(
            int stockId,
            ServicioObjetos.Objeto objeto,
            int precio,
            int insigniasRequeridas,
            int existencias,
            int orden)
    {
        public ReglasTienda.Articulo aReglas()
        {
            return new ReglasTienda.Articulo(
                    this.objeto.id(),
                    this.objeto.bolsillo(),
                    this.precio,
                    this.objeto.precioVenta(),
                    this.insigniasRequeridas,
                    this.existencias);
        }
    }

    private static Map<Integer, Tienda> tiendas = Collections.emptyMap();

    private ServicioTienda()
    {
    }

    public static void cargar() throws Exception
    {
        Map<Integer, Tienda> nuevas = new HashMap<>();

        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            Statement s = c.createStatement();
            ResultSet r = s.executeQuery(
                    "SELECT id, codigo, nombre_es, tipo, zone_id, room_id, insignias_requeridas, activa" +
                    " FROM pokemon_shops"))
        {
            while(r.next())
            {
                int zonaId = r.getInt("zone_id");
                boolean sinZona = r.wasNull();
                int roomId = r.getInt("room_id");
                boolean sinSala = r.wasNull();

                nuevas.put(r.getInt("id"), new Tienda(
                        r.getInt("id"),
                        r.getString("codigo"),
                        r.getString("nombre_es"),
                        r.getString("tipo"),
                        sinZona ? null : zonaId,
                        sinSala ? null : roomId,
                        r.getInt("insignias_requeridas"),
                        r.getInt("activa") == 1));
            }
        }

        tiendas = Collections.unmodifiableMap(nuevas);

        System.out.println("[PokemonEngine] Tiendas: " + tiendas.size() + " dadas de alta.");
    }

    public static Tienda tienda(int id)
    {
        return tiendas.get(id);
    }

    public static List<Tienda> deZona(int zonaId)
    {
        List<Tienda> salida = new ArrayList<>();

        for(Tienda tienda : tiendas.values())
        {
            if(tienda.activa() && tienda.zonaId() != null && tienda.zonaId() == zonaId) salida.add(tienda);
        }

        salida.sort((a, b) -> a.codigo().compareTo(b.codigo()));

        return salida;
    }

    public static int total()
    {
        return tiendas.size();
    }

    /** El escaparate, ya resuelto contra el catalogo de objetos. */
    public static List<Articulo> articulos(int tiendaId) throws Exception
    {
        List<Articulo> salida = new ArrayList<>();

        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            PreparedStatement p = c.prepareStatement(
                    "SELECT id, item_id, precio, insignias_requeridas, existencias, orden" +
                    " FROM pokemon_shop_stock WHERE shop_id = ? ORDER BY orden, id"))
        {
            p.setInt(1, tiendaId);

            try(ResultSet r = p.executeQuery())
            {
                while(r.next())
                {
                    ServicioObjetos.Objeto objeto = ServicioObjetos.objeto(r.getInt("item_id"));

                    if(objeto == null) continue;

                    int precio = r.getInt("precio");

                    if(r.wasNull()) precio = objeto.precio();

                    salida.add(new Articulo(
                            r.getInt("id"),
                            objeto,
                            precio,
                            r.getInt("insignias_requeridas"),
                            r.getInt("existencias"),
                            r.getInt("orden")));
                }
            }
        }

        return salida;
    }

    public static Articulo articulo(int tiendaId, int itemId) throws Exception
    {
        for(Articulo articulo : articulos(tiendaId))
        {
            if(articulo.objeto().id() == itemId) return articulo;
        }

        return null;
    }

    /**
     * Compra: comprueba, reserva existencias, cobra y entrega. Si algo falla
     * despues de cobrar, se devuelve el dinero y las existencias.
     */
    public static ReglasTienda.Resultado comprar(int userId, int tiendaId, int itemId, int cantidad)
            throws Exception
    {
        Tienda tienda = tienda(tiendaId);

        if(tienda == null) return ReglasTienda.Resultado.mal(NO_EXISTE);
        if(!tienda.activa() || !TIPO_TIENDA.equals(tienda.tipo()))
        {
            return ReglasTienda.Resultado.mal(CERRADA);
        }

        Articulo articulo = articulo(tiendaId, itemId);

        if(articulo == null) return ReglasTienda.Resultado.mal(ReglasTienda.NO_ESTA_A_LA_VENTA);

        ServicioEntrenador.Entrenador entrenador = ServicioEntrenador.cargar(userId);
        int insignias = Integer.bitCount(entrenador.insignias);

        if(insignias < tienda.insigniasRequeridas())
        {
            return ReglasTienda.Resultado.mal(ReglasTienda.SIN_INSIGNIAS);
        }

        Mochila mochila = ServicioEntrenador.cargarMochila(userId);

        ReglasTienda.Resultado compra = ReglasTienda.comprar(
                articulo.aReglas(), cantidad, entrenador.pokedollars, insignias, mochila);

        if(!compra.ok()) return compra;

        if(!reservarExistencias(articulo, cantidad))
        {
            return ReglasTienda.Resultado.mal(ReglasTienda.SIN_EXISTENCIAS);
        }

        Economia.Movimiento cobro = ServicioEconomia.aplicar(
                userId, -compra.dinero(), Economia.ORIGEN_TIENDA, "tienda:" + tiendaId + ":item:" + itemId);

        if(!cobro.ok())
        {
            devolverExistencias(articulo, cantidad);

            return ReglasTienda.Resultado.mal(ReglasTienda.SIN_SALDO);
        }

        try
        {
            ServicioEntrenador.escribirMochila(userId, mochila);
        }
        catch(Exception error)
        {
            ServicioEconomia.aplicar(userId, compra.dinero(), Economia.ORIGEN_TIENDA,
                    "devolucion:" + tiendaId + ":item:" + itemId);
            devolverExistencias(articulo, cantidad);

            throw error;
        }

        return compra;
    }

    /** Vender no necesita tienda: se vende desde la mochila al precio del objeto. */
    public static ReglasTienda.Resultado vender(int userId, int itemId, int cantidad) throws Exception
    {
        ServicioObjetos.Objeto objeto = ServicioObjetos.objeto(itemId);

        if(objeto == null) return ReglasTienda.Resultado.mal(ReglasTienda.NO_SE_VENDE);

        Mochila mochila = ServicioEntrenador.cargarMochila(userId);

        ReglasTienda.Articulo articulo = new ReglasTienda.Articulo(
                objeto.id(), objeto.bolsillo(), objeto.precio(), objeto.precioVenta(), 0,
                ReglasTienda.EXISTENCIAS_ILIMITADAS);

        ReglasTienda.Resultado venta = ReglasTienda.vender(articulo, cantidad, mochila);

        if(!venta.ok()) return venta;

        ServicioEntrenador.escribirMochila(userId, mochila);

        if(venta.dinero() > 0)
        {
            ServicioEconomia.aplicar(userId, venta.dinero(), Economia.ORIGEN_VENTA, "venta:item:" + itemId);
        }

        return venta;
    }

    /**
     * Resta existencias con la condicion en el propio UPDATE: dos compras a la
     * vez no pueden llevarse la misma ultima unidad.
     */
    private static boolean reservarExistencias(Articulo articulo, int cantidad) throws Exception
    {
        if(articulo.existencias() == ReglasTienda.EXISTENCIAS_ILIMITADAS) return true;

        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            PreparedStatement p = c.prepareStatement(
                    "UPDATE pokemon_shop_stock SET existencias = existencias - ?" +
                    " WHERE id = ? AND existencias >= ?"))
        {
            p.setInt(1, cantidad);
            p.setInt(2, articulo.stockId());
            p.setInt(3, cantidad);

            return p.executeUpdate() == 1;
        }
    }

    private static void devolverExistencias(Articulo articulo, int cantidad) throws Exception
    {
        if(articulo.existencias() == ReglasTienda.EXISTENCIAS_ILIMITADAS) return;

        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            PreparedStatement p = c.prepareStatement(
                    "UPDATE pokemon_shop_stock SET existencias = existencias + ? WHERE id = ?"))
        {
            p.setInt(1, cantidad);
            p.setInt(2, articulo.stockId());
            p.executeUpdate();
        }
    }
}
