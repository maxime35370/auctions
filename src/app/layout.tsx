import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Auction Intelligence",
  description:
    "Assistant d'investissement spécialisé dans les enchères : analyse, rentabilité, scoring et historique.",
};

const NAV_LINKS = [
  { href: "/", label: "📊 Tableau de bord" },
  { href: "/analyse", label: "🔍 Nouvelle analyse" },
  { href: "/encheres", label: "📜 Historique" },
];

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className="antialiased min-h-screen">
        <header className="border-b border-edge bg-surface/80 backdrop-blur sticky top-0 z-10">
          <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 font-bold text-lg">
              <span className="text-accent">◆</span> Auction Intelligence
            </Link>
            <nav className="flex gap-1 text-sm">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-3 py-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 py-6 text-xs text-muted border-t border-edge">
          Auction Intelligence — assistant d&apos;investissement aux enchères.
          Les calculs sont indicatifs et ne constituent pas un conseil financier.
        </footer>
      </body>
    </html>
  );
}
