import { IMessageComposer } from '../../../../../api';

export class BuilderProHistoryComposer implements IMessageComposer<number[]>
{
    private _data: number[];

    constructor(action: number, requestId: number)
    {
        this._data = [
            Math.trunc(requestId),
            Math.trunc(action)
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
