import { IMessageComposer } from '../../../../../api';

export class BuilderProPasteGroupComposer implements IMessageComposer<number[]>
{
    private _data: number[];

    constructor(anchorX: number, anchorY: number, requestId: number)
    {
        this._data = [
            Math.trunc(requestId),
            Math.trunc(anchorX),
            Math.trunc(anchorY)
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
