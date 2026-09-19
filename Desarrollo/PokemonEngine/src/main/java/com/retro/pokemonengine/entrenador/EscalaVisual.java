package com.retro.pokemonengine.entrenador;

/**
 * El tamano con el que se dibuja un Pokemon.
 *
 * Sale de la altura, que ya esta importada, para no etiquetar 1.025 especies a
 * mano. La anulacion existe porque la altura miente en los extremos: Onix mide
 * 8,8 metros y no puede ocupar media sala.
 */
public final class EscalaVisual
{
    public static final String PEQUENO = "pequeno";
    public static final String MEDIANO = "mediano";
    public static final String GRANDE = "grande";
    public static final String MUY_GRANDE = "muy_grande";

    private static final String[] VALIDAS = { PEQUENO, MEDIANO, GRANDE, MUY_GRANDE };

    private EscalaVisual()
    {
    }

    public static String de(double alturaMetros, String anulacion)
    {
        if(anulacion != null)
        {
            for(String valida : VALIDAS)
            {
                if(valida.equalsIgnoreCase(anulacion)) return valida;
            }
        }

        if(alturaMetros <= 0.0) return MEDIANO;
        if(alturaMetros < 0.35) return PEQUENO;
        if(alturaMetros < 0.80) return MEDIANO;
        if(alturaMetros < 1.50) return GRANDE;

        return MUY_GRANDE;
    }
}
