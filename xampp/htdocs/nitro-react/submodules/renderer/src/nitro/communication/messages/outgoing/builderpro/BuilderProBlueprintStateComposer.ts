import { IMessageComposer } from '../../../../../api';

export class BuilderProBlueprintStateComposer implements IMessageComposer<unknown[]>
{
    private _data: unknown[];

    constructor(
        requestId: number,
        operation: number,
        blueprintId = 0,
        name = '',
        anchorX = 0,
        anchorY = 0,
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
            Math.trunc(blueprintId),
            String(name || ''),
            Math.trunc(anchorX),
            Math.trunc(anchorY),
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
