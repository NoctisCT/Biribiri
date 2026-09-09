// BIRIBIRI_WARDROBE_V3_5_FACE_PIPELINE_FIX
// BIRIBIRI_WARDROBE_V3_6_FACE_INSTANT_RENDER_TEST
import { AvatarEditorFigureCategory, AvatarScaleType, AvatarSetType } from '@nitrots/nitro-renderer';
import { GetAvatarRenderManager } from '../nitro';
import { AvatarEditorUtilities } from './AvatarEditorUtilities';
import { CategoryBaseModel } from './CategoryBaseModel';
import { FigureData } from './FigureData';

export class BodyModel extends CategoryBaseModel
{
    private _faceThumbnailGeneration: number = 0;

    public init(): void
    {
        super.init();

        const alreadyHadFace =
            !!this._categories.get(FigureData.FACE);

        this.addCategory(FigureData.FACE);

        if(alreadyHadFace)
        {
            this.updateSelectionsFromFigure(
                FigureData.FACE
            );
        }

        this._isInitalized = true;
    }

    public selectColor(
        category: string,
        colorIndex: number,
        paletteId: number
    ): void
    {
        super.selectColor(
            category,
            colorIndex,
            paletteId
        );

        this.updateSelectionsFromFigure(
            FigureData.FACE
        );
    }

    public selectCustomColor(
        category: string,
        colorId: number,
        paletteId: number
    ): void
    {
        super.selectCustomColor(
            category,
            colorId,
            paletteId
        );

        this.updateSelectionsFromFigure(
            FigureData.FACE
        );
    }

    public cancelPendingFaceThumbnails(): void
    {
        this._faceThumbnailGeneration++;
    }

    protected updateSelectionsFromFigure(
        name: string
    ): void
    {
        if(
            !this._categories ||
            !AvatarEditorUtilities.CURRENT_FIGURE
        ) return;

        const category =
            this._categories.get(name);

        if(!category) return;

        const setId =
            AvatarEditorUtilities.CURRENT_FIGURE
                .getPartSetId(name);

        let colorIds =
            AvatarEditorUtilities.CURRENT_FIGURE
                .getColorIds(name);

        if(!colorIds) colorIds = [];

        category.selectPartId(setId);

        // FACE en Nitro no usa el tint genérico de las prendas.
        // Sus previews se generan como AvatarSetType.HEAD.
        category.selectColorIds(
            colorIds,
            false
        );

        const generation =
            ++this._faceThumbnailGeneration;

        const parts =
            category.parts.slice();

        const renderFace = (
            part: typeof parts[number]
        ) =>
        {
            if(
                !part ||
                part.id < 0 ||
                generation !==
                    this._faceThumbnailGeneration
            ) return;

            const resetFigure = (
                figure: string
            ) =>
            {
                if(
                    generation !==
                    this._faceThumbnailGeneration
                ) return;

                const figureString =
                    AvatarEditorUtilities
                        .CURRENT_FIGURE
                        .getFigureStringWithFace(
                            part.id
                        );

                const avatarImage =
                    GetAvatarRenderManager()
                        .createAvatarImage(
                            figureString,
                            AvatarScaleType.LARGE,
                            null,
                            {
                                resetFigure,
                                dispose: null,
                                disposed: false
                            }
                        );

                if(!avatarImage) return;

                const sprite =
                    avatarImage.getImageAsSprite(
                        AvatarSetType.HEAD
                    );

                if(sprite)
                {
                    sprite.y = 10;
                    part.thumbContainer = sprite;
                }

                window.setTimeout(
                    () =>
                    {
                        try
                        {
                            avatarImage.dispose();
                        }
                        catch
                        {
                        }
                    },
                    0
                );
            };

            resetFigure(null);
        };

        for(const part of parts)
        {
            if(
                generation !==
                this._faceThumbnailGeneration
            ) break;

            renderFace(part);
        }
    }

    public get canSetGender(): boolean
    {
        return true;
    }

    public get name(): string
    {
        return AvatarEditorFigureCategory.GENERIC;
    }
}
