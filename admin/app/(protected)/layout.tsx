import { redirect } from "next/navigation";
import { hasAdminSession } from "@/lib/auth";
import { SidebarBrand, SidebarNav } from "./SidebarNav";
import { signOutAction } from "./actions";
import { Button } from "@/components/ui";
import { LogOut } from "lucide-react";

// The admin is a private management tool: every page renders fresh per
// request (no caching of privileged data). This is the admin app's own
// rendering policy — the storefront's cache architecture is untouched.
export const dynamic = "force-dynamic";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await hasAdminSession())) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-10 flex w-56 flex-col gap-6 bg-sidebar px-3 py-4">
        <SidebarBrand />
        <SidebarNav />
        <div className="mt-auto">
          <form action={signOutAction}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="w-full justify-start text-sidebar-foreground hover:bg-white/5 hover:text-white"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Sign out
            </Button>
          </form>
        </div>
      </aside>
      <div className="ml-56 flex-1 min-w-0">
        <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
      </div>
    </div>
  );
}
