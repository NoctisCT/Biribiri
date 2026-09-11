import { IMessageDataWrapper, IMessageParser } from '../../../../../api';

export interface BuilderProSavedBlueprint
{
    id: number;
    name: string;
    itemCount: number;
}

export interface BuilderProBlueprintPreviewEntry
{
    baseItemId: number;
    offsetX: number;
    offsetY: number;
    offsetZ: number;
    rotation: number;
}

export class BuilderProBlueprintStateParser implements IMessageParser
{
    private _requestId = 0;
    private _success = false;
    private _code = 0;
    private _message = '';
    private _blueprints: BuilderProSavedBlueprint[] = [];
    private _placedItemIds: number[] = [];
    private _previewBlueprintId = 0;
    private _previewEntries: BuilderProBlueprintPreviewEntry[] = [];

    public flush(): boolean
    {
        this._requestId = 0;
        this._success = false;
        this._code = 0;
        this._message = '';
        this._blueprints = [];
        this._placedItemIds = [];
        this._previewBlueprintId = 0;
        this._previewEntries = [];

        return true;
    }

    public parse(wrapper: IMessageDataWrapper): boolean
    {
        if(!wrapper) return false;

        this._requestId =
            wrapper.readInt();

        this._success =
            wrapper.readBoolean();

        this._code =
            wrapper.readInt();

        this._message =
            wrapper.readString();

        const blueprintCount =
            wrapper.readInt();

        if(
            blueprintCount < 0 ||
            blueprintCount > 1000
        )
        {
            return false;
        }

        const blueprints:
            BuilderProSavedBlueprint[] = [];

        for(
            let index = 0;
            index < blueprintCount;
            index++
        )
        {
            const id =
                wrapper.readInt();

            const name =
                wrapper.readString();

            const itemCount =
                wrapper.readInt();

            if(
                itemCount < 0 ||
                itemCount > 100
            )
            {
                return false;
            }

            blueprints.push({
                id,
                name,
                itemCount
            });
        }

        const placedCount =
            wrapper.readInt();

        if(
            placedCount < 0 ||
            placedCount > 100
        )
        {
            return false;
        }

        const placedItemIds: number[] = [];

        for(
            let index = 0;
            index < placedCount;
            index++
        )
        {
            placedItemIds.push(
                wrapper.readInt()
            );
        }

        this._blueprints =
            blueprints;

        this._placedItemIds =
            placedItemIds;

        this._previewBlueprintId =
            wrapper.readInt();

        const previewCount =
            wrapper.readInt();

        if(
            previewCount < 0 ||
            previewCount > 100
        )
        {
            return false;
        }

        const previewEntries:
            BuilderProBlueprintPreviewEntry[] = [];

        for(
            let index = 0;
            index < previewCount;
            index++
        )
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

            previewEntries.push({
                baseItemId,
                offsetX,
                offsetY,
                offsetZ:
                    Number.isFinite(offsetZValue)
                        ? offsetZValue
                        : 0,
                rotation:
                    (
                        (
                            rotation % 8
                        ) +
                        8
                    ) %
                    8
            });
        }

        this._previewEntries =
            previewEntries;

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

    public get blueprints(): BuilderProSavedBlueprint[]
    {
        return this._blueprints;
    }

    public get placedItemIds(): number[]
    {
        return this._placedItemIds;
    }

    public get previewBlueprintId(): number
    {
        return this._previewBlueprintId;
    }

    public get previewEntries(): BuilderProBlueprintPreviewEntry[]
    {
        return this._previewEntries.map(
            entry => ({
                ...entry
            })
        );
    }
}
