import {
    RpgEngineSheetField,
    RpgEngineSheetTemplate
} from '@nitrots/nitro-renderer';
import {
    CSSProperties,
    FC,
    MouseEvent as ReactMouseEvent,
    ReactNode,
    useEffect,
    useRef,
    useState
} from 'react';
import {
    FaArrowsAltH,
    FaArrowsAltV,
    FaGripVertical,
    FaImage,
    FaMinus,
    FaMusic,
    FaPlus,
    FaSave,
    FaTrash,
    FaUndo
} from 'react-icons/fa';
import { createPortal } from 'react-dom';
import { Button } from '../../common';

export interface RpgCharacterDesignBlock
{
    blockType: 'section' | 'field';
    sourceId: number;
    sortOrder: number;
    widthSpan: number;
    alignment: 'left' | 'center' | 'right';
    imageWidthPct: number;
    imageMaxHeight: number;
    labelVisible: boolean;
}

export interface RpgCharacterDesign
{
    characterId: number;
    rpgId: number;
    userId: number;
    backgroundColor: string;
    backgroundImageUrl: string;
    primaryColor: string;
    secondaryColor: string;
    textColor: string;
    panelColor: string;
    panelOpacity: number;
    bannerImageUrl: string;
    bannerHeight: number;
    contentWidth: number;
    borderRadius: number;
    advancedJson?: string;
    blocks: RpgCharacterDesignBlock[];
}

type AdvancedKind =
    'section' |
    'field' |
    'text' |
    'image' |
    'divider' |
    'spacer';

type LabelMode = 'above' | 'inline' | 'hidden';

interface AdvancedSheetItem
{
    id: string;
    kind: AdvancedKind;
    sourceId?: number;

    widthSpan: number;
    height: number;
    alignment: 'left' | 'center' | 'right';

    labelMode: LabelMode;
    labelVisible: boolean;

    imageWidthPct: number;
    imageMaxHeight: number;
    imageRadius: number;
    imageOpacity: number;
    imageBorderColor: string;
    imageBorderWidth: number;
    imageBorderStyle: 'solid' | 'dashed' | 'dotted' | 'double';
    imageShadowEnabled: boolean;
    imageShadowColor: string;
    imageShadowOpacity: number;
    imageShadowBlur: number;
    imageShadowX: number;
    imageShadowY: number;

    boxMode: 'full' | 'fit' | 'none';
    backgroundColor: string;
    backgroundOpacity: number;
    borderColor: string;
    borderWidth: number;
    borderStyle: 'solid' | 'dashed' | 'dotted' | 'double';
    gradientEnabled: boolean;
    gradientColor2: string;
    gradientAngle: number;
    shadowEnabled: boolean;
    shadowColor: string;
    shadowOpacity: number;
    shadowBlur: number;
    shadowX: number;
    shadowY: number;
    textColor: string;
    labelColor: string;
    padding: number;
    radius: number;

    fontFamily: string;
    fontSize: number;
    fontBold: boolean;
    fontItalic: boolean;
    fontUnderline: boolean;

    labelFontFamily: string;
    labelFontSize: number;
    labelBold: boolean;
    labelItalic: boolean;
    labelUnderline: boolean;

    mergeGroup: string;
    mergeLayout: 'column' | 'row';
    mergeGap: number;

    title: string;
    content: string;
    imageUrl: string;
}

interface AdvancedSheetDesign
{
    version: 2;

    backgroundSize: 'cover' | 'contain' | 'auto';
    backgroundPosition: 'left' | 'center' | 'right' | 'top' | 'bottom';
    backgroundRepeat: boolean;

    bannerPosition: 'left' | 'center' | 'right' | 'top' | 'bottom';
    showHeaderText: boolean;

    musicUrl: string;
    musicTitle: string;
    musicVolume: number;
    musicLoop: boolean;

    overlayImageUrl: string;
    overlayOpacity: number;
    overlaySize: 'cover' | 'contain' | 'auto';
    overlayPosition: 'left' | 'center' | 'right' | 'top' | 'bottom';
    overlayBlendMode: 'normal' | 'multiply' | 'screen' | 'overlay' | 'soft-light';

    items: AdvancedSheetItem[];
}

interface StyledSheetProps
{
    template: RpgEngineSheetTemplate;
    values: Record<number, string>;
    username: string;
    rpgName: string;
    design?: RpgCharacterDesign | null;
}

interface DesignEditorProps extends StyledSheetProps
{
    design: RpgCharacterDesign;
    onChange: (design: RpgCharacterDesign) => void;
    onSave: () => void;
    onCancel: () => void;
}

interface ResizeState
{
    index: number;
    mode: 'width' | 'height';
    startX: number;
    startY: number;
    startSpan: number;
    startHeight: number;
    renderedHeight: number;
    gridWidth: number;
}

interface MasonryCellProps
{
    span: number;
    children: ReactNode;
    style?: CSSProperties;
}

const GRID_GAP = 8;
const MASONRY_ROW = 4;
const MASONRY_ROW_GAP = 4;

const FONT_OPTIONS = [
    { value: 'inherit', label: 'Predeterminada' },
    { value: 'Arial, sans-serif', label: 'Arial' },
    { value: 'Verdana, sans-serif', label: 'Verdana' },
    { value: '"Trebuchet MS", sans-serif', label: 'Trebuchet' },
    { value: 'Tahoma, sans-serif', label: 'Tahoma' },
    { value: 'Georgia, serif', label: 'Georgia' },
    { value: '"Times New Roman", serif', label: 'Times New Roman' },
    { value: '"Courier New", monospace', label: 'Courier New' },
    { value: 'Impact, sans-serif', label: 'Impact' },
    { value: '"Comic Sans MS", cursive', label: 'Comic Sans' }
];

const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));

const rgba = (hex: string, opacity: number) =>
{
    const clean = String(hex ?? '#17171D').replace('#', '');
    const value = /^[0-9A-Fa-f]{6}$/.test(clean) ? clean : '17171D';

    const r = parseInt(value.substring(0, 2), 16);
    const g = parseInt(value.substring(2, 4), 16);
    const b = parseInt(value.substring(4, 6), 16);

    return `rgba(${ r }, ${ g }, ${ b }, ${ clamp(opacity, 0, 100) / 100 })`;
};

const justify = (alignment: string): CSSProperties['justifyContent'] =>
{
    if(alignment === 'center') return 'center';
    if(alignment === 'right') return 'flex-end';

    return 'flex-start';
};

const fontFamily = (value: string) =>
    value && value !== 'inherit'
        ? value
        : undefined;

const contentTypography = (
    item: AdvancedSheetItem
): CSSProperties => ({
    fontFamily: fontFamily(item.fontFamily),
    fontSize: `${ item.fontSize }px`,
    fontWeight: item.fontBold ? 700 : 400,
    fontStyle: item.fontItalic ? 'italic' : 'normal',
    textDecoration: item.fontUnderline ? 'underline' : 'none'
});

const labelTypography = (
    item: AdvancedSheetItem
): CSSProperties => ({
    fontFamily: fontFamily(item.labelFontFamily),
    fontSize: `${ item.labelFontSize }px`,
    fontWeight: item.labelBold ? 700 : 400,
    fontStyle: item.labelItalic ? 'italic' : 'normal',
    textDecoration: item.labelUnderline ? 'underline' : 'none'
});

const newId = () =>
    `custom-${ Date.now() }-${ Math.floor(Math.random() * 1000000) }`;

const baseAdvancedItem = (
    id: string,
    kind: AdvancedKind
): AdvancedSheetItem => ({
    id,
    kind,
    widthSpan: kind === 'image' ? 6 : 12,
    height: 0,
    alignment: kind === 'image' ? 'center' : 'left',

    labelMode:
        kind === 'image' || kind === 'spacer'
            ? 'hidden'
            : 'above',
    labelVisible: kind !== 'image' && kind !== 'spacer',

    imageWidthPct: 100,
    imageMaxHeight: 400,
    imageRadius: 0,
    imageOpacity: 100,
    imageBorderColor: '',
    imageBorderWidth: 0,
    imageBorderStyle: 'solid',
    imageShadowEnabled: false,
    imageShadowColor: '#000000',
    imageShadowOpacity: 45,
    imageShadowBlur: 12,
    imageShadowX: 0,
    imageShadowY: 4,

    boxMode: 'full',
    backgroundColor: '',
    backgroundOpacity: 100,
    borderColor: '',
    borderWidth: 1,
    borderStyle: 'solid',
    gradientEnabled: false,
    gradientColor2: '#000000',
    gradientAngle: 180,
    shadowEnabled: false,
    shadowColor: '#000000',
    shadowOpacity: 45,
    shadowBlur: 14,
    shadowX: 0,
    shadowY: 5,
    textColor: '',
    labelColor: '',
    padding: kind === 'spacer' ? 0 : 10,
    radius: -1,

    fontFamily: 'inherit',
    fontSize: 12,
    fontBold: false,
    fontItalic: false,
    fontUnderline: false,

    labelFontFamily: 'inherit',
    labelFontSize: 12,
    labelBold: true,
    labelItalic: false,
    labelUnderline: false,

    mergeGroup: '',
    mergeLayout: 'column',
    mergeGap: 6,

    title: '',
    content: '',
    imageUrl: ''
});

const standardKey = (
    kind: 'section' | 'field',
    sourceId: number
) =>
    `${ kind }:${ sourceId }`;

const standardFromB1 = (
    block: RpgCharacterDesignBlock
): AdvancedSheetItem => ({
    ...baseAdvancedItem(
        standardKey(block.blockType, block.sourceId),
        block.blockType
    ),
    sourceId: block.sourceId,
    widthSpan:
        block.blockType === 'section'
            ? 12
            : clamp(block.widthSpan, 1, 12),
    alignment: block.alignment,
    labelMode: block.labelVisible ? 'above' : 'hidden',
    labelVisible: block.labelVisible,
    imageWidthPct: block.imageWidthPct,
    imageMaxHeight: block.imageMaxHeight,
    labelFontSize: block.blockType === 'section' ? 13 : 12
});

const requiredStandardItems = (
    template: RpgEngineSheetTemplate,
    design: RpgCharacterDesign
) =>
{
    const b1 = new Map(
        design.blocks.map(block => [
            standardKey(block.blockType, block.sourceId),
            block
        ])
    );

    const items: AdvancedSheetItem[] = [];

    for(const section of template?.sections ?? [])
    {
        const sectionKey = standardKey('section', section.id);
        const sectionBlock = b1.get(sectionKey);

        items.push(
            sectionBlock
                ? standardFromB1(sectionBlock)
                : {
                    ...baseAdvancedItem(sectionKey, 'section'),
                    sourceId: section.id
                }
        );

        for(const field of section.fields)
        {
            const fieldKey = standardKey('field', field.id);
            const fieldBlock = b1.get(fieldKey);

            const item = fieldBlock
                ? standardFromB1(fieldBlock)
                : {
                    ...baseAdvancedItem(fieldKey, 'field'),
                    sourceId: field.id,
                    widthSpan: field.fieldType === 'image' ? 6 : 12,
                    alignment:
                        (
                            field.fieldType === 'image'
                                ? 'center'
                                : 'left'
                        ) as 'center' | 'left',
                    labelMode:
                        field.fieldType === 'image'
                            ? 'hidden' as LabelMode
                            : 'above' as LabelMode,
                    labelVisible:
                        field.fieldType !== 'image'
                };

            items.push(item);
        }
    }

    return items;
};

const defaultAdvanced = (
    template: RpgEngineSheetTemplate,
    design: RpgCharacterDesign
): AdvancedSheetDesign => ({
    version: 2,

    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: false,

    bannerPosition: 'center',
    showHeaderText: true,

    musicUrl: '',
    musicTitle: '',
    musicVolume: 70,
    musicLoop: true,

    overlayImageUrl: '',
    overlayOpacity: 100,
    overlaySize: 'cover',
    overlayPosition: 'center',
    overlayBlendMode: 'normal',

    items: requiredStandardItems(template, design)
});

const readAdvanced = (
    template: RpgEngineSheetTemplate,
    design: RpgCharacterDesign
): AdvancedSheetDesign =>
{
    let parsed: AdvancedSheetDesign = null;

    try
    {
        if(design.advancedJson)
            parsed = JSON.parse(design.advancedJson);
    }
    catch
    {
        parsed = null;
    }

    const fallback = defaultAdvanced(template, design);

    if(!parsed ||
       parsed.version !== 2 ||
       !Array.isArray(parsed.items))
        return fallback;

    const required = requiredStandardItems(template, design);
    const requiredMap =
        new Map(required.map(item => [ item.id, item ]));

    const finalItems: AdvancedSheetItem[] = [];
    const used = new Set<string>();

    for(const raw of parsed.items.slice(0, 200))
    {
        if(!raw ||
           typeof raw.id !== 'string')
            continue;

        const custom =
            raw.kind === 'text' ||
            raw.kind === 'image' ||
            raw.kind === 'divider' ||
            raw.kind === 'spacer';

        if(!custom &&
           !requiredMap.has(raw.id))
            continue;

        if(used.has(raw.id))
            continue;

        used.add(raw.id);

        const base = custom
            ? baseAdvancedItem(raw.id, raw.kind)
            : requiredMap.get(raw.id);

        const rawLabelMode: LabelMode =
            [ 'above', 'inline', 'hidden' ].includes(raw.labelMode)
                ? raw.labelMode
                : (
                    raw.labelVisible === false
                        ? 'hidden'
                        : base.labelMode
                );

        finalItems.push({
            ...base,
            ...raw,

            id: raw.id,
            kind: custom ? raw.kind : base.kind,
            sourceId: custom ? undefined : base.sourceId,

            widthSpan:
                base.kind === 'section'
                    ? 12
                    : clamp(
                        Number(raw.widthSpan ?? base.widthSpan),
                        1,
                        12
                    ),

            height:
                clamp(
                    Number(
                        raw.height ??
                        (raw as any).minHeight ??
                        0
                    ),
                    0,
                    900
                ),

            labelMode: rawLabelMode,
            labelVisible: rawLabelMode !== 'hidden',

            imageWidthPct:
                clamp(
                    Number(raw.imageWidthPct ?? 100),
                    10,
                    100
                ),

            imageMaxHeight:
                clamp(
                    Number(raw.imageMaxHeight ?? 400),
                    80,
                    1000
                ),

            imageRadius:
                clamp(
                    Number((raw as any).imageRadius ?? 0),
                    0,
                    80
                ),

            imageOpacity:
                clamp(
                    Number((raw as any).imageOpacity ?? 100),
                    5,
                    100
                ),

            imageBorderColor:
                String((raw as any).imageBorderColor ?? ''),

            imageBorderWidth:
                clamp(
                    Number((raw as any).imageBorderWidth ?? 0),
                    0,
                    12
                ),

            imageBorderStyle:
                [ 'solid', 'dashed', 'dotted', 'double' ]
                    .includes((raw as any).imageBorderStyle)
                        ? (raw as any).imageBorderStyle
                        : 'solid',

            imageShadowEnabled:
                !!((raw as any).imageShadowEnabled ?? false),

            imageShadowColor:
                String((raw as any).imageShadowColor ?? '#000000'),

            imageShadowOpacity:
                clamp(
                    Number((raw as any).imageShadowOpacity ?? 45),
                    0,
                    100
                ),

            imageShadowBlur:
                clamp(
                    Number((raw as any).imageShadowBlur ?? 12),
                    0,
                    60
                ),

            imageShadowX:
                clamp(
                    Number((raw as any).imageShadowX ?? 0),
                    -40,
                    40
                ),

            imageShadowY:
                clamp(
                    Number((raw as any).imageShadowY ?? 4),
                    -40,
                    40
                ),

            boxMode:
                [ 'full', 'fit', 'none' ]
                    .includes((raw as any).boxMode)
                        ? (raw as any).boxMode
                        : 'full',

            backgroundOpacity:
                clamp(
                    Number(raw.backgroundOpacity ?? 100),
                    10,
                    100
                ),

            borderWidth:
                clamp(
                    Number((raw as any).borderWidth ?? 1),
                    0,
                    8
                ),

            borderStyle:
                [ 'solid', 'dashed', 'dotted', 'double' ]
                    .includes((raw as any).borderStyle)
                        ? (raw as any).borderStyle
                        : 'solid',

            gradientEnabled:
                !!((raw as any).gradientEnabled ?? false),

            gradientColor2:
                String((raw as any).gradientColor2 ?? '#000000'),

            gradientAngle:
                clamp(
                    Number((raw as any).gradientAngle ?? 180),
                    0,
                    360
                ),

            shadowEnabled:
                !!((raw as any).shadowEnabled ?? false),

            shadowColor:
                String((raw as any).shadowColor ?? '#000000'),

            shadowOpacity:
                clamp(
                    Number((raw as any).shadowOpacity ?? 45),
                    0,
                    100
                ),

            shadowBlur:
                clamp(
                    Number((raw as any).shadowBlur ?? 14),
                    0,
                    60
                ),

            shadowX:
                clamp(
                    Number((raw as any).shadowX ?? 0),
                    -40,
                    40
                ),

            shadowY:
                clamp(
                    Number((raw as any).shadowY ?? 5),
                    -40,
                    40
                ),

            labelColor:
                String((raw as any).labelColor ?? ''),

            padding:
                clamp(
                    Number(raw.padding ?? 10),
                    0,
                    60
                ),

            radius:
                clamp(
                    Number(raw.radius ?? -1),
                    -1,
                    50
                ),

            fontFamily:
                String(
                    raw.fontFamily ??
                    base.fontFamily ??
                    'inherit'
                ),

            fontSize:
                clamp(
                    Number(
                        raw.fontSize ??
                        base.fontSize ??
                        12
                    ),
                    7,
                    64
                ),

            fontBold:
                raw.fontBold === undefined
                    ? !!base.fontBold
                    : !!raw.fontBold,

            fontItalic:
                raw.fontItalic === undefined
                    ? !!base.fontItalic
                    : !!raw.fontItalic,

            fontUnderline:
                !!((raw as any).fontUnderline ?? false),

            labelFontFamily:
                String(
                    raw.labelFontFamily ??
                    base.labelFontFamily ??
                    'inherit'
                ),

            labelFontSize:
                clamp(
                    Number(
                        raw.labelFontSize ??
                        base.labelFontSize ??
                        12
                    ),
                    7,
                    64
                ),

            labelBold:
                raw.labelBold === undefined
                    ? !!base.labelBold
                    : !!raw.labelBold,

            labelItalic:
                raw.labelItalic === undefined
                    ? !!base.labelItalic
                    : !!raw.labelItalic,

            labelUnderline:
                !!((raw as any).labelUnderline ?? false),

            mergeGroup:
                String((raw as any).mergeGroup ?? ''),

            mergeLayout:
                [ 'column', 'row' ]
                    .includes((raw as any).mergeLayout)
                        ? (raw as any).mergeLayout
                        : 'column',

            mergeGap:
                clamp(
                    Number((raw as any).mergeGap ?? 6),
                    0,
                    40
                ),

            title:
                String(raw.title ?? '')
                    .slice(0, 120),

            content:
                String(raw.content ?? '')
                    .slice(0, 20000),

            imageUrl:
                String(raw.imageUrl ?? '')
                    .slice(0, 1000)
        });
    }

    for(const item of required)
    {
        if(!used.has(item.id))
            finalItems.push(item);
    }

    return {
        version: 2,

        backgroundSize:
            [ 'cover', 'contain', 'auto' ]
                .includes(parsed.backgroundSize)
                    ? parsed.backgroundSize
                    : 'cover',

        backgroundPosition:
            [ 'left', 'center', 'right', 'top', 'bottom' ]
                .includes(parsed.backgroundPosition)
                    ? parsed.backgroundPosition
                    : 'center',

        backgroundRepeat:
            !!parsed.backgroundRepeat,

        bannerPosition:
            [ 'left', 'center', 'right', 'top', 'bottom' ]
                .includes(parsed.bannerPosition)
                    ? parsed.bannerPosition
                    : 'center',

        showHeaderText:
            parsed.showHeaderText !== false,

        musicUrl:
            String(parsed.musicUrl ?? '')
                .slice(0, 1000),

        musicTitle:
            String(parsed.musicTitle ?? '')
                .slice(0, 120),

        musicVolume:
            clamp(
                Number(parsed.musicVolume ?? 70),
                0,
                100
            ),

        musicLoop:
            parsed.musicLoop !== false,

        overlayImageUrl:
            String((parsed as any).overlayImageUrl ?? '')
                .slice(0, 1000),

        overlayOpacity:
            clamp(
                Number((parsed as any).overlayOpacity ?? 100),
                0,
                100
            ),

        overlaySize:
            [ 'cover', 'contain', 'auto' ]
                .includes((parsed as any).overlaySize)
                    ? (parsed as any).overlaySize
                    : 'cover',

        overlayPosition:
            [ 'left', 'center', 'right', 'top', 'bottom' ]
                .includes((parsed as any).overlayPosition)
                    ? (parsed as any).overlayPosition
                    : 'center',

        overlayBlendMode:
            [ 'normal', 'multiply', 'screen', 'overlay', 'soft-light' ]
                .includes((parsed as any).overlayBlendMode)
                    ? (parsed as any).overlayBlendMode
                    : 'normal',

        items: finalItems
    };
};

const writeAdvanced = (
    design: RpgCharacterDesign,
    advanced: AdvancedSheetDesign
): RpgCharacterDesign => ({
    ...design,
    advancedJson: JSON.stringify(advanced)
});

export const createDefaultCharacterDesign = (
    template: RpgEngineSheetTemplate,
    characterId: number = 0,
    userId: number = 0
): RpgCharacterDesign =>
{
    const blocks: RpgCharacterDesignBlock[] = [];
    let order = 1;

    for(const section of template?.sections ?? [])
    {
        blocks.push({
            blockType: 'section',
            sourceId: section.id,
            sortOrder: order++,
            widthSpan: 12,
            alignment: 'left',
            imageWidthPct: 100,
            imageMaxHeight: 300,
            labelVisible: true
        });

        for(const field of section.fields)
        {
            const image =
                field.fieldType === 'image';

            blocks.push({
                blockType: 'field',
                sourceId: field.id,
                sortOrder: order++,
                widthSpan: image ? 6 : 12,
                alignment: image ? 'center' : 'left',
                imageWidthPct: 100,
                imageMaxHeight: 300,
                labelVisible: !image
            });
        }
    }

    const design: RpgCharacterDesign = {
        characterId,
        rpgId: template?.rpgId ?? 0,
        userId,

        backgroundColor: '#1F1F26',
        backgroundImageUrl: '',
        primaryColor: '#6F5BD3',
        secondaryColor: '#292633',
        textColor: '#F5F5F5',
        panelColor: '#17171D',
        panelOpacity: 90,
        bannerImageUrl: '',
        bannerHeight: 180,
        contentWidth: 760,
        borderRadius: 8,

        advancedJson: '',
        blocks
    };

    design.advancedJson =
        JSON.stringify(
            defaultAdvanced(template, design)
        );

    return design;
};

const imageWidthStyle = (
    item: AdvancedSheetItem
) =>
    item.boxMode === 'full'
        ? `${ item.imageWidthPct }%`
        : '100%';

const imageVisualStyle = (
    item: AdvancedSheetItem
): CSSProperties => ({
    opacity:
        clamp(
            item.imageOpacity,
            5,
            100
        ) / 100,

    border:
        item.imageBorderWidth > 0
            ? `${ item.imageBorderWidth }px ${ item.imageBorderStyle } ${ item.imageBorderColor || 'currentColor' }`
            : 'none',

    borderRadius:
        `${ item.imageRadius }px`,

    boxShadow:
        item.imageShadowEnabled
            ? `${ item.imageShadowX }px ${ item.imageShadowY }px ${ item.imageShadowBlur }px ${ rgba(item.imageShadowColor, item.imageShadowOpacity) }`
            : 'none',

    boxSizing:
        'border-box'
});

const fieldValue = (
    field: RpgEngineSheetField,
    value: string,
    item: AdvancedSheetItem,
    inline: boolean = false
) =>
{
    if(field.fieldType === 'image')
    {
        if(!value) return null;

        return (
            <div style={ {
                display: 'flex',
                width: '100%',
                justifyContent: justify(item.alignment)
            } }>
                <img
                    src={ value }
                    alt=""
                    style={ {
                        width: imageWidthStyle(item),
                        maxWidth: '100%',
                        maxHeight: `${ item.imageMaxHeight }px`,
                        objectFit: 'contain',
                        display: 'block',
                        ...imageVisualStyle(item)
                    } }
                />
            </div>
        );
    }

    if(field.fieldType === 'yes_no')
    {
        if(value === 'yes') return <>Sí</>;
        if(value === 'no') return <>No</>;
    }

    if(inline)
    {
        return (
            <span style={ {
                ...contentTypography(item),
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
            } }>
                { value || '—' }
            </span>
        );
    }

    return (
        <div style={ {
            ...contentTypography(item),
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            lineHeight: 1.45
        } }>
            { value || '—' }
        </div>
    );
};

const customValue = (
    item: AdvancedSheetItem
) =>
{
    if(item.kind === 'image')
    {
        if(!item.imageUrl) return null;

        return (
            <div style={ {
                display: 'flex',
                width: '100%',
                justifyContent: justify(item.alignment)
            } }>
                <img
                    src={ item.imageUrl }
                    alt=""
                    style={ {
                        width: imageWidthStyle(item),
                        maxWidth: '100%',
                        maxHeight: `${ item.imageMaxHeight }px`,
                        objectFit: 'contain',
                        display: 'block',
                        ...imageVisualStyle(item)
                    } }
                />
            </div>
        );
    }

    if(item.kind === 'divider')
    {
        return (
            <div style={ {
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%'
            } }>
                <span style={ {
                    flex: 1,
                    height: `${ Math.max(1, item.borderWidth) }px`,
                    background: item.borderColor || 'currentColor',
                    opacity: 0.5
                } } />

                { item.labelMode !== 'hidden' &&
                  item.title &&
                    <strong style={ {
                        ...labelTypography(item),
                        color: item.labelColor || undefined
                    } }>
                        { item.title }
                    </strong> }

                <span style={ {
                    flex: 1,
                    height: `${ Math.max(1, item.borderWidth) }px`,
                    background: item.borderColor || 'currentColor',
                    opacity: 0.5
                } } />
            </div>
        );
    }

    if(item.kind === 'spacer') return null;

    return (
        <>
            { item.labelMode !== 'hidden' &&
              item.title &&
                <div style={ {
                    ...labelTypography(item),
                    color: item.labelColor || undefined,
                    marginBottom: item.content ? '6px' : 0
                } }>
                    { item.title }
                </div> }

            { item.content &&
                <div style={ {
                    ...contentTypography(item),
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    lineHeight: 1.5
                } }>
                    { item.content }
                </div> }
        </>
    );
};

const boxStyle = (
    design: RpgCharacterDesign,
    item: AdvancedSheetItem
): CSSProperties =>
{
    const color =
        item.textColor ||
        design.textColor;

    const background =
        item.backgroundColor ||
        design.panelColor;

    const opacity =
        item.backgroundColor
            ? item.backgroundOpacity
            : design.panelOpacity;

    const border =
        item.borderColor ||
        design.primaryColor;

    const radius =
        item.radius >= 0
            ? item.radius
            : design.borderRadius;

    const backgroundStyle =
        item.gradientEnabled
            ? `linear-gradient(${ item.gradientAngle }deg, ${ rgba(background, opacity) }, ${ rgba(item.gradientColor2, opacity) })`
            : rgba(
                background,
                opacity
            );

    const shadowStyle =
        item.shadowEnabled
            ? `${ item.shadowX }px ${ item.shadowY }px ${ item.shadowBlur }px ${ rgba(item.shadowColor, item.shadowOpacity) }`
            : 'none';

    if(item.boxMode === 'none')
    {
        return {
            color,
            background:
                'transparent',
            border:
                'none',
            borderRadius:
                0,
            padding:
                0,
            height:
                item.height > 0
                    ? `${ item.height }px`
                    : undefined,
            overflow:
                item.height > 0
                    ? 'auto'
                    : 'visible',
            scrollbarWidth:
                'none',
            boxShadow:
                'none',
            boxSizing:
                'border-box',
            minWidth:
                0,
            alignSelf:
                'start'
        };
    }

    return {
        color,

        background:
            backgroundStyle,

        border:
            item.borderWidth > 0
                ? `${ item.borderWidth }px ${ item.borderStyle } ${ rgba(border, 72) }`
                : 'none',

        borderRadius:
            `${ radius }px`,

        padding:
            `${ item.padding }px`,

        height:
            item.height > 0
                ? `${ item.height }px`
                : undefined,

        overflow:
            item.height > 0
                ? 'auto'
                : 'visible',

        scrollbarWidth:
            'none',

        boxShadow:
            shadowStyle,

        boxSizing:
            'border-box',

        minWidth:
            0,

        alignSelf:
            'start'
    };
};

const presentationBoxStyle = (
    design: RpgCharacterDesign,
    item: AdvancedSheetItem,
    image: boolean
): CSSProperties =>
{
    const base = boxStyle(design, item);

    if(item.boxMode === 'full')
        return {
            ...base,
            width: '100%'
        };

    if(image)
    {
        return {
            ...base,
            width: `${ item.imageWidthPct }%`,
            maxWidth: '100%'
        };
    }

    return {
        ...base,
        width: 'fit-content',
        maxWidth: '100%'
    };
};

const MasonryCell: FC<MasonryCellProps> = props =>
{
    const ref =
        useRef<HTMLDivElement>(null);

    const [ rowSpan, setRowSpan ] =
        useState(1);

    useEffect(() =>
    {
        const element =
            ref.current;

        if(!element)
            return;

        const update = () =>
        {
            const height =
                element
                    .getBoundingClientRect()
                    .height;

            const next =
                Math.max(
                    1,
                    Math.ceil(
                        (
                            height +
                            MASONRY_ROW_GAP
                        ) /
                        (
                            MASONRY_ROW +
                            MASONRY_ROW_GAP
                        )
                    )
                );

            setRowSpan(next);
        };

        update();

        const observer =
            typeof ResizeObserver !== 'undefined'
                ? new ResizeObserver(update)
                : null;

        observer?.observe(element);

        window.addEventListener(
            'resize',
            update
        );

        return () =>
        {
            observer?.disconnect();

            window.removeEventListener(
                'resize',
                update
            );
        };
    }, []);

    return (
        <div
            ref={ ref }
            style={ {
                gridColumn:
                    `span ${ clamp(props.span, 1, 12) }`,

                gridRowEnd:
                    `span ${ rowSpan }`,

                alignSelf:
                    'start',

                minWidth:
                    0,

                ...props.style
            } }
        >
            { props.children }
        </div>
    );
};

const youtubeId = (
    rawUrl: string
): string | null =>
{
    const value =
        String(rawUrl ?? '').trim();

    if(!value)
        return null;

    try
    {
        const url = new URL(value);
        const host =
            url.hostname
                .replace(/^www\./, '')
                .toLowerCase();

        if(host === 'youtu.be')
        {
            const id =
                url.pathname
                    .split('/')
                    .filter(Boolean)[0];

            return id &&
                   /^[A-Za-z0-9_-]{6,20}$/.test(id)
                ? id
                : null;
        }

        if(host.endsWith('youtube.com'))
        {
            const fromQuery =
                url.searchParams.get('v');

            if(fromQuery &&
               /^[A-Za-z0-9_-]{6,20}$/.test(fromQuery))
                return fromQuery;

            const parts =
                url.pathname
                    .split('/')
                    .filter(Boolean);

            const special =
                [ 'embed', 'shorts', 'live' ];

            if(parts.length >= 2 &&
               special.includes(parts[0]) &&
               /^[A-Za-z0-9_-]{6,20}$/.test(parts[1]))
                return parts[1];
        }
    }
    catch
    {
        return null;
    }

    return null;
};

const HiddenMusic: FC<{
    url: string;
    volume: number;
    loop: boolean;
}> = props =>
{
    const audioRef =
        useRef<HTMLAudioElement>(null);

    const youtubeRef =
        useRef<HTMLIFrameElement>(null);

    const id =
        youtubeId(props.url);

    const sendYoutube = (
        func: string,
        args: any[] = []
    ) =>
    {
        youtubeRef.current
            ?.contentWindow
            ?.postMessage(
                JSON.stringify({
                    event: 'command',
                    func,
                    args
                }),
                '*'
            );
    };

    useEffect(() =>
    {
        if(id)
        {
            const timer =
                window.setTimeout(() =>
                {
                    sendYoutube(
                        'setVolume',
                        [ clamp(props.volume, 0, 100) ]
                    );

                    sendYoutube(
                        'playVideo'
                    );
                }, 500);

            const retry = () =>
            {
                sendYoutube(
                    'setVolume',
                    [ clamp(props.volume, 0, 100) ]
                );

                sendYoutube('playVideo');
            };

            document.addEventListener(
                'pointerdown',
                retry,
                { once: true }
            );

            return () =>
            {
                window.clearTimeout(timer);

                document.removeEventListener(
                    'pointerdown',
                    retry
                );
            };
        }

        const audio =
            audioRef.current;

        if(!audio)
            return;

        audio.volume =
            clamp(props.volume, 0, 100) / 100;

        const tryPlay = () =>
        {
            audio
                .play()
                .catch(() => {});
        };

        tryPlay();

        document.addEventListener(
            'pointerdown',
            tryPlay,
            { once: true }
        );

        return () =>
        {
            document.removeEventListener(
                'pointerdown',
                tryPlay
            );
        };
    }, [
        props.url,
        props.volume,
        props.loop,
        id
    ]);

    if(!props.url)
        return null;

    if(id)
    {
        const src =
            `https://www.youtube.com/embed/${ id }` +
            `?autoplay=1` +
            `&controls=0` +
            `&disablekb=1` +
            `&playsinline=1` +
            `&enablejsapi=1` +
            `&rel=0` +
            (
                props.loop
                    ? `&loop=1&playlist=${ id }`
                    : ''
            );

        return (
            <iframe
                ref={ youtubeRef }
                src={ src }
                title="Música de la ficha"
                allow="autoplay; encrypted-media"
                frameBorder={ 0 }
                onLoad={ () =>
                {
                    sendYoutube(
                        'setVolume',
                        [ clamp(props.volume, 0, 100) ]
                    );

                    sendYoutube(
                        'playVideo'
                    );
                } }
                tabIndex={ -1 }
                aria-hidden="true"
                style={ {
                    position: 'fixed',
                    left: '-20000px',
                    top: '-20000px',
                    width: 0,
                    height: 0,
                    minWidth: 0,
                    minHeight: 0,
                    opacity: 0,
                    pointerEvents: 'none',
                    border: 0,
                    outline: 'none',
                    boxShadow: 'none',
                    clipPath: 'inset(50%)',
                    overflow: 'hidden',
                    zIndex: -2147483648
                } }
            />
        );
    }

    return (
        <audio
            ref={ audioRef }
            src={ props.url }
            loop={ props.loop }
            autoPlay
            preload="auto"
            style={ {
                display: 'none'
            } }
        />
    );
};

const renderFieldPresentation = (
    field: RpgEngineSheetField,
    value: string,
    item: AdvancedSheetItem
) =>
{
    if(item.labelMode === 'hidden')
    {
        return fieldValue(
            field,
            value,
            item
        );
    }

    if(item.labelMode === 'inline' &&
       field.fieldType !== 'image')
    {
        return (
            <div style={ {
                lineHeight: 1.45,
                whiteSpace: 'normal'
            } }>
                <span style={ {
                    ...labelTypography(item),
                    color: item.labelColor || undefined,
                    marginRight: '4px'
                } }>
                    { field.label }:
                </span>

                { fieldValue(
                    field,
                    value,
                    item,
                    true
                ) }
            </div>
        );
    }

    return (
        <>
            <div style={ {
                ...labelTypography(item),
                color: item.labelColor || undefined,
                opacity: 0.72,
                marginBottom: '5px'
            } }>
                { field.label }
            </div>

            { fieldValue(
                field,
                value,
                item
            ) }
        </>
    );
};

const SheetOverlay: FC<{
    advanced: AdvancedSheetDesign;
    editor?: boolean;
}> = props =>
{
    if(!props.advanced.overlayImageUrl)
        return null;

    return (
        <div
            aria-hidden="true"
            style={ {
                position: 'absolute',
                inset: 0,
                zIndex: props.editor ? 2 : 20,
                pointerEvents: 'none',
                borderRadius: 'inherit',
                backgroundImage:
                    `url("${ props.advanced.overlayImageUrl }")`,
                backgroundSize:
                    props.advanced.overlaySize,
                backgroundPosition:
                    props.advanced.overlayPosition,
                backgroundRepeat:
                    'no-repeat',
                opacity:
                    clamp(
                        props.advanced.overlayOpacity,
                        0,
                        100
                    ) / 100,
                mixBlendMode:
                    props.advanced.overlayBlendMode as any
            } }
        />
    );
};

const HiddenScrollbarCss: FC = () =>
    <style>{ `
        .rpg-sheet-sheet-root * {
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
        }

        .rpg-sheet-sheet-root *::-webkit-scrollbar {
            width: 0 !important;
            height: 0 !important;
            display: none !important;
        }
    ` }</style>;

const SheetCanvas: FC<StyledSheetProps> = props =>
{
    const design =
        props.design ??
        createDefaultCharacterDesign(
            props.template
        );

    const advanced =
        readAdvanced(
            props.template,
            design
        );

    const sections =
        new Map(
            (props.template?.sections ?? [])
                .map(
                    section => [
                        section.id,
                        section
                    ]
                )
        );

    const fields =
        new Map<number, RpgEngineSheetField>();

    for(const section of props.template?.sections ?? [])
    {
        for(const field of section.fields)
            fields.set(field.id, field);
    }

    const membersFor = (groupId: string) =>
        advanced.items.filter(
            item => item.mergeGroup === groupId
        );

    const leaderFor = (groupId: string) =>
        membersFor(groupId)[0];

    const renderBare = (
        item: AdvancedSheetItem,
        mergedNaturalHeight: boolean = false
    ) =>
    {
        if(item.kind === 'field')
        {
            const field = fields.get(item.sourceId);

            if(!field)
                return null;

            return (
                <div style={ {
                    color:
                        item.textColor ||
                        undefined,
                    textAlign:
                        item.alignment as any,
                    height:
                        !mergedNaturalHeight &&
                        item.height > 0
                            ? `${ item.height }px`
                            : undefined,
                    overflow:
                        !mergedNaturalHeight &&
                        item.height > 0
                            ? 'auto'
                            : 'visible',
                    minWidth:
                        0
                } }>
                    { renderFieldPresentation(
                        field,
                        props.values[field.id] ?? '',
                        item
                    ) }
                </div>
            );
        }

        if(item.kind === 'spacer')
        {
            return (
                <div style={ {
                    height:
                        `${ Math.max(
                            20,
                            item.height || 50
                        ) }px`
                } } />
            );
        }

        return (
            <div style={ {
                color:
                    item.textColor ||
                    undefined,
                textAlign:
                    item.alignment as any,
                height:
                    item.height > 0
                        ? `${ item.height }px`
                        : undefined,
                overflow:
                    item.height > 0
                        ? 'auto'
                        : 'visible',
                minWidth:
                    0
            } }>
                { customValue(item) }
            </div>
        );
    };

    const renderStandalone = (
        item: AdvancedSheetItem
    ) =>
    {
        if(item.kind === 'section')
        {
            const section =
                sections.get(
                    item.sourceId
                );

            if(
                !section ||
                item.labelMode ===
                'hidden'
            )
                return null;

            return (
                <div style={ {
                    color:
                        item.labelColor ||
                        item.textColor ||
                        design.primaryColor,
                    borderBottom:
                        `2px solid ${
                            item.borderColor ||
                            design.primaryColor
                        }`,
                    padding:
                        '7px 4px 4px',
                    ...labelTypography(
                        item
                    )
                } }>
                    { section.title }
                </div>
            );
        }

        if(item.kind === 'field')
        {
            const field =
                fields.get(
                    item.sourceId
                );

            if(!field)
                return null;

            const image =
                field.fieldType ===
                'image';

            return (
                <div style={ {
                    display:
                        'flex',
                    justifyContent:
                        justify(
                            item.alignment
                        ),
                    width:
                        '100%'
                } }>
                    <div style={ {
                        ...presentationBoxStyle(
                            design,
                            item,
                            image
                        ),
                        textAlign:
                            item.alignment as any
                    } }>
                        { renderFieldPresentation(
                            field,
                            props.values[
                                field.id
                            ] ?? '',
                            item
                        ) }
                    </div>
                </div>
            );
        }

        if(item.kind === 'spacer')
        {
            return (
                <div style={ {
                    height:
                        `${ Math.max(
                            20,
                            item.height || 50
                        ) }px`
                } } />
            );
        }

        return (
            <div style={ {
                display:
                    'flex',
                justifyContent:
                    justify(
                        item.alignment
                    ),
                width:
                    '100%'
            } }>
                <div style={ {
                    ...presentationBoxStyle(
                        design,
                        item,
                        item.kind === 'image'
                    ),
                    textAlign:
                        item.alignment as any
                } }>
                    { customValue(
                        item
                    ) }
                </div>
            </div>
        );
    };

    return (
        <div
            className="rpg-sheet-sheet-root"
            style={ {
            position:
                'relative',
            width:
                '100%',
            maxWidth:
                `${ design.contentWidth }px`,
            margin:
                '0 auto',
            padding:
                '12px',
            borderRadius:
                `${ design.borderRadius }px`,
            color:
                design.textColor,
            backgroundColor:
                design.backgroundColor,
            backgroundImage:
                design.backgroundImageUrl
                    ? `url("${ design.backgroundImageUrl }")`
                    : undefined,
            backgroundSize:
                advanced.backgroundSize,
            backgroundPosition:
                advanced.backgroundPosition,
            backgroundRepeat:
                advanced.backgroundRepeat
                    ? 'repeat'
                    : 'no-repeat',
            boxSizing:
                'border-box'
        } }>
            <HiddenScrollbarCss />

            <HiddenMusic
                url={
                    advanced.musicUrl
                }
                volume={
                    advanced.musicVolume
                }
                loop={
                    advanced.musicLoop
                }
            />

            <div style={ {
                position:
                    'relative',
                overflow:
                    'hidden',
                borderRadius:
                    `${ design.borderRadius }px`,
                minHeight:
                    design.bannerImageUrl
                        ? `${ design.bannerHeight }px`
                        : '74px',
                marginBottom:
                    '10px',
                background:
                    design.bannerImageUrl
                        ? `linear-gradient(to top, rgba(0,0,0,.72), rgba(0,0,0,.08)), url("${ design.bannerImageUrl }") ${ advanced.bannerPosition } / cover`
                        : design.secondaryColor
            } }>
                { advanced.showHeaderText &&
                    <div style={ {
                        position:
                            'absolute',
                        left:
                            '14px',
                        right:
                            '14px',
                        bottom:
                            '12px'
                    } }>
                        <div style={ {
                            fontSize:
                                '22px',
                            fontWeight:
                                900
                        } }>
                            { props.username }
                        </div>

                        <div style={ {
                            fontSize:
                                '11px',
                            opacity:
                                0.75
                        } }>
                            { props.rpgName }
                        </div>
                    </div> }
            </div>

            <div style={ {
                display:
                    'grid',
                gridTemplateColumns:
                    'repeat(12, minmax(0, 1fr))',
                gridAutoRows:
                    `${ MASONRY_ROW }px`,
                gridAutoFlow:
                    'dense',
                columnGap:
                    `${ GRID_GAP }px`,
                rowGap:
                    `${ MASONRY_ROW_GAP }px`,
                alignItems:
                    'start'
            } }>
                { advanced.items.map(item =>
                {
                    if(item.mergeGroup)
                    {
                        const leader =
                            leaderFor(
                                item.mergeGroup
                            );

                        if(!leader ||
                           leader.id !==
                           item.id)
                            return null;

                        const members =
                            membersFor(
                                item.mergeGroup
                            );

                        return (
                            <MasonryCell
                                key={
                                    `merge-${ item.mergeGroup }`
                                }
                                span={
                                    leader.widthSpan
                                }
                            >
                                <div style={ {
                                    display:
                                        'flex',
                                    justifyContent:
                                        justify(
                                            leader.alignment
                                        ),
                                    width:
                                        '100%'
                                } }>
                                    <div style={ {
                                        ...presentationBoxStyle(
                                            design,
                                            leader,
                                            false
                                        ),
                                        height:
                                            undefined,
                                        minHeight:
                                            leader.height > 0
                                                ? `${ leader.height }px`
                                                : undefined,
                                        overflow:
                                            'visible'
                                    } }>
                                        <div style={ {
                                            display:
                                                leader.mergeLayout ===
                                                'row'
                                                    ? 'flex'
                                                    : 'grid',
                                            gridTemplateColumns:
                                                leader.mergeLayout ===
                                                'column'
                                                    ? '1fr'
                                                    : undefined,
                                            gap:
                                                `${ leader.mergeGap }px`,
                                            alignItems:
                                                'start'
                                        } }>
                                            { members.map(member =>
                                                <div
                                                    key={
                                                        member.id
                                                    }
                                                    style={ {
                                                        flex:
                                                            leader.mergeLayout ===
                                                            'row'
                                                                ? 1
                                                                : undefined,
                                                        minWidth:
                                                            0
                                                    } }
                                                >
                                                    { renderBare(
                                                        member,
                                                        true
                                                    ) }
                                                </div>
                                            ) }
                                        </div>
                                    </div>
                                </div>
                            </MasonryCell>
                        );
                    }

                    return (
                        <MasonryCell
                            key={
                                item.id
                            }
                            span={
                                item.kind ===
                                'section'
                                    ? 12
                                    : item.widthSpan
                            }
                        >
                            { renderStandalone(
                                item
                            ) }
                        </MasonryCell>
                    );
                }) }
            </div>

            <SheetOverlay
                advanced={
                    advanced
                }
            />
        </div>
    );
};

export const RpgCharacterStyledSheet:
FC<StyledSheetProps> = props =>
    <SheetCanvas { ...props } />;

export const RpgCharacterDesignEditor: FC<DesignEditorProps> = props =>
{
    const design = props.design;
    const advanced = readAdvanced(props.template, design);

    const [ selectedId, setSelectedId ] = useState('');
    const [ inspectorOpen, setInspectorOpen ] = useState(false);
    const [ mergeTargetId, setMergeTargetId ] = useState('');
    const [ inspectorPosition, setInspectorPosition ] =
        useState(() => ({
            x:
                typeof window !== 'undefined'
                    ? Math.max(
                        12,
                        window.innerWidth -
                        424
                    )
                    : 24,
            y: 72
        }));

    const inspectorDragRef =
        useRef<{
            mouseX: number;
            mouseY: number;
            left: number;
            top: number;
        } | null>(null);

    const dragKey = useRef<string | null>(null);
    const gridRef = useRef<HTMLDivElement>(null);
    const resizeStateRef = useRef<ResizeState | null>(null);
    const latestAdvanced = useRef(advanced);
    const latestDesign = useRef(design);

    latestAdvanced.current = advanced;
    latestDesign.current = design;

    const pushAdvanced = (next: AdvancedSheetDesign) =>
        props.onChange(
            writeAdvanced(
                latestDesign.current,
                next
            )
        );

    useEffect(() =>
    {
        const onMove = (event: MouseEvent) =>
        {
            if(inspectorDragRef.current)
            {
                const drag = inspectorDragRef.current;

                setInspectorPosition({
                    x: Math.max(
                        0,
                        drag.left +
                        event.clientX -
                        drag.mouseX
                    ),
                    y: Math.max(
                        0,
                        drag.top +
                        event.clientY -
                        drag.mouseY
                    )
                });
            }

            const state = resizeStateRef.current;
            if(!state) return;

            const next: AdvancedSheetDesign = {
                ...latestAdvanced.current,
                items:
                    latestAdvanced.current.items
                        .map(item => ({ ...item }))
            };

            const item = next.items[state.index];

            if(!item || item.kind === 'section')
                return;

            if(state.mode === 'width')
            {
                const usableWidth = Math.max(
                    120,
                    state.gridWidth -
                    (GRID_GAP * 11)
                );

                const columnWidth = usableWidth / 12;
                const stepWidth = columnWidth + GRID_GAP;

                const delta = Math.round(
                    (event.clientX - state.startX) /
                    stepWidth
                );

                item.widthSpan = clamp(
                    state.startSpan + delta,
                    1,
                    12
                );
            }
            else
            {
                const base =
                    state.startHeight > 0
                        ? state.startHeight
                        : Math.max(
                            40,
                            state.renderedHeight
                        );

                const nextHeight = Math.round(
                    base +
                    event.clientY -
                    state.startY
                );

                item.height =
                    nextHeight <= 45
                        ? 0
                        : clamp(
                            nextHeight,
                            46,
                            900
                        );
            }

            pushAdvanced(next);
        };

        const onUp = () =>
        {
            inspectorDragRef.current = null;
            resizeStateRef.current = null;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);

        return () =>
        {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, []);

    const patchAdvanced = (
        patch: Partial<AdvancedSheetDesign>
    ) =>
        pushAdvanced({
            ...advanced,
            ...patch,
            items:
                advanced.items.map(
                    item => ({ ...item })
                )
        });

    const patchItem = (
        id: string,
        patch: Partial<AdvancedSheetItem>
    ) =>
    {
        const index =
            advanced.items.findIndex(
                item => item.id === id
            );

        if(index < 0) return;

        const next = {
            ...advanced,
            items:
                advanced.items.map(
                    item => ({ ...item })
                )
        };

        next.items[index] = {
            ...next.items[index],
            ...patch
        };

        if(patch.labelMode)
        {
            next.items[index].labelVisible =
                patch.labelMode !== 'hidden';
        }

        pushAdvanced(next);
    };

    const patchMany = (
        ids: string[],
        patch: Partial<AdvancedSheetItem>
    ) =>
    {
        const idSet = new Set(ids);

        pushAdvanced({
            ...advanced,
            items:
                advanced.items.map(item =>
                    idSet.has(item.id)
                        ? {
                            ...item,
                            ...patch
                        }
                        : {
                            ...item
                        }
                )
        });
    };

    const selected =
        advanced.items.find(
            item => item.id === selectedId
        ) ?? null;

    const groupMembers = (
        groupId: string
    ) =>
        advanced.items.filter(
            item => item.mergeGroup === groupId
        );

    const groupLeader = (
        groupId: string
    ) =>
        groupMembers(groupId)[0];

    const groupForItem = (
        item: AdvancedSheetItem
    ) =>
        item.mergeGroup
            ? {
                id: item.mergeGroup,
                members:
                    groupMembers(
                        item.mergeGroup
                    ),
                leader:
                    groupLeader(
                        item.mergeGroup
                    )
            }
            : null;

    const selectItem = (id: string) =>
    {
        setSelectedId(id);
        setMergeTargetId('');
        setInspectorOpen(true);
    };

    const addCustom = (
        kind:
        'text' |
        'image' |
        'divider' |
        'spacer'
    ) =>
    {
        const count =
            advanced.items.filter(
                item =>
                    item.kind === 'text' ||
                    item.kind === 'image' ||
                    item.kind === 'divider' ||
                    item.kind === 'spacer'
            ).length;

        if(count >= 100) return;

        const item =
            baseAdvancedItem(
                newId(),
                kind
            );

        pushAdvanced({
            ...advanced,
            items: [
                ...advanced.items.map(
                    entry => ({ ...entry })
                ),
                item
            ]
        });

        selectItem(item.id);
    };

    const deleteItem = (id: string) =>
    {
        const item =
            advanced.items.find(
                entry => entry.id === id
            );

        if(
            !item ||
            item.kind === 'section' ||
            item.kind === 'field'
        )
            return;

        const oldGroup = item.mergeGroup;

        let items =
            advanced.items
                .filter(entry => entry.id !== id)
                .map(entry => ({ ...entry }));

        if(oldGroup)
        {
            const remaining =
                items.filter(
                    entry =>
                        entry.mergeGroup === oldGroup
                );

            if(remaining.length < 2)
            {
                items =
                    items.map(entry =>
                        entry.mergeGroup === oldGroup
                            ? {
                                ...entry,
                                mergeGroup: ''
                            }
                            : entry
                    );
            }
        }

        pushAdvanced({
            ...advanced,
            items
        });

        setInspectorOpen(false);
        setSelectedId('');
    };

    const createMerge = (
        firstId: string,
        secondId: string
    ) =>
    {
        if(
            !firstId ||
            !secondId ||
            firstId === secondId
        )
            return;

        const first =
            advanced.items.find(
                item => item.id === firstId
            );

        const second =
            advanced.items.find(
                item => item.id === secondId
            );

        if(
            !first ||
            !second ||
            first.kind === 'section' ||
            second.kind === 'section' ||
            first.mergeGroup ||
            second.mergeGroup
        )
            return;

        const groupId =
            `merge-${ newId() }`;

        const ids = [
            first.id,
            second.id
        ];

        const ordered =
            advanced.items.filter(
                item => ids.includes(item.id)
            );

        const leader = ordered[0];

        // Fusionar cambia la presentación, no el espacio del bloque principal.
        // Si el bloque era 6/12, la caja fusionada sigue siendo 6/12.
        const groupWidth =
            clamp(
                leader.widthSpan,
                1,
                12
            );

        pushAdvanced({
            ...advanced,
            items:
                advanced.items.map(item =>
                {
                    if(!ids.includes(item.id))
                        return { ...item };

                    if(item.id === leader.id)
                    {
                        return {
                            ...item,
                            mergeGroup: groupId,
                            mergeLayout: 'column',
                            mergeGap: 6,
                            widthSpan: groupWidth,
                            height: 0
                        };
                    }

                    return {
                        ...item,
                        mergeGroup: groupId
                    };
                })
        });

        selectItem(leader.id);
    };

    const dissolveMerge = (
        groupId: string
    ) =>
    {
        patchMany(
            groupMembers(groupId)
                .map(member => member.id),
            {
                mergeGroup: ''
            }
        );
    };

    const removeFromMerge = (
        groupId: string,
        memberId: string
    ) =>
    {
        const members =
            groupMembers(groupId);

        const remaining =
            members.filter(
                member =>
                    member.id !== memberId
            );

        const ids =
            members.map(
                member => member.id
            );

        pushAdvanced({
            ...advanced,
            items:
                advanced.items.map(item =>
                {
                    if(!ids.includes(item.id))
                        return { ...item };

                    if(item.id === memberId)
                    {
                        return {
                            ...item,
                            mergeGroup: ''
                        };
                    }

                    if(remaining.length < 2)
                    {
                        return {
                            ...item,
                            mergeGroup: ''
                        };
                    }

                    return { ...item };
                })
        });
    };

    const addToMerge = (
        groupId: string,
        memberId: string
    ) =>
    {
        const candidate =
            advanced.items.find(
                item => item.id === memberId
            );

        if(
            !candidate ||
            candidate.kind === 'section' ||
            candidate.mergeGroup
        )
            return;

        patchItem(
            candidate.id,
            {
                mergeGroup: groupId
            }
        );

        setMergeTargetId('');
    };

    const idsForEntry = (
        key: string
    ) =>
    {
        if(key.startsWith('group:'))
        {
            return groupMembers(
                key.substring(6)
            ).map(
                member => member.id
            );
        }

        return [
            key.substring(5)
        ];
    };

    const reorderEntry = (
        sourceKey: string,
        targetKey: string
    ) =>
    {
        if(sourceKey === targetKey)
            return;

        const sourceIds =
            idsForEntry(sourceKey);

        const targetIds =
            idsForEntry(targetKey);

        if(
            sourceIds.length === 0 ||
            targetIds.length === 0
        )
            return;

        const moving =
            advanced.items.filter(
                item =>
                    sourceIds.includes(item.id)
            );

        const remaining =
            advanced.items.filter(
                item =>
                    !sourceIds.includes(item.id)
            );

        const targetIndex =
            remaining.findIndex(
                item =>
                    targetIds.includes(item.id)
            );

        if(targetIndex < 0)
            return;

        const items = [ ...remaining ];

        items.splice(
            targetIndex,
            0,
            ...moving
        );

        pushAdvanced({
            ...advanced,
            items:
                items.map(
                    item => ({ ...item })
                )
        });
    };

    const startResize = (
        event:
        ReactMouseEvent<HTMLDivElement>,
        item:
        AdvancedSheetItem,
        mode:
        'width' |
        'height'
    ) =>
    {
        event.preventDefault();
        event.stopPropagation();

        if(item.kind === 'section')
            return;

        const index =
            advanced.items.findIndex(
                entry =>
                    entry.id === item.id
            );

        if(index < 0)
            return;

        const preview =
            event.currentTarget
                .parentElement
                ?.querySelector(
                    '[data-rpg-preview-body="1"]'
                ) as HTMLElement;

        resizeStateRef.current = {
            index,
            mode,
            startX: event.clientX,
            startY: event.clientY,
            startSpan: item.widthSpan,
            startHeight: item.height,
            renderedHeight:
                preview
                    ?.getBoundingClientRect()
                    .height ??
                80,
            gridWidth:
                gridRef.current
                    ?.getBoundingClientRect()
                    .width ??
                600
        };

        document.body.style.cursor =
            mode === 'width'
                ? 'ew-resize'
                : 'ns-resize';

        document.body.style.userSelect =
            'none';
    };

    const resetStyle = (
        item:
        AdvancedSheetItem
    ) =>
    {
        const base =
            baseAdvancedItem(
                item.id,
                item.kind
            );

        patchItem(
            item.id,
            {
                imageWidthPct:
                    base.imageWidthPct,
                imageMaxHeight:
                    base.imageMaxHeight,
                imageRadius:
                    base.imageRadius,
                imageOpacity:
                    base.imageOpacity,
                imageBorderColor:
                    base.imageBorderColor,
                imageBorderWidth:
                    base.imageBorderWidth,
                imageBorderStyle:
                    base.imageBorderStyle,
                imageShadowEnabled:
                    base.imageShadowEnabled,
                imageShadowColor:
                    base.imageShadowColor,
                imageShadowOpacity:
                    base.imageShadowOpacity,
                imageShadowBlur:
                    base.imageShadowBlur,
                imageShadowX:
                    base.imageShadowX,
                imageShadowY:
                    base.imageShadowY,

                boxMode:
                    base.boxMode,
                backgroundColor:
                    base.backgroundColor,
                backgroundOpacity:
                    base.backgroundOpacity,
                borderColor:
                    base.borderColor,
                borderWidth:
                    base.borderWidth,
                borderStyle:
                    base.borderStyle,
                gradientEnabled:
                    base.gradientEnabled,
                gradientColor2:
                    base.gradientColor2,
                gradientAngle:
                    base.gradientAngle,
                shadowEnabled:
                    base.shadowEnabled,
                shadowColor:
                    base.shadowColor,
                shadowOpacity:
                    base.shadowOpacity,
                shadowBlur:
                    base.shadowBlur,
                shadowX:
                    base.shadowX,
                shadowY:
                    base.shadowY,
                textColor:
                    base.textColor,
                labelColor:
                    base.labelColor,
                padding:
                    base.padding,
                radius:
                    base.radius,

                fontFamily:
                    base.fontFamily,
                fontSize:
                    base.fontSize,
                fontBold:
                    base.fontBold,
                fontItalic:
                    base.fontItalic,
                fontUnderline:
                    base.fontUnderline,

                labelFontFamily:
                    base.labelFontFamily,
                labelFontSize:
                    item.kind === 'section'
                        ? 13
                        : base.labelFontSize,
                labelBold:
                    base.labelBold,
                labelItalic:
                    base.labelItalic,
                labelUnderline:
                    base.labelUnderline
            }
        );
    };

    const reset = () =>
    {
        const next =
            createDefaultCharacterDesign(
                props.template,
                design.characterId,
                design.userId
            );

        props.onChange(next);
        setInspectorOpen(false);
        setSelectedId('');
    };

    const sections =
        new Map(
            (props.template?.sections ?? [])
                .map(
                    section => [
                        section.id,
                        section
                    ]
                )
        );

    const fields =
        new Map<
            number,
            RpgEngineSheetField
        >();

    for(
        const section of
        props.template?.sections ??
        []
    )
    {
        for(
            const field of
            section.fields
        )
        {
            fields.set(
                field.id,
                field
            );
        }
    }

    const itemName = (
        item:
        AdvancedSheetItem
    ) =>
    {
        if(item.kind === 'section')
            return (
                sections.get(
                    item.sourceId
                )?.title ??
                'Sección'
            );

        if(item.kind === 'field')
            return (
                fields.get(
                    item.sourceId
                )?.label ??
                'Campo'
            );

        if(item.kind === 'text')
            return 'Texto decorativo';

        if(item.kind === 'image')
            return 'Imagen decorativa';

        if(item.kind === 'divider')
            return 'Separador';

        return 'Espacio';
    };

    const renderBare = (
        item:
        AdvancedSheetItem,
        mergedNaturalHeight:
        boolean = false
    ) =>
    {
        if(item.kind === 'field')
        {
            const field =
                fields.get(
                    item.sourceId
                );

            if(!field)
                return null;

            return (
                <div style={ {
                    color:
                        item.textColor ||
                        undefined,
                    textAlign:
                        item.alignment as any,
                    height:
                        !mergedNaturalHeight &&
                        item.height > 0
                            ? `${ item.height }px`
                            : undefined,
                    overflow:
                        !mergedNaturalHeight &&
                        item.height > 0
                            ? 'auto'
                            : 'visible',
                    minWidth:
                        0
                } }>
                    { renderFieldPresentation(
                        field,
                        props.values[
                            field.id
                        ] ?? '',
                        item
                    ) }
                </div>
            );
        }

        if(item.kind === 'spacer')
        {
            return (
                <div style={ {
                    height:
                        `${
                            Math.max(
                                20,
                                item.height ||
                                50
                            )
                        }px`
                } } />
            );
        }

        return (
            <div style={ {
                color:
                    item.textColor ||
                    undefined,
                textAlign:
                    item.alignment as any,
                height:
                    item.height > 0
                        ? `${ item.height }px`
                        : undefined,
                overflow:
                    item.height > 0
                        ? 'auto'
                        : 'visible'
            } }>
                { customValue(item) }
            </div>
        );
    };

    const renderStandalone = (
        item:
        AdvancedSheetItem
    ) =>
    {
        if(item.kind === 'section')
        {
            const section =
                sections.get(
                    item.sourceId
                );

            if(
                !section ||
                item.labelMode ===
                'hidden'
            )
                return null;

            return (
                <div
                    data-rpg-preview-body="1"
                    style={ {
                        color:
                            item.labelColor ||
                            item.textColor ||
                            design.primaryColor,
                        borderBottom:
                            `2px solid ${
                                item.borderColor ||
                                design.primaryColor
                            }`,
                        padding:
                            '7px 4px 4px',
                        ...labelTypography(
                            item
                        )
                    } }
                >
                    { section.title }
                </div>
            );
        }

        if(item.kind === 'field')
        {
            const field =
                fields.get(
                    item.sourceId
                );

            if(!field)
                return null;

            return (
                <div
                    data-rpg-preview-body="1"
                    style={ {
                        display:
                            'flex',
                        justifyContent:
                            justify(
                                item.alignment
                            ),
                        width:
                            '100%'
                    } }
                >
                    <div style={ {
                        ...presentationBoxStyle(
                            design,
                            item,
                            field.fieldType ===
                            'image'
                        ),
                        textAlign:
                            item.alignment as any
                    } }>
                        { renderFieldPresentation(
                            field,
                            props.values[
                                field.id
                            ] ?? '',
                            item
                        ) }
                    </div>
                </div>
            );
        }

        if(item.kind === 'spacer')
        {
            return (
                <div
                    data-rpg-preview-body="1"
                    style={ {
                        height:
                            `${
                                Math.max(
                                    20,
                                    item.height ||
                                    50
                                )
                            }px`
                    } }
                />
            );
        }

        return (
            <div
                data-rpg-preview-body="1"
                style={ {
                    display:
                        'flex',
                    justifyContent:
                        justify(
                            item.alignment
                        ),
                    width:
                        '100%'
                } }
            >
                <div style={ {
                    ...presentationBoxStyle(
                        design,
                        item,
                        item.kind ===
                        'image'
                    ),
                    textAlign:
                        item.alignment as any
                } }>
                    { customValue(item) }
                </div>
            </div>
        );
    };

    const selectedGroup =
        selected
            ? groupForItem(
                selected
            )
            : null;

    const leader =
        selectedGroup
            ?.leader ??
        null;

    const ungroupedCandidates =
        selected
            ? advanced.items
                .filter(
                    item =>
                        item.id !==
                        selected.id &&
                        item.kind !==
                        'section' &&
                        !item.mergeGroup
                )
            : [];

    const groupCandidates =
        selectedGroup
            ? advanced.items
                .filter(
                    item =>
                        item.kind !==
                        'section' &&
                        !item.mergeGroup
                )
            : [];

    const inspector =
        inspectorOpen &&
        selected
            ? createPortal(
                <div style={ {
                    position:
                        'fixed',
                    left:
                        `${ inspectorPosition.x }px`,
                    top:
                        `${ inspectorPosition.y }px`,
                    width:
                        '400px',
                    maxWidth:
                        'calc(100vw - 24px)',
                    maxHeight:
                        'calc(100vh - 96px)',
                    zIndex:
                        200000,
                    border:
                        '1px solid #1c5269',
                    borderRadius:
                        '7px',
                    overflow:
                        'hidden',
                    background:
                        '#f4f1e8',
                    color:
                        '#222',
                    boxShadow:
                        '0 9px 30px rgba(0,0,0,.46)'
                } }>
                    <div
                        onMouseDown={
                            event =>
                            {
                                inspectorDragRef.current = {
                                    mouseX:
                                        event.clientX,
                                    mouseY:
                                        event.clientY,
                                    left:
                                        inspectorPosition.x,
                                    top:
                                        inspectorPosition.y
                                };

                                document.body
                                    .style
                                    .userSelect =
                                        'none';
                            }
                        }
                        style={ {
                            height:
                                '32px',
                            display:
                                'flex',
                            alignItems:
                                'center',
                            gap:
                                '7px',
                            padding:
                                '0 8px',
                            background:
                                'linear-gradient(#4a9fc0, #2f7897)',
                            color:
                                '#fff',
                            cursor:
                                'move',
                            userSelect:
                                'none'
                        } }
                    >
                        <strong style={ {
                            flex:
                                1,
                            fontSize:
                                '12px'
                        } }>
                            Diseño: {
                                itemName(
                                    selected
                                )
                            }
                        </strong>

                        <button
                            type=
                                "button"
                            onMouseDown={
                                event =>
                                    event
                                        .stopPropagation()
                            }
                            onClick={
                                () =>
                                    setInspectorOpen(
                                        false
                                    )
                            }
                            style={ {
                                width:
                                    '22px',
                                height:
                                    '22px',
                                borderRadius:
                                    '4px',
                                border:
                                    '1px solid rgba(0,0,0,.45)',
                                background:
                                    '#d94e42',
                                color:
                                    '#fff',
                                fontWeight:
                                    900,
                                cursor:
                                    'pointer'
                            } }
                        >
                            ×
                        </button>
                    </div>

                    <div style={ {
                        maxHeight:
                            'calc(100vh - 128px)',
                        overflowY:
                            'auto',
                        padding:
                            '11px'
                    } }>
                        <div style={ {
                            display:
                                'flex',
                            justifyContent:
                                'space-between',
                            gap:
                                '7px',
                            marginBottom:
                                '9px'
                        } }>
                            <Button
                                variant=
                                    "secondary"
                                onClick={
                                    () =>
                                        resetStyle(
                                            selected
                                        )
                                }
                            >
                                Restablecer estilo
                            </Button>

                            { selected.kind !==
                              'section' &&
                              selected.kind !==
                              'field' &&
                                <Button
                                    variant=
                                        "secondary"
                                    onClick={
                                        () =>
                                            deleteItem(
                                                selected.id
                                            )
                                    }
                                >
                                    <FaTrash className="me-1" />
                                    Eliminar
                                </Button> }
                        </div>

                        <div style={ {
                            display:
                                'grid',
                            gridTemplateColumns:
                                '1fr 1fr',
                            gap:
                                '8px'
                        } }>
                            { selected.kind !==
                              'section' &&
                                <>
                                    <label style={ {
                                        fontSize:
                                            '10px'
                                    } }>
                                        Ancho:
                                        { ` ${
                                            selectedGroup &&
                                            leader
                                                ? leader.widthSpan
                                                : selected.widthSpan
                                        } / 12` }

                                        <input
                                            type=
                                                "range"
                                            min={
                                                1
                                            }
                                            max={
                                                12
                                            }
                                            step={
                                                1
                                            }
                                            value={
                                                selectedGroup &&
                                                leader
                                                    ? leader.widthSpan
                                                    : selected.widthSpan
                                            }
                                            style={ {
                                                width:
                                                    '100%'
                                            } }
                                            onChange={
                                                event =>
                                                    patchItem(
                                                        selectedGroup &&
                                                        leader
                                                            ? leader.id
                                                            : selected.id,
                                                        {
                                                            widthSpan:
                                                                Number(
                                                                    event.target.value
                                                                )
                                                        }
                                                    )
                                            }
                                        />
                                    </label>

                                    <select
                                        className=
                                            "form-select form-select-sm"
                                        value={
                                            selectedGroup &&
                                            leader
                                                ? leader.alignment
                                                : selected.alignment
                                        }
                                        onChange={
                                            event =>
                                                patchItem(
                                                    selectedGroup &&
                                                    leader
                                                        ? leader.id
                                                        : selected.id,
                                                    {
                                                        alignment:
                                                            event.target.value as any
                                                    }
                                                )
                                        }
                                    >
                                        <option value="left">
                                            Izquierda
                                        </option>
                                        <option value="center">
                                            Centro
                                        </option>
                                        <option value="right">
                                            Derecha
                                        </option>
                                    </select>
                                </> }

                            { (
                                selected.kind ===
                                'field' ||
                                selected.kind ===
                                'section'
                            ) &&
                                <select
                                    className=
                                        "form-select form-select-sm"
                                    style={ {
                                        gridColumn:
                                            '1 / -1'
                                    } }
                                    value={
                                        selected.labelMode
                                    }
                                    onChange={
                                        event =>
                                            patchItem(
                                                selected.id,
                                                {
                                                    labelMode:
                                                        event.target.value as LabelMode
                                                }
                                            )
                                    }
                                >
                                    <option value="above">
                                        Etiqueta encima
                                    </option>
                                    { selected.kind ===
                                      'field' &&
                                        <option value="inline">
                                            En línea
                                        </option> }
                                    <option value="hidden">
                                        Sin etiqueta / título
                                    </option>
                                </select> }

                            { selected.kind !==
                              'section' &&
                              selected.kind !==
                              'spacer' &&
                              !selectedGroup &&
                                <select
                                    className=
                                        "form-select form-select-sm"
                                    style={ {
                                        gridColumn:
                                            '1 / -1'
                                    } }
                                    value={
                                        selected.boxMode
                                    }
                                    onChange={
                                        event =>
                                            patchItem(
                                                selected.id,
                                                {
                                                    boxMode:
                                                        event.target.value as
                                                        'full' |
                                                        'fit' |
                                                        'none'
                                                }
                                            )
                                    }
                                >
                                    <option value="full">
                                        Caja completa
                                    </option>
                                    <option value="fit">
                                        Caja ajustada al contenido
                                    </option>
                                    <option value="none">
                                        Sin caja
                                    </option>
                                </select> }

                            { selected.kind !==
                              'section' &&
                              !selectedGroup &&
                                <div style={ {
                                    gridColumn:
                                        '1 / -1',
                                    display:
                                        'flex',
                                    alignItems:
                                        'center',
                                    justifyContent:
                                        'space-between',
                                    gap:
                                        '8px',
                                    fontSize:
                                        '10px'
                                } }>
                                    <span>
                                        Altura:
                                        {
                                            selected.height >
                                            0
                                                ? ` ${ selected.height } px`
                                                : ' Automática'
                                        }
                                    </span>

                                    { selected.height >
                                      0 &&
                                        <Button
                                            variant=
                                                "secondary"
                                            onClick={
                                                () =>
                                                    patchItem(
                                                        selected.id,
                                                        {
                                                            height:
                                                                0
                                                        }
                                                    )
                                            }
                                        >
                                            Auto
                                        </Button> }
                                </div> }

                            { (
                                selected.kind ===
                                'image' ||
                                (
                                    selected.kind ===
                                    'field' &&
                                    fields.get(
                                        selected.sourceId
                                    )?.fieldType ===
                                    'image'
                                )
                            ) &&
                                <>
                                    <label style={ {
                                        gridColumn:
                                            '1 / -1',
                                        fontSize:
                                            '10px'
                                    } }>
                                        Ancho imagen:
                                        { ` ${ selected.imageWidthPct }%` }

                                        <input
                                            type=
                                                "range"
                                            min={
                                                10
                                            }
                                            max={
                                                100
                                            }
                                            step={
                                                5
                                            }
                                            value={
                                                selected.imageWidthPct
                                            }
                                            style={ {
                                                width:
                                                    '100%'
                                            } }
                                            onChange={
                                                event =>
                                                    patchItem(
                                                        selected.id,
                                                        {
                                                            imageWidthPct:
                                                                Number(
                                                                    event.target.value
                                                                )
                                                        }
                                                    )
                                            }
                                        />
                                    </label>

                                    <label style={ {
                                        gridColumn:
                                            '1 / -1',
                                        fontSize:
                                            '10px'
                                    } }>
                                        Alto máximo:
                                        { ` ${ selected.imageMaxHeight } px` }

                                        <input
                                            type=
                                                "range"
                                            min={
                                                80
                                            }
                                            max={
                                                1000
                                            }
                                            step={
                                                20
                                            }
                                            value={
                                                selected.imageMaxHeight
                                            }
                                            style={ {
                                                width:
                                                    '100%'
                                            } }
                                            onChange={
                                                event =>
                                                    patchItem(
                                                        selected.id,
                                                        {
                                                            imageMaxHeight:
                                                                Number(
                                                                    event.target.value
                                                                )
                                                        }
                                                    )
                                            }
                                        />
                                    </label>

                                    <label style={ {
                                        gridColumn:
                                            '1 / -1',
                                        fontSize:
                                            '10px'
                                    } }>
                                        Opacidad de imagen:
                                        { ` ${ selected.imageOpacity }%` }

                                        <input
                                            type=
                                                "range"
                                            min={
                                                5
                                            }
                                            max={
                                                100
                                            }
                                            step={
                                                5
                                            }
                                            value={
                                                selected.imageOpacity
                                            }
                                            style={ {
                                                width:
                                                    '100%'
                                            } }
                                            onChange={
                                                event =>
                                                    patchItem(
                                                        selected.id,
                                                        {
                                                            imageOpacity:
                                                                Number(
                                                                    event.target.value
                                                                )
                                                        }
                                                    )
                                            }
                                        />
                                    </label>

                                    <label style={ {
                                        gridColumn:
                                            '1 / -1',
                                        fontSize:
                                            '10px'
                                    } }>
                                        Esquinas de imagen:
                                        { ` ${ selected.imageRadius } px` }

                                        <input
                                            type=
                                                "range"
                                            min={
                                                0
                                            }
                                            max={
                                                80
                                            }
                                            step={
                                                1
                                            }
                                            value={
                                                selected.imageRadius
                                            }
                                            style={ {
                                                width:
                                                    '100%'
                                            } }
                                            onChange={
                                                event =>
                                                    patchItem(
                                                        selected.id,
                                                        {
                                                            imageRadius:
                                                                Number(
                                                                    event.target.value
                                                                )
                                                        }
                                                    )
                                            }
                                        />
                                    </label>

                                    <label style={ {
                                        fontSize:
                                            '10px'
                                    } }>
                                        Marco:
                                        { ` ${ selected.imageBorderWidth } px` }

                                        <input
                                            type=
                                                "range"
                                            min={
                                                0
                                            }
                                            max={
                                                12
                                            }
                                            step={
                                                1
                                            }
                                            value={
                                                selected.imageBorderWidth
                                            }
                                            style={ {
                                                width:
                                                    '100%'
                                            } }
                                            onChange={
                                                event =>
                                                    patchItem(
                                                        selected.id,
                                                        {
                                                            imageBorderWidth:
                                                                Number(
                                                                    event.target.value
                                                                )
                                                        }
                                                    )
                                            }
                                        />
                                    </label>

                                    <select
                                        className=
                                            "form-select form-select-sm"
                                        value={
                                            selected.imageBorderStyle
                                        }
                                        disabled={
                                            selected.imageBorderWidth <=
                                            0
                                        }
                                        onChange={
                                            event =>
                                                patchItem(
                                                    selected.id,
                                                    {
                                                        imageBorderStyle:
                                                            event.target.value as
                                                            'solid' |
                                                            'dashed' |
                                                            'dotted' |
                                                            'double'
                                                    }
                                                )
                                        }
                                    >
                                        <option value="solid">
                                            Marco continuo
                                        </option>
                                        <option value="dashed">
                                            Marco discontinuo
                                        </option>
                                        <option value="dotted">
                                            Marco de puntos
                                        </option>
                                        <option value="double">
                                            Marco doble
                                        </option>
                                    </select>

                                    { selected.imageBorderWidth >
                                      0 &&
                                        <label style={ {
                                            gridColumn:
                                                '1 / -1',
                                            display:
                                                'flex',
                                            alignItems:
                                                'center',
                                            gap:
                                                '7px',
                                            fontSize:
                                                '10px'
                                        } }>
                                            Color del marco

                                            <input
                                                type=
                                                    "color"
                                                className=
                                                    "form-control form-control-color"
                                                value={
                                                    selected.imageBorderColor ||
                                                    design.primaryColor
                                                }
                                                onChange={
                                                    event =>
                                                        patchItem(
                                                            selected.id,
                                                            {
                                                                imageBorderColor:
                                                                    event.target.value
                                                            }
                                                        )
                                                }
                                            />
                                        </label> }

                                    <label style={ {
                                        gridColumn:
                                            '1 / -1',
                                        display:
                                            'flex',
                                        alignItems:
                                            'center',
                                        gap:
                                            '6px',
                                        fontSize:
                                            '10px'
                                    } }>
                                        <input
                                            type=
                                                "checkbox"
                                            checked={
                                                selected.imageShadowEnabled
                                            }
                                            onChange={
                                                event =>
                                                    patchItem(
                                                        selected.id,
                                                        {
                                                            imageShadowEnabled:
                                                                event.target.checked
                                                        }
                                                    )
                                            }
                                        />
                                        Sombra de imagen
                                    </label>

                                    { selected.imageShadowEnabled &&
                                        <>
                                            <label style={ {
                                                fontSize:
                                                    '10px'
                                            } }>
                                                Desenfoque:
                                                { ` ${ selected.imageShadowBlur } px` }

                                                <input
                                                    type=
                                                        "range"
                                                    min={
                                                        0
                                                    }
                                                    max={
                                                        60
                                                    }
                                                    step={
                                                        1
                                                    }
                                                    value={
                                                        selected.imageShadowBlur
                                                    }
                                                    style={ {
                                                        width:
                                                            '100%'
                                                    } }
                                                    onChange={
                                                        event =>
                                                            patchItem(
                                                                selected.id,
                                                                {
                                                                    imageShadowBlur:
                                                                        Number(
                                                                            event.target.value
                                                                        )
                                                                }
                                                            )
                                                    }
                                                />
                                            </label>

                                            <input
                                                type=
                                                    "color"
                                                className=
                                                    "form-control form-control-color"
                                                value={
                                                    selected.imageShadowColor
                                                }
                                                onChange={
                                                    event =>
                                                        patchItem(
                                                            selected.id,
                                                            {
                                                                imageShadowColor:
                                                                    event.target.value
                                                            }
                                                        )
                                                }
                                            />

                                            <label style={ {
                                                fontSize:
                                                    '10px'
                                            } }>
                                                Horizontal:
                                                { ` ${ selected.imageShadowX } px` }

                                                <input
                                                    type=
                                                        "range"
                                                    min={
                                                        -40
                                                    }
                                                    max={
                                                        40
                                                    }
                                                    step={
                                                        1
                                                    }
                                                    value={
                                                        selected.imageShadowX
                                                    }
                                                    style={ {
                                                        width:
                                                            '100%'
                                                    } }
                                                    onChange={
                                                        event =>
                                                            patchItem(
                                                                selected.id,
                                                                {
                                                                    imageShadowX:
                                                                        Number(
                                                                            event.target.value
                                                                        )
                                                                }
                                                            )
                                                    }
                                                />
                                            </label>

                                            <label style={ {
                                                fontSize:
                                                    '10px'
                                            } }>
                                                Vertical:
                                                { ` ${ selected.imageShadowY } px` }

                                                <input
                                                    type=
                                                        "range"
                                                    min={
                                                        -40
                                                    }
                                                    max={
                                                        40
                                                    }
                                                    step={
                                                        1
                                                    }
                                                    value={
                                                        selected.imageShadowY
                                                    }
                                                    style={ {
                                                        width:
                                                            '100%'
                                                    } }
                                                    onChange={
                                                        event =>
                                                            patchItem(
                                                                selected.id,
                                                                {
                                                                    imageShadowY:
                                                                        Number(
                                                                            event.target.value
                                                                        )
                                                                }
                                                            )
                                                    }
                                                />
                                            </label>

                                            <label style={ {
                                                gridColumn:
                                                    '1 / -1',
                                                fontSize:
                                                    '10px'
                                            } }>
                                                Opacidad de sombra:
                                                { ` ${ selected.imageShadowOpacity }%` }

                                                <input
                                                    type=
                                                        "range"
                                                    min={
                                                        0
                                                    }
                                                    max={
                                                        100
                                                    }
                                                    step={
                                                        5
                                                    }
                                                    value={
                                                        selected.imageShadowOpacity
                                                    }
                                                    style={ {
                                                        width:
                                                            '100%'
                                                    } }
                                                    onChange={
                                                        event =>
                                                            patchItem(
                                                                selected.id,
                                                                {
                                                                    imageShadowOpacity:
                                                                        Number(
                                                                            event.target.value
                                                                        )
                                                                }
                                                            )
                                                    }
                                                />
                                            </label>
                                        </> }
                                </> }

                            { selected.kind ===
                              'text' &&
                                <>
                                    <input
                                        className=
                                            "form-control form-control-sm"
                                        style={ {
                                            gridColumn:
                                                '1 / -1'
                                        } }
                                        placeholder=
                                            "Título opcional"
                                        value={
                                            selected.title
                                        }
                                        maxLength={
                                            120
                                        }
                                        onChange={
                                            event =>
                                                patchItem(
                                                    selected.id,
                                                    {
                                                        title:
                                                            event.target.value
                                                    }
                                                )
                                        }
                                    />

                                    <textarea
                                        className=
                                            "form-control form-control-sm"
                                        style={ {
                                            gridColumn:
                                                '1 / -1'
                                        } }
                                        rows={
                                            4
                                        }
                                        placeholder=
                                            "Texto..."
                                        value={
                                            selected.content
                                        }
                                        onChange={
                                            event =>
                                                patchItem(
                                                    selected.id,
                                                    {
                                                        content:
                                                            event.target.value
                                                    }
                                                )
                                        }
                                    />
                                </> }

                            { selected.kind ===
                              'image' &&
                                <input
                                    className=
                                        "form-control form-control-sm"
                                    style={ {
                                        gridColumn:
                                            '1 / -1'
                                    } }
                                    placeholder=
                                        "https://..."
                                    value={
                                        selected.imageUrl
                                    }
                                    onChange={
                                        event =>
                                            patchItem(
                                                selected.id,
                                                {
                                                    imageUrl:
                                                        event.target.value
                                                }
                                            )
                                    }
                                /> }

                            { selected.kind ===
                              'divider' &&
                                <input
                                    className=
                                        "form-control form-control-sm"
                                    style={ {
                                        gridColumn:
                                            '1 / -1'
                                    } }
                                    placeholder=
                                        "Texto opcional"
                                    value={
                                        selected.title
                                    }
                                    maxLength={
                                        120
                                    }
                                    onChange={
                                        event =>
                                            patchItem(
                                                selected.id,
                                                {
                                                    title:
                                                        event.target.value
                                                }
                                            )
                                    }
                                /> }

                            { selected.kind !==
                              'spacer' &&
                                <>
                                    <div style={ {
                                        gridColumn:
                                            '1 / -1',
                                        fontSize:
                                            '10px',
                                        fontWeight:
                                            900,
                                        borderTop:
                                            '1px solid rgba(0,0,0,.10)',
                                        paddingTop:
                                            '7px'
                                    } }>
                                        Tipografía del contenido
                                    </div>

                                    <select
                                        className=
                                            "form-select form-select-sm"
                                        value={
                                            selected.fontFamily
                                        }
                                        onChange={
                                            event =>
                                                patchItem(
                                                    selected.id,
                                                    {
                                                        fontFamily:
                                                            event.target.value
                                                    }
                                                )
                                        }
                                    >
                                        { FONT_OPTIONS.map(
                                            option =>
                                                <option
                                                    key={
                                                        option.value
                                                    }
                                                    value={
                                                        option.value
                                                    }
                                                >
                                                    { option.label }
                                                </option>
                                        ) }
                                    </select>

                                    <label style={ {
                                        fontSize:
                                            '10px'
                                    } }>
                                        Tamaño:
                                        { ` ${ selected.fontSize } px` }

                                        <input
                                            type=
                                                "range"
                                            min={
                                                7
                                            }
                                            max={
                                                64
                                            }
                                            step={
                                                1
                                            }
                                            value={
                                                selected.fontSize
                                            }
                                            style={ {
                                                width:
                                                    '100%'
                                            } }
                                            onChange={
                                                event =>
                                                    patchItem(
                                                        selected.id,
                                                        {
                                                            fontSize:
                                                                Number(
                                                                    event.target.value
                                                                )
                                                        }
                                                    )
                                            }
                                        />
                                    </label>

                                    <label style={ {
                                        fontSize:
                                            '10px'
                                    } }>
                                        <input
                                            type=
                                                "checkbox"
                                            checked={
                                                selected.fontBold
                                            }
                                            onChange={
                                                event =>
                                                    patchItem(
                                                        selected.id,
                                                        {
                                                            fontBold:
                                                                event.target.checked
                                                        }
                                                    )
                                            }
                                        />
                                        {' '}Negrita
                                    </label>

                                    <label style={ {
                                        fontSize:
                                            '10px'
                                    } }>
                                        <input
                                            type=
                                                "checkbox"
                                            checked={
                                                selected.fontItalic
                                            }
                                            onChange={
                                                event =>
                                                    patchItem(
                                                        selected.id,
                                                        {
                                                            fontItalic:
                                                                event.target.checked
                                                        }
                                                    )
                                            }
                                        />
                                        {' '}Cursiva
                                    </label>

                                    <label style={ {
                                        fontSize:
                                            '10px'
                                    } }>
                                        <input
                                            type=
                                                "checkbox"
                                            checked={
                                                selected.fontUnderline
                                            }
                                            onChange={
                                                event =>
                                                    patchItem(
                                                        selected.id,
                                                        {
                                                            fontUnderline:
                                                                event.target.checked
                                                        }
                                                    )
                                            }
                                        />
                                        {' '}Subrayado
                                    </label>

                                    <div style={ {
                                        gridColumn:
                                            '1 / -1',
                                        fontSize:
                                            '10px',
                                        fontWeight:
                                            900,
                                        borderTop:
                                            '1px solid rgba(0,0,0,.10)',
                                        paddingTop:
                                            '7px'
                                    } }>
                                        Etiqueta / título
                                    </div>

                                    <select
                                        className=
                                            "form-select form-select-sm"
                                        value={
                                            selected.labelFontFamily
                                        }
                                        onChange={
                                            event =>
                                                patchItem(
                                                    selected.id,
                                                    {
                                                        labelFontFamily:
                                                            event.target.value
                                                    }
                                                )
                                        }
                                    >
                                        { FONT_OPTIONS.map(
                                            option =>
                                                <option
                                                    key={
                                                        option.value
                                                    }
                                                    value={
                                                        option.value
                                                    }
                                                >
                                                    { option.label }
                                                </option>
                                        ) }
                                    </select>

                                    <label style={ {
                                        fontSize:
                                            '10px'
                                    } }>
                                        Tamaño:
                                        { ` ${ selected.labelFontSize } px` }

                                        <input
                                            type=
                                                "range"
                                            min={
                                                7
                                            }
                                            max={
                                                64
                                            }
                                            step={
                                                1
                                            }
                                            value={
                                                selected.labelFontSize
                                            }
                                            style={ {
                                                width:
                                                    '100%'
                                            } }
                                            onChange={
                                                event =>
                                                    patchItem(
                                                        selected.id,
                                                        {
                                                            labelFontSize:
                                                                Number(
                                                                    event.target.value
                                                                )
                                                        }
                                                    )
                                            }
                                        />
                                    </label>

                                    <label style={ {
                                        fontSize:
                                            '10px'
                                    } }>
                                        <input
                                            type=
                                                "checkbox"
                                            checked={
                                                selected.labelBold
                                            }
                                            onChange={
                                                event =>
                                                    patchItem(
                                                        selected.id,
                                                        {
                                                            labelBold:
                                                                event.target.checked
                                                        }
                                                    )
                                            }
                                        />
                                        {' '}Negrita
                                    </label>

                                    <label style={ {
                                        fontSize:
                                            '10px'
                                    } }>
                                        <input
                                            type=
                                                "checkbox"
                                            checked={
                                                selected.labelItalic
                                            }
                                            onChange={
                                                event =>
                                                    patchItem(
                                                        selected.id,
                                                        {
                                                            labelItalic:
                                                                event.target.checked
                                                        }
                                                    )
                                            }
                                        />
                                        {' '}Cursiva
                                    </label>

                                    <label style={ {
                                        fontSize:
                                            '10px'
                                    } }>
                                        <input
                                            type=
                                                "checkbox"
                                            checked={
                                                selected.labelUnderline
                                            }
                                            onChange={
                                                event =>
                                                    patchItem(
                                                        selected.id,
                                                        {
                                                            labelUnderline:
                                                                event.target.checked
                                                        }
                                                    )
                                            }
                                        />
                                        {' '}Subrayado
                                    </label>

                                    <label style={ {
                                        fontSize:
                                            '10px'
                                    } }>
                                        <input
                                            type=
                                                "checkbox"
                                            checked={
                                                !!selected.labelColor
                                            }
                                            onChange={
                                                event =>
                                                    patchItem(
                                                        selected.id,
                                                        {
                                                            labelColor:
                                                                event.target.checked
                                                                    ? design.primaryColor
                                                                    : ''
                                                        }
                                                    )
                                            }
                                        />
                                        {' '}Color propio
                                    </label>

                                    { selected.labelColor &&
                                        <input
                                            type=
                                                "color"
                                            className=
                                                "form-control form-control-color"
                                            value={
                                                selected.labelColor
                                            }
                                            onChange={
                                                event =>
                                                    patchItem(
                                                        selected.id,
                                                        {
                                                            labelColor:
                                                                event.target.value
                                                        }
                                                    )
                                            }
                                        /> }
                                </> }

                            { !selectedGroup &&
                              selected.kind !==
                              'section' &&
                              selected.kind !==
                              'spacer' &&
                                <>
                                    <div style={ {
                                        gridColumn:
                                            '1 / -1',
                                        fontSize:
                                            '10px',
                                        fontWeight:
                                            900,
                                        borderTop:
                                            '1px solid rgba(0,0,0,.10)',
                                        paddingTop:
                                            '7px'
                                    } }>
                                        Caja
                                    </div>

                                    <label style={ {
                                        fontSize:
                                            '10px'
                                    } }>
                                        Padding:
                                        { ` ${ selected.padding } px` }

                                        <input
                                            type=
                                                "range"
                                            min={
                                                0
                                            }
                                            max={
                                                60
                                            }
                                            step={
                                                2
                                            }
                                            value={
                                                selected.padding
                                            }
                                            disabled={
                                                selected.boxMode ===
                                                'none'
                                            }
                                            style={ {
                                                width:
                                                    '100%'
                                            } }
                                            onChange={
                                                event =>
                                                    patchItem(
                                                        selected.id,
                                                        {
                                                            padding:
                                                                Number(
                                                                    event.target.value
                                                                )
                                                        }
                                                    )
                                            }
                                        />
                                    </label>

                                    <label style={ {
                                        fontSize:
                                            '10px'
                                    } }>
                                        Esquinas:
                                        {
                                            selected.radius <
                                            0
                                                ? ' general'
                                                : ` ${ selected.radius } px`
                                        }

                                        <input
                                            type=
                                                "range"
                                            min={
                                                -1
                                            }
                                            max={
                                                50
                                            }
                                            step={
                                                1
                                            }
                                            value={
                                                selected.radius
                                            }
                                            disabled={
                                                selected.boxMode ===
                                                'none'
                                            }
                                            style={ {
                                                width:
                                                    '100%'
                                            } }
                                            onChange={
                                                event =>
                                                    patchItem(
                                                        selected.id,
                                                        {
                                                            radius:
                                                                Number(
                                                                    event.target.value
                                                                )
                                                        }
                                                    )
                                            }
                                        />
                                    </label>

                                    <label style={ {
                                        fontSize:
                                            '10px'
                                    } }>
                                        Grosor borde:
                                        { ` ${ selected.borderWidth } px` }

                                        <input
                                            type=
                                                "range"
                                            min={
                                                0
                                            }
                                            max={
                                                8
                                            }
                                            step={
                                                1
                                            }
                                            value={
                                                selected.borderWidth
                                            }
                                            disabled={
                                                selected.boxMode ===
                                                'none'
                                            }
                                            style={ {
                                                width:
                                                    '100%'
                                            } }
                                            onChange={
                                                event =>
                                                    patchItem(
                                                        selected.id,
                                                        {
                                                            borderWidth:
                                                                Number(
                                                                    event.target.value
                                                                )
                                                        }
                                                    )
                                            }
                                        />
                                    </label>

                                    <select
                                        className=
                                            "form-select form-select-sm"
                                        value={
                                            selected.borderStyle
                                        }
                                        disabled={
                                            selected.boxMode ===
                                            'none'
                                        }
                                        onChange={
                                            event =>
                                                patchItem(
                                                    selected.id,
                                                    {
                                                        borderStyle:
                                                            event.target.value as
                                                            'solid' |
                                                            'dashed' |
                                                            'dotted' |
                                                            'double'
                                                    }
                                                )
                                        }
                                    >
                                        <option value="solid">
                                            Borde continuo
                                        </option>
                                        <option value="dashed">
                                            Borde discontinuo
                                        </option>
                                        <option value="dotted">
                                            Borde de puntos
                                        </option>
                                        <option value="double">
                                            Borde doble
                                        </option>
                                    </select>

                                    <label style={ {
                                        fontSize:
                                            '10px'
                                    } }>
                                        <input
                                            type=
                                                "checkbox"
                                            checked={
                                                !!selected.backgroundColor
                                            }
                                            disabled={
                                                selected.boxMode ===
                                                'none'
                                            }
                                            onChange={
                                                event =>
                                                    patchItem(
                                                        selected.id,
                                                        {
                                                            backgroundColor:
                                                                event.target.checked
                                                                    ? design.panelColor
                                                                    : ''
                                                        }
                                                    )
                                            }
                                        />
                                        {' '}Fondo propio
                                    </label>

                                    { selected.backgroundColor &&
                                      selected.boxMode !==
                                      'none' &&
                                        <input
                                            type=
                                                "color"
                                            className=
                                                "form-control form-control-color"
                                            value={
                                                selected.backgroundColor
                                            }
                                            onChange={
                                                event =>
                                                    patchItem(
                                                        selected.id,
                                                        {
                                                            backgroundColor:
                                                                event.target.value
                                                        }
                                                    )
                                            }
                                        /> }

                                    { selected.backgroundColor &&
                                      selected.boxMode !==
                                      'none' &&
                                        <label style={ {
                                            gridColumn:
                                                '1 / -1',
                                            fontSize:
                                                '10px'
                                        } }>
                                            Opacidad:
                                            { ` ${ selected.backgroundOpacity }%` }

                                            <input
                                                type=
                                                    "range"
                                                min={
                                                    10
                                                }
                                                max={
                                                    100
                                                }
                                                step={
                                                    5
                                                }
                                                value={
                                                    selected.backgroundOpacity
                                                }
                                                style={ {
                                                    width:
                                                        '100%'
                                                } }
                                                onChange={
                                                    event =>
                                                        patchItem(
                                                            selected.id,
                                                            {
                                                                backgroundOpacity:
                                                                    Number(
                                                                        event.target.value
                                                                    )
                                                            }
                                                        )
                                                }
                                            />
                                        </label> }

                                    <div style={ {
                                        gridColumn:
                                            '1 / -1',
                                        fontSize:
                                            '10px',
                                        fontWeight:
                                            900,
                                        borderTop:
                                            '1px solid rgba(0,0,0,.10)',
                                        paddingTop:
                                            '7px'
                                    } }>
                                        Efectos de caja
                                    </div>

                                    <label style={ {
                                        fontSize:
                                            '10px'
                                    } }>
                                        <input
                                            type=
                                                "checkbox"
                                            checked={
                                                selected.gradientEnabled
                                            }
                                            disabled={
                                                selected.boxMode ===
                                                'none'
                                            }
                                            onChange={
                                                event =>
                                                    patchItem(
                                                        selected.id,
                                                        {
                                                            gradientEnabled:
                                                                event.target.checked
                                                        }
                                                    )
                                            }
                                        />
                                        {' '}Degradado
                                    </label>

                                    { selected.gradientEnabled &&
                                      selected.boxMode !==
                                      'none' &&
                                        <input
                                            type=
                                                "color"
                                            className=
                                                "form-control form-control-color"
                                            value={
                                                selected.gradientColor2
                                            }
                                            onChange={
                                                event =>
                                                    patchItem(
                                                        selected.id,
                                                        {
                                                            gradientColor2:
                                                                event.target.value
                                                        }
                                                    )
                                            }
                                        /> }

                                    { selected.gradientEnabled &&
                                      selected.boxMode !==
                                      'none' &&
                                        <label style={ {
                                            gridColumn:
                                                '1 / -1',
                                            fontSize:
                                                '10px'
                                        } }>
                                            Ángulo del degradado:
                                            { ` ${ selected.gradientAngle }°` }

                                            <input
                                                type=
                                                    "range"
                                                min={
                                                    0
                                                }
                                                max={
                                                    360
                                                }
                                                step={
                                                    5
                                                }
                                                value={
                                                    selected.gradientAngle
                                                }
                                                style={ {
                                                    width:
                                                        '100%'
                                                } }
                                                onChange={
                                                    event =>
                                                        patchItem(
                                                            selected.id,
                                                            {
                                                                gradientAngle:
                                                                    Number(
                                                                        event.target.value
                                                                    )
                                                            }
                                                        )
                                                }
                                            />
                                        </label> }

                                    <label style={ {
                                        fontSize:
                                            '10px'
                                    } }>
                                        <input
                                            type=
                                                "checkbox"
                                            checked={
                                                selected.shadowEnabled
                                            }
                                            disabled={
                                                selected.boxMode ===
                                                'none'
                                            }
                                            onChange={
                                                event =>
                                                    patchItem(
                                                        selected.id,
                                                        {
                                                            shadowEnabled:
                                                                event.target.checked
                                                        }
                                                    )
                                            }
                                        />
                                        {' '}Sombra de caja
                                    </label>

                                    { selected.shadowEnabled &&
                                      selected.boxMode !==
                                      'none' &&
                                        <>
                                            <input
                                                type=
                                                    "color"
                                                className=
                                                    "form-control form-control-color"
                                                value={
                                                    selected.shadowColor
                                                }
                                                onChange={
                                                    event =>
                                                        patchItem(
                                                            selected.id,
                                                            {
                                                                shadowColor:
                                                                    event.target.value
                                                            }
                                                        )
                                                }
                                            />

                                            <label style={ {
                                                fontSize:
                                                    '10px'
                                            } }>
                                                Desenfoque:
                                                { ` ${ selected.shadowBlur } px` }

                                                <input
                                                    type=
                                                        "range"
                                                    min={
                                                        0
                                                    }
                                                    max={
                                                        60
                                                    }
                                                    step={
                                                        1
                                                    }
                                                    value={
                                                        selected.shadowBlur
                                                    }
                                                    style={ {
                                                        width:
                                                            '100%'
                                                    } }
                                                    onChange={
                                                        event =>
                                                            patchItem(
                                                                selected.id,
                                                                {
                                                                    shadowBlur:
                                                                        Number(
                                                                            event.target.value
                                                                        )
                                                                }
                                                            )
                                                    }
                                                />
                                            </label>

                                            <label style={ {
                                                fontSize:
                                                    '10px'
                                            } }>
                                                Horizontal:
                                                { ` ${ selected.shadowX } px` }

                                                <input
                                                    type=
                                                        "range"
                                                    min={
                                                        -40
                                                    }
                                                    max={
                                                        40
                                                    }
                                                    step={
                                                        1
                                                    }
                                                    value={
                                                        selected.shadowX
                                                    }
                                                    style={ {
                                                        width:
                                                            '100%'
                                                    } }
                                                    onChange={
                                                        event =>
                                                            patchItem(
                                                                selected.id,
                                                                {
                                                                    shadowX:
                                                                        Number(
                                                                            event.target.value
                                                                        )
                                                                }
                                                            )
                                                    }
                                                />
                                            </label>

                                            <label style={ {
                                                fontSize:
                                                    '10px'
                                            } }>
                                                Vertical:
                                                { ` ${ selected.shadowY } px` }

                                                <input
                                                    type=
                                                        "range"
                                                    min={
                                                        -40
                                                    }
                                                    max={
                                                        40
                                                    }
                                                    step={
                                                        1
                                                    }
                                                    value={
                                                        selected.shadowY
                                                    }
                                                    style={ {
                                                        width:
                                                            '100%'
                                                    } }
                                                    onChange={
                                                        event =>
                                                            patchItem(
                                                                selected.id,
                                                                {
                                                                    shadowY:
                                                                        Number(
                                                                            event.target.value
                                                                        )
                                                                }
                                                            )
                                                    }
                                                />
                                            </label>

                                            <label style={ {
                                                gridColumn:
                                                    '1 / -1',
                                                fontSize:
                                                    '10px'
                                            } }>
                                                Opacidad de sombra:
                                                { ` ${ selected.shadowOpacity }%` }

                                                <input
                                                    type=
                                                        "range"
                                                    min={
                                                        0
                                                    }
                                                    max={
                                                        100
                                                    }
                                                    step={
                                                        5
                                                    }
                                                    value={
                                                        selected.shadowOpacity
                                                    }
                                                    style={ {
                                                        width:
                                                            '100%'
                                                    } }
                                                    onChange={
                                                        event =>
                                                            patchItem(
                                                                selected.id,
                                                                {
                                                                    shadowOpacity:
                                                                        Number(
                                                                            event.target.value
                                                                        )
                                                                }
                                                            )
                                                    }
                                                />
                                            </label>
                                        </> }

                                    <label style={ {
                                        fontSize:
                                            '10px'
                                    } }>
                                        <input
                                            type=
                                                "checkbox"
                                            checked={
                                                !!selected.borderColor
                                            }
                                            disabled={
                                                selected.boxMode ===
                                                'none'
                                            }
                                            onChange={
                                                event =>
                                                    patchItem(
                                                        selected.id,
                                                        {
                                                            borderColor:
                                                                event.target.checked
                                                                    ? design.primaryColor
                                                                    : ''
                                                        }
                                                    )
                                            }
                                        />
                                        {' '}Color de borde propio
                                    </label>

                                    { selected.borderColor &&
                                      selected.boxMode !==
                                      'none' &&
                                        <input
                                            type=
                                                "color"
                                            className=
                                                "form-control form-control-color"
                                            value={
                                                selected.borderColor
                                            }
                                            onChange={
                                                event =>
                                                    patchItem(
                                                        selected.id,
                                                        {
                                                            borderColor:
                                                                event.target.value
                                                        }
                                                    )
                                            }
                                        /> }

                                    <label style={ {
                                        fontSize:
                                            '10px'
                                    } }>
                                        <input
                                            type=
                                                "checkbox"
                                            checked={
                                                !!selected.textColor
                                            }
                                            onChange={
                                                event =>
                                                    patchItem(
                                                        selected.id,
                                                        {
                                                            textColor:
                                                                event.target.checked
                                                                    ? design.textColor
                                                                    : ''
                                                        }
                                                    )
                                            }
                                        />
                                        {' '}Color del contenido propio
                                    </label>

                                    { selected.textColor &&
                                        <input
                                            type=
                                                "color"
                                            className=
                                                "form-control form-control-color"
                                            value={
                                                selected.textColor
                                            }
                                            onChange={
                                                event =>
                                                    patchItem(
                                                        selected.id,
                                                        {
                                                            textColor:
                                                                event.target.value
                                                        }
                                                    )
                                            }
                                        /> }
                                </> }
                        </div>

                        { selectedGroup &&
                          leader &&
                            <div style={ {
                                marginTop:
                                    '10px',
                                paddingTop:
                                    '10px',
                                borderTop:
                                    '1px solid rgba(0,0,0,.13)'
                            } }>
                                <strong style={ {
                                    fontSize:
                                        '11px'
                                } }>
                                    Caja fusionada
                                </strong>

                                <div style={ {
                                    marginTop:
                                        '6px',
                                    display:
                                        'grid',
                                    gridTemplateColumns:
                                        '1fr 1fr',
                                    gap:
                                        '7px'
                                } }>
                                    <select
                                        className=
                                            "form-select form-select-sm"
                                        value={
                                            leader.mergeLayout
                                        }
                                        onChange={
                                            event =>
                                                patchItem(
                                                    leader.id,
                                                    {
                                                        mergeLayout:
                                                            event.target.value as
                                                            'column' |
                                                            'row'
                                                    }
                                                )
                                        }
                                    >
                                        <option value="column">
                                            Uno debajo de otro
                                        </option>
                                        <option value="row">
                                            En la misma línea
                                        </option>
                                    </select>

                                    <label style={ {
                                        fontSize:
                                            '10px'
                                    } }>
                                        Separación:
                                        { ` ${ leader.mergeGap } px` }

                                        <input
                                            type=
                                                "range"
                                            min={
                                                0
                                            }
                                            max={
                                                40
                                            }
                                            step={
                                                1
                                            }
                                            value={
                                                leader.mergeGap
                                            }
                                            style={ {
                                                width:
                                                    '100%'
                                            } }
                                            onChange={
                                                event =>
                                                    patchItem(
                                                        leader.id,
                                                        {
                                                            mergeGap:
                                                                Number(
                                                                    event.target.value
                                                                )
                                                        }
                                                    )
                                            }
                                        />
                                    </label>

                                    <select
                                        className=
                                            "form-select form-select-sm"
                                        value={
                                            leader.boxMode
                                        }
                                        onChange={
                                            event =>
                                                patchItem(
                                                    leader.id,
                                                    {
                                                        boxMode:
                                                            event.target.value as
                                                            'full' |
                                                            'fit' |
                                                            'none'
                                                    }
                                                )
                                        }
                                    >
                                        <option value="full">
                                            Caja completa
                                        </option>
                                        <option value="fit">
                                            Ajustada al contenido
                                        </option>
                                        <option value="none">
                                            Sin caja
                                        </option>
                                    </select>

                                    <label style={ {
                                        fontSize:
                                            '10px'
                                    } }>
                                        Padding:
                                        { ` ${ leader.padding } px` }

                                        <input
                                            type=
                                                "range"
                                            min={
                                                0
                                            }
                                            max={
                                                60
                                            }
                                            step={
                                                2
                                            }
                                            value={
                                                leader.padding
                                            }
                                            disabled={
                                                leader.boxMode ===
                                                'none'
                                            }
                                            style={ {
                                                width:
                                                    '100%'
                                            } }
                                            onChange={
                                                event =>
                                                    patchItem(
                                                        leader.id,
                                                        {
                                                            padding:
                                                                Number(
                                                                    event.target.value
                                                                )
                                                        }
                                                    )
                                            }
                                        />
                                    </label>

                                    <label style={ {
                                        fontSize:
                                            '10px'
                                    } }>
                                        Esquinas:
                                        {
                                            leader.radius <
                                            0
                                                ? ' general'
                                                : ` ${ leader.radius } px`
                                        }

                                        <input
                                            type=
                                                "range"
                                            min={
                                                -1
                                            }
                                            max={
                                                50
                                            }
                                            step={
                                                1
                                            }
                                            value={
                                                leader.radius
                                            }
                                            disabled={
                                                leader.boxMode ===
                                                'none'
                                            }
                                            style={ {
                                                width:
                                                    '100%'
                                            } }
                                            onChange={
                                                event =>
                                                    patchItem(
                                                        leader.id,
                                                        {
                                                            radius:
                                                                Number(
                                                                    event.target.value
                                                                )
                                                        }
                                                    )
                                            }
                                        />
                                    </label>

                                    <label style={ {
                                        fontSize:
                                            '10px'
                                    } }>
                                        Grosor borde:
                                        { ` ${ leader.borderWidth } px` }

                                        <input
                                            type=
                                                "range"
                                            min={
                                                0
                                            }
                                            max={
                                                8
                                            }
                                            step={
                                                1
                                            }
                                            value={
                                                leader.borderWidth
                                            }
                                            disabled={
                                                leader.boxMode ===
                                                'none'
                                            }
                                            style={ {
                                                width:
                                                    '100%'
                                            } }
                                            onChange={
                                                event =>
                                                    patchItem(
                                                        leader.id,
                                                        {
                                                            borderWidth:
                                                                Number(
                                                                    event.target.value
                                                                )
                                                        }
                                                    )
                                            }
                                        />
                                    </label>

                                    <select
                                        className=
                                            "form-select form-select-sm"
                                        value={
                                            leader.borderStyle
                                        }
                                        disabled={
                                            leader.boxMode ===
                                            'none'
                                        }
                                        onChange={
                                            event =>
                                                patchItem(
                                                    leader.id,
                                                    {
                                                        borderStyle:
                                                            event.target.value as
                                                            'solid' |
                                                            'dashed' |
                                                            'dotted' |
                                                            'double'
                                                    }
                                                )
                                        }
                                    >
                                        <option value="solid">
                                            Borde continuo
                                        </option>
                                        <option value="dashed">
                                            Borde discontinuo
                                        </option>
                                        <option value="dotted">
                                            Borde de puntos
                                        </option>
                                        <option value="double">
                                            Borde doble
                                        </option>
                                    </select>

                                    <label style={ {
                                        fontSize:
                                            '10px'
                                    } }>
                                        <input
                                            type=
                                                "checkbox"
                                            checked={
                                                !!leader.backgroundColor
                                            }
                                            disabled={
                                                leader.boxMode ===
                                                'none'
                                            }
                                            onChange={
                                                event =>
                                                    patchItem(
                                                        leader.id,
                                                        {
                                                            backgroundColor:
                                                                event.target.checked
                                                                    ? design.panelColor
                                                                    : ''
                                                        }
                                                    )
                                            }
                                        />
                                        {' '}Fondo propio
                                    </label>

                                    { leader.backgroundColor &&
                                      leader.boxMode !==
                                      'none' &&
                                        <input
                                            type=
                                                "color"
                                            className=
                                                "form-control form-control-color"
                                            value={
                                                leader.backgroundColor
                                            }
                                            onChange={
                                                event =>
                                                    patchItem(
                                                        leader.id,
                                                        {
                                                            backgroundColor:
                                                                event.target.value
                                                        }
                                                    )
                                            }
                                        /> }

                                    <div style={ {
                                        gridColumn:
                                            '1 / -1',
                                        fontSize:
                                            '10px',
                                        fontWeight:
                                            900,
                                        borderTop:
                                            '1px solid rgba(0,0,0,.10)',
                                        paddingTop:
                                            '7px'
                                    } }>
                                        Efectos de caja
                                    </div>

                                    <label style={ {
                                        fontSize:
                                            '10px'
                                    } }>
                                        <input
                                            type=
                                                "checkbox"
                                            checked={
                                                leader.gradientEnabled
                                            }
                                            disabled={
                                                leader.boxMode ===
                                                'none'
                                            }
                                            onChange={
                                                event =>
                                                    patchItem(
                                                        leader.id,
                                                        {
                                                            gradientEnabled:
                                                                event.target.checked
                                                        }
                                                    )
                                            }
                                        />
                                        {' '}Degradado
                                    </label>

                                    { leader.gradientEnabled &&
                                      leader.boxMode !==
                                      'none' &&
                                        <input
                                            type=
                                                "color"
                                            className=
                                                "form-control form-control-color"
                                            value={
                                                leader.gradientColor2
                                            }
                                            onChange={
                                                event =>
                                                    patchItem(
                                                        leader.id,
                                                        {
                                                            gradientColor2:
                                                                event.target.value
                                                        }
                                                    )
                                            }
                                        /> }

                                    { leader.gradientEnabled &&
                                      leader.boxMode !==
                                      'none' &&
                                        <label style={ {
                                            gridColumn:
                                                '1 / -1',
                                            fontSize:
                                                '10px'
                                        } }>
                                            Ángulo del degradado:
                                            { ` ${ leader.gradientAngle }°` }

                                            <input
                                                type=
                                                    "range"
                                                min={
                                                    0
                                                }
                                                max={
                                                    360
                                                }
                                                step={
                                                    5
                                                }
                                                value={
                                                    leader.gradientAngle
                                                }
                                                style={ {
                                                    width:
                                                        '100%'
                                                } }
                                                onChange={
                                                    event =>
                                                        patchItem(
                                                            leader.id,
                                                            {
                                                                gradientAngle:
                                                                    Number(
                                                                        event.target.value
                                                                    )
                                                            }
                                                        )
                                                }
                                            />
                                        </label> }

                                    <label style={ {
                                        fontSize:
                                            '10px'
                                    } }>
                                        <input
                                            type=
                                                "checkbox"
                                            checked={
                                                leader.shadowEnabled
                                            }
                                            disabled={
                                                leader.boxMode ===
                                                'none'
                                            }
                                            onChange={
                                                event =>
                                                    patchItem(
                                                        leader.id,
                                                        {
                                                            shadowEnabled:
                                                                event.target.checked
                                                        }
                                                    )
                                            }
                                        />
                                        {' '}Sombra de caja
                                    </label>

                                    { leader.shadowEnabled &&
                                      leader.boxMode !==
                                      'none' &&
                                        <>
                                            <input
                                                type=
                                                    "color"
                                                className=
                                                    "form-control form-control-color"
                                                value={
                                                    leader.shadowColor
                                                }
                                                onChange={
                                                    event =>
                                                        patchItem(
                                                            leader.id,
                                                            {
                                                                shadowColor:
                                                                    event.target.value
                                                            }
                                                        )
                                                }
                                            />

                                            <label style={ {
                                                fontSize:
                                                    '10px'
                                            } }>
                                                Desenfoque:
                                                { ` ${ leader.shadowBlur } px` }

                                                <input
                                                    type=
                                                        "range"
                                                    min={
                                                        0
                                                    }
                                                    max={
                                                        60
                                                    }
                                                    step={
                                                        1
                                                    }
                                                    value={
                                                        leader.shadowBlur
                                                    }
                                                    style={ {
                                                        width:
                                                            '100%'
                                                    } }
                                                    onChange={
                                                        event =>
                                                            patchItem(
                                                                leader.id,
                                                                {
                                                                    shadowBlur:
                                                                        Number(
                                                                            event.target.value
                                                                        )
                                                                }
                                                            )
                                                    }
                                                />
                                            </label>

                                            <label style={ {
                                                fontSize:
                                                    '10px'
                                            } }>
                                                Horizontal:
                                                { ` ${ leader.shadowX } px` }

                                                <input
                                                    type=
                                                        "range"
                                                    min={
                                                        -40
                                                    }
                                                    max={
                                                        40
                                                    }
                                                    step={
                                                        1
                                                    }
                                                    value={
                                                        leader.shadowX
                                                    }
                                                    style={ {
                                                        width:
                                                            '100%'
                                                    } }
                                                    onChange={
                                                        event =>
                                                            patchItem(
                                                                leader.id,
                                                                {
                                                                    shadowX:
                                                                        Number(
                                                                            event.target.value
                                                                        )
                                                                }
                                                            )
                                                    }
                                                />
                                            </label>

                                            <label style={ {
                                                fontSize:
                                                    '10px'
                                            } }>
                                                Vertical:
                                                { ` ${ leader.shadowY } px` }

                                                <input
                                                    type=
                                                        "range"
                                                    min={
                                                        -40
                                                    }
                                                    max={
                                                        40
                                                    }
                                                    step={
                                                        1
                                                    }
                                                    value={
                                                        leader.shadowY
                                                    }
                                                    style={ {
                                                        width:
                                                            '100%'
                                                    } }
                                                    onChange={
                                                        event =>
                                                            patchItem(
                                                                leader.id,
                                                                {
                                                                    shadowY:
                                                                        Number(
                                                                            event.target.value
                                                                        )
                                                                }
                                                            )
                                                    }
                                                />
                                            </label>

                                            <label style={ {
                                                gridColumn:
                                                    '1 / -1',
                                                fontSize:
                                                    '10px'
                                            } }>
                                                Opacidad de sombra:
                                                { ` ${ leader.shadowOpacity }%` }

                                                <input
                                                    type=
                                                        "range"
                                                    min={
                                                        0
                                                    }
                                                    max={
                                                        100
                                                    }
                                                    step={
                                                        5
                                                    }
                                                    value={
                                                        leader.shadowOpacity
                                                    }
                                                    style={ {
                                                        width:
                                                            '100%'
                                                    } }
                                                    onChange={
                                                        event =>
                                                            patchItem(
                                                                leader.id,
                                                                {
                                                                    shadowOpacity:
                                                                        Number(
                                                                            event.target.value
                                                                        )
                                                                }
                                                            )
                                                    }
                                                />
                                            </label>
                                        </> }

                                    <label style={ {
                                        fontSize:
                                            '10px'
                                    } }>
                                        <input
                                            type=
                                                "checkbox"
                                            checked={
                                                !!leader.borderColor
                                            }
                                            disabled={
                                                leader.boxMode ===
                                                'none'
                                            }
                                            onChange={
                                                event =>
                                                    patchItem(
                                                        leader.id,
                                                        {
                                                            borderColor:
                                                                event.target.checked
                                                                    ? design.primaryColor
                                                                    : ''
                                                        }
                                                    )
                                            }
                                        />
                                        {' '}Color de borde propio
                                    </label>

                                    { leader.borderColor &&
                                      leader.boxMode !==
                                      'none' &&
                                        <input
                                            type=
                                                "color"
                                            className=
                                                "form-control form-control-color"
                                            value={
                                                leader.borderColor
                                            }
                                            onChange={
                                                event =>
                                                    patchItem(
                                                        leader.id,
                                                        {
                                                            borderColor:
                                                                event.target.value
                                                        }
                                                    )
                                            }
                                        /> }
                                </div>

                                <div style={ {
                                    marginTop:
                                        '8px'
                                } }>
                                    { selectedGroup.members.map(
                                        member =>
                                            <div
                                                key={
                                                    member.id
                                                }
                                                style={ {
                                                    display:
                                                        'flex',
                                                    gap:
                                                        '6px',
                                                    alignItems:
                                                        'center',
                                                    padding:
                                                        '4px 0'
                                                } }
                                            >
                                                <button
                                                    type=
                                                        "button"
                                                    style={ {
                                                        flex:
                                                            1,
                                                        textAlign:
                                                            'left'
                                                    } }
                                                    onClick={
                                                        () =>
                                                            selectItem(
                                                                member.id
                                                            )
                                                    }
                                                >
                                                    {
                                                        itemName(
                                                            member
                                                        )
                                                    }
                                                </button>

                                                <button
                                                    type=
                                                        "button"
                                                    onClick={
                                                        () =>
                                                            removeFromMerge(
                                                                selectedGroup.id,
                                                                member.id
                                                            )
                                                    }
                                                >
                                                    Sacar
                                                </button>
                                            </div>
                                    ) }
                                </div>

                                <div style={ {
                                    display:
                                        'flex',
                                    gap:
                                        '6px',
                                    marginTop:
                                        '7px'
                                } }>
                                    <select
                                        className=
                                            "form-select form-select-sm"
                                        value={
                                            mergeTargetId
                                        }
                                        onChange={
                                            event =>
                                                setMergeTargetId(
                                                    event.target.value
                                                )
                                        }
                                    >
                                        <option value="">
                                            Añadir otro bloque...
                                        </option>

                                        { groupCandidates.map(
                                            candidate =>
                                                <option
                                                    key={
                                                        candidate.id
                                                    }
                                                    value={
                                                        candidate.id
                                                    }
                                                >
                                                    {
                                                        itemName(
                                                            candidate
                                                        )
                                                    }
                                                </option>
                                        ) }
                                    </select>

                                    <Button
                                        disabled={
                                            !mergeTargetId
                                        }
                                        onClick={
                                            () =>
                                                addToMerge(
                                                    selectedGroup.id,
                                                    mergeTargetId
                                                )
                                        }
                                    >
                                        Añadir
                                    </Button>
                                </div>

                                <Button
                                    variant=
                                        "secondary"
                                    onClick={
                                        () =>
                                            dissolveMerge(
                                                selectedGroup.id
                                            )
                                    }
                                >
                                    Deshacer fusión
                                </Button>
                            </div> }

                        { !selectedGroup &&
                          selected.kind !==
                          'section' &&
                            <div style={ {
                                marginTop:
                                    '10px',
                                paddingTop:
                                    '10px',
                                borderTop:
                                    '1px solid rgba(0,0,0,.13)'
                            } }>
                                <strong style={ {
                                    fontSize:
                                        '11px'
                                } }>
                                    Fusionar cajas
                                </strong>

                                <div style={ {
                                    display:
                                        'flex',
                                    gap:
                                        '6px',
                                    marginTop:
                                        '6px'
                                } }>
                                    <select
                                        className=
                                            "form-select form-select-sm"
                                        value={
                                            mergeTargetId
                                        }
                                        onChange={
                                            event =>
                                                setMergeTargetId(
                                                    event.target.value
                                                )
                                        }
                                    >
                                        <option value="">
                                            Elige otro bloque...
                                        </option>

                                        { ungroupedCandidates.map(
                                            candidate =>
                                                <option
                                                    key={
                                                        candidate.id
                                                    }
                                                    value={
                                                        candidate.id
                                                    }
                                                >
                                                    {
                                                        itemName(
                                                            candidate
                                                        )
                                                    }
                                                </option>
                                        ) }
                                    </select>

                                    <Button
                                        disabled={
                                            !mergeTargetId
                                        }
                                        onClick={
                                            () =>
                                                createMerge(
                                                    selected.id,
                                                    mergeTargetId
                                                )
                                        }
                                    >
                                        Fusionar
                                    </Button>
                                </div>
                            </div> }
                    </div>
                </div>,
                document.body
            )
            : null;

    const seenGroups =
        new Set<string>();

    return (
        <>
            { inspector }

            <div style={ {
                display:
                    'flex',
                flexDirection:
                    'column',
                gap:
                    '12px'
            } }>
                <div style={ {
                    display:
                        'grid',
                    gridTemplateColumns:
                        '1fr 1fr',
                    gap:
                        '9px',
                    padding:
                        '11px',
                    border:
                        '1px solid rgba(0,0,0,.18)',
                    borderRadius:
                        '7px',
                    background:
                        '#fff',
                    color:
                        '#222'
                } }>
                    <label>
                        <div style={ {
                            fontSize:
                                '10px',
                            fontWeight:
                                800
                        } }>
                            Color de fondo
                        </div>

                        <input
                            type=
                                "color"
                            className=
                                "form-control form-control-color"
                            value={
                                design.backgroundColor
                            }
                            onChange={
                                event =>
                                    props.onChange({
                                        ...design,
                                        backgroundColor:
                                            event.target.value
                                    })
                            }
                        />
                    </label>

                    <label>
                        <div style={ {
                            fontSize:
                                '10px',
                            fontWeight:
                                800
                        } }>
                            Color principal
                        </div>

                        <input
                            type=
                                "color"
                            className=
                                "form-control form-control-color"
                            value={
                                design.primaryColor
                            }
                            onChange={
                                event =>
                                    props.onChange({
                                        ...design,
                                        primaryColor:
                                            event.target.value
                                    })
                            }
                        />
                    </label>

                    <label>
                        <div style={ {
                            fontSize:
                                '10px',
                            fontWeight:
                                800
                        } }>
                            Texto
                        </div>

                        <input
                            type=
                                "color"
                            className=
                                "form-control form-control-color"
                            value={
                                design.textColor
                            }
                            onChange={
                                event =>
                                    props.onChange({
                                        ...design,
                                        textColor:
                                            event.target.value
                                    })
                            }
                        />
                    </label>

                    <label>
                        <div style={ {
                            fontSize:
                                '10px',
                            fontWeight:
                                800
                        } }>
                            Cajas
                        </div>

                        <input
                            type=
                                "color"
                            className=
                                "form-control form-control-color"
                            value={
                                design.panelColor
                            }
                            onChange={
                                event =>
                                    props.onChange({
                                        ...design,
                                        panelColor:
                                            event.target.value
                                    })
                            }
                        />
                    </label>

                    <label style={ {
                        gridColumn:
                            '1 / -1'
                    } }>
                        <div style={ {
                            fontSize:
                                '10px',
                            fontWeight:
                                800
                        } }>
                            Imagen de fondo
                        </div>

                        <input
                            className=
                                "form-control"
                            placeholder=
                                "https://..."
                            value={
                                design.backgroundImageUrl
                            }
                            onChange={
                                event =>
                                    props.onChange({
                                        ...design,
                                        backgroundImageUrl:
                                            event.target.value
                                    })
                            }
                        />
                    </label>

                    <label>
                        <div style={ {
                            fontSize:
                                '10px',
                            fontWeight:
                                800
                        } }>
                            Ajuste del fondo
                        </div>

                        <select
                            className=
                                "form-select"
                            value={
                                advanced.backgroundSize
                            }
                            onChange={
                                event =>
                                    patchAdvanced({
                                        backgroundSize:
                                            event.target.value as any
                                    })
                            }
                        >
                            <option value="cover">
                                Cubrir
                            </option>
                            <option value="contain">
                                Imagen completa
                            </option>
                            <option value="auto">
                                Tamaño original
                            </option>
                        </select>
                    </label>

                    <label>
                        <div style={ {
                            fontSize:
                                '10px',
                            fontWeight:
                                800
                        } }>
                            Posición del fondo
                        </div>

                        <select
                            className=
                                "form-select"
                            value={
                                advanced.backgroundPosition
                            }
                            onChange={
                                event =>
                                    patchAdvanced({
                                        backgroundPosition:
                                            event.target.value as any
                                    })
                            }
                        >
                            <option value="center">
                                Centro
                            </option>
                            <option value="left">
                                Izquierda
                            </option>
                            <option value="right">
                                Derecha
                            </option>
                            <option value="top">
                                Arriba
                            </option>
                            <option value="bottom">
                                Abajo
                            </option>
                        </select>
                    </label>

                    <label style={ {
                        display:
                            'flex',
                        alignItems:
                            'center',
                        gap:
                            '6px',
                        fontSize:
                            '10px'
                    } }>
                        <input
                            type=
                                "checkbox"
                            checked={
                                advanced.backgroundRepeat
                            }
                            onChange={
                                event =>
                                    patchAdvanced({
                                        backgroundRepeat:
                                            event.target.checked
                                    })
                            }
                        />
                        Repetir fondo
                    </label>

                    <label style={ {
                        gridColumn:
                            '1 / -1'
                    } }>
                        <div style={ {
                            fontSize:
                                '10px',
                            fontWeight:
                                800
                        } }>
                            Banner
                        </div>

                        <input
                            className=
                                "form-control"
                            placeholder=
                                "https://..."
                            value={
                                design.bannerImageUrl
                            }
                            onChange={
                                event =>
                                    props.onChange({
                                        ...design,
                                        bannerImageUrl:
                                            event.target.value
                                    })
                            }
                        />
                    </label>

                    <label>
                        <div style={ {
                            fontSize:
                                '10px',
                            fontWeight:
                                800
                        } }>
                            Posición banner
                        </div>

                        <select
                            className=
                                "form-select"
                            value={
                                advanced.bannerPosition
                            }
                            onChange={
                                event =>
                                    patchAdvanced({
                                        bannerPosition:
                                            event.target.value as any
                                    })
                            }
                        >
                            <option value="center">
                                Centro
                            </option>
                            <option value="left">
                                Izquierda
                            </option>
                            <option value="right">
                                Derecha
                            </option>
                            <option value="top">
                                Arriba
                            </option>
                            <option value="bottom">
                                Abajo
                            </option>
                        </select>
                    </label>

                    <label style={ {
                        display:
                            'flex',
                        alignItems:
                            'center',
                        gap:
                            '6px',
                        fontSize:
                            '10px'
                    } }>
                        <input
                            type=
                                "checkbox"
                            checked={
                                advanced.showHeaderText
                            }
                            onChange={
                                event =>
                                    patchAdvanced({
                                        showHeaderText:
                                            event.target.checked
                                    })
                            }
                        />
                        Nombre sobre banner
                    </label>

                    <label>
                        <div style={ {
                            fontSize:
                                '10px',
                            fontWeight:
                                800
                        } }>
                            Altura banner:
                            { ` ${ design.bannerHeight } px` }
                        </div>

                        <input
                            type=
                                "range"
                            min={
                                80
                            }
                            max={
                                450
                            }
                            step={
                                10
                            }
                            value={
                                design.bannerHeight
                            }
                            style={ {
                                width:
                                    '100%'
                            } }
                            onChange={
                                event =>
                                    props.onChange({
                                        ...design,
                                        bannerHeight:
                                            Number(
                                                event.target.value
                                            )
                                    })
                            }
                        />
                    </label>

                    <label>
                        <div style={ {
                            fontSize:
                                '10px',
                            fontWeight:
                                800
                        } }>
                            Ancho ficha:
                            { ` ${ design.contentWidth } px` }
                        </div>

                        <input
                            type=
                                "range"
                            min={
                                520
                            }
                            max={
                                1100
                            }
                            step={
                                20
                            }
                            value={
                                design.contentWidth
                            }
                            style={ {
                                width:
                                    '100%'
                            } }
                            onChange={
                                event =>
                                    props.onChange({
                                        ...design,
                                        contentWidth:
                                            Number(
                                                event.target.value
                                            )
                                    })
                            }
                        />
                    </label>

                    <label>
                        <div style={ {
                            fontSize:
                                '10px',
                            fontWeight:
                                800
                        } }>
                            Transparencia:
                            { ` ${ design.panelOpacity }%` }
                        </div>

                        <input
                            type=
                                "range"
                            min={
                                20
                            }
                            max={
                                100
                            }
                            step={
                                5
                            }
                            value={
                                design.panelOpacity
                            }
                            style={ {
                                width:
                                    '100%'
                            } }
                            onChange={
                                event =>
                                    props.onChange({
                                        ...design,
                                        panelOpacity:
                                            Number(
                                                event.target.value
                                            )
                                    })
                            }
                        />
                    </label>

                    <label>
                        <div style={ {
                            fontSize:
                                '10px',
                            fontWeight:
                                800
                        } }>
                            Esquinas:
                            { ` ${ design.borderRadius } px` }
                        </div>

                        <input
                            type=
                                "range"
                            min={
                                0
                            }
                            max={
                                24
                            }
                            step={
                                1
                            }
                            value={
                                design.borderRadius
                            }
                            style={ {
                                width:
                                    '100%'
                            } }
                            onChange={
                                event =>
                                    props.onChange({
                                        ...design,
                                        borderRadius:
                                            Number(
                                                event.target.value
                                            )
                                    })
                            }
                        />
                    </label>

                    <div style={ {
                        gridColumn:
                            '1 / -1',
                        borderTop:
                            '1px solid rgba(0,0,0,.12)',
                        paddingTop:
                            '9px'
                    } }>
                        <div style={ {
                            fontSize:
                                '10px',
                            fontWeight:
                                900,
                            display:
                                'flex',
                            alignItems:
                                'center',
                            gap:
                                '5px',
                            marginBottom:
                                '5px'
                        } }>
                            <FaMusic />
                            Música
                        </div>

                        <input
                            className=
                                "form-control"
                            placeholder=
                                "YouTube o URL directa de audio"
                            value={
                                advanced.musicUrl
                            }
                            onChange={
                                event =>
                                    patchAdvanced({
                                        musicUrl:
                                            event.target.value
                                                .slice(
                                                    0,
                                                    1000
                                                )
                                    })
                            }
                        />

                        <div style={ {
                            display:
                                'flex',
                            gap:
                                '10px',
                            alignItems:
                                'center',
                            marginTop:
                                '5px'
                        } }>
                            <label style={ {
                                flex:
                                    1,
                                fontSize:
                                    '9px'
                            } }>
                                Volumen
                                { ` ${ advanced.musicVolume }%` }

                                <input
                                    type=
                                        "range"
                                    min={
                                        0
                                    }
                                    max={
                                        100
                                    }
                                    step={
                                        5
                                    }
                                    value={
                                        advanced.musicVolume
                                    }
                                    style={ {
                                        width:
                                            '100%'
                                    } }
                                    onChange={
                                        event =>
                                            patchAdvanced({
                                                musicVolume:
                                                    Number(
                                                        event.target.value
                                                    )
                                            })
                                    }
                                />
                            </label>

                            <label style={ {
                                fontSize:
                                    '9px'
                            } }>
                                <input
                                    type=
                                        "checkbox"
                                    checked={
                                        advanced.musicLoop
                                    }
                                    onChange={
                                        event =>
                                            patchAdvanced({
                                                musicLoop:
                                                    event.target.checked
                                            })
                                    }
                                />
                                {' '}Repetir
                            </label>
                        </div>
                    </div>

                    <div style={ {
                        gridColumn:
                            '1 / -1',
                        borderTop:
                            '1px solid rgba(0,0,0,.12)',
                        paddingTop:
                            '9px'
                    } }>
                        <div style={ {
                            fontSize:
                                '10px',
                            fontWeight:
                                900,
                            marginBottom:
                                '5px'
                        } }>
                            Overlay decorativo
                        </div>

                        <input
                            className=
                                "form-control"
                            placeholder=
                                "Imagen PNG/WebP transparente para superponer"
                            value={
                                advanced.overlayImageUrl
                            }
                            onChange={
                                event =>
                                    patchAdvanced({
                                        overlayImageUrl:
                                            event.target.value
                                                .slice(
                                                    0,
                                                    1000
                                                )
                                    })
                            }
                        />

                        { advanced.overlayImageUrl &&
                            <div style={ {
                                display:
                                    'grid',
                                gridTemplateColumns:
                                    '1fr 1fr',
                                gap:
                                    '7px',
                                marginTop:
                                    '7px'
                            } }>
                                <label style={ {
                                    fontSize:
                                        '9px'
                                } }>
                                    Opacidad:
                                    { ` ${ advanced.overlayOpacity }%` }

                                    <input
                                        type=
                                            "range"
                                        min={
                                            0
                                        }
                                        max={
                                            100
                                        }
                                        step={
                                            5
                                        }
                                        value={
                                            advanced.overlayOpacity
                                        }
                                        style={ {
                                            width:
                                                '100%'
                                        } }
                                        onChange={
                                            event =>
                                                patchAdvanced({
                                                    overlayOpacity:
                                                        Number(
                                                            event.target.value
                                                        )
                                                })
                                        }
                                    />
                                </label>

                                <select
                                    className=
                                        "form-select form-select-sm"
                                    value={
                                        advanced.overlaySize
                                    }
                                    onChange={
                                        event =>
                                            patchAdvanced({
                                                overlaySize:
                                                    event.target.value as any
                                            })
                                    }
                                >
                                    <option value="cover">
                                        Cubrir
                                    </option>
                                    <option value="contain">
                                        Imagen completa
                                    </option>
                                    <option value="auto">
                                        Tamaño original
                                    </option>
                                </select>

                                <select
                                    className=
                                        "form-select form-select-sm"
                                    value={
                                        advanced.overlayPosition
                                    }
                                    onChange={
                                        event =>
                                            patchAdvanced({
                                                overlayPosition:
                                                    event.target.value as any
                                            })
                                    }
                                >
                                    <option value="center">
                                        Centro
                                    </option>
                                    <option value="left">
                                        Izquierda
                                    </option>
                                    <option value="right">
                                        Derecha
                                    </option>
                                    <option value="top">
                                        Arriba
                                    </option>
                                    <option value="bottom">
                                        Abajo
                                    </option>
                                </select>

                                <select
                                    className=
                                        "form-select form-select-sm"
                                    value={
                                        advanced.overlayBlendMode
                                    }
                                    onChange={
                                        event =>
                                            patchAdvanced({
                                                overlayBlendMode:
                                                    event.target.value as any
                                            })
                                    }
                                >
                                    <option value="normal">
                                        Fusión normal
                                    </option>
                                    <option value="multiply">
                                        Multiplicar
                                    </option>
                                    <option value="screen">
                                        Aclarar
                                    </option>
                                    <option value="overlay">
                                        Superponer
                                    </option>
                                    <option value="soft-light">
                                        Luz suave
                                    </option>
                                </select>
                            </div> }

                        <div style={ {
                            marginTop:
                                '5px',
                            fontSize:
                                '9px',
                            opacity:
                                0.58
                        } }>
                            Útil para marcos completos, partículas, texturas o adornos transparentes sobre toda la ficha.
                        </div>
                    </div>
                </div>

                <div style={ {
                    padding:
                        '10px',
                    border:
                        '1px solid rgba(0,0,0,.18)',
                    borderRadius:
                        '7px',
                    background:
                        '#fff',
                    color:
                        '#222'
                } }>
                    <strong style={ {
                        fontSize:
                            '11px'
                    } }>
                        Añadir decoración
                    </strong>

                    <div style={ {
                        display:
                            'flex',
                        gap:
                            '6px',
                        flexWrap:
                            'wrap',
                        marginTop:
                            '7px'
                    } }>
                        <Button
                            onClick={
                                () =>
                                    addCustom(
                                        'text'
                                    )
                            }
                        >
                            <FaPlus className="me-1" />
                            Texto
                        </Button>

                        <Button
                            onClick={
                                () =>
                                    addCustom(
                                        'image'
                                    )
                            }
                        >
                            <FaImage className="me-1" />
                            Imagen
                        </Button>

                        <Button
                            onClick={
                                () =>
                                    addCustom(
                                        'divider'
                                    )
                            }
                        >
                            <FaMinus className="me-1" />
                            Separador
                        </Button>

                        <Button
                            onClick={
                                () =>
                                    addCustom(
                                        'spacer'
                                    )
                            }
                        >
                            Espacio
                        </Button>
                    </div>
                </div>

                <div style={ {
                    padding:
                        '8px 10px',
                    borderRadius:
                        '6px',
                    background:
                        'rgba(0,0,0,.05)',
                    color:
                        '#222',
                    fontSize:
                        '10px'
                } }>
                    Haz clic en un bloque para abrir su ventana de diseño. Puedes moverla por la pantalla sin desplazar el canvas.
                </div>

                <div
                    className="rpg-sheet-sheet-root"
                    style={ {
                    position:
                        'relative',
                    width:
                        '100%',
                    maxWidth:
                        `${ design.contentWidth }px`,
                    margin:
                        '0 auto',
                    padding:
                        '12px',
                    borderRadius:
                        `${ design.borderRadius }px`,
                    color:
                        design.textColor,
                    backgroundColor:
                        design.backgroundColor,
                    backgroundImage:
                        design.backgroundImageUrl
                            ? `url("${ design.backgroundImageUrl }")`
                            : undefined,
                    backgroundSize:
                        advanced.backgroundSize,
                    backgroundPosition:
                        advanced.backgroundPosition,
                    backgroundRepeat:
                        advanced.backgroundRepeat
                            ? 'repeat'
                            : 'no-repeat',
                    boxSizing:
                        'border-box'
                } }>
                    <HiddenScrollbarCss />

                    <div style={ {
                        position:
                            'relative',
                        overflow:
                            'hidden',
                        borderRadius:
                            `${ design.borderRadius }px`,
                        minHeight:
                            design.bannerImageUrl
                                ? `${ design.bannerHeight }px`
                                : '74px',
                        marginBottom:
                            '10px',
                        background:
                            design.bannerImageUrl
                                ? `linear-gradient(to top, rgba(0,0,0,.72), rgba(0,0,0,.08)), url("${ design.bannerImageUrl }") ${ advanced.bannerPosition } / cover`
                                : design.secondaryColor
                    } }>
                        { advanced.showHeaderText &&
                            <div style={ {
                                position:
                                    'absolute',
                                left:
                                    '14px',
                                right:
                                    '14px',
                                bottom:
                                    '12px'
                            } }>
                                <div style={ {
                                    fontSize:
                                        '22px',
                                    fontWeight:
                                        900
                                } }>
                                    { props.username }
                                </div>

                                <div style={ {
                                    fontSize:
                                        '11px',
                                    opacity:
                                        0.75
                                } }>
                                    { props.rpgName }
                                </div>
                            </div> }
                    </div>

                    <div
                        ref={
                            gridRef
                        }
                        style={ {
                            display:
                                'grid',
                            gridTemplateColumns:
                                'repeat(12, minmax(0, 1fr))',
                            gridAutoRows:
                                `${ MASONRY_ROW }px`,
                            gridAutoFlow:
                                'dense',
                            columnGap:
                                `${ GRID_GAP }px`,
                            rowGap:
                                `${ MASONRY_ROW_GAP }px`,
                            alignItems:
                                'start'
                        } }
                    >

                        { advanced.items.map(
                            item =>
                        {
                            if(item.mergeGroup)
                            {
                                if(
                                    seenGroups.has(
                                        item.mergeGroup
                                    )
                                )
                                    return null;

                                const members =
                                    groupMembers(
                                        item.mergeGroup
                                    );

                                const groupLead =
                                    members[0];

                                if(!groupLead)
                                    return null;

                                seenGroups.add(
                                    item.mergeGroup
                                );

                                const entryKey =
                                    `group:${ item.mergeGroup }`;

                                const selectedNow =
                                    members.some(
                                        member =>
                                            member.id ===
                                            selectedId
                                    );

                                return (
                                    <MasonryCell
                                        key={
                                            entryKey
                                        }
                                        span={
                                            groupLead.widthSpan
                                        }
                                        style={ {
                                            position:
                                                'relative',
                                            outline:
                                                selectedNow
                                                    ? `2px solid ${ design.primaryColor }`
                                                    : undefined,
                                            outlineOffset:
                                                selectedNow
                                                    ? '2px'
                                                    : undefined
                                        } }
                                    >
                                        <div
                                            onClick={
                                                () =>
                                                    selectItem(
                                                        groupLead.id
                                                    )
                                            }
                                            onDragOver={
                                                event =>
                                                    event
                                                        .preventDefault()
                                            }
                                            onDrop={
                                                event =>
                                                {
                                                    event
                                                        .preventDefault();

                                                    if(
                                                        dragKey.current
                                                    )
                                                    {
                                                        reorderEntry(
                                                            dragKey.current,
                                                            entryKey
                                                        );
                                                    }
                                                }
                                            }
                                            style={ {
                                                position:
                                                    'relative',
                                                minWidth:
                                                    0
                                            } }
                                        >
                                            <div
                                                data-rpg-preview-body="1"
                                                style={ {
                                                    display:
                                                        'flex',
                                                    justifyContent:
                                                        justify(
                                                            groupLead.alignment
                                                        ),
                                                    width:
                                                        '100%'
                                                } }
                                            >
                                                <div style={ {
                                                    ...presentationBoxStyle(
                                                        design,
                                                        groupLead,
                                                        false
                                                    ),
                                                    height:
                                                        undefined,
                                                    minHeight:
                                                        groupLead.height > 0
                                                            ? `${ groupLead.height }px`
                                                            : undefined,
                                                    overflow:
                                                        'visible'
                                                } }>
                                                    <div style={ {
                                                        display:
                                                            groupLead.mergeLayout ===
                                                            'row'
                                                                ? 'flex'
                                                                : 'grid',
                                                        gridTemplateColumns:
                                                            groupLead.mergeLayout ===
                                                            'column'
                                                                ? '1fr'
                                                                : undefined,
                                                        gap:
                                                            `${ groupLead.mergeGap }px`,
                                                        alignItems:
                                                            'start'
                                                    } }>
                                                        { members.map(
                                                            member =>
                                                                <div
                                                                    key={
                                                                        member.id
                                                                    }
                                                                    onClick={
                                                                        event =>
                                                                        {
                                                                            event
                                                                                .stopPropagation();

                                                                            selectItem(
                                                                                member.id
                                                                            );
                                                                        }
                                                                    }
                                                                    style={ {
                                                                        flex:
                                                                            groupLead.mergeLayout ===
                                                                            'row'
                                                                                ? 1
                                                                                : undefined,
                                                                        minWidth:
                                                                            0,
                                                                        cursor:
                                                                            'pointer',
                                                                        outline:
                                                                            member.id ===
                                                                            selectedId
                                                                                ? `1px dashed ${ design.primaryColor }`
                                                                                : undefined,
                                                                        outlineOffset:
                                                                            '2px'
                                                                    } }
                                                                >
                                                                    { renderBare(
                                                                        member,
                                                                        true
                                                                    ) }
                                                                </div>
                                                        ) }
                                                    </div>
                                                </div>
                                            </div>

                                            <div
                                                draggable
                                                onDragStart={
                                                    event =>
                                                    {
                                                        dragKey.current =
                                                            entryKey;

                                                        event
                                                            .dataTransfer
                                                            .effectAllowed =
                                                                'move';
                                                    }
                                                }
                                                onDragEnd={
                                                    () =>
                                                        dragKey.current =
                                                            null
                                                }
                                                style={ {
                                                    position:
                                                        'absolute',
                                                    top:
                                                        '3px',
                                                    left:
                                                        '3px',
                                                    height:
                                                        '21px',
                                                    display:
                                                        'flex',
                                                    alignItems:
                                                        'center',
                                                    gap:
                                                        '5px',
                                                    padding:
                                                        '0 6px',
                                                    borderRadius:
                                                        '4px',
                                                    background:
                                                        'rgba(0,0,0,.62)',
                                                    color:
                                                        '#fff',
                                                    cursor:
                                                        'grab',
                                                    zIndex:
                                                        3
                                                } }
                                            >
                                                <FaGripVertical />

                                                <span style={ {
                                                    fontSize:
                                                        '9px',
                                                    fontWeight:
                                                        800
                                                } }>
                                                    Caja fusionada
                                                </span>
                                            </div>

                                            <div
                                                title=
                                                    "Redimensionar ancho"
                                                onMouseDown={
                                                    event =>
                                                        startResize(
                                                            event,
                                                            groupLead,
                                                            'width'
                                                        )
                                                }
                                                style={ {
                                                    position:
                                                        'absolute',
                                                    top:
                                                        '28px',
                                                    right:
                                                        0,
                                                    bottom:
                                                        '9px',
                                                    width:
                                                        '8px',
                                                    cursor:
                                                        'ew-resize',
                                                    zIndex:
                                                        4
                                                } }
                                            >
                                                <FaArrowsAltH style={ {
                                                    fontSize:
                                                        '8px',
                                                    opacity:
                                                        0.75
                                                } } />
                                            </div>

                                            <div
                                                title=
                                                    "Redimensionar altura"
                                                onMouseDown={
                                                    event =>
                                                        startResize(
                                                            event,
                                                            groupLead,
                                                            'height'
                                                        )
                                                }
                                                style={ {
                                                    position:
                                                        'absolute',
                                                    left:
                                                        '9px',
                                                    right:
                                                        '9px',
                                                    bottom:
                                                        0,
                                                    height:
                                                        '8px',
                                                    cursor:
                                                        'ns-resize',
                                                    zIndex:
                                                        4
                                                } }
                                            >
                                                <FaArrowsAltV style={ {
                                                    display:
                                                        'block',
                                                    margin:
                                                        '0 auto',
                                                    fontSize:
                                                        '8px',
                                                    opacity:
                                                        0.75
                                                } } />
                                            </div>
                                        </div>
                                    </MasonryCell>
                                );
                            }

                            const entryKey =
                                `item:${ item.id }`;

                            const selectedNow =
                                item.id ===
                                selectedId;

                            return (
                                <MasonryCell
                                    key={
                                        item.id
                                    }
                                    span={
                                        item.kind ===
                                        'section'
                                            ? 12
                                            : item.widthSpan
                                    }
                                    style={ {
                                        position:
                                            'relative',
                                        outline:
                                            selectedNow
                                                ? `2px solid ${ design.primaryColor }`
                                                : undefined,
                                        outlineOffset:
                                            selectedNow
                                                ? '2px'
                                                : undefined
                                    } }
                                >
                                    <div
                                        onClick={
                                            () =>
                                                selectItem(
                                                    item.id
                                                )
                                        }
                                        onDragOver={
                                            event =>
                                                event
                                                    .preventDefault()
                                        }
                                        onDrop={
                                            event =>
                                            {
                                                event
                                                    .preventDefault();

                                                if(
                                                    dragKey.current
                                                )
                                                {
                                                    reorderEntry(
                                                        dragKey.current,
                                                        entryKey
                                                    );
                                                }
                                            }
                                        }
                                        style={ {
                                            position:
                                                'relative',
                                            minWidth:
                                                0
                                        } }
                                    >
                                        { renderStandalone(
                                            item
                                        ) }

                                        <div
                                            draggable
                                            onDragStart={
                                                event =>
                                                {
                                                    dragKey.current =
                                                        entryKey;

                                                    event
                                                        .dataTransfer
                                                        .effectAllowed =
                                                            'move';
                                                }
                                            }
                                            onDragEnd={
                                                () =>
                                                    dragKey.current =
                                                        null
                                            }
                                            style={ {
                                                position:
                                                    'absolute',
                                                top:
                                                    '3px',
                                                left:
                                                    '3px',
                                                height:
                                                    '21px',
                                                display:
                                                    'flex',
                                                alignItems:
                                                    'center',
                                                gap:
                                                    '5px',
                                                padding:
                                                    '0 6px',
                                                borderRadius:
                                                    '4px',
                                                background:
                                                    'rgba(0,0,0,.62)',
                                                color:
                                                    '#fff',
                                                cursor:
                                                    'grab',
                                                zIndex:
                                                    3
                                            } }
                                        >
                                            <FaGripVertical />

                                            <span style={ {
                                                fontSize:
                                                    '9px',
                                                fontWeight:
                                                    800
                                            } }>
                                                {
                                                    itemName(
                                                        item
                                                    )
                                                }
                                            </span>
                                        </div>

                                        { item.kind !==
                                          'section' &&
                                            <>
                                                <div
                                                    title=
                                                        "Redimensionar ancho"
                                                    onMouseDown={
                                                        event =>
                                                            startResize(
                                                                event,
                                                                item,
                                                                'width'
                                                            )
                                                    }
                                                    style={ {
                                                        position:
                                                            'absolute',
                                                        top:
                                                            '28px',
                                                        right:
                                                            0,
                                                        bottom:
                                                            '9px',
                                                        width:
                                                            '8px',
                                                        cursor:
                                                            'ew-resize',
                                                        zIndex:
                                                            4
                                                    } }
                                                >
                                                    <FaArrowsAltH style={ {
                                                        fontSize:
                                                            '8px',
                                                        opacity:
                                                            0.75
                                                    } } />
                                                </div>

                                                <div
                                                    title=
                                                        "Redimensionar altura"
                                                    onMouseDown={
                                                        event =>
                                                            startResize(
                                                                event,
                                                                item,
                                                                'height'
                                                            )
                                                    }
                                                    style={ {
                                                        position:
                                                            'absolute',
                                                        left:
                                                            '9px',
                                                        right:
                                                            '9px',
                                                        bottom:
                                                            0,
                                                        height:
                                                            '8px',
                                                        cursor:
                                                            'ns-resize',
                                                        zIndex:
                                                            4
                                                    } }
                                                >
                                                    <FaArrowsAltV style={ {
                                                        display:
                                                            'block',
                                                        margin:
                                                            '0 auto',
                                                        fontSize:
                                                            '8px',
                                                        opacity:
                                                            0.75
                                                    } } />
                                                </div>
                                            </> }
                                    </div>
                                </MasonryCell>
                            );
                        }) }
                    </div>

                    <SheetOverlay
                        advanced={
                            advanced
                        }
                        editor
                    />
                </div>

                <div style={ {
                    display:
                        'flex',
                    justifyContent:
                        'space-between',
                    gap:
                        '7px'
                } }>
                    <Button
                        variant=
                            "secondary"
                        onClick={
                            reset
                        }
                    >
                        <FaUndo className="me-1" />
                        Restablecer
                    </Button>

                    <div style={ {
                        display:
                            'flex',
                        gap:
                            '7px'
                    } }>
                        <Button
                            variant=
                                "secondary"
                            onClick={
                                props.onCancel
                            }
                        >
                            Cancelar
                        </Button>

                        <Button
                            onClick={
                                props.onSave
                            }
                        >
                            <FaSave className="me-1" />
                            Guardar diseño
                        </Button>
                    </div>
                </div>
            </div>
        </>
    );
};
