import { FriendlyTime, GetModeratorUserInfoMessageComposer, ModeratorUserInfoData, ModeratorUserInfoEvent } from '@nitrots/nitro-renderer';
import { FC, useEffect, useMemo, useState } from 'react';
import { CreateLinkEvent, LocalizeText, SendMessageComposer } from '../../../../api';
import { Button, Column, DraggableWindowPosition, Grid, NitroCardContentView, NitroCardHeaderView, NitroCardView } from '../../../../common';
import { useMessageEvent } from '../../../../hooks';
import { ModToolsUserModActionView } from './ModToolsUserModActionView';
import { ModToolsUserRoomVisitsView } from './ModToolsUserRoomVisitsView';
import { ModToolsUserSendMessageView } from './ModToolsUserSendMessageView';

interface ModToolsUserViewProps
{
    userId: number;
    onCloseClick: () => void;
}

export const ModToolsUserView: FC<ModToolsUserViewProps> = props =>
{
    const { onCloseClick = null, userId = null } = props;
    const [ userInfo, setUserInfo ] = useState<ModeratorUserInfoData>(null);
    const [ sendMessageVisible, setSendMessageVisible ] = useState(false);
    const [ modActionVisible, setModActionVisible ] = useState(false);
    const [ roomVisitsVisible, setRoomVisitsVisible ] = useState(false);

    const userProperties = useMemo(() =>
    {
        if(!userInfo) return null;

        return [
            {
                label: 'Nombre de usuario',
                value: userInfo.userName,
                showOnline: true
            },
            {
                label: 'Solicitudes de ayuda',
                value: userInfo.cfhCount.toString()
            },
            {
                label: 'Solicitudes abusivas',
                value: userInfo.abusiveCfhCount.toString()
            },
            {
                label: 'Advertencias',
                value: userInfo.cautionCount.toString()
            },
            {
                label: 'Suspensiones',
                value: userInfo.banCount.toString()
            },
            {
                label: 'Última sanción',
                value: userInfo.lastSanctionTime
            },
            {
                label: 'Bloqueos de intercambio',
                value: userInfo.tradingLockCount.toString()
            },
            {
                label: 'Fin del bloqueo de intercambio',
                value: userInfo.tradingExpiryDate
            },
            {
                label: 'Última conexión',
                value: FriendlyTime.format(userInfo.minutesSinceLastLogin * 60, '.ago', 2)
            },
            {
                label: 'Última compra',
                value: userInfo.lastPurchaseDate
            },
            {
                label: 'Correo principal',
                value: userInfo.primaryEmailAddress
            },
            {
                label: 'Suspensiones relacionadas con identidad',
                value: userInfo.identityRelatedBanCount.toString()
            },
            {
                label: 'Antigüedad de la cuenta',
                value: FriendlyTime.format(userInfo.registrationAgeInMinutes * 60, '.ago', 2)
            },
            {
                label: 'Clasificación del usuario',
                value: userInfo.userClassification
            }
        ];
    }, [ userInfo ]);

    useMessageEvent<ModeratorUserInfoEvent>(ModeratorUserInfoEvent, event =>
    {
        const parser = event.getParser();
    
        if(!parser || parser.data.userId !== userId) return;
    
        setUserInfo(parser.data);
    });

    useEffect(() =>
    {
        SendMessageComposer(new GetModeratorUserInfoMessageComposer(userId));
    }, [ userId ]);

    if(!userInfo) return null;

    return (
        <>
            <NitroCardView className="nitro-mod-tools-user" theme="primary-slim" windowPosition={ DraggableWindowPosition.TOP_LEFT }>
                <NitroCardHeaderView headerText={ LocalizeText('modtools.userinfo.title', [ 'username' ], [ userInfo.userName ]) } onCloseClick={ () => onCloseClick() } />
                <NitroCardContentView className="text-black">
                    <Grid overflow="hidden">
                        <Column size={ 8 } overflow="auto">
                            <table className="table table-striped table-sm table-text-small text-black m-0">
                                <tbody>
                                    { userProperties.map( (property, index) =>
                                    {

                                        return (
                                            <tr key={ index }>
                                                <th scope="row">{ property.label }</th>
                                                <td>
                                                    { property.value }
                                                    { property.showOnline &&
                                                    <i className={ `icon icon-pf-${ userInfo.online ? 'online' : 'offline' } ms-2` } /> }
                                                </td>
                                            </tr>
                                        );
                                    }) }
                                </tbody>
                            </table>
                        </Column>
                        <Column size={ 4 } gap={ 1 }>
                            <Button onClick={ event => CreateLinkEvent(`mod-tools/open-user-chatlog/${ userId }`) }>
                                Historial de sala
                            </Button>
                            <Button onClick={ event => setSendMessageVisible(!sendMessageVisible) }>
                                Enviar mensaje
                            </Button>
                            <Button onClick={ event => setRoomVisitsVisible(!roomVisitsVisible) }>
                                Visitas a salas
                            </Button>
                            <Button onClick={ event => setModActionVisible(!modActionVisible) }>
                                Acción de moderación
                            </Button>
                        </Column>
                    </Grid>
                </NitroCardContentView>
            </NitroCardView>
            { sendMessageVisible &&
                <ModToolsUserSendMessageView user={ { userId: userId, username: userInfo.userName } } onCloseClick={ () => setSendMessageVisible(false) } /> }
            { modActionVisible &&
                <ModToolsUserModActionView user={ { userId: userId, username: userInfo.userName } } onCloseClick={ () => setModActionVisible(false) } /> }
            { roomVisitsVisible &&
                <ModToolsUserRoomVisitsView userId={ userId } onCloseClick={ () => setRoomVisitsVisible(false) } /> }
        </>
    );
}
