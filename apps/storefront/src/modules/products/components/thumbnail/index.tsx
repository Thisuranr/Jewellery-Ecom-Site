import { clx } from "@modules/common/components/ui"
import Image from "next/image"
import React from "react"

import Placeholder, {
  PlaceholderType,
} from "@modules/common/components/placeholder"

type ThumbnailProps = {
  thumbnail?: string | null
  images?: { url?: string }[] | null
  /** Shown on hover (parent needs the `group` class), e.g. the second photo. */
  hoverImage?: string | null
  size?: "small" | "medium" | "large" | "full" | "square"
  isFeatured?: boolean
  className?: string
  alt?: string
  /** Motif shown when the product has no image (e.g. from its category). */
  placeholderType?: PlaceholderType
  "data-testid"?: string
}

const Thumbnail: React.FC<ThumbnailProps> = ({
  thumbnail,
  images,
  hoverImage,
  size = "small",
  className,
  alt = "",
  placeholderType = "generic",
  "data-testid": dataTestid,
}) => {
  const initialImage = thumbnail || images?.[0]?.url

  return (
    <div
      className={clx(
        "relative w-full overflow-hidden bg-surface",
        className,
        {
          "aspect-[4/5]": size !== "square",
          "aspect-[1/1]": size === "square",
          "w-[180px]": size === "small",
          "w-[290px]": size === "medium",
          "w-[440px]": size === "large",
          "w-full": size === "full",
        }
      )}
      data-testid={dataTestid}
    >
      {initialImage ? (
        <Image
          src={initialImage}
          alt={alt ?? ""}
          className="absolute inset-0 object-cover object-center"
          draggable={false}
          quality={50}
          sizes="(max-width: 576px) 280px, (max-width: 768px) 360px, (max-width: 992px) 480px, 800px"
          fill
        />
      ) : (
        <Placeholder type={placeholderType} fill />
      )}
      {initialImage && hoverImage && hoverImage !== initialImage && (
        <Image
          src={hoverImage}
          alt=""
          className="absolute inset-0 object-cover object-center opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-100"
          draggable={false}
          quality={50}
          sizes="(max-width: 576px) 280px, (max-width: 768px) 360px, (max-width: 992px) 480px, 800px"
          fill
        />
      )}
    </div>
  )
}

export default Thumbnail
