import { IMessageComposer } from '../../../../../api';

export class BuilderProLinearRepeatComposer implements IMessageComposer<number[]>
{
    private _data: number[];

    constructor(
        itemIds: number[],
        operation: number,
        direction: number,
        copies: number,
        spacing: number,
        requestId: number)
    {
        const ids =
            (itemIds || []).map(
                id => Math.trunc(id)
            );

        this._data = [
            Math.trunc(requestId),
            Math.trunc(operation),
            Math.trunc(direction),
            Math.trunc(copies),
            Math.trunc(spacing),
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
