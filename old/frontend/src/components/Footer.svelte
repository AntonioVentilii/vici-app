<script lang="ts">
    import { Heart, Github, Twitter } from "lucide-svelte";
</script>

<footer class="border-t border-border bg-background">
    <div class="container mx-auto px-4 py-8">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
            <!-- Brand -->
            <div class="space-y-3">
                <div class="flex items-center space-x-2">
                    <img
                        src="/assets/vici-coin-logo-transparent.dim_200x200.png"
                        alt="Vici"
                        class="h-8 w-8"
                    />
                    <span class="text-lg font-bold text-foreground">Vici</span>
                </div>
                <p class="text-sm text-muted-foreground">
                    Trade predictions with confidence. Built on the Internet
                    Computer.
                </p>
            </div>

            <!-- Links -->
            <div class="space-y-3">
                <h3 class="text-sm font-semibold text-foreground">Resources</h3>
                <ul class="space-y-2 text-sm text-muted-foreground">
                    <li>
                        <a
                            href="#"
                            class="hover:text-foreground transition-colors"
                        >
                            How It Works
                        </a>
                    </li>
                    <li>
                        <a
                            href="#"
                            class="hover:text-foreground transition-colors"
                        >
                            Trading Guide
                        </a>
                    </li>
                    <li>
                        <a
                            href="#"
                            class="hover:text-foreground transition-colors"
                        >
                            FAQ
                        </a>
                    </li>
                </ul>
            </div>

            <!-- Community -->
            <div class="space-y-3">
                <h3 class="text-sm font-semibold text-foreground">Community</h3>
                <div class="flex space-x-3">
                    <a
                        href="#"
                        class="text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Twitter"
                    >
                        <Twitter size={20} />
                    </a>
                    <a
                        href="#"
                        class="text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="GitHub"
                    >
                        <Github size={20} />
                    </a>
                </div>
            </div>
        </div>

        <div
            class="mt-8 pt-6 border-t border-border text-center text-sm text-muted-foreground"
        >
            <p class="flex items-center justify-center gap-1">
                © 2025. Built with <Heart
                    size={16}
                    class="text-red-500 fill-red-500"
                /> using{" "}
                <a
                    href="https://caffeine.ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-foreground hover:underline font-medium"
                >
                    caffeine.ai
                </a>
            </p>
        </div>
    </div>
</footer>
