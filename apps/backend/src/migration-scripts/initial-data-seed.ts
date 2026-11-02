import { MedusaContainer } from "@medusajs/framework";
import { DEFAULT_REGION_STORE_POLICIES } from "../lib/region-store-policies";
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";
import {
  createApiKeysWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductOptionsWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createStockLocationsWorkflow,
  createStoresWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows";

/**
 * First-run data for the Australian jewellery store: one AUD store, one
 * Australia region paid through Stripe, prices that include 10% GST,
 * Australia-only shipping, the jewellery category tree and three sample
 * products. Runs once, during `medusa db:migrate`.
 *
 * Amounts are in dollars (Medusa v2 stores major units), GST included.
 */

// Category tree. The client can rename, reorder and add more in the admin.
const CATEGORY_TREE: { name: string; handle: string; children: string[] }[] = [
  { name: "Rings", handle: "rings", children: ["Engagement Rings", "Wedding Bands", "Eternity Rings", "Dress Rings", "Stacking Rings"] },
  { name: "Earrings", handle: "earrings", children: ["Studs", "Hoops", "Huggies", "Drops", "Ear Cuffs"] },
  { name: "Necklaces & Pendants", handle: "necklaces-pendants", children: ["Pendants", "Chains", "Chokers", "Lockets"] },
  { name: "Bracelets & Bangles", handle: "bracelets-bangles", children: ["Bracelets", "Bangles", "Tennis Bracelets", "Charm Bracelets"] },
  { name: "Anklets", handle: "anklets", children: [] },
  { name: "Charms", handle: "charms", children: [] },
  { name: "Brooches", handle: "brooches", children: [] },
  { name: "Men's", handle: "mens", children: ["Men's Rings", "Men's Chains", "Men's Bracelets", "Cufflinks"] },
  { name: "Jewellery Sets", handle: "jewellery-sets", children: [] },
];

function toHandle(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default async function initial_data_seed({
  container,
}: {
  container: MedusaContainer;
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const fulfillmentModuleService = container.resolve(
    ModuleRegistrationName.FULFILLMENT
  );

  const storeName = process.env.STORE_NAME || "Jewellery Store";

  logger.info("Seeding store data...");
  const {
    result: [defaultSalesChannel],
  } = await createSalesChannelsWorkflow(container).run({
    input: {
      salesChannelsData: [
        { name: "Online Store", description: "The website" },
      ],
    },
  });

  const {
    result: [publishableApiKey],
  } = await createApiKeysWorkflow(container).run({
    input: {
      api_keys: [
        {
          title: "Storefront",
          type: "publishable",
          created_by: "",
        },
      ],
    },
  });

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: {
      id: publishableApiKey.id,
      add: [defaultSalesChannel.id],
    },
  });

  await createStoresWorkflow(container).run({
    input: {
      stores: [
        {
          name: storeName,
          supported_currencies: [
            { currency_code: "aud", is_default: true, is_tax_inclusive: true },
          ],
          default_sales_channel_id: defaultSalesChannel.id,
        },
      ],
    },
  });

  logger.info("Seeding region data...");
  const { result: regionResult } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: "Australia",
          currency_code: "aud",
          countries: ["au"],
          // Stripe only. The system "manual" provider is left off on purpose
          // so no order can be placed without paying.
          payment_providers: ["pp_stripe_stripe"],
          automatic_taxes: true,
          // Australian prices are shown and stored including GST.
          is_tax_inclusive: true,
          metadata: DEFAULT_REGION_STORE_POLICIES,
        },
      ],
    },
  });
  const region = regionResult[0];
  logger.info("Finished seeding regions.");

  logger.info("Seeding tax regions...");
  await createTaxRegionsWorkflow(container).run({
    input: [
      {
        country_code: "au",
        provider_id: "tp_system",
        default_tax_rate: { rate: 10, name: "GST", code: "GST" },
      },
    ],
  });
  logger.info("Finished seeding tax regions.");

  logger.info("Seeding stock location data...");
  const { result: stockLocationResult } = await createStockLocationsWorkflow(
    container
  ).run({
    input: {
      locations: [
        {
          // Placeholder address; the client updates it in Settings → Locations.
          name: "Main Store",
          address: {
            city: "Sydney",
            province: "NSW",
            country_code: "AU",
            address_1: "",
          },
        },
      ],
    },
  });
  const stockLocation = stockLocationResult[0];

  await link.create({
    [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
    [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
  });

  logger.info("Seeding fulfillment data...");
  // Created by a core migration script.
  const { data: shippingProfileResult } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
  });
  const shippingProfile = shippingProfileResult[0];

  const fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
    name: "Australia delivery",
    type: "shipping",
    service_zones: [
      {
        name: "Australia",
        geo_zones: [{ country_code: "au", type: "country" }],
      },
    ],
  });

  await link.create({
    [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
    [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
  });

  const storeRules = [
    { attribute: "enabled_in_store", value: "true", operator: "eq" as const },
    { attribute: "is_return", value: "false", operator: "eq" as const },
  ];

  // Placeholder rates (GST included). The client sets real ones in
  // Settings → Locations & Shipping.
  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "Standard Shipping",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Standard",
          description: "Tracked delivery in 2–7 business days.",
          code: "standard",
        },
        prices: [
          { currency_code: "aud", amount: 10 },
          { region_id: region.id, amount: 10 },
        ],
        rules: storeRules,
      },
      {
        name: "Express Shipping",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Express",
          description: "Tracked express delivery in 1–3 business days.",
          code: "express",
        },
        prices: [
          { currency_code: "aud", amount: 18 },
          { region_id: region.id, amount: 18 },
        ],
        rules: storeRules,
      },
    ],
  });
  logger.info("Finished seeding fulfillment data.");

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: { id: stockLocation.id, add: [defaultSalesChannel.id] },
  });
  logger.info("Finished seeding stock location data.");

  logger.info("Seeding categories...");
  const { result: topCategories } = await createProductCategoriesWorkflow(
    container
  ).run({
    input: {
      product_categories: CATEGORY_TREE.map((c, rank) => ({
        name: c.name,
        handle: c.handle,
        is_active: true,
        rank,
      })),
    },
  });

  const childInputs = CATEGORY_TREE.flatMap((c) => {
    const parent = topCategories.find((t) => t.handle === c.handle)!;
    return c.children.map((name, rank) => ({
      name,
      handle: toHandle(name),
      is_active: true,
      rank,
      parent_category_id: parent.id,
    }));
  });
  const { result: childCategories } = await createProductCategoriesWorkflow(
    container
  ).run({ input: { product_categories: childInputs } });

  const categoryId = (handle: string) =>
    [...topCategories, ...childCategories].find((c) => c.handle === handle)!.id;
  logger.info("Finished seeding categories.");

  logger.info("Seeding sample products...");
  const { result: productOptions } = await createProductOptionsWorkflow(
    container
  ).run({
    input: {
      product_options: [
        { title: "Finish", values: ["18ct Gold Plated", "Sterling Silver 925"] },
        { title: "Length", values: ["40 cm", "45 cm", "50 cm"] },
        { title: "Ring Size", values: ["J", "L", "N", "P"] },
      ],
    },
  });
  const option = (title: string) =>
    productOptions.find((o) => o.title === title)!;

  const aud = (amount: number) => [{ amount, currency_code: "aud" }];

  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Sample – Classic Hoop Earrings",
          subtitle: "Sample product. Delete or edit before launch.",
          handle: "sample-classic-hoop-earrings",
          description: "Lightweight everyday hoops, 20 mm diameter.",
          status: ProductStatus.PUBLISHED,
          category_ids: [categoryId("hoops")],
          shipping_profile_id: shippingProfile.id,
          weight: 4,
          options: [{ id: option("Finish").id }],
          variants: [
            { title: "18ct Gold Plated", sku: "SAMPLE-HOOP-GP", options: { Finish: "18ct Gold Plated" }, prices: aud(49) },
            { title: "Sterling Silver 925", sku: "SAMPLE-HOOP-SS", options: { Finish: "Sterling Silver 925" }, prices: aud(59) },
          ],
          sales_channels: [{ id: defaultSalesChannel.id }],
        },
        {
          title: "Sample – Fine Cable Chain",
          subtitle: "Sample product. Delete or edit before launch.",
          handle: "sample-fine-cable-chain",
          description: "A fine cable chain with a lobster clasp.",
          status: ProductStatus.PUBLISHED,
          category_ids: [categoryId("chains")],
          shipping_profile_id: shippingProfile.id,
          weight: 3,
          options: [{ id: option("Length").id }],
          variants: [
            { title: "40 cm", sku: "SAMPLE-CHAIN-40", options: { Length: "40 cm" }, prices: aud(69) },
            { title: "45 cm", sku: "SAMPLE-CHAIN-45", options: { Length: "45 cm" }, prices: aud(69) },
            { title: "50 cm", sku: "SAMPLE-CHAIN-50", options: { Length: "50 cm" }, prices: aud(75) },
          ],
          sales_channels: [{ id: defaultSalesChannel.id }],
        },
        {
          title: "Sample – Solitaire Ring",
          subtitle: "Sample product. Delete or edit before launch.",
          handle: "sample-solitaire-ring",
          description: "A single cubic zirconia in a four-claw setting.",
          status: ProductStatus.PUBLISHED,
          category_ids: [categoryId("dress-rings")],
          shipping_profile_id: shippingProfile.id,
          weight: 3,
          options: [{ id: option("Ring Size").id }],
          variants: ["J", "L", "N", "P"].map((size) => ({
            title: `Size ${size}`,
            sku: `SAMPLE-RING-${size}`,
            options: { "Ring Size": size },
            prices: aud(89),
          })),
          sales_channels: [{ id: defaultSalesChannel.id }],
        },
      ],
    },
  });
  logger.info("Finished seeding sample products.");

  logger.info("Seeding inventory levels...");
  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id"],
  });

  await createInventoryLevelsWorkflow(container).run({
    input: {
      inventory_levels: inventoryItems.map((item) => ({
        location_id: stockLocation.id,
        stocked_quantity: 10,
        inventory_item_id: item.id,
      })),
    },
  });
  logger.info("Finished seeding inventory levels.");
}
