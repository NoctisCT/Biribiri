import { AvatarEditorFigureCategory } from '@nitrots/nitro-renderer';
import { CategoryBaseModel } from './CategoryBaseModel';
import { GetClothingCategoryTypesByGroup } from './ClothingCategoryRegistry';

export class TorsoModel extends CategoryBaseModel
{
    public init(): void
    {
        super.init();

        for(const type of GetClothingCategoryTypesByGroup('torso'))
        {
            this.addCategory(type);
        }

        this._isInitalized = true;
    }

    public get name(): string
    {
        return AvatarEditorFigureCategory.TORSO;
    }
}
