# Instrument positions, fibers, directions and output effects

The finished-output card has one control row for every assigned process slot. Three uses of M53 produce three rows, even when they share one physical unit and one purchase price. Choices are saved in the occurrence's configuration under `ontology_control_selection`; changing one row does not change another.

## Fill and upload the spreadsheet

1. In **Admin access**, sign in and unlock administration.
2. In **POSITION → FIBERS → DIRECTIONS**, download the blank template or export existing positions. The output card also downloads a template prefilled with the exact models in its process.
3. Enter one row per direction. Repeat the model, position and fiber fields for another direction in the same fiber. Use a different fiber ID for another fiber. Fiber IDs must be unique within the model, including across positions. A fiber without directions may have one row with the direction fields empty.
4. In Excel, save the data sheet as **CSV UTF-8**. Do not include an instructions sheet, title rows, subtotals or merged headers in the CSV.
5. Choose the CSV, select **Validate position spreadsheet**, review the complete before/after model lists and evidence, then select **Apply Position Lists**.

An import replaces the complete Position List of every included model. Omitted models remain unchanged. Blank fields do not mean “preserve the old value” in this importer. Preview is read-only. Any validation error prevents the whole batch from applying. Revision checks prevent overwriting a concurrent import. The server records the administrator, filename, date and before/after lists.

## Columns

| Column | Use |
| --- | --- |
| `equipment_id`, `manufacturer`, `model_name` | Required exact shared-catalog identity. A category alone does not identify a model. |
| `interface_name`, `interface_description` | Optional model interface identity and scope. Existing exports preserve them. |
| `interface_evidence_ids` | Optional semicolon-separated IDs already in the evidence register. |
| `position` | Required mechanical position or modeled operating mode. |
| `position_description` | Optional description of the position. |
| `fiber_id`, `fiber_description` | Required fiber identity and meaning. Repeat consistently for all its rows. |
| `fiber_label` | Optional readable name; otherwise the fiber ID is shown. |
| `fiber_evidence_ids` | Optional semicolon-separated IDs in the evidence register. |
| `direction`, `direction_description` | An action identifier and its description. Leave both empty only for a fiber with no actions. Direction IDs are unique within a fiber. |
| `direction_evidence_id` | Optional evidence ID(s), separated by semicolons. |
| `direction_source_url`, `direction_source_title`, `direction_source_section` | Required when introducing an evidence ID that is not registered. Use a model-bound source and a page/section locator. |
| `effect_summary` | Optional declared effect of that action on the output material. Describe the conditions and limits. A hardware command does not establish a nanomaterial property by itself. |
| `effect_evidence_id` | Optional source ID(s) supporting the effect, separately from the command documentation. |
| `effect_source_url`, `effect_source_title`, `effect_source_section` | Required for a new effect-evidence ID. |
| `accessed` | `YYYY-MM-DD`, required for newly introduced source evidence. |

For several existing evidence IDs in one field, the source columns describe the first ID; the other IDs resolve to their existing register entries. An ID cannot be reassigned to a different source. Use a new versioned ID for changed evidence. **Archive JSON with evidence** preserves the complete register; CSV is the editing format. Uploaded claims are labeled unverified and do not automatically become manufacturer-verified facts.

## Use the controls in a process

1. Assign instruments to the process slots.
2. Open the final **Expected output / Equipment plan complete** card.
3. For each occurrence, select a **POSITION**, then a **FIBER**, then toggle its available **DIRECTIONS**. Multiple directions are a set of proposed actions, not an executable order. Operating sequence remains a separate configuration field.
4. The row shows the declared effect and effect sources. Missing effect data is shown as not documented. Resetting the row removes its choices and displayed effects. Changing position or fiber clears incompatible directions.
5. Save the workflow. JSON exports preserve each occurrence's choices and the output export includes its selected effects and supporting evidence.

Only the Opentrons GEN2 currently has a curated seed Position List. Other model rows remain present and await uploaded model-specific information. Position choices do not automatically infer composition, particle size, yield, concentration or interactions among several machines. The named material target remains separate from these declared configuration effects. If a later profile removes a selected position, fiber or direction, the row requires review.
