import { attrQuery, type NavFilterLink } from "@lib/util/navigation"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

// One honest line per material, keyed by the attribute option value.
const BLURBS: Record<string, string> = {
  "material_type:gold_plated": "A layer of gold over a base metal.",
  "material_type:sterling_silver": "925 sterling silver.",
  "material_type:solid_gold": "Gold all the way through.",
}
const TONES = ["#F3ECDD", "#EEF0F2", "#F1E6C9"]

export default function MaterialStrip({
  materials,
}: {
  materials: NavFilterLink[]
}) {
  return (
    <section className="bg-surface">
      <div className="content-container py-16 small:py-24">
        <h2 className="section-title mb-10 text-center">Shop by material</h2>
        <ul className="grid gap-4 small:grid-cols-3 small:gap-6">
          {materials.map((m, i) => (
            <li key={m.value}>
              <LocalizedClientLink
                href={`/store?${attrQuery(m.value)}`}
                className="group flex h-full min-h-[200px] flex-col items-center justify-center border border-hairline px-6 py-12 text-center transition-colors duration-300 ease-out hover:border-ink"
                style={{ backgroundColor: TONES[i % TONES.length] }}
                data-testid="home-material-tile"
              >
                <span className="font-display text-[30px] font-normal leading-tight text-ink small:text-[36px]">
                  {m.label}
                </span>
                {BLURBS[m.value] && (
                  <span className="mt-2 text-[14px] font-normal text-muted">
                    {BLURBS[m.value]}
                  </span>
                )}
                <span className="label mt-6 text-ink link-fade">Shop</span>
              </LocalizedClientLink>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
