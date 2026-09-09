import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { AirHockeyErrorParser } from '../../parser';

export class AirHockeyErrorEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(callBack, AirHockeyErrorParser);
    }

    public getParser(): AirHockeyErrorParser
    {
        return this.parser as AirHockeyErrorParser;
    }
}
