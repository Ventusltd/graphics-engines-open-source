# Electrical scene explorer

A lightweight browser blueprint and 3D inspection prototype for electrical sites. Original renderer code uses WebGL; no proprietary engine or assets are included.

## Run locally

Run `python -m http.server 8765 --bind 127.0.0.1 --directory web` from this repository, then open http://127.0.0.1:8765/ .

Use Blueprint for the whole scene, Orbit to inspect geometry, Free flight to navigate rows, and Walk cable to follow a selected route from endpoint to endpoint. Numeric dimensions use metres. First-person movement is an inspection camera, not a collision or safe-access assessment.

The optional GridAtlas picker fetches a pinned public project-point index only when requested. Selecting a point anchors the illustrative scene geographically; it does not recover the actual site's boundaries, cables or installed array layout. No confidential project documents or geometry are bundled.

## Scope

This first prototype is a bounded scene, not a nationwide detailed model. Cable paths are editable through the JavaScript API `window.electricalExplorer.setRoutes([{id,label,points:[[x,y,z],...]}])`; coordinates are local east, north, up. Routes are illustrative and do not automatically reroute when arrays change. There is no power-flow, thermal, electromagnetic, earthing or structural solver in the renderer.

## Existing work to integrate

- GridAtlas: https://ventusltd.github.io/gridatlas/atlas/
- Parametric array geometry: https://github.com/Ventusltd/kuiper-drawing-engine
- Cable sizes and trench geometry: https://globalgrid2050.com/solar-bess-topology-v7/cable-geometry-visualiser/

Preserve the cable catalogue's distinction between estimated dimensions and verified product drawings. Planning-envelope values, measured dimensions and user assumptions must remain distinguishable.

## Rendering options

The first viewer is dependency-free WebGL. Future adapters may use Three.js (MIT), Babylon.js (Apache-2.0), or CesiumJS (Apache-2.0) after checking the exact pinned version and retaining its notices. No such library is currently bundled. Geometry and route data should remain independent of the renderer.

## Provenance and verification

`source-manifest.json` records the source files copied from the separately maintained prototype. Numerical checks and browser interaction checks are different evidence; successful geometry tests do not establish rendered performance or engineering approval.
