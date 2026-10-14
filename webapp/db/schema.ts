import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const equipmentEdits = sqliteTable("equipment_edits", {
  userId: text("user_id").notNull(),
  equipmentId: text("equipment_id").notNull(),
  payload: text("payload").notNull(),
  revision: integer("revision").notNull().default(1),
  updatedAt: text("updated_at").notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.equipmentId] })]);

export const catalogShared = sqliteTable("catalog_shared", {
 equipmentId:text("equipment_id").primaryKey(),
 payload:text("payload").notNull(),
 revision:integer("revision").notNull(),
 updatedAt:text("updated_at").notNull(),
});
export const catalogMeta = sqliteTable("catalog_meta", {
 id:text("id").primaryKey(),
 revision:integer("revision").notNull().default(0),
});
export const catalogImports = sqliteTable("catalog_imports", {
 id:text("id").primaryKey(),
 userId:text("user_id").notNull(),
 filename:text("filename").notNull(),
 revision:integer("revision").notNull(),
 changedCount:integer("changed_count").notNull(),
 changesJson:text("changes_json").notNull(),
 createdAt:text("created_at").notNull(),
});
