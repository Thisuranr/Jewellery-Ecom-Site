import Image from "next/image"
import React from "react"

import { clx } from "@modules/common/components/ui"

export type PlaceholderType =
  | "ring"
  | "earring"
  | "necklace"
  | "bracelet"
  | "generic"

type PlaceholderProps = {
  type?: PlaceholderType
  /** A real image URL. When set, next/image is rendered instead of the motif. */
  src?: string | null
  alt?: string
  /** Pale tonal variant so a grid of placeholders does not look identical. */
  tone?: "light" | "mid" | "deep"
  /** Fills its parent (parent must be `relative`). Otherwise uses `ratio`. */
  fill?: boolean
  /** CSS aspect-ratio when not filling, e.g. "4 / 5". */
  ratio?: string
  sizes?: string
  priority?: boolean
  className?: string
  "data-testid"?: string
}

const TONES = {
  light: "#F7F5F2",
  mid: "#F1EDE6",
  deep: "#EBE6DD",
}

/** Guess a motif from category names/handles (e.g. "Earrings", "stud-earrings"). */
export const placeholderTypeFromText = (
  ...texts: (string | null | undefined)[]
): PlaceholderType => {
  const t = texts.filter(Boolean).join(" ").toLowerCase()
  if (/earring|stud|hoop|huggie|drop/.test(t)) return "earring"
  if (/necklace|pendant|chain|choker|locket/.test(t)) return "necklace"
  if (/bracelet|bangle|anklet|cuff/.test(t)) return "bracelet"
  if (/ring|band/.test(t)) return "ring"
  return "generic"
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.25,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
}

const Motif = ({ type }: { type: PlaceholderType }) => {
  switch (type) {
    case "ring":
      return (
        <g {...stroke}>
          <ellipse cx="50" cy="66" rx="22" ry="22" />
          <ellipse cx="50" cy="66" rx="17" ry="17" />
          <path d="M42 46 L38 38 L50 30 L62 38 L58 46" />
          <path d="M38 38 H62 M44 46 L50 30 L56 46" />
        </g>
      )
    case "earring":
      return (
        <g {...stroke}>
          <circle cx="36" cy="40" r="1.6" />
          <path d="M36 42 V50" />
          <path d="M36 50 C26 52 26 70 36 72 C46 70 46 52 36 50 Z" />
          <circle cx="64" cy="40" r="1.6" />
          <path d="M64 42 V50" />
          <path d="M64 50 C54 52 54 70 64 72 C74 70 74 52 64 50 Z" />
        </g>
      )
    case "necklace":
      return (
        <g {...stroke}>
          <path d="M24 28 C26 58 38 70 50 70 C62 70 74 58 76 28" />
          <path d="M50 70 V74" />
          <path d="M50 74 L44 82 L50 92 L56 82 Z" />
        </g>
      )
    case "bracelet":
      return (
        <g {...stroke}>
          <ellipse cx="50" cy="60" rx="26" ry="12" />
          <ellipse cx="50" cy="60" rx="21" ry="8.5" />
          <path d="M24 60 V50 C24 42 76 42 76 50 V60" />
        </g>
      )
    default:
      return (
        <g {...stroke}>
          <path d="M50 34 L62 46 L50 70 L38 46 Z" />
          <path d="M38 46 H62 M44 40 L50 46 L56 40 M50 46 V70" />
        </g>
      )
  }
}

/**
 * Pale tonal block with a fine line-art motif. Renders next/image when `src`
 * is given, so no layout changes once real photography arrives.
 */
const Placeholder: React.FC<PlaceholderProps> = ({
  type = "generic",
  src,
  alt = "",
  tone = "light",
  fill = false,
  ratio = "4 / 5",
  sizes = "(max-width: 768px) 50vw, 25vw",
  priority,
  className,
  "data-testid": dataTestid,
}) => {
  return (
    <div
      className={clx(
        "overflow-hidden text-[#6B6760]",
        fill ? "absolute inset-0" : "relative w-full",
        className
      )}
      style={{
        backgroundColor: TONES[tone],
        ...(fill ? {} : { aspectRatio: ratio }),
      }}
      data-testid={dataTestid}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover object-center"
          draggable={false}
        />
      ) : (
        <svg
          viewBox="0 0 100 125"
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 h-full w-full opacity-60 [&_*]:[vector-effect:non-scaling-stroke]"
          role={alt ? "img" : undefined}
          aria-label={alt || undefined}
          aria-hidden={alt ? undefined : true}
        >
          <g transform="translate(0 12.5) scale(1)">
            <Motif type={type} />
          </g>
        </svg>
      )}
    </div>
  )
}

export default Placeholder
