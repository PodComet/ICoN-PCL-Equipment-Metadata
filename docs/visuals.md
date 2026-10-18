# Dynamic process visuals

The **Visuals** tab contains two interactive graphs derived from the current catalog and authorized saved workflows. Open the tab directly with `/#visuals`.

The design adapts Garcia Trelles, E.; Schweizer, C.; Thomas, A.; von Hartrott, P.; and Janka-Ramm, M. (2024), *Digitalizing Material Knowledge: A Practical Framework for Ontology-Driven Knowledge Graphs in Process Chains*, Applied Sciences 14, 11683, [doi:10.3390/app142411683](https://doi.org/10.3390/app142411683). This is already recorded as `REF-8508E2857729` in the academic library. The relevant patterns are Figure 5 / §2.3.2 (generic Process Graph), Figure 9 (quantity values and units) and Figure 13 / §3.2.3 (connected object/process history). The figures themselves are not copied into the app.

## The two views

1. **Process context graph:** a process-centered pattern with twelve surrounding roles: input object/material, input data set, process setup, infrastructure, software, operator, control parameters, procedure, subprocess set, output object/material, result data and time information. Selecting a node shows scoped records, identifiers, original units, evidence IDs and source locators. Equipment-class candidates expose model counts and an inspectable candidate example; saved assignments expose their exact model cards. A step selector narrows the process setup and parameter context.
2. **Process chain & material states:** separate process-step occurrences and material-boundary placeholders. Saved prerequisites determine the hierarchy; independent branches appear in the same dependency level. Older/default source order is labelled separately. Repeated uses of the same instrument remain distinct occurrences. Material composition, quantity and identity at intermediate boundaries are explicitly unrecorded, rather than inferred from step names. A cycle or invalid prerequisite prevents generation of inter-step links.

Both views have zoom, readable fit, fit-all, enlarge, node inspection, a text relationship table, and SVG / JSON / Turtle RDF downloads. Graph node buttons support keyboard activation. The graph and inspector have bounded viewports, so inspecting a node does not change their dimensions.

## Live data

There are no stored graph images or manually maintained model lists. Graph functions derive their content from:

- `/api/catalog`: current P/M/N definitions, source steps, current model records and the viewer's authorized catalog edits. The manufacturer audit also updates through this existing catalog path.
- `/api/visuals`: public, reviewed process-condition evidence, reported properties and representative formulation metadata from the current deployment. It contains no inventory assets, research uploads or saved user records. Fetching this endpoint lets an already-open tab receive newer reference data after deployment.
- `/api/processes`: the viewer's existing authenticated workflow list and selected saved revision. Saved plans are never made public by this feature.

Opening the tab loads current reference metadata and workflow choices. **Refresh** updates the catalog, reference data, saved-workflow list and a selected plan when its revision changes. Live mode repeats this every 60 seconds while the document is visible and when the window regains focus. It can be disabled. New canonical process classes, stages, models, conditions or formulations appear after the corresponding catalog/source update is deployed; shared CSV imports appear through the existing catalog API. Refresh does not fetch unpublished local source changes.

Source templates select the first curated, applicable representative formulation for that P class, if one exists. They do not silently apply it to the user's saved plan. A saved view uses that workflow's actual inputs and instrument assignments. Changing either selector rebuilds both graphs. No workflow is changed or saved by viewing graphs. Unsaved changes in the separate process editor are not included until saved.

## Scientific and semantic boundaries

These are **planning and catalog views**, not validated experimental histories. Unlike the paper's executed AlSi10Mg case study, equipment-plan records do not establish that a physical process occurred. Accordingly:

- A graph boundary is not a measured sample, chemical transformation, mass balance, yield or confirmed output batch.
- Literature properties remain source-reported data, not results attributed to the selected plan.
- Unknown operator, software, infrastructure and raw-data roles remain explicit gaps. The signed-in plan owner is not assumed to have operated an instrument.
- Save timestamps identify metadata revisions, not experiment acquisition times.
- Class candidates and example models are not promoted into exact-model process-use evidence. Optional and alternative apparatus stay qualified in their source/workflow descriptions.
- Source-step order is not asserted to be a physically validated dependency or material transfer. Saved user prerequisites also do not prove material transfer.

The adaptation keeps the paper's process-centered separation of objects, process occurrences, equipment, data and control information. It does not assert formal BWMD conformance, OWL inference, a SPARQL query engine, measured property prediction or execution validation.

## Export contract

JSON uses `iconpcl-visual-graph/v1`: graph kind, source kind, route/workflow/revision, design-paper reference, typed nodes, scoped records, directed edges, predicates, review flags and warnings. Numeric parameter records retain separate `value`, `upper_value`, `operator`, `unit`, `quantity_kind` and qualitative `text_value` fields. Range bounds are not converted into exact settings.

Turtle uses project-local planning predicates and the existing ontology namespace, with `rdfs:label`, DCTERMS and RDF statement annotations. Each relationship preserves its scope and review flag. Parameter records preserve typed numeric literals, units, operators, quantity-kind links and evidence references. The design paper is a `dct:references` link; actual data-source URLs remain `dct:source` links. No `prov:wasGeneratedBy` assertion claims an experiment ran, and no `owl:sameAs` or BWMD equivalence is invented.

Graph identities distinguish source templates, individual step context and saved workflow revisions. Original saved material IDs and output evidence IDs are retained. Temporary source previews use graph-scoped identifiers, rather than minting persistent experimental evidence. A saved-plan export can contain that user's planning metadata; it is downloaded locally and is not automatically committed to GitHub.

## Verification

App tests cover all current P routes, graph link resolution, source-unit/evidence preservation, added models/stages, parallel dependencies, repeated instrument occurrences, saved revision identities, cyclic inputs and qualified RDF exports. `tests/integration/visuals_live_preview.py` creates a synthetic loopback plan and can advance it for an end-to-end browser refresh check. Test fixtures and runtime database records are not public seed data.
