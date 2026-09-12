import { IMessageDataWrapper, IMessageParser } from '../../../../../api';

export type BuilderProMirrorDuplicatePreviewEntry = {
    baseItemId: number;
    offsetX: number;
    offsetY: number;
    offsetZ: number;
    rotation: number;
    state: number;
};

export class BuilderProMirrorDuplicateResultParser implements IMessageParser
{
    private _requestId = 0;
    private _success = false;
    private _code = 0;
    private _message = '';
    private _preparedCount = 0;
    private _sourceAnchorZ = 0;
    private _previewEntries: BuilderProMirrorDuplicatePreviewEntry[] = [];

    public flush(): boolean
    {
        this._requestId = 0;
        this._success = false;
        this._code = 0;
        this._message = '';
        this._preparedCount = 0;
        this._sourceAnchorZ = 0;
        this._previewEntries = [];

        return true;
    }

    public parse(wrapper: IMessageDataWrapper): boolean
    {
        if(!wrapper) return false;

        this._requestId = wrapper.readInt();
        this._success = wrapper.readBoolean();
        this._code = wrapper.readInt();
        this._message = wrapper.readString();
        this._preparedCount = wrapper.readInt();

        const anchorZ =
            Number.parseFloat(
                wrapper.readString()
            );

        this._sourceAnchorZ =
            Number.isFinite(anchorZ)
                ? anchorZ
                : 0;

        const count =
            wrapper.readInt();

        if(count < 0 || count > 100)
        {
            return false;
        }

        this._previewEntries = [];

        for(let index = 0;
                index < count;
                index++)
        {
            const baseItemId =
                wrapper.readInt();

            const offsetX =
                wrapper.readInt();

            const offsetY =
                wrapper.readInt();

            const offsetZValue =
                Number.parseFloat(
                    wrapper.readString()
                );

            const rotation =
                wrapper.readInt();

            const extraData =
                wrapper.readString();

            const parsedState =
                Number.parseInt(
                    extraData,
                    10
                );

            this._previewEntries.push({
                baseItemId,
                offsetX,
                offsetY,
                offsetZ:
                    Number.isFinite(
                        offsetZValue
                    )
                        ? offsetZValue
                        : 0,
                rotation:
                    (
                        (
                            rotation %
                            8
                        ) +
                        8
                    ) %
                    8,
                state:
                    Number.isFinite(
                        parsedState
                    )
                        ? parsedState
                        : 0
            });
        }

        return true;
    }

    public get requestId(): number
    {
        return this._requestId;
    }

    public get success(): boolean
    {
        return this._success;
    }

    public get code(): number
    {
        return this._code;
    }

    public get message(): string
    {
        return this._message;
    }

    public get preparedCount(): number
    {
        return this._preparedCount;
    }

    public get sourceAnchorZ(): number
    {
        return this._sourceAnchorZ;
    }

    public get previewEntries(): BuilderProMirrorDuplicatePreviewEntry[]
    {
        return this._previewEntries.map(
            entry => ({
                ...entry
            })
        );
    }
}
