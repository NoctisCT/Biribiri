export type BuilderProToolId =
    | 'selection'
    | 'move'
    | 'transform'
    | 'arrange'
    | 'repeat'
    | 'replace'
    | 'collision'
    | 'layers'
    | 'blueprints';

export type BuilderProToolVariantId =
    | 'selection-click'
    | 'selection-area'
    | 'move-nudge'
    | 'move-offset'
    | 'move-reference-height'
    | 'move-place-above'
    | 'transform-orient'
    | 'transform-structure'
    | 'transform-mirror'
    | 'transform-mirror-duplicate'
    | 'arrange-row'
    | 'arrange-column'
    | 'arrange-stack'
    | 'repeat-linear'
    | 'repeat-grid'
    | 'repeat-radial'
    | 'repeat-fill'
    | 'replace-reference'
    | 'collision-traversal'
    | 'layers-outliner'
    | 'blueprints-manage'
    | 'blueprints-place';

export type BuilderProLifecyclePhase =
    | 'idle'
    | 'configuring'
    | 'preview'
    | 'applying'
    | 'invalid';

export type BuilderProTransientOperation =
    | 'none'
    | 'generic'
    | 'area-selection'
    | 'pivot-pick'
    | 'reference-equal-height'
    | 'reference-place-above'
    | 'replace'
    | 'paste'
    | 'duplicate'
    | 'mirror-duplicate'
    | 'blueprint-place'
    | 'linear-repeat'
    | 'grid-repeat'
    | 'radial-repeat'
    | 'fill-repeat';

export interface BuilderProToolDefinition
{
    id: BuilderProToolId;
    label: string;
    variants: readonly BuilderProToolVariantId[];
}

export interface BuilderProLifecycleSignals
{
    active: boolean;
    pending: boolean;
    pendingOperation: BuilderProTransientOperation;
    pendingIsPreview: boolean;
    placementOperation: BuilderProTransientOperation;
    captureOperation: BuilderProTransientOperation;
    previewOperation: BuilderProTransientOperation;
}

export interface BuilderProToolLifecycle
{
    suggestedTool: BuilderProToolId;
    operation: BuilderProTransientOperation;
    phase: BuilderProLifecyclePhase;
    hasPreview: boolean;
    isTransient: boolean;
    canCancel: boolean;
}

export const BUILDER_PRO_TOOL_DEFINITIONS:
    readonly BuilderProToolDefinition[] = [
        {
            id: 'selection',
            label: 'Selección',
            variants: [
                'selection-click',
                'selection-area'
            ]
        },
        {
            id: 'move',
            label: 'Mover',
            variants: [
                'move-nudge',
                'move-offset',
                'move-reference-height',
                'move-place-above'
            ]
        },
        {
            id: 'transform',
            label: 'Transformar',
            variants: [
                'transform-orient',
                'transform-structure',
                'transform-mirror',
                'transform-mirror-duplicate'
            ]
        },
        {
            id: 'arrange',
            label: 'Organizar',
            variants: [
                'arrange-row',
                'arrange-column',
                'arrange-stack'
            ]
        },
        {
            id: 'repeat',
            label: 'Repetición',
            variants: [
                'repeat-linear',
                'repeat-grid',
                'repeat-radial',
                'repeat-fill'
            ]
        },
        {
            id: 'replace',
            label: 'Reemplazar',
            variants: [
                'replace-reference'
            ]
        },
        {
            id: 'collision',
            label: 'Colisión',
            variants: [
                'collision-traversal'
            ]
        },
        {
            id: 'layers',
            label: 'Capas',
            variants: [
                'layers-outliner'
            ]
        },
        {
            id: 'blueprints',
            label: 'Blueprints',
            variants: [
                'blueprints-manage',
                'blueprints-place'
            ]
        }
    ];

const resolveSuggestedTool = (
    operation: BuilderProTransientOperation
): BuilderProToolId =>
{
    switch(operation)
    {
        case 'area-selection':
            return 'selection';

        case 'reference-equal-height':
        case 'reference-place-above':
            return 'move';

        case 'pivot-pick':
        case 'mirror-duplicate':
            return 'transform';

        case 'replace':
            return 'replace';

        case 'linear-repeat':
        case 'grid-repeat':
        case 'radial-repeat':
        case 'fill-repeat':
            return 'repeat';

        case 'blueprint-place':
            return 'blueprints';

        case 'paste':
        case 'duplicate':
        case 'generic':
        case 'none':
        default:
            return 'selection';
    }
};

const createLifecycle = (
    operation: BuilderProTransientOperation,
    phase: BuilderProLifecyclePhase,
    hasPreview: boolean,
    canCancel: boolean
): BuilderProToolLifecycle => ({
    suggestedTool:
        resolveSuggestedTool(
            operation
        ),
    operation,
    phase,
    hasPreview,
    isTransient:
        operation !== 'none',
    canCancel
});

export const ResolveBuilderProToolLifecycle = (
    signals: BuilderProLifecycleSignals
): BuilderProToolLifecycle =>
{
    if(!signals.active)
    {
        return createLifecycle(
            'none',
            'idle',
            false,
            false
        );
    }

    if(signals.pending)
    {
        const operation =
            signals.pendingOperation !== 'none'
                ? signals.pendingOperation
                : 'generic';

        return createLifecycle(
            operation,
            signals.pendingIsPreview
                ? 'configuring'
                : 'applying',
            signals.pendingIsPreview,
            false
        );
    }

    if(signals.placementOperation !== 'none')
    {
        return createLifecycle(
            signals.placementOperation,
            'preview',
            true,
            true
        );
    }

    if(signals.captureOperation !== 'none')
    {
        return createLifecycle(
            signals.captureOperation,
            'configuring',
            false,
            true
        );
    }

    if(signals.previewOperation !== 'none')
    {
        return createLifecycle(
            signals.previewOperation,
            'preview',
            true,
            true
        );
    }

    return createLifecycle(
        'none',
        'idle',
        false,
        false
    );
};
