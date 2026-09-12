import { IMessageComposer } from '../../../../../api';

export class BuilderProReplaceGroupComposer implements IMessageComposer<number[]>
{
    private _data: number[];

    constructor(
        itemIds: number[],
        operation: number,
        referenceId: number,
        targetRotations: number[],
        requestId: number)
    {
        const ids =
            (itemIds || []).map(
                id => Math.trunc(id)
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
            Math.trunc(operation),
            Math.trunc(referenceId),
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
