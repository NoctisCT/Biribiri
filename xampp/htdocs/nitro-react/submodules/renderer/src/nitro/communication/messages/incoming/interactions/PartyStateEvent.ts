import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { PartyStateParser } from '../../parser/interactions';
export class PartyStateEvent extends MessageEvent implements IMessageEvent { constructor(callBack: Function) { super(callBack, PartyStateParser); } public getParser(): PartyStateParser { return this.parser as PartyStateParser; } }
