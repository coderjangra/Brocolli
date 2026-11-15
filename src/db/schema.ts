import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

// M0 only proves the Drizzle wiring. The real tables from SPEC §4 land in M2.
export const appMeta = sqliteTable('app_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
