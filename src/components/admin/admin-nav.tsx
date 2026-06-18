"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CamLogo } from "@/components/shared/cam-logo";

const LINKS = [
  { href: "/panel", label: "Panel" },
  { href: "/donantes", label: "Donantes" },
  { href: "/import", label: "Importar" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="mb-8 space-y-3">
      <div className="flex items-center gap-2">
        <CamLogo size={36} />
        <span className="font-display text-lg font-black uppercase tracking-widest">
          CAM Donaciones
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
      {LINKS.map((l) => {
        const active = path === l.href || path.startsWith(l.href + "/");
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-full border px-4 py-1.5 font-display text-sm uppercase tracking-wider transition-colors ${
              active
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
      </div>
    </nav>
  );
}
