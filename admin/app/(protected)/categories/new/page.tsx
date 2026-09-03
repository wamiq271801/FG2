import type { Metadata } from "next";
import { CategoryForm } from "../CategoryForm";

export const metadata: Metadata = { title: "New category" };

export default function NewCategoryPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">New category</h1>
        <p className="text-sm text-muted">Uses the existing categories schema.</p>
      </div>
      <CategoryForm mode="create" />
    </div>
  );
}
