type BuilderProItemLockRequestHandler = (
    itemIds: number[],
    enabled: boolean
) => boolean;

let handler: BuilderProItemLockRequestHandler | null =
    null;

export function SetBuilderProItemLockRequestHandler(
    next: BuilderProItemLockRequestHandler | null
): void
{
    handler = next;
}

export function RequestBuilderProItemLockChange(
    itemIds: number[],
    enabled: boolean
): boolean
{
    if(!handler)
    {
        return false;
    }

    return handler(
        itemIds,
        enabled
    );
}
