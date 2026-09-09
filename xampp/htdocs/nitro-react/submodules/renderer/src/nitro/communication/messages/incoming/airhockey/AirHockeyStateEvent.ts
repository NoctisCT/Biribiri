import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { AirHockeyStateParser } from '../../parser';

export class AirHockeyStateEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(callBack, AirHockeyStateParser);
    }

    public getParser(): AirHockeyStateParser
    {
        return this.parser as AirHockeyStateParser;
    }
}
