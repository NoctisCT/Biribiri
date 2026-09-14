import { IMessageComposer } from '../../../../../api';

export class BuilderProFillRepeatComposer implements IMessageComposer<number[]>
{
    private _data: number[];

    constructor(
        itemIds: number[],
        operation: number,
        mode: number,
        direction: number,
        spacing: number,
        requestId: number,
        areaMinX: number = 0,
        areaMinY: number = 0,
        areaMaxX: number = 0,
        areaMaxY: number = 0)
    {
        const ids =
            (itemIds || []).map(
                id => Math.trunc(id)
            );

        this._data = [
            Math.trunc(requestId),
            Math.trunc(operation),
            Math.trunc(mode),
            Math.trunc(direction),
            Math.trunc(spacing),
            ids.length,
            ...ids
        ];

        if(Math.trunc(mode) === 3)
        {
            this._data.push(
                Math.trunc(areaMinX),
                Math.trunc(areaMinY),
                Math.trunc(areaMaxX),
                Math.trunc(areaMaxY)
            );
        }
    }

    public getMessageArray(): number[]
    {
        return this._data;
    }

    public dispose(): void
    {
        return;
    }
}
