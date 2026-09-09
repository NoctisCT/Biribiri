import { IMessageDataWrapper, IMessageParser } from '../../../../../api';

export interface ArcadeLeaderboardEntryData
{
    rank: number;
    username: string;
    score: number;
    level: number;
}

export class ArcadeLeaderboardParser implements IMessageParser
{
    private _gameKey = '';
    private _context = 0;
    private _message = '';
    private _newRecord = false;
    private _personalBest = 0;
    private _personalLevel = 1;
    private _personalRank = 0;
    private _totalPlayers = 0;
    private _entries: ArcadeLeaderboardEntryData[] = [];

    public flush(): boolean
    {
        this._gameKey = '';
        this._context = 0;
        this._message = '';
        this._newRecord = false;
        this._personalBest = 0;
        this._personalLevel = 1;
        this._personalRank = 0;
        this._totalPlayers = 0;
        this._entries = [];

        return true;
    }

    public parse(
        wrapper: IMessageDataWrapper): boolean
    {
        if(!wrapper) return false;

        this._gameKey = wrapper.readString();
        this._context = wrapper.readInt();
        this._message = wrapper.readString();
        this._newRecord = wrapper.readBoolean();
        this._personalBest = wrapper.readInt();
        this._personalLevel = wrapper.readInt();
        this._personalRank = wrapper.readInt();
        this._totalPlayers = wrapper.readInt();

        const count = wrapper.readInt();

        this._entries = [];

        for(let i = 0; i < count; i++)
        {
            this._entries.push({
                rank: wrapper.readInt(),
                username: wrapper.readString(),
                score: wrapper.readInt(),
                level: wrapper.readInt()
            });
        }

        return true;
    }

    public get gameKey(): string
    {
        return this._gameKey;
    }

    public get context(): number
    {
        return this._context;
    }

    public get message(): string
    {
        return this._message;
    }

    public get newRecord(): boolean
    {
        return this._newRecord;
    }

    public get personalBest(): number
    {
        return this._personalBest;
    }

    public get personalLevel(): number
    {
        return this._personalLevel;
    }

    public get personalRank(): number
    {
        return this._personalRank;
    }

    public get totalPlayers(): number
    {
        return this._totalPlayers;
    }

    public get entries(): ArcadeLeaderboardEntryData[]
    {
        return this._entries;
    }
}
