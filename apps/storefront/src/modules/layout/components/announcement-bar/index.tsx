const AnnouncementBar = () => (
  <div className="bg-ink text-white" data-testid="announcement-bar">
    <p className="content-container flex min-h-9 flex-wrap items-center justify-center gap-x-2 py-2 text-center text-[10.5px] font-medium uppercase leading-4 tracking-[0.16em] small:text-[11px]">
      <span className="whitespace-nowrap">Shipping Australia-wide</span>
      <span aria-hidden className="hidden opacity-60 sm:inline">·</span>
      <span className="whitespace-nowrap">Custom pieces made to order</span>
    </p>
  </div>
)

export default AnnouncementBar
