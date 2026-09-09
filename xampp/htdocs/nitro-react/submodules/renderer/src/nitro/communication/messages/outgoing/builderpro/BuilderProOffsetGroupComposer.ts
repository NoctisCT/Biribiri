import { IMessageComposer } from '../../../../../api';

export class BuilderProOffsetGroupComposer implements IMessageComposer<number[]>
{
    private _data: number[];

    constructor(
        itemIds: number[],
        deltaX: number,
        deltaY: number,
        deltaZMillis: number,
        requestId: number)
    {
        const ids = Array.from(new Set(
            (itemIds || []).map(
                itemId => Math.trunc(itemId)
            )
        ));

        this._data = [
            Math.trunc(requestId),
            ids.length,
            ...ids,
            Math.trunc(deltaX),
            Math.trunc(deltaY),
            Math.trunc(deltaZMillis)
        ];
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
