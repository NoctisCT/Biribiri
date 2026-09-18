package com.retro.pokemonengine.migraciones;

import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

class PlanMigracionTest
{
    private static Migracion falsa(int version)
    {
        return new Migracion()
        {
            @Override
            public int version()
            {
                return version;
            }

            @Override
            public String nombre()
            {
                return "falsa" + version;
            }

            @Override
            public void aplicar(Connection conexion)
            {
            }
        };
    }

    @Test
    void desdeCeroAplicaTodas()
    {
        List<Migracion> todas = Arrays.asList(falsa(1), falsa(2), falsa(3));

        List<Migracion> pendientes = PlanMigracion.pendientes(0, todas);

        assertEquals(3, pendientes.size());
        assertEquals(1, pendientes.get(0).version());
        assertEquals(3, pendientes.get(2).version());
    }

    @Test
    void desdeVersionIntermediaAplicaSoloLasPosteriores()
    {
        List<Migracion> todas = Arrays.asList(falsa(1), falsa(2), falsa(3));

        List<Migracion> pendientes = PlanMigracion.pendientes(2, todas);

        assertEquals(1, pendientes.size());
        assertEquals(3, pendientes.get(0).version());
    }

    @Test
    void desdeVersionAdelantadaNoAplicaNada()
    {
        List<Migracion> todas = Arrays.asList(falsa(1), falsa(2), falsa(3));

        assertTrue(PlanMigracion.pendientes(5, todas).isEmpty());
    }

    @Test
    void ordenaAunqueLleguenDesordenadas()
    {
        List<Migracion> todas = Arrays.asList(falsa(3), falsa(1), falsa(2));

        List<Migracion> pendientes = PlanMigracion.pendientes(0, todas);

        assertEquals(1, pendientes.get(0).version());
        assertEquals(2, pendientes.get(1).version());
        assertEquals(3, pendientes.get(2).version());
    }

    @Test
    void rechazaVersionesDuplicadas()
    {
        List<Migracion> todas = Arrays.asList(falsa(1), falsa(1));

        try
        {
            PlanMigracion.pendientes(0, todas);
            fail("Debería rechazar versiones duplicadas");
        }
        catch(IllegalStateException esperada)
        {
            assertTrue(esperada.getMessage().contains("1"));
        }
    }
}
