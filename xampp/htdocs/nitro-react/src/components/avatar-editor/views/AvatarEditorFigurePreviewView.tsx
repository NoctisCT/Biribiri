// BIRIBIRI_WARDROBE_P5_ADVANCED_PREVIEW
import { AvatarAction, AvatarDirectionAngle, AvatarScaleType, AvatarSetType, IAvatarImage } from '@nitrots/nitro-renderer';
import { FC, useEffect, useMemo, useState } from 'react';
import { FigureData, GetAvatarRenderManager } from '../../../api';
import { Base, Column } from '../../../common';

export interface AvatarEditorFigurePreviewViewProps
{
    figureData: FigureData;
}

interface PreviewActionDefinition
{
    id: string;
    label: string;
    action: string | null;
    parameter?: string | number;
}

const PREVIEW_POSTURES =
[
    {
        value: AvatarAction.POSTURE_STAND,
        label: 'De pie'
    },
    {
        value: AvatarAction.POSTURE_WALK,
        label: 'Caminando'
    },
    {
        value: AvatarAction.POSTURE_SIT,
        label: 'Sentado'
    },
    {
        value: AvatarAction.POSTURE_LAY,
        label: 'Tumbado'
    }
];

const PREVIEW_SIT_DIRECTIONS =
[
    0,
    2,
    4,
    6
];

const PREVIEW_ACTIONS: PreviewActionDefinition[] =
[
    {
        id: 'none',
        label: 'Ninguna',
        action: null
    },
    {
        id: 'wave',
        label: 'Saludar',
        action: AvatarAction.EXPRESSION_WAVE
    },
    {
        id: 'laugh',
        label: 'Re\u00edr',
        action: AvatarAction.EXPRESSION_LAUGH
    },
    {
        id: 'kiss',
        label: 'Lanzar beso',
        action: AvatarAction.EXPRESSION_BLOW_A_KISS
    },
    {
        id: 'respect',
        label: 'Respeto',
        action: AvatarAction.EXPRESSION_RESPECT
    },
    {
        id: 'talk',
        label: 'Hablar',
        action: AvatarAction.TALK
    },
    {
        id: 'sleep',
        label: 'Dormir',
        action: AvatarAction.SLEEP
    },
    {
        id: 'smile',
        label: 'Sonre\u00edr',
        action: AvatarAction.GESTURE,
        parameter: AvatarAction.GESTURE_SMILE
    },
    {
        id: 'sad',
        label: 'Triste',
        action: AvatarAction.GESTURE,
        parameter: AvatarAction.GESTURE_SAD
    },
    {
        id: 'angry',
        label: 'Enfadado',
        action: AvatarAction.GESTURE,
        parameter: AvatarAction.GESTURE_AGGRAVATED
    },
    {
        id: 'surprised',
        label: 'Sorprendido',
        action: AvatarAction.GESTURE,
        parameter: AvatarAction.GESTURE_SURPRISED
    },
    {
        id: 'dance-1',
        label: 'Baile 1',
        action: AvatarAction.DANCE,
        parameter: 1
    },
    {
        id: 'dance-2',
        label: 'Baile 2',
        action: AvatarAction.DANCE,
        parameter: 2
    },
    {
        id: 'dance-3',
        label: 'Baile 3',
        action: AvatarAction.DANCE,
        parameter: 3
    },
    {
        id: 'dance-4',
        label: 'Baile 4',
        action: AvatarAction.DANCE,
        parameter: 4
    }
];

export const AvatarEditorFigurePreviewView: FC<AvatarEditorFigurePreviewViewProps> = props =>
{
    const { figureData = null } = props;

    const [ updateId, setUpdateId ] =
        useState(-1);

    const [ avatarUrl, setAvatarUrl ] =
        useState<string>(null);

    const [ posture, setPosture ] =
        useState<string>(
            AvatarAction.POSTURE_STAND
        );

    const [ actionId, setActionId ] =
        useState<string>('none');

    const selectedAction =
        useMemo(
            () =>
                PREVIEW_ACTIONS.find(
                    action =>
                        action.id === actionId
                ) || PREVIEW_ACTIONS[0],
            [ actionId ]
        );

    // BIRIBIRI_WARDROBE_P5_1_PREVIEW_POLISH
    // BIRIBIRI_WARDROBE_P5_2_VALID_ROTATIONS
    const rotateFigure = (direction: number) =>
    {
        if(
            posture ===
            AvatarAction.POSTURE_LAY
        )
        {
            direction =
                (
                    figureData.direction === 0
                        ? 2
                        : 0
                );
        }
        else if(
            posture ===
            AvatarAction.POSTURE_SIT
        )
        {
            const currentIndex =
                PREVIEW_SIT_DIRECTIONS.indexOf(
                    figureData.direction
                );

            direction =
                PREVIEW_SIT_DIRECTIONS[
                    currentIndex < 0
                        ? 1
                        : (
                            (currentIndex + 1) %
                            PREVIEW_SIT_DIRECTIONS.length
                        )
                ];
        }
        else
        {
            if(
                direction <
                AvatarDirectionAngle.MIN_DIRECTION
            )
            {
                direction =
                    (
                        AvatarDirectionAngle.MAX_DIRECTION +
                        (direction + 1)
                    );
            }

            if(
                direction >
                AvatarDirectionAngle.MAX_DIRECTION
            )
            {
                direction =
                    (
                        direction -
                        (
                            AvatarDirectionAngle.MAX_DIRECTION +
                            1
                        )
                    );
            }
        }

        figureData.direction = direction;

        setUpdateId(
            previous =>
                previous + 1
        );
    }

    useEffect(() =>
    {
        if(
            !figureData ||
            posture !== AvatarAction.POSTURE_SIT ||
            PREVIEW_SIT_DIRECTIONS.includes(
                figureData.direction
            )
        ) return;

        figureData.direction = 2;

        setUpdateId(
            previous =>
                previous + 1
        );
    }, [
        posture,
        figureData
    ]);

    useEffect(() =>
    {
        if(!figureData) return;

        figureData.notify =
            () =>
                setUpdateId(
                    previous =>
                        previous + 1
                );

        return () =>
        {
            figureData.notify = null;
        }
    }, [ figureData ]);

    useEffect(() =>
    {
        if(!figureData) return;

        let disposed = false;
        let intervalId: number = null;
        let avatarImage: IAvatarImage = null;

        const renderFrame = () =>
        {
            if(
                disposed ||
                !avatarImage
            ) return;

            const image =
                avatarImage.getCroppedImage(
                    AvatarSetType.FULL
                );

            if(
                !disposed &&
                image &&
                image.src
            )
            {
                setAvatarUrl(
                    image.src
                );
            }
        }

        try
        {
            avatarImage =
                GetAvatarRenderManager()
                    .createAvatarImage(
                        figureData.getFigureString(),
                        AvatarScaleType.LARGE,
                        figureData.gender,
                        {
                            resetFigure: () =>
                            {
                                if(!disposed)
                                {
                                    setUpdateId(
                                        previous =>
                                            previous + 1
                                    );
                                }
                            },
                            dispose: () => {},
                            disposed: false
                        },
                        null
                    );

            if(!avatarImage) return;

            avatarImage.setDirection(
                AvatarSetType.FULL,
                figureData.direction
            );

            avatarImage.initActionAppends();

            avatarImage.appendAction(
                AvatarAction.POSTURE,
                posture
            );

            if(selectedAction.action)
            {
                if(
                    selectedAction.parameter !==
                    undefined
                )
                {
                    avatarImage.appendAction(
                        selectedAction.action,
                        selectedAction.parameter
                    );
                }
                else
                {
                    avatarImage.appendAction(
                        selectedAction.action
                    );
                }
            }

            avatarImage.endActionAppends();

            renderFrame();

            if(avatarImage.isAnimating())
            {
                intervalId =
                    window.setInterval(
                        () =>
                        {
                            if(
                                disposed ||
                                !avatarImage
                            ) return;

                            avatarImage
                                .updateAnimationByFrames(
                                    1
                                );

                            renderFrame();
                        },
                        140
                    );
            }
        }
        catch(error)
        {
            // La preview nunca debe romper el editor completo.
            setAvatarUrl(null);
        }

        return () =>
        {
            disposed = true;

            if(intervalId !== null)
            {
                window.clearInterval(
                    intervalId
                );
            }

            if(avatarImage)
            {
                try
                {
                    avatarImage.dispose();
                }
                catch(error)
                {
                }
            }
        }
    }, [
        figureData,
        updateId,
        posture,
        selectedAction
    ]);

    return (
        <Column
            className="figure-preview-container biribiri-advanced-preview"
            overflow="hidden"
            position="relative">

            { avatarUrl &&
                <Base
                    className={
                        `avatar-image biribiri-advanced-preview-avatar${
                            posture === AvatarAction.POSTURE_SIT
                                ? ' is-sitting'
                                : (
                                    posture === AvatarAction.POSTURE_LAY
                                        ? ' is-laying'
                                        : ''
                                )
                        }`
                    }
                    style={
                        {
                            backgroundImage:
                                `url('${ avatarUrl }')`,
                            transform:
                                'scale(2)',
                            imageRendering:
                                'pixelated'
                        }
                    }
                /> }

            <Base className="avatar-shadow" />

            <Base className="arrow-container">
                <i
                    className="icon arrow-left"
                    title="Girar avatar"
                    onClick={
                        () =>
                            rotateFigure(
                                figureData.direction +
                                1
                            )
                    }
                />
            </Base>

            <div className="biribiri-preview-controls">
                <label className="biribiri-preview-control">
                    <span>Postura</span>
                    <select
                        value={ posture }
                        aria-label="Postura de preview"
                        onChange={
                            event =>
                                setPosture(
                                    event.target.value
                                )
                        }>
                        { PREVIEW_POSTURES.map(
                            option =>
                                <option
                                    key={ option.value }
                                    value={ option.value }>
                                    { option.label }
                                </option>
                        ) }
                    </select>
                </label>

                <label className="biribiri-preview-control">
                    <span>
                        { 'Acci\u00f3n' }
                    </span>
                    <select
                        value={ actionId }
                        aria-label={ 'Acci\u00f3n de preview' }
                        onChange={
                            event =>
                                setActionId(
                                    event.target.value
                                )
                        }>
                        { PREVIEW_ACTIONS.map(
                            option =>
                                <option
                                    key={ option.id }
                                    value={ option.id }>
                                    { option.label }
                                </option>
                        ) }
                    </select>
                </label>
            </div>
        </Column>
    );
}
