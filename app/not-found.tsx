import { Link } from "@/components/shared/Link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="container-edge flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        404
      </p>
      <h1 className="mt-3 font-display text-4xl tracking-tight md:text-5xl">
        This page is off the shelf.
      </h1>
      <p className="mt-4 max-w-md text-pretty text-muted-foreground">
        The page you're looking for doesn't exist — or it's been moved. Let's
        get you back to something worth your time.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button asChild className="press">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" /> Back home
          </Link>
        </Button>
        <Button asChild variant="ghost" className="press">
          <Link href="/shop">Browse the shop</Link>
        </Button>
      </div>
    </div>
  );
}
