// BIRIBIRI_WARDROBE_P6_FOLDERS
// BIRIBIRI_WARDROBE_P6_2_FOLDER_BROWSER
// BIRIBIRI_WARDROBE_P6_5_FOLDERS_FINAL
// BIRIBIRI_WARDROBE_P6_3_READABILITY
// BIRIBIRI_WARDROBE_DELETE_UNDO_V1
// BIRIBIRI_WARDROBE_V4_2_2_PURCHASE_ACK_FIX
// BIRIBIRI_WARDROBE_V4_2_EXTRA_SLOT_PURCHASE
// BIRIBIRI_WARDROBE_V4_1_3_MATCH_WARDROBE_PREVIEW
// BIRIBIRI_WARDROBE_V4_1_2_CENTERED_AVATAR_PREVIEW
// BIRIBIRI_WARDROBE_V4_1_1_FULL_AVATAR_PREVIEW
// BIRIBIRI_WARDROBE_V2_PAGED_SECTIONS
// BIRIBIRI_WARDROBE_V4_1_NAMED_OUTFITS
import { BiribiriWardrobeDeleteResultEvent, BiribiriWardrobeDeleteRequestComposer, BiribiriWardrobeNameSaveComposer, BiribiriWardrobePurchaseRequestComposer, BiribiriWardrobePurchaseResultEvent, IAvatarFigureContainer, SaveWardrobeOutfitMessageComposer } from '@nitrots/nitro-renderer';
import {
    BiribiriWardrobeFolderMutationComposer,
    BiribiriWardrobeFolderMutationResultEvent,
    BiribiriWardrobeFoldersEvent,
    BiribiriWardrobeFoldersRequestComposer,
    RegisterBiribiriWardrobeFolderMessages
} from '../../../api/avatar/WardrobeFolderMessages';
import { Dispatch, FC, SetStateAction, useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { MdAdd, MdDeleteOutline, MdEdit, MdFolder, MdKeyboardArrowLeft, MdKeyboardArrowRight, MdUndo } from 'react-icons/md';
import { CreateLinkEvent, FigureData, GetAvatarRenderManager, GetClubMemberLevel, GetConfiguration, LocalizeText, SendMessageComposer } from '../../../api';
import { Flex, LayoutAvatarImageView } from '../../../common';
import { useMessageEvent } from '../../../hooks';

type WardrobeSection = 'base' | 'hc' | 'extra' | 'folders';
type WardrobeFolderDialogMode = 'create' | 'rename' | 'delete';

interface WardrobeFolderData
{
    id: number;
    name: string;
    slots: Map<number, number>;
}
type WardrobeDialogMode = 'save' | 'rename';

interface WardrobeDeletedSnapshot
{
    reason: 'delete' | 'replace';
    slotIndex: number;
    figure: string;
    gender: string;
    name: string;
    folderId: number;
}

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

    // Registra 6214-6217 contra la conexion Nitro ya activa.
    // Es idempotente y evita depender de una copia stale en node_modules.
    RegisterBiribiriWardrobeFolderMessages();

    const hcDisabled =
        GetConfiguration<boolean>(
            'hc.disabled',
            false
        );

    // Biri Club usa el estado premium real enviado por el servidor.
    // hc.disabled solo libera ropa legacy; NO debe regalar slots BC ni carpetas.
    const biriClubActive =
        !!hcActive;

    const clientHcActive =
        biriClubActive;

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

    const pendingDeleteRef =
        useRef<WardrobeDeletedSnapshot | null>(null);

    const [ deletePending, setDeletePending ] =
        useState(false);

    const [ deleteError, setDeleteError ] =
        useState('');

    const [ undoSnapshot, setUndoSnapshot ] =
        useState<WardrobeDeletedSnapshot | null>(null);


    const [ folders, setFolders ] =
        useState<WardrobeFolderData[]>([]);

    const [ activeFolderId, setActiveFolderId ] =
        useState(0);

    const [ dialogFolderId, setDialogFolderId ] =
        useState(0);

    const [ folderDialogMode, setFolderDialogMode ] =
        useState<WardrobeFolderDialogMode>(null);

    const [ folderDialogName, setFolderDialogName ] =
        useState('');

    const [ folderMutationPending, setFolderMutationPending ] =
        useState(false);

    const [ folderActionError, setFolderActionError ] =
        useState('');

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


    useMessageEvent<BiribiriWardrobeDeleteResultEvent>(
        BiribiriWardrobeDeleteResultEvent,
        event =>
        {
            const parser =
                event.getParser();

            const snapshot =
                pendingDeleteRef.current;

            if(
                !snapshot ||
                parser.slotId !==
                    (snapshot.slotIndex + 1)
            )
            {
                return;
            }

            pendingDeleteRef.current =
                null;

            setDeletePending(false);

            if(parser.status !== 0)
            {
                if(parser.status === 1)
                {
                    setDeleteError(
                        'No puedes eliminar este espacio.'
                    );
                }
                else if(parser.status === 2)
                {
                    setDeleteError(
                        'El conjunto ya no existe.'
                    );
                }
                else
                {
                    setDeleteError(
                        'No se pudo eliminar el conjunto.'
                    );
                }

                return;
            }

            setSavedFigures(
                previous =>
                {
                    const next =
                        [ ...(previous || []) ];

                    delete (next as any)[
                        snapshot.slotIndex
                    ];

                    return next;
                }
            );

            setOutfitNames(
                previous =>
                {
                    const next = {
                        ...(previous || {})
                    };

                    delete next[
                        snapshot.slotIndex + 1
                    ];

                    return next;
                }
            );

            setUndoSnapshot(
                snapshot
            );

            setDeleteError('');
        }
    );

    useEffect(() =>
    {
        if(!deletePending) return;

        const timeout =
            window.setTimeout(
                () =>
                {
                    pendingDeleteRef.current =
                        null;

                    setDeletePending(false);

                    setDeleteError(
                        'El servidor no confirmo el borrado.'
                    );
                },
                5000
            );

        return () =>
            window.clearTimeout(
                timeout
            );
    }, [ deletePending ]);

    useMessageEvent<BiribiriWardrobeFoldersEvent>(
        BiribiriWardrobeFoldersEvent,
        event =>
        {
            const parser =
                event.getParser();

            const nextFolders: WardrobeFolderData[] =
                parser.folders.map(
                    folder => ({
                        id: folder.id,
                        name: folder.name,
                        slots: new Map<number, number>(
                            folder.slots
                        )
                    })
                );

            setFolders(nextFolders);

            setActiveFolderId(
                previous =>
                {
                    if(
                        previous > 0 &&
                        nextFolders.some(
                            folder =>
                                folder.id === previous
                        )
                    )
                    {
                        return previous;
                    }

                    return 0;
                }
            );
        }
    );

    useMessageEvent<BiribiriWardrobeFolderMutationResultEvent>(
        BiribiriWardrobeFolderMutationResultEvent,
        event =>
        {
            const parser =
                event.getParser();

            setFolderMutationPending(false);

            if(parser.status === 0)
            {
                setFolderActionError('');
                setFolderDialogMode(null);
                setFolderDialogName('');
                return;
            }

            if(parser.status === 1)
            {
                setFolderActionError(
                    'Necesitas Biri Club activo.'
                );
                return;
            }

            if(parser.status === 3)
            {
                setFolderActionError(
                    'Esa carpeta ya tiene 10 conjuntos.'
                );
                return;
            }

            if(parser.status === 4)
            {
                setFolderActionError(
                    'La carpeta ya no existe.'
                );
                return;
            }

            if(parser.status === 5)
            {
                setFolderActionError(
                    'Ya tienes una carpeta con ese nombre.'
                );
                return;
            }

            if(parser.status === 7)
            {
                setFolderActionError(
                    'Puedes tener un m??ximo de 10 carpetas.'
                );
                return;
            }

            setFolderActionError(
                'No se pudo actualizar la carpeta.'
            );
        }
    );

    useEffect(() =>
    {
        SendMessageComposer(
            new BiribiriWardrobeFoldersRequestComposer()
        );
    }, []);

    const getFolderIdForSlot =
        useCallback(
            (slotId: number): number =>
            {
                if(slotId <= 0) return 0;

                for(const folder of folders)
                {
                    for(
                        const assignedSlotId
                        of folder.slots.values()
                    )
                    {
                        if(assignedSlotId === slotId)
                        {
                            return folder.id;
                        }
                    }
                }

                return 0;
            },
            [ folders ]
        );

    const activeFolder =
        useMemo(
            () =>
                folders.find(
                    folder =>
                        folder.id === activeFolderId
                ) || null,
            [
                folders,
                activeFolderId
            ]
        );

    const openFoldersSection =
        useCallback(
            () =>
            {
                if(!biriClubActive)
                {
                    CreateLinkEvent(
                        'habboUI/open/hccenter'
                    );
                    return;
                }

                setFolderActionError('');
                setActiveSection('folders');
                setActiveFolderId(0);
            },
            [
                biriClubActive
            ]
        );

    const openFolderDialog =
        useCallback(
            (
                mode: WardrobeFolderDialogMode,
                folder: WardrobeFolderData = null
            ) =>
            {
                if(!biriClubActive)
                {
                    CreateLinkEvent(
                        'habboUI/open/hccenter'
                    );
                    return;
                }

                setFolderActionError('');
                setFolderDialogMode(mode);
                setFolderDialogName(
                    folder
                        ? folder.name
                        : ''
                );
            },
            [ biriClubActive ]
        );

    const closeFolderDialog =
        useCallback(
            () =>
            {
                if(folderMutationPending) return;

                setFolderDialogMode(null);
                setFolderDialogName('');
                setFolderActionError('');
            },
            [ folderMutationPending ]
        );

    const confirmFolderDialog =
        useCallback(
            () =>
            {
                if(
                    folderMutationPending ||
                    !folderDialogMode
                ) return;

                if(!biriClubActive)
                {
                    CreateLinkEvent(
                        'habboUI/open/hccenter'
                    );
                    return;
                }

                let action = 0;
                let folderId = 0;
                let name = '';

                if(folderDialogMode === 'create')
                {
                    if(folders.length >= 10)
                    {
                        setFolderActionError(
                            'Puedes tener un m??ximo de 10 carpetas.'
                        );
                        return;
                    }

                    action = 1;
                    name =
                        folderDialogName
                            .replace(/\s+/g, ' ')
                            .trim()
                            .slice(0, 32);

                    if(!name) return;
                }
                else if(folderDialogMode === 'rename')
                {
                    if(!activeFolder) return;

                    action = 2;
                    folderId = activeFolder.id;
                    name =
                        folderDialogName
                            .replace(/\s+/g, ' ')
                            .trim()
                            .slice(0, 32);

                    if(!name) return;
                }
                else
                {
                    if(!activeFolder) return;

                    action = 3;
                    folderId = activeFolder.id;
                }

                setFolderMutationPending(true);
                setFolderActionError('');

                SendMessageComposer(
                    new BiribiriWardrobeFolderMutationComposer(
                        action,
                        folderId,
                        0,
                        name
                    )
                );
            },
            [
                folderMutationPending,
                folderDialogMode,
                folderDialogName,
                biriClubActive,
                activeFolder,
                folders
            ]
        );

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
            setDialogFolderId(
                getFolderIdForSlot(
                    index + 1
                )
            );
        },
        [
            figureData,
            outfitNames,
            isSlotUnlocked,
            requestSlotAccess,
            getFallbackName,
            getFolderIdForSlot
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
            setDialogFolderId(
                getFolderIdForSlot(
                    index + 1
                )
            );
        },
        [
            savedFigures,
            outfitNames,
            isSlotUnlocked,
            requestSlotAccess,
            getFallbackName,
            getFolderIdForSlot
        ]
    );

    const closeDialog = useCallback(
        () =>
        {
            setDialogMode(null);
            setDialogSlotIndex(-1);
            setDialogName('');
            setDialogFolderId(0);
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

            const previousFolderId =
                getFolderIdForSlot(
                    slotId
                );

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


                // BIRIBIRI_WARDROBE_UNDO_REPLACE_V2
                const previousTupleForUndo =
                    savedFigures[
                        dialogSlotIndex
                    ];

                if(
                    previousTupleForUndo &&
                    previousTupleForUndo[0]
                )
                {
                    const previousFigure =
                        previousTupleForUndo[0]
                            .getFigureString();

                    const previousGender =
                        previousTupleForUndo[1];

                    const previousName =
                        outfitNames[slotId] ||
                        '';

                    const actuallyChanged =
                        previousFigure !== figure ||
                        previousGender !== gender ||
                        previousName !== finalName;

                    if(actuallyChanged)
                    {
                        // Al sustituir un look, este pasa a ser
                        // el UNICO estado recuperable.
                        setUndoSnapshot({
                            reason: 'replace',
                            slotIndex:
                                dialogSlotIndex,
                            figure:
                                previousFigure,
                            gender:
                                previousGender,
                            name:
                                previousName,
                            folderId:
                                previousFolderId
                        });

                        setDeleteError('');
                    }
                }
                else if(
                    undoSnapshot &&
                    undoSnapshot.slotIndex ===
                        dialogSlotIndex
                )
                {
                    // Si era un slot borrado y ya lo reutilizamos,
                    // aquel borrado deja de ser recuperable.
                    setUndoSnapshot(null);
                }

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

            if(
                biriClubActive &&
                dialogFolderId !== previousFolderId
            )
            {
                SendMessageComposer(
                    new BiribiriWardrobeFolderMutationComposer(
                        4,
                        dialogFolderId,
                        slotId,
                        ''
                    )
                );
            }

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
            closeDialog,
            outfitNames,
            undoSnapshot,
            dialogFolderId,
            getFolderIdForSlot,
            biriClubActive
        ]
    );


    const requestDeleteOutfit = useCallback(
        (index: number) =>
        {
            if(
                deletePending ||
                index < 0
            )
            {
                return;
            }

            if(!isSlotUnlocked(index))
            {
                requestSlotAccess(index);
                return;
            }

            const tuple =
                savedFigures[index];

            if(
                !tuple ||
                !tuple[0]
            )
            {
                return;
            }

            const snapshot:
                WardrobeDeletedSnapshot =
            {
                reason: 'delete',
                slotIndex: index,
                figure:
                    tuple[0]
                        .getFigureString(),
                gender:
                    tuple[1],
                name:
                    outfitNames[index + 1] ||
                    '',
                folderId:
                    getFolderIdForSlot(
                        index + 1
                    )
            };

            // Nuevo borrado = el Undo anterior deja
            // de estar disponible inmediatamente.
            setUndoSnapshot(null);

            pendingDeleteRef.current =
                snapshot;

            setDeletePending(true);
            setDeleteError('');

            SendMessageComposer(
                new BiribiriWardrobeDeleteRequestComposer(
                    index + 1
                )
            );
        },
        [
            deletePending,
            savedFigures,
            outfitNames,
            isSlotUnlocked,
            requestSlotAccess,
            getFolderIdForSlot
        ]
    );

    const undoLastDelete = useCallback(
        () =>
        {
            const snapshot =
                undoSnapshot;

            if(!snapshot)
            {
                return;
            }

            if(
                !isSlotUnlocked(
                    snapshot.slotIndex
                )
            )
            {
                requestSlotAccess(
                    snapshot.slotIndex
                );

                return;
            }

            const existing =
                savedFigures[
                    snapshot.slotIndex
                ];

            // Para un DELETE esperamos que el slot siga vacio.
            // Para un REPLACE es normal que contenga el look nuevo.
            if(
                snapshot.reason === 'delete' &&
                existing &&
                existing[0]
            )
            {
                setUndoSnapshot(null);

                setDeleteError(
                    'Ese espacio ya contiene otro conjunto.'
                );

                return;
            }

            const nextFigures =
                [ ...savedFigures ];

            nextFigures[
                snapshot.slotIndex
            ] = [
                GetAvatarRenderManager()
                    .createFigureContainer(
                        snapshot.figure
                    ),
                snapshot.gender
            ];

            setSavedFigures(
                nextFigures
            );

            // Persistencia real del look recuperado.
            SendMessageComposer(
                new SaveWardrobeOutfitMessageComposer(
                    snapshot.slotIndex + 1,
                    snapshot.figure,
                    snapshot.gender
                )
            );

            // Restauramos tambien el nombre exacto.
            // Cadena vacia = quitar metadata del nombre.
            setOutfitNames(
                previous =>
                {
                    const next = {
                        ...(previous || {})
                    };

                    if(snapshot.name)
                    {
                        next[
                            snapshot.slotIndex + 1
                        ] = snapshot.name;
                    }
                    else
                    {
                        delete next[
                            snapshot.slotIndex + 1
                        ];
                    }

                    return next;
                }
            );

            SendMessageComposer(
                new BiribiriWardrobeNameSaveComposer(
                    snapshot.slotIndex + 1,
                    snapshot.name || ''
                )
            );

            if(biriClubActive)
            {
                SendMessageComposer(
                    new BiribiriWardrobeFolderMutationComposer(
                        4,
                        snapshot.folderId || 0,
                        snapshot.slotIndex + 1,
                        ''
                    )
                );
            }

            setUndoSnapshot(null);
            setDeleteError('');
        },
        [
            undoSnapshot,
            savedFigures,
            setSavedFigures,
            setOutfitNames,
            isSlotUnlocked,
            requestSlotAccess,
            biriClubActive
        ]
    );

    const visibleIndexes = useMemo(
        () =>
        {
            if(activeSection === 'folders')
            {
                return [];
            }

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
                                        { slotType === 'hc' ? 'BC' : '\u00D7' }
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

                                        { slotUnlocked &&
                                            <button
                                                type="button"
                                                className="wardrobe-outfit-delete"
                                                title="Eliminar conjunto"
                                                disabled={ deletePending }
                                                onClick={
                                                    event =>
                                                    {
                                                        event.stopPropagation();

                                                        requestDeleteOutfit(
                                                            index
                                                        );
                                                    }
                                                }>
                                                <MdDeleteOutline />
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
            openPurchaseDialog,
            requestDeleteOutfit,
            deletePending
        ]
    );

    const folderFigures = useMemo(
        () =>
        {
            const items: JSX.Element[] = [];

            for(
                let position = 1;
                position <= 10;
                position++
            )
            {
                const slotId =
                    activeFolder
                        ? (
                            activeFolder.slots.get(
                                position
                            ) || 0
                        )
                        : 0;

                const index =
                    slotId > 0
                        ? slotId - 1
                        : -1;

                const tuple =
                    index >= 0
                        ? (
                            savedFigures[index] ||
                            [ null, null ]
                        )
                        : [ null, null ];

                const figureContainer =
                    tuple[0] as IAvatarFigureContainer;

                const gender =
                    tuple[1] as string;

                const canUse =
                    index >= 0 &&
                    isSlotUnlocked(index);

                const outfitName =
                    slotId > 0
                        ? (
                            outfitNames[slotId] ||
                            ''
                        )
                        : '';

                items.push(
                    <Flex
                        key={ position }
                        alignItems={ 'center' }
                        justifyContent={ 'center' }
                        className={
                            `biribiri-wardrobe-slot is-folder${
                                figureContainer
                                    ? ''
                                    : ' is-folder-empty'
                            }`
                        }>
                        { figureContainer &&
                            <Flex
                                gap={ 1 }
                                column={ true }
                                className="button-container">
                                <button
                                    className="saved-outfit-button"
                                    title="Vestir conjunto"
                                    onClick={
                                        () =>
                                            wearFigureAtIndex(
                                                index
                                            )
                                    }
                                    disabled={ !canUse }>
                                    <MdKeyboardArrowLeft />
                                </button>
                            </Flex> }

                        <div className="avatar-container">
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

                                    { canUse &&
                                        <button
                                            type="button"
                                            className="wardrobe-outfit-rename"
                                            title="Editar conjunto"
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

            return items;
        },
        [
            activeFolder,
            savedFigures,
            outfitNames,
            isSlotUnlocked,
            wearFigureAtIndex,
            openRenameDialog
        ]
    );

    const folderDirectory = useMemo(
        () =>
        {
            const items: JSX.Element[] = [];

            for(
                let position = 0;
                position < 10;
                position++
            )
            {
                const folder =
                    folders[position] ||
                    null;

                const isCreateSlot =
                    !folder &&
                    position === folders.length &&
                    folders.length < 10;

                items.push(
                    <Flex
                        key={
                            folder
                                ? folder.id
                                : `folder-directory-${ position }`
                        }
                        alignItems={ 'center' }
                        justifyContent={ 'center' }
                        className={
                            `biribiri-wardrobe-slot is-folder-directory${
                                folder
                                    ? ' has-folder'
                                    : (
                                        isCreateSlot
                                            ? ' is-create'
                                            : ' is-empty'
                                    )
                            }`
                        }>
                        <button
                            type="button"
                            className="wardrobe-folder-tile"
                            disabled={
                                !folder &&
                                !isCreateSlot
                            }
                            title={
                                folder
                                    ? `${ folder.name } (${ folder.slots.size }/10)`
                                    : (
                                        isCreateSlot
                                            ? 'Nueva carpeta'
                                            : ''
                                    )
                            }
                            onClick={
                                () =>
                                {
                                    if(folder)
                                    {
                                        setFolderActionError('');
                                        setActiveFolderId(
                                            folder.id
                                        );
                                        return;
                                    }

                                    if(isCreateSlot)
                                    {
                                        openFolderDialog(
                                            'create'
                                        );
                                    }
                                }
                            }>
                            { folder
                                ? <>
                                    <MdFolder className="wardrobe-folder-tile-icon" />
                                    <span className="wardrobe-folder-tile-name">
                                        { folder.name }
                                    </span>
                                    <span className="wardrobe-folder-tile-count">
                                        { `${ folder.slots.size }/10` }
                                    </span>
                                </>
                                : (
                                    isCreateSlot
                                        ? <>
                                            <MdAdd className="wardrobe-folder-tile-icon is-add" />
                                            <span className="wardrobe-folder-tile-name">
                                                Nueva carpeta
                                            </span>
                                        </>
                                        : <span className="wardrobe-folder-tile-placeholder" />
                                )
                            }
                        </button>
                    </Flex>
                );
            }

            return items;
        },
        [
            folders,
            openFolderDialog
        ]
    );

    return (
        <div
            className="biribiri-wardrobe-v2 biribiri-wardrobe-named"             data-biribiri-wardrobe={ 'v6-2-folder-browser' }>
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
                        <span title="Biri Club">BC</span>
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

                    <button
                        type="button"
                        className={
                            `wardrobe-section-tab is-folders${
                                activeSection === 'folders'
                                    ? ' is-active'
                                    : ''
                            }${
                                biriClubActive
                                    ? ''
                                    : ' is-locked'
                            }`
                        }
                        title={
                            biriClubActive
                                ? 'Carpetas'
                                : 'Carpetas ?? Biri Club'
                        }
                        aria-label="Carpetas"
                        onClick={ openFoldersSection }>
                        <MdFolder />
                    </button>

                </div>
            </div>

            { activeSection === 'folders' &&
                biriClubActive &&
                <div
                    className={
                        `wardrobe-folder-browser-header${
                            activeFolder
                                ? ' is-open'
                                : ' is-root'
                        }`
                    }>
                    { activeFolder
                        ? <>
                            <button
                                type="button"
                                className="wardrobe-folder-browser-back"
                                title="Volver a carpetas"
                                onClick={
                                    () =>
                                    {
                                        setFolderActionError('');
                                        setActiveFolderId(0);
                                    }
                                }>
                                <MdKeyboardArrowLeft />
                            </button>

                            <div
                                className="wardrobe-folder-browser-title"
                                title={ activeFolder.name }>
                                <MdFolder />
                                <span>{ activeFolder.name }</span>
                                <small>{ `${ activeFolder.slots.size }/10` }</small>
                            </div>

                            <div className="wardrobe-folder-browser-actions">
                                <button
                                    type="button"
                                    title="Renombrar carpeta"
                                    onClick={
                                        () =>
                                            openFolderDialog(
                                                'rename',
                                                activeFolder
                                            )
                                    }>
                                    <MdEdit />
                                </button>

                                <button
                                    type="button"
                                    title="Eliminar carpeta"
                                    onClick={
                                        () =>
                                            openFolderDialog(
                                                'delete',
                                                activeFolder
                                            )
                                    }>
                                    <MdDeleteOutline />
                                </button>
                            </div>
                        </>
                        : <>
                            <div className="wardrobe-folder-browser-title">
                                <MdFolder />
                                <span>Mis carpetas</span>
                                <small>{ `${ folders.length }/10` }</small>
                            </div>

                            <div className="wardrobe-folder-browser-actions">
                                <button
                                    type="button"
                                    title={
                                        folders.length >= 10
                                            ? 'M??ximo de 10 carpetas'
                                            : 'Nueva carpeta'
                                    }
                                    disabled={ folders.length >= 10 }
                                    onClick={
                                        () =>
                                            openFolderDialog(
                                                'create'
                                            )
                                    }>
                                    <MdAdd />
                                </button>
                            </div>
                        </>
                    }
                </div> }

            <div
                className={
                    `saved-outfit-container mt-2${
                        activeSection === 'folders'
                            ? ' is-folder-view'
                            : ''
                    }`
                }>
                <div className="nitro-avatar-editor-wardrobe-container">
                    {
                        activeSection === 'folders'
                            ? (
                                activeFolder
                                    ? folderFigures
                                    : folderDirectory
                            )
                            : figures
                    }
                </div>
            </div>

            { folderActionError &&
                <div className="wardrobe-folder-error">
                    { folderActionError }
                </div> }

            { (undoSnapshot || deleteError) &&
                <div className="wardrobe-undo-floating">
                    <span className="wardrobe-undo-message">
                        {
                            deleteError ||
                            (
                                undoSnapshot
                                    ? (
                                        undoSnapshot.reason === 'replace'
                                            ? `Conjunto ${ undoSnapshot.slotIndex + 1 } sustituido`
                                            : `Conjunto ${ undoSnapshot.slotIndex + 1 } eliminado`
                                    )
                                    : ''
                            )
                        }
                    </span>

                    { undoSnapshot &&
                        <button
                            type="button"
                            className="wardrobe-undo-button"
                            disabled={ deletePending }
                            onClick={ undoLastDelete }>
                            <MdUndo />
                            <span>Deshacer</span>
                        </button> }
                </div> }

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

            { folderDialogMode &&
                <div
                    className="wardrobe-name-dialog wardrobe-folder-dialog"
                    onKeyDown={
                        event =>
                        {
                            if(event.key === 'Enter')
                            {
                                event.preventDefault();
                                confirmFolderDialog();
                            }
                            else if(event.key === 'Escape')
                            {
                                event.preventDefault();
                                closeFolderDialog();
                            }
                        }
                    }>
                    <div className="wardrobe-name-dialog-title">
                        {
                            folderDialogMode === 'create'
                                ? 'NUEVA CARPETA'
                                : (
                                    folderDialogMode === 'rename'
                                        ? 'RENOMBRAR CARPETA'
                                        : 'ELIMINAR CARPETA'
                                )
                        }
                    </div>

                    <div className="wardrobe-folder-dialog-body">
                        { folderDialogMode !== 'delete'
                            ? <>
                                <label>NOMBRE</label>
                                <input
                                    autoFocus
                                    type="text"
                                    value={ folderDialogName }
                                    maxLength={ 32 }
                                    onChange={
                                        event =>
                                            setFolderDialogName(
                                                event.target.value
                                            )
                                    } />
                            </>
                            : <div className="wardrobe-folder-delete-copy">
                                { 'Los conjuntos no se eliminar\u00e1n. Solo se borrar\u00e1 la carpeta.' }
                            </div> }

                        { folderActionError &&
                            <div className="wardrobe-folder-dialog-error">
                                { folderActionError }
                            </div> }

                        <div className="wardrobe-name-dialog-actions">
                            <button
                                type="button"
                                className="is-cancel"
                                disabled={ folderMutationPending }
                                onClick={ closeFolderDialog }>
                                Cancelar
                            </button>

                            <button
                                type="button"
                                className={
                                    folderDialogMode === 'delete'
                                        ? 'is-delete'
                                        : 'is-save'
                                }
                                disabled={ folderMutationPending }
                                onClick={ confirmFolderDialog }>
                                {
                                    folderMutationPending
                                        ? 'Guardando...'
                                        : (
                                            folderDialogMode === 'delete'
                                                ? 'Eliminar'
                                                : 'Guardar'
                                        )
                                }
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

                            <label>CARPETA</label>

                            <select
                                value={ dialogFolderId }
                                disabled={ !biriClubActive }
                                title={
                                    biriClubActive
                                        ? 'Asignar a una carpeta'
                                        : 'Requiere Biri Club'
                                }
                                onChange={
                                    event =>
                                        setDialogFolderId(
                                            parseInt(
                                                event.target.value,
                                                10
                                            ) || 0
                                        )
                                }>
                                <option value={ 0 }>
                                    Sin carpeta
                                </option>

                                { folders.map(
                                    folder =>
                                    {
                                        const currentFolderId =
                                            getFolderIdForSlot(
                                                dialogSlotIndex + 1
                                            );

                                        const full =
                                            folder.slots.size >= 10 &&
                                            currentFolderId !== folder.id;

                                        return (
                                            <option
                                                key={ folder.id }
                                                value={ folder.id }
                                                disabled={ full }>
                                                { `${ folder.name } (${ folder.slots.size }/10)` }
                                            </option>
                                        );
                                    }
                                ) }
                            </select>

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
