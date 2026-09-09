import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { AsteroidsOpenParser } from '../../parser';

export class AsteroidsOpenEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(
            callBack,
            AsteroidsOpenParser
        );
    }

    public getParser(): AsteroidsOpenParser
    {
        return this.parser as AsteroidsOpenParser;
    }
}
