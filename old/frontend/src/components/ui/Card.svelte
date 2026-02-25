<script lang="ts">
    import { cn } from "@/lib/utils";
    export let className: string = "";
</script>

<div
    class={cn(
        "rounded-xl border bg-card text-card-foreground shadow-sm",
        className,
    )}
    on:click
>
    <slot />
</div>
