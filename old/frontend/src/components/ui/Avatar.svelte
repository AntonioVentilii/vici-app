<script lang="ts">
    import { cn } from "@/lib/utils";

    export let src: string | undefined = undefined;
    export let alt: string | undefined = undefined;
    export let fallback: string = "U";
    export let className: string = "";

    let imageLoaded = false;
    let imageError = false;

    $: showFallback = !src || imageError;
</script>

<div
    class={cn(
        "relative flex size-10 shrink-0 overflow-hidden rounded-full",
        className,
    )}
>
    {#if src && !imageError}
        <img
            {src}
            {alt}
            class="aspect-square size-full"
            on:load={() => (imageLoaded = true)}
            on:error={() => (imageError = true)}
        />
    {/if}

    {#if showFallback}
        <div
            class="bg-muted flex size-full items-center justify-center rounded-full bg-slate-200 text-slate-600 font-medium"
        >
            {fallback}
        </div>
    {/if}
</div>
