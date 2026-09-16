// BIRIBIRI_EXTENDED_CLOTHING_ARCH_V1_2
//
// Slot logico != capa fisica.
//
// type/group:
//   controlan armario, editor, random y futuros locks.
//
// renderFamily/defaultLegacyTemplate:
//   preparan el contrato del futuro importer / Clothing Studio.
//
// Nitro sigue dibujando segun los PART TYPES fisicos incluidos en el
// figuredata de cada prenda. Por ejemplo, un set logico "pe" puede
// contener parts fisicos de tipo "cc"/"lc"/"rc" si necesita comportarse
// visualmente como una chaqueta sobre la espalda.

export type ClothingEditorGroup =
    'generic' |
    'head' |
    'torso' |
    'legs' |
    'extras';

export type ClothingRenderFamily =
    'native' |
    'hair-front' |
    'head-overlay' |
    'face-overlay' |
    'body-overlay' |
    'hand-item' |
    'back-overlay' |
    'lower-back-overlay' |
    'custom';

export interface ClothingCategoryDefinition
{
    type: string;
    label: string;
    group: ClothingEditorGroup;
    nativeEditorIcon: boolean;
    randomizable: boolean;
    renderFamily: ClothingRenderFamily;
    defaultLegacyTemplate: string | null;
    reserved?: boolean;
}

export const CLOTHING_CATEGORY_DEFINITIONS: ClothingCategoryDefinition[] = [
    // Generic
    { type: 'hd', label: 'Cara', group: 'generic', nativeEditorIcon: true, randomizable: true, renderFamily: 'native', defaultLegacyTemplate: 'hd' },

    // Head
    { type: 'hr', label: 'Pelo', group: 'head', nativeEditorIcon: true, randomizable: true, renderFamily: 'native', defaultLegacyTemplate: 'hr' },
    { type: 'bn', label: 'Flequillo', group: 'head', nativeEditorIcon: false, randomizable: true, renderFamily: 'hair-front', defaultLegacyTemplate: 'hr' },
    { type: 'ha', label: 'Sombrero', group: 'head', nativeEditorIcon: true, randomizable: true, renderFamily: 'native', defaultLegacyTemplate: 'ha' },
    { type: 'he', label: 'Accesorio de cabeza', group: 'head', nativeEditorIcon: true, randomizable: true, renderFamily: 'native', defaultLegacyTemplate: 'he' },
    { type: 'ea', label: 'Accesorio de ojos', group: 'head', nativeEditorIcon: true, randomizable: true, renderFamily: 'native', defaultLegacyTemplate: 'ea' },
    { type: 'fa', label: 'Accesorio facial', group: 'head', nativeEditorIcon: true, randomizable: true, renderFamily: 'native', defaultLegacyTemplate: 'fa' },
    { type: 'er', label: 'Pendientes', group: 'head', nativeEditorIcon: false, randomizable: true, renderFamily: 'head-overlay', defaultLegacyTemplate: 'he' },
    { type: 'mu', label: 'Maquillaje', group: 'head', nativeEditorIcon: false, randomizable: true, renderFamily: 'face-overlay', defaultLegacyTemplate: 'fa' },
    { type: 'be', label: 'Barba', group: 'head', nativeEditorIcon: false, randomizable: true, renderFamily: 'face-overlay', defaultLegacyTemplate: 'fa' },

    // Torso / upper body / carried items
    { type: 'ch', label: 'Camiseta', group: 'torso', nativeEditorIcon: true, randomizable: true, renderFamily: 'native', defaultLegacyTemplate: 'ch' },
    { type: 'cp', label: 'Estampado', group: 'torso', nativeEditorIcon: true, randomizable: true, renderFamily: 'native', defaultLegacyTemplate: 'cp' },
    { type: 'cc', label: 'Chaqueta', group: 'torso', nativeEditorIcon: true, randomizable: true, renderFamily: 'native', defaultLegacyTemplate: 'cc' },
    { type: 'ca', label: 'Accesorio de torso', group: 'torso', nativeEditorIcon: true, randomizable: true, renderFamily: 'native', defaultLegacyTemplate: 'ca' },

    { type: 'nk', label: 'Collar', group: 'torso', nativeEditorIcon: false, randomizable: true, renderFamily: 'body-overlay', defaultLegacyTemplate: 'ca' },
    { type: 'gl', label: 'Guantes', group: 'torso', nativeEditorIcon: false, randomizable: true, renderFamily: 'custom', defaultLegacyTemplate: null },
    { type: 'wr', label: 'Mu\u00f1equera', group: 'torso', nativeEditorIcon: false, randomizable: true, renderFamily: 'custom', defaultLegacyTemplate: null },
    { type: 'ba', label: 'Bolso / objeto de mano', group: 'torso', nativeEditorIcon: false, randomizable: true, renderFamily: 'hand-item', defaultLegacyTemplate: null },
    { type: 'bp', label: 'Mochila', group: 'torso', nativeEditorIcon: false, randomizable: true, renderFamily: 'back-overlay', defaultLegacyTemplate: 'cc' },
    // Extras: grupo superior independiente. Por ahora solo PET.
    { type: 'pe', label: 'Mascota', group: 'extras', nativeEditorIcon: false, randomizable: true, renderFamily: 'custom', defaultLegacyTemplate: 'cc' },
    { type: 'ce', label: 'Capa', group: 'torso', nativeEditorIcon: false, randomizable: true, renderFamily: 'back-overlay', defaultLegacyTemplate: 'cc' },

    // Reservado: solo se mostrara cuando exista setType "wi" real.
    { type: 'wi', label: 'Alas', group: 'torso', nativeEditorIcon: false, randomizable: true, renderFamily: 'back-overlay', defaultLegacyTemplate: 'cc', reserved: true },

    // Legs / lower body
    { type: 'lg', label: 'Pantal\u00f3n', group: 'legs', nativeEditorIcon: true, randomizable: true, renderFamily: 'native', defaultLegacyTemplate: 'lg' },
    { type: 'sh', label: 'Zapatos', group: 'legs', nativeEditorIcon: true, randomizable: true, renderFamily: 'native', defaultLegacyTemplate: 'sh' },
    { type: 'wa', label: 'Accesorio de cintura', group: 'legs', nativeEditorIcon: true, randomizable: true, renderFamily: 'native', defaultLegacyTemplate: 'wa' },
    { type: 'tl', label: 'Cola', group: 'legs', nativeEditorIcon: false, randomizable: true, renderFamily: 'lower-back-overlay', defaultLegacyTemplate: 'wa' }
];

export const CLOTHING_CATEGORY_TYPES: string[] =
    CLOTHING_CATEGORY_DEFINITIONS.map(definition => definition.type);

const CLOTHING_CATEGORY_MAP =
    new Map<string, ClothingCategoryDefinition>(
        CLOTHING_CATEGORY_DEFINITIONS.map(
            definition => [ definition.type, definition ]
        )
    );

export function IsClothingCategoryType(type: string): boolean
{
    return CLOTHING_CATEGORY_MAP.has(type);
}

export function GetClothingCategoryDefinition(type: string): ClothingCategoryDefinition
{
    return CLOTHING_CATEGORY_MAP.get(type) || null;
}

export function GetClothingCategoryTypesByGroup(group: ClothingEditorGroup): string[]
{
    return CLOTHING_CATEGORY_DEFINITIONS
        .filter(definition => definition.group === group)
        .map(definition => definition.type);
}
