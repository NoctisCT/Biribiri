let active = false;

export function SetBuilderProSelectionModeActive(value: boolean): void
{
    active = value;
}

export function IsBuilderProSelectionModeActive(): boolean
{
    return active;
}
