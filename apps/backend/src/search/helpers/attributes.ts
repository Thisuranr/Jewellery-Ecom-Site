import type { SearchTypes } from "@medusajs/framework/types";
import {
  effectiveForCategories,
  type CategoryLink,
  type CategoryNode,
  type DefinitionForInheritance,
} from "../../modules/attributes/lib/effective-attributes";

/**
 * Attribute values and category ancestry in the product search index.
 *
 * `attr` holds one keyword per value of a FILTERABLE attribute:
 * `"<attribute handle>:<option handle>"` (select, multiselect),
 * `"<handle>:true|false"` (boolean) or `"<handle>:<number>"` (number). That is
 * the `value` the store category-attributes route hands the storefront, so the
 * filter UI can pass it straight back as a facet filter. Text attributes are
 * never indexed. The index does not depend on category-attribute links, so a
 * link change needs no reindex.
 */

export type AttrDefinition = {
  id: string;
  handle: string;
  type: string;
  filterable: boolean;
};

export type AttrOptionRow = { product_id: string; attribute_id: string; option_id: string };
export type AttrValueRow = {
  product_id: string;
  attribute_id: string;
  value_number: number | null;
  value_bool: boolean | null;
};

export type AttrData = {
  definitions: Record<string, AttrDefinition>;
  /** option id -> option handle */
  options: Record<string, string>;
  optionRows: Record<string, AttrOptionRow[]>;
  valueRows: Record<string, AttrValueRow[]>;
  /** product id -> ids of the attributes that apply to its CURRENT categories (links on a category or an ancestor). */
  applicable: Record<string, string[]>;
};

export type CategoryRow = {
  id?: string | null;
  name?: string | null;
  mpath?: string | null;
  is_active?: boolean | null;
  is_internal?: boolean | null;
};

export type CategoryFlags = Record<string, { is_active?: boolean | null; is_internal?: boolean | null }>;

const isHiddenFlag = (flag: { is_active?: boolean | null; is_internal?: boolean | null } | undefined) =>
  Boolean(flag) && (flag?.is_internal === true || flag?.is_active === false);

/**
 * The categories the shop front may show: not internal, active, and with no internal or inactive
 * ancestor (read from `mpath`). Internal and inactive names must never reach the public index.
 * `flags` holds every category's flags, so an ancestor's can be checked; a row's own fields win.
 */
export function publicCategories<T extends CategoryRow>(
  categories: (T | null | undefined)[] | null | undefined,
  flags: CategoryFlags = {},
): T[] {
  const out: T[] = [];
  for (const category of categories ?? []) {
    if (!category) {
      continue;
    }
    const chain = (category.mpath ?? "").split(".").filter(Boolean);
    if (category.id && !chain.includes(category.id)) {
      chain.push(category.id);
    }
    const hidden =
      isHiddenFlag(category) ||
      chain.some((id) => isHiddenFlag(id === category.id ? { ...flags[id], ...definedOnly(category) } : flags[id]));
    if (!hidden) {
      out.push(category);
    }
  }
  return out;
}

function definedOnly(category: CategoryRow) {
  return {
    ...(category.is_active === undefined || category.is_active === null ? {} : { is_active: category.is_active }),
    ...(category.is_internal === undefined || category.is_internal === null ? {} : { is_internal: category.is_internal }),
  };
}

/** At most 2 decimals, no trailing zeros (`6.3`). */
function formatNumber(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** The sorted, de-duplicated `attr` keywords of one product. */
export function toAttrValues(productId: string, data: AttrData): string[] {
  const out = new Set<string>();
  // Values left over from a category the product has since left are not indexed.
  const applies = new Set(data.applicable[productId] ?? []);

  for (const row of data.optionRows[productId] ?? []) {
    if (!applies.has(row.attribute_id)) {
      continue;
    }
    const definition = data.definitions[row.attribute_id];
    const option = data.options[row.option_id];
    if (definition?.filterable && option) {
      out.add(`${definition.handle}:${option}`);
    }
  }

  for (const row of data.valueRows[productId] ?? []) {
    const definition = data.definitions[row.attribute_id];
    if (!definition?.filterable || !applies.has(row.attribute_id)) {
      continue;
    }
    if (definition.type === "boolean" && typeof row.value_bool === "boolean") {
      out.add(`${definition.handle}:${row.value_bool}`);
    } else if (definition.type === "number" && typeof row.value_number === "number") {
      out.add(`${definition.handle}:${formatNumber(row.value_number)}`);
    }
  }

  return [...out].sort();
}

/**
 * The product's categories and every ancestor, from the `mpath` of each
 * (`"pcat_a.pcat_b"`), so a parent category's page finds its children's products.
 */
export function toCategoryIds(
  categories:
    | ({ id?: string | null; mpath?: string | null } | null)[]
    | null
    | undefined,
): string[] {
  const ids = new Set<string>();
  for (const category of categories ?? []) {
    if (!category) {
      continue;
    }
    if (category.id) {
      ids.add(category.id);
    }
    for (const id of (category.mpath ?? "").split(".")) {
      if (id) {
        ids.add(id);
      }
    }
  }
  return [...ids].sort();
}

/**
 * The public `category` names and `category_ids` of a product. Internal and inactive categories
 * (and anything under them) stay out of the public index.
 */
export function toCategoryFields(
  categories: (CategoryRow | null)[] | null | undefined,
  flags: CategoryFlags = {},
): { category: string[]; category_ids: string[] } {
  const visible = publicCategories(categories, flags);
  return {
    category: visible
      .map((c) => c.name?.trim())
      .filter((name): name is string => Boolean(name)),
    category_ids: toCategoryIds(visible),
  };
}

const ID_BATCH = 500;

async function readAll<T>(
  query: SearchTypes.SearchIngestionContext["container"]["query"],
  entity: string,
  fields: string[],
  filters?: Record<string, unknown>,
): Promise<T[]> {
  const { data } = await query.graph({ entity, fields, filters });
  return data as T[];
}

function groupByProduct<T extends { product_id: string }>(rows: T[]) {
  const grouped: Record<string, T[]> = {};
  for (const row of rows) {
    (grouped[row.product_id] ??= []).push(row);
  }
  return grouped;
}

/**
 * The attributes that apply to each product: links on its categories and their ancestors
 * (the same inheritance as the admin, `effective-attributes.ts`).
 */
async function loadApplicable(
  products: { id: string; categories?: (CategoryRow | null)[] | null }[],
  query: SearchTypes.SearchIngestionContext["container"]["query"],
): Promise<Record<string, string[]>> {
  const nodes: Record<string, CategoryNode> = {};
  const chainIds = new Set<string>();
  for (const product of products) {
    for (const category of product.categories ?? []) {
      if (category?.id) {
        nodes[category.id] = { id: category.id, mpath: category.mpath };
        chainIds.add(category.id);
        for (const id of (category.mpath ?? "").split(".")) {
          if (id) {
            chainIds.add(id);
          }
        }
      }
    }
  }
  const links: CategoryLink[] = [];
  const ids = [...chainIds];
  for (let i = 0; i < ids.length; i += ID_BATCH) {
    const rows = await readAll<{
      category_id: string;
      attribute_id: string;
      rank: number;
      required_override: boolean | null;
    }>(query, "category_attribute", ["category_id", "attribute_id", "rank", "required_override"], {
      category_id: ids.slice(i, i + ID_BATCH),
    });
    for (const row of rows) {
      links.push({ ...row, required_override: row.required_override ?? null });
    }
  }
  const definitions: Record<string, DefinitionForInheritance> = {};
  for (const link of links) {
    definitions[link.attribute_id] = { id: link.attribute_id, required: false };
  }
  const applicable: Record<string, string[]> = {};
  for (const product of products) {
    const categoryIds = (product.categories ?? []).flatMap((category) => (category?.id ? [category.id] : []));
    applicable[product.id] = effectiveForCategories(categoryIds, nodes, links, definitions).map(
      (entry) => entry.attribute_id,
    );
  }
  return applicable;
}

/** Every category's active and internal flags, to check a category's ancestors. */
export async function loadCategoryFlags({
  container,
}: SearchTypes.SearchIngestionContext): Promise<CategoryFlags> {
  const rows = await readAll<{ id: string; is_active: boolean | null; is_internal: boolean | null }>(
    container.query,
    "product_category",
    ["id", "is_active", "is_internal"],
  );
  const flags: CategoryFlags = {};
  for (const row of rows) {
    flags[row.id] = { is_active: row.is_active, is_internal: row.is_internal };
  }
  return flags;
}

/** Reads the filterable definitions and the given products' value rows. */
export async function loadAttrData(
  products: { id: string; categories?: (CategoryRow | null)[] | null }[],
  { container }: SearchTypes.SearchIngestionContext,
): Promise<AttrData> {
  const { query } = container;
  const ids = products.map((product) => product.id);
  const definitionRows = await readAll<AttrDefinition>(query, "attribute_definition", [
    "id",
    "handle",
    "type",
    "filterable",
  ]);
  const definitions: Record<string, AttrDefinition> = {};
  for (const definition of definitionRows) {
    if (definition.filterable) {
      definitions[definition.id] = definition;
    }
  }

  const optionRows: AttrOptionRow[] = [];
  const valueRows: AttrValueRow[] = [];
  for (let i = 0; i < ids.length; i += ID_BATCH) {
    const batch = ids.slice(i, i + ID_BATCH);
    optionRows.push(
      ...(await readAll<AttrOptionRow>(
        query,
        "product_attribute_option",
        ["product_id", "attribute_id", "option_id"],
        { product_id: batch },
      )),
    );
    valueRows.push(
      ...(await readAll<AttrValueRow>(
        query,
        "product_attribute_value",
        ["product_id", "attribute_id", "value_number", "value_bool"],
        { product_id: batch },
      )),
    );
  }

  const options: Record<string, string> = {};
  const optionIds = [...new Set(optionRows.map((row) => row.option_id))];
  for (let i = 0; i < optionIds.length; i += ID_BATCH) {
    const rows = await readAll<{ id: string; handle: string }>(
      query,
      "attribute_option",
      ["id", "handle"],
      { id: optionIds.slice(i, i + ID_BATCH) },
    );
    for (const row of rows) {
      options[row.id] = row.handle;
    }
  }

  return {
    definitions,
    options,
    optionRows: groupByProduct(optionRows),
    valueRows: groupByProduct(valueRows),
    applicable: await loadApplicable(products, query),
  };
}
