import type { NavCategory } from "@lib/util/navigation"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Placeholder, {
  placeholderTypeFromText,
} from "@modules/common/components/placeholder"

const TONES = ["light", "mid", "deep", "mid"] as const

export default function CategoryTiles({
  categories,
}: {
  categories: NavCategory[]
}) {
  // Two even rows of four on desktop.
  const tiles = categories.slice(0, 8)
  if (!tiles.length) return null

  return (
    <section className="content-container py-16 small:py-24">
      <h2 className="section-title mb-10 text-center">Shop by category</h2>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-10 small:grid-cols-4 small:gap-x-6 small:gap-y-12">
        {tiles.map((c, i) => (
          <li key={c.id}>
            <LocalizedClientLink
              href={`/categories/${c.handle}`}
              className="group block"
              data-testid="home-category-tile"
            >
              <div className="relative overflow-hidden">
                <Placeholder
                  type={placeholderTypeFromText(c.name, c.handle)}
                  tone={TONES[i % TONES.length]}
                  ratio="4 / 5"
                />
                <div className="pointer-events-none absolute inset-0 bg-ink/0 transition-colors duration-300 ease-out group-hover:bg-ink/[0.04]" />
              </div>
              <span className="label mt-4 block text-center text-ink link-fade">
                {c.name}
              </span>
            </LocalizedClientLink>
          </li>
        ))}
      </ul>
    </section>
  )
}
