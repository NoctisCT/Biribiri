import { RoomObjectCategory } from '@nitrots/nitro-renderer';
import { FC, useEffect, useState } from 'react';
import { ACTION_SEGUIDOR_ANIMACIONES, addPokemonResultListener, interactWithFollower, sendPokemonCommand } from '../../../../api/pokemon/PokemonEngineAdapter';
import { ContextMenuView } from '../context-menu/ContextMenuView';
import { ContextMenuHeaderView } from '../context-menu/ContextMenuHeaderView';
import { ContextMenuListItemView } from '../context-menu/ContextMenuListItemView';

/**
 * El menu que sale al pulsar un Pokemon seguidor.
 *
 * La lista no esta escrita aqui: la manda el servidor, que la saca de
 * `pokemon_follower_animations`. Asi el dia que se anada una animacion nueva
 * aparece en el menu sin tocar el cliente.
 */

interface Gesto
{
    codigo: string;
    nombre: string;
}

interface PokemonFollowerMenuViewProps
{
    userId: number;
    objectId: number;
    nombre: string;
    onClose: () => void;
}

/** Veintidos acciones de golpe no caben: se pasan de seis en seis. */
const POR_PAGINA = 6;

let cache: Gesto[] = [];

export const PokemonFollowerMenuView: FC<PokemonFollowerMenuViewProps> = props =>
{
    const { userId = 0, objectId = 0, nombre = '', onClose = null } = props;
    const [ gestos, setGestos ] = useState<Gesto[]>(cache);
    const [ pagina, setPagina ] = useState(0);

    useEffect(() =>
    {
        const quitar = addPokemonResultListener(resultado =>
        {
            if(resultado.action !== ACTION_SEGUIDOR_ANIMACIONES) return;
            if(!resultado.success || !resultado.payload) return;

            const lista = (resultado.payload as any).animaciones as Gesto[];

            if(!Array.isArray(lista)) return;

            cache = lista;

            setGestos(lista);
        });

        if(!cache.length) sendPokemonCommand(ACTION_SEGUIDOR_ANIMACIONES);

        return quitar;
    }, []);

    const pedir = (codigo: string) =>
    {
        interactWithFollower(userId, codigo);

        if(onClose) onClose();
    };

    const paginas = Math.max(1, Math.ceil(gestos.length / POR_PAGINA));
    const actual = Math.min(pagina, paginas - 1);
    const visibles = gestos.slice(actual * POR_PAGINA, (actual * POR_PAGINA) + POR_PAGINA);

    return (
        <ContextMenuView
            objectId={ objectId }
            category={ RoomObjectCategory.UNIT }
            onClose={ onClose }
            classNames={ [ 'pokemon-follower-menu-root' ] }
            collapsable={ true }>
            <ContextMenuHeaderView>
                { nombre }
            </ContextMenuHeaderView>
            <div className="pokemon-follower-menu">
                { !gestos.length &&
                    <ContextMenuListItemView disabled={ true }>
                        Cargando...
                    </ContextMenuListItemView> }
                { visibles.map(gesto => (
                    <ContextMenuListItemView key={ gesto.codigo } onClick={ () => pedir(gesto.codigo) }>
                        { gesto.nombre }
                    </ContextMenuListItemView>
                )) }
                { (paginas > 1) &&
                    <ContextMenuListItemView onClick={ () => setPagina((actual + 1) % paginas) }>
                        Siguiente ({ actual + 1 }/{ paginas })
                    </ContextMenuListItemView> }
            </div>
        </ContextMenuView>
    );
}
