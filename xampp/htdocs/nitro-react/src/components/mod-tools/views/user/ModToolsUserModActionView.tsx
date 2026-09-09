import { CallForHelpTopicData, DefaultSanctionMessageComposer, ModAlertMessageComposer, ModBanMessageComposer, ModKickMessageComposer, ModMessageMessageComposer, ModMuteMessageComposer, ModTradingLockMessageComposer } from '@nitrots/nitro-renderer';
import { FC, useMemo, useState } from 'react';
import { ISelectedUser, LocalizeText, ModActionDefinition, NotificationAlertType, SendMessageComposer } from '../../../../api';
import { Button, Column, DraggableWindowPosition, Flex, NitroCardContentView, NitroCardHeaderView, NitroCardView, Text } from '../../../../common';
import { useModTools, useNotification } from '../../../../hooks';

interface ModToolsUserModActionViewProps
{
    user: ISelectedUser;
    onCloseClick: () => void;
}

const MOD_ACTION_DEFINITIONS = [
    new ModActionDefinition(1, 'Aviso', ModActionDefinition.ALERT, 1, 0),
    new ModActionDefinition(2, 'Silencio 1 h', ModActionDefinition.MUTE, 2, 0),
    new ModActionDefinition(3, 'Suspensión 18 h', ModActionDefinition.BAN, 3, 0),
    new ModActionDefinition(4, 'Suspensión 7 días', ModActionDefinition.BAN, 4, 0),
    new ModActionDefinition(5, 'Suspensión 30 días (paso 1)', ModActionDefinition.BAN, 5, 0),
    new ModActionDefinition(7, 'Suspensión 30 días (paso 2)', ModActionDefinition.BAN, 7, 0),
    new ModActionDefinition(6, 'Suspensión 100 años', ModActionDefinition.BAN, 6, 0),
    new ModActionDefinition(106, 'Suspensión del avatar 100 años', ModActionDefinition.BAN, 6, 0),
    new ModActionDefinition(101, 'Expulsar', ModActionDefinition.KICK, 0, 0),
    new ModActionDefinition(102, 'Bloquear intercambios 1 semana', ModActionDefinition.TRADE_LOCK, 0, 168),
    new ModActionDefinition(104, 'Bloquear intercambios permanentemente', ModActionDefinition.TRADE_LOCK, 0, 876000),
    new ModActionDefinition(105, 'Mensaje', ModActionDefinition.MESSAGE, 0, 0),
];

export const ModToolsUserModActionView: FC<ModToolsUserModActionViewProps> = props =>
{
    const { user = null, onCloseClick = null } = props;
    const [ selectedTopic, setSelectedTopic ] = useState(-1);
    const [ selectedAction, setSelectedAction ] = useState(-1);
    const [ message, setMessage ] = useState<string>('');
    const { cfhCategories = null, settings = null } = useModTools();
    const { simpleAlert = null } = useNotification();

    const topics = useMemo(() =>
    {
        const values: CallForHelpTopicData[] = [];

        if(cfhCategories && cfhCategories.length)
        {
            for(const category of cfhCategories)
            {
                for(const topic of category.topics) values.push(topic);
            }
        }

        return values;
    }, [ cfhCategories ]);

    const sendAlert = (message: string) => simpleAlert(message, NotificationAlertType.DEFAULT, null, null, 'Error');

    const sendDefaultSanction = () =>
    {
        let errorMessage: string = null;

        const category = topics[selectedTopic];

        if(selectedTopic === -1) errorMessage = 'Debes seleccionar un motivo';

        if(errorMessage) return sendAlert(errorMessage);

        const messageOrDefault = (message.trim().length === 0) ? LocalizeText(`help.cfh.topic.${ category.id }`) : message;

        SendMessageComposer(new DefaultSanctionMessageComposer(user.userId, selectedTopic, messageOrDefault));
        
        onCloseClick();
    }

    const sendSanction = () =>
    {
        let errorMessage: string = null;

        const category = topics[selectedTopic];
        const sanction = MOD_ACTION_DEFINITIONS[selectedAction];

        if((selectedTopic === -1) || (selectedAction === -1)) errorMessage = 'Debes seleccionar un motivo y una sanción';
        else if(!settings || !settings.cfhPermission) errorMessage = 'No tienes permiso para realizar esta acción';
        else if(!category) errorMessage = 'Debes seleccionar un motivo';
        else if(!sanction) errorMessage = 'Debes seleccionar una sanción';

        if(errorMessage)
        {
            sendAlert(errorMessage);
            
            return;
        }

        const messageOrDefault = (message.trim().length === 0) ? LocalizeText(`help.cfh.topic.${ category.id }`) : message;

        switch(sanction.actionType)
        {
            case ModActionDefinition.ALERT: {
                if(!settings.alertPermission)
                {
                    sendAlert('No tienes permisos suficientes');

                    return;
                }

                SendMessageComposer(new ModAlertMessageComposer(user.userId, messageOrDefault, category.id));
                break;
            }
            case ModActionDefinition.MUTE: 
                SendMessageComposer(new ModMuteMessageComposer(user.userId, messageOrDefault, category.id));
                break;
            case ModActionDefinition.BAN: {
                if(!settings.banPermission)
                {
                    sendAlert('No tienes permisos suficientes');

                    return;
                }

                SendMessageComposer(new ModBanMessageComposer(user.userId, messageOrDefault, category.id, selectedAction, (sanction.actionId === 106)));
                break;
            }
            case ModActionDefinition.KICK: {
                if(!settings.kickPermission)
                {
                    sendAlert('No tienes permisos suficientes');
                    return;
                }

                SendMessageComposer(new ModKickMessageComposer(user.userId, messageOrDefault, category.id));
                break;
            }
            case ModActionDefinition.TRADE_LOCK: {
                const numSeconds = (sanction.actionLengthHours * 60);

                SendMessageComposer(new ModTradingLockMessageComposer(user.userId, messageOrDefault, numSeconds, category.id));
                break;
            }
            case ModActionDefinition.MESSAGE: {
                if(message.trim().length === 0)
                {
                    sendAlert('Escribe un mensaje para el usuario');

                    return;
                }

                SendMessageComposer(new ModMessageMessageComposer(user.userId, message, category.id));
                break;
            }
        }

        onCloseClick();
    }

    if(!user) return null;

    return (
        <NitroCardView className="nitro-mod-tools-user-action" theme="primary-slim" windowPosition={ DraggableWindowPosition.TOP_LEFT }>
            <NitroCardHeaderView headerText={ 'Acción de moderación: ' + (user ? user.username : '') } onCloseClick={ () => onCloseClick() } />
            <NitroCardContentView className="text-black">
                <select className="form-select form-select-sm" value={ selectedTopic } onChange={ event => setSelectedTopic(parseInt(event.target.value)) }>
                    <option value={ -1 } disabled>Motivo</option>
                    { topics.map((topic, index) => <option key={ index } value={ index }>{ LocalizeText('help.cfh.topic.' + topic.id) }</option>) }
                </select>
                <select className="form-select form-select-sm" value={ selectedAction } onChange={ event => setSelectedAction(parseInt(event.target.value)) }>
                    <option value={ -1 } disabled>Tipo de sanción</option>
                    { MOD_ACTION_DEFINITIONS.map((action, index) => <option key={ index } value={ index }>{ action.name }</option>) }
                </select>
                <Column gap={ 1 }>
                    <Text small>Mensaje opcional; reemplaza el predeterminado</Text>
                    <textarea className="form-control" value={ message } onChange={ event => setMessage(event.target.value) }/>
                </Column>
                <Flex justifyContent="between" gap={ 1 }>
                    <Button variant="primary" onClick={ sendDefaultSanction }>Sanción predeterminada</Button>
                    <Button variant="success" onClick={ sendSanction }>Aplicar sanción</Button>
                </Flex>
            </NitroCardContentView>
        </NitroCardView>
    );
}
