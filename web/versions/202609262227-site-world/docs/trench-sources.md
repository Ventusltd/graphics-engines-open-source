# Trench cross-section sources

Backs `web/world/data/trench-sections.json`. Researched 26 Sept 2026 from public documents. Status meanings:
**verified** means the figure is printed in a DNO specification. **typical** means it comes from a project drawing, or it was worked out from verified spacings. **owner-rule** means it is a site design rule for this project, not a DNO figure.

## Sources

- **S1** Electricity North West, ES400E5 Issue 9 (Nov 2024), *Installation and Repair of Underground Cables Operating at 33kV and 132kV*. enwl.co.uk policy library. The document is marked DRAFT.
- **S2** UK Power Networks, ECS 02-0019 v10.0 (June 2015), *Installation of Underground Cables, LV to 132kV*. The copy read was an uncontrolled one, so a newer version may exist.
- **S3** Northern Powergrid, NSP/002 v5.0 (Oct 2021), *Policy for the Installation of Distribution Power Cables*. northernpowergrid.com/sites/default/files/2022-05/1855.pdf
- **S4** A public planning (DCO) drawing for a solar farm, 2020: *132kV Substation and Battery Storage Cable Trench Details*, a Northern Powergrid 132 kV connection. Published by the Planning Inspectorate (National Infrastructure Planning).
- **S5** A public planning (DCO) environmental statement figure for a solar farm, 2025: *Typical Trenched Crossings Cross-Sections*. Published by the Planning Inspectorate. The drawing is marked indicative and not for construction.
- Referenced but not read: ENA TS 09-02 (11 kV to 400 kV installation), ENA TS 97-01 (special backfill, CBS), ENA TS 12-23 (route marking), ENA TS 12-24 (ducts), NJUG Vol 1 (positioning of utilities), SSEN TG-NET-CAB-001, and the SPEN Kendoon-Tongland 132 kV study. The SPEN study returned HTTP 403.

## Depth of cover to the top of the uppermost cable or duct

| Voltage | Footway / verge | Carriageway | Good agricultural | Other land | Source |
|---|---|---|---|---|---|
| LV | 0.45 | 0.60 | 0.91 | 0.45 | S3 Table 1 |
| LV | 0.45 | 0.60 | 1.05 (1.20 deep plough) | 0.45 private | S2 cl 6 |
| 33 kV | 0.75 | 0.75 | 0.91 | 0.75 | S1 Table 5.4.1, S3 Table 1 |
| 33 kV | 0.90 | 0.90 | 1.05 (1.20) | 0.90 | S2 cl 6 |
| 132 kV | 0.90 | 0.90 | 0.91 | 0.90 | S1, S3 |
| 132 kV | 0.90 | 0.90 | 1.05 (1.20) | 0.90 | S2 |

- Tolerance is -0 / +0.3 m (S1). NPg sets a maximum of minimum + 0.10 m (S3 Table 2).
- Railway land needs 1.25 m from the top of the rail, and the cable must be at least 2 m horizontally from the rail (S1).
- S1 allows 33 kV cover to drop to 0.60 m in high-strength 1500 N duct.
- **Site design rules checked:** the 0.9 m cover for 33 kV matches UKPN and is deeper than ENWL and NPg (0.75 m), except on good agricultural land (0.91 m). The 0.6 m cover for DC strings matches the LV carriageway figure and is deeper than LV footway. It is shallower than the DNO LV figures for agricultural land (0.91 to 1.05 m). A fenced solar field is not public highway, and no DNO rule governs private DC cabling. BS 7671 gives no numeric depth, so 0.6 m stays a site design rule.

## Bedding, surround and markers

- **LV to 20 kV:** lay the cable on the trench bottom if it is smooth. Otherwise dig 75 mm deeper and add a sand bed. Blind 75 mm above the cable with stone-free soil, sand or limestone dust (S3 3.2.12). UKPN blinds to 100 mm (S2 7.7). Protection tape goes 150 mm above the top cable (S3 Note 3).
- **33 to 132 kV:** a 75 mm bed of sand or cement bound sand (CBS) to ENA TS 97-01, then blind 75 mm above (S3). UKPN uses a CBS bed compacted to 75 mm and blinds 100 mm above (S2 7.1, 7.7). S1 now requires at least 75 mm of surround at the base and sides, aligned with ENA TS 09-02.
- **Tiles:**
  - NPg places protection tiles 75 mm above the top cable or duct (S3).
  - ENWL places tiles or tape at least 100 mm above, overlapping the cables by at least 50 mm (S1 5.4.3).
  - UKPN uses a 1000 x 244 x 9 mm polymer board at 33 kV and above, and 200 mm tile tape below 33 kV (S2 6.1).
  - Direct-buried 33 kV now takes tiles, not tape (S1 Issue 8).
  - ENWL ducted 33 kV takes tape (S1 Table 5.4.3).
  - No marker is needed over directional-drilled ducts (S1, S2).

## Formation and spacing

- **Between circuits:**
  - ENWL: 450 mm between outer sheaths for trefoil, flat or ducted circuits, with about 10% derating if closer (S1 Table 5.4.2).
  - NPg, between centres: LV/11/20 kV to the same class, 300 mm; LV/11/20 kV to 33/66 kV, 450 mm; 33/66 kV to 33/66 kV, 450 mm; all 132 kV, 600 mm (S3 Table 3).
- **Trench sides:** leave 50 mm between any cable or duct and the trench side (S3).
- **Trefoil phase spacing:** S4 shows ducted trefoils with a trefoil spacer, so the phase spacing equals the duct OD. The 45 mm cable OD used for direct-buried 33 kV is **assumed**.

## Other services

These are minimum spacings between centres (S3 Table 3):

- Any cable to a street lighting or service cable: 100 mm.
- Power cable to a telecom or pilot pair cable that is not associated with it: 225 mm.
- Auxiliary cable to auxiliary cable: 225 mm.

ENWL asks for 50 mm between power cables and their own metallic pilot where practicable (S1). For the positions of other utilities, use NJUG Vol 1 (not read).

## Ducts

- **Open trench, NPg (S3 Table 5):**
  - LV main: 150/125 twin wall.
  - 11 to 20 kV: 150/125, or 175/150 above 300 mm².
  - 33 kV to 132 kV: 160/150 per phase.
  - Auxiliary cables: 96.5/90.
- **Trenchless, NPg:** 180 mm OD SDR-11 for 66 to 132 kV.
- **UKPN minimum internal diameter at 33 kV:** 150 mm up to 500 mm², and 190 mm for 630 to 800 mm² (S2 App A).
- **S4 project drawing:**
  - 132 kV: three 160 mm OD ducts in trefoil, plus fibre in an 89.9 mm OD duct.
  - 33 kV: 100 mm OD ducts.
- **Solar DC:** the site design rule uses 90 mm OD ducts. S5 shows DC in 110 mm OD ducts at 450 mm cover, 75 mm from the trench sides.

## Unverified or derived (treat as placeholders)

- Every single-circuit **trench width** except S4 is assumed at 0.45 m. The S4 widths (0.65 m at 132 kV and 0.35 m at 33 kV) were **scaled** from a 1:10 drawing and are not dimensioned.
- Every two-circuit width was **derived** from the spacings above, not read from a drawing.
- **Trench depths** are cover + formation height + 75 mm bed, worked out by arithmetic.
- The 1.5 m cover at 132 kV is a single project's choice (S4), not a DNO rule.
- No SSEN, SPEN or National Grid figures were read.
