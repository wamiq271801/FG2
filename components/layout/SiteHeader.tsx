"use client";

import { useState, useEffect } from "react";
import { Link } from "@/components/shared/Link";
import { usePathname } from "next/navigation";
import { Menu, Search, ShoppingBag, Heart, User, X, LogOut, Package, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCartContext } from "@/providers/CartProvider";
import { useAuthContext } from "@/providers/AuthProvider";
import { SignOutButton } from "@/components/account/SignOutButton";
import { useWishlistSlugs } from "@/modules/wishlist";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/shop", label: "Shop" },
  { href: "/categories", label: "Categories" },
  { href: "/offers", label: "Offers" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { count } = useCartContext();
  const { user, state: authState } = useAuthContext();
  const { slugs: wishlistSlugs, ready: wishlistReady } = useWishlistSlugs();
  const wishlistCount = wishlistReady ? wishlistSlugs.length : 0;
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile sheet on route change
  useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/85 backdrop-blur-md">
      <div className="container-edge flex h-16 items-center gap-4">
        {/* Mobile menu */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden -ml-2"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[86%] max-w-sm overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="font-display text-xl">
                <Link href="/">Fusion Gadgets</Link>
              </SheetTitle>
            </SheetHeader>
            <div className="mt-6 flex flex-col gap-1">
              {navLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="rounded-md px-3 py-2.5 text-sm font-medium hover:bg-accent"
                >
                  {l.label}
                </Link>
              ))}
            </div>
            <div className="mt-6 border-t pt-4">
              {authState === "authenticated" && user ? (
                <div className="flex flex-col gap-1">
                  <Link href="/account" className="rounded-md px-3 py-2.5 text-sm hover:bg-accent">
                    My account
                  </Link>
                  <Link href="/orders" className="rounded-md px-3 py-2.5 text-sm hover:bg-accent">
                    Orders
                  </Link>
                  <Link href="/addresses" className="rounded-md px-3 py-2.5 text-sm hover:bg-accent">
                    Addresses
                  </Link>
                </div>
              ) : authState === "unauthenticated" ? (
                <div className="flex flex-col gap-1">
                  <Link href="/auth/signin" className="rounded-md px-3 py-2.5 text-sm hover:bg-accent">
                    Login
                  </Link>
                  <Link href="/auth/signup" className="rounded-md px-3 py-2.5 text-sm hover:bg-accent">
                    Create account
                  </Link>
                </div>
              ) : null}
            </div>
          </SheetContent>
        </Sheet>

        {/* Logo */}
        <Link
          href="/"
          className="font-display text-lg font-medium tracking-tight"
          aria-label="Fusion Gadgets home"
        >
          Fusion<span className="text-copper">.</span>
        </Link>

        {/* Desktop nav */}
        <nav className="ml-2 hidden items-center gap-1 lg:flex">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                pathname === l.href && "text-foreground"
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-1 items-center justify-end gap-1.5">
          {/* Search (desktop) */}
          <form
            action="/search"
            className="hidden md:flex items-center"
            role="search"
          >
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                name="q"
                placeholder="Search gadgets…"
                className="h-9 w-44 pl-9 lg:w-56"
                aria-label="Search products"
              />
            </div>
          </form>

          <Button
            variant="ghost"
            size="icon"
            asChild
            className="md:hidden"
            aria-label="Search"
          >
            <Link href="/search">
              <Search className="h-5 w-5" />
            </Link>
          </Button>

          {/* Wishlist */}
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="relative"
            aria-label={`Wishlist, ${wishlistCount} items`}
          >
            <Link href="/wishlist">
              <Heart className="h-5 w-5" />
              {wishlistCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-copper px-1 text-[10px] font-semibold text-copper-foreground">
                  {wishlistCount > 9 ? "9+" : wishlistCount}
                </span>
              )}
            </Link>
          </Button>

          {/* Cart */}
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="relative"
            aria-label={`Cart, ${count} items`}
          >
            <Link href="/cart">
              <ShoppingBag className="h-5 w-5" />
              {count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-copper px-1 text-[10px] font-semibold text-copper-foreground">
                  {count > 9 ? "9+" : count}
                </span>
              )}
            </Link>
          </Button>

          {/* Auth action — always the final rightmost item.
              During auth initialization, show nothing to avoid flashing Login/Profile. */}
          {authState === "authenticated" && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="press" aria-label="Account menu">
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="font-normal">
                  <p className="text-xs text-muted-foreground">Signed in as</p>
                  <p className="text-sm font-medium truncate">{user.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/account" className="flex items-center gap-2 cursor-pointer">
                    <User className="h-3.5 w-3.5" /> Account
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/orders" className="flex items-center gap-2 cursor-pointer">
                    <Package className="h-3.5 w-3.5" /> Orders
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/addresses" className="flex items-center gap-2 cursor-pointer">
                    <MapPin className="h-3.5 w-3.5" /> Addresses
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="p-0">
                  <SignOutButton variant="ghost" size="sm" className="w-full justify-start gap-2 px-2 text-muted-foreground hover:text-foreground" label="Sign out" />
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : authState === "unauthenticated" ? (
            <Button asChild variant="outline" size="sm" className="press shrink-0">
              <Link href="/auth/signin">Login</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
