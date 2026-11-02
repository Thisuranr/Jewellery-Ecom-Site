import { MedusaContainer } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { ATTRIBUTES_MODULE } from "../modules/attributes";
import AttributesModuleService from "../modules/attributes/service";
import {
  createAttributeWorkflow,
  setAttributeCategoriesWorkflow,
} from "../workflows/attributes";
import type { CreateAttributeInput } from "../workflows/attributes";

/**
 * The starting set of jewellery product fields (spec: docs/research/
 * jewellery-product-attributes.md). Staff edit, reorder and extend all of
 * them in Settings → Attributes, and can add a missing choice straight from
 * the product page ("+ Add new option").
 *
 * Each attribute is linked to the top-level categories it applies to;
 * subcategories inherit the link. Runs once, during `medusa db:migrate`.
 * Attributes whose handle already exists are skipped.
 */

type Seed = {
  handle: string;
  label: string;
  type: CreateAttributeInput["type"];
  group: "metal" | "stones" | "fit" | "details";
  unit?: string;
  filterable?: boolean;
  // [label, swatch hex?]
  options?: (string | [string, string])[];
  // Top-level category handles; "all" for every top-level category.
  categories: string[] | "all";
};

const NECKLACE_LIKE = ["necklaces-pendants", "bracelets-bangles", "anklets", "mens", "charms", "jewellery-sets"];

const SEEDS: Seed[] = [
  // Metal
  {
    handle: "material_type",
    label: "Material type",
    type: "select",
    group: "metal",
    filterable: true,
    options: [
      "Solid gold", "Gold plated", "Gold vermeil", "Gold-filled",
      "Sterling silver", "Silver plated", "Fine silver",
      "Platinum", "Palladium", "Stainless steel", "Titanium", "Tungsten",
      "Brass", "Copper", "Mixed metals",
    ],
    categories: "all",
  },
  {
    handle: "purity",
    label: "Purity",
    type: "select",
    group: "metal",
    filterable: true,
    options: [
      "9ct (375)", "10ct (417)", "14ct (585)", "18ct (750)", "22ct (916)", "24ct (999)",
      "Sterling silver (925)", "Fine silver (999)", "Platinum (950)", "Palladium (950)",
      "Not applicable",
    ],
    categories: "all",
  },
  {
    handle: "metal_colour",
    label: "Metal colour",
    type: "select",
    group: "metal",
    filterable: true,
    options: [
      ["Yellow", "#d4af37"], ["White", "#e8e8e8"], ["Rose", "#e0a899"],
      ["Silver", "#c0c0c0"], ["Black", "#222222"], ["Two-tone", "#cdb57a"], ["Tri-colour", "#d9b68f"],
    ],
    categories: "all",
  },
  {
    handle: "base_metal",
    label: "Base metal (under plating)",
    type: "select",
    group: "metal",
    options: ["Brass", "Sterling silver", "Stainless steel", "Copper", "Titanium", "Not applicable"],
    categories: "all",
  },
  { handle: "metal_weight", label: "Metal weight", type: "number", unit: "g", group: "metal", categories: "all" },
  { handle: "hallmark", label: "Hallmark / stamp", type: "text", group: "metal", categories: "all" },

  // Stones
  {
    handle: "stone_type",
    label: "Stone",
    type: "multiselect",
    group: "stones",
    filterable: true,
    options: [
      "No stone", "Diamond (natural)", "Diamond (laboratory-grown)", "Cubic zirconia", "Moissanite",
      "Crystal", "Freshwater pearl", "Akoya pearl", "South Sea pearl", "Opal",
      "Sapphire", "Ruby", "Emerald", "Amethyst", "Aquamarine", "Topaz", "Garnet",
      "Morganite", "Peridot", "Citrine", "Onyx", "Turquoise", "Enamel",
    ],
    categories: "all",
  },
  {
    handle: "stone_shape",
    label: "Stone shape",
    type: "multiselect",
    group: "stones",
    options: [
      "Round brilliant", "Princess", "Oval", "Emerald cut", "Cushion", "Pear", "Marquise",
      "Radiant", "Asscher", "Heart", "Baguette", "Cabochon",
    ],
    categories: "all",
  },
  { handle: "total_carat_weight", label: "Total carat weight", type: "number", unit: "ct", group: "stones", categories: "all" },
  {
    handle: "setting_style",
    label: "Setting style",
    type: "select",
    group: "stones",
    options: ["Claw (prong)", "Bezel", "Pavé", "Channel", "Halo", "Cluster", "Tension", "Flush", "Bar"],
    categories: "all",
  },
  {
    handle: "certificate",
    label: "Certificate",
    type: "select",
    group: "stones",
    options: ["None", "GIA", "IGI", "HRD", "AGS", "Store certificate"],
    categories: "all",
  },

  // Fit
  {
    handle: "chain_style",
    label: "Chain style",
    type: "select",
    group: "fit",
    filterable: true,
    options: [
      "Belcher", "Cable", "Trace", "Curb", "Box", "Rope", "Figaro", "Snake", "Paperclip",
      "Singapore", "Wheat", "Herringbone", "Bead (ball)", "Tennis",
    ],
    categories: NECKLACE_LIKE,
  },
  {
    handle: "clasp_type",
    label: "Clasp",
    type: "select",
    group: "fit",
    options: ["Lobster", "Bolt ring (spring ring)", "Toggle", "Box clasp", "Magnetic", "Hook", "Slider", "None"],
    categories: NECKLACE_LIKE,
  },
  {
    handle: "earring_back",
    label: "Earring back",
    type: "select",
    group: "fit",
    options: ["Butterfly (push back)", "Screw back", "Hinged (huggie)", "Hook", "Lever back", "Clip-on", "Threader"],
    categories: ["earrings", "mens", "jewellery-sets"],
  },
  { handle: "width", label: "Width", type: "number", unit: "mm", group: "fit", categories: "all" },

  // Details
  { handle: "hypoallergenic", label: "Hypoallergenic / nickel free", type: "boolean", group: "details", filterable: true, categories: "all" },
  {
    handle: "gender",
    label: "Gender",
    type: "select",
    group: "details",
    filterable: true,
    options: ["Women", "Men", "Unisex"],
    categories: "all",
  },
  {
    handle: "occasion",
    label: "Occasion",
    type: "multiselect",
    group: "details",
    filterable: true,
    options: ["Everyday", "Engagement", "Wedding", "Anniversary", "Birthday", "Gift", "Party"],
    categories: "all",
  },
];

/** Option handle: lowercase a-z0-9_ only, max 40, starts with a-z0-9. */
function optionHandle(label: string): string {
  return label
    .toLowerCase()
    .replace(/[éè]/g, "e")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export default async function jewelleryAttributes({
  container,
}: {
  container: MedusaContainer;
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const attributes: AttributesModuleService = container.resolve(ATTRIBUTES_MODULE);

  const { data: topCategories } = await query.graph({
    entity: "product_category",
    fields: ["id", "handle"],
    filters: { parent_category_id: null },
  });
  const categoryIdByHandle = new Map(topCategories.map((c) => [c.handle, c.id]));

  const existing = await attributes.listAttributeDefinitions({}, { select: ["handle"] });
  const existingHandles = new Set(existing.map((a) => a.handle));

  let rank = 0;
  for (const seed of SEEDS) {
    rank += 1;
    if (existingHandles.has(seed.handle)) {
      logger.info(`Attribute "${seed.handle}" exists, skipped.`);
      continue;
    }

    const { result } = await createAttributeWorkflow(container).run({
      input: {
        handle: seed.handle,
        type: seed.type,
        unit: seed.unit ?? null,
        group_handle: seed.group,
        filterable: seed.filterable ?? false,
        required: false,
        rank,
        label: { en: seed.label },
        options: (seed.options ?? []).map((option, i) => {
          const [label, swatch] = Array.isArray(option) ? option : [option, null];
          return {
            handle: optionHandle(label),
            label: { en: label },
            rank: i,
            swatch_hex: swatch,
          };
        }),
      },
    });

    const handles = seed.categories === "all" ? [...categoryIdByHandle.keys()] : seed.categories;
    const categoryIds = handles
      .map((h) => categoryIdByHandle.get(h))
      .filter((id): id is string => Boolean(id));

    if (categoryIds.length) {
      await setAttributeCategoriesWorkflow(container).run({
        input: {
          attribute_id: result.id,
          categories: categoryIds.map((category_id) => ({ category_id, rank })),
        },
      });
    }
  }
  logger.info("Finished seeding jewellery attributes.");
}
