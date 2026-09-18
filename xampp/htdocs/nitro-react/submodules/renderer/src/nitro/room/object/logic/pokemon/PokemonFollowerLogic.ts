import { RoomObjectMouseEvent } from '../../../../../events';
import { RoomObjectLogicBase } from '../../../../../room';

/**
 * La logica del seguidor.
 *
 * Es deliberadamente vacia: la posicion, la direccion y la animacion las decide
 * el servidor y las escribe el cliente en el modelo del objeto, asi que aqui no
 * hay nada que simular. Lo unico que aporta es declarar que el objeto escucha
 * clics, que es lo que permite pulsar el Pokemon y abrirle el menu.
 */
export class PokemonFollowerLogic extends RoomObjectLogicBase
{
    public getEventTypes(): string[]
    {
        return this.mergeTypes(super.getEventTypes(), [ RoomObjectMouseEvent.CLICK ]);
    }
}
