package com.retro.pokemonengine;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

import java.util.LinkedHashMap;
import java.util.Map;

public final class PokemonCuerpo
{
    private static final Gson GSON = new GsonBuilder().create();

    private PokemonCuerpo()
    {
    }

    public static String datos(Object payload)
    {
        if(payload == null) return "{}";

        return GSON.toJson(payload);
    }

    public static String error(String codigo, String mensaje)
    {
        Map<String, String> cuerpo = new LinkedHashMap<>();

        cuerpo.put("code", codigo == null ? "ERROR" : codigo);
        cuerpo.put("message", mensaje == null ? "" : mensaje);

        return GSON.toJson(cuerpo);
    }
}
