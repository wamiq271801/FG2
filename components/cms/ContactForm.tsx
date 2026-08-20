"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";

const SUBJECT_OPTIONS = [
  "Order help",
  "Product question",
  "Returns & warranty",
  "Audition / store visit",
  "Press & partnerships",
  "Something else",
] as const;

const schema = z.object({
  name: z
    .string()
    .min(2, "Please enter your name (2+ characters)")
    .max(80, "That's a little long — please keep it under 80 characters"),
  email: z.email("Enter a valid email address"),
  subject: z.enum(SUBJECT_OPTIONS, {
    errorMap: () => ({ message: "Please pick a topic" }),
  }),
  message: z
    .string()
    .min(20, "A little more, please — at least 20 characters helps us help you")
    .max(2000, "Please keep it under 2000 characters"),
  // Honeypot — must stay blank. Bots tend to fill every field.
  company: z.string().max(0, "Leave this field empty").optional(),
});

type FormValues = z.infer<typeof schema>;

export function ContactForm() {
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      subject: undefined,
      message: "",
      company: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    setSubmitting(true);
    try {
      // Mock submission — pretend to POST. Replace with /api/contact when ready.
      await new Promise((resolve) => setTimeout(resolve, 700));

      // Simulate a rare failure path so the error UI is demoable.
      const fail = Math.random() < 0.0;
      if (fail) {
        setServerError(
          "We couldn't send your message just now. Please try again, or email us directly at contact@fusiongadgets.in."
        );
        setSubmitting(false);
        return;
      }

      setDone(true);
      toast.success("Message sent", {
        description: `Thanks, ${values.name.split(" ")[0]} — we'll be in touch within one business day.`,
      });
      reset();
    } catch {
      setServerError("Network error. Please try again, or call us.");
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div
        className="rounded-xl border border-copper/30 bg-copper/[0.04] p-6"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-copper" />
          <div className="text-sm leading-relaxed">
            <p className="font-medium">Your message is on its way.</p>
            <p className="mt-1 text-muted-foreground">
              We read every note that comes in. Expect a reply within one
              business day — usually a lot sooner. For urgent order questions,
              WhatsApp is fastest.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="press mt-4"
          onClick={() => {
            setDone(false);
            setSubmitting(false);
          }}
        >
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="space-y-5"
      aria-label="Contact form"
    >
      {serverError && (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="contact-name">
            Name <span className="text-copper">*</span>
          </Label>
          <Input
            id="contact-name"
            type="text"
            autoComplete="name"
            autoFocus
            placeholder="Aakash Desai"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "contact-name-error" : undefined}
            {...register("name")}
          />
          {errors.name && (
            <p
              id="contact-name-error"
              role="alert"
              className="text-sm text-destructive"
            >
              {errors.name.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contact-email">
            Email <span className="text-copper">*</span>
          </Label>
          <Input
            id="contact-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "contact-email-error" : undefined}
            {...register("email")}
          />
          {errors.email && (
            <p
              id="contact-email-error"
              role="alert"
              className="text-sm text-destructive"
            >
              {errors.email.message}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact-subject">
          What's this about? <span className="text-copper">*</span>
        </Label>
        <select
          id="contact-subject"
          defaultValue=""
          aria-invalid={!!errors.subject}
          aria-describedby={
            errors.subject ? "contact-subject-error" : undefined
          }
          {...register("subject")}
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:border-destructive"
        >
          <option value="" disabled>
            Pick a topic…
          </option>
          {SUBJECT_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        {errors.subject && (
          <p
            id="contact-subject-error"
            role="alert"
            className="text-sm text-destructive"
          >
            {errors.subject.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact-message">
          Message <span className="text-copper">*</span>
        </Label>
        <Textarea
          id="contact-message"
          rows={6}
          placeholder="Tell us what you're trying to do, what you've already tried, and any order numbers — the more context, the faster we can help."
          aria-invalid={!!errors.message}
          aria-describedby={
            errors.message ? "contact-message-error" : "contact-message-hint"
          }
          {...register("message")}
        />
        {!errors.message ? (
          <p
            id="contact-message-hint"
            className="text-xs text-muted-foreground"
          >
            20 characters minimum. We read everything; nothing goes to a bot.
          </p>
        ) : null}
        {errors.message && (
          <p
            id="contact-message-error"
            role="alert"
            className="text-sm text-destructive"
          >
            {errors.message.message}
          </p>
        )}
      </div>

      {/* Honeypot: visually hidden, but present in the DOM. Real users never see it. */}
      <div className="hidden" aria-hidden="true">
        <Label htmlFor="contact-company">Company (leave blank)</Label>
        <Input
          id="contact-company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          {...register("company")}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          By sending, you agree to our{" "}
          <a
            href="/privacy"
            className="font-medium text-copper underline-offset-4 hover:underline"
          >
            privacy policy
          </a>
          . We never share your details.
        </p>
        <Button
          type="submit"
          disabled={submitting}
          className="press bg-foreground text-background hover:bg-foreground/90"
        >
          {submitting ? (
            <>
              <Loader2 className="animate-spin" />
              Sending…
            </>
          ) : (
            "Send message"
          )}
        </Button>
      </div>
    </form>
  );
}
