import { IMessageDataWrapper, IMessageParser } from '../../../../../api';

export class CoinTossParser implements IMessageParser
{
    private _eventType = 0;
    private _challengeId = 0;
    private _displayObjectId = -1;
    private _initiatorObjectId = -1;
    private _targetObjectId = -1;
    private _result = -1;
    private _winnerObjectId = -1;

    public flush(): boolean
    {
        this._eventType = 0;
        this._challengeId = 0;
        this._displayObjectId = -1;
        this._initiatorObjectId = -1;
        this._targetObjectId = -1;
        this._result = -1;
        this._winnerObjectId = -1;

        return true;
    }

    public parse(wrapper: IMessageDataWrapper): boolean
    {
        if(!wrapper) return false;

        this._eventType = wrapper.readInt();
        this._challengeId = wrapper.readInt();
        this._displayObjectId = wrapper.readInt();
        this._initiatorObjectId = wrapper.readInt();
        this._targetObjectId = wrapper.readInt();
        this._result = wrapper.readInt();
        this._winnerObjectId = wrapper.readInt();

        return true;
    }

    public get eventType(): number { return this._eventType; }
    public get challengeId(): number { return this._challengeId; }
    public get displayObjectId(): number { return this._displayObjectId; }
    public get initiatorObjectId(): number { return this._initiatorObjectId; }
    public get targetObjectId(): number { return this._targetObjectId; }
    public get result(): number { return this._result; }
    public get winnerObjectId(): number { return this._winnerObjectId; }
}
