// BIRIBIRI_WARDROBE_COMMUNITY_C1
// BIRIBIRI_WARDROBE_COMMUNITY_C2_1
// BIRIBIRI_WARDROBE_COMMUNITY_C2_2
// BIRIBIRI_WARDROBE_COMMUNITY_C2_3_2_2
import type {
    IMessageComposer,
    IMessageDataWrapper,
    IMessageEvent,
    IMessageParser
} from '@nitrots/nitro-renderer';
import { MessageEvent } from '@nitrots/nitro-renderer/src/events/core/MessageEvent';
import { GetConnection } from '../nitro/GetConnection';

export const BIRIBIRI_COMMUNITY_FEED_REQUEST = 6220;
export const BIRIBIRI_COMMUNITY_FEED_RESPONSE = 6221;
export const BIRIBIRI_COMMUNITY_MINE_REQUEST = 6222;
export const BIRIBIRI_COMMUNITY_MINE_RESPONSE = 6223;
export const BIRIBIRI_COMMUNITY_MUTATION_REQUEST = 6224;
export const BIRIBIRI_COMMUNITY_MUTATION_RESULT = 6225;
export const BIRIBIRI_COMMUNITY_ACTION_REQUEST = 6226;
export const BIRIBIRI_COMMUNITY_ACTION_RESULT = 6227;

export interface BiribiriCommunityOutfit
{
    id: number;
    userId: number;
    username: string;
    slotId: number;
    look: string;
    gender: string;
    name: string;
    category: string;
    likes: number;
    createdAt: string;
    myLike: boolean;
    isOwn: boolean;
}

export interface BiribiriCommunityMineOutfit
{
    slotId: number;
    look: string;
    gender: string;
    name: string;
    published: boolean;
    publicationId: number;
    category: string;
}

export class BiribiriCommunityFeedRequestComposer
    implements IMessageComposer<ConstructorParameters<typeof BiribiriCommunityFeedRequestComposer>>
{
    private _data: ConstructorParameters<typeof BiribiriCommunityFeedRequestComposer>;

    constructor(mode: number, offset: number, limit: number)
    {
        this._data = [
            Math.max(0, Math.min(7, mode)),
            Math.max(0, offset),
            Math.max(1, Math.min(40, limit))
        ];
    }

    public getMessageArray()
    {
        return this._data;
    }

    public dispose(): void {}
}

export class BiribiriCommunityMineRequestComposer
    implements IMessageComposer<ConstructorParameters<typeof BiribiriCommunityMineRequestComposer>>
{
    private _data: ConstructorParameters<typeof BiribiriCommunityMineRequestComposer>;

    constructor()
    {
        this._data = [];
    }

    public getMessageArray()
    {
        return this._data;
    }

    public dispose(): void {}
}

export class BiribiriCommunityMutationComposer
    implements IMessageComposer<ConstructorParameters<typeof BiribiriCommunityMutationComposer>>
{
    private _data: ConstructorParameters<typeof BiribiriCommunityMutationComposer>;

    constructor(action: number, slotId: number, category: string)
    {
        this._data = [
            action,
            slotId,
            category || ''
        ];
    }

    public getMessageArray()
    {
        return this._data;
    }

    public dispose(): void {}
}

export class BiribiriCommunityActionComposer
    implements IMessageComposer<ConstructorParameters<typeof BiribiriCommunityActionComposer>>
{
    private _data: ConstructorParameters<typeof BiribiriCommunityActionComposer>;

    constructor(action: number, publicationId: number, reason: string = '')
    {
        this._data = [
            action,
            publicationId,
            reason || ''
        ];
    }

    public getMessageArray()
    {
        return this._data;
    }

    public dispose(): void {}
}

export class BiribiriCommunityFeedParser implements IMessageParser
{
    private _mode = 0;
    private _offset = 0;
    private _canModerate = false;
    private _items: BiribiriCommunityOutfit[] = [];

    public flush(): boolean
    {
        this._mode = 0;
        this._offset = 0;
        this._canModerate = false;
        this._items = [];
        return true;
    }

    public parse(wrapper: IMessageDataWrapper): boolean
    {
        if(!wrapper) return false;

        this._mode = wrapper.readInt();
        this._offset = wrapper.readInt();
        this._canModerate = wrapper.readBoolean();

        let count = wrapper.readInt();

        while(count > 0)
        {
            this._items.push({
                id: wrapper.readInt(),
                userId: wrapper.readInt(),
                username: wrapper.readString(),
                slotId: wrapper.readInt(),
                look: wrapper.readString(),
                gender: wrapper.readString(),
                name: wrapper.readString(),
                category: wrapper.readString(),
                likes: wrapper.readInt(),
                createdAt: wrapper.readString(),
                myLike: wrapper.readBoolean(),
                isOwn: wrapper.readBoolean()
            });

            count--;
        }

        return true;
    }

    public get mode(): number { return this._mode; }
    public get offset(): number { return this._offset; }
    public get canModerate(): boolean { return this._canModerate; }
    public get items(): BiribiriCommunityOutfit[] { return this._items; }
}

export class BiribiriCommunityMineParser implements IMessageParser
{
    private _items: BiribiriCommunityMineOutfit[] = [];

    public flush(): boolean
    {
        this._items = [];
        return true;
    }

    public parse(wrapper: IMessageDataWrapper): boolean
    {
        if(!wrapper) return false;

        let count = wrapper.readInt();

        while(count > 0)
        {
            this._items.push({
                slotId: wrapper.readInt(),
                look: wrapper.readString(),
                gender: wrapper.readString(),
                name: wrapper.readString(),
                published: wrapper.readBoolean(),
                publicationId: wrapper.readInt(),
                category: wrapper.readString()
            });

            count--;
        }

        return true;
    }

    public get items(): BiribiriCommunityMineOutfit[]
    {
        return this._items;
    }
}

export class BiribiriCommunityMutationResultParser implements IMessageParser
{
    private _action = 0;
    private _slotId = 0;
    private _success = false;
    private _code = 0;
    private _publicationId = 0;
    private _category = '';

    public flush(): boolean
    {
        this._action = 0;
        this._slotId = 0;
        this._success = false;
        this._code = 0;
        this._publicationId = 0;
        this._category = '';
        return true;
    }

    public parse(wrapper: IMessageDataWrapper): boolean
    {
        if(!wrapper) return false;

        this._action = wrapper.readInt();
        this._slotId = wrapper.readInt();
        this._success = wrapper.readBoolean();
        this._code = wrapper.readInt();
        this._publicationId = wrapper.readInt();
        this._category = wrapper.readString();

        return true;
    }

    public get action(): number { return this._action; }
    public get slotId(): number { return this._slotId; }
    public get success(): boolean { return this._success; }
    public get code(): number { return this._code; }
    public get publicationId(): number { return this._publicationId; }
    public get category(): string { return this._category; }
}

export class BiribiriCommunityActionResultParser implements IMessageParser
{
    private _action = 0;
    private _publicationId = 0;
    private _success = false;
    private _code = 0;
    private _value = 0;
    private _flag = false;

    public flush(): boolean
    {
        this._action = 0;
        this._publicationId = 0;
        this._success = false;
        this._code = 0;
        this._value = 0;
        this._flag = false;
        return true;
    }

    public parse(wrapper: IMessageDataWrapper): boolean
    {
        if(!wrapper) return false;

        this._action = wrapper.readInt();
        this._publicationId = wrapper.readInt();
        this._success = wrapper.readBoolean();
        this._code = wrapper.readInt();
        this._value = wrapper.readInt();
        this._flag = wrapper.readBoolean();

        return true;
    }

    public get action(): number { return this._action; }
    public get publicationId(): number { return this._publicationId; }
    public get success(): boolean { return this._success; }
    public get code(): number { return this._code; }
    public get value(): number { return this._value; }
    public get flag(): boolean { return this._flag; }
}

export class BiribiriCommunityFeedEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(callBack, BiribiriCommunityFeedParser);
    }

    public getParser(): BiribiriCommunityFeedParser
    {
        return this.parser as BiribiriCommunityFeedParser;
    }
}

export class BiribiriCommunityMineEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(callBack, BiribiriCommunityMineParser);
    }

    public getParser(): BiribiriCommunityMineParser
    {
        return this.parser as BiribiriCommunityMineParser;
    }
}

export class BiribiriCommunityMutationResultEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(callBack, BiribiriCommunityMutationResultParser);
    }

    public getParser(): BiribiriCommunityMutationResultParser
    {
        return this.parser as BiribiriCommunityMutationResultParser;
    }
}

export class BiribiriCommunityActionResultEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(callBack, BiribiriCommunityActionResultParser);
    }

    public getParser(): BiribiriCommunityActionResultParser
    {
        return this.parser as BiribiriCommunityActionResultParser;
    }
}

let registered = false;

export const RegisterBiribiriCommunityMessages = (): void =>
{
    if(registered) return;

    const connection = GetConnection();

    if(!connection) return;

    connection.registerMessages({
        events: new Map<number, Function>([
            [ BIRIBIRI_COMMUNITY_FEED_RESPONSE, BiribiriCommunityFeedEvent ],
            [ BIRIBIRI_COMMUNITY_MINE_RESPONSE, BiribiriCommunityMineEvent ],
            [ BIRIBIRI_COMMUNITY_MUTATION_RESULT, BiribiriCommunityMutationResultEvent ],
            [ BIRIBIRI_COMMUNITY_ACTION_RESULT, BiribiriCommunityActionResultEvent ]
        ]),
        composers: new Map<number, Function>([
            [ BIRIBIRI_COMMUNITY_FEED_REQUEST, BiribiriCommunityFeedRequestComposer ],
            [ BIRIBIRI_COMMUNITY_MINE_REQUEST, BiribiriCommunityMineRequestComposer ],
            [ BIRIBIRI_COMMUNITY_MUTATION_REQUEST, BiribiriCommunityMutationComposer ],
            [ BIRIBIRI_COMMUNITY_ACTION_REQUEST, BiribiriCommunityActionComposer ]
        ])
    });

    registered = true;
};
