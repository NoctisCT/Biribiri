import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { ArcadeLeaderboardParser } from '../../parser';

export class ArcadeLeaderboardEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(
            callBack,
            ArcadeLeaderboardParser
        );
    }

    public getParser(): ArcadeLeaderboardParser
    {
        return this.parser as ArcadeLeaderboardParser;
    }
}
