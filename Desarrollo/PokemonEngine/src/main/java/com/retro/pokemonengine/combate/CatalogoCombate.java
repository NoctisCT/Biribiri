package com.retro.pokemonengine.combate;

/**
 * Lo único que el motor necesita saber del catálogo.
 *
 * Existe para que el paquete `combate` no dependa de `ServicioPokedex`, que sí
 * importa el emulador: en pruebas se sustituye por un catálogo falso.
 */
public interface CatalogoCombate
{
    MovimientoCatalogo movimiento(int id);

    EspecieCatalogo especie(int id);

    TablaTipos tipos();
}
