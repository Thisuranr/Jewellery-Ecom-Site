import { clx } from "@modules/common/components/ui"

type SearchFormProps = {
  countryCode: string
  defaultValue?: string
  className?: string
}

/** Plain GET form so search works without JavaScript and for browser agents. */
const SearchForm = ({ countryCode, defaultValue, className }: SearchFormProps) => (
  <form
    role="search"
    method="get"
    action={`/${countryCode}/search`}
    className={clx("flex gap-2", className)}
    {...{
      toolname: "search_products",
      tooldescription: "Search the store's products by keyword",
    }}
  >
    <label htmlFor="search-q" className="sr-only">
      Search products
    </label>
    <input
      id="search-q"
      type="search"
      name="q"
      defaultValue={defaultValue}
      placeholder="Search products"
      className="field flex-1"
    />
    <button
      type="submit"
      className="btn-solid"
    >
      Search
    </button>
  </form>
)

export default SearchForm
