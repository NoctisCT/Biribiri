// BIRIBIRI_WARDROBE_V4_2_2_PURCHASE_ACK_FIX
// BIRIBIRI_WARDROBE_V4_2_EXTRA_SLOT_PURCHASE
// BIRIBIRI_WARDROBE_V4_1_3_MATCH_WARDROBE_PREVIEW
// BIRIBIRI_WARDROBE_V4_1_2_CENTERED_AVATAR_PREVIEW
// BIRIBIRI_WARDROBE_V4_1_1_FULL_AVATAR_PREVIEW
// BIRIBIRI_WARDROBE_V2_PAGED_SECTIONS
// BIRIBIRI_WARDROBE_V4_1_NAMED_OUTFITS
import { BiribiriWardrobeNameSaveComposer, BiribiriWardrobePurchaseRequestComposer, BiribiriWardrobePurchaseResultEvent, IAvatarFigureContainer, SaveWardrobeOutfitMessageComposer } from '@nitrots/nitro-renderer';
import { Dispatch, FC, SetStateAction, useCallback, useEffect, useMemo, useState } from 'react';
import { MdEdit, MdKeyboardArrowLeft, MdKeyboardArrowRight } from 'react-icons/md';
import { CreateLinkEvent, FigureData, GetAvatarRenderManager, GetClubMemberLevel, GetConfiguration, LocalizeText, SendMessageComposer } from '../../../api';
import { Flex, LayoutAvatarImageView } from '../../../common';
import { useMessageEvent } from '../../../hooks';

type WardrobeSection = 'base' | 'hc' | 'extra';
type WardrobeDialogMode = 'save' | 'rename';

export interface AvatarEditorWardrobeViewProps
{
    figureData: FigureData;
    savedFigures: [ IAvatarFigureContainer, string ][];
    setSavedFigures: Dispatch<SetStateAction<[ IAvatarFigureContainer, string ][]>>;
    loadAvatarInEditor: (figure: string, gender: string, reset?: boolean) => void;
    baseSlots: number;
    hcSlots: number;
    hcActive: boolean;
    purchasedSlots: number;
    outfitNames: Record<number, string>;
    setOutfitNames: Dispatch<SetStateAction<Record<number, string>>>;
}

export const AvatarEditorWardrobeView: FC<AvatarEditorWardrobeViewProps> = props =>
{
    const {
        figureData = null,
        savedFigures = [],
        setSavedFigures = null,
        loadAvatarInEditor = null,
        baseSlots = 10,
        hcSlots = 10,
        hcActive = false,
        purchasedSlots = 0,
        outfitNames = {},
        setOutfitNames = null
    } = props;

    const hcDisabled =
        GetConfiguration<boolean>(
            'hc.disabled',
            false
        );

    const clientHcActive =
        hcDisabled ||
        hcActive ||
        (GetClubMemberLevel() > 0);

    const maxExtraSlots = 80;

    const getExtraSlotPrice = useCallback(
        (purchased: number): number =>
        {
            if(purchased < 10) return 25;
            if(purchased < 20) return 50;
            if(purchased < 40) return 75;
            if(purchased < 80) return 100;
            return 0;
        },
        []
    );

    const nextExtraPrice = getExtraSlotPrice(purchasedSlots);
    const nextExtraSlotIndex = baseSlots + hcSlots + purchasedSlots;

    const [ activeSection, setActiveSection ] =
        useState<WardrobeSection>('base');

    const [ extraPage, setExtraPage ] =
        useState(1);

    const [ dialogMode, setDialogMode ] =
        useState<WardrobeDialogMode>(null);

    const [ dialogSlotIndex, setDialogSlotIndex ] =
        useState<number>(-1);

    const [ dialogName, setDialogName ] =
        useState('');

    const [ purchaseDialogOpen, setPurchaseDialogOpen ] = useState(false);
    const [ purchasePending, setPurchasePending ] = useState(false);
    const [ purchaseError, setPurchaseError ] = useState('');
    const [ purchaseStartSlots, setPurchaseStartSlots ] = useState<number>(-1);

    const extraPageCount = useMemo(
        () =>
        {
            const visibleExtraSlots = Math.min(
                maxExtraSlots,
                Math.max(1, purchasedSlots + (purchasedSlots < maxExtraSlots ? 1 : 0))
            );

            return Math.max(1, Math.ceil(visibleExtraSlots / 10));
        },
        [ purchasedSlots ]
    );

    useEffect(() =>
    {
        setExtraPage(
            previous =>
                Math.min(
                    Math.max(1, previous),
                    extraPageCount
                )
        );
    }, [ extraPageCount ]);

    useMessageEvent<BiribiriWardrobePurchaseResultEvent>(BiribiriWardrobePurchaseResultEvent, event =>
    {
        const parser = event.getParser();
        setPurchasePending(false);

        if(parser.status === 0)
        {
            setPurchaseDialogOpen(false);
            setPurchaseError('');
            return;
        }

        if(parser.status === 1)
        {
            setPurchaseError(`Necesitas ${ parser.price } créditos. Tienes ${ parser.creditsRemaining }.`);
            return;
        }

        if(parser.status === 2)
        {
            setPurchaseError('Has alcanzado el máximo de 80 espacios EXTRA.');
            return;
        }

        setPurchaseError('No se pudo completar la compra. No se han descontado créditos.');
    });

    // V4.2.2: el éxito ya no depende de que 6206 llegue al React handler.
    // El canal 6201 de estado existe desde V1 y es la fuente real de slots.
    useEffect(() =>
    {
        if(
            !purchasePending ||
            purchaseStartSlots < 0
        ) return;

        if(purchasedSlots > purchaseStartSlots)
        {
            setPurchasePending(false);
            setPurchaseDialogOpen(false);
            setPurchaseError('');
            setPurchaseStartSlots(-1);
        }
    }, [
        purchasedSlots,
        purchasePending,
        purchaseStartSlots
    ]);

    useEffect(() =>
    {
        if(!purchasePending) return;

        const timeout = window.setTimeout(
            () =>
            {
                setPurchasePending(false);
                setPurchaseError(
                    'El servidor no confirmó la compra. Inténtalo de nuevo.'
                );
            },
            4000
        );

        return () =>
            window.clearTimeout(timeout);
    }, [ purchasePending ]);

    const getSlotType = useCallback(
        (index: number): WardrobeSection =>
        {
            const slotId = index + 1;

            if(slotId <= baseSlots) return 'base';

            if(slotId <= (baseSlots + hcSlots))
            {
                return 'hc';
            }

            return 'extra';
        },
        [ baseSlots, hcSlots ]
    );

    const isSlotUnlocked = useCallback(
        (index: number): boolean =>
        {
            const type = getSlotType(index);

            if(type === 'base') return true;
            if(type === 'hc') return clientHcActive;

            const firstExtraIndex =
                baseSlots + hcSlots;

            return (
                index >= firstExtraIndex &&
                index <
                    (
                        firstExtraIndex +
                        purchasedSlots
                    )
            );
        },
        [
            baseSlots,
            hcSlots,
            purchasedSlots,
            clientHcActive,
            getSlotType
        ]
    );

    const requestSlotAccess = useCallback(
        (index: number) =>
        {
            if(
                getSlotType(index) === 'hc' &&
                !clientHcActive
            )
            {
                CreateLinkEvent(
                    'habboUI/open/hccenter'
                );
            }
        },
        [
            getSlotType,
            clientHcActive
        ]
    );

    const getFallbackName = useCallback(
        (index: number) =>
            `Conjunto ${ index + 1 }`,
        []
    );

    const wearFigureAtIndex = useCallback(
        (index: number) =>
        {
            if(index < 0) return;

            if(!isSlotUnlocked(index))
            {
                requestSlotAccess(index);
                return;
            }

            if(index >= savedFigures.length) return;

            const [ figure, gender ] =
                savedFigures[index] ||
                [ null, null ];

            if(!figure) return;

            loadAvatarInEditor(
                figure.getFigureString(),
                gender
            );
        },
        [
            savedFigures,
            loadAvatarInEditor,
            isSlotUnlocked,
            requestSlotAccess
        ]
    );

    const openSaveDialog = useCallback(
        (index: number) =>
        {
            if(!figureData || index < 0) return;

            if(!isSlotUnlocked(index))
            {
                requestSlotAccess(index);
                return;
            }

            setDialogMode('save');
            setDialogSlotIndex(index);
            setDialogName(
                outfitNames[index + 1] ||
                getFallbackName(index)
            );
        },
        [
            figureData,
            outfitNames,
            isSlotUnlocked,
            requestSlotAccess,
            getFallbackName
        ]
    );

    const openRenameDialog = useCallback(
        (index: number) =>
        {
            if(index < 0 || !savedFigures[index]) return;

            const figureContainer =
                savedFigures[index][0];

            if(!figureContainer) return;

            if(!isSlotUnlocked(index))
            {
                requestSlotAccess(index);
                return;
            }

            setDialogMode('rename');
            setDialogSlotIndex(index);
            setDialogName(
                outfitNames[index + 1] ||
                getFallbackName(index)
            );
        },
        [
            savedFigures,
            outfitNames,
            isSlotUnlocked,
            requestSlotAccess,
            getFallbackName
        ]
    );

    const closeDialog = useCallback(
        () =>
        {
            setDialogMode(null);
            setDialogSlotIndex(-1);
            setDialogName('');
        },
        []
    );

    const openPurchaseDialog = useCallback(
        () =>
        {
            if(purchasedSlots >= maxExtraSlots || nextExtraPrice <= 0) return;
            setPurchaseError('');
            setPurchasePending(false);
            setPurchaseDialogOpen(true);
        },
        [ purchasedSlots, nextExtraPrice ]
    );

    const closePurchaseDialog = useCallback(
        () =>
        {
            if(purchasePending) return;
            setPurchaseDialogOpen(false);
            setPurchaseError('');
        },
        [ purchasePending ]
    );

    const confirmPurchase = useCallback(
        () =>
        {
            if(purchasePending || purchasedSlots >= maxExtraSlots || nextExtraPrice <= 0) return;

            setPurchaseStartSlots(purchasedSlots);
            setPurchasePending(true);
            setPurchaseError('');

            SendMessageComposer(
                new BiribiriWardrobePurchaseRequestComposer()
            );
        },
        [ purchasePending, purchasedSlots, nextExtraPrice ]
    );

    const confirmDialog = useCallback(
        () =>
        {
            if(
                dialogSlotIndex < 0 ||
                !setOutfitNames
            ) return;

            if(!isSlotUnlocked(dialogSlotIndex))
            {
                requestSlotAccess(dialogSlotIndex);
                closeDialog();
                return;
            }

            const slotId =
                dialogSlotIndex + 1;

            const finalName =
                dialogName
                    .replace(/\s+/g, ' ')
                    .trim()
                    .slice(0, 32) ||
                getFallbackName(
                    dialogSlotIndex
                );

            if(dialogMode === 'save')
            {
                if(
                    !figureData ||
                    dialogSlotIndex >=
                        savedFigures.length
                ) return;

                const newFigures =
                    [ ...savedFigures ];

                const figure =
                    figureData.getFigureString();

                const gender =
                    figureData.gender;

                newFigures[dialogSlotIndex] = [
                    GetAvatarRenderManager()
                        .createFigureContainer(
                            figure
                        ),
                    gender
                ];

                setSavedFigures(newFigures);

                SendMessageComposer(
                    new SaveWardrobeOutfitMessageComposer(
                        slotId,
                        figure,
                        gender
                    )
                );
            }

            setOutfitNames(
                previous => ({
                    ...(previous || {}),
                    [slotId]: finalName
                })
            );

            SendMessageComposer(
                new BiribiriWardrobeNameSaveComposer(
                    slotId,
                    finalName
                )
            );

            closeDialog();
        },
        [
            dialogMode,
            dialogSlotIndex,
            dialogName,
            figureData,
            savedFigures,
            setSavedFigures,
            setOutfitNames,
            isSlotUnlocked,
            requestSlotAccess,
            getFallbackName,
            closeDialog
        ]
    );

    const visibleIndexes = useMemo(
        () =>
        {
            let startIndex = 0;

            if(activeSection === 'hc')
            {
                startIndex = baseSlots;
            }
            else if(activeSection === 'extra')
            {
                startIndex =
                    baseSlots +
                    hcSlots +
                    ((extraPage - 1) * 10);
            }

            return Array.from(
                { length: 10 },
                (_, offset) =>
                    startIndex + offset
            );
        },
        [
            activeSection,
            extraPage,
            baseSlots,
            hcSlots
        ]
    );

    const dialogFigure = useMemo(
        () =>
        {
            if(dialogSlotIndex < 0) return null;

            if(dialogMode === 'save')
            {
                return (
                    figureData
                        ? figureData.getFigureString()
                        : null
                );
            }

            const tuple =
                savedFigures[dialogSlotIndex];

            return (
                tuple && tuple[0]
                    ? tuple[0].getFigureString()
                    : null
            );
        },
        [
            dialogMode,
            dialogSlotIndex,
            figureData,
            savedFigures
        ]
    );

    const dialogGender = useMemo(
        () =>
        {
            if(dialogSlotIndex < 0) return null;

            if(dialogMode === 'save')
            {
                return (
                    figureData
                        ? figureData.gender
                        : null
                );
            }

            const tuple =
                savedFigures[dialogSlotIndex];

            return tuple ? tuple[1] : null;
        },
        [
            dialogMode,
            dialogSlotIndex,
            figureData,
            savedFigures
        ]
    );

    const figures = useMemo(
        () =>
        {
            const items: JSX.Element[] = [];

            visibleIndexes.forEach(
                index =>
                {
                    const tuple =
                        savedFigures[index] ||
                        [ null, null ];

                    const figureContainer =
                        tuple[0] as IAvatarFigureContainer;

                    const gender =
                        tuple[1] as string;

                    let clubLevel = 0;

                    if(figureContainer)
                    {
                        clubLevel =
                            GetAvatarRenderManager()
                                .getFigureClubLevel(
                                    figureContainer,
                                    gender
                                );
                    }

                    const slotType =
                        getSlotType(index);

                    const slotUnlocked =
                        isSlotUnlocked(index);

                    const clothingAllowed =
                        (
                            clubLevel <=
                                GetClubMemberLevel() ||
                            hcDisabled
                        );

                    const canUse =
                        slotUnlocked &&
                        clothingAllowed;

                    const outfitName =
                        outfitNames[index + 1] ||
                        '';

                    const isNextExtraPurchase =
                        slotType === 'extra' &&
                        !slotUnlocked &&
                        purchasedSlots < maxExtraSlots &&
                        index === nextExtraSlotIndex;

                    const slotPurchasePrice = isNextExtraPurchase ? nextExtraPrice : 0;

                    items.push(
                        <Flex
                            key={ index }
                            alignItems={ 'center' }
                            justifyContent={ 'center' }
                            className={
                                `biribiri-wardrobe-slot is-${ slotType }${
                                    slotUnlocked
                                        ? ''
                                        : ' is-locked'
                                }`
                            }>
                            <Flex
                                gap={ 1 }
                                column={ true }
                                className="button-container">
                                <button
                                    className="saved-outfit-button"
                                    onClick={
                                        () =>
                                            openSaveDialog(
                                                index
                                            )
                                    }
                                    disabled={ !canUse }>
                                    <MdKeyboardArrowRight />
                                </button>

                                { figureContainer &&
                                    <button
                                        className="saved-outfit-button"
                                        onClick={
                                            () =>
                                                wearFigureAtIndex(
                                                    index
                                                )
                                        }
                                        disabled={ !canUse }>
                                        <MdKeyboardArrowLeft />
                                    </button> }
                            </Flex>

                            <div className="avatar-container">
                                { !slotUnlocked &&
                                    !isNextExtraPurchase &&
                                    <span
                                        className={ `wardrobe-slot-lock is-${ slotType }` }>
                                        { slotType === 'hc' ? 'HC' : '×' }
                                    </span> }

                                { isNextExtraPurchase &&
                                    <button
                                        type="button"
                                        className="wardrobe-extra-buy-slot"
                                        title={ `Comprar espacio por ${ slotPurchasePrice } créditos` }
                                        onClick={ event => { event.stopPropagation(); openPurchaseDialog(); } }>
                                        <span className="wardrobe-extra-buy-plus">+</span>
                                        <span className="wardrobe-extra-buy-price">{ slotPurchasePrice } CR</span>
                                    </button> }

                                { figureContainer &&
                                    <>
                                        <LayoutAvatarImageView
                                            className="avatar-figure"
                                            figure={
                                                figureContainer
                                                    .getFigureString()
                                            }
                                            gender={ gender }
                                            direction={ 4 } />

                                        { slotUnlocked &&
                                            <button
                                                type="button"
                                                className="wardrobe-outfit-rename"
                                                title="Renombrar conjunto"
                                                onClick={
                                                    event =>
                                                    {
                                                        event.stopPropagation();

                                                        openRenameDialog(
                                                            index
                                                        );
                                                    }
                                                }>
                                                <MdEdit />
                                            </button> }

                                        { outfitName &&
                                            <span className="wardrobe-outfit-name-tooltip">
                                                { outfitName }
                                            </span> }
                                    </> }
                            </div>
                        </Flex>
                    );
                }
            );

            return items;
        },
        [
            visibleIndexes,
            savedFigures,
            outfitNames,
            hcDisabled,
            openSaveDialog,
            openRenameDialog,
            wearFigureAtIndex,
            getSlotType,
            isSlotUnlocked,
            purchasedSlots,
            nextExtraSlotIndex,
            nextExtraPrice,
            openPurchaseDialog
        ]
    );

    return (
        <div
            className="biribiri-wardrobe-v2 biribiri-wardrobe-named"
            data-biribiri-wardrobe={ 'v4-2-extra-slot-purchase' }>
            <div className="d-flex flex-column align-items-center">
                <span className="saved-outfits-title">
                    { LocalizeText('avatareditor.wardrobe.title') }
                </span>

                <div className="biribiri-wardrobe-sections">
                    <button
                        type="button"
                        className={
                            `wardrobe-section-tab is-base${
                                activeSection === 'base'
                                    ? ' is-active'
                                    : ''
                            }`
                        }
                        onClick={ () => setActiveSection('base') }>
                        <span className="wardrobe-section-icon is-base" />
                        <span>BASE</span>
                    </button>

                    <button
                        type="button"
                        className={
                            `wardrobe-section-tab is-hc${
                                activeSection === 'hc'
                                    ? ' is-active'
                                    : ''
                            }${
                                clientHcActive
                                    ? ''
                                    : ' is-locked'
                            }`
                        }
                        onClick={ () => setActiveSection('hc') }>
                        <span className="wardrobe-section-icon is-hc" />
                        <span>HC</span>
                    </button>

                    <button
                        type="button"
                        className={
                            `wardrobe-section-tab is-extra${
                                activeSection === 'extra'
                                    ? ' is-active'
                                    : ''
                            }`
                        }
                        onClick={ () => setActiveSection('extra') }>
                        <span className="wardrobe-extra-plus">+</span>
                        <span>EXTRA</span>
                    </button>
                </div>
            </div>

            <div className="saved-outfit-container mt-2">
                <div className="nitro-avatar-editor-wardrobe-container">
                    { figures }
                </div>
            </div>

            { activeSection === 'extra' &&
                <div className="biribiri-wardrobe-pages">
                    { Array.from(
                        { length: extraPageCount },
                        (_, pageIndex) =>
                        {
                            const page = pageIndex + 1;

                            return (
                                <button
                                    type="button"
                                    key={ page }
                                    className={
                                        page === extraPage
                                            ? 'is-active'
                                            : ''
                                    }
                                    onClick={ () => setExtraPage(page) }>
                                    { page }
                                </button>
                            );
                        }
                    ) }
                </div> }

            { purchaseDialogOpen &&
                <div
                    className="wardrobe-purchase-dialog"
                    onKeyDown={ event =>
                    {
                        if(event.key === 'Enter')
                        {
                            event.preventDefault();
                            confirmPurchase();
                        }
                        else if(event.key === 'Escape')
                        {
                            event.preventDefault();
                            closePurchaseDialog();
                        }
                    } }>
                    <div className="wardrobe-purchase-dialog-title">COMPRAR ESPACIO</div>
                    <div className="wardrobe-purchase-dialog-body">
                        <div className="wardrobe-purchase-slot-label">EXTRA { purchasedSlots + 1 }</div>
                        <div className="wardrobe-purchase-copy">Añade un espacio permanente al vestidor.</div>
                        <div className="wardrobe-purchase-price">{ nextExtraPrice } CRÉDITOS</div>
                        <div className="wardrobe-purchase-error">{ purchaseError }</div>
                        <div className="wardrobe-purchase-actions">
                            <button type="button" className="is-cancel" disabled={ purchasePending } onClick={ closePurchaseDialog }>Cancelar</button>
                            <button type="button" className="is-buy" disabled={ purchasePending } onClick={ confirmPurchase }>
                                { purchasePending ? 'Comprando...' : 'Comprar' }
                            </button>
                        </div>
                    </div>
                </div> }

            { dialogMode &&
                dialogSlotIndex >= 0 &&
                <div
                    className="wardrobe-name-dialog"
                    onKeyDown={
                        event =>
                        {
                            if(event.key === 'Enter')
                            {
                                event.preventDefault();
                                confirmDialog();
                            }
                            else if(event.key === 'Escape')
                            {
                                event.preventDefault();
                                closeDialog();
                            }
                        }
                    }>
                    <div className="wardrobe-name-dialog-title">
                        {
                            dialogMode === 'save'
                                ? 'GUARDAR CONJUNTO'
                                : 'RENOMBRAR CONJUNTO'
                        }
                    </div>

                    <div className="wardrobe-name-dialog-body">
                        { dialogFigure &&
                            <div className="wardrobe-name-dialog-preview">
                                <LayoutAvatarImageView
                                    className="avatar-figure"
                                    figure={ dialogFigure }
                                    gender={ dialogGender }
                                    direction={ 4 } />
                            </div> }

                        <div className="wardrobe-name-dialog-fields">
                            <label>NOMBRE</label>

                            <input
                                autoFocus
                                type="text"
                                value={ dialogName }
                                maxLength={ 32 }
                                onChange={
                                    event =>
                                        setDialogName(
                                            event.target.value
                                        )
                                } />

                            <div className="wardrobe-name-dialog-actions">
                                <button
                                    type="button"
                                    className="is-cancel"
                                    onClick={ closeDialog }>
                                    Cancelar
                                </button>

                                <button
                                    type="button"
                                    className="is-save"
                                    onClick={ confirmDialog }>
                                    Guardar
                                </button>
                            </div>
                        </div>
                    </div>
                </div> }
        </div>
    );
};
