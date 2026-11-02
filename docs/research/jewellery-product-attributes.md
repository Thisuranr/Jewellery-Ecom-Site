# Jewellery product attributes: Australian research

Purpose: give the admin "add product" form accurate, formal dropdown choices (each with an "Other (type your own)" option) for a Medusa v2 jewellery store selling in AUD.

## Read this first: how reliable is this?

- Most retailer sites (michaelhill.com.au, angusandcoote.com.au) could not be fetched: the sandbox blocked those domains. Michael Hill, Pandora and Tiffany/Mejuri pages were NOT read directly. Only search-result snippets were available.
- Mejuri, Blue Nile, Tiffany, Shiels, Pascoes, Larsen and Diamonds Factory were **not checked** (stop line and blocked network). Their category trees below are "industry-typical", not confirmed.
- Anything marked **(unconfirmed)** is standard industry knowledge but not verified from a source in this research. Verify before relying on it, especially legal points.

---

## 1. Category tree

Confirmed from search snippets: Michael Hill AU lists rings, earrings, bracelets and bangles, anklets, necklaces and pendants, chains, men's jewellery, watches, birthstones, wedding/bridal. Pandora AU core categories: charms, bracelets, rings, earrings, necklaces/pendants (plus brooches). Rest is typical industry structure **(unconfirmed per site)**.

| Top-level category | Common sub-categories |
|---|---|
| Rings | Engagement, Wedding bands, Eternity, Dress / cocktail, Signet, Stacking, Solitaire, Three-stone, Halo, Birthstone, Men's rings |
| Earrings | Studs, Hoops, Huggies, Drops / dangles, Sleepers, Climbers / ear cuffs, Pearl earrings |
| Necklaces and pendants | Pendants, Chains, Lockets, Chokers, Initial / name necklaces, Tennis necklaces |
| Bracelets and bangles | Bracelets, Bangles, Tennis bracelets, Charm bracelets, Cuffs, Anklets (or own top-level) |
| Charms | Charms, Beads / spacers (Pandora-style) |
| Men's | Rings, Chains, Bracelets, Cufflinks, Tie bars, Pendants |
| Other | Brooches, Cufflinks, Anklets, Body jewellery, Jewellery boxes / care, Gift cards |
| Watches | Only if stocked (Michael Hill does) |

**Collections vs categories**
- Categories = permanent "what is it" tree (browse navigation).
- Collections = curated, often seasonal or brand-led groups that cut across categories. Examples: Pandora "Moments", "Timeless", "Compose", "Liquid Silver" (from a retailer listing); bridal ranges; "Mother's Day", "Christmas gifts", "New arrivals", "Lab-grown diamond", "Birthstones".

**Common shop-by filters** (typical across AU sites): Metal (type and colour), Stone / gemstone, Diamond type (natural / lab-grown), Occasion (engagement, wedding, anniversary, birthday, Mother's Day, Christmas), Gender (women's / men's / unisex / kids), Price range, Style (solitaire, halo, vintage, minimalist, etc.), Birthstone month, Brand / collection, Ring size availability, Delivery (in stock vs made to order).

---

## 2. Metal

**Is it one field or two?** Sites show it as one combined display name ("18ct White Gold", "9ct Yellow Gold", "Sterling Silver", "Platinum"), but underneath it is best stored as separate fields: **metal family**, **purity**, **colour**. Reason: filtering and variants work better when separate. (Recommendation; combined display seen in Michael Hill snippets: "yellow gold, white gold, rose gold, sterling silver".)

**Spelling:** Australia uses "ct" / "carat" ("9ct"), not US "karat / K" ("14K"). Use "ct".

| Purity (AU label) | Fineness mark | Gold % | Notes |
|---|---|---|---|
| 9ct | 375 | 37.5% | Very common in AU; also written 9K in US |
| 10ct | 417 | 41.7% | Michael Hill sells "minimum 10ct" wedding bands (confirmed snippet) |
| 14ct | 585 | 58.5% | Less common in AU than in US |
| 18ct | 750 | 75% | Standard for fine / bridal |
| 22ct | 916 | 91.6% | Mostly Indian / traditional jewellery |
| 24ct | 999 | 99.9% | Pure gold, soft |

(Fineness numbers are standard values; the 375/585/750 pairs were only loosely supported by one weak source. Treat as correct but mark **unconfirmed by an authoritative source**.)

| Gold colour | Notes |
|---|---|
| Yellow | |
| White | Usually rhodium plated (needs re-plating) **(unconfirmed)** |
| Rose | Also called "pink" or "red" gold |
| Two-tone / Tri-colour | Mixed colours |

| Other metal | Fineness / note |
|---|---|
| Platinum | 950 (common standard) |
| Palladium | 950 |
| Sterling silver | 925 |
| Fine silver | 999 |
| Titanium | Common for men's bands |
| Tungsten / Tungsten carbide | Men's bands |
| Stainless steel | Fashion / men's |
| Ceramic, Black zirconium, Cobalt | Men's bands |
| Gold plated | Thin gold layer over base metal / silver |
| Gold vermeil | Gold over sterling silver (thick layer; definition varies) |
| Gold filled | Bonded gold layer over base metal, US-style term |
| Rhodium plated | Often on white gold / silver |
| Brass / bronze / base metal | Costume jewellery |

**Hallmarking in Australia (partly confirmed):**
- Australia has no mandatory government hallmarking system. Marking is voluntary / standards-based.
- **AS 2140** (Standards Australia, 2008 edition; sources conflict whether still current: one listing says reconfirmed 2021, another says withdrawn 2019, **unconfirmed**) covers marking of precious metal articles. It uses the **millesimal system** (parts per thousand, e.g. 375, 750, 925, 950) plus a metal symbol, rather than carats.
- A trade article says many retailers stamp only the carat purity ("9ct", "18ct") and this is not strictly compliant with the standard.
- Practical advice: the form should store both display label ("18ct") and fineness mark ("750").

---

## 3. Gemstones

**Stone type list (typical; per-site not confirmed):**

| Group | Values |
|---|---|
| Diamond | Natural diamond, Lab-grown diamond, Coloured / fancy diamond (natural or lab), Black diamond, Champagne / cognac diamond, Australian diamond (Argyle pink etc.) |
| Diamond alternatives | Moissanite, Cubic zirconia, White sapphire (lab) |
| Precious | Sapphire (blue, pink, yellow, white, parti; Australian sapphire is notable), Ruby, Emerald |
| Pearls | Akoya, South Sea (Australian, Broome), Tahitian, Freshwater, Keshi, Baroque |
| Semi-precious | Amethyst, Aquamarine, Topaz (blue / London blue / Swiss blue), Garnet, Peridot, Citrine, Tanzanite, Morganite, Opal (Australian: black, white, boulder), Turquoise, Onyx, Jade, Tourmaline, Zircon, Opal triplet / doublet |
| Other | Lab-grown sapphire / ruby / emerald, Crystal (Swarovski), Enamel, No stone |

**Diamond 4Cs (GIA scales confirmed from search results):**

| C | Standard values |
|---|---|
| Carat | Weight in carats (1 ct = 0.2 g). Show to 2 decimals. "TDW" or "TCW" = total diamond / carat weight across all stones (common in AU listings, **unconfirmed per site**) |
| Colour | D (colourless) to Z (light yellow / brown). Groups: D-F colourless, G-J near colourless, K-M faint |
| Clarity | FL, IF, VVS1, VVS2, VS1, VS2, SI1, SI2, I1, I2, I3 (11 grades, 10x magnification) |
| Cut grade (round brilliant) | Excellent, Very Good, Good, Fair, Poor (5 grades, GIA). Only GIA grades cut on round brilliants; fancy shapes are not graded by GIA. IGI and others also grade (Ideal / Excellent etc., **unconfirmed**) |

**Cut shapes:** Round brilliant, Princess, Oval, Emerald, Cushion, Pear, Marquise, Radiant, Asscher, Heart, Baguette, Trillion (also Old European / Rose cut for vintage style).

**Certification labs:** GIA, IGI, HRD, AGS (all asked about; usage by AU retailers **unconfirmed**). Others seen in AU: DGLA (Diamond Grading Laboratory of Australia, **unconfirmed**), SSEF / GRS for coloured stones.

**Setting styles:** Prong / claw (4 or 6), Bezel / rub-over, Halo, Pave, Micro-pave, Channel, Bar, Tension, Flush / gypsy, Cluster, Three-stone, Solitaire, Cathedral, Split shank, Hidden halo, Cup. (Industry-typical, **unconfirmed per site**.)

**Australian rules on disclosure (partly confirmed):**
- ACCC published *Advertising and Promotion in the Jewellery Industry: a guide to the Trade Practices Act* (2005). It says sellers must disclose treated gemstones and must use terms 'cultured', 'imitation', 'synthetic', 'created' correctly. It must not present artificial or imitation stones as natural. The guide predates the Australian Consumer Law; **whether it has been updated is unconfirmed**.
- Misleading-conduct rules in the Australian Consumer Law apply.
- Industry terminology guideline (Diamond Terminology Guideline, via Jeweller Magazine): accepts "synthetic", "laboratory-grown" or "laboratory-created" as qualifiers and advises against the abbreviated "lab-grown" / "lab-created" on their own. (Single trade-press source; **unconfirmed**.)
- Practical rule for the form: always show "Lab-grown diamond" (or "Laboratory-grown") as an explicit field in the title or specs, never just "diamond". Also show treatments (heat, fracture filled, irradiated, dyed) as a "Treatment" field.
- Get legal advice for final wording.

---

## 4. Sizes

**Australian ring sizes:** letter system (same family as UK BS 1927 per one source). Common women's range about H to Z, men's about R to Z+ (Z+1, Z+2 above Z). Typical circumference (mm), from Kate & Kole, with some other stores differing up to ~1.2 mm (so treat as approximate, **sources disagree**):

| Size | Circ. mm (approx) |
|---|---|
| H | 46.5 |
| I | 47.8 |
| J | 49 |
| K | 50.3 |
| L | 51.5 |
| S | 60.4 |
| T | 61.6 |
| U | 62.8 |
| V | 64.1 |
| W | 65.3 |
| X | 66.6 |
| Y | 67.8 |
| Z | 69.1 |
| Z+1 | ~70.4 to 71.0 |

Sizes M to R were not given consistently in the sources. Half sizes (e.g. N 1/2) exist and are widely used. Full list for the dropdown: F, G, H, H 1/2, I, ... Z, Z+1, Z+2, Z+3 **(unconfirmed exact range)**.

**How sites handle ring size (confirmed partly):**
- Ready-to-ship rings: size is a selectable option (Michael Hill product page shows "Select Size").
- Made-to-order rings: customer selects size, lead time shown.
- Made-to-order lead time seen: **2 to 4 weeks** (Austen Blake, Vyor).
- Resizing: Taylor and Hart one free resize within 6 months; My Jewellery Shop up to 2 sizes up/down free; engraved rings may incur a second engraving fee; some stores say custom/engraved rings cannot be resized (one customer report only).

**Necklace / chain lengths (cm), confirmed from Michael Hill and Thomas Sabo snippets:**

| Length | Typical position |
|---|---|
| 40 cm | Base of neck / collarbone (choker-ish, 35-40) |
| 45 cm | Common women's length, high necklines |
| 50 cm | Below collarbone |
| 55 cm | Mid |
| 60 cm | Mid-chest, above bust line |
| 70+ cm | Long / opera, 80-90 cm |

Michael Hill says popular range is 40 to 60 cm. Pendant drop is not included in chain length. Many sites also offer adjustable chains (e.g. 40/45 cm with extender).

**Bracelet lengths:** typically 16, 17, 18, 19, 20, 21 cm; tennis bracelets 17-19 cm. Bangles are sized by inner diameter (e.g. 60 mm, 63 mm, 65 mm) **(unconfirmed, not found in sources)**.

**Chain styles:** Cable (also "trace"), Curb, Belcher (the common Australian term, a rounder cable/rolo style; rolo also used), Figaro, Box, Rope, Snake, Wheat/Spiga, Singapore, Anchor/Marine, Herringbone, Ball/Bead. Confirmed in sources only: cable, rolo, box (The Silver Store) and curb. Rest is **unconfirmed**, standard terminology. Michael Hill has a separate chain style guide page that could not be read.

**Earring backs / fittings:** Butterfly (push) back, Screw back, Lever back, French hook / shepherd hook, Omega back, Hinged (huggie / sleeper), Clip-on, Friction back, Threaded post (flat-back). **(unconfirmed from sources.)**

**Weight:** listed in grams (g) for metal, carats for stones. Common to show "approx. weight" per item and per ring size.

---

## 5. Other fields commonly shown

| Field | What sites show |
|---|---|
| SKU | Numeric product code (Michael Hill uses 8-digit codes in URLs) |
| Dimensions | Width / height / drop / band width (mm), stone dimensions (mm) |
| Weight | Approx grams |
| Engraving | Available yes/no; character limit; font. Thomas Sabo has engravable collection. Specific character limits: **not found**, typically 10-20 per line **(unconfirmed)** |
| Made-to-order lead time | 2 to 4 weeks seen |
| Care instructions | Cleaning guidance per metal/stone |
| Certificate | Grading report for diamonds (GIA/IGI) when applicable. Whether stores include one: **not confirmed**; one store offers a 7-year guarantee conditional on 6-monthly checks |
| Gift packaging | Jewellery box often free (Thomas Sabo says includes free packaging) |
| Afterpay / Zip | Both seen on My Jewellery Shop; Afterpay on Vyor; Zip not confirmed there. Both are common in AU. Note: Stripe supports Afterpay/Clearpay for AU **(unconfirmed here, check Stripe docs)** |
| Returns / resizing | Policy text; personalised items may still be covered by Australian Consumer Law guarantees (Sprintlaw) |
| Warranty / guarantee | Years, conditions |
| Origin | e.g. Australian natural diamond, Australian sapphire |

---

## 6. Recommended mapping onto Medusa v2

Medusa v2 confirmed from docs snippets: products have options and variants; variants are the sellable combinations; categories, collections and tags exist; metadata is free JSON. Details of field names should be checked in the current v2 docs. (Medusa announced global product options, 2.17.0 per its blog, **unconfirmed details**.)

### What should be variants (affect price, SKU, stock)

| Option | Use as option? | Note |
|---|---|---|
| Metal (combined: "18ct White Gold", "9ct Yellow Gold", "Platinum", "Sterling Silver") | Yes | One option with combined values, because each is priced differently. Store metal family, purity and colour separately in variant metadata for filtering |
| Ring size | Yes, only for ready-to-ship stock rings | Gives real stock per size |
| Chain length | Yes | Different price and stock |
| Stone / carat size (e.g. 0.50 ct vs 1.00 ct) | Yes, when each is a separate price | Otherwise make it a separate product |

### Variant-explosion warning

Metal x purity x ring size multiplies fast. Example: 3 metals x 3 purities (as separate options) x 25 sizes = 225 variants per product. Mitigations:
1. Combine metal and purity into ONE option (about 4 to 6 values, not 4 x 3).
2. For made-to-order rings, do NOT make ring size a variant. Take it as a customer input at checkout (see below), with a price that does not depend on size.
3. Only make ring size a variant when you hold physical stock per size.
4. Different stone type or diamond grade (4Cs) = separate product, not an option, since each stone is unique.
5. Cap at about 3 options and about 50 variants per product.

### Fixed specifications (structured fields, not options)

Store as structured product metadata (or a custom module) with dropdowns plus "Other (type your own)":
- Metal family, purity label, fineness mark, colour, plating
- Stone type, natural vs lab-grown, treatment, shape, carat (single and TDW), colour, clarity, cut grade, certificate lab and number
- Setting style, number of stones
- Dimensions (mm), weight (g), band width
- Origin, hallmark
- Care instructions, warranty

Keep these as dropdown value lists from the tables above, so wording stays consistent and filterable. Validate that "Lab-grown" is always set for diamonds.

### Categories vs tags vs collections

| Concept | Use for |
|---|---|
| Categories (nested) | Product type tree: Rings > Engagement > Solitaire. One product, normally one leaf category |
| Collections | Curated sets: "Bridal", "Mother's Day", "Lab-grown diamonds", brand lines |
| Tags | Free attributes used for filters/search: occasion, gender, style, birthstone month, "gift under $200" |

### Customer inputs at checkout (not variants)

- Engraving text (with character limit and font; stored as line-item metadata)
- Ring size for made-to-order pieces
- Gift message / gift packaging choice
- Optional: finger measurement notes

### Other practical notes

- Show GST-inclusive AUD prices (10%).
- Show "made to order, 2 to 4 weeks" on the product when no stock.
- Make engraved / made-to-order items clearly final-sale-or-resize-rules in policy text.
- "Other (type your own)" values should be reviewed periodically and promoted to standard dropdown values.

---

## Sources (actually used)

- https://nz.kateandkole.com.au/products/complimentary-ring-resize (ring size chart, via search result)
- https://classa.com.au/pages/ring-size-conversion-chart (via search result)
- https://www.michaelhill.com.au/article/knowledge-advice/size-guide/chains (chain lengths, via search snippet only)
- https://www.michaelhill.com.au/p/cubic-zirconia-open-bypass-vine-ring-in-sterling-silver-21560965.html (size selector, via snippet)
- https://prod-sfcc.michaelhill.com.au/wedding (categories, 10ct minimum, via snippet)
- https://thomassabo.com.au/collections/all-items-engraving (engraving, packaging, via snippet)
- https://www.accc.gov.au/system/files/20050905%20Jewellery.pdf (ACCC 2005 guide, via snippet)
- https://www.accc.gov.au/media-release/accc-calls-for-fair-trading-in-jewellery-industry
- https://www.jewellermagazine.com/Article/3595/Synthetic-diamonds-are-not-the-enemy (terminology)
- https://jewelleryworld.net.au/news/standards-australia-launches-millesimal-system/ (AS 2140 millesimal)
- https://shop.standards.ie/en-ie/standards/as-2140-2008-125182_saig_as_as_275361/ (AS 2140:2008 listing)
- https://4cs.gia.edu/en-us/diamond-clarity/ and https://www.gia.edu/gia-about/4Cs-Clarity (clarity/colour scales)
- https://www.austenblake.com/about-us/contact-us and https://vyor.com.au/pages/frequently-asked-questions-faq (made-to-order lead times, Afterpay)
- https://taylorandhart.com/au/about-us/resizing-policy (resizing)
- https://myjewelleryshop.com.au/products/rose-gold-diamond-infinity-heart-ring (Afterpay/Zip)
- https://sprintlaw.com.au/articles/customer-terms-for-australian-jewellery-brands/ (consumer guarantees)
- https://docs.medusajs.com/v2/resources/commerce-modules/product (Medusa product module)
- https://jewellermagazine.com/Directory/881/Pandora (Pandora categories, collections)

Not reached: Pandora AU, Tiffany, Mejuri, Blue Nile, Angus and Coote, Shiels, Pascoes, Larsen, Diamonds Factory (blocked network or not searched). The two retailer hosts that failed were www.michaelhill.com.au and www.angusandcoote.com.au; they need to be allowed in the session network settings if direct reading is wanted.
