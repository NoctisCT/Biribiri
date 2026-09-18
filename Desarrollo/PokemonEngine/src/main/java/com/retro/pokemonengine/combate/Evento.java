package com.retro.pokemonengine.combate;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Lo que el cliente reproduce. El motor no escribe texto: emite eventos con datos
 * y es el cliente quien los traduce y los anima.
 */
public final class Evento
{
    private final String tipo;
    private final Map<String, Object> datos;

    public Evento(String tipo)
    {
        this(tipo, new LinkedHashMap<>());
    }

    public Evento(String tipo, Map<String, Object> datos)
    {
        this.tipo = tipo;
        this.datos = datos;
    }

    public String tipo() { return this.tipo; }
    public Map<String, Object> datos() { return this.datos; }

    public Evento con(String clave, Object valor)
    {
        this.datos.put(clave, valor);
        return this;
    }

    @Override
    public String toString()
    {
        return this.tipo + this.datos;
    }
}
