<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { fade, scale } from "svelte/transition";
    import { X } from "lucide-svelte";
    import { cn } from "../../lib/utils";

    export let open = false;
    export let className = "";

    const dispatch = createEventDispatcher();

    const close = () => {
        open = false;
        dispatch("close");
    };

    const handleBackdropClick = (e: MouseEvent) => {
        if (e.target === e.currentTarget) {
            // Don't close if it's the backdrop and we want to prevent it
            // The React code uses onPointerDownOutside={(e) => e.preventDefault()}
            // So let's allow opting out of backdrop close
        }
    };
</script>

{#if open}
    <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        transition:fade={{ duration: 200 }}
        on:click={handleBackdropClick}
    >
        <div
            class={cn(
                "relative w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl overflow-hidden",
                className,
            )}
            transition:scale={{ duration: 200, start: 0.95 }}
        >
            <slot />
        </div>
    </div>
{/if}
