package com.retro.pokemonengine.migraciones;

import java.sql.Connection;

public interface Migracion
{
    int version();

    String nombre();

    void aplicar(Connection conexion) throws Exception;
}
