import type { SearchTypes } from "@medusajs/framework/types";

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
};

/** At most 2 decimals, no trailing zeros (`6.3`). */
function formatNumber(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** The sorted, de-duplicated `attr` keywords of one product. */
export function toAttrValues(productId: string, data: AttrData): string[] {
  const out = new Set<string>();

  for (const row of data.optionRows[productId] ?? []) {
    const definition = data.definitions[row.attribute_id];
    const option = data.options[row.option_id];
    if (definition?.filterable && option) {
      out.add(`${definition.handle}:${option}`);
    }
  }

  for (const row of data.valueRows[productId] ?? []) {
    const definition = data.definitions[row.attribute_id];
    if (!definition?.filterable) {
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

/** Reads the filterable definitions and the given products' value rows. */
export async function loadAttrData(
  ids: string[],
  { container }: SearchTypes.SearchIngestionContext,
): Promise<AttrData> {
  const { query } = container;
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
  };
}
