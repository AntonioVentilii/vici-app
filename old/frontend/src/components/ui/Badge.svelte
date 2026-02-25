<script lang="ts">
    import { cn } from "@/lib/utils";
    import { cva, type VariantProps } from "class-variance-authority";

    const badgeVariants = cva(
        "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
        {
            variants: {
                variant: {
                    default:
                        "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
                    secondary:
                        "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
                    destructive:
                        "border-transparent bg-destructive text-destructive-foreground [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
                    outline:
                        "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
                    success:
                        "border-transparent bg-green-100 text-green-700 dark:bg-green-700/30 dark:text-green-400",
                },
            },
            defaultVariants: {
                variant: "default",
            },
        },
    );

    export let variant: VariantProps<typeof badgeVariants>["variant"] =
        "default";
    export let className: string = "";
</script>

<span class={cn(badgeVariants({ variant }), className || $$props.class)}>
    <slot />
</span>
