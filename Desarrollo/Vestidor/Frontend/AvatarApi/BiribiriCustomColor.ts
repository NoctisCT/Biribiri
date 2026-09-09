// BIRIBIRI_WARDROBE_V3_TRUE_RGB
export const BIRIBIRI_CUSTOM_COLOR_BASE = 100000000;
export const BIRIBIRI_CUSTOM_COLOR_MAX = BIRIBIRI_CUSTOM_COLOR_BASE + 0xFFFFFF;

export const IsBiribiriCustomColorId = (id: number): boolean =>
    Number.isInteger(id) &&
    id >= BIRIBIRI_CUSTOM_COLOR_BASE &&
    id <= BIRIBIRI_CUSTOM_COLOR_MAX;

export const EncodeBiribiriCustomColor = (rgb: number): number =>
    BIRIBIRI_CUSTOM_COLOR_BASE + (rgb & 0xFFFFFF);

export const DecodeBiribiriCustomColor = (id: number): number =>
    IsBiribiriCustomColorId(id)
        ? ((id - BIRIBIRI_CUSTOM_COLOR_BASE) & 0xFFFFFF)
        : -1;

export const NormalizeBiribiriHex = (value: string): string | null =>
{
    if(!value) return null;

    let hex = value.trim().replace(/^#/, '');

    if(/^[0-9a-fA-F]{3}$/.test(hex))
    {
        hex = hex
            .split('')
            .map(character => character + character)
            .join('');
    }

    if(!/^[0-9a-fA-F]{6}$/.test(hex)) return null;

    return `#${ hex.toUpperCase() }`;
};

export const BiribiriHexToRgbInt = (hex: string): number =>
{
    const normalized = NormalizeBiribiriHex(hex);

    if(!normalized) return -1;

    return parseInt(normalized.slice(1), 16);
};

export const BiribiriRgbIntToHex = (rgb: number): string =>
    `#${ (rgb & 0xFFFFFF).toString(16).padStart(6, '0').toUpperCase() }`;
