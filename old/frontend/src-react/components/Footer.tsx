import { SiGithub, SiX } from 'react-icons/si';
import { Heart } from 'lucide-react';

export default function Footer() {
	return (
		<footer className="border-border bg-background border-t">
			<div className="container mx-auto px-4 py-8">
				<div className="grid grid-cols-1 gap-8 md:grid-cols-3">
					{/* Brand */}
					<div className="space-y-3">
						<div className="flex items-center space-x-2">
							<img
								src="/assets/generated/vici-coin-logo-transparent.png"
								alt="Vici"
								className="h-8 w-8"
							/>
							<span className="text-foreground text-lg font-bold">Vici</span>
						</div>
						<p className="text-muted-foreground text-sm">
							Trade predictions with confidence. Built on the Internet Computer.
						</p>
					</div>

					{/* Links */}
					<div className="space-y-3">
						<h3 className="text-foreground text-sm font-semibold">Resources</h3>
						<ul className="text-muted-foreground space-y-2 text-sm">
							<li>
								<a href="#" className="hover:text-foreground transition-colors">
									How It Works
								</a>
							</li>
							<li>
								<a href="#" className="hover:text-foreground transition-colors">
									Trading Guide
								</a>
							</li>
							<li>
								<a href="#" className="hover:text-foreground transition-colors">
									FAQ
								</a>
							</li>
						</ul>
					</div>

					{/* Social */}
					<div className="space-y-3">
						<h3 className="text-foreground text-sm font-semibold">Community</h3>
						<div className="flex space-x-3">
							<a
								href="#"
								className="text-muted-foreground hover:text-foreground transition-colors"
								aria-label="Twitter"
							>
								<SiX className="h-5 w-5" />
							</a>
							<a
								href="#"
								className="text-muted-foreground hover:text-foreground transition-colors"
								aria-label="GitHub"
							>
								<SiGithub className="h-5 w-5" />
							</a>
						</div>
					</div>
				</div>

				<div className="border-border text-muted-foreground mt-8 border-t pt-6 text-center text-sm">
					<p className="flex items-center justify-center gap-1">
						© 2025. Built with <Heart className="h-4 w-4 fill-red-500 text-red-500" /> using{' '}
						<a
							href="https://caffeine.ai"
							target="_blank"
							rel="noopener noreferrer"
							className="text-foreground font-medium hover:underline"
						>
							caffeine.ai
						</a>
					</p>
				</div>
			</div>
		</footer>
	);
}
