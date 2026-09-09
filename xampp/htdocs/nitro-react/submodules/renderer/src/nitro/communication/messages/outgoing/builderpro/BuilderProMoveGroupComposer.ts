import { IMessageComposer } from '../../../../../api';

export class BuilderProMoveGroupComposer implements IMessageComposer<number[]>
{
    private _data: number[];

    constructor(itemIds: number[], deltaX: number, deltaY: number)
    {
        const ids = Array.from(new Set(
            (itemIds || []).map(itemId => Math.trunc(itemId))
        ));

        this._data = [
            ids.length,
            ...ids,
            Math.trunc(deltaX),
            Math.trunc(deltaY)
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
