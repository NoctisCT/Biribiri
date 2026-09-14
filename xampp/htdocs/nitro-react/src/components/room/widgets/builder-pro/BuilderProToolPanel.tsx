import {
    FC,
    PropsWithChildren
} from 'react';
import {
    BUILDER_PRO_TOOL_DEFINITIONS,
    BuilderProLifecyclePhase,
    BuilderProToolId
} from './BuilderProToolLifecycle';

interface BuilderProToolPanelProps
{
    tool: BuilderProToolId;
    phase: BuilderProLifecyclePhase;
}

export const BuilderProToolPanel:
    FC<PropsWithChildren<BuilderProToolPanelProps>> = props =>
{
    const {
        tool,
        phase,
        children
    } = props;

    const label =
        BUILDER_PRO_TOOL_DEFINITIONS.find(
            definition =>
                definition.id === tool
        )?.label || 'Herramienta';

    return (
        <section
            className="builder-pro-tool-panel builder-pro-context-bar"
            data-builder-pro-context-tool={ tool }
            data-builder-pro-context-phase={ phase }>
            <div className="builder-pro-context-tool-name">
                { label }
            </div>

            <div className="builder-pro-tool-panel-body">
                { children }
            </div>
        </section>
    );
};
