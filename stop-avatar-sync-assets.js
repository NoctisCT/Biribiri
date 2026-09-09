const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT =
    'C:\\Users\\erale\\Desktop\\Habbo';

const PUBLIC =
    path.join(
        ROOT,
        'xampp',
        'htdocs',
        'public'
    );

const BUNDLED =
    path.join(
        PUBLIC,
        'nitro-assets',
        'bundled',
        'furniture'
    );

const FURNITURE_DATA =
    path.join(
        PUBLIC,
        'nitro-assets',
        'gamedata',
        'FurnitureData.json'
    );

const LEGACY_FURNIDATA =
    path.join(
        PUBLIC,
        'swf',
        'gamedata',
        'furnidata.xml'
    );

const SOURCE_NAME =
    'wf_act_avatar_sync';

const TARGET_NAME =
    'wf_act_stop_avatar_sync';

const SOURCE_ID =
    1996663548;

const TARGET_ID =
    1996663549;

const SOURCE_NITRO =
    path.join(
        BUNDLED,
        SOURCE_NAME + '.nitro'
    );

const TARGET_NITRO =
    path.join(
        BUNDLED,
        TARGET_NAME + '.nitro'
    );

const WORK =
    path.join(
        ROOT,
        'AssetWork',
        TARGET_NAME
    );

const WORK_JSON =
    path.join(
        WORK,
        TARGET_NAME + '.json'
    );

const WORK_PNG =
    path.join(
        WORK,
        TARGET_NAME + '.png'
    );

const WORK_NITRO =
    path.join(
        WORK,
        TARGET_NAME + '.nitro'
    );

const stamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14);


/* ============================================================
   HELPERS
   ============================================================ */

function fail(message)
{
    throw new Error(message);
}


function backup(file)
{
    if(!fs.existsSync(file))
    {
        return null;
    }

    const backupPath =
        file + '.BACKUP-' + stamp;

    fs.copyFileSync(
        file,
        backupPath
    );

    console.log(
        'BACKUP:',
        backupPath
    );

    return backupPath;
}


function findJsonObjectBounds(
    text,
    needleIndex)
{
    let start =
        text.lastIndexOf(
            '{',
            needleIndex
        );

    if(start < 0)
    {
        fail(
            'No encuentro el inicio del objeto JSON.'
        );
    }

    let depth = 0;
    let inString = false;
    let escaped = false;

    for(
        let i = start;
        i < text.length;
        i++
    )
    {
        const c =
            text[i];

        if(inString)
        {
            if(escaped)
            {
                escaped = false;
                continue;
            }

            if(c === '\\')
            {
                escaped = true;
                continue;
            }

            if(c === '"')
            {
                inString = false;
            }

            continue;
        }

        if(c === '"')
        {
            inString = true;
            continue;
        }

        if(c === '{')
        {
            depth++;
            continue;
        }

        if(c === '}')
        {
            depth--;

            if(depth === 0)
            {
                return {
                    start,
                    end: i
                };
            }
        }
    }

    fail(
        'No encuentro el final del objeto JSON.'
    );
}


/* ============================================================
   LEER CONTENEDOR NITRO
   ============================================================ */

function readNitro(file)
{
    const data =
        fs.readFileSync(file);

    let offset = 0;

    if(data.length < 2)
    {
        fail(
            'El .nitro es demasiado pequeño.'
        );
    }

    const count =
        data.readUInt16BE(offset);

    offset += 2;

    const entries = [];

    for(
        let i = 0;
        i < count;
        i++
    )
    {
        if(offset + 2 > data.length)
        {
            fail(
                'Nitro truncado en nameLength.'
            );
        }

        const nameLength =
            data.readUInt16BE(offset);

        offset += 2;

        if(
            offset + nameLength >
            data.length
        )
        {
            fail(
                'Nitro truncado en filename.'
            );
        }

        const name =
            data
                .subarray(
                    offset,
                    offset + nameLength
                )
                .toString('utf8');

        offset +=
            nameLength;

        if(offset + 4 > data.length)
        {
            fail(
                'Nitro truncado en compressedLength.'
            );
        }

        const compressedLength =
            data.readUInt32BE(offset);

        offset += 4;

        if(
            offset + compressedLength >
            data.length
        )
        {
            fail(
                'Nitro truncado en payload.'
            );
        }

        const compressed =
            data.subarray(
                offset,
                offset + compressedLength
            );

        offset +=
            compressedLength;

        const payload =
            zlib.inflateSync(
                compressed
            );

        entries.push({
            name,
            payload
        });
    }

    if(offset !== data.length)
    {
        fail(
            'El Nitro tiene bytes sobrantes.'
        );
    }

    return entries;
}


/* ============================================================
   CREAR CONTENEDOR NITRO
   ============================================================ */

function writeNitro(
    file,
    entries)
{
    const chunks = [];

    const countBuffer =
        Buffer.alloc(2);

    countBuffer.writeUInt16BE(
        entries.length,
        0
    );

    chunks.push(
        countBuffer
    );

    for(const entry of entries)
    {
        const name =
            Buffer.from(
                entry.name,
                'utf8'
            );

        const compressed =
            zlib.deflateSync(
                entry.payload,
                {
                    level: 6
                }
            );

        const nameLength =
            Buffer.alloc(2);

        nameLength.writeUInt16BE(
            name.length,
            0
        );

        const payloadLength =
            Buffer.alloc(4);

        payloadLength.writeUInt32BE(
            compressed.length,
            0
        );

        chunks.push(
            nameLength,
            name,
            payloadLength,
            compressed
        );
    }

    fs.writeFileSync(
        file,
        Buffer.concat(chunks)
    );
}


/* ============================================================
   INICIO
   ============================================================ */

console.log('');
console.log(
    '========================================================'
);
console.log(
    ' STOP AVATAR SYNC - ASSET + FURNITUREDATA'
);
console.log(
    '========================================================'
);
console.log('');


if(!fs.existsSync(SOURCE_NITRO))
{
    fail(
        'No existe asset fuente: ' +
        SOURCE_NITRO
    );
}


if(!fs.existsSync(FURNITURE_DATA))
{
    fail(
        'No existe FurnitureData.json: ' +
        FURNITURE_DATA
    );
}


fs.mkdirSync(
    WORK,
    {
        recursive: true
    }
);


/* ============================================================
   BACKUPS
   ============================================================ */

backup(
    FURNITURE_DATA
);

if(
    fs.existsSync(
        LEGACY_FURNIDATA
    )
)
{
    backup(
        LEGACY_FURNIDATA
    );
}

if(
    fs.existsSync(
        TARGET_NITRO
    )
)
{
    backup(
        TARGET_NITRO
    );
}


/* ============================================================
   1. CLONAR ASSET AVATAR SYNC -> STOP
   ============================================================ */

const sourceEntries =
    readNitro(
        SOURCE_NITRO
    );


if(sourceEntries.length !== 2)
{
    fail(
        'Avatar Sync .nitro no contiene exactamente 2 archivos.'
    );
}


const jsonEntry =
    sourceEntries.find(
        entry =>
            entry.name
                .toLowerCase()
                .endsWith('.json')
    );


const pngEntry =
    sourceEntries.find(
        entry =>
            entry.name
                .toLowerCase()
                .endsWith('.png')
    );


if(!jsonEntry || !pngEntry)
{
    fail(
        'No encuentro JSON + PNG dentro de Avatar Sync.nitro'
    );
}


let jsonText =
    jsonEntry.payload
        .toString('utf8');


if(
    !jsonText.includes(
        SOURCE_NAME
    )
)
{
    fail(
        'El JSON interno no contiene ' +
        SOURCE_NAME
    );
}


jsonText =
    jsonText
        .split(SOURCE_NAME)
        .join(TARGET_NAME);


const targetJson =
    Buffer.from(
        jsonText,
        'utf8'
    );


const targetPng =
    Buffer.from(
        pngEntry.payload
    );


fs.writeFileSync(
    WORK_JSON,
    targetJson
);


fs.writeFileSync(
    WORK_PNG,
    targetPng
);


const newEntries = [
    {
        name:
            TARGET_NAME +
            '.json',

        payload:
            targetJson
    },
    {
        name:
            TARGET_NAME +
            '.png',

        payload:
            targetPng
    }
];


writeNitro(
    WORK_NITRO,
    newEntries
);


/* ============================================================
   2. VALIDAR EL NITRO RECIÉN CREADO
   ============================================================ */

const validation =
    readNitro(
        WORK_NITRO
    );


if(validation.length !== 2)
{
    fail(
        'Validación Nitro: número de archivos incorrecto.'
    );
}


for(let i = 0; i < 2; i++)
{
    if(
        validation[i].name !==
        newEntries[i].name
    )
    {
        fail(
            'Validación Nitro: nombre interno incorrecto.'
        );
    }

    if(
        !validation[i].payload.equals(
            newEntries[i].payload
        )
    )
    {
        fail(
            'Validación Nitro: payload interno diferente.'
        );
    }
}


console.log(
    'NITRO validado: OK'
);


/* ============================================================
   3. INSTALAR ASSET
   ============================================================ */

fs.copyFileSync(
    WORK_NITRO,
    TARGET_NITRO
);


console.log(
    'Asset instalado:'
);

console.log(
    TARGET_NITRO
);


/* ============================================================
   4. FURNITUREDATA.JSON
   ============================================================ */

let furnitureText =
    fs.readFileSync(
        FURNITURE_DATA,
        'utf8'
    );


const targetClassRegex =
    new RegExp(
        '"classname"\\s*:\\s*"' +
        TARGET_NAME +
        '"'
    );


if(
    targetClassRegex.test(
        furnitureText
    )
)
{
    console.log(
        'FurnitureData: Stop ya existe.'
    );
}
else
{
    const sourceClassRegex =
        new RegExp(
            '"classname"\\s*:\\s*"' +
            SOURCE_NAME +
            '"'
        );

    const match =
        sourceClassRegex.exec(
            furnitureText
        );


    if(!match)
    {
        fail(
            'No encuentro ' +
            SOURCE_NAME +
            ' en FurnitureData.json'
        );
    }


    const bounds =
        findJsonObjectBounds(
            furnitureText,
            match.index
        );


    const sourceObjectText =
        furnitureText.slice(
            bounds.start,
            bounds.end + 1
        );


    let sourceObject;

    try
    {
        sourceObject =
            JSON.parse(
                sourceObjectText
            );
    }
    catch(error)
    {
        fail(
            'No puedo parsear la entrada Avatar Sync de FurnitureData: ' +
            error.message
        );
    }


    const clone =
        JSON.parse(
            JSON.stringify(
                sourceObject
            )
        );


    clone.id =
        TARGET_ID;

    clone.classname =
        TARGET_NAME;

    clone.name =
        'WIRED Effect: Stop Avatar Sync';

    clone.description =
        'Stops the complete WIRED Avatar Sync session of the triggering user.';

    clone.offerid =
        TARGET_ID;


    const cloneText =
        JSON.stringify(
            clone
        );


    furnitureText =
        furnitureText.slice(
            0,
            bounds.start
        ) +
        cloneText +
        ',' +
        furnitureText.slice(
            bounds.start
        );


    fs.writeFileSync(
        FURNITURE_DATA,
        furnitureText,
        'utf8'
    );


    console.log(
        'FurnitureData: entrada Stop añadida.'
    );
}


/* ============================================================
   5. VALIDAR QUE FURNITUREDATA CONTIENE EL STOP
   ============================================================ */

const furnitureCheck =
    fs.readFileSync(
        FURNITURE_DATA,
        'utf8'
    );


if(
    !new RegExp(
        '"classname"\\s*:\\s*"' +
        TARGET_NAME +
        '"'
    ).test(
        furnitureCheck
    )
)
{
    fail(
        'FurnitureData: no aparece el classname Stop tras guardar.'
    );
}


if(
    !new RegExp(
        '"id"\\s*:\\s*' +
        TARGET_ID
    ).test(
        furnitureCheck
    )
)
{
    fail(
        'FurnitureData: no aparece el ID Stop.'
    );
}


console.log(
    'FurnitureData validado: OK'
);


/* ============================================================
   6. LEGACY FURNIDATA.XML
   ============================================================ */

if(
    fs.existsSync(
        LEGACY_FURNIDATA
    )
)
{
    let xml =
        fs.readFileSync(
            LEGACY_FURNIDATA,
            'utf8'
        );


    if(
        xml.includes(
            'classname="' +
            TARGET_NAME +
            '"'
        )
    )
    {
        console.log(
            'furnidata.xml: Stop ya existe.'
        );
    }
    else
    {
        const sourceRegex =
            new RegExp(
                '<furnitype\\b' +
                '(?=[^>]*\\bid="' +
                SOURCE_ID +
                '")' +
                '(?=[^>]*\\bclassname="' +
                SOURCE_NAME +
                '")' +
                '[^>]*>[\\s\\S]*?<\\/furnitype>'
            );


        const xmlMatch =
            sourceRegex.exec(
                xml
            );


        if(xmlMatch)
        {
            let clone =
                xmlMatch[0];


            clone =
                clone.replace(
                    new RegExp(
                        '\\bid="' +
                        SOURCE_ID +
                        '"'
                    ),
                    'id="' +
                    TARGET_ID +
                    '"'
                );


            clone =
                clone.replace(
                    'classname="' +
                    SOURCE_NAME +
                    '"',
                    'classname="' +
                    TARGET_NAME +
                    '"'
                );


            clone =
                clone.replace(
                    /<name>[\s\S]*?<\/name>/,
                    '<name>WIRED Effect: Stop Avatar Sync</name>'
                );


            clone =
                clone.replace(
                    /<description>[\s\S]*?<\/description>/,
                    '<description>Stops the complete WIRED Avatar Sync session of the triggering user.</description>'
                );


            clone =
                clone.replace(
                    /<offerid>-?\d+<\/offerid>/,
                    '<offerid>' +
                    TARGET_ID +
                    '</offerid>'
                );


            xml =
                xml.slice(
                    0,
                    xmlMatch.index
                ) +
                clone +
                '\r\n' +
                xml.slice(
                    xmlMatch.index
                );


            fs.writeFileSync(
                LEGACY_FURNIDATA,
                xml,
                'utf8'
            );


            console.log(
                'furnidata.xml: entrada Stop añadida.'
            );
        }
        else
        {
            console.log(
                'AVISO: no existe Avatar Sync en furnidata.xml; se omite legacy.'
            );
        }
    }
}


/* ============================================================
   7. RESULTADO FINAL
   ============================================================ */

const crypto =
    require('crypto');


const finalNitro =
    fs.readFileSync(
        TARGET_NITRO
    );


const sha =
    crypto
        .createHash('sha256')
        .update(finalNitro)
        .digest('hex')
        .toUpperCase();


console.log('');
console.log(
    '========================================================'
);
console.log(
    ' STOP AVATAR SYNC - ASSET/FURNITUREDATA OK'
);
console.log(
    '========================================================'
);
console.log('');

console.log(
    'ID        :',
    TARGET_ID
);

console.log(
    'Classname :',
    TARGET_NAME
);

console.log(
    'Asset     :',
    TARGET_NITRO
);

console.log(
    'SHA256    :',
    sha
);

console.log('');