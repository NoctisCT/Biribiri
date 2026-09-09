const fs = require('fs');
const path = require('path');

const ROOT =
    'C:\\Users\\erale\\Desktop\\Habbo';

const PROJECT =
    path.join(
        ROOT,
        'avatar-sync-mvp'
    );

const JAVA =
    path.join(
        PROJECT,
        'src',
        'main',
        'java',
        'com',
        'neah',
        'avatarsync'
    );

const PLUGIN =
    path.join(
        JAVA,
        'AvatarSyncPlugin.java'
    );

const EFFECT =
    path.join(
        JAVA,
        'WiredEffectAvatarSync.java'
    );

const STOP_EFFECT =
    path.join(
        JAVA,
        'WiredEffectStopAvatarSync.java'
    );

const NITRO =
    path.join(
        ROOT,
        'xampp',
        'htdocs',
        'nitro-react'
    );

const STOP_VIEW =
    path.join(
        NITRO,
        'src',
        'components',
        'wired',
        'views',
        'actions',
        'WiredActionStopAvatarSyncView.tsx'
    );

const stamp =
    new Date()
        .toISOString()
        .replace(/[-:TZ.]/g, '')
        .slice(0, 14);


function fail(message)
{
    throw new Error(message);
}


function backup(file)
{
    if(!fs.existsSync(file))
    {
        fail(
            'No existe: ' + file
        );
    }

    const dest =
        file + '.BACKUP-' + stamp;

    fs.copyFileSync(
        file,
        dest
    );

    console.log(
        'BACKUP:',
        dest
    );
}


/*
 * ============================================================
 * REPARAR MOJIBAKE ESPAÑOL
 * ============================================================
 */

function repairMojibake(text)
{
    const replacements = new Map([
        [ 'Ã¡', 'á' ],
        [ 'Ã©', 'é' ],
        [ 'Ã­', 'í' ],
        [ 'Ã³', 'ó' ],
        [ 'Ãº', 'ú' ],
        [ 'Ã±', 'ñ' ],
        [ 'Ã¼', 'ü' ],

        [ 'Ã', 'Á' ],
        [ 'Ã‰', 'É' ],
        [ 'Ã', 'Í' ],
        [ 'Ã“', 'Ó' ],
        [ 'Ãš', 'Ú' ],
        [ 'Ã‘', 'Ñ' ],
        [ 'Ãœ', 'Ü' ],

        [ 'Â¿', '¿' ],
        [ 'Â¡', '¡' ]
    ]);

    for(let pass = 0; pass < 3; pass++)
    {
        let changed = false;

        for(const [ bad, good ] of replacements)
        {
            if(text.includes(bad))
            {
                text =
                    text
                        .split(bad)
                        .join(good);

                changed = true;
            }
        }

        if(!changed)
        {
            break;
        }
    }

    return text;
}


/*
 * ============================================================
 * HACER JAVA INDEPENDIENTE DE ENCODING
 * ============================================================
 *
 * á  -> \u00e1
 * ñ  -> \u00f1
 * ó  -> \u00f3
 *
 * javac interpreta estos escapes correctamente
 * independientemente del encoding de Windows/Maven.
 * ============================================================
 */

function unicodeEscapeJava(text)
{
    let result = '';

    for(const ch of text)
    {
        const cp =
            ch.codePointAt(0);

        if(cp <= 0x7F)
        {
            result += ch;
            continue;
        }

        if(cp <= 0xFFFF)
        {
            result +=
                '\\u' +
                cp
                    .toString(16)
                    .padStart(4, '0');

            continue;
        }

        const n =
            cp - 0x10000;

        const high =
            0xD800 +
            (n >> 10);

        const low =
            0xDC00 +
            (n & 0x3FF);

        result +=
            '\\u' +
            high
                .toString(16)
                .padStart(4, '0');

        result +=
            '\\u' +
            low
                .toString(16)
                .padStart(4, '0');
    }

    return result;
}


/*
 * ============================================================
 * QUITAR System.out.println DE AVATARSYNC
 * ============================================================
 */

function removeAvatarSyncPrints(source)
{
    const marker =
        'System.out.println';

    let searchFrom = 0;

    while(true)
    {
        const index =
            source.indexOf(
                marker,
                searchFrom
            );

        if(index < 0)
        {
            break;
        }

        const open =
            source.indexOf(
                '(',
                index + marker.length
            );

        if(open < 0)
        {
            break;
        }

        let depth = 0;
        let inString = false;
        let inChar = false;
        let escaped = false;
        let close = -1;

        for(
            let i = open;
            i < source.length;
            i++
        )
        {
            const c =
                source[i];

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

            if(inChar)
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

                if(c === "'")
                {
                    inChar = false;
                }

                continue;
            }

            if(c === '"')
            {
                inString = true;
                continue;
            }

            if(c === "'")
            {
                inChar = true;
                continue;
            }

            if(c === '(')
            {
                depth++;
                continue;
            }

            if(c === ')')
            {
                depth--;

                if(depth === 0)
                {
                    close = i;
                    break;
                }
            }
        }

        if(close < 0)
        {
            break;
        }

        let semi =
            close + 1;

        while(
            semi < source.length &&
            /\s/.test(source[semi])
        )
        {
            semi++;
        }

        if(source[semi] !== ';')
        {
            searchFrom =
                close + 1;

            continue;
        }

        const statement =
            source.slice(
                index,
                semi + 1
            );

        if(
            !statement.includes(
                '[AvatarSync]'
            )
        )
        {
            searchFrom =
                semi + 1;

            continue;
        }

        let start =
            source.lastIndexOf(
                '\n',
                index
            );

        start =
            start < 0
                ? 0
                : start + 1;

        let end =
            semi + 1;

        if(source[end] === '\r')
        {
            end++;
        }

        if(source[end] === '\n')
        {
            end++;
        }

        source =
            source.slice(
                0,
                start
            ) +
            source.slice(
                end
            );

        searchFrom =
            start;
    }

    return source;
}


/*
 * ============================================================
 * PATCH JAVA
 * ============================================================
 */

function patchJava(file)
{
    backup(file);

    let text =
        fs.readFileSync(
            file,
            'utf8'
        );

    text =
        repairMojibake(
            text
        );

    text =
        removeAvatarSyncPrints(
            text
        );

    text =
        unicodeEscapeJava(
            text
        );

    fs.writeFileSync(
        file,
        text,
        'utf8'
    );

    console.log(
        'JAVA OK:',
        file
    );
}


patchJava(
    PLUGIN
);

patchJava(
    EFFECT
);

patchJava(
    STOP_EFFECT
);


/*
 * ============================================================
 * VALIDAR MENSAJES IMPORTANTES
 * ============================================================
 */

const pluginCheck =
    fs.readFileSync(
        PLUGIN,
        'utf8'
    );


const required = [
    'A\\u00f1adido a la sincronizaci\\u00f3n',
    'Ahora est\\u00e1s sincronizado',
    'Sincronizaci\\u00f3n terminada',
    'No est\\u00e1s en ninguna sincronizaci\\u00f3n',
    'La sincronizaci\\u00f3n de avatares ha terminado'
];


for(const text of required)
{
    if(!pluginCheck.includes(text))
    {
        fail(
            'No encuentro mensaje reparado: ' +
            text
        );
    }
}


if(
    pluginCheck.includes(
        'System.out.println'
    ) &&
    pluginCheck.includes(
        '[AvatarSync]'
    )
)
{
    fail(
        'Todavía queda logging [AvatarSync] en AvatarSyncPlugin.java'
    );
}


console.log('');
console.log(
    'MENSAJES JAVA: OK'
);

console.log(
    'LOGS AVATARSYNC: ELIMINADOS'
);


/*
 * ============================================================
 * PATCH UI STOP - TEXTO NEGRO
 * ============================================================
 */

backup(
    STOP_VIEW
);


const stopViewCode = `import { FC } from 'react';
import { WiredFurniType } from '../../../../api';
import { WiredActionBaseView } from './WiredActionBaseView';

export const WiredActionStopAvatarSyncView: FC<{}> = () =>
{
    const save = () =>
    {
        // Stop Avatar Sync no tiene configuracion propia.
    };

    return (
        <WiredActionBaseView
            requiresFurni={ WiredFurniType.STUFF_SELECTION_OPTION_NONE }
            hasSpecialInput={ true }
            save={ save }>

            <div className="d-flex flex-column gap-2 text-black">
                <div className="fw-bold text-black">
                    Stop Avatar Sync
                </div>

                <div className="text-black">
                    Detiene la sesión Avatar Sync WIRED completa del usuario causante.
                </div>
            </div>

        </WiredActionBaseView>
    );
};
`;


fs.writeFileSync(
    STOP_VIEW,
    stopViewCode,
    'utf8'
);


const viewCheck =
    fs.readFileSync(
        STOP_VIEW,
        'utf8'
    );


if(
    !viewCheck.includes(
        'text-black'
    )
)
{
    fail(
        'No se aplicó text-black al Stop.'
    );
}


console.log(
    'UI STOP NEGRA: OK'
);

console.log('');
console.log(
    '========================================================'
);
console.log(
    ' PATCH COMPLETO OK'
);
console.log(
    '========================================================'
);
console.log('');