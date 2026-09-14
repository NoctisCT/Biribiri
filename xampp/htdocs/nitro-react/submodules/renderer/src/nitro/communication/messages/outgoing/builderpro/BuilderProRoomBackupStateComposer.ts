import { IMessageComposer } from '../../../../../api';

export class BuilderProRoomBackupStateComposer implements IMessageComposer<unknown[]>
{
    private _data: unknown[];

    constructor(
        requestId: number,
        operation: number,
        backupId = 0,
        roomId = 0,
        pin = '',
        newPin = '')
    {
        this._data = [
            Math.trunc(requestId),
            Math.trunc(operation),
            Math.trunc(backupId),
            Math.trunc(roomId),
            String(pin || ''),
            String(newPin || '')
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
