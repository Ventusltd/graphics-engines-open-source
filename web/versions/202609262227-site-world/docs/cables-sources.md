# Cable data sources (web/world/data/cables.json)

Researched 26 Sept 2026. Estimated dimensions are kept apart from catalogue or schedule values, following the rule of the GlobalGrid2050 cable-geometry-visualiser. Manufacturers' guides are cited by document title and number, not by brand. `cables.json` names no brand.

## Cables

| Key | Source | What it gave |
|---|---|---|
| S1 | GlobalGrid2050 cable catalogue: `globalgrid2050/solar-bess-topology-v7/cable-geometry-visualiser/data.js` at origin/main commit b44a8040 (live at https://globalgrid2050.com/solar-bess-topology-v7/cable-geometry-visualiser/) | 33 kV single-core ODs for 35 to 630 mm2 (`OD_CONFIRMED sc_18_*`, "Generic catalogue", voltage class labelled Al). 132 kV single-core ODs for 300, 630, 1000, 1200 and 1600 mm2 (`sc_76_*`, "Utility schedule", conductor metal not stated). The single-core model OD = 21.408 + 1.3736 x sqrt(CSA) + 0.353 x Uo, rounded to 2.5 mm, is used for every other size. |
| S7 | Odisha Transmission Corporation (OPTCL), tender specification VOL-II-TS E31, 33/132/220 kV XLPE cable, 2019: https://optcl.co.in/writereaddata/Tender/150619110614E31-33-132-220KV_XLPE_CABLE_SPEC_12042019.pdf | Approximate copper-conductor armoured cable values. 33 kV 300 mm2: 51 mm, 5.46 kg/m. 33 kV 630 mm2: 72 mm, 12.0 kg/m. 132 kV 630 mm2: 107 mm, 16.3 kg/m. 132 kV 1000 mm2: 115 mm, 25.9 kg/m. |

Status of the cable data:
- "verified" in cables.json means the value is in S1's confirmed table and does not come from the model. None of these values has been checked against a product drawing in this pass.
- S1 has no mass values. The only masses come from S7, and S7 labels them approximate.
- S1 does not split single-core cables by conductor metal. OD in the model does not depend on Cu or Al. The 132 kV entries are therefore marked conductor "unstated".
- 33 kV 800 and 1000 mm2 are extrapolated from the model (the tool itself offers only 35 to 630 mm2 at 33 kV), so they are estimated.
- The S7 132 kV 1000 mm2 OD (115 mm, armoured with an aluminium sheath) is 24 mm larger than the S1 schedule value (91 mm). Different designs give different ODs, so a real design needs the chosen product's drawing.

## Bending radius rules

| Key | Source | Rule |
|---|---|---|
| S2 | A UK cable manufacturer's published installation guide, "Installation - Cable Bending Radii" (2022) | MV single-core unarmoured (CWS) 11-33 kV, BS 7870-4.10: dynamic 20 x OD, static 15 x OD. Pb-sheathed 33 kV, BS 7870-4.11: 20 / 15. Single-core armoured 6.6-33 kV, BS 6622 / BS 7835: 15 / 12. Multi-core armoured: 12 / 10. The static radius is for bends into joints and terminations, made with a former. For 66 kV and above, the guide advises about 30 x D as a minimum. |
| S3 | Northern Powergrid NSP/002 v5.0 (Oct 2021), Policy for the Installation of Distribution Power Cables, Table 8: https://www.northernpowergrid.com/sites/default/files/2022-05/1855.pdf | Applies "during and after installation". XLPE 1c 33 kV: 300 mm2 = 995 mm, 400 = 1070 mm, 630 = 1220 mm, which is about 19.3-19.7 x the S1 OD. XLPE 1c 66 kV and 132 kV with a solid metallic sheath: 20D adjacent to joints and terminations, 30D laid direct, 35D pulled into ducts. Refers to ENA ER C61. |
| S4 | A cable manufacturer's "XLPE Land Cable Systems User's Guide", document 2GM5007GB rev 5, Table 19 | Single-core cables. Standard design (Cu wire screen only): 15 De at laying, 10 De when installed. Special design (metallic laminated or lead sheath, or integrated fibre): 18 De / 12 De. |
| S5 | A US cable manufacturer's specification "Training and Minimum Bending Radius", SPEC CTS0004, which quotes AEIC/ICEA and NEC 300.34 | Assembly of three single cables: Rmin = F x 2.155 x single-cable OD. For 5-35 kV, F = 5 for a wire shield and F = 7 for a lead sheath (single cable: 8 and 12). This is a training (final position) radius in US practice. |
| S8 | Northern Powergrid NPS/002/023 v5.0 (Nov 2024), 132 kV cable technical specification: https://www.northernpowergrid.com/sites/default/files/assets/NPS002023_0.pdf | Asks bidders to state the dynamic radius "in triplex and single core formations" and the static radius. No values are given. |

## Unverified or not reached

- IEC 60840. It is paywalled. It holds a type-test bending cylinder requirement, not an installation rule, so no value from it is used.
- ENA ER C61, "Installation Bending Radii of 33kV and Higher Voltage Cables", is referenced by S3. It is paywalled and was not read.
- UKPN ECS 02-0019 (https://g81.ukpowernetworks.co.uk/library/installation/cables/ecs-02-0019-installation-of-underground-cables-lv-to-132kv) returned HTTP 403.
- SP Energy Networks CAB-15-003 (https://www.spenergynetworks.co.uk/userfiles/file/CAB-15-003-issue-11.pdf) returned HTTP 403.
- The rule for 132 kV cables in trefoil is unverified: no open source was found. S3 applies D per single cable whatever the formation.
- The 33 kV trefoil rule rests only on US AEIC/ICEA practice (S5). No UK source was found for it.
- Electricity North West CP410 Issue 8 (June 2024) points to ES400E4/E5 and the jointing manuals for bending radii. Those were not read.

## Worked minimum radii, 1000 mm2 (radius = multiple x OD)

- 33 kV, OD 70.0 mm (estimated): 1.40 m during installation (20 x), 1.05 m in the final position (15 x).
- 132 kV, OD 91 mm (S1 schedule): 3.19 m pulled into ducts (35 x), 2.73 m laid direct (30 x), 1.82 m at joints and terminations (20 x).
- 132 kV, OD 115 mm (S7 armoured design): 4.03 m in ducts, 2.30 m final.
