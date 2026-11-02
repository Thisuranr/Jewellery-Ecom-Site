import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261028142754 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "product_attribute_value" drop constraint if exists "product_attribute_value_product_id_attribute_id_unique";`);
    this.addSql(`alter table if exists "product_attribute_option" drop constraint if exists "product_attribute_option_product_id_option_id_unique";`);
    this.addSql(`alter table if exists "category_attribute" drop constraint if exists "category_attribute_category_id_attribute_id_unique";`);
    this.addSql(`alter table if exists "attribute_option" drop constraint if exists "attribute_option_attribute_id_handle_unique";`);
    this.addSql(`alter table if exists "attribute_definition" drop constraint if exists "attribute_definition_handle_unique";`);
    this.addSql(`create table if not exists "attribute_definition" ("id" text not null, "handle" text not null, "label" text not null, "type" text check ("type" in ('text', 'number', 'boolean', 'select', 'multiselect')) not null, "unit" text null, "group_handle" text null, "filterable" boolean not null default false, "required" boolean not null default false, "rank" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "attribute_definition_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_attribute_definition_deleted_at" ON "attribute_definition" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_attribute_definition_handle_unique" ON "attribute_definition" ("handle") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "attribute_option" ("id" text not null, "attribute_id" text not null, "handle" text not null, "label" text not null, "title_label" text null, "rank" integer not null default 0, "swatch_hex" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "attribute_option_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_attribute_option_attribute_id" ON "attribute_option" ("attribute_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_attribute_option_deleted_at" ON "attribute_option" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_attribute_option_attribute_id_handle_unique" ON "attribute_option" ("attribute_id", "handle") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "category_attribute" ("id" text not null, "category_id" text not null, "attribute_id" text not null, "rank" integer not null default 0, "required_override" boolean null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "category_attribute_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_category_attribute_attribute_id" ON "category_attribute" ("attribute_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_category_attribute_deleted_at" ON "category_attribute" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_category_attribute_category_id_attribute_id_unique" ON "category_attribute" ("category_id", "attribute_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_category_attribute_category_id" ON "category_attribute" ("category_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "product_attribute_option" ("id" text not null, "product_id" text not null, "variant_id" text null, "attribute_id" text not null, "option_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "product_attribute_option_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_attribute_option_attribute_id" ON "product_attribute_option" ("attribute_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_attribute_option_option_id" ON "product_attribute_option" ("option_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_attribute_option_deleted_at" ON "product_attribute_option" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_attribute_option_product_id" ON "product_attribute_option" ("product_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_attribute_option_attribute_id_option_id" ON "product_attribute_option" ("attribute_id", "option_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_attribute_option_product_id_option_id_unique" ON "product_attribute_option" ("product_id", "option_id") WHERE variant_id IS NULL AND deleted_at IS NULL;`);

    this.addSql(`create table if not exists "product_attribute_value" ("id" text not null, "product_id" text not null, "variant_id" text null, "attribute_id" text not null, "value_text" text null, "value_number" real null, "value_bool" boolean null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "product_attribute_value_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_attribute_value_attribute_id" ON "product_attribute_value" ("attribute_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_attribute_value_deleted_at" ON "product_attribute_value" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_attribute_value_product_id" ON "product_attribute_value" ("product_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_attribute_value_product_id_attribute_id_unique" ON "product_attribute_value" ("product_id", "attribute_id") WHERE variant_id IS NULL AND deleted_at IS NULL;`);

    this.addSql(`alter table if exists "attribute_option" add constraint "attribute_option_attribute_id_foreign" foreign key ("attribute_id") references "attribute_definition" ("id") on update cascade;`);

    this.addSql(`alter table if exists "category_attribute" add constraint "category_attribute_attribute_id_foreign" foreign key ("attribute_id") references "attribute_definition" ("id") on update cascade;`);

    this.addSql(`alter table if exists "product_attribute_option" add constraint "product_attribute_option_attribute_id_foreign" foreign key ("attribute_id") references "attribute_definition" ("id") on update cascade;`);
    this.addSql(`alter table if exists "product_attribute_option" add constraint "product_attribute_option_option_id_foreign" foreign key ("option_id") references "attribute_option" ("id") on update cascade;`);

    this.addSql(`alter table if exists "product_attribute_value" add constraint "product_attribute_value_attribute_id_foreign" foreign key ("attribute_id") references "attribute_definition" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "attribute_option" drop constraint if exists "attribute_option_attribute_id_foreign";`);

    this.addSql(`alter table if exists "category_attribute" drop constraint if exists "category_attribute_attribute_id_foreign";`);

    this.addSql(`alter table if exists "product_attribute_option" drop constraint if exists "product_attribute_option_attribute_id_foreign";`);

    this.addSql(`alter table if exists "product_attribute_value" drop constraint if exists "product_attribute_value_attribute_id_foreign";`);

    this.addSql(`alter table if exists "product_attribute_option" drop constraint if exists "product_attribute_option_option_id_foreign";`);

    this.addSql(`drop table if exists "attribute_definition" cascade;`);

    this.addSql(`drop table if exists "attribute_option" cascade;`);

    this.addSql(`drop table if exists "category_attribute" cascade;`);

    this.addSql(`drop table if exists "product_attribute_option" cascade;`);

    this.addSql(`drop table if exists "product_attribute_value" cascade;`);
  }

}
