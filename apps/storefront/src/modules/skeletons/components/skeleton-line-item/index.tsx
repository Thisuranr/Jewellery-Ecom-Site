const SkeletonLineItem = () => {
  return (
    <div className="grid grid-cols-[88px_1fr_auto] gap-x-4">
      <div className="aspect-[4/5] w-full animate-pulse bg-surface-dark" />
      <div className="flex flex-col gap-y-2">
        <div className="h-4 w-32 animate-pulse bg-surface-dark" />
        <div className="h-4 w-24 animate-pulse bg-surface-dark" />
      </div>
      <div className="h-5 w-12 animate-pulse bg-surface-dark" />
    </div>
  )
}

export default SkeletonLineItem
