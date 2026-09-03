import { redirect } from "next/navigation";

// A management tool, not a dashboard — go straight to the work.
export default function AdminHome() {
  redirect("/products");
}
