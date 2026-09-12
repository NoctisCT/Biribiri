import { IMessageComposer } from '../../../../../api';

export class BuilderProLayerStateComposer implements IMessageComposer<unknown[]>
{
    private _data: unknown[];

    constructor(
        requestId: number,
        operation: number,
        layerId = 0,
        name = '',
        itemIds: number[] = [])
    {
        const ids = Array.from(new Set(
            (itemIds || [])
                .map(itemId => Math.trunc(itemId))
                .filter(itemId =>
                    Number.isSafeInteger(itemId) &&
                    itemId > 0)
        ));

        this._data = [
            Math.trunc(requestId),
            Math.trunc(operation),
            Math.trunc(layerId),
            String(name || ''),
            ids.length,
            ...ids
        ];
    }

    public getMessageArray(): unknown[]
    {
        return this._data;
    }

    public dispose(): void
    {
        return;
    }
}
