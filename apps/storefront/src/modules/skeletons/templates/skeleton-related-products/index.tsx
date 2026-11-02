import repeat from "@lib/util/repeat"
import SkeletonProductPreview from "@modules/skeletons/components/skeleton-product-preview"

const SkeletonRelatedProducts = () => {
  return (
    <div>
      <div className="mb-10 h-9 w-56 animate-pulse bg-surface" />
      <ul className="grid grid-cols-2 gap-x-3 gap-y-10 sm:grid-cols-3 sm:gap-x-5 medium:grid-cols-4 medium:gap-x-6">
        {repeat(4).map((index) => (
          <li key={index} className={index > 1 ? "hidden sm:block" : ""}>
            <SkeletonProductPreview />
          </li>
        ))}
      </ul>
    </div>
  )
}

export default SkeletonRelatedProducts
