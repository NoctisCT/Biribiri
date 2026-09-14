import { IMessageDataWrapper, IMessageParser } from '../../../../../api';

export interface BuilderProRoomBackupSummary
{
    id: number;
    originalRoomId: number;
    activeRoomId: number;
    roomName: string;
    itemCount: number;
    updatedAt: string;
    roomExists: boolean;
}

export class BuilderProRoomBackupStateParser implements IMessageParser
{
    private _requestId = 0;
    private _success = false;
    private _code = 0;
    private _message = '';
    private _restoredRoomId = 0;
    private _backups: BuilderProRoomBackupSummary[] = [];

    public flush(): boolean
    {
        this._requestId = 0;
        this._success = false;
        this._code = 0;
        this._message = '';
        this._restoredRoomId = 0;
        this._backups = [];

        return true;
    }

    public parse(wrapper: IMessageDataWrapper): boolean
    {
        if(!wrapper) return false;

        this._requestId = wrapper.readInt();
        this._success = wrapper.readBoolean();
        this._code = wrapper.readInt();
        this._message = wrapper.readString();
        this._restoredRoomId = wrapper.readInt();

        const count = wrapper.readInt();

        if(count < 0 || count > 500)
        {
            return false;
        }

        const backups: BuilderProRoomBackupSummary[] = [];

        for(let index = 0; index < count; index++)
        {
            backups.push({
                id: wrapper.readInt(),
                originalRoomId: wrapper.readInt(),
                activeRoomId: wrapper.readInt(),
                roomName: wrapper.readString(),
                itemCount: wrapper.readInt(),
                updatedAt: wrapper.readString(),
                roomExists: wrapper.readBoolean()
            });
        }

        this._backups = backups;

        return true;
    }

    public get requestId(): number { return this._requestId; }
    public get success(): boolean { return this._success; }
    public get code(): number { return this._code; }
    public get message(): string { return this._message; }
    public get restoredRoomId(): number { return this._restoredRoomId; }

    public get backups(): BuilderProRoomBackupSummary[]
    {
        return this._backups.map(backup => ({ ...backup }));
    }
}
