import type { Metadata } from "next";
import { getBrandOptions, getCategoryOptions } from "@/lib/data/products";
import { ProductForm } from "../ProductForm";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  const [brandOptions, categoryOptions] = await Promise.all([
    getBrandOptions(),
    getCategoryOptions(),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">New product</h1>
        <p className="text-sm text-muted">
          Uses the existing catalog schema — SKU is generated automatically when left
          blank.
        </p>
      </div>
      <ProductForm
        mode="create"
        brandOptions={brandOptions}
        categoryOptions={categoryOptions}
      />
    </div>
  );
}
