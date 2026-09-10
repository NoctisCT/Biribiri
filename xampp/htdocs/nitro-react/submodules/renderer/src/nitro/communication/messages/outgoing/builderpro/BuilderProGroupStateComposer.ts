import { IMessageComposer } from '../../../../../api';

export class BuilderProGroupStateComposer implements IMessageComposer<unknown[]>
{
    private _data: unknown[];

    constructor(
        requestId: number,
        operation: number,
        groupId = 0,
        name = '',
        locked = false,
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
            Math.trunc(groupId),
            String(name || ''),
            !!locked,
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
