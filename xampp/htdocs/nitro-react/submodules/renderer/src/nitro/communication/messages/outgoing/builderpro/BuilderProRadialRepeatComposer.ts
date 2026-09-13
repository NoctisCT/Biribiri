import { IMessageComposer } from '../../../../../api';

export class BuilderProRadialRepeatComposer implements IMessageComposer<number[]>
{
    private _data: number[];

    constructor(
        itemIds: number[],
        operation: number,
        copies: number,
        totalAngle: number,
        radius: number,
        rotateWithPattern: boolean,
        pivotId: number,
        requestId: number)
    {
        const ids =
            (itemIds || []).map(
                id => Math.trunc(id)
            );

        this._data = [
            Math.trunc(requestId),
            Math.trunc(operation),
            Math.trunc(copies),
            Math.trunc(totalAngle),
            Math.trunc(radius),
            rotateWithPattern ? 1 : 0,
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
