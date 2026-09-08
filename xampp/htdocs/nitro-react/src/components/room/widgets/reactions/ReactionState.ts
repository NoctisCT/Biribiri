import { AvatarReactionComposer, GetReactionProfileComposer, SaveReactionDisplayModeComposer, SaveReactionSlotsComposer } from '@nitrots/nitro-renderer';
import { useEffect, useState } from 'react';
import { SendMessageComposer } from '../../../../api';

export interface ReactionDefinition
{
    id: number;
    code: string;
    glyph: string;
    name: string;
    source: string;
}

export interface ReactionProfileState
{
    displayMode: number;
    quickSlots: number[];
    owned: ReactionDefinition[];
}

export const REACTION_DISPLAY_BOXED = 0;
export const REACTION_DISPLAY_FLOATING = 1;
export const REACTION_DISPLAY_HIDDEN = 2;
export const REACTION_SLOT_COUNT = 12;
export const REACTION_CUSTOMIZER_EVENT = 'biribiri:open-reaction-customizer';

export const DEFAULT_REACTIONS: ReactionDefinition[] = [
    { id: 1, code: 'heart', glyph: '❤️', name: 'Corazón', source: 'base' },
    { id: 2, code: 'laugh', glyph: '😂', name: 'Risa', source: 'base' },
    { id: 3, code: 'fire', glyph: '🔥', name: 'Fuego', source: 'base' },
    { id: 4, code: 'skull', glyph: '💀', name: 'Calavera', source: 'base' },
    { id: 5, code: 'sparkle', glyph: '✨', name: 'Brillo', source: 'base' },
    { id: 6, code: 'exclamation', glyph: '❗', name: 'Impacto', source: 'base' },
    { id: 7, code: 'cry', glyph: '😭', name: 'Llorar', source: 'base' },
    { id: 8, code: 'angry', glyph: '😡', name: 'Enfado', source: 'base' },
    { id: 9, code: 'question', glyph: '❓', name: 'Interrogación', source: 'base' },
    { id: 10, code: 'clap', glyph: '👏', name: 'Aplausos', source: 'base' },
    { id: 11, code: 'surprised', glyph: '😮', name: 'Sorpresa', source: 'base' },
    { id: 12, code: 'thumbs_up', glyph: '👍', name: 'Aprobación', source: 'base' }
];

let currentProfile: ReactionProfileState = {
    displayMode: REACTION_DISPLAY_BOXED,
    quickSlots: DEFAULT_REACTIONS.map(reaction => reaction.id),
    owned: DEFAULT_REACTIONS
};

const listeners = new Set<(profile: ReactionProfileState) => void>();

const emit = () =>
{
    const snapshot: ReactionProfileState = {
        displayMode: currentProfile.displayMode,
        quickSlots: [ ...currentProfile.quickSlots ],
        owned: currentProfile.owned.map(reaction => ({ ...reaction }))
    };

    listeners.forEach(listener => listener(snapshot));
}

export const ApplyReactionProfile = (parser: any) =>
{
    const owned: ReactionDefinition[] = (parser.owned || []).map((reaction: any) => ({
        id: reaction.id,
        code: reaction.code,
        glyph: reaction.glyph,
        name: reaction.name,
        source: reaction.source
    }));

    const quickSlots = (parser.quickSlots || []).slice(0, REACTION_SLOT_COUNT);

    currentProfile = {
        displayMode: parser.displayMode,
        quickSlots: quickSlots.length === REACTION_SLOT_COUNT ? quickSlots : DEFAULT_REACTIONS.map(reaction => reaction.id),
        owned: owned.length ? owned : DEFAULT_REACTIONS
    };

    emit();
}

export const useReactionProfile = () =>
{
    const [ profile, setProfile ] = useState<ReactionProfileState>(currentProfile);

    useEffect(() =>
    {
        listeners.add(setProfile);

        return () =>
        {
            listeners.delete(setProfile);
        }
    }, []);

    return profile;
}

export const GetQuickReactions = (profile: ReactionProfileState): ReactionDefinition[] =>
{
    const byId = new Map(profile.owned.map(reaction => [ reaction.id, reaction ]));

    return profile.quickSlots
        .map(id => byId.get(id))
        .filter((reaction): reaction is ReactionDefinition => !!reaction);
}

export const RequestReactionProfile = () =>
{
    SendMessageComposer(new GetReactionProfileComposer());
}

export const SendReaction = (reactionId: number) =>
{
    SendMessageComposer(new AvatarReactionComposer(reactionId));
}

export const SaveReactionSlots = (reactionIds: number[]) =>
{
    if(reactionIds.length !== REACTION_SLOT_COUNT) return;

    SendMessageComposer(new SaveReactionSlotsComposer(...reactionIds));
}

export const SaveReactionDisplayMode = (mode: number) =>
{
    if(mode < REACTION_DISPLAY_BOXED || mode > REACTION_DISPLAY_HIDDEN) return;

    currentProfile = {
        ...currentProfile,
        displayMode: mode
    };

    emit();

    SendMessageComposer(new SaveReactionDisplayModeComposer(mode));
}

export const OpenReactionCustomizer = () =>
{
    RequestReactionProfile();
    window.dispatchEvent(new CustomEvent(REACTION_CUSTOMIZER_EVENT));
}
