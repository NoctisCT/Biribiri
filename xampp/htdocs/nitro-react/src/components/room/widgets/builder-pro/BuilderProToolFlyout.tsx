import { FC } from 'react';
import {
    BuilderProToolId,
    BuilderProToolVariantId
} from './BuilderProToolLifecycle';

interface BuilderProToolFlyoutProps
{
    tool: BuilderProToolId | null;
    activeVariant: BuilderProToolVariantId | null;
    disabled: boolean;
    onSelectVariant: (
        variant: BuilderProToolVariantId
    ) => void;
    onClose: () => void;
}

interface FlyoutOption
{
    id: BuilderProToolVariantId;
    label: string;
    shortLabel: string;
}

const SELECTION_OPTIONS: readonly FlyoutOption[] = [
    {
        id: 'selection-click',
        label: 'Selección por clic',
        shortLabel: 'Puntero'
    },
    {
        id: 'selection-area',
        label: 'Selección por área',
        shortLabel: 'Área'
    }
];

/* B3_MIRROR_GROUPED */
const TRANSFORM_OPTIONS: readonly FlyoutOption[] = [
    {
        id: 'transform-orient',
        label: 'Girar furnis',
        shortLabel: 'Girar furnis'
    },
    {
        id: 'transform-structure',
        label: 'Girar estructura',
        shortLabel: 'Estructura'
    },
    {
        id: 'transform-mirror',
        label: 'Espejo',
        shortLabel: 'Espejo'
    }
];

const REPEAT_OPTIONS: readonly FlyoutOption[] = [
    {
        id: 'repeat-linear',
        label: 'Repetición lineal',
        shortLabel: 'Lineal'
    },
    {
        id: 'repeat-grid',
        label: 'Cuadrícula',
        shortLabel: 'Cuadrícula'
    },
    {
        id: 'repeat-radial',
        label: 'Patrón radial',
        shortLabel: 'Radial'
    },
    {
        id: 'repeat-fill',
        label: 'Rellenar',
        shortLabel: 'Rellenar'
    }
];

export const BuilderProToolFlyout:
    FC<BuilderProToolFlyoutProps> = props =>
{
    const {
        tool,
        activeVariant,
        disabled,
        onSelectVariant,
        onClose
    } = props;

    const options =
        tool === 'selection'
            ? SELECTION_OPTIONS
            : tool === 'transform'
                ? TRANSFORM_OPTIONS
                : tool === 'repeat'
                    ? REPEAT_OPTIONS
                    : null;

    const label =
        tool === 'selection'
            ? 'Selección'
            : tool === 'transform'
                ? 'Transformar'
                : tool === 'repeat'
                    ? 'Repetición'
                    : '';

    if(!options)
    {
        return null;
    }

    return (
        <div
            className="builder-pro-tool-flyout"
            role="menu"
            aria-label={ `Subherramientas de ${ label }` }>
            <div className="builder-pro-tool-flyout-header">
                <strong>
                    { label }
                </strong>

                <button
                    type="button"
                    className="builder-pro-tool-flyout-close"
                    title="Cerrar"
                    aria-label="Cerrar subherramientas"
                    onClick={ onClose }>
                    ×
                </button>
            </div>

            <div className="builder-pro-tool-flyout-options">
                { options.map(option =>
                    <button
                        key={ option.id }
                        type="button"
                        role="menuitemradio"
                        className={
                            `builder-pro-tool-flyout-option${
                                activeVariant === option.id
                                    ? ' is-active'
                                    : ''
                            }`
                        }
                        title={ option.label }
                        aria-label={ option.label }
                        aria-checked={
                            activeVariant === option.id
                        }
                        disabled={ disabled }
                        onClick={
                            () =>
                                onSelectVariant(
                                    option.id
                                )
                        }>
                        { option.shortLabel }
                    </button>
                ) }
            </div>
        </div>
    );
};
