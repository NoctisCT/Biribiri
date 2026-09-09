import { AdvancedMap, IAdvancedMap, IFigureDataPalette, IPalette, IPartColor } from '../../../../api';
import { PartColor } from './PartColor';

export class Palette implements IPalette
{
    private _id: number;
    private _colors: IAdvancedMap<string, IPartColor>;

    constructor(data: IFigureDataPalette)
    {
        if(!data) throw new Error('invalid_data');

        this._id = data.id;
        this._colors = new AdvancedMap();

        this.append(data);
    }

    public append(data: IFigureDataPalette): void
    {
        for(const color of data.colors)
        {
            const newColor = new PartColor(color);

            this._colors.add(color.id.toString(), newColor);
        }
    }

    public getColor(id: number): IPartColor
    {
        if((id === undefined) || id < 0) return null;

        const key = id.toString();
        const existing = this._colors.getValue(key);

        if(existing) return existing;

        // BIRIBIRI_WARDROBE_V3_TRUE_RGB
        const customBase = 100000000;
        const customMax = customBase + 0xFFFFFF;

        if(id >= customBase && id <= customMax)
        {
            const rgb = (id - customBase) & 0xFFFFFF;
            const hexCode = rgb
                .toString(16)
                .padStart(6, '0')
                .toUpperCase();

            const customColor = new PartColor({
                id,
                index: 0,
                club: 0,
                selectable: true,
                hexCode
            } as any);

            this._colors.add(key, customColor);

            return customColor;
        }

        return null;
    }

    public get id(): number
    {
        return this._id;
    }

    public get colors(): IAdvancedMap<string, IPartColor>
    {
        return this._colors;
    }
}
