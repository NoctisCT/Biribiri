import { FC, useState } from 'react';
import { LocalizeText, ReportState } from '../../../api';
import { Button, Column, Flex, Text } from '../../../common';
import { useHelp, useModTools } from '../../../hooks';


const CFH_CATEGORY_LABELS: Record<string, string> = {
    'cyber': 'Contenido sexual no consentido',
    'Cyber sex': 'Contenido sexual no consentido',
    'Contenido sexual': 'Contenido sexual no consentido',
    'scamming': 'Estafa',
    'Scamming': 'Estafa',
    'Estafas': 'Estafa',
    'badwords': 'Insultos discriminatorios o racistas',
    'Inappropriate words': 'Insultos discriminatorios o racistas',
    'Lenguaje inapropiado': 'Insultos discriminatorios o racistas',
    'badbehavior': 'Usuario incumpliendo las normas de Biribiri',
    'Bad behavior': 'Usuario incumpliendo las normas de Biribiri',
    'Mal comportamiento': 'Usuario incumpliendo las normas de Biribiri',
    'account': 'Necesito ayuda con mi cuenta',
    'Account Issues': 'Necesito ayuda con mi cuenta',
    'Problemas de cuenta': 'Necesito ayuda con mi cuenta',
    'hacking': 'Amenazas de hackeo',
    'Hacking': 'Amenazas de hackeo',
    'Hackeo': 'Amenazas de hackeo'
};

const CFH_TOPIC_LABELS: Record<number, string> = {
    1: 'Conversación sexual',
    2: 'Solicitar cibersexo',
    3: 'Ofrecer cibersexo',
    4: 'Envío de pornografía',
    5: 'Promoción de webs de estafa',
    6: 'Venta de objetos virtuales por dinero real',
    7: 'Robo de furnis o créditos',
    8: 'Robo de datos de cuenta',
    9: 'Estafas en apuestas',
    10: 'Nombre de sala',
    11: 'Descripción de sala',
    12: 'Nombre de usuario',
    13: 'Misión',
    14: 'Nombre de grupo o evento',
    15: 'Troleo',
    16: 'Bloqueo',
    17: 'Flood',
    18: 'Usuario demasiado joven',
    19: 'Suplantación del equipo',
    20: 'Lenguaje ofensivo',
    21: 'Discurso de odio',
    22: 'Violencia',
    23: 'Cambiar nombre de usuario',
    24: 'Problemas de pago',
    25: 'Conseguir gemas',
    26: 'Otro asunto',
    27: 'Amenaza de hackear Biribiri',
    28: 'Amenaza de hackear a un usuario',
    29: 'Furni modificado',
    30: 'Sala modificada',
    31: 'Usuario modificado',
    32: 'Otro caso de hackeo'
};

const GetCfhCategoryLabel = (name: string) =>
    CFH_CATEGORY_LABELS[name] ?? LocalizeText(`help.cfh.reason.${ name }`);

const GetCfhTopicLabel = (id: number) =>
    CFH_TOPIC_LABELS[id] ?? LocalizeText(`help.cfh.topic.${ id }`);

export const SelectTopicView: FC<{}> = props =>
{
    const [ selectedCategory, setSelectedCategory ] = useState(-1);
    const [ selectedTopic, setSelectedTopic ] = useState(-1);
    const { setActiveReport = null } = useHelp();
    const { cfhCategories = [] } = useModTools();

    const submitTopic = () =>
    {
        if((selectedCategory < 0) || (selectedTopic < 0)) return;

        setActiveReport(prevValue =>
        {
            return { ...prevValue, cfhCategory: selectedCategory, cfhTopic: cfhCategories[selectedCategory].topics[selectedTopic].id, currentStep: ReportState.INPUT_REPORT_MESSAGE };
        });
    }

    const back = () =>
    {
        setActiveReport(prevValue =>
        {
            return { ...prevValue, currentStep: (prevValue.currentStep - 1) };
        });
    }

    return (
        <>
            <Column gap={ 1 }>
                <Text fontSize={ 4 }>{ LocalizeText('help.emergency.chat_report.subtitle') }</Text>
                <Text>{ LocalizeText('help.cfh.pick.topic') }</Text>
            </Column>
            <Column gap={ 1 } overflow="auto">
                { (selectedCategory < 0) &&
                    cfhCategories.map((category, index) => <Button key={ index } variant="danger" onClick={ event => setSelectedCategory(index) }>{ GetCfhCategoryLabel(category.name) }</Button>) }
                { (selectedCategory >= 0) &&
                    cfhCategories[selectedCategory].topics.map((topic, index) => <Button key={ index } variant="danger" onClick={ event => setSelectedTopic(index) } active={ (selectedTopic === index) }>{ GetCfhTopicLabel(topic.id) }</Button>) }
            </Column>
            <Flex gap={ 2 } justifyContent="between">
                <Button variant="secondary" onClick={ back }>
                    { LocalizeText('generic.back') }
                </Button>
                <Button disabled={ (selectedTopic < 0) } onClick={ submitTopic }>
                    { LocalizeText('help.emergency.main.submit.button') }
                </Button>
            </Flex>
        </>
    );
}
