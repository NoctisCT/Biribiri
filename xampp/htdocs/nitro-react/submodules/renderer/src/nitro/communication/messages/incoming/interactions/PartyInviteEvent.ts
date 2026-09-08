import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { PartyInviteParser } from '../../parser/interactions';
export class PartyInviteEvent extends MessageEvent implements IMessageEvent { constructor(callBack: Function) { super(callBack, PartyInviteParser); } public getParser(): PartyInviteParser { return this.parser as PartyInviteParser; } }
