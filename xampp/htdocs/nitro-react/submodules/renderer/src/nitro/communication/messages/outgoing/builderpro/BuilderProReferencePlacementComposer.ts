import { IMessageComposer } from '../../../../../api';

export class BuilderProReferencePlacementComposer implements IMessageComposer<number[]>
{
    private _data: number[];

    constructor(
        itemIds: number[],
        operation: number,
        referenceId: number,
        pivotId: number,
        requestId: number)
    {
        const ids = Array.from(new Set(
            (itemIds || []).map(
                itemId => Math.trunc(itemId)
            )
        ));

        this._data = [
            Math.trunc(requestId),
            Math.trunc(operation),
            Math.trunc(referenceId),
            Math.trunc(pivotId),
            ids.length,
            ...ids
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
