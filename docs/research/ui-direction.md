# Storefront UI direction: "simple but expensive"

Status: design brief, draft 1. Stack: Next.js 16 + Tailwind (Medusa DTC starter) + `next/font/google`. No paid assets.

## 0. How reliable is this research?

Honest limits first, so nobody over-trusts the brief.

- The sandbox network blocked almost everything. Mejuri, Monica Vinader, Missoma, Astrid & Miyu, Sarah & Sebastian, Pandora, Michael Hill, By Charlotte, Tiffany and Catbird either did not resolve or returned nothing. I could not read any site's HTML, CSS, fonts or menu markup, and I could not take screenshots.
- Only 3 web searches returned anything useful, and none gave first-hand markup. The one concrete finding: a third-party write-up describes Mejuri as a white canvas (#ffffff, off-white #f7f6f4), near-black ink, a grotesque sans with small-caps labels plus a mono accent, and sharp (square) corners. That is someone else's reading, not confirmed.
- Everything else below comes from general knowledge of how these brands look (Mejuri, Monica Vinader, Missoma, Astrid & Miyu, Catbird, Tiffany) and from the Baymard jewellery/luxury audit topics (menus, filters, product-page layout). Treat specifics as a well-informed starting point. Before the client signs off, someone should open 3 or 4 of the sites in a normal browser and check the menu and product page against section 2.
- Image hosts: `images.unsplash.com` and `images.pexels.com` both return **403 Forbidden** from this sandbox. See section 3.

## 1. What the best minimal-luxury jewellery sites have in common

| Pattern | Why it reads as "expensive" |
|---|---|
| White or warm off-white page, near-black text, almost no colour | The jewellery is the only colour on the page. Gold and silver pop. |
| Generous whitespace: big section gaps, narrow text columns | Space signals confidence. Cheap sites cram. |
| Few type styles. Small uppercase tracked labels, light serif or clean sans headlines | Restraint and consistency. |
| Hairline (1px, light grey) dividers instead of boxes, shadows or fills | Feels printed, not "app-like". |
| Square corners on buttons, inputs, images | Rounded pills feel mass-market. |
| Photography does the work: tall portrait images, consistent crop, even lighting, plain backgrounds | Uniform image grid looks curated. Mixed crops look cheap. |
| Quiet motion: 200-400ms fades, second product image on hover, no bouncing or zooming | Calm. |
| Short copy, few badges, no loud sale banners | Discounting is kept out of sight. |
| Menu is organised by what people shop for (product type first), with "shop by" columns and one or two images | Fast and confident. |
| Slim announcement bar (delivery, returns, gift message), one line | Trust without shouting. |
| Product page: big gallery on left, calm sticky info on right, material swatches, accordions for details/shipping/care | Details are there but tucked away. |
| Footer is calm: newsletter, 3-4 link columns, payment icons, tiny legal text | Never busy. |

## 2. Recommended direction for this store

Working name: "the store". Everything is tokenised so a rename or re-skin is a config change.

### 2.1 Fonts (both free on Google Fonts, via `next/font/google`)

| Role | Font | Weights | Use |
|---|---|---|---|
| Display / headings | **Cormorant Garamond** | 400, 500 (italic 400 for accents) | Hero line, section titles, page titles. Large sizes only (28px and up). Too thin for small text. |
| Body / UI | **Jost** | 300, 400, 500 | Everything else: nav, buttons, prices, product titles, forms. Futura-style, clean, premium. |

Alternative if the client wants no serif: Jost only, headings at weight 300.

Type scale (mobile / desktop):

| Style | Size | Font | Weight | Tracking | Case |
|---|---|---|---|---|---|
| Hero H1 | 40 / 72 px, line-height 1.05 | Cormorant | 400 | -0.01em | Sentence case |
| Section H2 | 28 / 40 px, lh 1.15 | Cormorant | 400 | 0 | Sentence case |
| Card / product title | 14 / 15 px | Jost | 400 | 0.01em | Sentence case |
| Price | 14 / 15 px | Jost | 400 | 0.02em | n/a |
| Body | 15 / 16 px, lh 1.65 | Jost | 300 or 400 | 0 | Sentence case |
| Nav, buttons, small labels | 11-12 px | Jost | 500 | 0.14-0.18em | **UPPERCASE** |
| Fine print | 12 px | Jost | 400 | 0.01em | Sentence case |

Uppercase only for: top nav items, buttons, filter and accordion labels, announcement bar, footer column heads. Never for product titles or paragraphs.

Tailwind: set `--font-display` and `--font-body` CSS variables in `layout.tsx`, map to `fontFamily.display` and `fontFamily.sans` in the theme.

### 2.2 Colour tokens

| Token | Hex | Use |
|---|---|---|
| `bg` | `#FFFFFF` | Page background |
| `surface` | `#F7F5F2` | Image placeholder, alternate sections, footer, drawers |
| `text` | `#111111` | Headings and body (soft black, not pure) |
| `muted` | `#6B6760` | Secondary text, captions, helper text (passes AA on white) |
| `hairline` | `#E7E3DC` | All 1px borders and dividers |
| `accent` | `#B08D57` | Muted champagne gold. Only for small touches: focus ring, star ratings, "New" text, swatch ring. Never for big fills or buttons. |
| `sale` | `#9B2C2C` | Sale price and discount text |
| `error` | `#B42318` | Form errors |
| `success` | `#2F6B4F` | Confirmations |

Buttons: primary = `text` fill, white text, square corners, 12px uppercase tracked label, hover goes to `#000` with 200ms fade. Secondary = 1px `text` border, transparent, hover fills `surface`.

### 2.3 Header and mega menu

**Desktop header** (height 72px, white, 1px hairline underneath, sticky; on scroll it stays but the announcement bar scrolls away):

- Row 0: announcement bar, 36px, `text` background or `surface`, one centred line in 11px uppercase tracked, e.g. "Free shipping over $150 AUD  |  Easy 30-day returns". Optional second message that fades every 6s.
- Row 1: left = main nav; centre = logo wordmark (Cormorant 400, tracked 0.2em for now); right = Search (icon + word on desktop), Account, Wishlist, Bag with count. Icons are 1.25px line style, 20px.
- Placing the logo centre with nav on the left is the common luxury layout. Fallback if nav is too long: two rows (logo centre on top, nav centred beneath).

**Top-level items** (left to right): New In | Rings | Earrings | Necklaces | Bracelets | Anklets | Charms | Men's | Sets | Custom Orders. Keep to 10 or fewer. Brooches sits inside the mega menu under "More", see below. A small "Gifts" item can be added later.

**Mega menu behaviour:** opens on hover (150ms intent delay, 200ms fade, no slide), also opens on keyboard focus/Enter. Full width, white, hairline top and bottom, no shadow. Max content width 1280px. Closes on mouse leave (150ms grace) or Esc. Layout: 4 text columns + 1 image tile (4:5, "Shop the edit" caption).

| Top item | Column 1 "Style" | Column 2 "Shop by material" | Column 3 "Shop by colour" | Image tile |
|---|---|---|---|---|
| **Rings** | Engagement, Wedding Bands, Eternity, Dress, Stacking | Gold Plated, Sterling Silver, Solid Gold | Yellow, White, Rose | Stacking rings |
| **Earrings** | Studs, Hoops, Huggies, Drops, Ear Cuffs | same | same | Hoops |
| **Necklaces** | Pendants, Chains, Chokers, Lockets | same | same | Pendants |
| **Bracelets** | Bracelets, Bangles, Tennis, Charm | same | same | Bangles |
| **Anklets** | (no sub-columns; opens a small panel) View all anklets, Gold Plated, Sterling Silver | | | none |
| **Charms** | Single link plus material shortcuts | | | none |
| **Men's** | Rings, Chains, Bracelets, Cufflinks | Sterling Silver, Gold Plated, Solid Gold | Yellow, White (rose rarely) | Men's chains |
| **Sets** | Single link plus material shortcuts | | | none |
| **Custom Orders** | Direct link to `/custom-orders` (no dropdown) | | | |

Rules:
- Each column starts with a "View all" link at the top (e.g. "All rings") in 500 weight.
- "Shop by" links are filter deep-links, e.g. `/rings?material=sterling-silver` and `/rings?colour=rose`. They only work if `material` and `colour` are filterable product attributes (matches the product-attributes research doc).
- Brooches: put under a "More" column on the Necklaces panel or as its own link in the footer and the mobile menu until there are enough products. Do not give it a top-level slot at launch.
- Hide any column or tile that has no products, so the menu never leads to empty pages.
- Text: 14px Jost 400, 10px vertical gap between links; column heads 11px uppercase tracked `muted`.

**Mobile menu:** hamburger on left, logo centre, bag (and search) on right. Tapping opens a full-height drawer from the left (300ms slide), white, with:
1. Search field at top.
2. Level-1 list of the same top items, 16px, 1px hairline between rows, chevron on the right for items with children.
3. Tapping an item slides to level 2 with a "< Back" row, "View all [category]" first, then style links, then "Shop by material" and "Shop by colour" as short groups.
4. Bottom: Account, Wishlist, Custom Orders, Contact, currency/country note (AUD, Australia).
Tap targets at least 48px high. Lock page scroll while open. No images in the mobile menu.

### 2.4 Home page (launch, no product photos)

Order:

1. Announcement bar.
2. Header.
3. **Hero** (full width, about 80vh desktop, 70vh mobile): tonal `surface` block (or a calm brand image once we have one) with a Cormorant headline, e.g. "Everyday jewellery, made to last", one line of sub-copy, two buttons: "Shop new in" and "Custom orders".
4. **Category tiles**: 4 across desktop (2 across mobile), 4:5 tiles for Rings, Earrings, Necklaces, Bracelets, with label under each in uppercase tracked. Second row optional: Anklets, Charms, Men's, Sets.
5. **Material strip**: three columns "Gold plated", "Sterling silver", "Solid gold", each with one sentence on what it is and a link. Explains the range and handles the "is this real gold?" question honestly.
6. **New in** product row: 4 cards, horizontal scroll on mobile. Hidden until there are products; use skeleton cards in the demo.
7. **Custom order band**: full-width `surface` section, headline "Something of your own?", short copy, button "Start a custom order".
8. **Trust row**: 3 or 4 small icon + text items: Free shipping over a threshold, 30-day returns, secure payment, 1-year care promise. Text-only is fine.
9. **Newsletter**: one line, email field, square button. No discount gimmick.
10. Footer.

Leave out at launch: reviews carousel, Instagram feed, countdown banners, pop-ups.

### 2.5 Component specs

**Product card**
- Image ratio 4:5, `surface` background, `object-cover`. Second image (worn or alternate view) fades in on hover over 300ms. No zoom.
- Under the image, left-aligned: title (14px, one line, truncate), then price. Third line optional: material in `muted`, e.g. "Sterling silver". Colour dots (10px, hairline ring) only if the product has colour variants.
- Badges: tiny uppercase text on the image corner, "New" or "Sale" only, no filled boxes.
- Wishlist heart: top-right of image, appears on hover on desktop, always visible on mobile.
- Price format: `$129.00` AUD, GST included, no cents trimming mix. Sale shows struck-through old price in `muted` plus new price in `sale`.

**Category page**
- Title (Cormorant 40px) + one-sentence intro, then a hairline.
- Toolbar row: left "Filter" button (with active count), centre/right result count, right "Sort" dropdown.
- Filters in a **left-sliding drawer** (not a permanent sidebar). Reason: keeps the grid wide and quiet, and it works the same on mobile. Drawer 400px wide, accordion groups in this order: Material, Colour (swatches), Price, Stone, Size (rings), Availability. Each group header is uppercase 12px with a +/- icon. Footer of drawer: "Clear all" and a black "View N items" button. Active filters show as small text chips with an x above the grid.
- Grid: 2 columns mobile, 3 tablet, 4 desktop, gutters 16px mobile and 24px desktop, row gap 48px.
- Pagination: "Load more" button with progress text ("Showing 24 of 96"), not infinite scroll.

**Product page**
- Desktop two columns: gallery 58% (left), info 42% (right, sticky below the header). Gallery is a vertical stack of 4:5 images (or 2-column grid) with thumbnails on mobile as a swipeable carousel with dots.
- Info column order: breadcrumb (small, above), title (Cormorant 32px), price (+ "GST included" note in `muted`), short description (2 lines), **material selector** (swatches: Gold plated / Sterling silver / Solid gold, shown as text pills with square corners; colour as 24px circles with hairline ring; selected = 1px `text` border), size selector with "Size guide" link (drawer), quantity, **Add to bag** (full-width black button), small line under it: stock / dispatch time, then "Enquire about customising" text link.
- Accordions below (one open at a time, hairline between): Details and materials, Shipping and returns, Care, Size guide. Plain text, no icons.
- Below: "You may also like" row of 4 cards.
- Solid gold items: show weight and purity (e.g. "9ct, 1.8g") in Details. Gold plated: state the base metal and plating honestly.

**Cart: drawer, not page.** Right-side drawer, 420px, opens when an item is added. Contents: line items with 64px thumbnail, title, variant text, qty stepper, remove link; subtotal with "GST included"; shipping note; black "Checkout" button; "View bag" text link. A full `/cart` page still exists for direct visits, using the same components.

**Footer**
- Top hairline. Background `surface`. Four columns: Shop (categories), Help (shipping, returns, size guide, care, contact), About (our story, custom orders), Newsletter. Below: payment icons (Visa, Mastercard, Amex, Apple Pay, Google Pay, Afterpay if used), "Prices in AUD, GST included", store name and ABN placeholder, tiny legal links (Privacy, Terms, Returns). 12px, `muted`.

### 2.6 Micro-details that signal quality

- 1px `hairline` borders everywhere; no `box-shadow` except none at all (drawers use a 40% black overlay only).
- Corners: `rounded-none` for buttons, inputs, images, cards. Allowed: full circles for colour swatches only.
- Section vertical padding 96px desktop / 64px mobile. Page side gutters 16px mobile, 32px tablet, 48px desktop. Content max width 1440px.
- Images: product 4:5, category tiles 4:5, hero 16:9 desktop and 4:5 mobile, menu tile 4:5. Consistent everywhere.
- Hover: links get an underline that fades in (thickness 1px, offset 4px); buttons fade colour in 200ms; card image swaps over 300ms. Use `ease-out`. Honour `prefers-reduced-motion`.
- Focus: visible 2px `accent` outline with 2px offset (accessibility and a quiet gold touch).
- Page transitions: none. Skeletons use `surface`, no shimmer.
- Icons: one set, 1.25px stroke (e.g. lucide at `strokeWidth={1.25}`).
- No emoji, no stock badges like "Hot" or "Best seller" at launch.
- Alt text on all product images; `next/image` with proper `sizes` so pages stay light.
- Contrast: `muted` on white is 5:1 or better. Keep checks in the Tailwind theme.

## 3. Imagery for the demo

**Reachability result (curl -I from the sandbox):**

| Host | Result |
|---|---|
| `images.unsplash.com` | 403 Forbidden (blocked by the sandbox proxy) |
| `images.pexels.com` | 403 Forbidden (blocked by the sandbox proxy) |

So I could not verify any photo URLs and I am **not listing any**. Guessing URLs would be unreliable. To use real free photos later, download them on a normal machine from Unsplash or Pexels (both free to use, credit appreciated) and commit them under `storefront/public/demo/`, or ask for those two hosts to be allowed in the session network settings and I will pick and verify 6 to 10.

**Placeholder approach until real photos exist (no external files):**

1. A `<Placeholder ratio="4/5" label="Rings" />` component: `surface` (#F7F5F2) background, 1px hairline border, a thin line-art motif (ring, hoop, pendant, bangle) as inline SVG in `muted` at 40% opacity, centred. Four to eight motifs cover all categories.
2. Optional soft tonal gradient per material so cards do not all look identical: gold plated `#F3ECDD`, sterling silver `#EEF0F2`, solid gold `#F1E6C9`, rose `#F4E6E2`. Keep very pale.
3. Hero: plain `surface` block with large Cormorant headline, or a very slow gradient from `#F7F5F2` to `#EFE9DF`. No video.
4. Small "Demo image" text label in the corner (hidden in production by an env flag).
5. Swap path: the component takes an optional `src`. When Medusa product images exist, they render with `next/image`; otherwise the placeholder shows. This means no layout change when photos arrive.

## 4. Sources actually used

- Web search result (third-party Mejuri design write-up, not opened): https://www.webdesignhot.com/design.md/mejuri/
- Baymard jewellery audit listing (topics only): https://baymard.com/audits/jewelry-and-watches
- Baymard luxury goods audit listing (topics only): https://baymard.com/audits/luxury-goods
- Jewellery navigation article (snippet only): https://gemfind.com/blogs/web-design/jewelry-website-navigation-structure
- Tiffany UI article (snippet only): https://xgentech.net/blogs/resources/ecommerce-store-design-ui-ux-design-inspiration-from-tiffany-co
- Google Fonts CSS endpoint answered 200 (fonts reachable): https://fonts.googleapis.com/css2?family=Cormorant+Garamond

Not reachable from the sandbox (no data used): mejuri.com, monicavinader.com, missoma.com, astridandmiyu.com, sarahandsebastian.com, pandora.net, michaelhill.com.au, bycharlotte.com, tiffany.com.au, catbirdnyc.com, images.unsplash.com, images.pexels.com.
