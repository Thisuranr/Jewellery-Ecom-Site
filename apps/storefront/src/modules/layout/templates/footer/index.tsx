import { listCategories } from "@lib/data/categories"
import { STORE_NAME } from "@lib/store-name"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const link =
  "text-[14px] font-normal leading-6 text-ink underline decoration-transparent decoration-1 underline-offset-4 transition-colors duration-200 ease-out hover:decoration-ink"
const head = "label mb-5 block text-ink"

export default async function Footer() {
  const all = await listCategories({
    fields: "id,name,handle,rank,parent_category_id",
    limit: 200,
  }).catch(() => [])
  const categories = all
    .filter((c) => !c.parent_category_id)
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))

  return (
    <footer className="w-full border-t border-hairline bg-surface">
      <div className="content-container pt-16 small:pt-20">
        <div className="grid grid-cols-2 gap-x-6 gap-y-12 small:grid-cols-4 small:gap-x-12">
          <div data-testid="footer-categories">
            <span className={head}>Shop</span>
            <ul className="space-y-2">
              <li>
                <LocalizedClientLink href="/store" className={link}>
                  All jewellery
                </LocalizedClientLink>
              </li>
              {categories.map((c) => (
                <li key={c.id}>
                  <LocalizedClientLink
                    href={`/categories/${c.handle}`}
                    className={link}
                    data-testid="category-link"
                  >
                    {c.name}
                  </LocalizedClientLink>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <span className={head}>Help</span>
            <ul className="space-y-2">
              <li>
                <LocalizedClientLink href="/custom-order" className={link}>
                  Custom orders
                </LocalizedClientLink>
              </li>
              <li>
                <LocalizedClientLink href="/shipping" className={link}>
                  Shipping information
                </LocalizedClientLink>
              </li>
              <li>
                <LocalizedClientLink href="/returns" className={link}>
                  Returns
                </LocalizedClientLink>
              </li>
              <li>
                <LocalizedClientLink href="/contact" className={link}>
                  Contact
                </LocalizedClientLink>
              </li>
              <li>
                <LocalizedClientLink href="/search" className={link}>
                  Search
                </LocalizedClientLink>
              </li>
            </ul>
          </div>

          <div>
            <span className={head}>About</span>
            <ul className="space-y-2">
              {/* No About or Care pages yet: placeholders until they exist. */}
              <li>
                <a href="#" className={link}>
                  About us
                </a>
              </li>
              <li>
                <a href="#" className={link}>
                  Care guide
                </a>
              </li>
              <li>
                <LocalizedClientLink href="/terms" className={link}>
                  Terms of service
                </LocalizedClientLink>
              </li>
              <li>
                <LocalizedClientLink href="/privacy" className={link}>
                  Privacy policy
                </LocalizedClientLink>
              </li>
            </ul>
          </div>

          <div className="col-span-2 small:col-span-1">
            <span className={head}>Newsletter</span>
            <p className="mb-4 text-[14px] font-normal leading-6 text-muted">
              News and new pieces, by email. Sign-up opens soon.
            </p>
            <form
              aria-label="Newsletter (coming soon)"
              className="flex flex-col gap-y-3 sm:flex-row sm:gap-y-0"
            >
              <input
                type="email"
                disabled
                placeholder="Email address"
                aria-label="Email address"
                className="h-12 w-full min-w-0 border border-hairline bg-white px-4 text-[14px] font-normal placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-60"
              />
              <button
                type="submit"
                disabled
                className="label h-12 shrink-0 cursor-not-allowed border border-ink bg-ink px-6 text-white opacity-40 sm:border-l-0"
              >
                Subscribe
              </button>
            </form>
            <p className="mt-3 text-[12px] font-normal text-muted">
              Coming soon
            </p>
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-y-2 border-t border-hairline py-8 text-[12px] font-normal text-muted small:flex-row small:items-center small:justify-between">
          <p>
            © {new Date().getFullYear()} {STORE_NAME}
          </p>
          <p>Prices in AUD incl. GST</p>
        </div>
      </div>
    </footer>
  )
}
