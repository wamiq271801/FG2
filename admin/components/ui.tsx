"use client";

/**
 * Minimal UI primitives for the admin (hand-rolled, no component
 * library dependency). Functional first: consistent focus states,
 * disabled states, and pending feedback.
 */
import { clsx, type ClassValue } from "clsx";
import { useFormStatus } from "react-dom";
import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

// ── Button ────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "outline" | "ghost" | "danger" | "ok";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:pointer-events-none disabled:opacity-50";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white hover:bg-accent/90",
  outline: "border border-line bg-surface text-foreground hover:bg-background",
  ghost: "text-muted hover:bg-background hover:text-foreground",
  danger: "bg-danger text-white hover:bg-danger/90",
  ok: "bg-ok text-white hover:bg-ok/90",
};

const buttonSizes = {
  sm: "h-8 px-3",
  md: "h-9 px-4",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: keyof typeof buttonSizes;
}) {
  return (
    <button
      className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
      {...props}
    />
  );
}

/** Submit button with automatic pending state (useFormStatus). */
export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingLabel?: string;
  variant?: ButtonVariant;
  size?: keyof typeof buttonSizes;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || props.disabled}
      className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
      {...props}
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {pending ? (pendingLabel ?? "Working…") : children}
    </button>
  );
}

// ── Form fields ───────────────────────────────────────────────────────

export function Label({
  htmlFor,
  children,
  hint,
}: {
  htmlFor?: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">
      {children}
      {hint && <span className="ml-2 font-normal text-muted">{hint}</span>}
    </label>
  );
}

const fieldClasses =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:bg-background disabled:text-muted";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldClasses, "h-9")} {...props} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldClasses, "min-h-20")} {...props} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(fieldClasses, "h-9 pr-8")} {...props} />;
}

export function Checkbox({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-line text-accent focus:ring-accent/30"
        {...props}
      />
      {label}
    </label>
  );
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} hint={hint}>
        {label}
      </Label>
      {children}
    </div>
  );
}

// ── Feedback ──────────────────────────────────────────────────────────

export function FormMessage({
  kind,
  children,
}: {
  kind: "error" | "success" | "info";
  children: ReactNode;
}) {
  const styles = {
    error: "border-danger/30 bg-danger-soft text-danger",
    success: "border-ok/30 bg-ok-soft text-ok",
    info: "border-line bg-background text-muted",
  } as const;
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={cn("rounded-md border px-3 py-2 text-sm", styles[kind])}
    >
      {children}
    </div>
  );
}

// ── Badges ────────────────────────────────────────────────────────────

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-warn-soft text-warn",
    approved: "bg-ok-soft text-ok",
    rejected: "bg-danger-soft text-danger",
    active: "bg-ok-soft text-ok",
    inactive: "bg-background text-muted",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        styles[status] ?? "bg-background text-muted"
      )}
    >
      {status}
    </span>
  );
}

// ── Two-step destructive confirmation ─────────────────────────────────

export function ConfirmButton({
  children,
  confirmLabel = "Confirm",
  variant = "danger",
  size = "sm",
}: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children" | "type"> & {
  children: ReactNode;
  confirmLabel?: string;
  variant?: ButtonVariant;
  size?: keyof typeof buttonSizes;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      {confirming ? (
        <span className="inline-flex items-center gap-1">
          <SubmitButton
            variant={variant}
            size={size}
            aria-label={confirmLabel}
          >
            {confirmLabel}
          </SubmitButton>
          <Button type="button" variant="ghost" size={size} onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </span>
      ) : (
        <Button
          type="button"
          variant={variant === "danger" ? "outline" : variant}
          size={size}
          className={variant === "danger" ? "text-danger hover:bg-danger-soft" : undefined}
          onClick={() => setConfirming(true)}
        >
          {children}
        </Button>
      )}
    </>
  );
}

// ── Table helpers ─────────────────────────────────────────────────────

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-surface px-6 py-12 text-center text-sm text-muted">
      {children}
    </div>
  );
}

export function TableShell({ children }: { children: ReactNode }) {
  return (
    <div className="scroll-area overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full min-w-160 text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b border-line px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted",
        className
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <td className={cn("border-b border-line/60 px-3 py-2.5 align-middle", className)}>
      {children}
    </td>
  );
}
