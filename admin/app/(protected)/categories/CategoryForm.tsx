"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  createCategoryAction,
  updateCategoryAction,
  type CategoryFormState,
} from "./actions";
import type { CategoryInput } from "@/lib/data/categories";
import { NotifyBanner } from "@/components/NotifyBanner";
import { Field, FormMessage, Input, SubmitButton, Textarea } from "@/components/ui";

export function CategoryForm({
  mode,
  id,
  initial,
}: {
  mode: "create" | "edit";
  id?: string;
  initial?: CategoryInput;
}) {
  const action = mode === "create" ? createCategoryAction : updateCategoryAction;
  const [state, formAction] = useActionState<CategoryFormState, FormData>(action, null);
  const value = initial;

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {id && <input type="hidden" name="id" value={id} />}
      {state && "error" in state && <FormMessage kind="error">{state.error}</FormMessage>}
      {state && "success" in state && <FormMessage kind="success">{state.success}</FormMessage>}
      {state && "dbSuccess" in state && (
        <NotifyBanner
          dbMessage={state.dbSuccess}
          message={state.notify.message}
          event={state.event}
          redirectTo={state.retryRedirectTo}
        />
      )}

      <section className="rounded-lg border border-line bg-surface p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="name">
            <Input id="name" name="name" required defaultValue={value?.name} />
          </Field>
          <Field label="Slug" hint="URL identifier" htmlFor="slug">
            <Input id="slug" name="slug" required defaultValue={value?.slug} />
          </Field>
          <Field label="Tagline" htmlFor="tagline">
            <Input id="tagline" name="tagline" required defaultValue={value?.tagline} />
          </Field>
          <Field label="Accent" hint="hex or palette token" htmlFor="accent">
            <Input id="accent" name="accent" required defaultValue={value?.accent} />
          </Field>
          <Field label="Image URL" htmlFor="image">
            <Input id="image" name="image" type="url" required defaultValue={value?.image} />
          </Field>
          <Field label="Subcategories" hint="one per line" htmlFor="subcategories">
            <Textarea
              id="subcategories"
              name="subcategories"
              rows={4}
              defaultValue={value?.subcategories?.join("\n")}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-surface p-5">
        <div className="grid gap-4">
          <Field label="Description" htmlFor="description">
            <Textarea
              id="description"
              name="description"
              rows={3}
              required
              defaultValue={value?.description}
            />
          </Field>
          <Field label="Intro" hint="category page intro copy" htmlFor="intro">
            <Textarea id="intro" name="intro" rows={3} required defaultValue={value?.intro} />
          </Field>
          <Field label="SEO note" htmlFor="seo_note">
            <Textarea
              id="seo_note"
              name="seo_note"
              rows={2}
              required
              defaultValue={value?.seo_note}
            />
          </Field>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Saving…">
          {mode === "create" ? "Create category" : "Save changes"}
        </SubmitButton>
        <Link
          href="/categories"
          className="inline-flex h-9 items-center rounded-md border border-line bg-surface px-4 text-sm font-medium hover:bg-background"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
