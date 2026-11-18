# CNC and computational materials workflows

This expansion uses CNC to mean **cellulose nanocrystals**. Existing computer-controlled metal machining processes P55–P56 remain available.

## Equipment additions

| Class | Equipment type | Documented models |
| --- | --- | ---: |
| M150 | Scientific and engineering workstations | 10 |
| M151 | HPC compute servers and accelerated nodes | 10 |
| M152 | High-pressure homogenizers and microfluidizers | 10 |
| M153 | Research and pilot spray dryers | 10 |

Every model has an input/output/unit profile and official specifications or a manual. Supported CPU, memory, GPU, pressure and dryer configurations are described as options rather than a simultaneous installed maximum. Fourteen records have source-linked manufacturer images. Three server records have published USD starting prices. These prices do not cover maximum configurations, scientific software or per-run computing charges.

Purdue RCAC documents **Dell PowerEdge R7525** nodes in its April 2023 Gilbreth expansion, with 0.5 TB RAM, two NVIDIA A100 GPUs and 100 Gbps HDR InfiniBand. The model receives the public Purdue installation mark. That source does not establish present-day availability or installation of the other Dell models. [Purdue RCAC announcement](https://www.rcac.purdue.edu/news/5719)

## Process and workflow additions

| Class | Workflow | Expected output |
| --- | --- | --- |
| P90 | DFT structure relaxation and electronic-structure analysis | Relaxed structures, energies and electronic data |
| P91 | Atomistic molecular dynamics and transport analysis | Trajectories, logs and analyzed transport estimates |
| P92 | Materials ML interatomic-potential training and validation | Model checkpoint, predictions and validation metrics |
| P93 | High-pressure dispersion of chemically isolated CNCs | Aqueous CNC dispersion with coarse aggregates screened |
| P94 | Spray drying of aqueous CNC dispersions | Dried CNC-containing powder or agglomerates |
| P95 | Redispersion and aggregate assessment of dried CNCs | Dispersion and an assessment of remaining aggregates |

Computational workflows have their own `computational_workflow` kind and RDF class, a subclass of `prov:Plan`. Selecting hardware creates a plan. It does not execute a simulation, train a model or measure a material. Input files, software versions, pseudopotentials/force fields, settings, unit conventions, convergence or validation and output checksums must be retained for each actual run. The UI uses **Input data** and **Expected computational outputs**, with no inferred material yield. Hardware purchase costs are separated from unquoted running costs. [Materials Project calculation methods](https://docs.materialsproject.org/methodology/materials-methodology/calculation-details), [LAMMPS running basics](https://docs.lammps.org/Run_basics.html), [LAMMPS units](https://docs.lammps.org/units.html), [MatGL official repository](https://github.com/materialsvirtuallab/matgl), [W3C PROV Plan](https://www.w3.org/ns/prov#Plan)

The CNC workflows use N19, cellulose nanocrystals. P93 begins with chemically isolated, washed feed. It does not describe purely mechanical CNF production. Kröger et al. name Microfluidics M-110P for dispersing phosphorylated CNCs after chemical treatment. The mesh screening is a manual consumable operation, so it creates no unclassified equipment slot. Peng et al. distinguish CNC and NFC sample streams and name BUCHI B-290. These exact-model literature links are retained separately from capability associations for alternative models. [Kröger et al., 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10015457/), [Peng et al., 2012](https://forestbioproducts.umaine.edu/wp-content/uploads/sites/202/2012/08/Gardner-article-WFS1616.pdf)

Drying may produce persistent aggregates. P95 has abstract-level support for redispersion comparisons; its exact operating doses and instrument models were not verified from full methods. No universal pressure, temperature, sonication dose or recovery is supplied. [Esparza et al., 2019, publisher abstract](https://pubs.acs.org/doi/abs/10.1021/acs.iecr.9b03951)

All three articles are in the academic library, with P/M/N associations and author affiliations where verified. No DOI is invented for the Peng paper. The [dated review](../catalog/cnc_computational_review_2026-11-17.json) retains field-level sources, configuration caveats, exact Purdue evidence and coverage counts. Source PDFs and saved user plans stay outside public Git.
