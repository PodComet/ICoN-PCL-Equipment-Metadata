# ICoN-PCL Equipment Metadata

Compare columns A and B of an Excel workbook or the first two columns of a CSV file. Produce a shared-machine list, unmatched lists, and a complete JSON audit trail with original values and spreadsheet row numbers.

## Quick start

Python 3.11 or later is required. Run these commands from the repository folder:

```sh
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
python -m pip install -r requirements-dev.txt
python equipment_compare.py data/examples/equipment_lists.csv --header --output reports/example
python -m pytest -q
```

For your original workbook, place it in `data/private/` and run:

```sh
python equipment_compare.py "data/private/equipment comparison.xlsx" --sheet Sheet1 --output reports/local
```

The original workbook has **no header row**. Do not use `--header` for it. The first sheet is selected by default. `--sheet` selects a named Excel sheet. Columns beyond A:B are ignored. Blank cells and whitespace-only cells are skipped independently, including uneven list lengths. Numeric cells are converted to text; formatted leading zeros are not recovered, so store machine identifiers as text. Formula and Excel error cells in A:B are rejected; replace them with confirmed values first.

## Matching rules

Matching uses Unicode NFKC normalization, collapsed whitespace (including line breaks), and case-insensitive comparison. It preserves punctuation, model numbers, and word order. Duplicate names form one comparison group; every occurrence retains its original value and row number. Matching is by machine name, not a claim that two entries refer to the same physical asset.

Different spellings, abbreviations, generic equipment categories, and different model variants are not automatically equated. Review unmatched lists for potential semantic matches. No fuzzy score is presented as a confirmed match.

## Reports

Each run writes five files into the chosen output folder, replacing previous files with those names:

| File | Contents |
| --- | --- |
| matches.csv | One row per normalized name shared by both lists |
| only_a.csv | Names found only in column A |
| only_b.csv | Names found only in column B |
| comparison.json | All groups, original values, row references and run metadata |
| summary.md | Counts and input checksum |

CSV names and occurrence arrays are JSON-encoded inside CSV cells to retain embedded line breaks and protect formula-like prefixes. For programmatic use, read `comparison.json`; it contains unmodified original names. Counts labeled `rows` count nonblank occurrences; other machine counts count unique normalized names. Duplicate counts count groups with multiple occurrences, not extra rows.

Reports contain the source file's SHA-256, selected sheet, header setting, algorithm version and matching policy. Ordering and JSON formatting are stable, with no timestamps or absolute paths. Identical input bytes and options using the pinned dependencies produce identical report bytes. Renaming the source changes the recorded source name. Original Excel bytes are retained locally; resaving an Excel workbook can change its checksum without changing visible data.

The checked-in `reports/example/` can be regenerated with the quick-start command. Tests verify its contents against a fresh run. Local reports based on the uploaded workbook are in `reports/local/` and are excluded from Git.

## Research use

This public repository contains the comparison method, tests, templates and synthetic examples. Source equipment inventories and reports derived from them are not distributed here. A repository has one visibility setting; selective sharing is achieved by keeping restricted data outside its tracked files.

For a reproducible study, record the input checksum, script version or Git commit, Python/dependency versions, sheet and header setting. Preserve the original input separately. The example reports demonstrate reproducibility; they are synthetic and are not research findings. This tool compares names, not equipment capability or asset identity.

Contributions that improve matching should include a synthetic test case and explain how the change affects false matches. Do not submit restricted inventories in issues or pull requests.

## Project layout

```text
equipment_compare.py        Command-line script and comparison functions
requirements.txt            Pinned runtime dependencies
requirements-dev.txt        Test dependencies
templates/equipment_lists.csv   Blank two-column template (has headers)
data/examples/              Synthetic, publishable example input
data/private/               Local original inputs (ignored by Git)
reports/example/            Reproducible synthetic example reports
reports/local/              Local actual-data reports (ignored by Git)
tests/                      Matching, XLSX input and reproducibility tests
.github/workflows/tests.yml Automated tests on Python 3.11–3.13
```

Copy the blank CSV template and populate its two columns, or create an Excel workbook with machine names in A and B. Use `--header` for the supplied CSV template. Keep originals unchanged and use a separate report directory for each comparison you want to retain.

## Development

Install `requirements-dev.txt`, run `python -m pytest -q`, and regenerate example reports after intentional algorithm changes. Increment `VERSION` when changing matching or report semantics. Tests cover case and Unicode handling, model distinctions, duplicates, blanks, numeric values, first-row inclusion, sheet selection, formula rejection, empty inputs and byte-for-byte report reproducibility.

## Data handling

The original workbook and its detailed reports stay local by default. Only synthetic examples are included in Git. Before deliberately adding private inputs or reports, review their content and repository access. Code and synthetic examples are available under the MIT License. This license does not grant rights to any separately supplied equipment inventory.
