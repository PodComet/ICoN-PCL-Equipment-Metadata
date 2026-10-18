# Research data / ELN and FAIR implementation

The **Research data / ELN** tab provides an initial, persistent research workspace alongside the equipment ontology and process planner. Its model follows openBIS terminology. This is an implementation within this app; it is not an installed or connected openBIS server.

The architecture background article is **Rejiba et al. (2026), “Towards Defect Phase Diagrams: From Research Data Management to Automated Workflows,” Advanced Engineering Materials, e202502882**, [doi:10.1002/adem.202502882](https://doi.org/10.1002/adem.202502882). The academic library records its six publication-specific author affiliations and classifies it as general architecture background. Its DOI contains 2025, but its published date is 4 April 2026. It is not evidence that a particular equipment model manufactured a material.

## Record structure

| Term | Purpose | Allowed container |
|---|---|---|
| Space | Research group, personal workspace or laboratory | Top level |
| Project | Research project | Space |
| Collection | Experiment or study grouping | Project |
| Object | SAMPLE, MATERIAL, PROTOCOL, INSTRUMENT or EXPERIMENTAL_STEP | Space, Project or Collection |
| Data set | RAW_DATA, PROCESSED_DATA or ATTACHMENT metadata and instrument source file | Collection or Object |

These type codes are project-defined terms. They are not presented as a universal ontology. The existing P/M/X/N codes remain local, source-linked classifications. Objects are not forced into a strictly linear containment chain: this follows the [openBIS data model](https://openbis.readthedocs.io/en/7.x/user-documentation/advance-features/openbis-data-modelling.html).

A manufacturer model profile is distinct from an installed **INSTRUMENT** Object. A physical asset can carry its institution, owner, local identifier, serial number and declared persistent identifier. This keeps institution-specific inventory out of the public model catalog. Selected fields follow the [RDA PIDINST schema](https://docs.pidinst.org/en/latest/schema.html); the app does not register instrument PIDs.

## Start a research record

1. Sign in and open **Research data / ELN**. Create a Space, then create a Project inside it and a Collection inside the Project. Codes use uppercase letters, numbers, underscores or hyphens.
2. Add SAMPLE / MATERIAL Objects, PROTOCOL Objects and installed INSTRUMENT Objects as needed. Record creators, publication-specific affiliations, descriptions, rights and P/M/N/model context.
3. For a performed operation, create an EXPERIMENTAL_STEP Object. Link a saved process plan and its revision as a protocol reference. Record the actual observations and deviations in ELN notes and structured JSON properties.
4. Mark the step completed only after it occurred. Use `used` links for the input samples, protocols and installed assets. A completed output Object / Data set may link to the step with `wasGeneratedBy`, and to a completed source entity with `wasDerivedFrom`. Plans cannot assert actual experimental generation; lineage cycles are rejected.
5. Create a Data set under the appropriate Object or Collection. Select an instrument export, review the automatically extracted metadata, then choose **Ingest and save Data set**. No live device connection is implied.

Record identity, type, code and container remain stable after creation. Save notes and metadata as new revisions; use a linked replacement record to reorganize identity. Concurrent saves return a conflict rather than overwriting another revision. Download a draft before reloading conflicting edits. This first version supports 500 owned records and 50 explicit viewers per Space, and reports capacity limits rather than truncating metadata.

## Automatic instrument-file ingestion

The browser and local adapter share the same versioned extractor. It accepts UTF-8 CSV, TSV, JSON and TXT, up to **2 MiB** and **50,000 tabular data rows** per file. Native binary formats require an instrument-specific adapter. New ingestion creates one Data set per source file; no conversion or control command is sent to the instrument.

Extracted metadata include filename, media type, byte count, SHA-256, extractor version, row count, measured column names, source units and declared model / acquisition metadata where present. CSV/TSV metadata comments may precede the table, for example:

```csv
# model: Synthetic detector
# acquisition_time: 2026-10-17T10:00:00Z
time [s],mass [mg],temperature [°C]
0,2,25
1,3,26
```

The checked example is synthetic and is not a source of equipment or manufacturing claims. Unknown units stay explicitly unmapped; raw values and headers are preserved. `C` is not guessed to mean Celsius. File modification time and upload time are never substituted for scientific acquisition time. Recognized units use [UCUM](https://ucum.org/ucum) codes and selected [QUDT](https://qudt.org/) URIs. Creator/operator and instrument strings extracted from a source file remain unverified declarations.

Original file bytes are stored in private R2 object storage and described by D1 metadata. Raw file manifests are server-owned and immutable in this app; metadata revisions do not modify the originals. A client ingestion UUID makes retries idempotent for identical metadata and bytes, while rejecting reuse for different content. SHA-256 is checked again when packaging a download. A unique identifier is not a registered persistent identifier or long-term storage guarantee.

### Local drop-folder adapter

From `webapp/`, with Node 22.18+ or Node 24:

```powershell
node --experimental-strip-types scripts/ingest-instrument-folder.mjs --input "C:\Lab\InstrumentExports" --out "C:\Lab\PrivateResearchPackages" --watch
```

Omit `--watch` for one scan. Add `--context <record.json>` to carry a Data set draft's description, creator and ontology context, or `--origin <site-origin>` for its intended metadata links. Keep the output folder outside the input folder. The watcher checks stability across scans and before/after reading, packages each filename/content/context combination once, and never moves, deletes or uploads the originals. Use a temporary extension such as `.partial` until an instrument has finished writing a file.

The resulting ZIPs are private local artifacts and require review. The adapter marks them **planned**, **private**, and `review_required=true`; automatic extraction does not establish that the configured process actually ran. It refuses unattended experimental lineage or saved-plan execution claims. Upload the original export through the authenticated app to register its Data set in the online workspace. Direct unattended upload and device-specific connectors are future integrations. If a writer may pause for more than a polling interval, use its own atomic rename/ready-file convention rather than relying on size stability alone.

## Access and sharing

New research records are private. Catalog-admin access does not grant access to other users' research records. A Space owner can add a viewer's signed-in email; that viewer also needs the Site's own access permission. Adding a viewer sends no invitation and does not change the Site audience.

An explicit grant reveals the Space metadata and only child records marked **Space viewers**. Private child records stay private; sharing does not cascade. Viewers can read and export the shared record but cannot edit it, inspect owner-only history, see the viewer email list, or retrieve unshared source files. Qualified links to unshared records retain only their identifiers and a restricted label. Never put private information in a record you intend to share.

Use the `withdrawn` status to block original-file and package downloads while retaining authorized metadata and revision history. A withdrawn record cannot be reactivated; create a replacement. Withdrawal is not secure erasure and does not recall already downloaded packages. Historical lineage is retained. No deletion or institutional retention policy is implemented.

FAIR does not mean every dataset must be public: [the FAIR access principles](https://www.gofair.foundation/fair-principles) allow authentication and authorization. Community dissemination is an explicit export and repository-deposit step. Selecting a license or exporting a package does not publish it.

## Portable metadata

| Export / identifier | Behavior |
|---|---|
| Local UUID / URN | Stable server-generated record identity; authenticated landing link; no minted DOI / Handle |
| Canonical JSON | Saved record, revision, timestamps, readiness notes and related export metadata |
| [RO-Crate 1.3](https://www.researchobject.org/ro-crate/specification/1.3/) JSON-LD | Dataset root, metadata descriptor, file manifests, agents, local ontology links and qualified PROV relationships |
| RO-Crate ZIP | Saved metadata and exact original bytes, with matching relative file paths; related records are linked rather than recursively bundled |
| [DataCite 4.7](https://schema.datacite.org/meta/kernel-4.7/)-aligned draft | Creator, title, type, subjects, rights, related identifiers and version; `registration_ready=false`; no invented DOI / publisher / publication year |
| [W3C PROV-O](https://www.w3.org/TR/prov-o/) | Entity / Activity / Agent; used / wasGeneratedBy / wasDerivedFrom / wasAssociatedWith |

The RO-Crate `datePublished` identifies the release date of the private metadata revision, explicitly labelled as such, not public publication or experimental acquisition. File-ingestion provenance says the extractor generated **metadata** from the original file; it does not assert that the transfer manufactured a material or generated the original scientific observations. DataCite relationships lacking an exact controlled equivalent use `Other` with `relationTypeInformation` preserving the PROV predicate.

No reuse license is assigned by default. Owners may select CC BY 4.0, CC0 or MIT only if they can grant those rights. Repository code licensing does not license imported research payloads or third-party manuals, photos and articles. ORCID checksums and ROR URI syntax are validated, but the app does not verify the person's identity or institutional affiliation against a registry.

## FAIR readiness and remaining work

The UI reports specific supported, partial and missing practices instead of a FAIR score or certification. Metadata and class/model/source-file fields are searchable within the authorized workspace. Rich descriptions, creators, units, rights and provenance improve reuse; unknown information remains missing.

Still required for an institutional service: registered persistent identifiers, repository preservation and retention policies, a public discovery index for intentionally published records, institutional SSO / group roles, domain-specific community profiles and external conformance validation, live openBIS connectivity, device adapters and analysis execution. Experimental validation of predicted nanomaterial properties remains a separate roadmap feature.

The machine-readable [standards map](../catalog/research_standards.json) lists each standard, version, scope, local mappings and limits. Tests cover lineage/status semantics, units, malformed inputs, access decisions, exact bytes/checksums, idempotency, conflicts, ZIP integrity and withdrawal behavior. No FAIR certification is claimed.

## Keep GitHub current without publishing private research

The public repository includes the app, schema migrations, extractor, tests, documentation and reviewed factual catalog metadata. Research records, source uploads, generated research packages, local databases, credentials and Purdue asset inventory are excluded. Browser research saves persist to the application database; they do not automatically commit payloads to GitHub.

For code/catalog releases, regenerate canonical app data, run Python and app tests, inspect the public inventory placeholder, then commit/push reviewed changes and publish the same app source. Use an institutional repository with suitable rights/access controls to disseminate actual research datasets; do not copy an entire runtime database into GitHub.
