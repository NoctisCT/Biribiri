import type {
    IMessageComposer,
    IMessageDataWrapper,
    IMessageEvent,
    IMessageParser
} from '@nitrots/nitro-renderer';
import { MessageEvent } from '@nitrots/nitro-renderer/src/events/core/MessageEvent';
import { GetConnection } from '../nitro/GetConnection';

const BIRIBIRI_WARDROBE_FOLDERS_REQUEST = 6214;
const BIRIBIRI_WARDROBE_FOLDERS = 6215;
const BIRIBIRI_WARDROBE_FOLDER_MUTATION = 6216;
const BIRIBIRI_WARDROBE_FOLDER_MUTATION_RESULT = 6217;

export interface BiribiriWardrobeFolderData
{
    id: number;
    name: string;
    slots: Map<number, number>;
}

export class BiribiriWardrobeFoldersParser
implements IMessageParser
{
    private _clubActive = false;
    private _folders: BiribiriWardrobeFolderData[] = [];

    public flush(): boolean
    {
        this._clubActive = false;
        this._folders = [];
        return true;
    }

    public parse(
        wrapper: IMessageDataWrapper
    ): boolean
    {
        if(!wrapper) return false;

        this._clubActive =
            wrapper.readBoolean();

        const count =
            Math.max(
                0,
                wrapper.readInt()
            );

        const folders:
            BiribiriWardrobeFolderData[] = [];

        for(let i = 0; i < count; i++)
        {
            const id =
                wrapper.readInt();

            const name =
                wrapper.readString();

            const slotCount =
                Math.max(
                    0,
                    wrapper.readInt()
                );

            const slots =
                new Map<number, number>();

            for(
                let j = 0;
                j < slotCount;
                j++
            )
            {
                const position =
                    wrapper.readInt();

                const slotId =
                    wrapper.readInt();

                if(
                    position > 0 &&
                    position <= 10 &&
                    slotId > 0
                )
                {
                    slots.set(
                        position,
                        slotId
                    );
                }
            }

            if(id > 0)
            {
                folders.push({
                    id,
                    name: name || '',
                    slots
                });
            }
        }

        this._folders = folders;
        return true;
    }

    public get clubActive(): boolean
    {
        return this._clubActive;
    }

    public get folders():
        BiribiriWardrobeFolderData[]
    {
        return this._folders;
    }
}

export class BiribiriWardrobeFolderMutationResultParser
implements IMessageParser
{
    private _action = 0;
    private _status = -1;
    private _folderId = 0;
    private _slotId = 0;

    public flush(): boolean
    {
        this._action = 0;
        this._status = -1;
        this._folderId = 0;
        this._slotId = 0;
        return true;
    }

    public parse(
        wrapper: IMessageDataWrapper
    ): boolean
    {
        if(!wrapper) return false;

        this._action = wrapper.readInt();
        this._status = wrapper.readInt();
        this._folderId = wrapper.readInt();
        this._slotId = wrapper.readInt();

        return true;
    }

    public get action(): number
    {
        return this._action;
    }

    public get status(): number
    {
        return this._status;
    }

    public get folderId(): number
    {
        return this._folderId;
    }

    public get slotId(): number
    {
        return this._slotId;
    }
}

export class BiribiriWardrobeFoldersEvent
extends MessageEvent
implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(
            callBack,
            BiribiriWardrobeFoldersParser
        );
    }

    public getParser():
        BiribiriWardrobeFoldersParser
    {
        return this.parser as BiribiriWardrobeFoldersParser;
    }
}

export class BiribiriWardrobeFolderMutationResultEvent
extends MessageEvent
implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(
            callBack,
            BiribiriWardrobeFolderMutationResultParser
        );
    }

    public getParser():
        BiribiriWardrobeFolderMutationResultParser
    {
        return this.parser as BiribiriWardrobeFolderMutationResultParser;
    }
}

export class BiribiriWardrobeFoldersRequestComposer
implements IMessageComposer<[]>
{
    private _data: [] = [];

    public getMessageArray(): []
    {
        return this._data;
    }

    public dispose(): void
    {
        return;
    }
}

export class BiribiriWardrobeFolderMutationComposer
implements IMessageComposer<[ number, number, number, string ]>
{
    private _data:
        [ number, number, number, string ];

    constructor(
        action: number,
        folderId: number,
        slotId: number,
        name: string
    )
    {
        this._data =
        [
            action,
            folderId,
            slotId,
            name || ''
        ];
    }

    public getMessageArray():
        [ number, number, number, string ]
    {
        return this._data;
    }

    public dispose(): void
    {
        return;
    }
}

export function RegisterBiribiriWardrobeFolderMessages():
boolean
{
    const connection =
        GetConnection();

    if(!connection) return false;

    connection.registerMessages({
        events:
            new Map<number, Function>(
                [
                    [
                        BIRIBIRI_WARDROBE_FOLDERS,
                        BiribiriWardrobeFoldersEvent
                    ],
                    [
                        BIRIBIRI_WARDROBE_FOLDER_MUTATION_RESULT,
                        BiribiriWardrobeFolderMutationResultEvent
                    ]
                ]
            ),
        composers:
            new Map<number, Function>(
                [
                    [
                        BIRIBIRI_WARDROBE_FOLDERS_REQUEST,
                        BiribiriWardrobeFoldersRequestComposer
                    ],
                    [
                        BIRIBIRI_WARDROBE_FOLDER_MUTATION,
                        BiribiriWardrobeFolderMutationComposer
                    ]
                ]
            )
    });

    return true;
}
