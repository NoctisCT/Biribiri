import { IMessageComposer } from '../../../../../api';

export class BuilderProPickupGroupComposer implements IMessageComposer<number[]>
{
    private _data: number[];

    constructor(
        itemIds: number[],
        requestId: number)
    {
        const ids = Array.from(
            new Set(
                (itemIds || [])
                    .map(
                        itemId =>
                            Math.trunc(itemId)
                    )
                    .filter(
                        itemId =>
                            Number.isSafeInteger(itemId) &&
                            itemId > 0
                    )
            )
        );

        this._data = [
            Math.trunc(requestId),
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
