# Operating conditions, output evidence and property expectations

The Processes tab supports structured, unit-aware operating conditions for each step and optionally each instrument occurrence. This release includes 289 source conditions, 321 source evidence entries and 32 reported property measurements. All values remain scoped to the cited formulation and method. They are not universal operating instructions.

## Editing a plan

Choose **Operating conditions** below the instrument library, then select a step. Choose a parameter, comparison operator and compatible unit; apply the condition to retain it in the draft. A blank value means unspecified. Ranges and qualitative statements such as “overnight” remain ranges or text. No midpoint, room-temperature value or missing duration is invented.

Select a documented formulation to explicitly load source settings for the selected step or all mapped steps. Loading adds missing settings without overwriting edits. Source step identifiers preserve the mapping when steps are reordered. Unmapped source settings require explicit placement and review. Changing a source value preserves its reference and removes the match indication.

Conditions can describe a whole step or one instrument slot. Removing that slot retains the condition, marks its scope for review and preserves the former slot ID in its notes. Reapply it to confirm the new scope. Save the workflow to retain the conditions; output-card JSON exports include them as well.

## Units and scientific distinctions

The shared registry defines compatible units and canonical conversions. Celsius and Kelvin use an offset; heating rates use relative units. Gauge, absolute and unspecified pressure, differential pressure and compaction stress have separate types. RPM is not converted to centrifugal force without a rotor radius. Molar and mass concentrations are not interchanged without chemistry-specific information. Standard gas flow is distinct from actual flow with unreported reference conditions. Small values use relative comparison tolerance, so different nanosecond pulses do not become equal through an absolute tolerance floor.

## Evidence identities

Every planned output receives a stable, unique `OUT-EV-<UUID>-OUTPUT-<index>` evidence ID. Each property assessment has a separate ID derived from that product and source anchor. The workflow assessment has an `-ASSESSMENT` ID. The namespace persists through save, reopen, revisions and export; a new plan receives a new namespace. Legacy plans derive a stable namespace from their existing step identity when opened and retain it on save.

These IDs identify planned outputs and assessments. Published supporting claims have separate source evidence IDs, references and locators. A planned-output ID does not establish experimental verification. The server recomputes the evidence snapshot on save and records the revision; draft changes invalidate the saved snapshot label while preserving output identity.

## Initial condition-informed property layer

Two reviewed P20 fixed-case measurements can be shown as **conditional literature analogues**: water contact angle of 92 degrees and conductivity of 0.00721 mS/m for the Scaffaro et al. P-C2-G1 electrospun formulation. The source is [Scaffaro et al. (2024)](https://doi.org/10.1007/s42114-023-00827-w), especially its methods and Tables 1 and 3. The conductivity conversion retains the reported value of 7.21 × 10⁻³ mS/m.

The app requires the unchanged documented material plan, complete appropriate equipment sequence, matching source settings and compatible prerequisites. Equivalent units are accepted. Changed or additional settings, unresolved scope, altered materials or amounts, incomplete equipment, missing evidence or unmodeled instrument configuration/control actions withdraw the numerical expectation. The source measurement stays visible separately. Matching an equipment category does not demonstrate equivalent apparatus performance; the displayed analogue remains unvalidated.

The other 30 measurements remain source references pending a context-specific model. P12 concentration/particle-size and P36 flame-spray parameter series are recorded as relationship candidates. Interpolation and extrapolation are disabled: the available points and co-varying controls do not establish a general response law. Source measurement dispersion is not presented as a prediction interval.

Experimental validation of predicted material properties is future roadmap functionality. This release does not claim measured results from a user's theoretical plan.

## Reproducible data

Canonical files in `catalog/`:

| File | Role |
| --- | --- |
| `condition_definitions.json` | Typed quantities, allowed units and conversions |
| `process_conditions.csv` | Stable templates, formulation/step mapping, operator, value/range, unit and scope |
| `process_condition_evidence.csv` | Claims, source URL/title/locator, academic reference IDs and review date |
| `process_property_anchors.csv` | Reported measurements, uncertainty descriptions, required conditions and admission flag |
| `process_science_review_2026-10-17.json` | Route reviews, original source-ID mapping and deferred relationship candidates |

Run `python scripts/build_app_data.py` to validate and regenerate the app's process-science and unit-registry JSON. Validation rejects unresolved evidence, inconsistent formulations, unknown source steps, incompatible units and nonfinite numbers. Python and app tests cover these checks, persistence, conversions, scope removal and withdrawal of unsupported expectations.
