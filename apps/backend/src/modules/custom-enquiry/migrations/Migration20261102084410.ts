import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261102084410 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "custom_enquiry" add column if not exists "email_normalized" text not null default '';`);
    this.addSql(`update "custom_enquiry" set "email_normalized" = lower(trim("email")) where "email_normalized" = '';`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_custom_enquiry_email_normalized_created_at" ON "custom_enquiry" ("email_normalized", "created_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_custom_enquiry_email_normalized_created_at";`);
    this.addSql(`alter table if exists "custom_enquiry" drop column if exists "email_normalized";`);
  }

}
