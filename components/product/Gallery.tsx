"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

type Props = {
  images: string[];
  name: string;
  visualKey?: string;
  accent?: string;
};

/**
 * Gallery — thumbnails and secondary-image selection.
 *
 * The primary image is server-rendered by the page as a plain <img>. This
 * component manages thumbnail selection. When a thumbnail is clicked, it
 * locates the server-rendered main image via data-product-main-image and
 * swaps its src directly so the page content stays in sync without
 * re-rendering the entire server component tree.
 */
export function Gallery({ images, name }: Props) {
  const [active, setActive] = useState(0);
  const activeIndex = Math.min(active, Math.max(0, images.length - 1));

  function selectImage(index: number) {
    setActive(index);
    const mainImg = document.querySelector<HTMLImageElement>(
      "[data-product-main-image]"
    );
    if (mainImg && images[index]) {
      mainImg.src = images[index];
    }
  }

  if (images.length <= 1) return null;

  return (
    <div className="flex flex-wrap gap-2.5" role="list" aria-label={`${name} images`}>
      {images.map((src, i) => (
        <button
          key={src}
          type="button"
          role="listitem"
          aria-label={`View image ${i + 1} of ${name}`}
          aria-current={i === activeIndex}
          onClick={() => selectImage(i)}
          className={cn(
            "press relative h-[4.5rem] w-[4.5rem] overflow-hidden rounded-lg border bg-card",
            i === activeIndex
              ? "border-copper ring-1 ring-copper/30"
              : "border-border hover:border-copper/40"
          )}
        >
          <Image src={src} alt="" fill sizes="72px" className="object-cover" />
        </button>
      ))}
    </div>
  );
}
