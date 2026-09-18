'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function fail(message) {
    throw new Error(message);
}

function readU16(buffer, state) {
    if (state.offset + 2 > buffer.length) {
        fail('Nitro truncado leyendo uint16.');
    }

    const value = buffer.readUInt16BE(state.offset);
    state.offset += 2;
    return value;
}

function readU32(buffer, state) {
    if (state.offset + 4 > buffer.length) {
        fail('Nitro truncado leyendo uint32.');
    }

    const value = buffer.readUInt32BE(state.offset);
    state.offset += 4;
    return value;
}

function parseNitro(file) {
    const data = fs.readFileSync(file);
    const state = { offset: 0 };
    const count = readU16(data, state);
    const entries = [];

    if (count < 1) {
        fail('Nitro sin entradas.');
    }

    for (let i = 0; i < count; i++) {
        const nameLength = readU16(data, state);

        if (nameLength < 1 || state.offset + nameLength > data.length) {
            fail('Nitro truncado leyendo nombre interno.');
        }

        const name = data
            .subarray(state.offset, state.offset + nameLength)
            .toString('utf8');

        state.offset += nameLength;

        const payloadLength = readU32(data, state);

        if (payloadLength < 1 || state.offset + payloadLength > data.length) {
            fail('Nitro truncado leyendo payload.');
        }

        const compressed = data.subarray(
            state.offset,
            state.offset + payloadLength
        );

        state.offset += payloadLength;

        let raw;

        try {
            raw = zlib.inflateSync(compressed);
        } catch (error) {
            fail(
                `No se pudo descomprimir la entrada ${name}: ${error.message}`
            );
        }

        entries.push({ name, raw });
    }

    if (state.offset !== data.length) {
        fail(`Nitro contiene ${data.length - state.offset} bytes sobrantes.`);
    }

    return entries;
}

function writeNitro(file, entries) {
    const chunks = [];
    const header = Buffer.alloc(2);
    header.writeUInt16BE(entries.length, 0);
    chunks.push(header);

    for (const entry of entries) {
        const name = Buffer.from(entry.name, 'utf8');

        if (name.length < 1 || name.length > 65535) {
            fail(`Nombre Nitro inválido: ${entry.name}`);
        }

        const compressed = zlib.deflateSync(entry.raw);
        const nameLength = Buffer.alloc(2);
        const payloadLength = Buffer.alloc(4);
        nameLength.writeUInt16BE(name.length, 0);
        payloadLength.writeUInt32BE(compressed.length, 0);

        chunks.push(nameLength, name, payloadLength, compressed);
    }

    const output = Buffer.concat(chunks);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, output);
}

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildMappings(raw) {
    if (!raw || Array.isArray(raw) || typeof raw !== 'object') {
        fail('El mapping debe ser un objeto source->Biribiri.');
    }

    const mappings = [];
    const seenTargets = new Set();

    for (const [sourceRaw, targetRaw] of Object.entries(raw)) {
        const source = String(sourceRaw).trim();
        const target = String(targetRaw).trim();

        if (!/^\d+$/.test(source) || Number(source) <= 0) {
            fail(`Source Part ID inválido: ${source}`);
        }

        if (!/^\d+$/.test(target) || Number(target) <= 0) {
            fail(`Biribiri Part ID inválido: ${target}`);
        }

        if (source === target) {
            fail(`El remapeo debe cambiar realmente el ID: ${source}`);
        }

        if (seenTargets.has(target)) {
            fail(`Dos source IDs apuntan al mismo destino Biribiri: ${target}`);
        }

        seenTargets.add(target);

        mappings.push({
            source,
            target,
            sourceNumber: Number(source),
            targetNumber: Number(target),
            regex: new RegExp(`(^|\\D)${escapeRegex(source)}(?=\\D|$)`, 'g'),
            replacements: 0,
        });
    }

    if (mappings.length < 1) {
        fail('Mapping vacío.');
    }

    mappings.sort((a, b) => b.source.length - a.source.length);
    return mappings;
}

function replaceTokens(text, mappings) {
    let value = text;

    for (const mapping of mappings) {
        value = value.replace(
            mapping.regex,
            (match, prefix) => {
                mapping.replacements++;
                return `${prefix}${mapping.target}`;
            }
        );
    }

    return value;
}

function remapJsonValue(value, mappings) {
    if (Array.isArray(value)) {
        return value.map((entry) => remapJsonValue(entry, mappings));
    }

    if (value && typeof value === 'object') {
        const result = {};

        for (const [key, child] of Object.entries(value)) {
            const newKey = replaceTokens(key, mappings);

            if (Object.prototype.hasOwnProperty.call(result, newKey)) {
                fail(`El remapeo produciría una clave JSON duplicada: ${newKey}`);
            }

            result[newKey] = remapJsonValue(child, mappings);
        }

        return result;
    }

    if (typeof value === 'string') {
        return replaceTokens(value, mappings);
    }

    if (typeof value === 'number' && Number.isSafeInteger(value)) {
        for (const mapping of mappings) {
            if (value === mapping.sourceNumber) {
                mapping.replacements++;
                return mapping.targetNumber;
            }
        }
    }

    return value;
}

function containsToken(text, source) {
    const regex = new RegExp(
        `(^|\\D)${escapeRegex(source)}(?=\\D|$)`
    );

    return regex.test(text);
}

function main() {
    const [
        input,
        output,
        mappingFile,
        sourceLibraryRaw = '',
        finalLibraryRaw = ''
    ] = process.argv.slice(2);

    if (!input || !output || !mappingFile) {
        fail(
            'Uso: node remap-figure-part-ids.js input.nitro output.nitro mapping.json [sourceLibrary finalLibrary]'
        );
    }

    const sourceLibrary = String(sourceLibraryRaw || '').trim();
    const finalLibrary = String(finalLibraryRaw || '').trim();

    if ((sourceLibrary === '') !== (finalLibrary === '')) {
        fail('sourceLibrary y finalLibrary deben venir juntos.');
    }

    if (
        sourceLibrary !== '' &&
        (
            !/^[A-Za-z0-9_]+$/.test(sourceLibrary) ||
            !/^[A-Za-z0-9_]+$/.test(finalLibrary)
        )
    ) {
        fail('Library source/final contiene caracteres no permitidos.');
    }

    if (
        sourceLibrary !== '' &&
        sourceLibrary === finalLibrary
    ) {
        fail('La library final debe ser distinta de la fuente.');
    }

    let libraryReplacements = 0;

    const replaceLibrary = (value) => {
        if (sourceLibrary === '') return value;

        const text = String(value);
        const parts = text.split(sourceLibrary);

        if (parts.length === 1) return text;

        libraryReplacements += parts.length - 1;
        return parts.join(finalLibrary);
    };

    if (!fs.existsSync(input)) {
        fail(`No existe input Nitro: ${input}`);
    }

    if (!fs.existsSync(mappingFile)) {
        fail(`No existe mapping JSON: ${mappingFile}`);
    }

    const mappingRaw = JSON.parse(
        fs.readFileSync(mappingFile, 'utf8')
    );

    const mappings = buildMappings(mappingRaw);
    const entries = parseNitro(input);
    const outputEntries = [];
    let jsonEntries = 0;
    let pngEntries = 0;

    for (const entry of entries) {
        const originalName = entry.name;
        let newName = replaceTokens(originalName, mappings);
        newName = replaceLibrary(newName);

        const lower = originalName.toLowerCase();
        let raw = entry.raw;

        if (lower.endsWith('.json')) {
            jsonEntries++;

            let parsed;

            try {
                parsed = JSON.parse(raw.toString('utf8'));
            } catch (error) {
                fail(`JSON Nitro inválido en ${originalName}: ${error.message}`);
            }

            parsed = remapJsonValue(parsed, mappings);

            let jsonText = JSON.stringify(parsed);
            jsonText = replaceLibrary(jsonText);

            try {
                parsed = JSON.parse(jsonText);
            } catch (error) {
                fail(
                    `El rename de library dejó JSON inválido en ${originalName}: ${error.message}`
                );
            }

            raw = Buffer.from(JSON.stringify(parsed), 'utf8');
        } else if (lower.endsWith('.png')) {
            pngEntries++;
            // Los píxeles no se alteran nunca.
        } else if (
            lower.endsWith('.xml') ||
            lower.endsWith('.txt')
        ) {
            let text = replaceTokens(
                raw.toString('utf8'),
                mappings
            );

            text = replaceLibrary(text);

            raw = Buffer.from(
                text,
                'utf8'
            );
        }

        outputEntries.push({
            name: newName,
            raw,
        });
    }

    if (jsonEntries < 1 || pngEntries < 1) {
        fail(
            `Nitro figure inesperado: json=${jsonEntries}, png=${pngEntries}`
        );
    }

    for (const mapping of mappings) {
        if (mapping.replacements < 1) {
            fail(
                `El source Part ID ${mapping.source} no apareció en el Nitro; no se instala un remapeo incompleto.`
            );
        }
    }

    if (
        sourceLibrary !== '' &&
        libraryReplacements < 1
    ) {
        fail(
            `La library fuente ${sourceLibrary} no apareció en el Nitro; no se instala un rename incompleto.`
        );
    }

    for (const entry of outputEntries) {
        for (const mapping of mappings) {
            if (containsToken(entry.name, mapping.source)) {
                fail(
                    `Quedó source Part ID ${mapping.source} en nombre interno ${entry.name}.`
                );
            }
        }

        if (
            sourceLibrary !== '' &&
            entry.name.includes(sourceLibrary)
        ) {
            fail(
                `Quedó library fuente ${sourceLibrary} en nombre interno ${entry.name}.`
            );
        }

        const lower = entry.name.toLowerCase();

        if (
            lower.endsWith('.json') ||
            lower.endsWith('.xml') ||
            lower.endsWith('.txt')
        ) {
            const text = entry.raw.toString('utf8');

            for (const mapping of mappings) {
                if (containsToken(text, mapping.source)) {
                    fail(
                        `Quedó source Part ID ${mapping.source} dentro de ${entry.name}.`
                    );
                }
            }

            if (
                sourceLibrary !== '' &&
                text.includes(sourceLibrary)
            ) {
                fail(
                    `Quedó library fuente ${sourceLibrary} dentro de ${entry.name}.`
                );
            }
        }
    }

    if (fs.existsSync(output)) {
        fs.unlinkSync(output);
    }

    writeNitro(output, outputEntries);

    const result = {
        valid: true,
        input,
        output,
        entries: outputEntries.length,
        json_entries: jsonEntries,
        png_entries: pngEntries,
        mappings: Object.fromEntries(
            mappings.map((mapping) => [
                mapping.source,
                {
                    target: mapping.target,
                    replacements: mapping.replacements,
                },
            ])
        ),
        library_rename:
            sourceLibrary === ''
                ? null
                : {
                    source: sourceLibrary,
                    target: finalLibrary,
                    replacements: libraryReplacements,
                },
    };

    process.stdout.write(`${JSON.stringify(result)}\n`);
}

try {
    main();
} catch (error) {
    process.stderr.write(
        `${error && error.stack ? error.stack : String(error)}\n`
    );
    process.exit(1);
}
