import { Dispatch, FC, SetStateAction, useCallback, useEffect, useRef, useState } from 'react';
import { CategoryData, FigureData, GetClothingCategoryDefinition, IAvatarEditorCategoryModel, LocalizeText } from '../../../api';
import { Column, Flex, Grid, Text } from '../../../common';
import { AvatarEditorIcon } from './AvatarEditorIcon';
import { AvatarEditorFigureSetView } from './figure-set/AvatarEditorFigureSetView';
import { AvatarEditorPaletteSetView } from './palette-set/AvatarEditorPaletteSetView';

const CATEGORY_FOOTBALL_GATE = [ 'ch', 'cp', 'lg', 'sh' ];

export interface AvatarEditorModelViewProps
{
    model: IAvatarEditorCategoryModel;
    gender: string;
    isFromFootballGate?: boolean;
    setGender: Dispatch<SetStateAction<string>>;
    isFromFootballGate?: boolean;
}

export const AvatarEditorModelView: FC<AvatarEditorModelViewProps> = props =>
{
    const {
        model = null,
        gender = null,
        isFromFootballGate = false,
        setGender = null
    } = props;
    const [ activeCategory, setActiveCategory ] = useState<CategoryData>(null);
    // BIRIBIRI_WARDROBE_P4_1_UX_HOTFIX
    // Conserva Hair/Hat/etc. al reconstruir el modelo tras Random.
    const activeCategoryNameRef = useRef<string>(null);
    const [ maxPaletteCount, setMaxPaletteCount ] = useState(1);

    const selectCategory = useCallback((name: string) =>
    {
        const category = model.categories.get(name);

        if(!category) return;

        activeCategoryNameRef.current = name;
        setActiveCategory(category);

        category.init();

        for(const part of category.parts)
        {
            if(!part || !part.isSelected) continue;

            setMaxPaletteCount(part.maxColorIndex || 1);

            break;
        }
    }, [ model ]);

    useEffect(() =>
    {
        model.init();

        const preferred =
            activeCategoryNameRef.current;

        if(
            preferred &&
            model.categories.has(preferred)
        )
        {
            selectCategory(preferred);
            return;
        }

        for(const name of model.categories.keys())
        {
            selectCategory(name);
            break;
        }
    }, [ model, selectCategory ]);

    if(!model || !activeCategory) return null;

    return (
        <Grid>
            <Column className="choose-clothing overflow-y-auto overflow-x-hidden">
                <Flex className="px-3 biribiri-avatar-category-strip" gap={ 4 }>
                    { model.canSetGender &&
                    <>
                        <Flex center pointer className="category-item" gap={ 3 } onClick={ event => setGender(FigureData.MALE) }>
                            <AvatarEditorIcon icon="male" selected={ (gender === FigureData.MALE) } />
                            <Text bold>{ LocalizeText('avatareditor.generic.boy') }</Text>
                        </Flex>
                        <Flex center pointer className="category-item" gap={ 3 } onClick={ event => setGender(FigureData.FEMALE) }>
                            <AvatarEditorIcon icon="female" selected={ (gender === FigureData.FEMALE) } />
                            <Text bold>{ LocalizeText('avatareditor.generic.girl') }</Text>
                        </Flex>
                    </> }
                    { !model.canSetGender && model.categories && (model.categories.size > 0) && Array.from(model.categories.keys()).map(name =>
                    {
                        const category = model.categories.get(name);

                        if(!category) return null;
                        if(isFromFootballGate && !CATEGORY_FOOTBALL_GATE.includes(category.name)) return null;

                        const definition = GetClothingCategoryDefinition(category.name);
                        const useFallbackIcon = !!definition && !definition.nativeEditorIcon;

                        return (
                            <div key={ name }>
                                <Flex center pointer className="category-item" onClick={ event => selectCategory(name) }>
                                    <AvatarEditorIcon
                                        icon={ category.name }
                                        selected={ (activeCategory === category) }
                                        classNames={ useFallbackIcon ? [ 'biribiri-category-fallback' ] : [] }
                                        title={ definition?.label || category.name }>
                                        { useFallbackIcon &&
                                            <span className="biribiri-category-code">
                                                { definition?.label?.charAt(0).toUpperCase() || '?' }
                                            </span> }
                                    </AvatarEditorIcon>
                                </Flex>

</div>
                        );
                    }) }
                </Flex>
                <Column className="avatar-parts-container" size={ 5 } overflow="hidden">
                    <AvatarEditorFigureSetView model={ model } category={ activeCategory } isFromFootballGate={ isFromFootballGate } setMaxPaletteCount={ setMaxPaletteCount } />
                </Column>
                <Column overflow="hidden" className={
                    maxPaletteCount === 2 ? 'avatar-color-palette-container dual-palette' : 'avatar-color-palette-container'
                }>
                    { (maxPaletteCount >= 1) &&
                    <AvatarEditorPaletteSetView model={ model } category={ activeCategory } paletteSet={ activeCategory.getPalette(0) } paletteIndex={ 0 } /> }
                    { (maxPaletteCount === 2) &&
                    <AvatarEditorPaletteSetView model={ model } category={ activeCategory } paletteSet={ activeCategory.getPalette(1) } paletteIndex={ 1 } /> }
                </Column>
            </Column>
        </Grid>
    );
}
