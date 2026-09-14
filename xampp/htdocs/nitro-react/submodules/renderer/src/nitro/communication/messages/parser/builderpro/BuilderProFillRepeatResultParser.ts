import { IMessageDataWrapper, IMessageParser } from '../../../../../api';

export type BuilderProFillRepeatPreviewEntry = {
    baseItemId: number;
    x: number;
    y: number;
    z: number;
    rotation: number;
    state: number;
};

export class BuilderProFillRepeatResultParser implements IMessageParser
{
    private _requestId = 0;
    private _operation = 0;
    private _success = false;
    private _code = 0;
    private _message = '';
    private _mode = 0;
    private _direction = 0;
    private _spacing = 0;
    private _copies = 0;
    private _placedCount = 0;
    private _previewEntries: BuilderProFillRepeatPreviewEntry[] = [];
    private _itemIds: number[] = [];
    private _canUndo = false;
    private _canRedo = false;

    public flush(): boolean
    {
        this._requestId = 0;
        this._operation = 0;
        this._success = false;
        this._code = 0;
        this._message = '';
        this._mode = 0;
        this._direction = 0;
        this._spacing = 0;
        this._copies = 0;
        this._placedCount = 0;
        this._previewEntries = [];
        this._itemIds = [];
        this._canUndo = false;
        this._canRedo = false;

        return true;
    }

    public parse(wrapper: IMessageDataWrapper): boolean
    {
        if(!wrapper) return false;

        this._requestId = wrapper.readInt();
        this._operation = wrapper.readInt();
        this._success = wrapper.readBoolean();
        this._code = wrapper.readInt();
        this._message = wrapper.readString();
        this._mode = wrapper.readInt();
        this._direction = wrapper.readInt();
        this._spacing = wrapper.readInt();
        this._copies = wrapper.readInt();
        this._placedCount = wrapper.readInt();

        const previewCount = wrapper.readInt();

        if(previewCount < 0 || previewCount > 100)
        {
            return false;
        }

        this._previewEntries = [];

        for(let index = 0;
                index < previewCount;
                index++)
        {
            const baseItemId = wrapper.readInt();
            const x = wrapper.readInt();
            const y = wrapper.readInt();
            const zValue = Number.parseFloat(
                wrapper.readString()
            );
            const rotation = wrapper.readInt();
            const extraData = wrapper.readString();
            const parsedState = Number.parseInt(
                extraData,
                10
            );

            this._previewEntries.push({
                baseItemId,
                x,
                y,
                z: Number.isFinite(zValue)
                    ? zValue
                    : 0,
                rotation:
                    (
                        (
                            rotation % 8
                        ) +
                        8
                    ) %
                    8,
                state: Number.isFinite(parsedState)
                    ? parsedState
                    : 0
            });
        }

        const itemCount = wrapper.readInt();

        if(itemCount < 0 || itemCount > 100)
        {
            return false;
        }

        this._itemIds = [];

        for(let index = 0;
                index < itemCount;
                index++)
        {
            this._itemIds.push(
                wrapper.readInt()
            );
        }

        this._canUndo = wrapper.readBoolean();
        this._canRedo = wrapper.readBoolean();

        return true;
    }

    public get requestId(): number { return this._requestId; }
    public get operation(): number { return this._operation; }
    public get success(): boolean { return this._success; }
    public get code(): number { return this._code; }
    public get message(): string { return this._message; }
    public get mode(): number { return this._mode; }
    public get direction(): number { return this._direction; }
    public get spacing(): number { return this._spacing; }
    public get copies(): number { return this._copies; }
    public get placedCount(): number { return this._placedCount; }
    public get canUndo(): boolean { return this._canUndo; }
    public get canRedo(): boolean { return this._canRedo; }

    public get previewEntries(): BuilderProFillRepeatPreviewEntry[]
    {
        return this._previewEntries.map(
            entry => ({ ...entry })
        );
    }

    public get itemIds(): number[]
    {
        return [ ...this._itemIds ];
    }
}
