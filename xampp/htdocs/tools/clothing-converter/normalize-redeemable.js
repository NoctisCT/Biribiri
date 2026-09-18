#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

function fail(message)
{
    throw new Error(message);
}

function sha256(buffer)
{
    return crypto
        .createHash('sha256')
        .update(buffer)
        .digest('hex');
}

function inflateAuto(buffer)
{
    const attempts = [
        () => zlib.inflateSync(buffer),
        () => zlib.gunzipSync(buffer),
        () => zlib.unzipSync(buffer),
        () => zlib.inflateRawSync(buffer)
    ];

    const errors = [];

    for(const attempt of attempts)
    {
        try
        {
            return attempt();
        }
        catch(error)
        {
            errors.push(error.message);
        }
    }

    fail(
        'No se pudo descomprimir entrada Nitro: ' +
        errors.join(' | ')
    );
}

function parseBundle(filePath)
{
    const data = fs.readFileSync(filePath);
    let offset = 0;

    if(data.length < 2)
    {
        fail('Nitro vacío: ' + filePath);
    }

    const count = data.readUInt16BE(offset);
    offset += 2;

    const entries = [];

    for(let index = 0; index < count; index++)
    {
        if(offset + 2 > data.length)
        {
            fail('Nitro truncado en nombre.');
        }

        const nameLength =
            data.readUInt16BE(offset);

        offset += 2;

        if(offset + nameLength > data.length)
        {
            fail('Nitro truncado en nombre.');
        }

        const name =
            data
                .subarray(
                    offset,
                    offset + nameLength
                )
                .toString('utf8');

        offset += nameLength;

        if(offset + 4 > data.length)
        {
            fail('Nitro truncado en longitud.');
        }

        const compressedLength =
            data.readUInt32BE(offset);

        offset += 4;

        if(
            offset + compressedLength >
            data.length
        )
        {
            fail('Nitro truncado en payload.');
        }

        const compressed =
            data.subarray(
                offset,
                offset + compressedLength
            );

        offset += compressedLength;

        entries.push({
            name,
            raw: inflateAuto(
                compressed
            )
        });
    }

    if(offset !== data.length)
    {
        fail(
            'Nitro con trailing bytes: ' +
            (data.length - offset)
        );
    }

    return {
        data,
        entries
    };
}

function buildBundle(entries)
{
    const chunks = [];

    const header =
        Buffer.allocUnsafe(2);

    header.writeUInt16BE(
        entries.length,
        0
    );

    chunks.push(header);

    for(const entry of entries)
    {
        const name =
            Buffer.from(
                entry.name,
                'utf8'
            );

        const compressed =
            zlib.deflateSync(
                entry.raw,
                {
                    level: 9
                }
            );

        const nameLength =
            Buffer.allocUnsafe(2);

        nameLength.writeUInt16BE(
            name.length,
            0
        );

        const dataLength =
            Buffer.allocUnsafe(4);

        dataLength.writeUInt32BE(
            compressed.length,
            0
        );

        chunks.push(
            nameLength,
            name,
            dataLength,
            compressed
        );
    }

    return Buffer.concat(
        chunks
    );
}

function getJsonAndPng(entries)
{
    const jsonEntries =
        entries.filter(
            entry =>
                entry.name
                    .toLowerCase()
                    .endsWith('.json')
        );

    const pngEntries =
        entries.filter(
            entry =>
                entry.name
                    .toLowerCase()
                    .endsWith('.png')
        );

    if(
        jsonEntries.length !== 1 ||
        pngEntries.length !== 1
    )
    {
        fail(
            'Se esperaba 1 JSON + 1 PNG. JSON=' +
            jsonEntries.length +
            ' PNG=' +
            pngEntries.length
        );
    }

    return {
        json: jsonEntries[0],
        png: pngEntries[0]
    };
}

function renameBase(node, oldName, newName)
{
    if(Array.isArray(node))
    {
        return node.map(
            value =>
                renameBase(
                    value,
                    oldName,
                    newName
                )
        );
    }

    if(
        node !== null &&
        typeof node === 'object'
    )
    {
        const output = {};

        for(
            const [key, value]
            of Object.entries(node)
        )
        {
            output[
                key.replaceAll(
                    oldName,
                    newName
                )
            ] = renameBase(
                value,
                oldName,
                newName
            );
        }

        return output;
    }

    if(typeof node === 'string')
    {
        return node.replaceAll(
            oldName,
            newName
        );
    }

    return node;
}

function assetDirections(json)
{
    const result = new Set();

    for(
        const key of Object.keys(
            json.assets || {}
        )
    )
    {
        const match =
            key.match(
                /_a_(\d+)_\d+(?:$|_)/
            );

        if(match)
        {
            result.add(
                Number(match[1])
            );
        }
    }

    return [...result]
        .sort(
            (a, b) => a - b
        );
}

function visualizationDirections(json)
{
    const result = new Set();

    for(
        const visualization
        of (json.visualizations || [])
    )
    {
        if(
            !visualization ||
            typeof visualization !==
                'object'
        )
        {
            continue;
        }

        const directions =
            visualization.directions;

        if(
            !directions ||
            typeof directions !==
                'object' ||
            Array.isArray(directions)
        )
        {
            continue;
        }

        for(
            const key of Object.keys(
                directions
            )
        )
        {
            if(/^\d+$/.test(key))
            {
                result.add(
                    Number(key)
                );
            }
        }
    }

    return [...result]
        .sort(
            (a, b) => a - b
        );
}

function directionMapFor(json)
{
    const directions =
        new Set(
            assetDirections(json)
        );

    if(directions.has(0))
    {
        return new Map();
    }

    const map = new Map();

    if(directions.has(2))
    {
        map.set(2, 0);
    }

    if(directions.has(4))
    {
        map.set(4, 2);
    }

    return map;
}

function remapDirectionToken(
    text,
    directionMap
)
{
    return text.replace(
        /_a_(\d+)_/g,
        (all, raw) =>
        {
            const number =
                Number(raw);

            const mapped =
                directionMap.has(number)
                    ? directionMap.get(
                        number
                    )
                    : number;

            return `_a_${mapped}_`;
        }
    );
}

function transformDirections(
    node,
    directionMap,
    plainDirectionKeys = false
)
{
    if(Array.isArray(node))
    {
        return node.map(
            value =>
                transformDirections(
                    value,
                    directionMap,
                    plainDirectionKeys
                )
        );
    }

    if(
        node !== null &&
        typeof node === 'object'
    )
    {
        const output = {};

        for(
            const [key, value]
            of Object.entries(node)
        )
        {
            let newKey =
                remapDirectionToken(
                    key,
                    directionMap
                );

            if(
                plainDirectionKeys &&
                /^\d+$/.test(key)
            )
            {
                const number =
                    Number(key);

                if(
                    directionMap.has(
                        number
                    )
                )
                {
                    newKey = String(
                        directionMap.get(
                            number
                        )
                    );
                }
            }

            output[newKey] =
                transformDirections(
                    value,
                    directionMap,
                    plainDirectionKeys
                );
        }

        return output;
    }

    if(typeof node === 'string')
    {
        return remapDirectionToken(
            node,
            directionMap
        );
    }

    return node;
}

const PNG_SIGNATURE =
    Buffer.from([
        0x89, 0x50, 0x4e, 0x47,
        0x0d, 0x0a, 0x1a, 0x0a
    ]);

function paeth(a, b, c)
{
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);

    if(pa <= pb && pa <= pc)
    {
        return a;
    }

    if(pb <= pc)
    {
        return b;
    }

    return c;
}

function parsePngRgba(png)
{
    if(
        !png
            .subarray(0, 8)
            .equals(
                PNG_SIGNATURE
            )
    )
    {
        fail(
            'PNG interno inválido.'
        );
    }

    let offset = 8;
    let width = null;
    let height = null;
    let bitDepth = null;
    let colorType = null;
    let interlace = null;

    const idat = [];

    while(offset < png.length)
    {
        if(offset + 8 > png.length)
        {
            fail('PNG truncado.');
        }

        const length =
            png.readUInt32BE(offset);

        offset += 4;

        const type =
            png
                .subarray(
                    offset,
                    offset + 4
                )
                .toString('ascii');

        offset += 4;

        if(
            offset + length + 4 >
            png.length
        )
        {
            fail('PNG truncado.');
        }

        const payload =
            png.subarray(
                offset,
                offset + length
            );

        offset += length;

        offset += 4;

        if(type === 'IHDR')
        {
            width =
                payload.readUInt32BE(0);

            height =
                payload.readUInt32BE(4);

            bitDepth =
                payload[8];

            colorType =
                payload[9];

            interlace =
                payload[12];
        }
        else if(type === 'IDAT')
        {
            idat.push(payload);
        }
        else if(type === 'IEND')
        {
            break;
        }
    }

    if(
        width === null ||
        height === null ||
        bitDepth !== 8 ||
        colorType !== 6 ||
        interlace !== 0
    )
    {
        fail(
            'PNG interno no es RGBA8 non-interlaced.'
        );
    }

    const raw =
        zlib.inflateSync(
            Buffer.concat(
                idat
            )
        );

    const bpp = 4;
    const stride =
        width * bpp;

    const rows = [];
    let position = 0;
    let previous =
        Buffer.alloc(
            stride
        );

    for(
        let y = 0;
        y < height;
        y++
    )
    {
        const filter =
            raw[position++];

        const scan =
            raw.subarray(
                position,
                position + stride
            );

        position += stride;

        const reconstructed =
            Buffer.alloc(
                stride
            );

        for(
            let x = 0;
            x < stride;
            x++
        )
        {
            const left =
                x >= bpp
                    ? reconstructed[
                        x - bpp
                    ]
                    : 0;

            const up =
                previous[x];

            const upLeft =
                x >= bpp
                    ? previous[
                        x - bpp
                    ]
                    : 0;

            const value =
                scan[x];

            if(filter === 0)
            {
                reconstructed[x] =
                    value;
            }
            else if(filter === 1)
            {
                reconstructed[x] =
                    (
                        value +
                        left
                    ) & 0xff;
            }
            else if(filter === 2)
            {
                reconstructed[x] =
                    (
                        value +
                        up
                    ) & 0xff;
            }
            else if(filter === 3)
            {
                reconstructed[x] =
                    (
                        value +
                        Math.floor(
                            (
                                left +
                                up
                            ) / 2
                        )
                    ) & 0xff;
            }
            else if(filter === 4)
            {
                reconstructed[x] =
                    (
                        value +
                        paeth(
                            left,
                            up,
                            upLeft
                        )
                    ) & 0xff;
            }
            else
            {
                fail(
                    'Filtro PNG no soportado: ' +
                    filter
                );
            }
        }

        rows.push(
            reconstructed
        );

        previous =
            reconstructed;
    }

    return {
        width,
        height,
        rows
    };
}

function crc32(buffer)
{
    let crc = 0xffffffff;

    for(const byte of buffer)
    {
        crc ^= byte;

        for(
            let bit = 0;
            bit < 8;
            bit++
        )
        {
            crc =
                (
                    crc >>> 1
                ) ^
                (
                    (crc & 1)
                        ? 0xedb88320
                        : 0
                );
        }
    }

    return (
        crc ^ 0xffffffff
    ) >>> 0;
}

function pngChunk(type, payload)
{
    const typeBuffer =
        Buffer.from(
            type,
            'ascii'
        );

    const length =
        Buffer.allocUnsafe(4);

    length.writeUInt32BE(
        payload.length,
        0
    );

    const crc =
        Buffer.allocUnsafe(4);

    crc.writeUInt32BE(
        crc32(
            Buffer.concat([
                typeBuffer,
                payload
            ])
        ),
        0
    );

    return Buffer.concat([
        length,
        typeBuffer,
        payload,
        crc
    ]);
}

function encodePngRgba(
    width,
    height,
    rows
)
{
    const scanlines = [];

    for(const row of rows)
    {
        scanlines.push(
            Buffer.from([0]),
            row
        );
    }

    const ihdr =
        Buffer.allocUnsafe(13);

    ihdr.writeUInt32BE(
        width,
        0
    );

    ihdr.writeUInt32BE(
        height,
        4
    );

    ihdr[8] = 8;
    ihdr[9] = 6;
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;

    return Buffer.concat([
        PNG_SIGNATURE,
        pngChunk(
            'IHDR',
            ihdr
        ),
        pngChunk(
            'IDAT',
            zlib.deflateSync(
                Buffer.concat(
                    scanlines
                ),
                {
                    level: 9
                }
            )
        ),
        pngChunk(
            'IEND',
            Buffer.alloc(0)
        )
    ]);
}

function cropPng(
    png,
    x,
    y,
    width,
    height
)
{
    const parsed =
        parsePngRgba(png);

    if(
        x < 0 ||
        y < 0 ||
        width <= 0 ||
        height <= 0 ||
        x + width >
            parsed.width ||
        y + height >
            parsed.height
    )
    {
        fail(
            'Frame de icono fuera del spritesheet.'
        );
    }

    const rows = [];

    for(
        let rowIndex = y;
        rowIndex < y + height;
        rowIndex++
    )
    {
        rows.push(
            parsed.rows[
                rowIndex
            ].subarray(
                x * 4,
                (x + width) * 4
            )
        );
    }

    return encodePngRgba(
        width,
        height,
        rows
    );
}

function main()
{
    const [
        rawNitroPath,
        comparatorNitroPath,
        outputNitroPath,
        outputIconPath,
        expectedName,
        sourceNameArg
    ] = process.argv.slice(2);

    if(
        !rawNitroPath ||
        !comparatorNitroPath ||
        !outputNitroPath ||
        !outputIconPath ||
        !expectedName
    )
    {
        fail(
            'Usage: normalize-redeemable.js <raw.nitro> <comparator.nitro> <out.nitro> <icon.png> <expectedName> [sourceName]'
        );
    }

    const sourceName =
        sourceNameArg ||
        expectedName;

    const target =
        parseBundle(
            rawNitroPath
        );

    const comparator =
        parseBundle(
            comparatorNitroPath
        );

    const targetEntries =
        getJsonAndPng(
            target.entries
        );

    const comparatorEntries =
        getJsonAndPng(
            comparator.entries
        );

    const targetJson =
        JSON.parse(
            targetEntries
                .json
                .raw
                .toString('utf8')
        );

    const comparatorJson =
        JSON.parse(
            comparatorEntries
                .json
                .raw
                .toString('utf8')
        );

    if(
        targetJson.name !==
        sourceName
    )
    {
        fail(
            'Nombre Nitro fuente inesperado. Esperado=' +
            sourceName +
            ' actual=' +
            targetJson.name
        );
    }

    /*
     * El Nitro convertido conserva la identidad del RAR (Hobba,
     * ClothingBuilder, etc.). A partir de aquí esa identidad es solo
     * SOURCE y todas las referencias JSON pasan al classname Biribiri.
     */
    const targetBiribiriJson =
        renameBase(
            structuredClone(
                targetJson
            ),
            sourceName,
            expectedName
        );

    const comparatorName =
        comparatorJson.name;

    if(
        comparatorJson.logicType !==
        'furniture_purchasable_clothing'
    )
    {
        fail(
            'Comparator no es furniture_purchasable_clothing.'
        );
    }

    for(
        const key of [
            'type',
            'dimensions',
            'directions',
            'assets',
            'visualizations',
            'spritesheet'
        ]
    )
    {
        if(
            !Object.prototype
                .hasOwnProperty
                .call(
                    comparatorJson,
                    key
                )
        )
        {
            fail(
                'Comparator incompleto: ' +
                key
            );
        }
    }

    const directionMap =
        directionMapFor(
            targetBiribiriJson
        );

    const assets =
        transformDirections(
            structuredClone(
                targetBiribiriJson.assets || {}
            ),
            directionMap,
            false
        );

    const visualizations =
        transformDirections(
            structuredClone(
                targetBiribiriJson
                    .visualizations || []
            ),
            directionMap,
            true
        );

    const spritesheet =
        transformDirections(
            structuredClone(
                targetBiribiriJson
                    .spritesheet || {}
            ),
            directionMap,
            false
        );

    const normalized = {};

    for(
        const [key, value]
        of Object.entries(
            comparatorJson
        )
    )
    {
        if(key === 'name')
        {
            normalized[key] =
                expectedName;
        }
        else if(
            key === 'logicType'
        )
        {
            normalized[key] =
                'furniture_purchasable_clothing';
        }
        else if(
            key ===
            'visualizationType'
        )
        {
            normalized[key] =
                targetBiribiriJson[
                    key
                ] ?? value;
        }
        else if(key === 'assets')
        {
            normalized[key] =
                assets;
        }
        else if(
            key ===
            'visualizations'
        )
        {
            normalized[key] =
                visualizations;
        }
        else if(
            key ===
            'spritesheet'
        )
        {
            normalized[key] =
                spritesheet;
        }
        else if(
            key === 'type' ||
            key === 'dimensions' ||
            key === 'directions'
        )
        {
            normalized[key] =
                structuredClone(
                    value
                );
        }
        else
        {
            normalized[key] =
                renameBase(
                    structuredClone(
                        value
                    ),
                    comparatorName,
                    expectedName
                );
        }
    }

    delete normalized.logic;

    const renamed =
        renameBase(
            normalized,
            comparatorName,
            expectedName
        );

    if(
        renamed.name !==
        expectedName ||
        renamed.logicType !==
        'furniture_purchasable_clothing'
    )
    {
        fail(
            'Contrato clothing inválido tras normalizar.'
        );
    }


    if(
        sourceName !== expectedName &&
        JSON.stringify(renamed)
            .includes(sourceName)
    )
    {
        fail(
            'Quedaron referencias al classname fuente tras renombrar: ' +
            sourceName
        );
    }

    const directions = [
        ...new Set([
            ...assetDirections(
                renamed
            ),
            ...visualizationDirections(
                renamed
            )
        ])
    ].sort(
        (a, b) => a - b
    );

    if(!directions.includes(0))
    {
        fail(
            'El furni normalizado no tiene dirección 0 renderizable.'
        );
    }

    const jsonRaw =
        Buffer.from(
            JSON.stringify(
                renamed
            ),
            'utf8'
        );

    const outputBundle =
        buildBundle([
            {
                name:
                    expectedName +
                    '.json',
                raw: jsonRaw
            },
            {
                name:
                    expectedName +
                    '.png',
                raw:
                    targetEntries
                        .png
                        .raw
            }
        ]);

    fs.mkdirSync(
        path.dirname(
            outputNitroPath
        ),
        {
            recursive: true
        }
    );

    fs.writeFileSync(
        outputNitroPath,
        outputBundle
    );

    const roundTrip =
        parseBundle(
            outputNitroPath
        );

    const roundTripEntries =
        getJsonAndPng(
            roundTrip.entries
        );

    const roundTripJson =
        JSON.parse(
            roundTripEntries
                .json
                .raw
                .toString('utf8')
        );

    if(
        roundTripJson.name !==
            expectedName ||
        roundTripJson.logicType !==
            'furniture_purchasable_clothing' ||
        sha256(
            roundTripEntries
                .png
                .raw
        ) !==
        sha256(
            targetEntries
                .png
                .raw
        )
    )
    {
        fail(
            'Postcheck del Nitro normalizado falló.'
        );
    }

    const frames =
        (
            roundTripJson
                .spritesheet || {}
        ).frames || {};

    const iconAsset =
        expectedName +
        '_icon_a';

    const preferredKey =
        expectedName +
        '_' +
        iconAsset;

    let frameEntry =
        frames[
            preferredKey
        ];

    if(!frameEntry)
    {
        const fallback =
            Object.entries(
                frames
            ).find(
                ([key]) =>
                    key.endsWith(
                        '_' +
                        iconAsset
                    )
            );

        frameEntry =
            fallback
                ? fallback[1]
                : null;
    }

    if(
        !frameEntry ||
        !frameEntry.frame
    )
    {
        fail(
            'No existe frame de icono en el Nitro normalizado.'
        );
    }

    const frame =
        frameEntry.frame;

    const icon =
        cropPng(
            roundTripEntries
                .png
                .raw,
            Number(frame.x),
            Number(frame.y),
            Number(frame.w),
            Number(frame.h)
        );

    fs.mkdirSync(
        path.dirname(
            outputIconPath
        ),
        {
            recursive: true
        }
    );

    fs.writeFileSync(
        outputIconPath,
        icon
    );

    process.stdout.write(
        JSON.stringify({
            ok: true,
            logicType:
                roundTripJson.logicType,
            name:
                roundTripJson.name,
            sourceName,
            directions,
            remappedDirections:
                Object.fromEntries(
                    directionMap
                ),
            nitroSha256:
                sha256(
                    outputBundle
                ),
            sourcePngSha256:
                sha256(
                    targetEntries
                        .png
                        .raw
                ),
            icon: {
                width:
                    Number(
                        frame.w
                    ),
                height:
                    Number(
                        frame.h
                    ),
                sha256:
                    sha256(
                        icon
                    )
            }
        })
    );
}

try
{
    main();
}
catch(error)
{
    console.error(
        error &&
        error.stack
            ? error.stack
            : String(error)
    );

    process.exit(1);
}
