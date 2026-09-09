import { IPartColor } from '@nitrots/nitro-renderer';
import { AvatarEditorGridColorItem } from './AvatarEditorGridColorItem';
import { DecodeBiribiriCustomColor, IsBiribiriCustomColorId } from './BiribiriCustomColor';
import { AvatarEditorGridPartItem } from './AvatarEditorGridPartItem';

export class CategoryData
{
    private _name: string;
    private _parts: AvatarEditorGridPartItem[];
    private _palettes: AvatarEditorGridColorItem[][];
    private _selectedPartIndex: number = -1;
    private _paletteIndexes: number[];
    private _partColorUpdateGeneration: number = 0;

    constructor(name: string, partItems: AvatarEditorGridPartItem[], colorItems: AvatarEditorGridColorItem[][])
    {
        this._name = name;
        this._parts = partItems;
        this._palettes = colorItems;
        this._selectedPartIndex = -1;
    }

    private static defaultColorId(palettes: AvatarEditorGridColorItem[], clubLevel: number): number
    {
        if(!palettes || !palettes.length) return -1;

        let i = 0;

        while(i < palettes.length)
        {
            const colorItem = palettes[i];

            if(colorItem.partColor && (colorItem.partColor.clubLevel <= clubLevel))
            {
                return colorItem.partColor.id;
            }

            i++;
        }

        return -1;
    }

    // BIRIBIRI_WARDROBE_V3_7_ALL_INSTANT_AND_REOPEN_REFRESH
    public init(): void
    {
        if(!this._parts || !this._parts.length) return;

        for(const part of this._parts)
        {
            if(!part) continue;

            part.init();
        }
    }

    public dispose(): void
    {
        if(this._parts)
        {
            for(const part of this._parts) part.dispose();

            this._parts = null;
        }

        if(this._palettes)
        {
            for(const palette of this._palettes) for(const colorItem of palette) colorItem.dispose();

            this._palettes = null;
        }

        this._partColorUpdateGeneration++;
        this._selectedPartIndex = -1;
        this._paletteIndexes = null;
    }

    public selectPartId(partId: number): void
    {
        if(!this._parts) return;

        let i = 0;

        while(i < this._parts.length)
        {
            const partItem = this._parts[i];

            if(partItem.id === partId)
            {
                this.selectPartIndex(i);

                return;
            }

            i++;
        }
    }

    public selectColorIds(colorIds: number[], updatePartThumbnails: boolean = true): void
    {
        if(!colorIds || !this._palettes) return;

        this._paletteIndexes = new Array(colorIds.length);

        for(let paletteId = 0; paletteId < colorIds.length; paletteId++)
        {
            this.ensureCustomColorItem(
                colorIds[paletteId],
                paletteId
            );
        }

        let i = 0;

        while(i < this._palettes.length)
        {
            const palette = this.getPalette(i);

            if(palette)
            {
                let colorId = 0;

                if(colorIds.length > i)
                {
                    colorId = colorIds[i];
                }
                else
                {
                    const colorItem = palette[0];

                    if(colorItem && colorItem.partColor) colorId = colorItem.partColor.id;
                }

                let j = 0;

                while(j < palette.length)
                {
                    const colorItem = palette[j];

                    if(colorItem.partColor.id === colorId)
                    {
                        this._paletteIndexes[i] = j;

                        colorItem.isSelected = true;
                    }
                    else
                    {
                        colorItem.isSelected = false;
                    }

                    j++;
                }
            }

            i++;
        }

        if(updatePartThumbnails)
        {
            this.updatePartColors();
        }
    }

    public selectPartIndex(partIndex: number): AvatarEditorGridPartItem
    {
        if(!this._parts) return null;

        if((this._selectedPartIndex >= 0) && (this._parts.length > this._selectedPartIndex))
        {
            const partItem = this._parts[this._selectedPartIndex];

            if(partItem) partItem.isSelected = false;
        }

        if(this._parts.length > partIndex)
        {
            const partItem = this._parts[partIndex];

            if(partItem)
            {
                partItem.isSelected = true;

                this._selectedPartIndex = partIndex;

                return partItem;
            }
        }

        return null;
    }

    public selectColorIndex(colorIndex: number, paletteId: number, updatePartThumbnails: boolean = true): AvatarEditorGridColorItem
    {
        const palette = this.getPalette(paletteId);

        if(!palette) return null;

        if(palette.length <= colorIndex) return null;

        this.deselectColorIndex(this._paletteIndexes[paletteId], paletteId);

        this._paletteIndexes[paletteId] = colorIndex;

        const colorItem = palette[colorIndex];

        if(!colorItem) return null;

        colorItem.isSelected = true;

        if(updatePartThumbnails)
        {
            this.updatePartColors();
        }

        return colorItem;
    }

    private ensureCustomColorItem(
        colorId: number,
        paletteId: number
    ): number
    {
        if(!IsBiribiriCustomColorId(colorId)) return -1;
        if(!this._palettes || paletteId < 0 || paletteId >= this._palettes.length) return -1;

        const palette = this._palettes[paletteId];

        if(!palette) return -1;

        const exactIndex = palette.findIndex(
            item =>
                item &&
                item.partColor &&
                item.partColor.id === colorId
        );

        if(exactIndex >= 0) return exactIndex;

        const rgb = DecodeBiribiriCustomColor(colorId);

        if(rgb < 0) return -1;

        const customPartColor = {
            id: colorId,
            index: palette.length,
            clubLevel: 0,
            isSelectable: true,
            rgb
        } as IPartColor;

        const reusableIndex = palette.findIndex(
            item =>
                item &&
                item.partColor &&
                IsBiribiriCustomColorId(
                    item.partColor.id
                )
        );

        if(reusableIndex >= 0)
        {
            palette[reusableIndex].partColor =
                customPartColor;

            return reusableIndex;
        }

        palette.push(
            new AvatarEditorGridColorItem(
                customPartColor,
                false
            )
        );

        return palette.length - 1;
    }

    public selectCustomColorId(
        colorId: number,
        paletteId: number,
        updatePartThumbnails: boolean = true
    ): AvatarEditorGridColorItem
    {
        if(!this._paletteIndexes)
        {
            this._paletteIndexes = new Array(
                this._palettes?.length || 1
            ).fill(0);
        }

        const colorIndex =
            this.ensureCustomColorItem(
                colorId,
                paletteId
            );

        if(colorIndex < 0) return null;

        const palette =
            this.getPalette(paletteId);

        if(!palette) return null;

        const previousIndex =
            this._paletteIndexes[paletteId];

        this.deselectColorIndex(
            previousIndex,
            paletteId
        );

        this._paletteIndexes[paletteId] =
            colorIndex;

        const colorItem =
            palette[colorIndex];

        if(!colorItem) return null;

        colorItem.isSelected = true;

        if(updatePartThumbnails)
        {
            this.updatePartColors();
        }

        return colorItem;
    }

    public getCurrentColorIndex(k: number): number
    {
        return this._paletteIndexes[k];
    }

    private deselectColorIndex(colorIndex: number, paletteIndex: number): void
    {
        const palette = this.getPalette(paletteIndex);

        if(!palette) return;

        if(palette.length <= colorIndex) return;

        const colorItem = palette[colorIndex];

        if(!colorItem) return;

        colorItem.isSelected = false;
    }

    public getSelectedColorIds(): number[]
    {
        if(!this._paletteIndexes || !this._paletteIndexes.length) return null;

        if(!this._palettes || !this._palettes.length) return null;

        const palette = this._palettes[0];

        if(!palette || (!palette.length)) return null;

        const colorItem = palette[0];

        if(!colorItem || !colorItem.partColor) return null;

        const colorId = colorItem.partColor.id;
        const colorIds: number[] = [];

        let i = 0;

        while(i < this._paletteIndexes.length)
        {
            const paletteSet = this._palettes[i];

            if(!((!(paletteSet)) || (paletteSet.length <= i)))
            {
                if(paletteSet.length > this._paletteIndexes[i])
                {
                    const color = paletteSet[this._paletteIndexes[i]];

                    if(color && color.partColor)
                    {
                        colorIds.push(color.partColor.id);
                    }
                    else
                    {
                        colorIds.push(colorId);
                    }
                }
                else
                {
                    colorIds.push(colorId);
                }
            }

            i++;
        }

        const partItem = this.getCurrentPart();

        if(!partItem) return null;

        return colorIds.slice(0, Math.max(partItem.maxColorIndex, 1));
    }

    private getSelectedColors(): IPartColor[]
    {
        const partColors: IPartColor[] = [];

        let i = 0;

        while(i < this._paletteIndexes.length)
        {
            const colorItem = this.getSelectedColor(i);

            if(colorItem)
            {
                partColors.push(colorItem.partColor);
            }
            else
            {
                partColors.push(null);
            }

            i++;
        }

        return partColors;
    }

    public getSelectedColor(paletteId: number): AvatarEditorGridColorItem
    {
        const palette = this.getPalette(paletteId);

        if(!palette || (palette.length <= this._paletteIndexes[paletteId])) return null;

        return palette[this._paletteIndexes[paletteId]];
    }

    public getSelectedColorId(paletteId: number): number
    {
        const colorItem = this.getSelectedColor(paletteId);

        if(colorItem && (colorItem.partColor)) return colorItem.partColor.id;

        return 0;
    }

    public getPalette(paletteId: number): AvatarEditorGridColorItem[]
    {
        if(!this._paletteIndexes || !this._palettes || (this._palettes.length <= paletteId))
        {
            return null;
        }

        return this._palettes[paletteId];
    }

    public getCurrentPart(): AvatarEditorGridPartItem
    {
        return this._parts[this._selectedPartIndex] as AvatarEditorGridPartItem;
    }

    private updatePartColors(): void
    {
        if(!this._parts || !this._parts.length) return;

        const partColors =
            this.getSelectedColors();

        const parts =
            this._parts.slice();

        const generation =
            ++this._partColorUpdateGeneration;

        let index = 0;

        const updateBatch = () =>
        {
            if(
                generation !==
                this._partColorUpdateGeneration
            ) return;

            const limit =
                Math.min(
                    index + 8,
                    parts.length
                );

            while(index < limit)
            {
                const partItem =
                    parts[index++];

                if(partItem)
                {
                    partItem.partColors =
                        partColors;
                }
            }

            if(index < parts.length)
            {
                window.requestAnimationFrame(
                    updateBatch
                );
            }
        };

        window.requestAnimationFrame(
            updateBatch
        );
    }

    public hasClubSelectionsOverLevel(level: number): boolean
    {
        let hasInvalidSelections = false;

        const partColors = this.getSelectedColors();

        if(partColors)
        {
            let i = 0;

            while(i < partColors.length)
            {
                const partColor = partColors[i];

                if(partColor && (partColor.clubLevel > level)) hasInvalidSelections = true;

                i++;
            }
        }

        const partItem = this.getCurrentPart();

        if(partItem && partItem.partSet)
        {
            const partSet = partItem.partSet;

            if(partSet && (partSet.clubLevel > level)) hasInvalidSelections = true;
        }

        return hasInvalidSelections;
    }

    public hasInvalidSelectedItems(ownedItems: number[]): boolean
    {
        const part = this.getCurrentPart();

        if(!part) return false;

        const partSet = part.partSet;

        if(!partSet || !partSet.isSellable) return;

        return (ownedItems.indexOf(partSet.id) > -1);
    }

    public stripClubItemsOverLevel(level: number): boolean
    {
        const partItem = this.getCurrentPart();

        if(partItem && partItem.partSet)
        {
            const partSet = partItem.partSet;

            if(partSet.clubLevel > level)
            {
                const newPartItem = this.selectPartIndex(0);

                if(newPartItem && !newPartItem.partSet) this.selectPartIndex(1);

                return true;
            }
        }

        return false;
    }

    public stripClubColorsOverLevel(level: number): boolean
    {
        const colorIds: number[] = [];
        const partColors = this.getSelectedColors();
        const colorItems = this.getPalette(0);

        let didStrip = false;

        const colorId = CategoryData.defaultColorId(colorItems, level);

        if(colorId === -1) return false;

        let i = 0;

        while(i < partColors.length)
        {
            const partColor = partColors[i];

            if(!partColor)
            {
                colorIds.push(colorId);

                didStrip = true;
            }
            else
            {
                if(partColor.clubLevel > level)
                {
                    colorIds.push(colorId);
                    
                    didStrip = true;
                }
                else
                {
                    colorIds.push(partColor.id);
                }
            }

            i++;
        }

        if(didStrip) this.selectColorIds(colorIds);

        return didStrip;
    }

    // public stripInvalidSellableItems(k:IHabboInventory): boolean
    // {
    //     var _local_3:IFigurePartSet;
    //     var _local_4:AvatarEditorGridPartItem;
    //     var _local_2:AvatarEditorGridPartItem = this._Str_6315();
    //     if (((_local_2) && (_local_2.partSet)))
    //     {
    //         _local_3 = _local_2.partSet;
    //         if (((_local_3.isSellable) && (!(k._Str_14439(_local_3.id)))))
    //         {
    //             _local_4 = this._Str_8066(0);
    //             if (((!(_local_4 == null)) && (_local_4.partSet == null)))
    //             {
    //                 this._Str_8066(1);
    //             }
    //             return true;
    //         }
    //     }
    //     return false;
    // }

    public get name(): string
    {
        return this._name;
    }

    public get parts(): AvatarEditorGridPartItem[]
    {
        return this._parts;
    }

    public get selectedPartIndex(): number
    {
        return this._selectedPartIndex;
    }
}
