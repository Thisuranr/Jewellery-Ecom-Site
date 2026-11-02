import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261102082107 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "custom_enquiry" ("id" text not null, "name" text not null, "email" text not null, "phone" text null, "message" text not null, "budget" text null, "status" text check ("status" in ('new', 'contacted', 'closed')) not null default 'new', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "custom_enquiry_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_custom_enquiry_deleted_at" ON "custom_enquiry" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_custom_enquiry_email_created_at" ON "custom_enquiry" ("email", "created_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "custom_enquiry" cascade;`);
  }

}
