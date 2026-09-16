import { AvatarFigureContainer, IFigurePartSet, IPalette, IPartColor, SetType } from '@nitrots/nitro-renderer';
import { GetAvatarRenderManager } from '../nitro';
import { Randomizer } from '../utils';
import { CLOTHING_CATEGORY_DEFINITIONS } from './ClothingCategoryRegistry';
import { FigureData } from './FigureData';

function getTotalColors(partSet: IFigurePartSet): number
{
    const parts = partSet.parts;

    let totalColors = 0;

    for(const part of parts) totalColors = Math.max(totalColors, part.colorLayerIndex);

    return totalColors;
}

// BIRIBIRI_WARDROBE_P4_CONTROLLED_RANDOM_V2
function getRandomSetTypes(
    requiredSets: string[],
    options: string[],
    excludedSets: string[] = []
): string[]
{
    const excluded = new Set<string>(excludedSets);

    const required = requiredSets.filter(
        option =>
            options.indexOf(option) !== -1 &&
            !excluded.has(option)
    );

    const optional = options.filter(
        option =>
            requiredSets.indexOf(option) === -1 &&
            !excluded.has(option)
    );

    if(!optional.length) return required;

    return [
        ...required,
        ...Randomizer.getRandomElements(
            optional,
            Randomizer.getRandomNumber(optional.length) + 1
        )
    ];
}

function getRandomPartSet(
    setType: SetType,
    gender: string,
    _clubLevel: number = 0,
    figureSetIds: number[] = []
): IFigurePartSet
{
    if(!setType) return null;

    const options = setType.partSets.getValues().filter(option =>
    {
        if(
            !option.isSelectable ||
            ((option.gender !== 'U') && (option.gender !== gender)) ||
            (option.isSellable && (figureSetIds.indexOf(option.id) === -1))
        ) return null;

        return option;
    });

    if(!options || !options.length) return null;

    return Randomizer.getRandomElement(options);
}

function getRandomColors(
    palette: IPalette,
    partSet: IFigurePartSet,
    _clubLevel: number = 0
): IPartColor[]
{
    if(!palette) return [];

    const options = palette.colors.getValues().filter(option =>
    {
        if(!option.isSelectable) return null;

        return option;
    });

    if(!options || !options.length) return [];

    const totalColors = getTotalColors(partSet);

    if(totalColors <= 0) return [];

    if(totalColors <= options.length)
    {
        return Randomizer.getRandomElements(
            options,
            totalColors
        );
    }

    const result =
        Randomizer.getRandomElements(
            options,
            options.length
        );

    while(result.length < totalColors)
    {
        result.push(
            Randomizer.getRandomElement(options)
        );
    }

    return result;
}

export function generateRandomFigure(
    figureData: FigureData,
    gender: string,
    _clubLevel: number = 0,
    figureSetIds: number[] = [],
    lockedSets: string[] = []
): string
{
    const structure = GetAvatarRenderManager().structure;
    const figureContainer = new AvatarFigureContainer('');

    const availableSetTypes =
        CLOTHING_CATEGORY_DEFINITIONS
            .filter(
                definition =>
                    definition.randomizable &&
                    !!structure.figureData.getSetType(
                        definition.type
                    )
            )
            .map(definition => definition.type);

    const mandatorySets =
        structure
            .getMandatorySetTypeIds(
                gender,
                Number.MAX_SAFE_INTEGER
            )
            .filter(
                type =>
                    availableSetTypes.indexOf(type) !== -1
            );

    const validSetTypes =
        new Set<string>(availableSetTypes);

    const requestedLocks =
        Array.from(
            new Set<string>(
                lockedSets.filter(
                    setType =>
                        validSetTypes.has(setType)
                )
            )
        );

    const excludedSets: string[] = [];

    for(const setType of requestedLocks)
    {
        const partSetId =
            figureData.getPartSetId(setType);

        if(
            Number.isFinite(partSetId) &&
            partSetId >= 0
        )
        {
            figureContainer.updatePart(
                setType,
                partSetId,
                figureData.getColorIds(setType)
            );

            excludedSets.push(setType);
            continue;
        }

        // Lock de una categoria opcional actualmente vacia:
        // sigue vacia. Si fuese obligatoria y faltase, se regenera.
        if(mandatorySets.indexOf(setType) === -1)
        {
            excludedSets.push(setType);
        }
    }

    const randomSetTypes =
        getRandomSetTypes(
            mandatorySets,
            availableSetTypes,
            excludedSets
        );

    for(const type of randomSetTypes)
    {
        if(figureContainer.hasPartType(type)) continue;

        const setType =
            structure.figureData.getSetType(type) as SetType;

        const selectedSet =
            getRandomPartSet(
                setType,
                gender,
                0,
                figureSetIds
            );

        if(!selectedSet) continue;

        let selectedColors: number[] = [];

        if(selectedSet.isColorable)
        {
            selectedColors =
                getRandomColors(
                    structure.figureData.getPalette(
                        setType.paletteID
                    ),
                    selectedSet,
                    0
                ).map(color => color.id);
        }

        figureContainer.updatePart(
            setType.type,
            selectedSet.id,
            selectedColors
        );
    }

    return figureContainer.getFigureString();
}
