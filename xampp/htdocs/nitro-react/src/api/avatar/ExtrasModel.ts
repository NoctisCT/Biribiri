// BIRIBIRI_EXTENDED_CLOTHING_ARCH_V1_2
import { CategoryBaseModel } from './CategoryBaseModel';
import { GetClothingCategoryTypesByGroup } from './ClothingCategoryRegistry';

export class ExtrasModel extends CategoryBaseModel
{
    public init(): void
    {
        super.init();

        for(const type of GetClothingCategoryTypesByGroup('extras'))
        {
            this.addCategory(type);
        }

        this._isInitalized = true;
    }

    public get name(): string
    {
        return 'extras';
    }
}
