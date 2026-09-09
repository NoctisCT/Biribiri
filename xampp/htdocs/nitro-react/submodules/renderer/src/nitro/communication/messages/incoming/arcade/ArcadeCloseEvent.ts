import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { ArcadeCloseParser } from '../../parser';

export class ArcadeCloseEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(
            callBack,
            ArcadeCloseParser
        );
    }

    public getParser(): ArcadeCloseParser
    {
        return this.parser as ArcadeCloseParser;
    }
}
