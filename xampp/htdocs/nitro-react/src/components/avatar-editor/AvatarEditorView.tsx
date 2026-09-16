// BIRIBIRI_WARDROBE_V4_1_NAMED_OUTFITS
// BIRIBIRI_WARDROBE_V1_SERVER_SLOTS
import { AvatarEditorFigureCategory, AvatarRenderEvent, BiribiriWardrobeStateEvent, BiribiriWardrobeStateRequestComposer, FigureSetIdsMessageEvent, GetWardrobeMessageComposer, IAvatarFigureContainer, ILinkEventTracker, SetClothingChangeDataMessageComposer, UserFigureComposer, UserWardrobePageEvent, BiribiriWardrobeNamesEvent, BiribiriWardrobeNamesRequestComposer } from '@nitrots/nitro-renderer';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FaDice, FaLock, FaLockOpen, FaTimes, FaTrash, FaUndo, FaUsers } from 'react-icons/fa';
import { AddEventLinkTracker, AvatarEditorAction, AvatarEditorUtilities, BodyModel, ExtrasModel, FigureData, GetAvatarRenderManager, GetAvatarSetType, CLOTHING_CATEGORY_DEFINITIONS, GetClothingCategoryDefinition, GetClothingCategoryTypesByGroup, GetConfiguration, GetSessionDataManager, HeadModel, IAvatarEditorCategoryModel, LegModel, LocalizeText, RemoveLinkEventTracker, SendMessageComposer, SetLocalStorage, TorsoModel, generateRandomFigure, CreateLinkEvent } from '../../api';
import { Button, ButtonGroup, Column, Flex, Grid, NitroCardContentView, NitroCardHeaderView, NitroCardTabsItemView, NitroCardTabsView, NitroCardView } from '../../common';
import { useAvatarEvent, useMessageEvent } from '../../hooks';
import { AvatarEditorFigurePreviewView } from './views/AvatarEditorFigurePreviewView';
import { AvatarEditorModelView } from './views/AvatarEditorModelView';
import { AvatarEditorWardrobeView } from './views/AvatarEditorWardrobeView';

const DEFAULT_MALE_FIGURE: string = 'hr-100.hd-180-7.ch-215-66.lg-270-79.sh-305-62.ha-1002-70.wa-2007';
const DEFAULT_FEMALE_FIGURE: string = 'hr-515-33.hd-600-1.ch-635-70.lg-716-66-62.sh-735-68';

// BIRIBIRI_WARDROBE_P5_ADVANCED_PREVIEW
const RANDOM_CATEGORY_GROUP_ORDER: Record<string, number> =
{
    generic: 0,
    head: 1,
    torso: 2,
    legs: 3,
    extras: 4
};

// BIRIBIRI_WARDROBE_P4_2_RANDOM_POPOVER_ES
// BIRIBIRI_WARDROBE_P4_3_RANDOM_UX_ES
const AVATAR_EDITOR_GROUP_LABELS: Record<string, string> =
{
    hd: 'Avatar',
    generic: 'Avatar',
    head: 'Cabeza',
    torso: 'Torso',
    legs: 'Piernas',
    extras: 'Extras'
};

export const AvatarEditorView: FC<{}> = props =>
{
    const [ isVisible, setIsVisible ] = useState(false);
    const [ figures, setFigures ] = useState<Map<string, FigureData>>(null);
    const [ figureData, setFigureData ] = useState<FigureData>(null);
    const [ categories, setCategories ] = useState<Map<string, IAvatarEditorCategoryModel>>(null);
    const [ activeCategory, setActiveCategory ] = useState<IAvatarEditorCategoryModel>(null);
    // BIRIBIRI_WARDROBE_P4_1_UX_HOTFIX
    // Conserva la pestana superior al reconstruir los modelos tras Random.
    const activeCategoryNameRef = useRef<string>(null);
    const [ figureSetIds, setFigureSetIds ] = useState<number[]>([]);
    // BIRIBIRI_WARDROBE_P4_CONTROLLED_RANDOM_V2
    // La cara conserva el comportamiento historico: empieza bloqueada.
    const [ lockedFigureTypes, setLockedFigureTypes ] =
        useState<Set<string>>(
            () => new Set<string>([ FigureData.FACE ])
        );
    const [ isRandomMenuVisible, setIsRandomMenuVisible ] =
        useState(false);

    const [ boundFurnitureNames, setBoundFurnitureNames ] = useState<string[]>([]);
    const [ savedFigures, setSavedFigures ] = useState<[ IAvatarFigureContainer, string ][]>([]);
    const [ isWardrobeVisible, setIsWardrobeVisible ] = useState(false);
    const [ lastFigure, setLastFigure ] = useState<string>(null);
    const [ lastGender, setLastGender ] = useState<string>(null);
    const [ needsReset, setNeedsReset ] = useState(true);
    const [ isInitalized, setIsInitalized ] = useState(false);
    const [ genderFootballGate, setGenderFootballGate ] = useState<string>(null);
    const [ objectFootballGate, setObjectFootballGate ] = useState<number>(null);
    
    const DEFAULT_MALE_FOOTBALL_GATE = JSON.parse(window.localStorage.getItem('nitro.look.footballgate.M')) || 'ch-3109-92-1408.lg-3116-82-1408.sh-3115-1408-1408';
    const DEFAULT_FEMALE_FOOTBALL_GATE = JSON.parse(window.localStorage.getItem('nitro.look.footballgate.F')) || 'ch-3112-1408-1408.lg-3116-71-1408.sh-3115-1408-1408';
    const [ wardrobeBaseSlots, setWardrobeBaseSlots ] = useState(10);
    const [ wardrobeHcSlots, setWardrobeHcSlots ] = useState(10);
    const [ wardrobeHcActive, setWardrobeHcActive ] = useState(false);
    const [ wardrobePurchasedSlots, setWardrobePurchasedSlots ] = useState(0);
    const [ wardrobeOutfitNames, setWardrobeOutfitNames ] = useState<Record<number, string>>({});

    const wardrobeDisplaySlots =
        wardrobeBaseSlots +
        wardrobeHcSlots +
        wardrobePurchasedSlots;
	
    const onClose = () =>
    {
        setGenderFootballGate(null);
        setObjectFootballGate(null);
        setIsVisible(false);
    }

    useMessageEvent<FigureSetIdsMessageEvent>(FigureSetIdsMessageEvent, event =>
    {
        const parser = event.getParser();

        setFigureSetIds(parser.figureSetIds);
        setBoundFurnitureNames(parser.boundsFurnitureNames);
    });

    useMessageEvent<BiribiriWardrobeNamesEvent>(BiribiriWardrobeNamesEvent, event =>
    {
        const parser = event.getParser();
        const nextNames: Record<number, string> = {};

        for(
            const [ slotId, name ]
            of parser.names.entries()
        )
        {
            if(slotId > 0 && name)
            {
                nextNames[slotId] = name;
            }
        }

        setWardrobeOutfitNames(
            nextNames
        );
    });

    useMessageEvent<BiribiriWardrobeStateEvent>(BiribiriWardrobeStateEvent, event =>
    {
        const parser = event.getParser();

        setWardrobeBaseSlots(Math.max(10, parser.baseSlots));
        setWardrobeHcSlots(Math.max(0, parser.hcSlots));
        setWardrobeHcActive(parser.hcActive);
        setWardrobePurchasedSlots(Math.max(0, parser.purchasedSlots));

        const targetLength = Math.max(10, parser.displaySlots);

        setSavedFigures(previous =>
        {
            const current = previous || [];

            return Array.from(
                { length: targetLength },
                (_, index) => current[index] || [ null, null ]
            );
        });
    });

    useMessageEvent<UserWardrobePageEvent>(UserWardrobePageEvent, event =>
    {
        const parser = event.getParser();
        const savedFigures: [ IAvatarFigureContainer, string ][] = [];

        let i = 0;

        while(i < Math.max(10, wardrobeDisplaySlots))
        {
            savedFigures.push([ null, null ]);

            i++;
        }
  
        for(let [ index, [ look, gender ] ] of parser.looks.entries())
        {
            const container = GetAvatarRenderManager().createFigureContainer(look);

            savedFigures[(index - 1)] = [ container, gender ];
        }

        setSavedFigures(savedFigures);
    });

    const selectCategory = useCallback((name: string) =>
    {
        if(!categories) return;

        const nextCategory =
            categories.get(name);

        if(!nextCategory) return;

        activeCategoryNameRef.current = name;

        setActiveCategory(previous =>
        {
            if(
                previous instanceof BodyModel &&
                previous !== nextCategory
            )
            {
                previous.cancelPendingFaceThumbnails();
            }

            return nextCategory;
        });
    }, [ categories ]);

    const randomizableClothingCategories =
        useMemo(
            () =>
                CLOTHING_CATEGORY_DEFINITIONS
                    .filter(
                        definition =>
                            definition.randomizable &&
                            !!GetAvatarSetType(
                                definition.type
                            )
                    )
                    .sort(
                        (a, b) =>
                            (
                                RANDOM_CATEGORY_GROUP_ORDER[
                                    a.group
                                ] ?? 99
                            ) -
                            (
                                RANDOM_CATEGORY_GROUP_ORDER[
                                    b.group
                                ] ?? 99
                            )
                    ),
            [ categories ]
        );

    const toggleFigureTypeLock =
        useCallback(
            (figureType: string) =>
            {
                const definition =
                    GetClothingCategoryDefinition(
                        figureType
                    );

                if(
                    !definition ||
                    !definition.randomizable
                ) return;

                setLockedFigureTypes(previous =>
                {
                    const next =
                        new Set<string>(previous);

                    if(next.has(figureType))
                    {
                        next.delete(figureType);
                    }
                    else
                    {
                        next.add(figureType);
                    }

                    return next;
                });
            },
            []
        );

    const resetCategories = useCallback(() =>
    {
        const categories = new Map();

        if (!genderFootballGate)
        {
            categories.set(AvatarEditorFigureCategory.GENERIC, new BodyModel());
            categories.set(AvatarEditorFigureCategory.HEAD, new HeadModel());
            categories.set(AvatarEditorFigureCategory.TORSO, new TorsoModel());
            categories.set(AvatarEditorFigureCategory.LEGS, new LegModel());

            const hasExtras =
                GetClothingCategoryTypesByGroup('extras')
                    .some(type => !!GetAvatarSetType(type));

            if(hasExtras)
            {
                categories.set('extras', new ExtrasModel());
            }
        }
        else
        {
            categories.set(AvatarEditorFigureCategory.TORSO, new TorsoModel());
            categories.set(AvatarEditorFigureCategory.LEGS, new LegModel());
        }

        setCategories(categories);
    }, [ genderFootballGate ]);

    // BIRIBIRI_EXTRAS_AVATAR_READY_V1
    const onAvatarRenderReady = useCallback(() =>
    {
        resetCategories();
    }, [ resetCategories ]);

    useAvatarEvent(
        AvatarRenderEvent.AVATAR_RENDER_READY,
        onAvatarRenderReady
    );

    const setupFigures = useCallback(() =>
    {
        const figures: Map<string, FigureData> = new Map();

        const maleFigure = new FigureData();
        const femaleFigure = new FigureData();

        maleFigure.loadAvatarData(DEFAULT_MALE_FIGURE, FigureData.MALE);
        femaleFigure.loadAvatarData(DEFAULT_FEMALE_FIGURE, FigureData.FEMALE);

        figures.set(FigureData.MALE, maleFigure);
        figures.set(FigureData.FEMALE, femaleFigure);

        setFigures(figures);
        setFigureData(figures.get(FigureData.MALE));
    }, []);

    const loadAvatarInEditor = useCallback((figure: string, gender: string, reset: boolean = true) =>
    {
        gender = AvatarEditorUtilities.getGender(gender);

        let newFigureData = figureData;

        if(gender !== newFigureData.gender) newFigureData = figures.get(gender);

        if(figure !== newFigureData.getFigureString()) newFigureData.loadAvatarData(figure, gender);

        if(newFigureData !== figureData) setFigureData(newFigureData);

        if(reset)
        {
            setLastFigure(figureData.getFigureString());
            setLastGender(figureData.gender);
        }
    }, [ figures, figureData ]);

    const processAction = useCallback((action: string) =>
    {
        switch(action)
        {
            case AvatarEditorAction.ACTION_CLEAR:
                loadAvatarInEditor(figureData.getFigureStringWithFace(0, false), figureData.gender, false);
                resetCategories();
                return;
            case AvatarEditorAction.ACTION_RESET:
                loadAvatarInEditor(lastFigure, lastGender);
                resetCategories();
                return;
            case AvatarEditorAction.ACTION_RANDOMIZE:
                const figure = generateRandomFigure(
                    figureData,
                    figureData.gender,
                    0,
                    figureSetIds,
                    Array.from(lockedFigureTypes)
                );

                loadAvatarInEditor(
                    figure,
                    figureData.gender,
                    false
                );
                resetCategories();
                return;
            case AvatarEditorAction.ACTION_SAVE:
                !genderFootballGate ? SendMessageComposer(new UserFigureComposer(figureData.gender, figureData.getFigureString())) : SendMessageComposer(new SetClothingChangeDataMessageComposer(objectFootballGate, genderFootballGate, figureData.getFigureString()));
                SetLocalStorage(`nitro.look.footballgate.${ genderFootballGate }`, figureData.getFigureString());
                onClose();
                return;
        }
    }, [ loadAvatarInEditor, figureData, resetCategories, lastFigure, lastGender, figureSetIds, lockedFigureTypes, genderFootballGate, objectFootballGate ])

    const setGender = useCallback((gender: string) =>
    {
        gender = AvatarEditorUtilities.getGender(gender);

        setFigureData(figures.get(gender));
    }, [ figures ]);

    useEffect(() =>
    {
        const linkTracker: ILinkEventTracker = {
            linkReceived: (url: string) =>
            {
                const parts = url.split('/');
	
                setGenderFootballGate(parts[2] ? parts[2] : null);
                setObjectFootballGate(parts[3] ? Number(parts[3]) : null);

                if(parts.length < 2) return;

                switch(parts[1])
                {
                    case 'show':
                        setIsVisible(true);
                        return;
                    case 'community-preview':
                        // BIRIBIRI_WARDROBE_COMMUNITY_C2_2_PREVIEW
                        setGenderFootballGate(null);
                        setObjectFootballGate(null);
                        setNeedsReset(true);
                        setIsVisible(true);
                        return;
                    case 'hide':
                        setIsVisible(false);
                        return;
                    case 'toggle':
                        setIsVisible(prevValue => !prevValue);
                        return;
                }
            },
            eventUrlPrefix: 'avatar-editor/'
        };

        AddEventLinkTracker(linkTracker);

        return () => RemoveLinkEventTracker(linkTracker);
    }, []);

    useEffect(() =>
    {
        setSavedFigures(previous =>
        {
            const current = previous || [];

            return Array.from(
                { length: Math.max(10, wardrobeDisplaySlots) },
                (_, index) => current[index] || [ null, null ]
            );
        });
    }, [ wardrobeDisplaySlots ]);

    useEffect(() =>
    {
        SendMessageComposer(new GetWardrobeMessageComposer());
        SendMessageComposer(new BiribiriWardrobeStateRequestComposer());
        SendMessageComposer(new BiribiriWardrobeNamesRequestComposer());
    }, []);

    useEffect(() =>
    {
        if(!categories) return;

        const preferred =
            activeCategoryNameRef.current;

        if(
            preferred &&
            categories.has(preferred)
        )
        {
            selectCategory(preferred);
            return;
        }

        selectCategory(
            !genderFootballGate
                ? AvatarEditorFigureCategory.GENERIC
                : AvatarEditorFigureCategory.TORSO
        );
    }, [ categories, genderFootballGate, selectCategory ]);

    useEffect(() =>
    {
        if(!figureData) return;

        AvatarEditorUtilities.CURRENT_FIGURE = figureData;

        resetCategories();

        return () => AvatarEditorUtilities.CURRENT_FIGURE = null;
    }, [ figureData, resetCategories ]);

    useEffect(() =>
    {
        AvatarEditorUtilities.FIGURE_SET_IDS = figureSetIds;
        AvatarEditorUtilities.BOUND_FURNITURE_NAMES = boundFurnitureNames;

        resetCategories();

        return () =>
        {
            AvatarEditorUtilities.FIGURE_SET_IDS = null;
            AvatarEditorUtilities.BOUND_FURNITURE_NAMES = null;
        }
    }, [ figureSetIds, boundFurnitureNames, resetCategories ]);

    useEffect(() =>
    {
        if(!isVisible) return;

        if(!figures)
        {
            setupFigures();

            setIsInitalized(true);

            return;
        }
    }, [ isVisible, figures, setupFigures ]);

    useEffect(() =>
    {
        if(!isVisible || !isInitalized || !needsReset) return;

        const communityPreviewRaw = window.sessionStorage.getItem('biribiri.community.preview');
        let communityPreviewApplied = false;

        if(communityPreviewRaw && !genderFootballGate)
        {
            try
            {
                const communityPreview = JSON.parse(communityPreviewRaw);

                if(communityPreview?.figure && communityPreview?.gender)
                {
                    setLastFigure(GetSessionDataManager().figure);
                    setLastGender(GetSessionDataManager().gender);
                    loadAvatarInEditor(
                        String(communityPreview.figure),
                        String(communityPreview.gender),
                        false
                    );
                    communityPreviewApplied = true;
                }
            }
            catch(error)
            {
                communityPreviewApplied = false;
            }

            window.sessionStorage.removeItem('biribiri.community.preview');
        }

        if(!communityPreviewApplied && !genderFootballGate)
        {
            loadAvatarInEditor(
                GetSessionDataManager().figure,
                GetSessionDataManager().gender
            );
        }

        if(!communityPreviewApplied && genderFootballGate)
        {
            loadAvatarInEditor(
                genderFootballGate === FigureData.MALE
                    ? DEFAULT_MALE_FOOTBALL_GATE
                    : DEFAULT_FEMALE_FOOTBALL_GATE,
                genderFootballGate
            );
        }
        setNeedsReset(false);
    }, [ isVisible, isInitalized, needsReset, loadAvatarInEditor, genderFootballGate, DEFAULT_MALE_FOOTBALL_GATE, DEFAULT_FEMALE_FOOTBALL_GATE ]);

    useEffect(() => // This is so when you have the look editor open and you change the mode to Boy or Girl
    {
        if(!isVisible) return;

        return () =>
        {
            setupFigures();
            setIsWardrobeVisible(false);
            setNeedsReset(true);
        }
    }, [ isVisible, genderFootballGate, setupFigures ]);

    useEffect(() =>
    {
        if(isVisible) return;

        // Los locks son locales/efimeros: al cerrar vuelve solo Cara.
        setLockedFigureTypes(
            new Set<string>([ FigureData.FACE ])
        );
        setIsRandomMenuVisible(false);

        return () =>
        {
            setNeedsReset(true);
        }
    }, [ isVisible ]);

    if(!isVisible || !figureData) return null;

    const isAuxiliaryPanelVisible =
        (isWardrobeVisible || isRandomMenuVisible);

    // BIRIBIRI_WARDROBE_P4_4_RANDOM_SIDE_PANEL
    const avatarEditorClasses =
        `nitro-avatar-editor no-resize ${
            isAuxiliaryPanelVisible
                ? 'expanded'
                : ''
        }${
            isWardrobeVisible
                ? ' wardrobe-expanded'
                : ''
        }`;

    return (
        <NitroCardView uniqueKey="avatar-editor" className={ avatarEditorClasses }>
            <NitroCardHeaderView headerText={ !genderFootballGate ? LocalizeText('avatareditor.title') : LocalizeText('widget.furni.clothingchange.editor.title') } onCloseClick={ onClose } />
            <NitroCardTabsView className="avatar-editor-tabs">
                { categories && (categories.size > 0) && Array.from(categories.keys()).map(category =>
                {
                    const isActive = (activeCategory && (activeCategory.name === category));

                    return (
                        <NitroCardTabsItemView key={ category } isActive={ isActive } onClick={ event => selectCategory(category) }>
                            <div
                                className={ `tab ${ category }` }
                                title={
                                    AVATAR_EDITOR_GROUP_LABELS[
                                        category
                                    ] || 'Categor\u00eda'
                                }></div>
                        </NitroCardTabsItemView>
                    );
                }) }
                { (!genderFootballGate) &&
                    <NitroCardTabsItemView
                        onClick={
                            () =>
                            {
                                setIsRandomMenuVisible(false);
                                setIsWardrobeVisible(
                                    previous => !previous
                                );
                            }
                        }>
                        <div
                            className="tab-wardrobe"
                            title="Vestidor"></div>
                    </NitroCardTabsItemView>
                }
                { (!genderFootballGate) &&
                    <NitroCardTabsItemView
                        classNames={ [ 'biribiri-community-category-tab' ] }
                        title="Comunidad"
                        onClick={ event => CreateLinkEvent('community-outfits/toggle') }>
                        {/* BIRIBIRI_WARDROBE_COMMUNITY_C1_4_2 */}
                        <FaUsers className="biribiri-community-people-icon" />
                    </NitroCardTabsItemView> }
            </NitroCardTabsView>
            <NitroCardContentView>
                <Grid>
                    <Column
                        size={
                            isWardrobeVisible
                                ? 5
                                : (
                                    isRandomMenuVisible
                                        ? 6
                                        : 8
                                )
                        }
                        overflow="hidden">
                        { (activeCategory) &&
                            <AvatarEditorModelView
                                model={ activeCategory }
                                gender={ figureData.gender }
                                isFromFootballGate={ !!genderFootballGate }
                                setGender={ setGender }
                            />
                        }
                    </Column>
                    <Column
                        size={
                            isWardrobeVisible
                                ? 7
                                : (
                                    isRandomMenuVisible
                                        ? 6
                                        : 4
                                )
                        }
                        overflow="hidden">
                        <Flex gap={ 2 } className="w-100 h-100">
                            <Flex column={ true } className="w-100">
                                <AvatarEditorFigurePreviewView figureData={ figureData } />
                                <Column grow gap={ 1 }>
                                    { (!genderFootballGate) &&
                                        <ButtonGroup className="action-buttons w-100">
                                            <Button
                                                variant="secondary"
                                                title="Deshacer cambios"
                                                onClick={ event => processAction(AvatarEditorAction.ACTION_RESET) }>
                                                <FaUndo className="fa-icon" />
                                            </Button>
                                            <Button
                                                variant="secondary"
                                                title="Limpiar look"
                                                onClick={ event => processAction(AvatarEditorAction.ACTION_CLEAR) }>
                                                <FaTrash className="fa-icon" />
                                            </Button>
                                            <Button
                                                variant="secondary"
                                                title="Opciones de look aleatorio"
                                                onClick={
                                                    () =>
                                                    {
                                                        setIsWardrobeVisible(false);
                                                        setIsRandomMenuVisible(
                                                            previous =>
                                                                !previous
                                                        );
                                                    }
                                                }>
                                                <FaDice className="fa-icon" />
                                            </Button>
                                        </ButtonGroup>
                                    }
                                    <Button className="w-10" variant="success" onClick={ event => processAction(AvatarEditorAction.ACTION_SAVE) }>
                                        { LocalizeText('avatareditor.save') }
                                    </Button>
                                </Column>
                            </Flex>
                            { isWardrobeVisible &&
                                <Column overflow="hidden" className="w-100">
                                    <AvatarEditorWardrobeView figureData={ figureData } savedFigures={ savedFigures } setSavedFigures={ setSavedFigures } loadAvatarInEditor={ loadAvatarInEditor } baseSlots={ wardrobeBaseSlots } hcSlots={ wardrobeHcSlots } hcActive={ wardrobeHcActive } purchasedSlots={ wardrobePurchasedSlots }
                                        outfitNames={ wardrobeOutfitNames }
                                        setOutfitNames={ setWardrobeOutfitNames } />
                                </Column>
                            }
                            { isRandomMenuVisible &&
                                <Column
                                    overflow="hidden"
                                    className="w-100 biribiri-random-side-panel">
                                    <div className="biribiri-random-popover-header">
                                        <div>
                                            <strong>Look aleatorio</strong>
                                            <span>Bloquea lo que quieras conservar.</span>
                                        </div>
                                        <button
                                            type="button"
                                            className="biribiri-random-popover-close"
                                            title="Cerrar"
                                            aria-label="Cerrar"
                                            onClick={
                                                () =>
                                                    setIsRandomMenuVisible(
                                                        false
                                                    )
                                            }>
                                            <FaTimes className="fa-icon" />
                                        </button>
                                    </div>

                                    <div className="biribiri-random-lock-grid">
                                        { randomizableClothingCategories.map(
                                            definition =>
                                            {
                                                const isLocked =
                                                    lockedFigureTypes.has(
                                                        definition.type
                                                    );

                                                return (
                                                    <button
                                                        key={
                                                            definition.type
                                                        }
                                                        type="button"
                                                        className={
                                                            `biribiri-random-lock-option${ isLocked ? ' is-locked' : '' }`
                                                        }
                                                        title={
                                                            isLocked
                                                                ? `Desbloquear ${ definition.label }`
                                                                : `Bloquear ${ definition.label }`
                                                        }
                                                        onClick={
                                                            () =>
                                                                toggleFigureTypeLock(
                                                                    definition.type
                                                                )
                                                        }>
                                                        <span className="biribiri-random-lock-state">
                                                            { isLocked
                                                                ? <FaLock className="fa-icon" />
                                                                : <FaLockOpen className="fa-icon" /> }
                                                        </span>
                                                        <span>
                                                            { definition.label }
                                                        </span>
                                                    </button>
                                                );
                                            }
                                        ) }
                                    </div>

                                    <div className="biribiri-random-popover-actions">
                                        <button
                                            type="button"
                                            className="biribiri-random-unlock-all"
                                            onClick={
                                                () =>
                                                    setLockedFigureTypes(
                                                        new Set<string>()
                                                    )
                                            }>
                                            Desbloquear todo
                                        </button>
                                        <button
                                            type="button"
                                            className="biribiri-random-run"
                                            onClick={
                                                () =>
                                                    processAction(
                                                        AvatarEditorAction.ACTION_RANDOMIZE
                                                    )
                                            }>
                                            <FaDice className="fa-icon" />
                                            <span>Randomizar</span>
                                        </button>
                                    </div>
                                </Column> }

                        </Flex>
                    </Column>
                </Grid>
            </NitroCardContentView>
        </NitroCardView>
    );
}
