import { FC, useEffect, useMemo, useState } from 'react';
import { Button, Column, Flex, NitroCardContentView, NitroCardHeaderView, NitroCardView, Text } from '../../../../common';
import { GetQuickReactions, REACTION_CUSTOMIZER_EVENT, REACTION_SLOT_COUNT, RequestReactionProfile, SaveReactionSlots, useReactionProfile } from './ReactionState';

export const ReactionCustomizerView: FC<{}> = props =>
{
    const profile = useReactionProfile();
    const [ visible, setVisible ] = useState(false);
    const [ selectedSlot, setSelectedSlot ] = useState(0);
    const [ draftSlots, setDraftSlots ] = useState<number[]>([]);

    useEffect(() =>
    {
        const open = () =>
        {
            RequestReactionProfile();
            setSelectedSlot(0);
            setVisible(true);
        }

        window.addEventListener(REACTION_CUSTOMIZER_EVENT, open);

        return () => window.removeEventListener(REACTION_CUSTOMIZER_EVENT, open);
    }, []);

    useEffect(() =>
    {
        if(!visible) return;

        setDraftSlots([ ...profile.quickSlots ]);
    }, [ profile, visible ]);

    const reactionById = useMemo(() =>
    {
        return new Map(profile.owned.map(reaction => [ reaction.id, reaction ]));
    }, [ profile.owned ]);

    const chooseReaction = (reactionId: number) =>
    {
        if(selectedSlot < 0 || selectedSlot >= REACTION_SLOT_COUNT) return;

        const next = [ ...draftSlots ];

        while(next.length < REACTION_SLOT_COUNT) next.push(0);

        const existingSlot = next.indexOf(reactionId);

        if(existingSlot >= 0)
        {
            const previous = next[selectedSlot];
            next[selectedSlot] = reactionId;
            next[existingSlot] = previous;
        }
        else
        {
            next[selectedSlot] = reactionId;
        }

        setDraftSlots(next);
    }

    const save = () =>
    {
        if(draftSlots.length !== REACTION_SLOT_COUNT) return;
        if(new Set(draftSlots).size !== REACTION_SLOT_COUNT) return;
        if(draftSlots.some(id => !reactionById.has(id))) return;

        SaveReactionSlots(draftSlots);
        setVisible(false);
    }

    if(!visible) return null;

    return (
        <NitroCardView uniqueKey="reaction-customizer" className="reaction-customizer-window" theme="primary-slim">
            <NitroCardHeaderView headerText="Personalizar reacciones" onCloseClick={ event => setVisible(false) } />
            <NitroCardContentView>
                <Column gap={ 2 }>
                    <Column gap={ 1 }>
                        <Text bold>Acceso rápido</Text>
                        <Text small>Elige un hueco y después una reacción de tu colección.</Text>
                        <div className="reaction-customizer-slots">
                            { Array.from({ length: REACTION_SLOT_COUNT }, (_, index) =>
                            {
                                const reaction = reactionById.get(draftSlots[index]);

                                return (
                                    <button
                                        key={ index }
                                        type="button"
                                        className={ `reaction-customizer-slot ${ selectedSlot === index ? 'is-selected' : '' }` }
                                        onClick={ () => setSelectedSlot(index) }
                                        title={ `Hueco ${ index + 1 }` }>
                                        { reaction?.glyph || '·' }
                                    </button>
                                );
                            }) }
                        </div>
                    </Column>

                    <Column gap={ 1 }>
                        <Text bold>Tu colección</Text>
                        <div className="reaction-customizer-collection">
                            { profile.owned.map(reaction =>
                                <button
                                    key={ reaction.id }
                                    type="button"
                                    className={ `reaction-customizer-owned ${ draftSlots.includes(reaction.id) ? 'is-equipped' : '' }` }
                                    onClick={ () => chooseReaction(reaction.id) }
                                    title={ `${ reaction.name } · ${ reaction.source }` }>
                                    <span>{ reaction.glyph }</span>
                                </button>
                            ) }
                        </div>
                    </Column>

                    <Flex gap={ 1 } justifyContent="end">
                        <Button variant="secondary" onClick={ () => setVisible(false) }>Cancelar</Button>
                        <Button variant="primary" onClick={ save }>Guardar</Button>
                    </Flex>
                </Column>
            </NitroCardContentView>
        </NitroCardView>
    );
}
