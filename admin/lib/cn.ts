import { clsx, type ClassValue } from "clsx";

/**
 * Class-name merge helper. Lives in a plain (non-"use client") module so
 * BOTH Server Components and Client Components can import it — plain
 * function exports of "use client" modules are not callable from server
 * components.
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
