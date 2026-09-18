import { AvatarAction, AvatarScaleType, AvatarSetType, ConfigurationEvent, Nitro, NitroConfiguration } from '@nitrots/nitro-renderer';
import { FC, useEffect } from 'react';
import { GetNitroInstance } from './api';

interface AvatarRequest
{
    type: 'avatar-bridge-render';
    id: string | number;
    figure: string;
    gender?: string;
    direction?: number;
    gesture?: string;
    posture?: string;
    action?: string;
    frame?: number;
}

export const AvatarBridgeApp: FC<{}> = () =>
{
    useEffect(() =>
    {
        let ready = false;
        let disposed = false;
        let initializing = false;

        const parameters = new URLSearchParams(window.location.search);
        const previewFigureData = parameters.get('preview-figuredata');
        const previewFigureMap = parameters.get('preview-figuremap');
        const previewAssetUrl = parameters.get('preview-asset');
        const previewMode = !!(
            previewFigureData &&
            previewFigureMap &&
            previewAssetUrl
        );

        const post = (message: any) =>
        {
            if(window.parent === window) return;

            window.parent.postMessage(message, window.location.origin);
        };

        const fatal = (stage: string, detail?: string) =>
        {
            post({
                type: 'avatar-bridge-fatal',
                stage,
                detail
            });
        };

        const renderError = (
            request: AvatarRequest,
            stage: string,
            detail?: string
        ) =>
        {
            post({
                type: 'avatar-bridge-error',
                id: String(request.id),
                stage,
                detail
            });
        };

        const fetchJson = async (
            url: string,
            label: string
        ): Promise<any> =>
        {
            const response = await fetch(url, {
                credentials: 'same-origin',
                cache: 'no-store'
            });

            if(!response.ok)
            {
                throw new Error(
                    `${ label }: HTTP ${ response.status }`
                );
            }

            const text = await response.text();

            try
            {
                return JSON.parse(text);
            }
            catch(error)
            {
                throw new Error(
                    `${ label }: la respuesta no es JSON`
                );
            }
        };

        const validatePreviewSources = async (): Promise<void> =>
        {
            if(!previewMode) return;

            const figureData = await fetchJson(
                previewFigureData,
                'preview-figuredata'
            );

            const figureMap = await fetchJson(
                previewFigureMap,
                'preview-figuremap'
            );

            if(
                !figureData ||
                !Array.isArray(figureData.setTypes)
            )
            {
                throw new Error(
                    'preview-figuredata: setTypes invalido'
                );
            }

            if(
                !figureMap ||
                !Array.isArray(figureMap.libraries)
            )
            {
                throw new Error(
                    'preview-figuremap: libraries invalido'
                );
            }

            const customLibraries = figureMap.libraries
                .map((library: any) =>
                    String(library?.id || '').trim()
                )
                .filter((id: string) =>
                    id.toLowerCase().includes('biri')
                );

            for(const libraryId of customLibraries)
            {
                const assetUrl = previewAssetUrl.replace(
                    '%libname%',
                    encodeURIComponent(libraryId)
                );

                const response = await fetch(assetUrl, {
                    credentials: 'same-origin',
                    cache: 'no-store'
                });

                if(!response.ok)
                {
                    throw new Error(
                        `preview-asset:${ libraryId }: HTTP ${ response.status }`
                    );
                }

                const bytes = await response.arrayBuffer();

                if(bytes.byteLength === 0)
                {
                    throw new Error(
                        `preview-asset:${ libraryId }: fichero vacio`
                    );
                }
            }
        };

        const renderAvatar = (
            request: AvatarRequest,
            attempt = 0
        ) =>
        {
            if(disposed) return;

            const nitro = GetNitroInstance();

            if(
                !ready ||
                !nitro ||
                !nitro.avatar ||
                !nitro.avatar.isReady
            )
            {
                if(attempt < 100)
                {
                    window.setTimeout(
                        () => renderAvatar(
                            request,
                            attempt + 1
                        ),
                        100
                    );
                }
                else
                {
                    renderError(
                        request,
                        'avatar-manager-timeout'
                    );
                }

                return;
            }

            const listener = {
                resetFigure: () => {},
                dispose: () => {},
                disposed: false
            };

            let avatarImage: any = null;

            try
            {
                const figureContainer =
                    nitro.avatar.createFigureContainer(
                        request.figure || ''
                    );

                if(
                    !nitro.avatar.isFigureContainerReady(
                        figureContainer
                    )
                )
                {
                    nitro.avatar.downloadAvatarFigure(
                        figureContainer,
                        listener
                    );

                    if(attempt < 100)
                    {
                        window.setTimeout(
                            () => renderAvatar(
                                request,
                                attempt + 1
                            ),
                            150
                        );
                    }
                    else
                    {
                        renderError(
                            request,
                            'figure-assets-timeout'
                        );
                    }

                    return;
                }

                avatarImage = nitro.avatar.createAvatarImage(
                    request.figure || '',
                    AvatarScaleType.LARGE,
                    request.gender || 'M',
                    listener,
                    null
                );

                if(!avatarImage)
                {
                    renderError(
                        request,
                        'avatar-image-null'
                    );

                    return;
                }

                avatarImage.setDirection(
                    AvatarSetType.FULL,
                    Number.isFinite(request.direction)
                        ? request.direction
                        : 2
                );

                avatarImage.initActionAppends();

                avatarImage.appendAction(
                    AvatarAction.POSTURE,
                    request.posture ||
                        AvatarAction.POSTURE_STAND
                );

                if(request.gesture)
                {
                    avatarImage.appendAction(
                        AvatarAction.GESTURE,
                        request.gesture
                    );
                }

                if(
                    request.action &&
                    request.action.startsWith('dance:')
                )
                {
                    const danceNumber = Number(
                        request.action.split(':')[1]
                    );

                    if(
                        Number.isInteger(danceNumber) &&
                        danceNumber >= 1 &&
                        danceNumber <= 4
                    )
                    {
                        avatarImage.appendAction(
                            AvatarAction.DANCE,
                            danceNumber
                        );
                    }
                }
                else switch(request.action)
                {
                    case AvatarAction.EXPRESSION_WAVE:
                        avatarImage.appendAction(
                            AvatarAction.EXPRESSION_WAVE
                        );
                        break;
                    case AvatarAction.EXPRESSION_BLOW_A_KISS:
                        avatarImage.appendAction(
                            AvatarAction.EXPRESSION_BLOW_A_KISS
                        );
                        break;
                    case AvatarAction.EXPRESSION_LAUGH:
                        avatarImage.appendAction(
                            AvatarAction.EXPRESSION_LAUGH
                        );
                        break;
                    case AvatarAction.EXPRESSION_RESPECT:
                        avatarImage.appendAction(
                            AvatarAction.EXPRESSION_RESPECT
                        );
                        break;
                    case AvatarAction.TALK:
                        avatarImage.appendAction(
                            AvatarAction.TALK
                        );
                        break;
                    case AvatarAction.SLEEP:
                        avatarImage.appendAction(
                            AvatarAction.SLEEP
                        );
                        break;
                }

                avatarImage.endActionAppends();

                const qaFrame = Number.isFinite(request.frame)
                    ? Math.max(
                        0,
                        Math.floor(request.frame)
                    )
                    : 0;

                if(qaFrame > 0)
                {
                    avatarImage.updateAnimationByFrames(
                        qaFrame
                    );
                }

                const image = avatarImage.getCroppedImage(
                    AvatarSetType.FULL
                );

                if(!image || !image.src)
                {
                    renderError(
                        request,
                        'cropped-image-null'
                    );

                    return;
                }

                post({
                    type: 'avatar-bridge-result',
                    id: String(request.id),
                    src: image.src
                });
            }
            catch(error)
            {
                renderError(
                    request,
                    'exception',
                    error instanceof Error
                        ? error.message
                        : String(error)
                );
            }
            finally
            {
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
        };

        const onMessage = (event: MessageEvent) =>
        {
            if(event.origin !== window.location.origin) return;

            const data = event.data as AvatarRequest;

            if(
                !data ||
                data.type !== 'avatar-bridge-render'
            ) return;

            renderAvatar(data);
        };

        window.addEventListener(
            'message',
            onMessage
        );

        if(!GetNitroInstance())
        {
            Nitro.bootstrap();
        }

        const nitro = GetNitroInstance();

        if(!nitro)
        {
            fatal('nitro-bootstrap-null');

            return () =>
            {
                disposed = true;

                window.removeEventListener(
                    'message',
                    onMessage
                );
            };
        }

        const announceWhenReady = (
            attempt = 0
        ) =>
        {
            if(disposed || ready) return;

            if(
                nitro.avatar &&
                nitro.avatar.isReady
            )
            {
                ready = true;

                [ 0, 250, 750, 1500 ].forEach(
                    delay =>
                    {
                        window.setTimeout(() =>
                        {
                            if(disposed) return;

                            post({
                                type:
                                    'avatar-bridge-ready'
                            });
                        }, delay);
                    }
                );

                return;
            }

            if(attempt < 100)
            {
                window.setTimeout(
                    () => announceWhenReady(
                        attempt + 1
                    ),
                    100
                );

                return;
            }

            fatal('avatar-init-timeout');
        };

        const onConfigurationLoaded = async () =>
        {
            if(
                disposed ||
                initializing ||
                ready
            ) return;

            initializing = true;

            try
            {
                if(previewMode)
                {
                    await validatePreviewSources();

                    NitroConfiguration.setValue(
                        'avatar.figuredata.url',
                        previewFigureData
                    );
                    NitroConfiguration.setValue(
                        'avatar.figuremap.url',
                        previewFigureMap
                    );
                    NitroConfiguration.setValue(
                        'avatar.asset.url',
                        previewAssetUrl
                    );
                }

                nitro.avatar.init();

                announceWhenReady();
            }
            catch(error)
            {
                fatal(
                    'preview-source-error',
                    error instanceof Error
                        ? error.message
                        : String(error)
                );
            }
        };

        nitro.core.configuration.events.addEventListener(
            ConfigurationEvent.LOADED,
            onConfigurationLoaded
        );

        nitro.core.configuration.init();

        return () =>
        {
            disposed = true;

            window.removeEventListener(
                'message',
                onMessage
            );
        };
    }, []);

    return null;
};
