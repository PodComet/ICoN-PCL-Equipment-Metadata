import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const adminUnlockLimits=sqliteTable('admin_unlock_limits',{
 key:text('key').primaryKey(),
 windowStarted:integer('window_started').notNull(),
 attempts:integer('attempts').notNull(),
});

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

export const processWorkflows = sqliteTable('process_workflows', {
 workflowId:text('workflow_id').primaryKey(),
 userId:text('user_id').notNull(),
 routeId:text('route_id').notNull(),
 name:text('name').notNull(),
 payload:text('payload').notNull(),
 revision:integer('revision').notNull(),
 createdAt:text('created_at').notNull(),
 updatedAt:text('updated_at').notNull(),
});
export const processWorkflowVersions = sqliteTable('process_workflow_versions', {
 workflowId:text('workflow_id').notNull(),
 revision:integer('revision').notNull(),
 payload:text('payload').notNull(),
 createdAt:text('created_at').notNull(),
},t=>[primaryKey({columns:[t.workflowId,t.revision]})]);
