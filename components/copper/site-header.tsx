import Link from "next/link";
import { Logo } from "@/components/copper/logo";
import { ModeToggle } from "@/components/copper/mode-toggle";

// `short` is the label on phones, so four links still fit a 375px screen.
const LINKS = [
  { href: "#products", label: "Products" },
  { href: "#plus", label: "Copper Plus", short: "Plus" },
  { href: "#privacy", label: "Privacy" },
  { href: "#ask", label: "Ask Copper", short: "Ask" },
];

export function SiteHeader() {
  return (
    <header
      data-testid="site-header"
      className="bg-background/90 sticky top-0 z-50 border-b backdrop-blur"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:gap-4">
        <Link href="/" aria-label="Copper State Labs home" className="shrink-0">
          <Logo className="w-28 sm:w-40" />
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-4">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-foreground/80 hover:text-primary rounded-md px-1 py-1 text-sm font-medium whitespace-nowrap transition-colors sm:px-2"
            >
              {link.short ? (
                <>
                  <span className="sm:hidden">{link.short}</span>
                  <span className="hidden sm:inline">{link.label}</span>
                </>
              ) : (
                link.label
              )}
            </a>
          ))}
          <ModeToggle />
        </nav>
      </div>
    </header>
  );
}
