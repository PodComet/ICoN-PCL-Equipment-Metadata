import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const adminUnlockLimits=sqliteTable('admin_unlock_limits',{
 key:text('key').primaryKey(),
 windowStarted:integer('window_started').notNull(),
 attempts:integer('attempts').notNull(),
});
export const positionProfileEdits=sqliteTable('position_profile_edits',{
 equipmentId:text('equipment_id').primaryKey(),payload:text('payload').notNull(),revision:integer('revision').notNull(),updatedAt:text('updated_at').notNull(),
});
export const positionImports=sqliteTable('position_imports',{
 id:text('id').primaryKey(),userId:text('user_id').notNull(),filename:text('filename').notNull(),revision:integer('revision').notNull(),changesJson:text('changes_json').notNull(),createdAt:text('created_at').notNull(),
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

export const researchRecords=sqliteTable('research_records',{
 recordId:text('record_id').primaryKey(),ownerId:text('owner_id').notNull(),spaceId:text('space_id').notNull(),kind:text('kind').notNull(),containerId:text('container_id').notNull(),code:text('code').notNull(),payload:text('payload').notNull(),revision:integer('revision').notNull(),accessScope:text('access_scope').notNull(),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),
},t=>[index('research_owner').on(t.ownerId),index('research_space').on(t.spaceId),uniqueIndex('research_container_code').on(t.ownerId,t.containerId,t.kind,t.code)]);
export const researchVersions=sqliteTable('research_versions',{
 recordId:text('record_id').notNull(),revision:integer('revision').notNull(),payload:text('payload').notNull(),actorId:text('actor_id').notNull(),createdAt:text('created_at').notNull(),
},t=>[primaryKey({columns:[t.recordId,t.revision]})]);
export const researchFiles=sqliteTable('research_files',{
 fileId:text('file_id').primaryKey(),recordId:text('record_id').notNull(),objectKey:text('object_key').notNull(),filename:text('filename').notNull(),sha256:text('sha256').notNull(),sizeBytes:integer('size_bytes').notNull(),mediaType:text('media_type').notNull(),
},t=>[index('research_file_record').on(t.recordId)]);
export const researchIngestions=sqliteTable('research_ingestions',{
 ownerId:text('owner_id').notNull(),ingestKey:text('ingest_key').notNull(),recordId:text('record_id').notNull(),requestDigest:text('request_digest').notNull(),
},t=>[primaryKey({columns:[t.ownerId,t.ingestKey]})]);
export const researchGrants=sqliteTable('research_grants',{
 spaceId:text('space_id').notNull(),email:text('email').notNull(),role:text('role').notNull(),createdAt:text('created_at').notNull(),
},t=>[primaryKey({columns:[t.spaceId,t.email]}),index('research_grant_email').on(t.email)]);
export const researchOwners=sqliteTable('research_owners',{
 ownerId:text('owner_id').primaryKey(),revision:integer('revision').notNull(),
});

export const evidenceRecords=sqliteTable('evidence_records',{
 evidenceId:text('evidence_id').primaryKey(),ownerId:text('owner_id').notNull(),recordKind:text('record_kind').notNull(),subjectId:text('subject_id').notNull(),revision:integer('revision').notNull(),payload:text('payload').notNull(),createdAt:text('created_at').notNull(),
},t=>[index('evidence_owner_created').on(t.ownerId,t.createdAt),index('evidence_subject_revision').on(t.subjectId,t.revision)]);
