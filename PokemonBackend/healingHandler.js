/**
 * Motor de Soporte Médico y Farmacia - Módulo Unificado de Curación (Bot Joy + Mochila Consumibles)
 */
const statCalculator = require('./statCalculator');

// Diccionario de consumibles médicos oficiales indexados en el rango seguro (10-16)
const CONSUMABLES_DICTIONARY = {
    10: { name: 'Poción', healAmount: 20, isRevive: false },
    11: { name: 'Superpoción', healAmount: 50, isRevive: false },
    12: { name: 'Hiperpoción', healAmount: 200, isRevive: false },
    13: { name: 'Poción Máxima', healAmount: 'max', isRevive: false },
    14: { name: 'Restaurar Todo', healAmount: 'max', isRevive: false },
    15: { name: 'Revivir', healPercentage: 0.5, isRevive: true },
    16: { name: 'Max. Revivir', healPercentage: 1.0, isRevive: true }
};

/**
 * MÉTODO A: Restauración masiva instantánea en el Centro Pokémon (Bot/NPC) con coste de Moneda Pokémon
 */
function healTeamAtBot(ws, db, data) {
    const userId = data.userId;
    const PRECIO_CURACION = 50; // 💰 Coste en PokéDollars de la curación del bot

    if (!userId) {
        if (ws && ws.readyState === 1) {
            ws.send(JSON.stringify({
                type: 'HEAL_ERROR',
                message: '¡No se ha podido identificar al entrenador para iniciar el tratamiento médico!'
            }));
        }
        return;
    }

    if (ws.battle && !ws.battle.ended) {
        if (ws && ws.readyState === 1) {
            ws.send(JSON.stringify({
                type: 'HEAL_ERROR',
                message: '¡No puedes curar a tus Pokémon mientras estás en mitad de un combate en la ruta!'
            }));
        }
        return;
    }

    const singleQuery = `
        UPDATE pokemon_trainers t
        JOIN pokemon_storage s ON t.user_id = s.user_id
        SET t.money = t.money - ?,
            s.hp = s.max_hp
        WHERE t.user_id = ? AND t.money >= ? AND s.slot BETWEEN 1 AND 6
    `;

    db.query(singleQuery, [PRECIO_CURACION, userId, PRECIO_CURACION], (err, result) => {
        if (err) {
            console.error('[DATABASE ERROR] Fallo crítico en el tratamiento de la Enfermera Joy:', err);
            if (ws && ws.readyState === 1) {
                ws.send(JSON.stringify({
                    type: 'HEAL_ERROR',
                    message: 'La máquina de curación del Centro Pokémon ha sufrido un cortocircuito. Inténtalo de nuevo.'
                }));
            }
            return;
        }

        if (result.affectedRows === 0) {
            if (ws && ws.readyState === 1) {
                ws.send(JSON.stringify({
                    type: 'HEAL_ERROR',
                    message: `No se pudo procesar: O no tienes los ${PRECIO_CURACION} ₽ requeridos o tu equipo activo (Slots 1-6) está vacío.`
                }));
            }
            return;
        }

        console.log(`[CENTRO POKÉMON] Cobrados ${PRECIO_CURACION}₽ y salud restaurada por SQL para el Entrenador ID: ${userId}`);

        if (ws && ws.readyState === 1) {
            ws.send(JSON.stringify({
                type: 'TEAM_HEALED_BY_BOT',
                message: `¡Tu equipo Pokémon ha sido restaurado por completo por ${PRECIO_CURACION} ₽! ¡Vuelve cuando quieras! ❤️`
            }));
            ws.send(JSON.stringify({ type: 'REFRESH_PC_DATA', userId: userId }));
        }
    });
}

/**
 * MÉTODO B: Uso de medicinas individuales desde la Mochila (Pociones/Revivir)
 */
function processUseHealingItem(ws, db, data) {
    const { userId, itemId, pokemonStorageId } = data;

    const itemEffect = CONSUMABLES_DICTIONARY[itemId];
    if (!itemEffect) {
        if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'ITEM_ERROR', message: '¡Este objeto no se puede consumir o no está catalogado!' }));
        return;
    }

    if (ws.battle && !ws.battle.ended && ws.battle.type === 'PVP') {
        if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'ITEM_ERROR', message: '¡No puedes usar objetos de soporte médico en batallas clasificatorias PVP contra otros entrenadores!' }));
        return;
    }

    // 🔍 PASO 1: Verificamos inventario
    const invQuery = 'SELECT quantity FROM pokemon_inventory WHERE user_id = ? AND item_id = ?';
    db.execute(invQuery, [userId, itemId], (errInv, invRows) => {
        if (errInv || !invRows || invRows.length === 0 || invRows[0].quantity <= 0) {
            if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'ITEM_ERROR', message: `¡No te quedan unidades de ${itemEffect.name} en la mochila!` }));
            return;
        }

        // 🔍 PASO 2: Extraemos salud usando alias "pokedex_name" para evitar colisiones SQL
        const pokeQuery = `
            SELECT s.*, p.name AS pokedex_name, p.base_hp, p.base_attack, p.base_defense, p.base_sp_attack, p.base_sp_defense, p.base_speed
            FROM pokemon_storage s
            INNER JOIN pokemon_pokedex p ON s.pokemon_id = p.pokemon_id
            WHERE s.id = ? AND s.user_id = ?
        `;
        db.execute(pokeQuery, [pokemonStorageId, userId], (errPoke, pokeRows) => {
            if (errPoke || !pokeRows || pokeRows.length === 0) {
                if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'ITEM_ERROR', message: '¡No se ha encontrado al Pokémon objetivo en tu almacenamiento!' }));
                return;
            }

            const pokemon = pokeRows[0];
            const finalPokeName = pokemon.pokedex_name || pokemon.name || 'Pokémon';

            const baseStats = {
                base_hp: pokemon.base_hp,
                base_attack: pokemon.base_attack,
                base_defense: pokemon.base_defense,
                base_sp_attack: pokemon.base_sp_attack,
                base_sp_defense: pokemon.base_sp_defense,
                base_speed: pokemon.base_speed
            };
            const realStats = statCalculator.calculateStats(baseStats, pokemon);
            const maxHp = realStats.maxHp;

            if (pokemon.hp === 0 && !itemEffect.isRevive) {
                if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'ITEM_ERROR', message: `¡${finalPokeName} está debilitado! Las pociones no le harán efecto. Usa un Revivir.` }));
                return;
            }

            if (pokemon.hp > 0 && itemEffect.isRevive) {
                if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'ITEM_ERROR', message: `¡${finalPokeName} no está debilitado! No puedes usar un Revivir en él.` }));
                return;
            }

            if (pokemon.hp === maxHp) {
                if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'ITEM_ERROR', message: `¡La salud de ${finalPokeName} ya está al máximo de sus capacidades!` }));
                return;
            }

            // 🧮 PASO 3: Curación
            let finalHp = pokemon.hp;
            if (itemEffect.isRevive) {
                finalHp = Math.floor(maxHp * itemEffect.healPercentage);
            } else {
                if (itemEffect.healAmount === 'max') {
                    finalHp = maxHp;
                } else {
                    finalHp = Math.min(maxHp, pokemon.hp + itemEffect.healAmount);
                }
            }

            // 💾 PASO 4: Descontar ítem
            db.execute('UPDATE pokemon_inventory SET quantity = quantity - 1 WHERE user_id = ? AND item_id = ?', [userId, itemId], (errSubItem) => {
                if (errSubItem) return;

                let rivalActionLog = '';

                // ⚔️ PASO 5: Si está en combate, aplicamos curación en RAM y forzamos contraataque inmediato del rival
                if (ws.battle && !ws.battle.ended) {
                    const p = ws.battle.player;
                    const r = ws.battle.rival;

                    if (p && p.id === pokemonStorageId) {
                        p.hp = finalHp;
                    }

                    // IA ataca cruzando su estadística ofensiva con la defensiva de tu bicho activo
                    let rivalAtkStat = r.moveCategory === 'special' ? r.stats.spAttack : r.stats.attack;
                    let playerDefStat = r.moveCategory === 'special' ? p.stats.spDefense : p.stats.defense;

                    const baseValue = Math.floor((2 * r.level) / 5 + 2);
                    const splitCalc = Math.floor((baseValue * r.movePower * rivalAtkStat) / playerDefStat);
                    const preDamage = Math.floor(splitCalc / 50) + 2;
                    const randomFactor = (Math.floor(Math.random() * 16) + 85) / 100;
                    const rivalDmg = Math.floor(preDamage * randomFactor);

                    p.hp -= rivalDmg;
                    rivalActionLog = `¡El ${r.name} rival respondió con ${r.moveName} e infligió ${rivalDmg} de daño!`;

                    if (p.hp <= 0) {
                        p.hp = 0;
                        ws.battle.ended = true;
                        rivalActionLog += `\n¡Tu ${p.name} cayó debilitado! Has perdido el combate. 💀`;
                        ws.battle.turn = 'rival';
                    } else {
                        ws.battle.turn = 'player'; // Devuelve el control total al jugador para seguir atacando
                    }

                    // Sincronizamos daños colaterales del equipo en la base de datos
                    if (p.id === pokemonStorageId) {
                        finalHp = p.hp;
                    } else {
                        db.execute('UPDATE pokemon_storage SET hp = ? WHERE id = ?', [p.hp, p.id]);
                    }
                }

                // Guardamos salud definitiva en la base de datos
                db.execute('UPDATE pokemon_storage SET hp = ? WHERE id = ?', [finalHp, pokemonStorageId], (errHeal) => {
                    if (errHeal) return;

                    console.log(`[MOCHILA] Ítem ${itemEffect.name} consumido con éxito.`);

                    // 🥳 PASO 6: Payload unificada compatible con tu usePokemonSocket de React
                    if (ws && ws.readyState === 1) {
                        ws.send(JSON.stringify({
                            type: 'ITEM_CONSUMED_SUCCESS',
                            message: `¡Has usado ${itemEffect.name} en ${finalPokeName} con éxito! 💊`,
                            battle: ws.battle,
                            log: rivalActionLog || null
                        }));

                        ws.send(JSON.stringify({ type: 'REFRESH_PC_DATA', userId: userId }));
                    }
                });
            });
        });
    });
}

module.exports = {
    healTeamAtBot,
    processUseHealingItem
};