import { IMessageComposer } from '../../../../../api';

export class BuilderProLayoutGroupComposer implements IMessageComposer<number[]>
{
    private _data: number[];

    constructor(
        itemIds: number[],
        operation: number,
        pivotId: number,
        spacing: number,
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
            Math.trunc(operation),
            Math.trunc(pivotId),
            Math.trunc(spacing)
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
