# Evidence register and reproducible control sequences

Open the app's **Evidence register** tab or `/#evidence`. Search by evidence ID, claim, model, P/M category, position, fiber, direction or related record. Filters distinguish source claims, instrument sequences, individual actions, workflow combinations and output/assessment snapshots. A record link uses `/#evidence/<evidence_id>`. Account access is still checked when opening a link.

## Public source repository

The public register starts with 331 existing records: 321 literature-scoped process/property claims and ten model-control claims or explicit modeling assumptions. The original classifications, locators and verification status remain intact. Process-associated M classes provide context, not evidence that a particular model was used.

- [Readable register](evidence-register.md)
- [CSV](../catalog/evidence_registry.csv)
- [JSON](../catalog/evidence_registry.json)
- [Record JSON Schema](../catalog/evidence_record.schema.json)

`python scripts/build_app_data.py` regenerates these files and the app's source snapshot through `evidence_tools.py`. New canonical claims are included by that build. Source claim meaning should not be changed while retaining an ID: mint a new claim ID for a materially different assertion. Corrections and source-register revisions remain reviewable in Git history. Missing original scope is labelled explicitly rather than invented.

## IDs generated when saving user declarations

| ID family | Identifies | Preserved context |
| --- | --- | --- |
| `ACT-EV-<UUID>` | One occurrence of a Position → Fiber → Direction action | Order, original action ID, exact selections, notes, completeness/review status, selected descriptions, supporting evidence IDs and parent sequence |
| `SEQ-EV-<UUID>` | An instrument's complete ordered sequence at one save | Exact model/manufacturer/equipment ID/M class, repeated actions, settings/signals/I/O, process/step/slot/instance context where applicable, selected interface descriptions and complete supporting claim snapshots |
| `COMBO-EV-<UUID>` | The complete workflow combination at one saved revision | Ordered step identities, declared prerequisites, linked instrument-sequence IDs, workflow ID/revision and a fingerprint of that exact persisted workflow |
| `<stable output/assessment ID>-R<revision>` | A revision-specific output or property assessment snapshot | Stable logical evidence ID, declared or assessed context, source evidence and exact workflow revision |

A new successful workflow save mints a new combination ID and new sequence/action IDs for each explicitly configured occurrence, even if its selections did not change. Reused physical equipment in different slots retains separate sequence records. Repeating the same action preserves its separate place in the sequence and receives a separate action evidence ID. An explicit empty sequence records clearing; an instrument never configured with controls does not acquire an invented sequence. Draft edits do not mint persistent evidence. Older saved plans acquire these new sequence IDs on their next save; old workflow revisions are not rewritten.

Model-card **Save instrument sequence** and sequence-template CSV application also create sequence/action records. Individual templates remain private to their owner. Administrator-applied shared templates have shared evidence. A CSV's supplied saved-ID metadata is replaced with server-generated IDs; it cannot assert a prior identity. Copying a template into a workflow does not reuse the template's evidence ID.

Each save is an atomic database transaction with its evidence inserts. Conflicts roll back both the source change and evidence, so failed saves leave no orphan records. Evidence records are insert-only through the application; new versions use new IDs and a `supersedes_id` link. Selected source descriptions and claims are copied at save time so later manual/profile edits do not silently change an earlier record. User-defined actions do not inherit manufacturer evidence merely because their text matches an existing direction.

Output identities remain stable across revisions. Their register entries are revision-qualified. Looking up a stable output/assessment ID resolves the most recent authorized registered snapshot; cite the revision-qualified ID to identify a fixed version.

## Reading and reproducing a saved declaration

1. Find the sequence or combination by its evidence ID.
2. Read the ordered action table, model identity, notes, source locators and review flags.
3. Download a **JSON package** for structured reuse, a **CSV package**, or **Readable Markdown** for review. A child action's package includes its immutable parent sequence. A combination's JSON/Markdown package includes the exact saved workflow revision plus its linked sequence records. The workflow snapshot retains material inputs, quantities, equipment assignments, dependencies, conditions and configurations as saved.
4. Use the stored sequence and exact workflow revision to reconstruct the declaration. The package does not connect to hardware or automatically establish valid transitions, guards, timing, dependencies or product effects.

Saved JSON sequence data retains `instrument-control-sequence/v1`; model-bound interface/evidence snapshots preserve the existing `poly-fibers/v2` / `poly-evidence/v1` content. The surrounding register uses `iconpcl-evidence-record/v1`, and downloads use `iconpcl-evidence-package/v1`. This is a project register, not a signed nanopublication or a claim of conformance to an external evidence schema.

SHA-256 fingerprints use canonical JSON (sorted object keys, original array order) and omit the record's own `content_sha256` field. The combination additionally fingerprints the exact saved workflow. These checks detect changed content; they do not establish scientific truth, execution, experimental validation or institutional endorsement.

## Storage and access

Public source claims live in Git and the deployed read-only source snapshot. User-generated records live in the app's `evidence_records` database table alongside immutable `process_workflow_versions`. The server checks the owner on list, search, individual lookup, related-sequence reads and workflow-revision resolution. Shared administrator templates are explicitly public catalog evidence. No user workflow, private evidence record or runtime database is automatically committed to the public repository. Local and hosted databases are separate; a local saved evidence link is not automatically available on the hosted site.

`GET /api/evidence` supports query, kind, P-category, visibility, limit and offset. `GET /api/evidence?id=<ID>` returns an authorized full record and reproduction context. Responses are private/no-store. There is no endpoint to rewrite or delete evidence records.

## Verification

Tests cover frozen manual context, ordered/repeated actions, new IDs at every save, previous-version links, per-occurrence identity, empty-sequence clearing, content fingerprints, readable exports and CSV formula protection. The loopback integration fixture `webapp/tests/integration/evidence_preview.py` additionally checks save/reopen, exact old revisions, concurrent rollback, template save, ignored forged IDs and cross-account lookup/search isolation. Synthetic test records remain local and are not public seed data.
