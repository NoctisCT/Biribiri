import { IMessageComposer } from '../../../../../api';

export class BuilderProMirrorDuplicateComposer implements IMessageComposer<number[]>
{
    private _data: number[];

    constructor(
        itemIds: number[],
        axis: number,
        pivotId: number,
        targetRotations: number[],
        requestId: number)
    {
        const ids =
            (itemIds || []).map(
                itemId =>
                    Math.trunc(itemId)
            );

        const rotations =
            (targetRotations || []).map(
                rotation =>
                    (
                        (
                            Math.trunc(rotation) %
                            8
                        ) +
                        8
                    ) %
                    8
            );

        this._data = [
            Math.trunc(requestId),
            Math.trunc(axis),
            Math.trunc(pivotId),
            ids.length,
            ...ids,
            rotations.length,
            ...rotations
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
