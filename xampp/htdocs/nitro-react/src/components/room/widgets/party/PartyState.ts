export interface PartyMenuState
{
    active: boolean;
    partyId: number;
    leaderUserId: number;
    selfUserId: number;
    memberIds: number[];
}

type PartyMenuListener = (state: PartyMenuState) => void;

let state: PartyMenuState = {
    active: false,
    partyId: 0,
    leaderUserId: 0,
    selfUserId: 0,
    memberIds: []
};

const listeners = new Set<PartyMenuListener>();

export const GetPartyMenuState = (): PartyMenuState => state;

export const SetPartyMenuState = (next: PartyMenuState): void =>
{
    state = next;
    listeners.forEach(listener => listener(state));
}

export const ClearPartyMenuState = (): void =>
{
    SetPartyMenuState({
        active: false,
        partyId: 0,
        leaderUserId: 0,
        selfUserId: 0,
        memberIds: []
    });
}

export const SubscribePartyMenuState = (
    listener: PartyMenuListener
): (() => void) =>
{
    listeners.add(listener);

    return () =>
    {
        listeners.delete(listener);
    };
}
