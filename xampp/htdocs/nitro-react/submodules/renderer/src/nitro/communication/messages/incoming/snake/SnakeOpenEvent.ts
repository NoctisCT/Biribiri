import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { SnakeOpenParser } from '../../parser';

export class SnakeOpenEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(
            callBack,
            SnakeOpenParser
        );
    }

    public getParser(): SnakeOpenParser
    {
        return this.parser as SnakeOpenParser;
    }
}
