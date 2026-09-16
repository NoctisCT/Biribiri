// BIRIBIRI_WARDROBE_COMMUNITY_C1
// BIRIBIRI_WARDROBE_COMMUNITY_C2_1
// BIRIBIRI_WARDROBE_COMMUNITY_C2_2
// BIRIBIRI_WARDROBE_COMMUNITY_C2_3
// BIRIBIRI_CLOTHING_OWNERSHIP_S1
// BIRIBIRI_WARDROBE_COMMUNITY_C2_3_2_2
// BIRIBIRI_WARDROBE_COMMUNITY_C2_3_3
import { ILinkEventTracker } from '@nitrots/nitro-renderer';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { FaEye, FaSave } from 'react-icons/fa';
import { MdClose, MdDeleteOutline, MdPublish } from 'react-icons/md';
import {
    AddEventLinkTracker,
    CreateLinkEvent,
    RemoveLinkEventTracker,
    SendMessageComposer
} from '../../api';
import {
    Base,
    Column,
    LayoutAvatarImageView,
    NitroCardContentView,
    NitroCardHeaderView,
    NitroCardView
} from '../../common';
import { useMessageEvent } from '../../hooks';
import {
    BiribiriCommunityActionComposer,
    BiribiriCommunityActionResultEvent,
    BiribiriCommunityFeedEvent,
    BiribiriCommunityFeedRequestComposer,
    BiribiriCommunityMineEvent,
    BiribiriCommunityMineOutfit,
    BiribiriCommunityMineRequestComposer,
    BiribiriCommunityMutationComposer,
    BiribiriCommunityMutationResultEvent,
    BiribiriCommunityOutfit,
    RegisterBiribiriCommunityMessages
} from '../../api/avatar/WardrobeCommunityMessages';
import './CommunityOutfitsView.scss';

type CommunityTab =
    'new' |
    'popular' |
    'cosplay' |
    'aesthetic' |
    'streetwear' |
    'elegant' |
    'fantasy' |
    'general';

const MUTATION_PUBLISH = 1;
const MUTATION_UNPUBLISH = 2;

const ACTION_LIKE = 1;
const ACTION_SAVE_COPY = 2;
const ACTION_UNPUBLISH = 3;

const tabMode = (tab: CommunityTab): number =>
{
    switch(tab)
    {
        case 'popular': return 1;
        case 'cosplay': return 2;
        case 'aesthetic': return 3;
        case 'streetwear': return 4;
        case 'elegant': return 5;
        case 'fantasy': return 6;
        case 'general': return 7;
        default: return 0;
    }
};

const categoryLabel = (category: string): string =>
{
    switch(category)
    {
        case 'cosplay': return 'Cosplay';
        case 'aesthetic': return 'Aesthetic';
        case 'streetwear': return 'Streetwear';
        case 'elegant': return 'Elegante';
        case 'fantasy': return 'Fantas\u00eda';
        default: return 'General';
    }
};

const mutationErrorText = (code: number): string =>
{
    switch(code)
    {
        case 2: return 'Ese espacio no es valido.';
        case 3: return 'Ese espacio no esta disponible.';
        case 4: return 'El look guardado ya no existe.';
        case 5: return 'La categoria no es valida.';
        case 7: return 'Este look contiene ropa que no tienes en tu armario.';
        default: return 'No se pudo completar la accion.';
    }
};

const actionErrorText = (code: number): string =>
{
    switch(code)
    {
        case 1: return 'Ese look ya no esta disponible.';
        case 2: return 'No tienes espacios libres en el vestidor.';
        case 3: return 'No tienes permiso para despublicar ese look.';
        case 4: return 'No se pudo completar la accion.';
        case 6: return 'No tienes toda la ropa de este look en tu armario.';
        default: return 'No se pudo completar la accion.';
    }
};

export const CommunityOutfitsView: FC<{}> = props =>
{
    RegisterBiribiriCommunityMessages();

    const [ isVisible, setIsVisible ] = useState(false);
    const [ activeTab, setActiveTab ] = useState<CommunityTab>('new');
    const [ items, setItems ] = useState<BiribiriCommunityOutfit[]>([]);
    const [ loading, setLoading ] = useState(false);
    const [ canModerate, setCanModerate ] = useState(false);

    const [ publishOpen, setPublishOpen ] = useState(false);
    const [ myLooks, setMyLooks ] = useState<BiribiriCommunityMineOutfit[]>([]);
    const [ myLooksLoading, setMyLooksLoading ] = useState(false);
    const [ selectedSlotId, setSelectedSlotId ] = useState(0);
    const [ selectedCategory, setSelectedCategory ] = useState('normal');
    const [ mutationBusy, setMutationBusy ] = useState(false);
    const [ notice, setNotice ] = useState('');

    const [ busyPublicationId, setBusyPublicationId ] = useState(0);
    const [ actionNotice, setActionNotice ] = useState('');

    const selectedLook = useMemo(
        () =>
            myLooks.find(item => item.slotId === selectedSlotId) || null,
        [ myLooks, selectedSlotId ]
    );

    const requestFeed = useCallback(
        (tab: CommunityTab) =>
        {
            setLoading(true);

            SendMessageComposer(
                new BiribiriCommunityFeedRequestComposer(
                    tabMode(tab),
                    0,
                    24
                )
            );
        },
        []
    );

    const requestMyLooks = useCallback(
        () =>
        {
            setMyLooksLoading(true);

            SendMessageComposer(
                new BiribiriCommunityMineRequestComposer()
            );
        },
        []
    );

    useMessageEvent<BiribiriCommunityFeedEvent>(
        BiribiriCommunityFeedEvent,
        event =>
        {
            const parser = event.getParser();

            setItems(parser.items);
            setCanModerate(parser.canModerate);
            setLoading(false);
        }
    );

    useMessageEvent<BiribiriCommunityMineEvent>(
        BiribiriCommunityMineEvent,
        event =>
        {
            const next = event.getParser().items;

            setMyLooks(next);
            setMyLooksLoading(false);

            setSelectedSlotId(previous =>
            {
                if(
                    previous > 0 &&
                    next.some(item => item.slotId === previous)
                ) return previous;

                return next.length ? next[0].slotId : 0;
            });
        }
    );

    useMessageEvent<BiribiriCommunityMutationResultEvent>(
        BiribiriCommunityMutationResultEvent,
        event =>
        {
            const parser = event.getParser();

            setMutationBusy(false);

            if(parser.success)
            {
                setNotice(
                    parser.action === MUTATION_UNPUBLISH
                        ? 'Look despublicado.'
                        : 'Look publicado.'
                );

                requestMyLooks();
                requestFeed(activeTab);
                return;
            }

            setNotice(mutationErrorText(parser.code));
        }
    );

    useMessageEvent<BiribiriCommunityActionResultEvent>(
        BiribiriCommunityActionResultEvent,
        event =>
        {
            const parser = event.getParser();

            setBusyPublicationId(0);

            if(!parser.success)
            {
                setActionNotice(actionErrorText(parser.code));
                return;
            }

            switch(parser.action)
            {
                case ACTION_LIKE:
                    setActionNotice(
                        parser.flag
                            ? 'Te gusta este look.'
                            : 'Like retirado.'
                    );
                    break;

                case ACTION_SAVE_COPY:
                    setActionNotice(
                        `Copia guardada en el espacio ${ parser.value }.`
                    );
                    break;

                case ACTION_UNPUBLISH:
                    setActionNotice('Look despublicado.');
                    break;
            }

            requestFeed(activeTab);
        }
    );

    useEffect(
        () =>
        {
            const linkTracker: ILinkEventTracker = {
                linkReceived: (url: string) =>
                {
                    const parts = url.split('/');

                    if(parts.length < 2) return;

                    switch(parts[1])
                    {
                        case 'show':
                            setIsVisible(true);
                            requestFeed(activeTab);
                            return;

                        case 'hide':
                            setIsVisible(false);
                            setPublishOpen(false);
                            return;

                        case 'toggle':
                            setIsVisible(previous =>
                            {
                                const next = !previous;

                                if(next)
                                {
                                    requestFeed(activeTab);
                                }
                                else
                                {
                                    setPublishOpen(false);
                                }

                                return next;
                            });
                            return;
                    }
                },
                eventUrlPrefix: 'community-outfits/'
            };

            AddEventLinkTracker(linkTracker);

            return () => RemoveLinkEventTracker(linkTracker);
        },
        [ activeTab, requestFeed ]
    );

    useEffect(
        () =>
        {
            if(!selectedLook) return;

            setSelectedCategory(
                selectedLook.published && selectedLook.category
                    ? selectedLook.category
                    : 'normal'
            );
        },
        [ selectedLook ]
    );

    const selectTab = (tab: CommunityTab) =>
    {
        setActiveTab(tab);
        setActionNotice('');
        requestFeed(tab);
    };

    const openPublish = () =>
    {
        setNotice('');
        setPublishOpen(true);
        requestMyLooks();
    };

    const publishSelected = () =>
    {
        if(!selectedLook || mutationBusy) return;

        setMutationBusy(true);
        setNotice('');

        SendMessageComposer(
            new BiribiriCommunityMutationComposer(
                MUTATION_PUBLISH,
                selectedLook.slotId,
                selectedCategory
            )
        );
    };

    const unpublishSelected = () =>
    {
        if(
            !selectedLook ||
            !selectedLook.published ||
            mutationBusy
        ) return;

        setMutationBusy(true);
        setNotice('');

        SendMessageComposer(
            new BiribiriCommunityMutationComposer(
                MUTATION_UNPUBLISH,
                selectedLook.slotId,
                ''
            )
        );
    };

    const toggleLike = (item: BiribiriCommunityOutfit) =>
    {
        if(busyPublicationId) return;

        setBusyPublicationId(item.id);
        setActionNotice('');

        SendMessageComposer(
            new BiribiriCommunityActionComposer(
                ACTION_LIKE,
                item.id
            )
        );
    };

    const saveCopy = (item: BiribiriCommunityOutfit) =>
    {
        if(busyPublicationId) return;

        setBusyPublicationId(item.id);
        setActionNotice('');

        SendMessageComposer(
            new BiribiriCommunityActionComposer(
                ACTION_SAVE_COPY,
                item.id
            )
        );
    };

    const tryLook = (item: BiribiriCommunityOutfit) =>
    {
        window.sessionStorage.setItem(
            'biribiri.community.preview',
            JSON.stringify({
                figure: item.look,
                gender: item.gender
            })
        );

        setActionNotice(
            'Vista previa abierta en el editor.'
        );

        CreateLinkEvent('avatar-editor/community-preview');
    };

    const unpublishCard = (item: BiribiriCommunityOutfit) =>
    {
        if(busyPublicationId) return;

        let reason = '';

        if(!item.isOwn)
        {
            const value = window.prompt(
                'Motivo de moderacion (opcional):',
                ''
            );

            if(value === null) return;

            reason = value;
        }

        if(
            !window.confirm(
                item.isOwn
                    ? 'Despublicar este look?'
                    : 'Despublicar este look como moderador?'
            )
        ) return;

        setBusyPublicationId(item.id);
        setActionNotice('');

        SendMessageComposer(
            new BiribiriCommunityActionComposer(
                ACTION_UNPUBLISH,
                item.id,
                reason
            )
        );
    };

    if(!isVisible) return null;

    return (
        <NitroCardView
            uniqueKey="community-outfits"
            className="nitro-community-outfits"
            theme="primary-slim">
            <NitroCardHeaderView
                headerText="Comunidad"
                onCloseClick={ () =>
                {
                    setIsVisible(false);
                    setPublishOpen(false);
                } } />

            <NitroCardContentView
                gap={ 2 }
                overflow="hidden">
                <div className="community-showcase-header">
                    <div className="community-showcase-copy">

                        <strong>
                            Looks de la comunidad
                        </strong>

                        <span>
                            Prueba estilos, guarda tus favoritos y comparte los tuyos.
                        </span>
                    </div>

                    <div className="community-showcase-heart">
                        <Base className="icon icon-sign-heart" />
                    </div>
                </div>

                <Base className="community-outfits-topbar">
                    <Base className="community-outfits-tabs">
                        <button
                            type="button"
                            className={ `community-tab tab-new${ activeTab === 'new' ? ' is-active' : '' }` }
                            onClick={ () => selectTab('new') }>
                            Nuevos
                        </button>

                        <button
                            type="button"
                            className={ `community-tab tab-popular${ activeTab === 'popular' ? ' is-active' : '' }` }
                            onClick={ () => selectTab('popular') }>
                            Populares
                        </button>

                        <button
                            type="button"
                            className={ `community-tab tab-general${ activeTab === 'general' ? ' is-active' : '' }` }
                            onClick={ () => selectTab('general') }>
                            General
                        </button>

                        <button
                            type="button"
                            className={ `community-tab tab-cosplay${ activeTab === 'cosplay' ? ' is-active' : '' }` }
                            onClick={ () => selectTab('cosplay') }>
                            Cosplay
                        </button>

                        <button
                            type="button"
                            className={ `community-tab tab-aesthetic${ activeTab === 'aesthetic' ? ' is-active' : '' }` }
                            onClick={ () => selectTab('aesthetic') }>
                            Aesthetic
                        </button>

                        <button
                            type="button"
                            className={ `community-tab tab-streetwear${ activeTab === 'streetwear' ? ' is-active' : '' }` }
                            onClick={ () => selectTab('streetwear') }>
                            Streetwear
                        </button>

                        <button
                            type="button"
                            className={ `community-tab tab-elegant${ activeTab === 'elegant' ? ' is-active' : '' }` }
                            onClick={ () => selectTab('elegant') }>
                            Elegante
                        </button>

                        <button
                            type="button"
                            className={ `community-tab tab-fantasy${ activeTab === 'fantasy' ? ' is-active' : '' }` }
                            onClick={ () => selectTab('fantasy') }>
                            { 'Fantas\u00eda' }
                        </button>
                    </Base>

                    <Base className="community-outfits-actions">
                        { canModerate &&
                            <span
                                className="community-outfits-mod-badge"
                                title={ 'Herramientas de moderaci\u00f3n disponibles' }>
                                MOD
                            </span> }

                        <button
                            type="button"
                            className="community-outfits-publish-open"
                            onClick={ openPublish }>
                            <MdPublish />
                            <span>Publicar look</span>
                        </button>
                    </Base>
                </Base>

                { actionNotice &&
                    <div className="community-action-notice">
                        <Base className="icon icon-sign-heart" />
                        <span>{ actionNotice }</span>
                    </div> }

                <Column
                    fullHeight
                    className="community-outfits-feed">
                    { loading &&
                        <div className="community-outfits-loading">
                            <div className="community-loading-card" />
                            <div className="community-loading-card" />
                            <div className="community-loading-card" />
                        </div> }

                    { !loading &&
                        items.length === 0 &&
                        <div className="community-outfits-state">
                            <div className="community-empty-icon">
                                <Base className="icon icon-sign-heart" />
                            </div>

                            <strong>
                                { 'A\u00fan no hay looks publicados.' }
                            </strong>

                            <span>
                                { 'S\u00e9 el primero en compartir un look.' }
                            </span>

                            <button
                                type="button"
                                onClick={ openPublish }>
                                <MdPublish />
                                Publicar mi primer look
                            </button>
                        </div> }

                    { !loading &&
                        items.length > 0 &&
                        <div className="community-outfits-grid">
                            { items.map(item =>
                            {
                                const busy =
                                    busyPublicationId === item.id;

                                const category =
                                    item.category || 'normal';

                                return (
                                    <article
                                        key={ item.id }
                                        className={
                                            `community-outfit-card category-${ category }`
                                        }>
                                        <div className="community-outfit-preview">
                                            <div className="community-outfit-card-top">
                                                <span className="community-category-chip">
                                                    { categoryLabel(category) }
                                                </span>

                                                <button
                                                    type="button"
                                                    className={
                                                        `community-like-bubble${ item.myLike ? ' is-liked' : '' }`
                                                    }
                                                    title={ item.myLike ? 'Quitar like' : 'Me gusta' }
                                                    disabled={ busy }
                                                    onClick={ () => toggleLike(item) }>
                                                    <Base className="icon icon-sign-heart" />
                                                    <span>{ item.likes }</span>
                                                </button>
                                            </div>

                                            <div className="community-outfit-avatar">
                                                <LayoutAvatarImageView
                                                    figure={ item.look }
                                                    gender={ item.gender }
                                                    direction={ 2 } />
                                            </div>

                                            <div className="community-preview-glow" />
                                        </div>

                                        <div className="community-outfit-info">
                                            <strong title={ item.name }>
                                                { item.name || `Look ${ item.id }` }
                                            </strong>

                                            <span className="community-outfit-author">
                                                <Base className="icon icon-user" />
                                                <span>
                                                    { item.username }
                                                </span>
                                            </span>
                                        </div>

                                        <div className="community-outfit-card-actions">
                                            <button
                                                type="button"
                                                className="is-primary"
                                                title="Probar"
                                                disabled={ busy }
                                                onClick={ () => tryLook(item) }>
                                                <FaEye />
                                                <span>Probar</span>
                                            </button>

                                            <button
                                                type="button"
                                                className="is-save"
                                                title="Guardar copia"
                                                disabled={ busy }
                                                onClick={ () => saveCopy(item) }>
                                                <FaSave />
                                                <span>Guardar</span>
                                            </button>

                                            { (item.isOwn || canModerate) &&
                                                <button
                                                    type="button"
                                                    className="is-danger"
                                                    title="Despublicar"
                                                    disabled={ busy }
                                                    onClick={ () => unpublishCard(item) }>
                                                    <MdDeleteOutline />
                                                </button> }
                                        </div>
                                    </article>
                                );
                            }) }
                        </div> }
                </Column>

                { publishOpen &&
                    <div className="community-publish-overlay">
                        <div className="community-publish-panel">
                            <div className="community-publish-header">
                                <div>
                                    <span className="community-publish-kicker">
                                        COMPARTE TU ESTILO
                                    </span>

                                    <strong>Publicar look</strong>

                                    <span>
                                        Elige uno de tus looks guardados.
                                    </span>
                                </div>

                                <button
                                    type="button"
                                    className="community-publish-close"
                                    onClick={ () => setPublishOpen(false) }>
                                    <MdClose />
                                </button>
                            </div>

                            <div className="community-publish-body">
                                <div className="community-publish-look-list">
                                    { myLooksLoading &&
                                        <div className="community-publish-empty">
                                            Cargando tu vestidor...
                                        </div> }

                                    { !myLooksLoading &&
                                        myLooks.length === 0 &&
                                        <div className="community-publish-empty">
                                            No tienes looks guardados disponibles.
                                        </div> }

                                    { !myLooksLoading &&
                                        myLooks.map(item =>
                                        {
                                            const selected =
                                                selectedSlotId === item.slotId;

                                            return (
                                                <button
                                                    key={ item.slotId }
                                                    type="button"
                                                    className={
                                                        `community-publish-look${ selected ? ' is-selected' : '' }`
                                                    }
                                                    onClick={ () => setSelectedSlotId(item.slotId) }>
                                                    <div className="community-publish-look-avatar">
                                                        <LayoutAvatarImageView
                                                            figure={ item.look }
                                                            gender={ item.gender }
                                                            direction={ 2 } />
                                                    </div>

                                                    <span
                                                        className="community-publish-look-name"
                                                        title={ item.name }>
                                                        { item.name }
                                                    </span>

                                                    <small>
                                                        Espacio { item.slotId }
                                                    </small>

                                                    { item.published &&
                                                        <span className="community-published-badge">
                                                            Publicado
                                                        </span> }
                                                </button>
                                            );
                                        }) }
                                </div>

                                <div className="community-publish-settings">
                                    { selectedLook &&
                                        <>
                                            <div className="community-publish-selected">
                                                <div className="community-publish-selected-avatar">
                                                    <LayoutAvatarImageView
                                                        figure={ selectedLook.look }
                                                        gender={ selectedLook.gender }
                                                        direction={ 2 } />
                                                </div>

                                                <div>
                                                    <strong>{ selectedLook.name }</strong>
                                                    <span>
                                                        Espacio { selectedLook.slotId }
                                                    </span>
                                                </div>
                                            </div>

                                            <label htmlFor="community-category">
                                                { 'Categor\u00eda' }
                                            </label>

                                            <select
                                                id="community-category"
                                                value={ selectedCategory }
                                                onChange={ event =>
                                                    setSelectedCategory(event.target.value)
                                                }>
                                                <option value="normal">General</option>
                                                <option value="cosplay">Cosplay</option>
                                                <option value="aesthetic">Aesthetic</option>
                                                <option value="streetwear">Streetwear</option>
                                                <option value="elegant">Elegante</option>
                                                <option value="fantasy">
                                                    { 'Fantas\u00eda' }
                                                </option>
                                            </select>

                                            { notice &&
                                                <div className="community-publish-notice">
                                                    { notice }
                                                </div> }

                                            <div className="community-publish-buttons">
                                                <button
                                                    type="button"
                                                    disabled={ mutationBusy }
                                                    onClick={ publishSelected }>
                                                    {
                                                        selectedLook.published
                                                            ? 'Actualizar'
                                                            : 'Publicar'
                                                    }
                                                </button>

                                                { selectedLook.published &&
                                                    <button
                                                        type="button"
                                                        className="is-danger"
                                                        disabled={ mutationBusy }
                                                        onClick={ unpublishSelected }>
                                                        Despublicar
                                                    </button> }
                                            </div>
                                        </> }
                                </div>
                            </div>
                        </div>
                    </div> }
            </NitroCardContentView>
        </NitroCardView>
    );
};
