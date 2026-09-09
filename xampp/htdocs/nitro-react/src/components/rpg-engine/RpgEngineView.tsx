import {
    ILinkEventTracker,
    RpgEngineContext,
    RpgEngineProject,
    RpgEngineSheetField,
    RpgEngineSheetFieldType,
    RpgEngineSheetTemplate
} from '@nitrots/nitro-renderer';
import { CSSProperties, FC, useEffect, useMemo, useRef, useState } from 'react';
import {
    FaArrowDown,
    FaArrowUp,
    FaChevronLeft,
    FaChevronRight,
    FaCog,
    FaEdit,
    FaFileAlt,
    FaFolderOpen,
    FaMapMarkerAlt,
    FaPlus,
    FaSave,
    FaTrash,
    FaUserCircle
} from 'react-icons/fa';
import { AddEventLinkTracker, RemoveLinkEventTracker } from '../../api';
import { Button, NitroCardContentView, NitroCardHeaderView, NitroCardView } from '../../common';
import {
    createDefaultCharacterDesign,
    RpgCharacterDesign,
    RpgCharacterDesignEditor,
    RpgCharacterStyledSheet
} from './RpgCharacterStyledSheet';
import './RpgEngineView.scss';

type Page =
    'home' |
    'create' |
    'projects' |
    'project' |
    'player-sheet' |
    'players' |
    'other-sheet' |
    'sheet-design' |
    'admin' |
    'sheet-builder';

type RequestState =
    'unknown' |
    'none' |
    'pending' |
    'approved' |
    'rejected' |
    'consumed' |
    'admin';

interface RpgAccess
{
    id: number;
    name: string;
    ownerUserId: number;
    groupId: number;
    groupName: string | null;
    groupBadge: string | null;
    groupLevel: number;
    canAdmin: boolean;
    access: 'owner' | 'member';
}

interface ManageableGroup
{
    id: number;
    name: string;
    badge: string | null;
    ownerUserId: number;
    level: number;
    linkedRpgId: number;
}

interface CharacterSummary
{
    characterId: number;
    userId: number;
    username: string;
    updatedAtEpoch: number;
}

interface CharacterValue
{
    fieldId: number;
    value: string;
}

interface CharacterData
{
    id: number;
    rpgId: number;
    userId: number;
    username: string;
    createdAtEpoch: number;
    updatedAtEpoch: number;
    values: CharacterValue[];
}

interface FieldDraft
{
    id: number;
    sectionId: number;
    label: string;
    fieldType: RpgEngineSheetFieldType;
    required: boolean;
    visibility: string;
    controlMode: string;
    optionsText: string;
}

const FIELD_TYPES: Array<{ value: RpgEngineSheetFieldType; label: string; help: string }> = [
    { value: 'text', label: 'Texto', help: 'Nombre, raza, rango manual...' },
    { value: 'long_text', label: 'Texto largo', help: 'Historia, personalidad, descripción...' },
    { value: 'number', label: 'Número', help: 'Edad u otro valor numérico manual.' },
    { value: 'image', label: 'Imagen', help: 'Retrato, apariencia o imagen del personaje.' },
    { value: 'date', label: 'Fecha', help: 'Fecha de ingreso, nacimiento u otra fecha.' },
    { value: 'select', label: 'Lista de opciones', help: 'El jugador elige entre opciones que tú defines.' },
    { value: 'yes_no', label: 'Sí / No', help: 'Una opción sencilla de sí o no.' }
];

const VISIBILITIES = [
    { value: 'public', label: 'Todos' },
    { value: 'members', label: 'Solo jugadores del RPG' },
    { value: 'owner', label: 'Solo el propietario de la ficha' },
    { value: 'staff', label: 'Solo administradores del RPG' }
];

const CONTROL_MODES = [
    { value: 'player', label: 'El jugador' },
    { value: 'staff', label: 'Los administradores del RPG' },
    { value: 'engine', label: 'RPGEngine automáticamente' }
];

const S: Record<string, CSSProperties> = {
    window: {
        width: '680px',
        minWidth: '680px',
        maxWidth: 'calc(100vw - 24px)'
    },
    content: {
        minHeight: '410px',
        maxHeight: '76vh',
        overflowY: 'auto',
        padding: '14px',
        color: '#222'
    },
    page: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        width: '100%'
    },
    topbar: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px'
    },
    heading: {
        display: 'flex',
        flexDirection: 'column',
        gap: '3px',
        minWidth: 0
    },
    title: {
        fontSize: '22px',
        lineHeight: 1.08,
        fontWeight: 800
    },
    subtitle: {
        fontSize: '12px',
        lineHeight: 1.4,
        opacity: 0.68
    },
    hero: {
        border: '1px solid rgba(0,0,0,.18)',
        borderRadius: '7px',
        background: 'rgba(255,255,255,.77)',
        padding: '14px'
    },
    eyebrow: {
        fontSize: '10px',
        fontWeight: 800,
        textTransform: 'uppercase',
        opacity: 0.52,
        letterSpacing: '.4px',
        marginBottom: '4px'
    },
    grid2: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '10px'
    },
    actionCard: {
        minHeight: '112px',
        border: '1px solid rgba(0,0,0,.22)',
        borderRadius: '7px',
        background: '#fff',
        padding: '14px',
        display: 'flex',
        alignItems: 'center',
        gap: '13px',
        textAlign: 'left',
        cursor: 'pointer',
        color: '#222'
    },
    iconBox: {
        width: '42px',
        height: '42px',
        flex: '0 0 42px',
        borderRadius: '6px',
        border: '1px solid rgba(0,0,0,.14)',
        background: 'rgba(0,0,0,.045)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '19px'
    },
    actionBody: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        minWidth: 0
    },
    actionTitle: {
        fontSize: '15px',
        fontWeight: 800
    },
    actionText: {
        fontSize: '11px',
        lineHeight: 1.35,
        opacity: 0.66
    },
    panel: {
        border: '1px solid rgba(0,0,0,.18)',
        borderRadius: '7px',
        background: 'rgba(255,255,255,.74)',
        padding: '12px'
    },
    row: {
        width: '100%',
        minHeight: '58px',
        border: '1px solid rgba(0,0,0,.20)',
        borderRadius: '6px',
        background: '#fff',
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
        color: '#222'
    },
    rowLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        minWidth: 0
    },
    rowText: {
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        minWidth: 0
    },
    rowName: {
        fontSize: '14px',
        fontWeight: 800
    },
    rowMeta: {
        fontSize: '10px',
        opacity: 0.6,
        lineHeight: 1.35
    },
    field: {
        display: 'flex',
        flexDirection: 'column',
        gap: '5px'
    },
    label: {
        fontSize: '11px',
        fontWeight: 800
    },
    sectionCard: {
        border: '1px solid rgba(0,0,0,.22)',
        borderRadius: '7px',
        background: 'rgba(255,255,255,.84)',
        overflow: 'hidden'
    },
    sectionHeader: {
        padding: '10px 11px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '10px',
        background: 'rgba(0,0,0,.035)',
        borderBottom: '1px solid rgba(0,0,0,.12)'
    },
    sectionBody: {
        padding: '9px',
        display: 'flex',
        flexDirection: 'column',
        gap: '7px'
    },
    miniButtons: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        flexWrap: 'wrap'
    },
    iconButton: {
        width: '29px',
        height: '27px',
        borderRadius: '4px',
        border: '1px solid rgba(0,0,0,.18)',
        background: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer'
    },
    fieldRow: {
        border: '1px solid rgba(0,0,0,.14)',
        borderRadius: '5px',
        padding: '8px 9px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
        background: '#fff'
    },
    badge: {
        display: 'inline-block',
        padding: '2px 6px',
        borderRadius: '10px',
        background: 'rgba(0,0,0,.07)',
        fontSize: '9px',
        marginRight: '4px'
    },
    formBox: {
        border: '1px solid rgba(0,0,0,.2)',
        borderRadius: '7px',
        background: '#fff',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
    },
    message: {
        padding: '8px 10px',
        borderRadius: '5px',
        background: 'rgba(0,0,0,.045)',
        fontSize: '11px',
        lineHeight: 1.35
    },
    empty: {
        minHeight: '105px',
        border: '1px dashed rgba(0,0,0,.25)',
        borderRadius: '6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '15px',
        fontSize: '11px',
        opacity: 0.65
    },
    characterHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
    },
    avatarPlaceholder: {
        width: '58px',
        height: '58px',
        flex: '0 0 58px',
        borderRadius: '8px',
        border: '1px solid rgba(0,0,0,.16)',
        background: 'rgba(0,0,0,.04)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '31px',
        opacity: 0.65
    },
    sheetValue: {
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        fontSize: '12px',
        lineHeight: 1.45
    },
    sheetFieldDisplay: {
        borderBottom: '1px solid rgba(0,0,0,.08)',
        padding: '7px 2px'
    }
};

const requestStateFromMessage = (message: string): RequestState =>
{
    switch(message)
    {
        case 'request-none': return 'none';
        case 'request-pending': return 'pending';
        case 'request-approved': return 'approved';
        case 'request-rejected': return 'rejected';
        case 'request-consumed': return 'consumed';
        case 'request-admin': return 'admin';
        default: return 'unknown';
    }
};

const fieldTypeLabel = (type: string) =>
    FIELD_TYPES.find(item => item.value === type)?.label ?? type;

const visibilityLabel = (value: string) =>
    VISIBILITIES.find(item => item.value === value)?.label ?? value;

const controlLabel = (value: string) =>
    CONTROL_MODES.find(item => item.value === value)?.label ?? value;

const blankField = (sectionId: number): FieldDraft => ({
    id: 0,
    sectionId,
    label: '',
    fieldType: 'text',
    required: false,
    visibility: 'public',
    controlMode: 'player',
    optionsText: ''
});

const rpgAccessPayload = (message: string): RpgAccess[] | undefined =>
{
    try
    {
        const parsed = JSON.parse(message);
        return Array.isArray(parsed?.rpgs) ? parsed.rpgs : undefined;
    }
    catch
    {
        return undefined;
    }
};

const manageableGroupsPayload = (message: string): ManageableGroup[] | undefined =>
{
    try
    {
        const parsed = JSON.parse(message);
        return Array.isArray(parsed?.groups) ? parsed.groups : undefined;
    }
    catch
    {
        return undefined;
    }
};

const characterListPayload = (message: string): CharacterSummary[] | undefined =>
{
    try
    {
        const parsed = JSON.parse(message);
        return Array.isArray(parsed?.characters)
            ? parsed.characters
            : [];
    }
    catch
    {
        return undefined;
    }
};

const designPayload = (message: string): RpgCharacterDesign | undefined =>
{
    try
    {
        const parsed = JSON.parse(message);
        return parsed?.design ?? undefined;
    }
    catch
    {
        return undefined;
    }
};

const characterPayload = (message: string): CharacterData | null | undefined =>
{
    try
    {
        const parsed = JSON.parse(message);
        return parsed?.character ?? null;
    }
    catch
    {
        return undefined;
    }
};

const optionsFor = (field: RpgEngineSheetField): string[] =>
    String(field.optionsText ?? '')
        .split(/\r?\n/)
        .map(option => option.trim())
        .filter(Boolean);

const visibleToPlayer = (field: RpgEngineSheetField) =>
    field.visibility !== 'staff';

const editableByPlayer = (field: RpgEngineSheetField) =>
    visibleToPlayer(field) && field.controlMode === 'player';

export const RpgEngineView: FC<{}> = props =>
{
    const [ isVisible, setIsVisible ] = useState(false);
    const [ page, setPage ] = useState<Page>('home');

    const [ projects, setProjects ] = useState<RpgEngineProject[]>([]);
    const [ currentContext, setCurrentContext ] = useState<RpgEngineContext>(null);
    const [ rpgAccess, setRpgAccess ] = useState<RpgAccess[]>([]);
    const [ manageableGroups, setManageableGroups ] = useState<ManageableGroup[]>([]);
    const [ groupChoice, setGroupChoice ] = useState(0);

    const [ selectedRpgId, setSelectedRpgId ] = useState(0);
    const [ selectedRpgName, setSelectedRpgName ] = useState('');
    const [ selectedRpgOwnerId, setSelectedRpgOwnerId ] = useState(0);
    const [ selectedAsAdmin, setSelectedAsAdmin ] = useState(false);

    const [ requestState, setRequestState ] = useState<RequestState>('unknown');
    const [ projectName, setProjectName ] = useState('');
    const [ reason, setReason ] = useState('');
    const [ message, setMessage ] = useState('');

    const [ sheetTemplate, setSheetTemplate ] = useState<RpgEngineSheetTemplate>(null);
    const [ sectionEditorId, setSectionEditorId ] = useState<number | null>(null);
    const [ sectionTitle, setSectionTitle ] = useState('');
    const [ fieldDraft, setFieldDraft ] = useState<FieldDraft>(null);

    const [ character, setCharacter ] = useState<CharacterData | null | undefined>(undefined);

    const [ players, setPlayers ] = useState<CharacterSummary[] | undefined>(undefined);
    const [ viewedCharacter, setViewedCharacter ] = useState<CharacterData | null | undefined>(undefined);
    const [ viewedValues, setViewedValues ] = useState<Record<number, string>>({});
    const [ viewedUserId, setViewedUserId ] = useState(0);
    const [ editingAdminFields, setEditingAdminFields ] = useState(false);

    const [ ownDesign, setOwnDesign ] = useState<RpgCharacterDesign | undefined>(undefined);
    const [ viewedDesign, setViewedDesign ] = useState<RpgCharacterDesign | undefined>(undefined);
    const designTargetRef = useRef<'own' | 'view'>('own');
    const [ characterValues, setCharacterValues ] = useState<Record<number, string>>({});
    const [ editingCharacter, setEditingCharacter ] = useState(false);

    const lastResponseSignature = useRef('');

    const engine = () => (globalThis as any).RPGEngine;

    const selectedProject = useMemo(
        () => projects.find(project => project.id === selectedRpgId) ?? null,
        [ projects, selectedRpgId ]
    );

    const selectedAccess = useMemo(
        () => rpgAccess.find(rpg => rpg.id === selectedRpgId) ?? null,
        [ rpgAccess, selectedRpgId ]
    );

    const refreshRoot = () =>
    {
        engine()?.projects?.();
        engine()?.rpgAccess?.();
        engine()?.requestStatus?.();
        engine()?.context?.();
    };

    const refreshSheet = () =>
    {
        if(selectedRpgId > 0)
            engine()?.sheetTemplate?.(selectedRpgId);
    };

    const openPlayers = () =>
    {
        lastResponseSignature.current = '';
        setPlayers(undefined);
        setMessage('');
        setPage('players');

        if(selectedRpgId > 0)
            engine()?.characterList?.(selectedRpgId);
    };

    const openOtherCharacter = (targetUserId: number) =>
    {
        lastResponseSignature.current = '';
        setViewedUserId(targetUserId);
        setViewedCharacter(undefined);
        setViewedDesign(undefined);
        setViewedValues({});
        setEditingAdminFields(false);
        setMessage('');
        setPage('other-sheet');

        if(selectedRpgId > 0 && targetUserId > 0)
            engine()?.characterGet?.(selectedRpgId, targetUserId);
    };

    const loadMyCharacter = () =>
    {
        // La misma ficha puede devolver exactamente la misma respuesta varias veces.
        // Forzamos a la UI a procesar de nuevo la próxima respuesta ACTION 45.
        lastResponseSignature.current = '';

        setCharacter(undefined);
        setEditingCharacter(false);
        setMessage('');

        if(selectedRpgId > 0)
            engine()?.characterMine?.(selectedRpgId);
    };

    useEffect(() =>
    {
        const linkTracker: ILinkEventTracker = {
            linkReceived: (url: string) =>
            {
                const parts = url.split('/');

                if(parts.length < 2) return;

                if(parts[1] === 'hide')
                {
                    setIsVisible(false);
                    return;
                }

                if(parts[1] === 'show' || parts[1] === 'toggle')
                {
                    setIsVisible(prev =>
                    {
                        const next = parts[1] === 'show' ? true : !prev;

                        if(next)
                        {
                            setPage('home');
                            window.setTimeout(refreshRoot, 0);
                        }

                        return next;
                    });
                }
            },
            eventUrlPrefix: 'rpg-engine/'
        };

        AddEventLinkTracker(linkTracker);
        return () => RemoveLinkEventTracker(linkTracker);
    }, []);

    useEffect(() =>
    {
        if(!isVisible) return;

        const timer = window.setInterval(() =>
        {
            const api = engine();
            if(!api?.state) return;

            const state = api.state();

            setProjects(state?.projects ?? []);
            setCurrentContext(state?.context ?? null);

            if(state?.sheetTemplate)
                setSheetTemplate(state.sheetTemplate);

            const response = state?.lastResponse;
            if(!response) return;

            const signature =
                `${ response.action }:${ response.success }:${ response.message }:` +
                `${ response.projects?.length ?? 0 }:${ response.sheetTemplate?.sections?.length ?? -1 }`;

            if(signature === lastResponseSignature.current) return;
            lastResponseSignature.current = signature;

            if(response.action === 35 && response.success)
            {
                const next = requestStateFromMessage(response.message);
                if(next !== 'unknown') setRequestState(next);
            }

            if(response.action === 34)
            {
                setMessage(response.success
                    ? 'Solicitud enviada. Queda pendiente de revisión.'
                    : response.message);

                if(response.success)
                {
                    setRequestState('pending');
                    window.setTimeout(() => engine()?.requestStatus?.(), 100);
                }
            }

            if(response.action === 1 && response.success)
            {
                setMessage('RPG creado correctamente.');
                setProjectName('');
                setReason('');
                setPage('projects');
                window.setTimeout(refreshRoot, 100);
            }

            if(response.action >= 38 && response.action <= 44)
            {
                setMessage(response.success ? '' : response.message);

                if(response.success && response.sheetTemplate)
                    setSheetTemplate(response.sheetTemplate);
            }

            if(response.action === 47 && response.success)
            {
                const next = rpgAccessPayload(response.message);

                if(next !== undefined)
                    setRpgAccess(next);
            }

            if(response.action === 48 && response.success)
            {
                const next = manageableGroupsPayload(response.message);

                if(next !== undefined)
                    setManageableGroups(next);
            }

            if(response.action === 49 || response.action === 50)
            {
                if(response.success)
                {
                    const next = rpgAccessPayload(response.message);

                    if(next !== undefined)
                        setRpgAccess(next);

                    setMessage(
                        response.action === 49
                            ? 'Grupo vinculado correctamente.'
                            : 'Grupo desvinculado correctamente.'
                    );

                    window.setTimeout(() =>
                    {
                        engine()?.rpgAccess?.();
                        engine()?.manageableGroups?.();
                    }, 80);
                }
                else
                {
                    const friendly: Record<string, string> = {
                        'group-manage-required':
                            'Solo puedes vincular un grupo que administres.',
                        'group-already-linked':
                            'Ese grupo ya está vinculado a otro RPG.',
                        'rpg-owner-required':
                            'Solo el propietario del RPG puede cambiar su grupo.',
                        'invalid-group':
                            'Selecciona un grupo válido.'
                    };

                    setMessage(friendly[response.message] ?? response.message);
                }
            }

            if(response.action === 51)
            {
                if(!response.success)
                {
                    setMessage(response.message);
                }
                else
                {
                    const list = characterListPayload(response.message);

                    if(list !== undefined)
                    {
                        setPlayers(list);
                        setMessage('');
                    }
                }
            }

            if(response.action === 52 ||
               response.action === 53)
            {
                if(!response.success)
                {
                    const friendly: Record<string, string> = {
                        'character-not-found': 'Este jugador todavía no tiene ficha.',
                        'rpg-admin-required': 'No tienes permisos para administrar esta ficha.',
                        'sheet-field-not-staff-editable':
                            'Ese campo no está configurado para ser modificado por la administración.',
                        'sheet-invalid-number':
                            'Uno de los campos numéricos no contiene un número válido.',
                        'sheet-invalid-date':
                            'Una de las fechas no es válida.',
                        'sheet-invalid-option':
                            'Una de las opciones seleccionadas ya no existe.'
                    };

                    setMessage(friendly[response.message] ?? response.message);
                }
                else
                {
                    if(response.sheetTemplate)
                        setSheetTemplate(response.sheetTemplate);

                    const nextCharacter = characterPayload(response.message);

                    if(nextCharacter !== undefined)
                    {
                        setViewedCharacter(nextCharacter);

                        if(nextCharacter)
                        {
                            designTargetRef.current = 'view';
                            engine()?.characterDesignGet?.(
                                nextCharacter.rpgId,
                                nextCharacter.userId
                            );
                        }
                        else
                        {
                            setViewedDesign(undefined);
                        }

                        const values: Record<number, string> = {};

                        for(const entry of nextCharacter?.values ?? [])
                            values[entry.fieldId] = entry.value ?? '';

                        setViewedValues(values);
                        setEditingAdminFields(false);

                        setMessage(
                            response.action === 53
                                ? 'Cambios de administración guardados.'
                                : ''
                        );
                    }
                }
            }

            if(response.action === 54 ||
               response.action === 55)
            {
                if(!response.success)
                {
                    const friendly: Record<string, string> = {
                        'character-not-found':
                            'Necesitas una ficha antes de poder personalizarla.',
                        'sheet-design-invalid-url':
                            'Las imágenes de diseño deben usar una URL http o https.',
                        'sheet-design-url-too-long':
                            'Una de las URLs del diseño es demasiado larga.',
                        'sheet-design-missing-blocks':
                            'La estructura de la plantilla ha cambiado. Vuelve a abrir el diseñador.'
                    };

                    setMessage(friendly[response.message] ?? response.message);
                }
                else
                {
                    const nextDesign = designPayload(response.message);

                    if(nextDesign)
                    {
                        if(response.action === 55 ||
                           designTargetRef.current === 'own')
                            setOwnDesign(nextDesign);
                        else
                            setViewedDesign(nextDesign);

                        if(response.action === 55)
                        {
                            setMessage('Diseño guardado correctamente.');
                            setPage('player-sheet');
                        }
                    }
                }
            }

            if(response.action === 45 || response.action === 46)
            {
                if(!response.success)
                {
                    const friendly: Record<string, string> = {
                        'character-create-requires-rpg-room':
                            'Para crear tu primera ficha debes estar dentro de una sala registrada de este RPG.',
                        'sheet-template-empty':
                            'Este RPG todavía no tiene campos configurados en su ficha.',
                        'sheet-required-field-empty':
                            'Completa todos los campos obligatorios.',
                        'sheet-invalid-number':
                            'Uno de los campos numéricos no contiene un número válido.',
                        'sheet-invalid-date':
                            'Una de las fechas no es válida.',
                        'sheet-invalid-option':
                            'Una de las opciones seleccionadas ya no existe.',
                        'sheet-field-not-player-editable':
                            'Has intentado modificar un dato que controla el RPG o RPGEngine.'
                    };

                    setMessage(friendly[response.message] ?? response.message);
                    return;
                }

                if(response.sheetTemplate)
                    setSheetTemplate(response.sheetTemplate);

                const nextCharacter = characterPayload(response.message);

                if(nextCharacter !== undefined)
                {
                    setCharacter(nextCharacter);

                    if(nextCharacter)
                    {
                        designTargetRef.current = 'own';
                        engine()?.characterDesignGet?.(
                            nextCharacter.rpgId,
                            nextCharacter.userId
                        );
                    }
                    else
                    {
                        setOwnDesign(undefined);
                    }

                    const values: Record<number, string> = {};

                    for(const entry of nextCharacter?.values ?? [])
                        values[entry.fieldId] = entry.value ?? '';

                    setCharacterValues(values);
                    setEditingCharacter(false);

                    if(response.action === 46)
                        setMessage('Ficha guardada correctamente.');
                    else
                        setMessage('');
                }
            }
        }, 180);

        return () => window.clearInterval(timer);
    }, [ isVisible ]);

    const goBack = () =>
    {
        setMessage('');

        switch(page)
        {
            case 'create':
            case 'projects':
                setPage('home');
                break;

            case 'project':
                if(selectedAsAdmin)
                    setPage('projects');
                else
                    setPage('home');
                break;

            case 'player-sheet':
            case 'players':
            case 'admin':
                setPage('project');
                setEditingCharacter(false);
                setEditingAdminFields(false);
                break;

            case 'other-sheet':
                setPage('players');
                setViewedCharacter(undefined);
                setEditingAdminFields(false);
                break;

            case 'sheet-design':
                cancelDesignEditor();
                break;

            case 'sheet-builder':
                setPage('admin');
                setFieldDraft(null);
                setSectionEditorId(null);
                break;

            default:
                setPage('home');
        }
    };

    const enterAccessibleRpg = (rpg: RpgAccess) =>
    {
        setSelectedRpgId(rpg.id);
        setSelectedRpgName(rpg.name);
        setSelectedRpgOwnerId(rpg.ownerUserId);
        setSelectedAsAdmin(rpg.canAdmin);
        setSheetTemplate(null);
        setCharacter(undefined);
        setGroupChoice(rpg.groupId || 0);
        setPage('project');
    };

    const enterCurrentRpg = () =>
    {
        if(!currentContext) return;

        setSelectedRpgId(currentContext.rpgId);
        setSelectedRpgName(currentContext.rpgName);
        setSelectedRpgOwnerId(currentContext.ownerUserId);
        setSelectedAsAdmin(currentContext.ownerUserId === currentContext.actorUserId);
        setSheetTemplate(null);
        setCharacter(undefined);
        setPage('project');
    };

    const openMySheet = () =>
    {
        setPage('player-sheet');
        window.setTimeout(loadMyCharacter, 0);
    };

    const openAdmin = () =>
    {
        setPage('admin');
        setMessage('');
        setGroupChoice(selectedAccess?.groupId ?? 0);

        window.setTimeout(() =>
        {
            engine()?.rpgAccess?.();
            engine()?.manageableGroups?.();
        }, 0);
    };

    const openDesignEditor = () =>
    {
        if(!character || !sheetTemplate) return;

        setMessage('');
        setPage('sheet-design');

        if(!ownDesign)
        {
            designTargetRef.current = 'own';
            engine()?.characterDesignGet?.(
                selectedRpgId,
                character.userId
            );
        }
    };

    const cancelDesignEditor = () =>
    {
        setPage('player-sheet');
        setMessage('');

        if(character)
        {
            designTargetRef.current = 'own';
            engine()?.characterDesignGet?.(
                selectedRpgId,
                character.userId
            );
        }
    };

    const saveDesign = () =>
    {
        if(!character || !sheetTemplate) return;

        const design = ownDesign ??
            createDefaultCharacterDesign(
                sheetTemplate,
                character.id,
                character.userId
            );

        lastResponseSignature.current = '';
        designTargetRef.current = 'own';
        engine()?.characterDesignSave?.(
            selectedRpgId,
            design
        );
    };

    const openSheetBuilder = () =>
    {
        setPage('sheet-builder');
        setFieldDraft(null);
        setSectionEditorId(null);
        window.setTimeout(refreshSheet, 0);
    };

    const saveSection = () =>
    {
        const title = sectionTitle.trim();
        if(!title) return;

        engine()?.sheetSectionSave?.(
            selectedRpgId,
            sectionEditorId ?? 0,
            title
        );

        setSectionTitle('');
        setSectionEditorId(null);
    };

    const editSection = (section: any) =>
    {
        setSectionEditorId(section.id);
        setSectionTitle(section.title);
        setFieldDraft(null);
    };

    const startField = (sectionId: number, field?: RpgEngineSheetField) =>
    {
        setSectionEditorId(null);

        if(field)
        {
            setFieldDraft({
                id: field.id,
                sectionId: field.sectionId,
                label: field.label,
                fieldType: field.fieldType,
                required: field.required,
                visibility: field.visibility,
                controlMode: field.controlMode,
                optionsText: field.optionsText ?? ''
            });
        }
        else
        {
            setFieldDraft(blankField(sectionId));
        }
    };

    const saveField = () =>
    {
        if(!fieldDraft || !fieldDraft.label.trim()) return;

        engine()?.sheetFieldSave?.(
            selectedRpgId,
            fieldDraft.id,
            fieldDraft.sectionId,
            fieldDraft.label.trim(),
            fieldDraft.fieldType,
            fieldDraft.required,
            fieldDraft.visibility,
            fieldDraft.controlMode,
            fieldDraft.optionsText
        );

        setFieldDraft(null);
    };

    const setCharacterField = (fieldId: number, value: string) =>
        setCharacterValues(current => ({
            ...current,
            [fieldId]: value
        }));

    const saveAdminFields = () =>
    {
        if(!sheetTemplate || viewedUserId <= 0) return;

        lastResponseSignature.current = '';

        const values: Record<number, string> = {};

        for(const section of sheetTemplate.sections)
        {
            for(const field of section.fields)
            {
                if(field.controlMode !== 'staff') continue;
                values[field.id] = viewedValues[field.id] ?? '';
            }
        }

        engine()?.characterAdminSave?.(
            selectedRpgId,
            viewedUserId,
            values
        );
    };

    const saveCharacter = () =>
    {
        if(!sheetTemplate) return;

        // Igual que al cargar: una segunda grabación puede producir una respuesta
        // equivalente y debe procesarse igualmente.
        lastResponseSignature.current = '';

        const values: Record<number, string> = {};

        for(const section of sheetTemplate.sections)
        {
            for(const field of section.fields)
            {
                if(!editableByPlayer(field)) continue;
                values[field.id] = characterValues[field.id] ?? '';
            }
        }

        engine()?.characterSave?.(selectedRpgId, values);
    };

    const renderInput = (field: RpgEngineSheetField) =>
    {
        const value = characterValues[field.id] ?? '';

        if(field.fieldType === 'long_text')
        {
            return (
                <textarea
                    className="form-control"
                    rows={ 5 }
                    value={ value }
                    onChange={ event => setCharacterField(field.id, event.target.value) }
                />
            );
        }

        if(field.fieldType === 'select')
        {
            return (
                <select
                    className="form-select"
                    value={ value }
                    onChange={ event => setCharacterField(field.id, event.target.value) }
                >
                    <option value="">Selecciona una opción</option>
                    { optionsFor(field).map(option =>
                        <option key={ option } value={ option }>{ option }</option>
                    ) }
                </select>
            );
        }

        if(field.fieldType === 'yes_no')
        {
            return (
                <select
                    className="form-select"
                    value={ value }
                    onChange={ event => setCharacterField(field.id, event.target.value) }
                >
                    <option value="">Selecciona</option>
                    <option value="yes">Sí</option>
                    <option value="no">No</option>
                </select>
            );
        }

        const htmlType =
            field.fieldType === 'number' ? 'number' :
                field.fieldType === 'date' ? 'date' :
                    field.fieldType === 'image' ? 'url' :
                        'text';

        return (
            <input
                className="form-control"
                type={ htmlType }
                value={ value }
                placeholder={ field.fieldType === 'image' ? 'https://...' : '' }
                onChange={ event => setCharacterField(field.id, event.target.value) }
            />
        );
    };

    const renderViewedValue = (
        field: RpgEngineSheetField,
        values: Record<number, string>
    ) =>
    {
        const value = values[field.id] ?? '';

        if(field.fieldType === 'image' && value)
        {
            return (
                <img
                    src={ value }
                    alt=""
                    style={ {
                        maxWidth: '100%',
                        maxHeight: '300px',
                        borderRadius: '7px',
                        objectFit: 'contain',
                        display: 'block',
                        margin: '0 auto'
                    } }
                />
            );
        }

        if(field.fieldType === 'yes_no')
        {
            if(value === 'yes') return <span>Sí</span>;
            if(value === 'no') return <span>No</span>;
        }

        return <span style={ S.sheetValue }>{ value || '—' }</span>;
    };

    const renderValue = (field: RpgEngineSheetField) =>
    {
        const value = characterValues[field.id] ?? '';

        if(field.fieldType === 'image' && value)
        {
            return (
                <img
                    src={ value }
                    alt={ field.label }
                    style={ {
                        maxWidth: '100%',
                        maxHeight: '300px',
                        borderRadius: '7px',
                        objectFit: 'contain',
                        display: 'block',
                        margin: '0 auto'
                    } }
                />
            );
        }

        if(field.fieldType === 'yes_no')
        {
            if(value === 'yes') return <span>Sí</span>;
            if(value === 'no') return <span>No</span>;
        }

        return <span style={ S.sheetValue }>{ value || '—' }</span>;
    };

    if(!isVisible) return null;

    const canCreateNow = requestState === 'approved' || requestState === 'admin';
    const actorIsOwner =
        selectedAsAdmin ||
        (currentContext &&
         currentContext.rpgId === selectedRpgId &&
         currentContext.ownerUserId === currentContext.actorUserId);

    return (
        <NitroCardView
            uniqueKey="rpg-engine"
            theme="holo-classic"
            classNames={ [ 'rpg-engine-window' ] }
            style={ S.window }
        >
            <NitroCardHeaderView
                headerText="RPGEngine"
                onCloseClick={ () => setIsVisible(false) }
            />

            <NitroCardContentView style={ S.content }>
                <div style={ S.page }>
                    { page !== 'home' &&
                        <div style={ S.topbar }>
                            <Button variant="secondary" onClick={ goBack }>
                                <FaChevronLeft className="me-1" />
                                Volver
                            </Button>
                            <span style={ { fontSize: '10px', opacity: 0.5 } }>RPGEngine</span>
                        </div> }

                    { page === 'home' &&
                        <>
                            <div style={ S.hero }>
                                <div style={ S.eyebrow }>Biribiri RPG</div>
                                <div style={ S.title }>RPGEngine</div>
                                <div style={ { ...S.subtitle, marginTop: '5px' } }>
                                    Tus RPGs, personajes y sistemas de juego.
                                </div>
                            </div>

                            { currentContext &&
                                <button style={ S.actionCard } onClick={ enterCurrentRpg }>
                                    <span style={ S.iconBox }><FaMapMarkerAlt /></span>
                                    <span style={ S.actionBody }>
                                        <span style={ S.actionTitle }>RPG actual</span>
                                        <span style={ S.actionText }>
                                            Estás en una sala de { currentContext.rpgName }. Abre tu ficha y el contenido de este RPG.
                                        </span>
                                    </span>
                                    <FaChevronRight style={ { marginLeft: 'auto', opacity: 0.5 } } />
                                </button> }

                            <div style={ S.grid2 }>
                                <button style={ S.actionCard } onClick={ () =>
                                {
                                    setPage('create');
                                    engine()?.requestStatus?.();
                                } }>
                                    <span style={ S.iconBox }><FaPlus /></span>
                                    <span style={ S.actionBody }>
                                        <span style={ S.actionTitle }>Crear RPG</span>
                                        <span style={ S.actionText }>Solicita permiso para crear un proyecto.</span>
                                    </span>
                                </button>

                                <button style={ S.actionCard } onClick={ () =>
                                {
                                    setPage('projects');
                                    engine()?.rpgAccess?.();
                                } }>
                                    <span style={ S.iconBox }><FaFolderOpen /></span>
                                    <span style={ S.actionBody }>
                                        <span style={ S.actionTitle }>Mis RPGs</span>
                                        <span style={ S.actionText }>RPGs a los que perteneces o administras.</span>
                                    </span>
                                </button>
                            </div>
                        </> }

                    { page === 'create' &&
                        <>
                            <div style={ S.heading }>
                                <div style={ S.title }>Crear RPG</div>
                                <div style={ S.subtitle }>
                                    Crear un RPG requiere aprobación administrativa.
                                </div>
                            </div>

                            <div style={ S.panel }>
                                <div style={ S.page }>
                                    <label style={ S.field }>
                                        <span style={ S.label }>Nombre del RPG</span>
                                        <input
                                            className="form-control"
                                            value={ projectName }
                                            maxLength={ 80 }
                                            onChange={ event => setProjectName(event.target.value) }
                                        />
                                    </label>

                                    { !canCreateNow &&
                                        <label style={ S.field }>
                                            <span style={ S.label }>Describe brevemente tu idea</span>
                                            <textarea
                                                className="form-control"
                                                rows={ 4 }
                                                maxLength={ 500 }
                                                value={ reason }
                                                onChange={ event => setReason(event.target.value) }
                                            />
                                        </label> }

                                    <div style={ S.message }>
                                        { requestState === 'unknown' && 'Consultando permisos...' }
                                        { requestState === 'none' && 'No tienes una solicitud activa.' }
                                        { requestState === 'pending' && 'Solicitud pendiente de revisión.' }
                                        { requestState === 'approved' && 'Solicitud aprobada. Ya puedes crear el RPG.' }
                                        { requestState === 'rejected' && 'La última solicitud fue rechazada. Puedes enviar otra.' }
                                        { requestState === 'consumed' && 'El permiso anterior ya fue utilizado.' }
                                        { requestState === 'admin' && 'Cuenta administrativa. Creación directa habilitada.' }
                                    </div>

                                    { (requestState === 'none' || requestState === 'rejected' || requestState === 'consumed') &&
                                        <Button onClick={ () =>
                                            engine()?.requestProject?.(projectName.trim(), reason.trim()) }>
                                            Enviar solicitud
                                        </Button> }

                                    { requestState === 'pending' &&
                                        <Button disabled>Pendiente de aprobación</Button> }

                                    { canCreateNow &&
                                        <Button onClick={ () => engine()?.create?.(projectName.trim()) }>
                                            Crear RPG
                                        </Button> }
                                </div>
                            </div>
                        </> }

                    { page === 'projects' &&
                        <>
                            <div style={ S.topbar }>
                                <div style={ S.heading }>
                                    <div style={ S.title }>Mis RPGs</div>
                                    <div style={ S.subtitle }>
                                        RPGs a los que perteneces mediante su grupo o que administras.
                                    </div>
                                </div>
                                <Button onClick={ () => engine()?.rpgAccess?.() }>Actualizar</Button>
                            </div>

                            { rpgAccess.length === 0 &&
                                <div style={ S.empty }>
                                    Todavía no perteneces a ningún RPG vinculado.
                                </div> }

                            { rpgAccess.map(rpg =>
                                <button
                                    key={ rpg.id }
                                    style={ { ...S.row, cursor: 'pointer' } }
                                    onClick={ () => enterAccessibleRpg(rpg) }
                                >
                                    <span style={ S.rowLeft }>
                                        <span style={ S.iconBox }><FaFolderOpen /></span>
                                        <span style={ S.rowText }>
                                            <span style={ S.rowName }>{ rpg.name }</span>
                                            <span style={ S.rowMeta }>
                                                { rpg.canAdmin
                                                    ? 'Administras este RPG'
                                                    : (rpg.groupName
                                                        ? `Miembro de ${ rpg.groupName }`
                                                        : 'Miembro del RPG') }
                                            </span>
                                        </span>
                                    </span>

                                    <span style={ {
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    } }>
                                        <span style={ S.badge }>
                                            { rpg.canAdmin ? 'Administración' : 'Miembro' }
                                        </span>
                                        <FaChevronRight style={ { opacity: 0.5 } } />
                                    </span>
                                </button>
                            ) }
                        </> }

                    { page === 'project' && selectedRpgId > 0 &&
                        <>
                            <div style={ S.hero }>
                                <div style={ S.eyebrow }>Proyecto RPG</div>
                                <div style={ S.title }>{ selectedRpgName || selectedProject?.name }</div>
                                <div style={ S.subtitle }>RPG #{ selectedRpgId }</div>
                            </div>

                            <button style={ S.actionCard } onClick={ openMySheet }>
                                <span style={ S.iconBox }><FaUserCircle /></span>
                                <span style={ S.actionBody }>
                                    <span style={ S.actionTitle }>Mi ficha</span>
                                    <span style={ S.actionText }>
                                        Crea, consulta y actualiza tu personaje usando la plantilla de este RPG.
                                    </span>
                                </span>
                                <FaChevronRight style={ { marginLeft: 'auto', opacity: 0.5 } } />
                            </button>

                            <button style={ S.actionCard } onClick={ openPlayers }>
                                <span style={ S.iconBox }><FaUserCircle /></span>
                                <span style={ S.actionBody }>
                                    <span style={ S.actionTitle }>Jugadores</span>
                                    <span style={ S.actionText }>
                                        Consulta los personajes y las fichas visibles de este RPG.
                                    </span>
                                </span>
                                <FaChevronRight style={ { marginLeft: 'auto', opacity: 0.5 } } />
                            </button>
                            { actorIsOwner &&
                                <button style={ S.actionCard } onClick={ openAdmin }>
                                    <span style={ S.iconBox }><FaCog /></span>
                                    <span style={ S.actionBody }>
                                        <span style={ S.actionTitle }>Administración</span>
                                        <span style={ S.actionText }>
                                            Decide cómo funciona y qué puede ver cada jugador.
                                        </span>
                                    </span>
                                    <FaChevronRight style={ { marginLeft: 'auto', opacity: 0.5 } } />
                                </button> }
                        </> }

                    { page === 'player-sheet' && selectedRpgId > 0 &&
                        <>
                            <div style={ S.topbar }>
                                <div style={ S.heading }>
                                    <div style={ S.title }>Mi ficha</div>
                                    <div style={ S.subtitle }>{ selectedRpgName }</div>
                                </div>

                                { character &&
                                    <div style={ { display: 'flex', gap: '6px' } }>
                                        <Button
                                            variant="secondary"
                                            onClick={ openDesignEditor }
                                        >
                                            Personalizar
                                        </Button>

                                        <Button
                                            variant={ editingCharacter ? 'secondary' : undefined }
                                            onClick={ () => setEditingCharacter(value => !value) }
                                        >
                                            <FaEdit className="me-1" />
                                            { editingCharacter ? 'Cancelar edición' : 'Editar ficha' }
                                        </Button>
                                    </div> }
                            </div>

                            { character === undefined &&
                                <div style={ S.empty }>Cargando tu ficha...</div> }

                            { character === null && sheetTemplate &&
                                <>
                                    <div style={ S.message }>
                                        Aún no tienes una ficha en este RPG. Completa la plantilla para crear tu personaje.
                                        Los datos que controle el RPG o RPGEngine se añadirán automáticamente más adelante.
                                    </div>

                                    { sheetTemplate.sections.map(section =>
                                    {
                                        const fields = section.fields.filter(editableByPlayer);

                                        if(fields.length === 0) return null;

                                        return (
                                            <div key={ section.id } style={ S.sectionCard }>
                                                <div style={ S.sectionHeader }>
                                                    <strong>{ section.title }</strong>
                                                </div>

                                                <div style={ S.sectionBody }>
                                                    { fields.map(field =>
                                                        <label key={ field.id } style={ S.field }>
                                                            <span style={ S.label }>
                                                                { field.label }
                                                                { field.required ? ' *' : '' }
                                                            </span>
                                                            { renderInput(field) }
                                                        </label>
                                                    ) }
                                                </div>
                                            </div>
                                        );
                                    }) }

                                    <Button onClick={ saveCharacter }>
                                        <FaSave className="me-1" />
                                        Crear mi ficha
                                    </Button>
                                </> }

                            { character && !editingCharacter &&
                                <RpgCharacterStyledSheet
                                    template={ sheetTemplate }
                                    values={ characterValues }
                                    username={ character.username }
                                    rpgName={ selectedRpgName }
                                    design={ ownDesign }
                                /> }
                            { character && editingCharacter &&
                                <>
                                    <div style={ S.message }>
                                        Solo puedes modificar los campos que el administrador haya dejado bajo control del jugador.
                                        Los valores gestionados por administradores o RPGEngine aparecen como solo lectura.
                                    </div>

                                    { sheetTemplate?.sections.map(section =>
                                    {
                                        const fields = section.fields.filter(visibleToPlayer);

                                        if(fields.length === 0) return null;

                                        return (
                                            <div key={ section.id } style={ S.sectionCard }>
                                                <div style={ S.sectionHeader }>
                                                    <strong>{ section.title }</strong>
                                                </div>

                                                <div style={ S.sectionBody }>
                                                    { fields.map(field =>
                                                        <div key={ field.id } style={ S.field }>
                                                            <span style={ S.label }>
                                                                { field.label }
                                                                { field.required && editableByPlayer(field) ? ' *' : '' }
                                                            </span>

                                                            { editableByPlayer(field)
                                                                ? renderInput(field)
                                                                : (
                                                                    <div style={ S.message }>
                                                                        { renderValue(field) }
                                                                        <div style={ { marginTop: '4px', opacity: 0.55 } }>
                                                                            Controla: { controlLabel(field.controlMode) }
                                                                        </div>
                                                                    </div>
                                                                ) }
                                                        </div>
                                                    ) }
                                                </div>
                                            </div>
                                        );
                                    }) }

                                    <Button onClick={ saveCharacter }>
                                        <FaSave className="me-1" />
                                        Guardar cambios
                                    </Button>
                                </> }
                        </> }

                    { page === 'players' && selectedRpgId > 0 &&
                        <>
                            <div style={ S.topbar }>
                                <div style={ S.heading }>
                                    <div style={ S.title }>Jugadores</div>
                                    <div style={ S.subtitle }>{ selectedRpgName }</div>
                                </div>

                                <Button onClick={ () =>
                                {
                                    lastResponseSignature.current = '';
                                    setPlayers(undefined);
                                    engine()?.characterList?.(selectedRpgId);
                                } }>
                                    Actualizar
                                </Button>
                            </div>

                            { players === undefined &&
                                <div style={ S.empty }>Cargando jugadores...</div> }

                            { players?.length === 0 &&
                                <div style={ S.empty }>
                                    Todavía no hay personajes con ficha en este RPG.
                                </div> }

                            { players?.map(player =>
                                <button
                                    key={ player.userId }
                                    style={ { ...S.row, cursor: 'pointer' } }
                                    onClick={ () => openOtherCharacter(player.userId) }
                                >
                                    <span style={ S.rowLeft }>
                                        <span style={ S.iconBox }><FaUserCircle /></span>
                                        <span style={ S.rowText }>
                                            <span style={ S.rowName }>{ player.username }</span>
                                            <span style={ S.rowMeta }>
                                                Ver ficha del personaje
                                            </span>
                                        </span>
                                    </span>

                                    <FaChevronRight style={ { opacity: 0.5 } } />
                                </button>
                            ) }
                        </> }

                    { page === 'other-sheet' && selectedRpgId > 0 &&
                        <>
                            <div style={ S.topbar }>
                                <div style={ S.heading }>
                                    <div style={ S.title }>
                                        { viewedCharacter?.username ?? 'Ficha del jugador' }
                                    </div>
                                    <div style={ S.subtitle }>{ selectedRpgName }</div>
                                </div>

                                { actorIsOwner && viewedCharacter &&
                                    <Button
                                        variant={ editingAdminFields ? 'secondary' : undefined }
                                        onClick={ () =>
                                            setEditingAdminFields(value => !value) }
                                    >
                                        <FaEdit className="me-1" />
                                        { editingAdminFields
                                            ? 'Cancelar edición'
                                            : 'Editar campos de administración' }
                                    </Button> }
                            </div>

                            { viewedCharacter === undefined &&
                                <div style={ S.empty }>Cargando ficha...</div> }

                            { viewedCharacter === null &&
                                <div style={ S.empty }>
                                    Este jugador todavía no tiene una ficha.
                                </div> }

                            { viewedCharacter && !editingAdminFields &&
                                <RpgCharacterStyledSheet
                                    template={ sheetTemplate }
                                    values={ viewedValues }
                                    username={ viewedCharacter.username }
                                    rpgName={ selectedRpgName }
                                    design={ viewedDesign }
                                /> }
                            { viewedCharacter && editingAdminFields &&
                                <>
                                    <div style={ S.message }>
                                        Solo puedes modificar los campos que la plantilla haya
                                        asignado a los administradores del RPG. Los campos del
                                        jugador y los controlados por RPGEngine permanecen bloqueados.
                                    </div>

                                    { sheetTemplate?.sections.map(section =>
                                    {
                                        const staffFields = section.fields.filter(
                                            field => field.controlMode === 'staff'
                                        );

                                        if(staffFields.length === 0) return null;

                                        return (
                                            <div key={ section.id } style={ S.sectionCard }>
                                                <div style={ S.sectionHeader }>
                                                    <strong>{ section.title }</strong>
                                                </div>

                                                <div style={ S.sectionBody }>
                                                    { staffFields.map(field =>
                                                    {
                                                        const value =
                                                            viewedValues[field.id] ?? '';

                                                        const setValue = (next: string) =>
                                                            setViewedValues(current => ({
                                                                ...current,
                                                                [field.id]: next
                                                            }));

                                                        return (
                                                            <label key={ field.id } style={ S.field }>
                                                                <span style={ S.label }>
                                                                    { field.label }
                                                                </span>

                                                                { field.fieldType === 'long_text' &&
                                                                    <textarea
                                                                        className="form-control"
                                                                        rows={ 5 }
                                                                        value={ value }
                                                                        onChange={ event =>
                                                                            setValue(event.target.value) }
                                                                    /> }

                                                                { field.fieldType === 'select' &&
                                                                    <select
                                                                        className="form-select"
                                                                        value={ value }
                                                                        onChange={ event =>
                                                                            setValue(event.target.value) }
                                                                    >
                                                                        <option value="">
                                                                            Selecciona una opción
                                                                        </option>
                                                                        { optionsFor(field).map(option =>
                                                                            <option
                                                                                key={ option }
                                                                                value={ option }
                                                                            >
                                                                                { option }
                                                                            </option>
                                                                        ) }
                                                                    </select> }

                                                                { field.fieldType === 'yes_no' &&
                                                                    <select
                                                                        className="form-select"
                                                                        value={ value }
                                                                        onChange={ event =>
                                                                            setValue(event.target.value) }
                                                                    >
                                                                        <option value="">Selecciona</option>
                                                                        <option value="yes">Sí</option>
                                                                        <option value="no">No</option>
                                                                    </select> }

                                                                { ![
                                                                    'long_text',
                                                                    'select',
                                                                    'yes_no'
                                                                ].includes(field.fieldType) &&
                                                                    <input
                                                                        className="form-control"
                                                                        type={
                                                                            field.fieldType === 'number'
                                                                                ? 'number'
                                                                                : field.fieldType === 'date'
                                                                                    ? 'date'
                                                                                    : field.fieldType === 'image'
                                                                                        ? 'url'
                                                                                        : 'text'
                                                                        }
                                                                        value={ value }
                                                                        onChange={ event =>
                                                                            setValue(event.target.value) }
                                                                    /> }
                                                            </label>
                                                        );
                                                    }) }
                                                </div>
                                            </div>
                                        );
                                    }) }

                                    <Button onClick={ saveAdminFields }>
                                        <FaSave className="me-1" />
                                        Guardar cambios de administración
                                    </Button>
                                </> }
                        </> }
                    { page === 'sheet-design' &&
                      selectedRpgId > 0 &&
                      character &&
                      sheetTemplate &&
                        <>
                            <div style={ S.heading }>
                                <div style={ S.title }>Personalizar ficha</div>
                                <div style={ S.subtitle }>
                                    Este diseño pertenece a tu personaje. El RPG define los datos;
                                    tú decides cómo presentarlos.
                                </div>
                            </div>

                            <RpgCharacterDesignEditor
                                template={ sheetTemplate }
                                values={ characterValues }
                                username={ character.username }
                                rpgName={ selectedRpgName }
                                design={
                                    ownDesign ??
                                    createDefaultCharacterDesign(
                                        sheetTemplate,
                                        character.id,
                                        character.userId
                                    )
                                }
                                onChange={ setOwnDesign }
                                onSave={ saveDesign }
                                onCancel={ cancelDesignEditor }
                            />
                        </> }
                    { page === 'admin' && selectedRpgId > 0 &&
                        <>
                            <div style={ S.heading }>
                                <div style={ S.title }>Administración</div>
                                <div style={ S.subtitle }>
                                    Configuración de { selectedRpgName }. El jugador no verá este panel.
                                </div>
                            </div>

                            <div style={ S.panel }>
                                <div style={ S.page }>
                                    <div style={ S.heading }>
                                        <div style={ { fontSize: '15px', fontWeight: 800 } }>
                                            Grupo del RPG
                                        </div>
                                        <div style={ S.subtitle }>
                                            Vincula la placa/grupo oficial del RPG. Sus miembros verán este
                                            RPG automáticamente en "Mis RPGs".
                                        </div>
                                    </div>

                                    { selectedAccess?.groupId > 0 &&
                                        <div style={ S.message }>
                                            Vinculado a: <strong>
                                                { selectedAccess.groupName || `Grupo #${ selectedAccess.groupId }` }
                                            </strong>
                                        </div> }

                                    <label style={ S.field }>
                                        <span style={ S.label }>Grupo que representa este RPG</span>
                                        <select
                                            className="form-select"
                                            value={ groupChoice }
                                            onChange={ event =>
                                                setGroupChoice(Number(event.target.value) || 0) }
                                        >
                                            <option value={ 0 }>Selecciona un grupo</option>
                                            { manageableGroups.map(group =>
                                                <option
                                                    key={ group.id }
                                                    value={ group.id }
                                                    disabled={
                                                        group.linkedRpgId > 0 &&
                                                        group.linkedRpgId !== selectedRpgId
                                                    }
                                                >
                                                    { group.name }
                                                    { group.linkedRpgId > 0 &&
                                                      group.linkedRpgId !== selectedRpgId
                                                        ? ' — ya vinculado'
                                                        : '' }
                                                </option>
                                            ) }
                                        </select>
                                        <span style={ S.rowMeta }>
                                            Solo aparecen grupos donde eres propietario o administrador.
                                        </span>
                                    </label>

                                    <div style={ {
                                        display: 'flex',
                                        gap: '6px',
                                        flexWrap: 'wrap'
                                    } }>
                                        <Button
                                            disabled={ groupChoice <= 0 }
                                            onClick={ () =>
                                                engine()?.linkGroup?.(selectedRpgId, groupChoice) }
                                        >
                                            Vincular grupo
                                        </Button>

                                        { selectedAccess?.groupId > 0 &&
                                            <Button
                                                variant="secondary"
                                                onClick={ () =>
                                                {
                                                    if(window.confirm(
                                                        '¿Desvincular el grupo de este RPG?'
                                                    ))
                                                        engine()?.unlinkGroup?.(selectedRpgId);
                                                } }
                                            >
                                                Desvincular
                                            </Button> }
                                    </div>
                                </div>
                            </div>

                            <button
                                style={ { ...S.row, cursor: 'pointer' } }
                                onClick={ openSheetBuilder }
                            >
                                <span style={ S.rowLeft }>
                                    <span style={ S.iconBox }><FaFileAlt /></span>
                                    <span style={ S.rowText }>
                                        <span style={ S.rowName }>Plantilla de ficha</span>
                                        <span style={ S.rowMeta }>
                                            Crea secciones, campos, orden, visibilidad y quién controla cada dato.
                                        </span>
                                    </span>
                                </span>
                                <FaChevronRight style={ { opacity: 0.5 } } />
                            </button>
                        </> }

                    { page === 'sheet-builder' && selectedRpgId > 0 &&
                        <>
                            <div style={ S.topbar }>
                                <div style={ S.heading }>
                                    <div style={ S.title }>Plantilla de ficha</div>
                                    <div style={ S.subtitle }>
                                        Construye lo que tendrá que rellenar y ver cada personaje.
                                    </div>
                                </div>

                                <Button onClick={ () =>
                                {
                                    setFieldDraft(null);
                                    setSectionEditorId(0);
                                    setSectionTitle('');
                                } }>
                                    <FaPlus className="me-1" />
                                    Añadir sección
                                </Button>
                            </div>

                            <div style={ S.message }>
                                Aquí usamos nombres sencillos: Texto, Imagen, Lista de opciones o Sí / No.
                                Stats, monedas, recursos, habilidades e inventario se conectarán como datos del sistema más adelante.
                            </div>

                            { sectionEditorId !== null &&
                                <div style={ S.formBox }>
                                    <div style={ { fontSize: '14px', fontWeight: 800 } }>
                                        { sectionEditorId > 0 ? 'Editar sección' : 'Nueva sección' }
                                    </div>

                                    <label style={ S.field }>
                                        <span style={ S.label }>Nombre de la sección</span>
                                        <input
                                            autoFocus
                                            className="form-control"
                                            placeholder="Ej. Datos del personaje"
                                            maxLength={ 80 }
                                            value={ sectionTitle }
                                            onChange={ event => setSectionTitle(event.target.value) }
                                        />
                                    </label>

                                    <div style={ { display: 'flex', gap: '6px' } }>
                                        <Button onClick={ saveSection }>Guardar</Button>
                                        <Button variant="secondary" onClick={ () =>
                                        {
                                            setSectionEditorId(null);
                                            setSectionTitle('');
                                        } }>
                                            Cancelar
                                        </Button>
                                    </div>
                                </div> }

                            { fieldDraft &&
                                <div style={ S.formBox }>
                                    <div style={ { fontSize: '14px', fontWeight: 800 } }>
                                        { fieldDraft.id > 0 ? 'Editar campo' : 'Añadir campo' }
                                    </div>

                                    <label style={ S.field }>
                                        <span style={ S.label }>Nombre que verá el jugador</span>
                                        <input
                                            autoFocus
                                            className="form-control"
                                            placeholder="Ej. Personalidad"
                                            maxLength={ 80 }
                                            value={ fieldDraft.label }
                                            onChange={ event =>
                                                setFieldDraft({ ...fieldDraft, label: event.target.value }) }
                                        />
                                    </label>

                                    <label style={ S.field }>
                                        <span style={ S.label }>Qué tipo de dato es</span>
                                        <select
                                            className="form-select"
                                            value={ fieldDraft.fieldType }
                                            onChange={ event => setFieldDraft({
                                                ...fieldDraft,
                                                fieldType: event.target.value as RpgEngineSheetFieldType
                                            }) }
                                        >
                                            { FIELD_TYPES.map(type =>
                                                <option key={ type.value } value={ type.value }>
                                                    { type.label }
                                                </option>
                                            ) }
                                        </select>
                                        <span style={ S.rowMeta }>
                                            { FIELD_TYPES.find(type => type.value === fieldDraft.fieldType)?.help }
                                        </span>
                                    </label>

                                    { fieldDraft.fieldType === 'select' &&
                                        <label style={ S.field }>
                                            <span style={ S.label }>Opciones disponibles</span>
                                            <textarea
                                                className="form-control"
                                                rows={ 4 }
                                                placeholder={ 'Humano\nShinigami\nHollow' }
                                                value={ fieldDraft.optionsText }
                                                onChange={ event => setFieldDraft({
                                                    ...fieldDraft,
                                                    optionsText: event.target.value
                                                }) }
                                            />
                                            <span style={ S.rowMeta }>Una opción por línea.</span>
                                        </label> }

                                    <label style={ S.field }>
                                        <span style={ S.label }>Quién puede verlo</span>
                                        <select
                                            className="form-select"
                                            value={ fieldDraft.visibility }
                                            onChange={ event => setFieldDraft({
                                                ...fieldDraft,
                                                visibility: event.target.value
                                            }) }
                                        >
                                            { VISIBILITIES.map(item =>
                                                <option key={ item.value } value={ item.value }>
                                                    { item.label }
                                                </option>
                                            ) }
                                        </select>
                                    </label>

                                    <label style={ S.field }>
                                        <span style={ S.label }>Quién controla este valor</span>
                                        <select
                                            className="form-select"
                                            value={ fieldDraft.controlMode }
                                            onChange={ event => setFieldDraft({
                                                ...fieldDraft,
                                                controlMode: event.target.value
                                            }) }
                                        >
                                            { CONTROL_MODES.map(item =>
                                                <option key={ item.value } value={ item.value }>
                                                    { item.label }
                                                </option>
                                            ) }
                                        </select>
                                        <span style={ S.rowMeta }>
                                            Si eliges RPGEngine, el jugador lo verá pero no podrá cambiarlo manualmente.
                                        </span>
                                    </label>

                                    <label style={ {
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '7px',
                                        fontSize: '11px'
                                    } }>
                                        <input
                                            type="checkbox"
                                            className="form-check-input"
                                            checked={ fieldDraft.required }
                                            onChange={ event => setFieldDraft({
                                                ...fieldDraft,
                                                required: event.target.checked
                                            }) }
                                        />
                                        Obligatorio para completar la ficha
                                    </label>

                                    <div style={ { display: 'flex', gap: '6px' } }>
                                        <Button onClick={ saveField }>Guardar campo</Button>
                                        <Button variant="secondary" onClick={ () => setFieldDraft(null) }>
                                            Cancelar
                                        </Button>
                                    </div>
                                </div> }

                            { !sheetTemplate &&
                                <div style={ S.empty }>Cargando plantilla...</div> }

                            { sheetTemplate && sheetTemplate.sections.length === 0 &&
                                sectionEditorId === null &&
                                <div style={ S.empty }>
                                    La ficha está vacía. Empieza creando una sección, por ejemplo
                                    "Datos del personaje".
                                </div> }

                            { sheetTemplate?.sections.map((section, sectionIndex) =>
                                <div key={ section.id } style={ S.sectionCard }>
                                    <div style={ S.sectionHeader }>
                                        <div>
                                            <div style={ { fontSize: '14px', fontWeight: 800 } }>
                                                { section.title }
                                            </div>
                                            <div style={ S.rowMeta }>
                                                { section.fields.length === 1
                                                    ? '1 campo'
                                                    : `${ section.fields.length } campos` }
                                            </div>
                                        </div>

                                        <div style={ S.miniButtons }>
                                            <button
                                                style={ S.iconButton }
                                                disabled={ sectionIndex === 0 }
                                                title="Subir sección"
                                                onClick={ () =>
                                                    engine()?.sheetSectionMove?.(selectedRpgId, section.id, -1) }
                                            >
                                                <FaArrowUp />
                                            </button>
                                            <button
                                                style={ S.iconButton }
                                                disabled={ sectionIndex === sheetTemplate.sections.length - 1 }
                                                title="Bajar sección"
                                                onClick={ () =>
                                                    engine()?.sheetSectionMove?.(selectedRpgId, section.id, 1) }
                                            >
                                                <FaArrowDown />
                                            </button>
                                            <button
                                                style={ S.iconButton }
                                                title="Editar sección"
                                                onClick={ () => editSection(section) }
                                            >
                                                <FaEdit />
                                            </button>
                                            <button
                                                style={ S.iconButton }
                                                title="Eliminar sección"
                                                onClick={ () =>
                                                {
                                                    if(window.confirm(
                                                        `Eliminar "${ section.title }" y todos sus campos?`
                                                    ))
                                                        engine()?.sheetSectionDelete?.(
                                                            selectedRpgId,
                                                            section.id
                                                        );
                                                } }
                                            >
                                                <FaTrash />
                                            </button>
                                        </div>
                                    </div>

                                    <div style={ S.sectionBody }>
                                        { section.fields.map((field, fieldIndex) =>
                                            <div key={ field.id } style={ S.fieldRow }>
                                                <div style={ S.rowText }>
                                                    <div style={ S.rowName }>
                                                        { field.label }
                                                        { field.required &&
                                                            <span style={ { marginLeft: '5px', opacity: 0.55 } }>*</span> }
                                                    </div>

                                                    <div>
                                                        <span style={ S.badge }>
                                                            { fieldTypeLabel(field.fieldType) }
                                                        </span>
                                                        <span style={ S.badge }>
                                                            { visibilityLabel(field.visibility) }
                                                        </span>
                                                        <span style={ S.badge }>
                                                            Controla: { controlLabel(field.controlMode) }
                                                        </span>
                                                    </div>
                                                </div>

                                                <div style={ S.miniButtons }>
                                                    <button
                                                        style={ S.iconButton }
                                                        disabled={ fieldIndex === 0 }
                                                        title="Subir campo"
                                                        onClick={ () =>
                                                            engine()?.sheetFieldMove?.(
                                                                selectedRpgId,
                                                                field.id,
                                                                -1
                                                            ) }
                                                    >
                                                        <FaArrowUp />
                                                    </button>
                                                    <button
                                                        style={ S.iconButton }
                                                        disabled={ fieldIndex === section.fields.length - 1 }
                                                        title="Bajar campo"
                                                        onClick={ () =>
                                                            engine()?.sheetFieldMove?.(
                                                                selectedRpgId,
                                                                field.id,
                                                                1
                                                            ) }
                                                    >
                                                        <FaArrowDown />
                                                    </button>
                                                    <button
                                                        style={ S.iconButton }
                                                        title="Editar campo"
                                                        onClick={ () => startField(section.id, field) }
                                                    >
                                                        <FaEdit />
                                                    </button>
                                                    <button
                                                        style={ S.iconButton }
                                                        title="Eliminar campo"
                                                        onClick={ () =>
                                                        {
                                                            if(window.confirm(`Eliminar "${ field.label }"?`))
                                                                engine()?.sheetFieldDelete?.(
                                                                    selectedRpgId,
                                                                    field.id
                                                                );
                                                        } }
                                                    >
                                                        <FaTrash />
                                                    </button>
                                                </div>
                                            </div>
                                        ) }

                                        <Button onClick={ () => startField(section.id) }>
                                            <FaPlus className="me-1" />
                                            Añadir campo
                                        </Button>
                                    </div>
                                </div>
                            ) }
                        </> }

                    { message &&
                        <div style={ S.message }>{ message }</div> }
                </div>
            </NitroCardContentView>
        </NitroCardView>
    );
};