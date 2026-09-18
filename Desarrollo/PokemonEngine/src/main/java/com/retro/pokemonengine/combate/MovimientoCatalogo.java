package com.retro.pokemonengine.combate;

public record MovimientoCatalogo(
        int id,
        String nombreEs,
        int tipoId,
        String clase,
        Integer potencia,
        Integer precision,
        int pp,
        int prioridad,
        String objetivo,
        String effectCode,
        boolean vigente)
{
    public boolean esFisico()
    {
        return "physical".equals(this.clase);
    }

    public boolean esEspecial()
    {
        return "special".equals(this.clase);
    }

    public boolean esEstado()
    {
        return "status".equals(this.clase);
    }
}
