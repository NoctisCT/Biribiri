import { IMessageDataWrapper, IMessageParser } from '../../../../../api';

export class FollowStateParser implements IMessageParser
{
    private _active = false;
    private _targetUserId = 0;
    private _targetName = '';

    public flush(): boolean
    {
        this._active = false;
        this._targetUserId = 0;
        this._targetName = '';

        return true;
    }

    public parse(wrapper: IMessageDataWrapper): boolean
    {
        if(!wrapper) return false;

        this._active = wrapper.readInt() === 1;
        this._targetUserId = wrapper.readInt();
        this._targetName = wrapper.readString();

        return true;
    }

    public get active(): boolean
    {
        return this._active;
    }

    public get targetUserId(): number
    {
        return this._targetUserId;
    }

    public get targetName(): string
    {
        return this._targetName;
    }
}
