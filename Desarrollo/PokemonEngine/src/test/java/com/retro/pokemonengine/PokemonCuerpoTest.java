package com.retro.pokemonengine;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PokemonCuerpoTest
{
    static class Saludo
    {
        int protocolVersion;
        int userId;

        Saludo(int protocolVersion, int userId)
        {
            this.protocolVersion = protocolVersion;
            this.userId = userId;
        }
    }

    @Test
    void serializaLosDatos()
    {
        String json = PokemonCuerpo.datos(new Saludo(1, 42));

        assertTrue(json.contains("\"protocolVersion\":1"), json);
        assertTrue(json.contains("\"userId\":42"), json);
    }

    @Test
    void elPayloadNuloDaObjetoVacio()
    {
        assertEquals("{}", PokemonCuerpo.datos(null));
    }

    @Test
    void serializaElError()
    {
        String json = PokemonCuerpo.error("ZONA_NO_ACTIVA", "Esta sala no es de Kanto");

        assertTrue(json.contains("\"code\":\"ZONA_NO_ACTIVA\""), json);
        assertTrue(json.contains("\"message\":\"Esta sala no es de Kanto\""), json);
    }
}
