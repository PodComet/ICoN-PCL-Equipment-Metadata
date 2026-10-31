# Equipment handoff indicators

The Processes chart compares the output of each assigned machine with the input
of machines in its dependent stages. A green circle with a white check appears
between matching equipment boxes. Hover or focus the check to read the model names,
the matched output/input wording and the matching basis.

When every prerequisite connection has at least one matching output/input pair,
all step boxes and occupied equipment slots receive green outlines. The frames
follow the same step-to-step checks shown in the chart, including P18. Supporting
instruments and equipment-completion status do not add a hidden frame condition.
Clearing or replacing an instrument, editing configured ports or changing
dependencies recalculates the indicators immediately. Independent peer stages are
not linked merely because they appear next to one another. Multiple instruments
in the same stage are not assigned an invented internal order.

## Data and matching

1. Per-occurrence **Configuration, operation & data → Inputs / Outputs** entries
   take precedence when entered. Explicit named ports match on name, value and
   unit. Numeric unit conversion and range compatibility are not inferred.
2. Otherwise, saved model I/O descriptions are used. Older plans without those
   fields may use the current catalog only when equipment ID, manufacturer, model
   and capacity match the saved identity. Explicitly empty saved fields stay empty.
3. The description matcher recognizes named substances and a bounded set of flow
   items, including liquids, powders, solid materials, substrates, workpieces,
   samples, labware, nanoparticles, fibers, films, pellets, gases, optical beams
   and named data products. This is deterministic text matching, not an LLM call.
4. Explicitly conflicting forms, such as liquid versus dry powder, and disjoint
   named chemistry, such as CuO versus TiO2, do not match. Common electrical
   ratings, speed, time, channel counts, source footnotes and unknown-data markers
   cannot create a match.

Each handoff needs at least one matching output/input, rather than every port.
For stages with several instruments, one matching pair covers that step-to-step
connection. The stage frame summarizes those connections, rather than requiring
an additional match for every supporting instrument. One positive branch cannot
hide an unmatched prerequisite branch. Equipment completeness remains separate.

These indicators describe correspondence in recorded interfaces. Broad words such
as “sample” retain that broad scope. A green description check does not establish
chemical compatibility, valid mechanical transitions, quantities, connector
pinouts, communication protocols, operating limits or experimentally validated
material properties. Existing equipment-completion and configuration-review
indicators remain separate. Missing or unsupported data stays unchecked.

The check graphics use the chart's existing coordinate system. They and the green
outlines do not contribute to measured dimensions or change its reserved height.
All calculations are derived from the current draft without modifying saved plans,
prices, equipment data or evidence records.
