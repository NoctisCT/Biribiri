// BIRIBIRI_CLOTHING_FAVORITES_V1
// BIRIBIRI_WARDROBE_HC_FREE_V1
import { FC, MouseEvent, useEffect, useState } from 'react';
import { AvatarEditorGridPartItem } from '../../../../api';
import { LayoutCurrencyIcon, LayoutGridItem, LayoutGridItemProps } from '../../../../common';
import { AvatarEditorIcon } from '../AvatarEditorIcon';

export interface AvatarEditorFigureSetItemViewProps extends LayoutGridItemProps
{
    partItem: AvatarEditorGridPartItem;
    isFavorite?: boolean;
    onFavoriteToggle?: (event: MouseEvent<HTMLElement>) => void;
}

export const AvatarEditorFigureSetItemView: FC<AvatarEditorFigureSetItemViewProps> = props =>
{
    const {
        partItem = null,
        isFavorite = false,
        onFavoriteToggle = null,
        children = null,
        ...rest
    } = props;
    const [ updateId, setUpdateId ] = useState(-1);

    useEffect(() =>
    {
        const rerender = () => setUpdateId(prevValue => (prevValue + 1));

        partItem.notify = rerender;

        return () => partItem.notify = null;
    }, [ partItem ]);

    return (
        <div className="avatar-container">
            <LayoutGridItem className={ `avatar-parts ${ partItem.isSelected ? 'part-selected' : '' }` } itemImage={ (partItem.isClear ? undefined : partItem.imageUrl) } { ...rest }>
                { partItem.isClear && <AvatarEditorIcon icon="clear" /> }
                { partItem.isSellable && <AvatarEditorIcon icon="sellable" position="absolute" className="end-1 bottom-1" /> }

                { !partItem.isClear &&
                    <i
                        className={
                            `biribiri-clothing-favorite${
                                isFavorite
                                    ? ' is-favorite'
                                    : ''
                            }`
                        }
                        title={
                            isFavorite
                                ? 'Quitar de favoritas'
                                : 'A\u00f1adir a favoritas'
                        }
                        onClick={
                            event =>
                            {
                                event.stopPropagation();

                                if(onFavoriteToggle)
                                {
                                    onFavoriteToggle(event);
                                }
                            }
                        } /> }

                { children }
            </LayoutGridItem>
        </div>
    );
}
