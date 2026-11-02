const ITEMS = [
  { title: "Australian business", text: "Based and shipping in Australia" },
  { title: "Secure checkout", text: "Payments by Stripe" },
  { title: "Easy returns", text: "Within 30 days" },
  { title: "Made to order", text: "Custom pieces, made for you" },
]

export default function TrustRow() {
  return (
    <section className="content-container py-14 small:py-20">
      <ul className="grid grid-cols-2 gap-x-6 gap-y-10 small:grid-cols-4">
        {ITEMS.map((i) => (
          <li
            key={i.title}
            className="text-center small:border-l small:border-hairline small:first:border-l-0"
          >
            <p className="label text-ink">{i.title}</p>
            <p className="mt-2 text-[14px] font-normal text-muted">{i.text}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
