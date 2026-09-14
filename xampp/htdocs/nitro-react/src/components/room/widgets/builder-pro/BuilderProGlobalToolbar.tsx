import {
    FC,
    PropsWithChildren
} from 'react';
import {
    FaEye,
    FaEyeSlash
} from 'react-icons/fa';

interface BuilderProGlobalToolbarProps
{
    pending: boolean;
    hasSelection: boolean;
    highlightSelection: boolean;
    outlinerOpen: boolean;
    onClearSelection: () => void;
    onToggleHighlight: () => void;
    onToggleOutliner: () => void;
}

export const BuilderProGlobalToolbar:
    FC<PropsWithChildren<BuilderProGlobalToolbarProps>> = props =>
{
    const {
        pending,
        hasSelection,
        highlightSelection,
        outlinerOpen,
        onClearSelection,
        onToggleHighlight,
        onToggleOutliner,
        children
    } = props;

    return (
        <div
            className="builder-pro-global-toolbar builder-pro-bottom-toolbar"
            role="toolbar"
            aria-label="Acciones globales">
            <button
                type="button"
                className="btn btn-sm btn-secondary builder-pro-icon-button builder-pro-clear-selection-button"
                title="Limpiar selección"
                aria-label="Limpiar selección"
                disabled={
                    pending ||
                    !hasSelection
                }
                onClick={ onClearSelection }>
                <span
                    className="builder-pro-clear-selection-glyph"
                    aria-hidden="true">
                    ×
                </span>
            </button>

            <button
                type="button"
                className="btn btn-sm btn-secondary builder-pro-icon-button builder-pro-highlight-button"
                title={
                    highlightSelection
                        ? 'Ocultar resaltado'
                        : 'Mostrar resaltado'
                }
                aria-label={
                    highlightSelection
                        ? 'Ocultar resaltado'
                        : 'Mostrar resaltado'
                }
                aria-pressed={ highlightSelection }
                disabled={ pending }
                onClick={ onToggleHighlight }>
                { highlightSelection
                    ? <FaEyeSlash />
                    : <FaEye /> }
            </button>

            <button
                type="button"
                className={
                    `btn btn-sm ${
                        outlinerOpen
                            ? 'btn-primary'
                            : 'btn-secondary'
                    } builder-pro-icon-button builder-pro-outliner-toggle`
                }
                title={
                    outlinerOpen
                        ? 'Ocultar Capas / Outliner'
                        : 'Mostrar Capas / Outliner'
                }
                aria-label={
                    outlinerOpen
                        ? 'Ocultar Capas / Outliner'
                        : 'Mostrar Capas / Outliner'
                }
                aria-pressed={ outlinerOpen }
                onClick={ onToggleOutliner }>
                <span
                    className="builder-pro-outliner-toggle-glyph"
                    aria-hidden="true">
                    ▤
                </span>
            </button>

            { children }
        </div>
    );
};
