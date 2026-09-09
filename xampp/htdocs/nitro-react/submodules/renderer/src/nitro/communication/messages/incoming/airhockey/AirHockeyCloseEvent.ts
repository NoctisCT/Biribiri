import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { AirHockeyCloseParser } from '../../parser';

export class AirHockeyCloseEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(callBack, AirHockeyCloseParser);
    }

    public getParser(): AirHockeyCloseParser
    {
        return this.parser as AirHockeyCloseParser;
    }
}
