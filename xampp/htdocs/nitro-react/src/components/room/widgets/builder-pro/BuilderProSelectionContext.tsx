import {
    FC,
    useState
} from 'react';

type SelectionMenuId =
    | 'advanced'
    | 'visibility'
    | 'lock'
    | 'groups';

type AdvancedCriterion =
    | 'identical'
    | 'height'
    | 'state'
    | 'rotation'
    | 'all'
    | 'invert';

interface SavedGroupOption
{
    id: number;
    name: string;
    itemIds: number[];
    locked: boolean;
}

interface BuilderProSelectionContextProps
{
    pending: boolean;
    selectedCount: number;
    areaMode: boolean;
    pivotId: number | null;
    pivotPickMode: boolean;
    onOpenModeMenu: () => void;
    onTogglePivotPick: () => void;
    onClearPivot: () => void;
    onStatePrevious: () => void;
    onStateNext: () => void;
    onSelectAdvanced: (criterion: AdvancedCriterion) => void;

    canRestoreVisibility: boolean;
    onHideSelection: () => void;
    onDimSelection: () => void;
    onRestoreVisibility: () => void;

    itemLockPending: boolean;
    allSelectedLocked: boolean;
    selectedLockedCount: number;
    onLockSelection: () => void;
    onUnlockSelection: () => void;

    groups: SavedGroupOption[];
    selectedGroupId: number | null;
    selectedGroupLocked: boolean;
    hasSelectedGroup: boolean;
    groupName: string;
    groupPending: boolean;
    onSelectedGroupIdChange: (groupId: number | null) => void;
    onGroupNameChange: (value: string) => void;
    onCreateGroup: () => void;
    onSelectGroup: () => void;
    onToggleGroupLock: () => void;
    onUpdateGroupMembers: () => void;
    onRenameGroup: () => void;
    onDeleteGroup: () => void;
}

export const BuilderProSelectionContext:
    FC<BuilderProSelectionContextProps> = props =>
{
    const {
        pending,
        selectedCount,
        areaMode,
        pivotId,
        pivotPickMode,
        onOpenModeMenu,
        onTogglePivotPick,
        onClearPivot,
        onStatePrevious,
        onStateNext,
        onSelectAdvanced,
        canRestoreVisibility,
        onHideSelection,
        onDimSelection,
        onRestoreVisibility,
        itemLockPending,
        allSelectedLocked,
        selectedLockedCount,
        onLockSelection,
        onUnlockSelection,
        groups,
        selectedGroupId,
        selectedGroupLocked,
        hasSelectedGroup,
        groupName,
        groupPending,
        onSelectedGroupIdChange,
        onGroupNameChange,
        onCreateGroup,
        onSelectGroup,
        onToggleGroupLock,
        onUpdateGroupMembers,
        onRenameGroup,
        onDeleteGroup
    } = props;

    const [ openMenu, setOpenMenu ] =
        useState<SelectionMenuId | null>(
            null
        );

    const toggleMenu = (
        menu: SelectionMenuId
    ) =>
    {
        setOpenMenu(
            current =>
                current === menu
                    ? null
                    : menu
        );
    };

    const selected =
        selectedCount > 0;

    return (
        <div className="builder-pro-selection-context">
            <div className="builder-pro-context-cluster">
                <span className="builder-pro-context-label">
                    Modo
                </span>

                <button
                    type="button"
                    className="builder-pro-context-primary"
                    disabled={ pending }
                    onClick={ onOpenModeMenu }>
                    { areaMode
                        ? 'Área'
                        : 'Puntero' } ▾
                </button>
            </div>

            <div className="builder-pro-context-cluster">
                <span className="builder-pro-context-label">
                    Pivote
                </span>

                <button
                    type="button"
                    className={
                        pivotPickMode
                            ? 'is-selected'
                            : ''
                    }
                    disabled={
                        pending ||
                        !selected
                    }
                    onClick={ onTogglePivotPick }>
                    { pivotPickMode
                        ? 'Elegir…'
                        : (
                            pivotId !== null
                                ? `#${ pivotId }`
                                : 'Elegir'
                        ) }
                </button>

                <button
                    type="button"
                    disabled={
                        pending ||
                        pivotId === null
                    }
                    onClick={ onClearPivot }>
                    Auto
                </button>
            </div>

            <div className="builder-pro-context-cluster">
                <span className="builder-pro-context-label">
                    Estado
                </span>

                <button
                    type="button"
                    title="Estado anterior"
                    aria-label="Estado anterior"
                    disabled={
                        pending ||
                        !selected
                    }
                    onClick={ onStatePrevious }>
                    ‹
                </button>

                <button
                    type="button"
                    title="Estado siguiente"
                    aria-label="Estado siguiente"
                    disabled={
                        pending ||
                        !selected
                    }
                    onClick={ onStateNext }>
                    ›
                </button>
            </div>

            <div className="builder-pro-context-menu-anchor">
                <button
                    type="button"
                    className={
                        openMenu === 'advanced'
                            ? 'is-selected'
                            : ''
                    }
                    onClick={
                        () => toggleMenu(
                            'advanced'
                        )
                    }>
                    Avanzado ▾
                </button>

                { openMenu === 'advanced' &&
                    <div className="builder-pro-context-popover">
                        <div className="builder-pro-popover-title">
                            Selección avanzada
                        </div>

                        <div className="builder-pro-popover-grid">
                            { (
                                [
                                    [ 'identical', 'Idénticos' ],
                                    [ 'height', 'Misma altura' ],
                                    [ 'state', 'Mismo estado' ],
                                    [ 'rotation', 'Misma rotación' ],
                                    [ 'all', 'Todos' ],
                                    [ 'invert', 'Invertir' ]
                                ] as const
                            ).map(
                                ([ criterion, label ]) =>
                                    <button
                                        key={ criterion }
                                        type="button"
                                        disabled={ pending }
                                        onClick={ () =>
                                        {
                                            onSelectAdvanced(
                                                criterion
                                            );
                                            setOpenMenu(null);
                                        } }>
                                        { label }
                                    </button>
                            ) }
                        </div>
                    </div> }
            </div>

            <div className="builder-pro-context-menu-anchor">
                <button
                    type="button"
                    className={
                        openMenu === 'visibility'
                            ? 'is-selected'
                            : ''
                    }
                    onClick={
                        () => toggleMenu(
                            'visibility'
                        )
                    }>
                    Visibilidad ▾
                </button>

                { openMenu === 'visibility' &&
                    <div className="builder-pro-context-popover">
                        <div className="builder-pro-popover-title">
                            Visibilidad local
                        </div>

                        <button
                            type="button"
                            disabled={
                                pending ||
                                !selected
                            }
                            onClick={ onHideSelection }>
                            Ocultar selección
                        </button>

                        <button
                            type="button"
                            disabled={
                                pending ||
                                !selected
                            }
                            onClick={ onDimSelection }>
                            Atenuar selección
                        </button>

                        <button
                            type="button"
                            disabled={
                                pending ||
                                !canRestoreVisibility
                            }
                            onClick={ onRestoreVisibility }>
                            Restaurar visibilidad
                        </button>
                    </div> }
            </div>

            <div className="builder-pro-context-menu-anchor">
                <button
                    type="button"
                    className={
                        openMenu === 'lock'
                            ? 'is-selected'
                            : ''
                    }
                    onClick={
                        () => toggleMenu(
                            'lock'
                        )
                    }>
                    Bloqueo ▾
                </button>

                { openMenu === 'lock' &&
                    <div className="builder-pro-context-popover">
                        <div className="builder-pro-popover-title">
                            Construcción
                        </div>

                        <div className="builder-pro-popover-meta">
                            { selected
                                ? `${ selectedLockedCount }/${ selectedCount } bloqueados`
                                : 'Sin selección' }
                        </div>

                        <button
                            type="button"
                            className={
                                allSelectedLocked
                                    ? 'is-selected'
                                    : ''
                            }
                            disabled={
                                pending ||
                                itemLockPending ||
                                !selected ||
                                allSelectedLocked
                            }
                            onClick={ onLockSelection }>
                            Bloquear selección
                        </button>

                        <button
                            type="button"
                            disabled={
                                pending ||
                                itemLockPending ||
                                !selected ||
                                selectedLockedCount === 0
                            }
                            onClick={ onUnlockSelection }>
                            Desbloquear selección
                        </button>
                    </div> }
            </div>

            <div className="builder-pro-context-menu-anchor">
                <button
                    type="button"
                    className={
                        openMenu === 'groups'
                            ? 'is-selected'
                            : ''
                    }
                    onClick={
                        () => toggleMenu(
                            'groups'
                        )
                    }>
                    Grupos ▾
                </button>

                { openMenu === 'groups' &&
                    <div className="builder-pro-context-popover builder-pro-groups-popover">
                        <div className="builder-pro-popover-title">
                            Grupos
                        </div>

                        <select
                            disabled={
                                pending ||
                                groupPending ||
                                !groups.length
                            }
                            value={
                                selectedGroupId ??
                                ''
                            }
                            onChange={
                                event =>
                                {
                                    const value =
                                        Number(
                                            event.target.value
                                        );

                                    onSelectedGroupIdChange(
                                        Number.isSafeInteger(value) &&
                                        value > 0
                                            ? value
                                            : null
                                    );
                                }
                            }>
                            { !groups.length &&
                                <option value="">
                                    Sin grupos
                                </option> }

                            { groups.map(group =>
                                <option
                                    key={ group.id }
                                    value={ group.id }>
                                    { `${ group.name } · ${ group.itemIds.length }${ group.locked ? ' · Bloqueado' : '' }` }
                                </option>
                            ) }
                        </select>

                        <div className="builder-pro-popover-grid">
                            <button
                                type="button"
                                disabled={
                                    pending ||
                                    groupPending ||
                                    !selected
                                }
                                onClick={ onCreateGroup }>
                                Crear
                            </button>

                            <button
                                type="button"
                                disabled={
                                    pending ||
                                    groupPending ||
                                    !hasSelectedGroup
                                }
                                onClick={ onSelectGroup }>
                                Seleccionar
                            </button>

                            <button
                                type="button"
                                className={
                                    selectedGroupLocked
                                        ? 'is-selected'
                                        : ''
                                }
                                disabled={
                                    pending ||
                                    groupPending ||
                                    !hasSelectedGroup
                                }
                                onClick={ onToggleGroupLock }>
                                { selectedGroupLocked
                                    ? 'Desbloquear'
                                    : 'Bloquear' }
                            </button>

                            <button
                                type="button"
                                disabled={
                                    pending ||
                                    groupPending ||
                                    !hasSelectedGroup ||
                                    selectedGroupLocked ||
                                    !selected
                                }
                                onClick={ onUpdateGroupMembers }>
                                Miembros
                            </button>
                        </div>

                        <div className="builder-pro-popover-inline">
                            <input
                                type="text"
                                maxLength={ 40 }
                                placeholder="Nombre del grupo"
                                disabled={
                                    pending ||
                                    groupPending ||
                                    !hasSelectedGroup
                                }
                                value={ groupName }
                                onChange={
                                    event =>
                                        onGroupNameChange(
                                            event.target.value
                                        )
                                } />

                            <button
                                type="button"
                                disabled={
                                    pending ||
                                    groupPending ||
                                    !hasSelectedGroup ||
                                    !groupName.trim()
                                }
                                onClick={ onRenameGroup }>
                                Renombrar
                            </button>
                        </div>

                        <button
                            type="button"
                            className="builder-pro-popover-danger"
                            disabled={
                                pending ||
                                groupPending ||
                                !hasSelectedGroup
                            }
                            onClick={ onDeleteGroup }>
                            Desagrupar
                        </button>
                    </div> }
            </div>
        </div>
    );
};
