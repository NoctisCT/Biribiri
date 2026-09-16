// BIRIBIRI_WARDROBE_V3_TRUE_RGB
// BIRIBIRI_WARDROBE_V3_1_RGB_POLISH
// BIRIBIRI_WARDROBE_V3_2_RGB_RESPONSIVE
// BIRIBIRI_WARDROBE_V3_3_COMMIT_ON_RELEASE
// BIRIBIRI_WARDROBE_V3_4_DEFERRED_COLOR_AND_LAZY_INIT
// BIRIBIRI_WARDROBE_HC_FREE_V1
import { FC, useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import {
    AvatarEditorGridColorItem,
    BiribiriHexToRgbInt,
    BiribiriRgbIntToHex,
    CategoryData,
    EncodeBiribiriCustomColor,
    IAvatarEditorCategoryModel,
    IsBiribiriCustomColorId,
    NormalizeBiribiriHex
} from '../../../../api';
import { AutoGrid } from '../../../../common';
import { AvatarEditorPaletteSetItem } from './AvatarEditorPaletteSetItemView';

export interface AvatarEditorPaletteSetViewProps
{
    model: IAvatarEditorCategoryModel;
    category: CategoryData;
    paletteSet: AvatarEditorGridColorItem[];
    paletteIndex: number;
}

export const AvatarEditorPaletteSetView: FC<AvatarEditorPaletteSetViewProps> = props =>
{
    const {
        model = null,
        category = null,
        paletteSet = [],
        paletteIndex = -1
    } = props;

    const elementRef = useRef<HTMLDivElement>(null);
    const nativeInputRef = useRef<HTMLInputElement>(null);
    const hexInputRef = useRef<HTMLInputElement>(null);
    const settleTimerRef = useRef<number>(null);
    const pendingRgbRef = useRef<number>(-1);
    const lastCommittedRgbRef = useRef<number>(-1);

    const visiblePalette = useMemo(
        () =>
            paletteSet.filter(
                item =>
                    item &&
                    item.partColor &&
                    !IsBiribiriCustomColorId(
                        item.partColor.id
                    )
            ),
        [ paletteSet ]
    );

    const selectedHex = useMemo((): string =>
    {
        const selected =
            category?.getSelectedColor(
                paletteIndex
            );

        if(selected && selected.partColor)
        {
            return BiribiriRgbIntToHex(
                selected.partColor.rgb
            );
        }

        const selectedFromSet =
            paletteSet.find(
                item =>
                    item &&
                    item.isSelected &&
                    item.partColor
            );

        if(
            selectedFromSet &&
            selectedFromSet.partColor
        )
        {
            return BiribiriRgbIntToHex(
                selectedFromSet.partColor.rgb
            );
        }

        const first = paletteSet[0];

        if(first && first.partColor)
        {
            return BiribiriRgbIntToHex(
                first.partColor.rgb
            );
        }

        return '#FFFFFF';
    }, [
        category,
        paletteIndex,
        paletteSet
    ]);

    const syncControls = useCallback(
        (hex: string) =>
    {
        const normalized =
            NormalizeBiribiriHex(hex);

        if(!normalized) return;

        if(nativeInputRef.current)
        {
            nativeInputRef.current.value =
                normalized;
        }

        if(hexInputRef.current)
        {
            hexInputRef.current.value =
                normalized;
        }
    }, []);

    const clearSettleTimer = useCallback(() =>
    {
        if(settleTimerRef.current === null)
        {
            return;
        }

        window.clearTimeout(
            settleTimerRef.current
        );

        settleTimerRef.current = null;
    }, []);

    const commitPending = useCallback(() =>
    {
        clearSettleTimer();

        const rgb =
            pendingRgbRef.current;

        if(
            rgb < 0 ||
            rgb > 0xFFFFFF ||
            !model ||
            !category ||
            paletteIndex < 0
        ) return;

        if(rgb === lastCommittedRgbRef.current)
        {
            syncControls(
                BiribiriRgbIntToHex(rgb)
            );

            return;
        }

        lastCommittedRgbRef.current = rgb;

        model.selectCustomColor(
            category.name,
            EncodeBiribiriCustomColor(rgb),
            paletteIndex
        );

        syncControls(
            BiribiriRgbIntToHex(rgb)
        );
    }, [
        model,
        category,
        paletteIndex,
        clearSettleTimer,
        syncControls
    ]);

    const stageNativeColor = useCallback(
        (value: string) =>
    {
        const normalized =
            NormalizeBiribiriHex(value);

        if(!normalized) return;

        const rgb =
            BiribiriHexToRgbInt(
                normalized
            );

        if(rgb < 0) return;

        pendingRgbRef.current = rgb;

        if(hexInputRef.current)
        {
            hexInputRef.current.value =
                normalized;
        }

        // El diálogo nativo de Chrome puede disparar tanto input como change
        // mientras se arrastra. Ninguno de los dos aplica ya el figure.
        // Solo confirmamos cuando cesan los eventos durante un instante.
        clearSettleTimer();

        settleTimerRef.current =
            window.setTimeout(
                commitPending,
                450
            );
    }, [
        clearSettleTimer,
        commitPending
    ]);

    const commitHexText = useCallback(
        (value: string) =>
    {
        const normalized =
            NormalizeBiribiriHex(value);

        if(!normalized)
        {
            syncControls(
                selectedHex
            );

            return;
        }

        const rgb =
            BiribiriHexToRgbInt(
                normalized
            );

        if(rgb < 0) return;

        pendingRgbRef.current = rgb;

        commitPending();
    }, [
        selectedHex,
        syncControls,
        commitPending
    ]);

    const selectColor = useCallback(
        (item: AvatarEditorGridColorItem) =>
    {
        const index =
            paletteSet.indexOf(item);

        if(index === -1) return;

        clearSettleTimer();

        model.selectColor(
            category.name,
            index,
            paletteIndex
        );

        if(item.partColor)
        {
            const rgb =
                item.partColor.rgb;

            pendingRgbRef.current = rgb;
            lastCommittedRgbRef.current = rgb;

            syncControls(
                BiribiriRgbIntToHex(rgb)
            );
        }
    }, [
        model,
        category,
        paletteSet,
        paletteIndex,
        clearSettleTimer,
        syncControls
    ]);

    useLayoutEffect(() =>
    {
        const rgb =
            BiribiriHexToRgbInt(
                selectedHex
            );

        pendingRgbRef.current = rgb;
        lastCommittedRgbRef.current = rgb;

        syncControls(
            selectedHex
        );

        if(elementRef.current)
        {
            elementRef.current.scrollTop = 0;
        }

        return () =>
        {
            clearSettleTimer();
        };
    }, [
        category,
        paletteIndex,
        selectedHex,
        syncControls,
        clearSettleTimer
    ]);

    return (
        <div
            className="biribiri-color-palette"
            data-biribiri-color={ 'true-rgb-v4' }>
            <AutoGrid
                className="py-1 avatar-editor-palette-set-view"
                innerRef={ elementRef }
                gap={ 1 }
                columnCount={ 8 }
                columnMinWidth={ 14 }>
                { visiblePalette.length > 0 &&
                    visiblePalette.map(
                        (item, index) => (
                            <AvatarEditorPaletteSetItem
                                key={
                                    `${
                                        item.partColor?.id ??
                                        index
                                    }-${ index }`
                                }
                                colorItem={ item }
                                onClick={
                                    () =>
                                        selectColor(item)
                                }
                            />
                        )
                    ) }
            </AutoGrid>

            <div className="biribiri-free-color">
                <input
                    ref={ nativeInputRef }
                    className="biribiri-color-native"
                    type="color"
                    defaultValue={ selectedHex }
                    aria-label="Color libre"
                    onInput={
                        event =>
                            stageNativeColor(
                                (
                                    event.target as
                                    HTMLInputElement
                                ).value
                            )
                    }
                    onChange={
                        event =>
                            stageNativeColor(
                                event.target.value
                            )
                    }
                    onBlur={ commitPending } />

                <input
                    ref={ hexInputRef }
                    className="biribiri-color-hex"
                    type="text"
                    defaultValue={ selectedHex }
                    maxLength={ 7 }
                    spellCheck={ false }
                    aria-label="HEX"
                    onBlur={
                        event =>
                            commitHexText(
                                event.target.value
                            )
                    }
                    onKeyDown={
                        event =>
                        {
                            if(event.key === 'Enter')
                            {
                                commitHexText(
                                    (
                                        event.target as
                                        HTMLInputElement
                                    ).value
                                );

                                (
                                    event.target as
                                    HTMLInputElement
                                ).blur();
                            }
                        }
                    } />
            </div>
        </div>
    );
};
