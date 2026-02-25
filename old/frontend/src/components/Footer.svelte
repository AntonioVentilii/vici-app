<script lang="ts">
	import { Heart, Github, Twitter } from 'lucide-svelte';
</script>

<footer class="border-border bg-background border-t">
	<div class="container mx-auto px-4 py-8">
		<div class="grid grid-cols-1 gap-8 md:grid-cols-3">
			<!-- Brand -->
			<div class="space-y-3">
				<div class="flex items-center space-x-2">
					<img
						src="/assets/vici-coin-logo-transparent.dim_200x200.png"
						alt="Vici"
						class="h-8 w-8"
					/>
					<span class="text-foreground text-lg font-bold">Vici</span>
				</div>
				<p class="text-muted-foreground text-sm">
					Trade predictions with confidence. Built on the Internet Computer.
				</p>
			</div>

			<!-- Links -->
			<div class="space-y-3">
				<h3 class="text-foreground text-sm font-semibold">Resources</h3>
				<ul class="text-muted-foreground space-y-2 text-sm">
					<li>
						<a href="#" class="hover:text-foreground transition-colors"> How It Works </a>
					</li>
					<li>
						<a href="#" class="hover:text-foreground transition-colors"> Trading Guide </a>
					</li>
					<li>
						<a href="#" class="hover:text-foreground transition-colors"> FAQ </a>
					</li>
				</ul>
			</div>

			<!-- Community -->
			<div class="space-y-3">
				<h3 class="text-foreground text-sm font-semibold">Community</h3>
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

		<div class="border-border text-muted-foreground mt-8 border-t pt-6 text-center text-sm">
			<p class="flex items-center justify-center gap-1">
				© 2025. Built with <Heart size={16} class="fill-red-500 text-red-500" /> using{' '}
				<a
					href="https://caffeine.ai"
					target="_blank"
					rel="noopener noreferrer"
					class="text-foreground font-medium hover:underline"
				>
					caffeine.ai
				</a>
			</p>
		</div>
	</div>
</footer>
