import {
    FC,
    PropsWithChildren
} from 'react';

interface BuilderProOutlinerPanelProps
{
    open: boolean;
    onClose: () => void;
}

export const BuilderProOutlinerPanel:
    FC<PropsWithChildren<BuilderProOutlinerPanelProps>> = props =>
{
    const {
        open,
        onClose,
        children
    } = props;

    if(!open)
    {
        return null;
    }

    return (
        <aside
            className="builder-pro-outliner-panel"
            aria-label="Capas y Outliner">
            <header className="builder-pro-outliner-panel-header">
                <strong>Capas</strong>

                <button
                    type="button"
                    className="builder-pro-outliner-panel-close"
                    title="Cerrar Capas / Outliner"
                    aria-label="Cerrar Capas / Outliner"
                    onClick={ onClose }>
                    ×
                </button>
            </header>

            <div
                className="builder-pro-outliner-panel-body"
                onPointerDown={
                    event =>
                        event.stopPropagation()
                }
                onWheel={
                    event =>
                        event.stopPropagation()
                }>
                { children }
            </div>
        </aside>
    );
};
