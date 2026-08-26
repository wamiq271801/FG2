"use client"

import { Toaster as Sonner, ToasterProps } from "sonner"

/**
 * App-wide Sonner toaster. The storefront ships a single light theme only,
 * so the toast theme is pinned to "light" (identical to the previous
 * next-themes-resolved value).
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
