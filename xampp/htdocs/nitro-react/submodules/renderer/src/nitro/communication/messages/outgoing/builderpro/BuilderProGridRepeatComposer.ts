import { IMessageComposer } from '../../../../../api';

export class BuilderProGridRepeatComposer implements IMessageComposer<number[]>
{
    private _data: number[];

    constructor(
        itemIds: number[],
        operation: number,
        columns: number,
        rows: number,
        spacingX: number,
        spacingY: number,
        requestId: number)
    {
        const ids =
            (itemIds || []).map(
                id => Math.trunc(id)
            );

        this._data = [
            Math.trunc(requestId),
            Math.trunc(operation),
            Math.trunc(columns),
            Math.trunc(rows),
            Math.trunc(spacingX),
            Math.trunc(spacingY),
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
