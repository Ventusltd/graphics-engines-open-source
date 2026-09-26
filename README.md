# Electrical scene explorer

A lightweight browser blueprint and 3D inspection prototype for electrical sites. Original renderer code uses WebGL; no proprietary engine or assets are included.

## Run locally

Run `python -m http.server 8765 --bind 127.0.0.1 --directory web` from this repository, then open http://127.0.0.1:8765/ .

Use Blueprint for the whole scene, Orbit to inspect geometry, Free flight to navigate rows, and Walk cable to follow a selected route from endpoint to endpoint. Numeric dimensions use metres. First-person movement is an inspection camera, not a collision or safe-access assessment.

The optional GridAtlas pickers fetch pinned public project and substation points only when requested. Selecting a point anchors the illustrative scene geographically; it does not recover the actual site's boundaries, cables or installed array layout. Displayed IDs are neutral; no confidential project documents or geometry are bundled.

## Scope

This first prototype is a bounded scene, not a nationwide detailed model. Import/export cable routes using local JSON files, or use `window.electricalExplorer.setRoutes([{id,label,points:[[x,y,z],...]}])`; coordinates are local east, north, up in metres. Routes do not automatically reroute when arrays change. There is no power-flow, thermal, electromagnetic, earthing or structural solver in the renderer.

`gridatlas_gpu.py PROJECTS_JSON SUBSTATIONS_GEOJSON` compares every valid solar point against every valid substation in those supplied snapshots, in bounded GPU batches. Independent CPU haversine calculations witness every distance. Outputs remain under ignored `.local/`; nearest proximity does not imply a feasible connection, capacity or a cable route. The verified initial batch covered 3,558 located solar records and 5,800 substation points (20,636,400 pairs); five solar records lacked usable locations.

## Existing work to integrate

- GridAtlas: https://ventusltd.github.io/gridatlas/atlas/
- Parametric array geometry: https://github.com/Ventusltd/kuiper-drawing-engine
- Cable sizes and trench geometry: https://globalgrid2050.com/solar-bess-topology-v7/cable-geometry-visualiser/

Preserve the cable catalogue's distinction between estimated dimensions and verified product drawings. Planning-envelope values, measured dimensions and user assumptions must remain distinguishable.

## Site world versions

`web/versions/` holds dated releases of the site world viewer (1 m LiDAR terrain of an anonymous test site, walk and drone views, trench and cable routes), published next to the explorer at `versions/`. Each folder is self-contained, its layers are hash-checked against its own `world/manifest.json`, and older folders are never changed. `web/versions/index.json` lists them. Terrain, grid and project data keep their own licences, listed in each version's `world/ATTRIBUTION.md`.

## Rendering options

The first viewer is dependency-free WebGL. Future adapters may use Three.js (MIT), Babylon.js (Apache-2.0), or CesiumJS (Apache-2.0) after checking the exact pinned version and retaining its notices. No such library is currently bundled. Geometry and route data should remain independent of the renderer.

## Provenance and verification

`source-manifest.json` records the source files copied from the separately maintained prototype. Numerical checks and browser interaction checks are different evidence; successful geometry tests do not establish rendered performance or engineering approval.
