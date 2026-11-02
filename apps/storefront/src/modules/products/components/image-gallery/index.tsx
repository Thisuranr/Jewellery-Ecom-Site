import { HttpTypes } from "@medusajs/types"
import Image from "next/image"

import Placeholder, {
  PlaceholderType,
} from "@modules/common/components/placeholder"

type ImageGalleryProps = {
  images: HttpTypes.StoreProductImage[]
  placeholderType?: PlaceholderType
}

/** Stacked images: the first full width, the rest in pairs from 640px. */
const ImageGallery = ({
  images,
  placeholderType = "generic",
}: ImageGalleryProps) => {
  const shown = images.filter((image) => !!image.url)

  if (!shown.length) {
    return (
      <div
        className="relative aspect-[4/5] w-full overflow-hidden bg-surface"
        data-testid="product-gallery"
      >
        <Placeholder type={placeholderType} fill />
      </div>
    )
  }

  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      data-testid="product-gallery"
    >
      {shown.map((image, index) => (
        <div
          key={image.id}
          id={image.id}
          className={`relative aspect-[4/5] w-full overflow-hidden bg-surface ${
            index === 0 ? "sm:col-span-2" : ""
          }`}
        >
          <Image
            src={image.url}
            priority={index <= 1}
            alt={`Product image ${index + 1}`}
            fill
            sizes="(max-width: 1024px) 100vw, 55vw"
            className="object-cover"
          />
        </div>
      ))}
    </div>
  )
}

export default ImageGallery
