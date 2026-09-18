'use strict';

const fs = require('fs');
const path = require('path');

async function main()
{
    const [
        converterRoot,
        inputSwf,
        outputNitro
    ] = process.argv.slice(2);

    if(
        !converterRoot ||
        !inputSwf ||
        !outputNitro
    )
    {
        throw new Error(
            'Usage: node convert-swf.js <converterRoot> <input.swf> <output.nitro>'
        );
    }

    /*
     * tsyringe (usado por nitro-converter) requiere el polyfill
     * antes de cargar cualquier módulo del converter.
     */
    require(
        path.join(
            converterRoot,
            'node_modules',
            'reflect-metadata'
        )
    );

    const swfModule = require(
        path.join(
            converterRoot,
            'dist',
            'swf'
        )
    );

    const {
        GenerateNitroBundleFromSwf,
        SWFDownloader
    } = swfModule;

    if(
        typeof GenerateNitroBundleFromSwf !==
            'function' ||
        !SWFDownloader ||
        typeof SWFDownloader.downloadFromUrl !==
            'function'
    )
    {
        throw new Error(
            'El nitro-converter no expone la API SWF esperada.'
        );
    }

    const normalizedInput =
        inputSwf.replace(/\\/g, '/');

    const habboAssetSwf =
        await SWFDownloader.downloadFromUrl(
            normalizedInput
        );

    if(!habboAssetSwf)
    {
        throw new Error(
            'SWF inválido: ' + inputSwf
        );
    }

    const bundle =
        await GenerateNitroBundleFromSwf(
            habboAssetSwf
        );

    if(!bundle)
    {
        throw new Error(
            'No se pudo generar el bundle Nitro.'
        );
    }

    const buffer = Buffer.from(
        await bundle.toBufferAsync()
    );

    fs.mkdirSync(
        path.dirname(outputNitro),
        { recursive: true }
    );

    fs.writeFileSync(
        outputNitro,
        buffer
    );

    if(
        !fs.existsSync(outputNitro) ||
        fs.statSync(outputNitro).size <= 0
    )
    {
        throw new Error(
            'El Nitro generado está vacío.'
        );
    }

    process.stdout.write(
        JSON.stringify({
            ok: true,
            output: outputNitro,
            bytes:
                fs.statSync(outputNitro).size
        })
    );
}

main().catch((error) =>
{
    console.error(
        error && error.stack
            ? error.stack
            : String(error)
    );

    process.exit(1);
});