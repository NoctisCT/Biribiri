import { RedeemItemClothingComposer, RoomObjectCategory, UserFigureComposer } from '@nitrots/nitro-renderer';
import { FC, useEffect, useState } from 'react';
import { FigureData, FurniCategory, GetAvatarRenderManager, GetConnection, GetFurnitureDataForRoomObject, GetSessionDataManager, LocalizeText } from '../../../../../api';
import { Base, Button, Column, Flex, LayoutAvatarImageView, NitroCardContentView, NitroCardHeaderView, NitroCardView, Text } from '../../../../../common';
import { useRoom } from '../../../../../hooks';

interface PurchasableClothingConfirmViewProps
{
    objectId: number;
    onClose: () => void;
}

const MODE_DEFAULT: number = -1;
const MODE_PURCHASABLE_CLOTHING: number = 0;

export const PurchasableClothingConfirmView: FC<PurchasableClothingConfirmViewProps> = props =>
{
    const { objectId = -1, onClose = null } = props;
    const [ mode, setMode ] = useState(MODE_DEFAULT);
    const [ gender, setGender ] = useState<string>(FigureData.MALE);
    const [ newFigure, setNewFigure ] = useState<string>(null);
    const { roomSession = null } = useRoom();

    const useProduct = () =>
    {
        GetConnection().send(new RedeemItemClothingComposer(objectId));
        GetConnection().send(new UserFigureComposer(gender, newFigure));

        onClose();
    }

    useEffect(() =>
    {
        let mode = MODE_DEFAULT;

        const sessionFigure = GetSessionDataManager().figure;
        const sessionGender = GetSessionDataManager().gender;

        let previewGender = sessionGender;
        let previewFigure = GetAvatarRenderManager().createFigureContainer(sessionFigure);

        if(roomSession && (objectId >= 0))
        {
            const furniData = GetFurnitureDataForRoomObject(roomSession.roomId, objectId, RoomObjectCategory.FLOOR);

            if(furniData)
            {
                switch(furniData.specialType)
                {
                    case FurniCategory.FIGURE_PURCHASABLE_SET:
                        mode = MODE_PURCHASABLE_CLOTHING;

                        const setIds = furniData.customParams
                            .split(',')
                            .map(part => parseInt(part))
                            .filter(setId => Number.isFinite(setId));

                        const partSets = setIds
                            .map(setId => GetAvatarRenderManager().structureData.getFigurePartSet(setId))
                            .filter(partSet => !!partSet);

                        const hasCompatibleSet = partSets.some(
                            partSet =>
                                (partSet.gender === sessionGender) ||
                                (partSet.gender === FigureData.UNISEX)
                        );

                        if(!hasCompatibleSet)
                        {
                            const specificGenders = Array.from(
                                new Set(
                                    partSets
                                        .map(partSet => partSet.gender)
                                        .filter(
                                            value =>
                                                (value === FigureData.MALE) ||
                                                (value === FigureData.FEMALE)
                                        )
                                )
                            );

                            if(specificGenders.length === 1)
                            {
                                previewGender = specificGenders[0];

                                const fallbackFigure =
                                    (previewGender === FigureData.FEMALE)
                                        ? 'hr-515-33.hd-600-1.ch-635-70.lg-716-66-62.sh-735-68'
                                        : 'hr-100.hd-180-7.ch-215-66.lg-270-79.sh-305-62.ha-1002-70.wa-2007';

                                previewFigure = GetAvatarRenderManager().createFigureContainer(fallbackFigure);
                            }
                        }

                        for(const partSet of partSets)
                        {
                            if(
                                (partSet.gender !== previewGender) &&
                                (partSet.gender !== FigureData.UNISEX)
                            ) continue;

                            previewFigure.updatePart(
                                partSet.type,
                                partSet.id,
                                previewFigure.getPartColorIds(partSet.type) || []
                            );
                        }

                        break;
                }
            }
        }

        if(mode === MODE_DEFAULT)
        {
            onClose();

            return;
        }
        
        setGender(previewGender);
        setNewFigure(previewFigure.getFigureString());

        // if owns clothing, change to it

        setMode(mode);
    }, [ roomSession, objectId, onClose ]);

    if(mode === MODE_DEFAULT) return null;
    
    return (
        <NitroCardView className="nitro-use-product-confirmation">
            <NitroCardHeaderView headerText={ LocalizeText('useproduct.widget.title.bind_clothing') } onCloseClick={ onClose } />
            <NitroCardContentView center>
                <Flex gap={ 2 } overflow="hidden">
                    <Column>
                        <Base className="mannequin-preview">
                            <LayoutAvatarImageView figure={ newFigure } gender={ gender } direction={ 2 } />
                        </Base>
                    </Column>
                    <Column justifyContent="between" overflow="auto">
                        <Column gap={ 2 }>
                            <Text>{ LocalizeText('useproduct.widget.text.bind_clothing') }</Text>
                            <Text>{ LocalizeText('useproduct.widget.info.bind_clothing') }</Text>
                        </Column>
                        <Flex alignItems="center" justifyContent="between">
                            <Button variant="danger" onClick={ onClose }>{ LocalizeText('useproduct.widget.cancel') }</Button>
                            <Button variant="success" onClick={ useProduct }>{ LocalizeText('useproduct.widget.bind_clothing') }</Button>
                        </Flex>
                    </Column>
                </Flex>
            </NitroCardContentView>
        </NitroCardView>
    );
}
