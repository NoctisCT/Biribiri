import { FC } from 'react';
import {
    BUILDER_PRO_TOOL_DEFINITIONS,
    BuilderProToolId
} from './BuilderProToolLifecycle';

interface BuilderProToolRailProps
{
    activeTool: BuilderProToolId;
    displayTool: BuilderProToolId;
    locked: boolean;
    onSelectTool: (tool: BuilderProToolId) => void;
}

const TOOL_GLYPHS: Record<BuilderProToolId, string> = {
    selection: '↖',
    move: '✥',
    transform: '↻',
    arrange: '≡',
    repeat: '⧉',
    replace: '⇄',
    collision: '◇',
    blueprints: '▣',
    backup: '▤'
};

const TOOL_FLYOUTS:
    ReadonlySet<BuilderProToolId> =
    new Set([
        'selection',
        'transform',
        'repeat'
    ]);

export const BuilderProToolRail: FC<BuilderProToolRailProps> = props =>
{
    const {
        activeTool,
        displayTool,
        locked,
        onSelectTool
    } = props;

    const visibleDefinitions =
        BUILDER_PRO_TOOL_DEFINITIONS;

    return (
        <div
            className="builder-pro-tool-rail builder-pro-floating-tool-rail"
            role="toolbar"
            aria-label="Herramientas de Construcción Avanzada">
            { visibleDefinitions.map(definition =>
            {
                const isDisplayed =
                    displayTool === definition.id;

                const isPinned =
                    activeTool === definition.id;

                const hasFlyout =
                    TOOL_FLYOUTS.has(
                        definition.id
                    );

                return (
                    <button
                        key={ definition.id }
                        type="button"
                        className={
                            `builder-pro-tool-button${
                                isDisplayed
                                    ? ' is-active'
                                    : ''
                            }${
                                isPinned
                                    ? ' is-pinned'
                                    : ''
                            }`
                        }
                        data-tool={ definition.id }
                        data-tooltip={ definition.label }
                        data-has-flyout={
                            hasFlyout
                                ? 'true'
                                : undefined
                        }
                        title={ definition.label }
                        aria-label={ definition.label }
                        aria-pressed={ isDisplayed }
                        aria-haspopup={
                            hasFlyout
                                ? 'menu'
                                : undefined
                        }
                        aria-disabled={ locked }
                        onClick={ () =>
                        {
                            if(locked)
                            {
                                return;
                            }

                            onSelectTool(
                                definition.id
                            );
                        } }>
                        <span
                            className="builder-pro-tool-glyph"
                            aria-hidden="true">
                            { TOOL_GLYPHS[definition.id] }
                        </span>

                        { hasFlyout &&
                            <span
                                className="builder-pro-tool-caret"
                                aria-hidden="true">
                                ◢
                            </span> }
                    </button>
                );
            }) }
        </div>
    );
};
