export type BuilderProToolId =
    | 'selection'
    | 'move'
    | 'transform'
    | 'arrange'
    | 'repeat'
    | 'replace'
    | 'collision'
    | 'blueprints'
    | 'backup';

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
    | 'blueprints-manage'
    | 'blueprints-place'
    | 'backup-manage';

export type BuilderProLifecyclePhase =
    | 'idle'
    | 'configuring'
    | 'preview'
    | 'applying'
    | 'invalid';
export type BuilderProLifecycleSource =
    | 'none'
    | 'pending'
    | 'placement'
    | 'capture'
    | 'preview';

export interface BuilderProTransientChannelSignals
{
    pending: {
        fillRepeat: boolean;
        radialRepeat: boolean;
        gridRepeat: boolean;
        linearRepeat: boolean;
        replaceExecute: boolean;
        referenceEqualHeight: boolean;
        referencePlaceAbove: boolean;
        blueprintPlace: boolean;
        fillRepeatPreview: boolean;
        radialRepeatPreview: boolean;
        gridRepeatPreview: boolean;
        linearRepeatPreview: boolean;
        replacePreview: boolean;
        blueprintPreview: boolean;
    };
    placement: {
        blueprintPlace: boolean;
        duplicate: boolean;
        mirrorDuplicate: boolean;
        paste: boolean;
    };
    capture: {
        replace: boolean;
        referenceEqualHeight: boolean;
        referencePlaceAbove: boolean;
        pivot: boolean;
        area: boolean;
    };
    preview: {
        fillRepeat: boolean;
        radialRepeat: boolean;
        gridRepeat: boolean;
        linearRepeat: boolean;
        replacePrepared: boolean;
    };
}

export interface BuilderProResolvedTransientChannels
{
    pendingOperation: BuilderProTransientOperation;
    pendingIsPreview: boolean;
    placementOperation: BuilderProTransientOperation;
    captureOperation: BuilderProTransientOperation;
    previewOperation: BuilderProTransientOperation;
}

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
    source: BuilderProLifecycleSource;
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
            id: 'blueprints',
            label: 'Blueprints',
            variants: [
                'blueprints-manage',
                'blueprints-place'
            ]
        },
        {
            id: 'backup',
            label: 'Backup',
            variants: [
                'backup-manage'
            ]
        }
    ];

export const ResolveBuilderProTransientChannels = (
    signals: BuilderProTransientChannelSignals
): BuilderProResolvedTransientChannels =>
{
    const pendingOperation:
        BuilderProTransientOperation =
        signals.pending.fillRepeat
            ? 'fill-repeat'
            : signals.pending.radialRepeat
                ? 'radial-repeat'
                : signals.pending.gridRepeat
                    ? 'grid-repeat'
                    : signals.pending.linearRepeat
                        ? 'linear-repeat'
                        : signals.pending.replaceExecute
                            ? 'replace'
                            : signals.pending.referenceEqualHeight
                                ? 'reference-equal-height'
                                : signals.pending.referencePlaceAbove
                                    ? 'reference-place-above'
                                    : signals.pending.blueprintPlace
                                        ? 'blueprint-place'
                                        : 'none';

    const pendingIsPreview =
        signals.pending.fillRepeatPreview ||
        signals.pending.radialRepeatPreview ||
        signals.pending.gridRepeatPreview ||
        signals.pending.linearRepeatPreview ||
        signals.pending.replacePreview ||
        signals.pending.blueprintPreview;

    const placementOperation:
        BuilderProTransientOperation =
        signals.placement.blueprintPlace
            ? 'blueprint-place'
            : (
                signals.placement.duplicate &&
                signals.placement.mirrorDuplicate
            )
                ? 'mirror-duplicate'
                : signals.placement.duplicate
                    ? 'duplicate'
                    : signals.placement.paste
                        ? 'paste'
                        : 'none';

    const captureOperation:
        BuilderProTransientOperation =
        signals.capture.replace
            ? 'replace'
            : signals.capture.referenceEqualHeight
                ? 'reference-equal-height'
                : signals.capture.referencePlaceAbove
                    ? 'reference-place-above'
                    : signals.capture.pivot
                        ? 'pivot-pick'
                        : signals.capture.area
                            ? 'area-selection'
                            : 'none';

    const previewOperation:
        BuilderProTransientOperation =
        signals.preview.fillRepeat
            ? 'fill-repeat'
            : signals.preview.radialRepeat
                ? 'radial-repeat'
                : signals.preview.gridRepeat
                    ? 'grid-repeat'
                    : signals.preview.linearRepeat
                        ? 'linear-repeat'
                        : signals.preview.replacePrepared
                            ? 'replace'
                            : 'none';

    return {
        pendingOperation,
        pendingIsPreview,
        placementOperation,
        captureOperation,
        previewOperation
    };
};

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
    source: BuilderProLifecycleSource,
    phase: BuilderProLifecyclePhase,
    hasPreview: boolean,
    canCancel: boolean
): BuilderProToolLifecycle => ({
    suggestedTool:
        resolveSuggestedTool(
            operation
        ),
    operation,
    source,
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
            'pending',
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
            'placement',
            'preview',
            true,
            true
        );
    }

    if(signals.captureOperation !== 'none')
    {
        return createLifecycle(
            signals.captureOperation,
            'capture',
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
            'preview',
            true,
            true
        );
    }

    return createLifecycle(
        'none',
        'none',
        'idle',
        false,
        false
    );
};
