// BIRIBIRI_CLOTHING_FILTERS_V1
import {
    BiribiriWardrobeClothingFavoriteSetComposer,
    BiribiriWardrobeClothingFavoritesEvent,
    BiribiriWardrobeClothingFavoritesRequestComposer,
    BiribiriWardrobeClothingMetadataEvent,
    BiribiriWardrobeClothingMetadataRequestComposer,
    HabboClubLevelEnum
} from '@nitrots/nitro-renderer';
import {
    Dispatch,
    FC,
    SetStateAction,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import {
    AvatarEditorGridPartItem,
    CategoryData,
    CreateLinkEvent,
    GetSessionDataManager,
    IAvatarEditorCategoryModel,
    SendMessageComposer
} from '../../../../api';
import { AutoGrid } from '../../../../common';
import { useMessageEvent } from '../../../../hooks';
import { AvatarEditorFigureSetItemView } from './AvatarEditorFigureSetItemView';

const TSHIRT_FOOTBALL_GATE =
    [ 3111, 3110, 3109, 3030, 3114, 266, 265, 262, 3113, 3112, 691, 690, 667 ];

const NUMBER_BEHIND_FOOTBALL_GATE =
    [ 3128, 3127, 3126, 3125, 3124, 3123, 3122, 3121, 3120, 3119 ];

const PANTS_FOOTBALL_GATE =
    [ 3116, 281, 275, 715, 700, 696, 3006 ];

const SHOES_FOOTBALL_GATE =
    [ 3115, 3068, 906 ];

interface ClothingMetadataEntry
{
    figureType: string;
    figureSetId: number;
    name: string;
    tags: string[];
}

const CLOTHING_TYPE_NAMES:
Record<string, string> =
{
    hd: 'Cara',
    hr: 'Pelo',
    ha: 'Sombrero',
    he: 'Accesorio de cabeza',
    ea: 'Accesorio de ojos',
    fa: 'Accesorio facial',
    cc: 'Chaqueta',
    ch: 'Camiseta',
    ca: 'Accesorio de torso',
    cp: 'Estampado',
    lg: 'Pantal\u00f3n',
    sh: 'Zapatos',
    wa: 'Accesorio de cintura'
};

const canonicalId = (
    value: number
): number =>
    (value >>> 0);

const normalizeSearch = (
    value: string
): string =>
    (value || '')
        .normalize('NFD')
        .replace(
            /[\u0300-\u036f]/g,
            ''
        )
        .toLowerCase()
        .trim();

export interface AvatarEditorFigureSetViewProps
{
    model: IAvatarEditorCategoryModel;
    category: CategoryData;
    isFromFootballGate?: boolean;
    setMaxPaletteCount:
        Dispatch<SetStateAction<number>>;
}

export const AvatarEditorFigureSetView:
FC<AvatarEditorFigureSetViewProps> = props =>
{
    const {
        model = null,
        category = null,
        isFromFootballGate = false,
        setMaxPaletteCount = null
    } = props;

    const elementRef =
        useRef<HTMLDivElement>(null);

    const [
        favorites,
        setFavorites
    ] = useState<Set<string>>(
        new Set<string>()
    );

    const [
        metadata,
        setMetadata
    ] = useState<
        Map<string, ClothingMetadataEntry>
    >(
        new Map<string, ClothingMetadataEntry>()
    );

    const [
        search,
        setSearch
    ] = useState('');

    const [
        activeFilter,
        setActiveFilter
    ] = useState('all');

    useMessageEvent<BiribiriWardrobeClothingFavoritesEvent>(
        BiribiriWardrobeClothingFavoritesEvent,
        event =>
        {
            setFavorites(
                new Set<string>(
                    event.getParser().favorites
                )
            );
        }
    );

    useMessageEvent<BiribiriWardrobeClothingMetadataEvent>(
        BiribiriWardrobeClothingMetadataEvent,
        event =>
        {
            const next =
                new Map<string, ClothingMetadataEntry>();

            for(
                const [ key, entry ]
                of event.getParser().metadata.entries()
            )
            {
                next.set(
                    key,
                    {
                        figureType:
                            entry.figureType,
                        figureSetId:
                            entry.figureSetId,
                        name:
                            entry.name || '',
                        tags:
                            [ ...(entry.tags || []) ]
                    }
                );
            }

            setMetadata(next);
        }
    );

    useEffect(() =>
    {
        SendMessageComposer(
            new BiribiriWardrobeClothingFavoritesRequestComposer()
        );

        SendMessageComposer(
            new BiribiriWardrobeClothingMetadataRequestComposer()
        );
    }, []);

    useEffect(() =>
    {
        setActiveFilter('all');
        setSearch('');
    }, [
        category?.name
    ]);

    const favoriteKey =
        useCallback(
            (
                item:
                    AvatarEditorGridPartItem
            ): string =>
            {
                if(
                    !item ||
                    item.isClear ||
                    !category
                )
                {
                    return '';
                }

                const id =
                    canonicalId(
                        item.id
                    );

                if(
                    id === 0 ||
                    id === 0xFFFFFFFF
                )
                {
                    return '';
                }

                return (
                    `${ category.name }:${ id }`
                );
            },
            [ category ]
        );

    const getMetadata =
        useCallback(
            (
                id: number
            ): ClothingMetadataEntry =>
            {
                if(!category)
                {
                    return null;
                }

                return (
                    metadata.get(
                        `${ category.name }:${ id }`
                    ) ||
                    metadata.get(
                        `*:${ id }`
                    ) ||
                    null
                );
            },
            [
                category,
                metadata
            ]
        );

    const toggleFavorite =
        useCallback(
            (
                item:
                    AvatarEditorGridPartItem
            ) =>
            {
                if(
                    !item ||
                    item.isClear ||
                    !category
                )
                {
                    return;
                }

                const key =
                    favoriteKey(item);

                if(!key)
                {
                    return;
                }

                const nextValue =
                    !favorites.has(key);

                setFavorites(
                    previous =>
                    {
                        const next =
                            new Set<string>(
                                previous
                            );

                        if(nextValue)
                        {
                            next.add(key);
                        }
                        else
                        {
                            next.delete(key);
                        }

                        return next;
                    }
                );

                SendMessageComposer(
                    new BiribiriWardrobeClothingFavoriteSetComposer(
                        category.name,
                        item.id,
                        nextValue
                    )
                );
            },
            [
                category,
                favorites,
                favoriteKey
            ]
        );

    const selectPart =
        useCallback(
            (
                item:
                    AvatarEditorGridPartItem
            ) =>
            {
                const index =
                    category.parts.indexOf(
                        item
                    );

                if(index === -1)
                {
                    return;
                }

                if(
                    item.isHC &&
                    GetSessionDataManager()
                        .clubLevel ===
                        HabboClubLevelEnum.NO_CLUB
                )
                {
                    return CreateLinkEvent(
                        'habboUI/open/hccenter'
                    );
                }

                model.selectPart(
                    category.name,
                    index
                );

                const selected =
                    category.getCurrentPart();

                setMaxPaletteCount(
                    selected.maxColorIndex ||
                    1
                );
            },
            [
                model,
                category,
                setMaxPaletteCount
            ]
        );

    const sortedParts =
        useMemo(
            () =>
            {
                if(!category)
                {
                    return [];
                }

                const result =
                    category.parts
                        .map(
                            (item, index) =>
                            ({
                                item,
                                index
                            })
                        )
                        .filter(
                            entry =>
                            {
                                const item =
                                    entry.item;

                                if(item.isClear)
                                {
                                    return true;
                                }

                                if(!isFromFootballGate)
                                {
                                    return true;
                                }

                                return (
                                    TSHIRT_FOOTBALL_GATE.includes(item.id) ||
                                    NUMBER_BEHIND_FOOTBALL_GATE.includes(item.id) ||
                                    PANTS_FOOTBALL_GATE.includes(item.id) ||
                                    SHOES_FOOTBALL_GATE.includes(item.id)
                                );
                            }
                        );

                result.sort(
                    (a, b) =>
                    {
                        if(
                            a.item.isClear &&
                            !b.item.isClear
                        )
                        {
                            return -1;
                        }

                        if(
                            b.item.isClear &&
                            !a.item.isClear
                        )
                        {
                            return 1;
                        }

                        const aFav =
                            favorites.has(
                                favoriteKey(
                                    a.item
                                )
                            );

                        const bFav =
                            favorites.has(
                                favoriteKey(
                                    b.item
                                )
                            );

                        if(aFav !== bFav)
                        {
                            return (
                                aFav
                                    ? -1
                                    : 1
                            );
                        }

                        return (
                            a.index -
                            b.index
                        );
                    }
                );

                return result;
            },
            [
                category,
                isFromFootballGate,
                favorites,
                favoriteKey
            ]
        );

    const availableTags =
        useMemo(
            () =>
            {
                const tags =
                    new Map<string, string>();

                for(const entry of sortedParts)
                {
                    if(entry.item.isClear)
                    {
                        continue;
                    }

                    const id =
                        canonicalId(
                            entry.item.id
                        );

                    const itemMetadata =
                        getMetadata(id);

                    for(
                        const rawTag
                        of itemMetadata?.tags || []
                    )
                    {
                        const tag =
                            rawTag.trim();

                        if(!tag)
                        {
                            continue;
                        }

                        const normalized =
                            normalizeSearch(tag);

                        if(
                            normalized &&
                            !tags.has(normalized)
                        )
                        {
                            tags.set(
                                normalized,
                                tag
                            );
                        }
                    }
                }

                return Array.from(
                    tags.entries()
                )
                    .sort(
                        (a, b) =>
                            a[1].localeCompare(
                                b[1]
                            )
                    );
            },
            [
                sortedParts,
                getMetadata
            ]
        );

    useEffect(() =>
    {
        if(
            !activeFilter.startsWith('tag:')
        )
        {
            return;
        }

        const currentTag =
            activeFilter.substring(4);

        if(
            !availableTags.some(
                ([ normalized ]) =>
                    normalized === currentTag
            )
        )
        {
            setActiveFilter('all');
        }
    }, [
        activeFilter,
        availableTags
    ]);

    const visibleParts =
        useMemo(
            () =>
            {
                const query =
                    normalizeSearch(
                        search
                    );

                return sortedParts.filter(
                    entry =>
                    {
                        const item =
                            entry.item;

                        // La X sigue siempre accesible.
                        if(item.isClear)
                        {
                            return true;
                        }

                        const id =
                            canonicalId(
                                item.id
                            );

                        const itemMetadata =
                            getMetadata(id);

                        const key =
                            favoriteKey(item);

                        if(
                            activeFilter === 'favorites' &&
                            !favorites.has(key)
                        )
                        {
                            return false;
                        }

                        if(
                            activeFilter.startsWith(
                                'tag:'
                            )
                        )
                        {
                            const wantedTag =
                                activeFilter.substring(
                                    4
                                );

                            const hasTag =
                                (
                                    itemMetadata?.tags ||
                                    []
                                ).some(
                                    tag =>
                                        normalizeSearch(
                                            tag
                                        ) ===
                                        wantedTag
                                );

                            if(!hasTag)
                            {
                                return false;
                            }
                        }

                        if(!query)
                        {
                            return true;
                        }

                        const typeName =
                            CLOTHING_TYPE_NAMES[
                                category.name
                            ] ||
                            'Prenda';

                        const haystack =
                            [
                                itemMetadata?.name ||
                                    '',
                                typeName,
                                category.name,
                                String(id),
                                ...(
                                    itemMetadata?.tags ||
                                    []
                                )
                            ].join(' ');

                        return (
                            normalizeSearch(
                                haystack
                            ).includes(
                                query
                            )
                        );
                    }
                );
            },
            [
                search,
                activeFilter,
                sortedParts,
                getMetadata,
                favoriteKey,
                favorites,
                category
            ]
        );

    useEffect(() =>
    {
        if(elementRef.current)
        {
            elementRef.current.scrollTop =
                0;
        }
    }, [
        category,
        search,
        activeFilter
    ]);

    if(
        !model ||
        !category
    )
    {
        return null;
    }

    return (
        <div className="biribiri-clothing-browser">
            { !isFromFootballGate &&
                <>
                    <div className="biribiri-clothing-filters">
                        <button
                            type="button"
                            className={
                                `biribiri-clothing-filter ${
                                    activeFilter === 'all'
                                        ? 'is-active'
                                        : ''
                                }`
                            }
                            onClick={
                                () =>
                                    setActiveFilter(
                                        'all'
                                    )
                            }>
                            Todos
                        </button>

                        <button
                            type="button"
                            className={
                                `biribiri-clothing-filter ${
                                    activeFilter === 'favorites'
                                        ? 'is-active'
                                        : ''
                                }`
                            }
                            onClick={
                                () =>
                                    setActiveFilter(
                                        'favorites'
                                    )
                            }>
                            Favoritos
                        </button>

                        { availableTags.map(
                            ([ normalized, label ]) =>
                                <button
                                    key={
                                        normalized
                                    }
                                    type="button"
                                    className={
                                        `biribiri-clothing-filter ${
                                            activeFilter ===
                                            `tag:${ normalized }`
                                                ? 'is-active'
                                                : ''
                                        }`
                                    }
                                    onClick={
                                        () =>
                                            setActiveFilter(
                                                `tag:${ normalized }`
                                            )
                                    }>
                                    { label }
                                </button>
                        ) }
                    </div>

                    <div className="biribiri-clothing-search-wrap">
                        <input
                            type="search"
                            className="form-control form-control-sm biribiri-clothing-search"
                            placeholder="Buscar por nombre, ID o tag..."
                            value={ search }
                            autoComplete="off"
                            spellCheck={ false }
                            onChange={
                                event =>
                                    setSearch(
                                        event.target.value
                                    )
                            }
                        />
                    </div>
                </> }

            <AutoGrid
                className="clothing-container"
                innerRef={ elementRef }
                columnCount={ 3 }
                columnMinHeight={ 50 }>
                { visibleParts.map(
                    entry =>
                    {
                        const item =
                            entry.item;

                        const id =
                            item.isClear
                                ? 0
                                : canonicalId(
                                    item.id
                                );

                        const itemMetadata =
                            item.isClear
                                ? null
                                : getMetadata(
                                    id
                                );

                        const typeName =
                            CLOTHING_TYPE_NAMES[
                                category.name
                            ] ||
                            'Prenda';

                        const displayName =
                            item.isClear
                                ? 'Quitar esta prenda'
                                : (
                                    itemMetadata?.name ||
                                    `${ typeName } \u00b7 ID ${ id }`
                                );

                        const tooltip =
                            itemMetadata?.name
                                ? (
                                    `${ itemMetadata.name } \u00b7 ID ${ id }` +
                                    (
                                        itemMetadata.tags.length
                                            ? `\nTags: ${ itemMetadata.tags.join(', ') }`
                                            : ''
                                    )
                                )
                                : displayName;

                        const key =
                            favoriteKey(
                                item
                            );

                        return (
                            <AvatarEditorFigureSetItemView
                                key={
                                    `${ category.name }:${ item.id }:${ entry.index }`
                                }
                                partItem={ item }
                                title={ tooltip }
                                isFavorite={
                                    !!key &&
                                    favorites.has(
                                        key
                                    )
                                }
                                onFavoriteToggle={
                                    item.isClear
                                        ? null
                                        : () =>
                                            toggleFavorite(
                                                item
                                            )
                                }
                                onClick={
                                    () =>
                                        selectPart(
                                            item
                                        )
                                }
                            />
                        );
                    }
                ) }
            </AutoGrid>
        </div>
    );
};
