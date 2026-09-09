import { IMessageComposer } from '../../../../../api';

export class BuilderProTransformGroupComposer implements IMessageComposer<number[]>
{
    private _data: number[];

    constructor(
        itemIds: number[],
        operation: number,
        argument: number,
        requestId: number,
        targetRotations: number[] = [])
    {
        const ids = Array.from(new Set(
            (itemIds || []).map(
                itemId => Math.trunc(itemId)
            )
        ));

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
            Math.trunc(argument),
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
