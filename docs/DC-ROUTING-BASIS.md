# DC drawing basis

660 W per module; 30 modules per string =19.8 kWp. A paired table contains two450-module faces =594 kWp installed. Each inverter accepts at most24 strings /720 modules /475.2 kWp DC. This is a geometry/topology constraint, not an electrical operating-point or input-rating approval.

Four ducts per inverter, each containing six complete strings: six positive and six negative6 mm² home cables. The model routes these along a rail, down to a buried section, then through a grouped riser to the inverter at the table ridge height. Default burial0.6 m and duct outside diameter90 mm are visual assumptions, not specified or checked installation dimensions. Swept bends, fill, heat dissipation, gland arrangements, pulling tension and mounting approval remain unverified.

Sequential order is1..30. Leapfrog order is1,3,..29,30,28,..2. This independently implemented ordering was checked against V11 commit89731ab, browser/v8-actual-connections.mjs, and the inherited FIRE model in kuiper-ship/web/vendor/fire-string.js. No V11 implementation was copied. Rail-offset lines are schematic paths; actual factory lead lengths and mating compatibility have not been validated here. Junction-box separation0.84 m is inherited as a drawing assumption.

## Local connector detail

`tools/convert-connector.cjs` uses the separately installed occt-import-js package to tessellate a locally supplied STEP file to bounded metric feature-edge JSON. The inverter inspector accepts one or two JSON files through the browser File API. Data stays in memory; there is no upload, persistence or automatic download. Manufacturer CAD is not bundled or relicensed with this repository.

The local source study identified Stäubli legacy EVO2 plug32.0087 and socket32.0086; these are not the newer EVO2A variants. Mounting locations and connector port arrangement are illustrative, not verified manufacturer inverter geometry. Public redistribution rights for manufacturer CAD have not been established. Source catalogue: https://standstep.ec.staubli.com/ . Terms: https://www.staubli.com/us/en/imprint.html . Importer documentation: https://github.com/kovacsv/occt-import-js .
