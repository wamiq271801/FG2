"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  createProductAction,
  updateProductAction,
  type ProductFormState,
} from "./actions";
import { VISUAL_KEYS, type Option, type ProductInput } from "@/lib/product-constants";
import { NotifyBanner } from "@/components/NotifyBanner";
import {
  Checkbox,
  Field,
  FormMessage,
  Input,
  Select,
  SubmitButton,
  Textarea,
} from "@/components/ui";

export type ProductFormInitial = {
  id?: string;
  sku?: string;
  input: ProductInput;
};

export function ProductForm({
  mode,
  initial,
  brandOptions,
  categoryOptions,
}: {
  mode: "create" | "edit";
  initial?: ProductFormInitial;
  brandOptions: Option[];
  categoryOptions: Option[];
}) {
  const action = mode === "create" ? createProductAction : updateProductAction;
  const [state, formAction] = useActionState<ProductFormState, FormData>(action, null);
  const value = initial?.input;

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
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
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
          Basics
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="name">
            <Input id="name" name="name" required defaultValue={value?.name} />
          </Field>
          <Field label="Slug" hint="URL identifier" htmlFor="slug">
            <Input id="slug" name="slug" required defaultValue={value?.slug} />
          </Field>
          <Field label="Subtitle" htmlFor="subtitle">
            <Input id="subtitle" name="subtitle" required defaultValue={value?.subtitle} />
          </Field>
          {mode === "create" ? (
            <Field label="SKU" hint="blank = auto-generated" htmlFor="sku">
              <Input id="sku" name="sku" maxLength={10} defaultValue={value?.sku} />
            </Field>
          ) : (
            <Field label="SKU" hint="read-only">
              <Input value={initial?.sku ?? ""} disabled aria-label="SKU (read-only)" />
            </Field>
          )}
          <Field label="Brand" htmlFor="brand_id">
            <Select
              id="brand_id"
              name="brand_id"
              required
              defaultValue={value?.brand_id ?? ""}
            >
              <option value="">Pick a brand…</option>
              {brandOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Category" htmlFor="category_id">
            <Select
              id="category_id"
              name="category_id"
              required
              defaultValue={value?.category_id ?? ""}
            >
              <option value="">Pick a category…</option>
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Subcategory" hint="optional" htmlFor="subcategory">
            <Input id="subcategory" name="subcategory" defaultValue={value?.subcategory ?? ""} />
          </Field>
          <Field label="Tagline" htmlFor="tagline">
            <Input id="tagline" name="tagline" required defaultValue={value?.tagline} />
          </Field>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
          Content
        </h2>
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
          <Field label="Story" hint="optional" htmlFor="story">
            <Textarea id="story" name="story" rows={3} defaultValue={value?.story} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Highlights" hint="one per line" htmlFor="highlights">
              <Textarea
                id="highlights"
                name="highlights"
                rows={4}
                defaultValue={value?.highlights?.join("\n")}
                placeholder={"Fast charging\nCompact design"}
              />
            </Field>
            <Field label="In the box" hint="one per line" htmlFor="includes">
              <Textarea
                id="includes"
                name="includes"
                rows={4}
                defaultValue={value?.includes?.join("\n")}
                placeholder={"Charger\nUSB-C cable"}
              />
            </Field>
          </div>
          <Field label="Specs" hint="one “key: value” per line" htmlFor="specs">
            <Textarea
              id="specs"
              name="specs"
              rows={4}
              defaultValue={value?.specs
                ?.map((s) => `${s.key}: ${s.value}`)
                .join("\n")}
              placeholder={"Battery: 5000 mAh\nWeight: 240 g"}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
          Commerce
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Price" hint="integer, INR" htmlFor="price">
            <Input
              id="price"
              name="price"
              type="number"
              min={0}
              step={1}
              required
              defaultValue={value?.price ?? 0}
            />
          </Field>
          <Field label="Compare-at price" hint="optional, > price" htmlFor="compare_at_price">
            <Input
              id="compare_at_price"
              name="compare_at_price"
              type="number"
              min={1}
              step={1}
              defaultValue={value?.compare_at_price ?? ""}
            />
          </Field>
          <Field label="Stock" htmlFor="stock">
            <Input
              id="stock"
              name="stock"
              type="number"
              min={0}
              step={1}
              defaultValue={value?.stock ?? 0}
            />
          </Field>
          <Field label="Visual type" htmlFor="visual_key">
            <Select id="visual_key" name="visual_key" required defaultValue={value?.visual_key}>
              <option value="">Pick a type…</option>
              {VISUAL_KEYS.map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Accent" hint="hex or palette token" htmlFor="accent">
            <Input id="accent" name="accent" required defaultValue={value?.accent} />
          </Field>
          <div className="flex items-end gap-6 pb-1">
            <Checkbox
              name="is_active"
              label="Active"
              defaultChecked={value?.is_active ?? true}
            />
            <Checkbox
              name="is_preorder"
              label="Preorder"
              defaultChecked={value?.is_preorder ?? false}
            />
          </div>
          <Field label="Shipping" hint="optional" htmlFor="shipping">
            <Input id="shipping" name="shipping" defaultValue={value?.shipping} />
          </Field>
          <Field label="Warranty" hint="optional" htmlFor="warranty">
            <Input id="warranty" name="warranty" defaultValue={value?.warranty} />
          </Field>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Saving…">
          {mode === "create" ? "Create product" : "Save changes"}
        </SubmitButton>
        <Link
          href={mode === "create" ? "/products" : `/products/${initial?.id}`}
          className="inline-flex h-9 items-center rounded-md border border-line bg-surface px-4 text-sm font-medium hover:bg-background"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
