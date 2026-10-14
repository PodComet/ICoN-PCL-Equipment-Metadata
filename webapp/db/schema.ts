import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const equipmentEdits = sqliteTable("equipment_edits", {
  userId: text("user_id").notNull(),
  equipmentId: text("equipment_id").notNull(),
  payload: text("payload").notNull(),
  revision: integer("revision").notNull().default(1),
  updatedAt: text("updated_at").notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.equipmentId] })]);
