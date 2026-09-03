"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Archive, LayoutList, MessageSquareText, Package, Tags } from "lucide-react";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/products", label: "Products", icon: Package },
  { href: "/categories", label: "Categories", icon: Tags },
  { href: "/reviews", label: "Reviews", icon: MessageSquareText },
];

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="space-y-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-white/10 text-white"
                : "text-sidebar-foreground hover:bg-white/5 hover:text-white"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function SidebarBrand() {
  return (
    <div className="flex items-center gap-2 px-1">
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-sm font-bold text-white">
        FG
      </span>
      <div className="leading-tight">
        <p className="text-sm font-semibold text-white">Fusion Gadgets</p>
        <p className="text-[11px] text-sidebar-foreground">Admin</p>
      </div>
    </div>
  );
}

export { Archive, LayoutList };
