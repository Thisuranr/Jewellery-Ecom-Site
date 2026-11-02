const SkeletonProductPreview = () => {
  return (
    <div className="animate-pulse">
      <div className="aspect-[4/5] w-full bg-surface" />
      <div className="mt-4 flex flex-col gap-y-2">
        <div className="h-4 w-3/5 bg-surface" />
        <div className="h-4 w-1/4 bg-surface" />
      </div>
    </div>
  )
}

export default SkeletonProductPreview
