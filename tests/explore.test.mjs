import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const nodes=new Map();
function node(id){if(!nodes.has(id))nodes.set(id,{value:'2',checked:id==='props',clientWidth:1200,clientHeight:800,getContext:()=>null,addEventListener(){},focus(){},replaceChildren(){},setPointerCapture(){}});return nodes.get(id);}
const context=vm.createContext({document:{getElementById:node,querySelector:()=>node('aside')},window:{addEventListener(){}},console,Float32Array,Option:class{},requestAnimationFrame(){},devicePixelRatio:1});
vm.runInContext(fs.readFileSync(new URL('../web/explore.mjs',import.meta.url),'utf8'),context);
const evaluate=code=>vm.runInContext(code,context),plain=value=>JSON.parse(JSON.stringify(value));
assert.deepEqual(plain(evaluate('routeAt(routes[0],0)')),[0,0,.4]);
assert.deepEqual(plain(evaluate('routeAt(routes[0],routes[0].length)')),[18,-8,.4]);
assert.deepEqual(plain(evaluate('routeAt(routes[0],3)')),[0,-3,.4]);
assert.deepEqual(plain(evaluate('routeAt(routes[0],9)')),[6,-3,.4]);
assert.throws(()=>evaluate('validateRoutes([{id:"bad",points:[[0,0,0],[0,0,0]]}])'),/repeated/);
assert.throws(()=>evaluate('validateRoutes([{id:"bad",points:[[0,0,0],[NaN,0,0]]}])'),/finite/);
assert.throws(()=>evaluate('validateRoutes([{id:"a",points:[[0,0,0],[1,0,0]]},{id:"a",points:[[0,0,0],[1,0,0]]}])'),/unique/);
evaluate('settings.height=20;build()');
assert.ok(evaluate('vertices.some((v,i)=>i%6===2&&v>20)'),'20 m lower edge supports higher upper edge');
for(const mode of ['top','orbit','walk','fly','cable']){evaluate(`changeMode('${mode}')`);const m=evaluate('(()=>{const c=camera();return matrixMultiply(projection(1.5,mode==="top"),viewMatrix(c.position,c.target,c.up));})()');assert.ok([...m].every(Number.isFinite),mode+' camera finite');}
const top=plain(evaluate('changeMode("top");camera()'));
assert.equal(top.position[0],top.target[0]);assert.equal(top.position[1],top.target[1]);assert.ok(top.position[2]>top.target[2]);
const m=evaluate('viewMatrix([0,0,10],[0,0,0],[0,1,0])');assert.equal(m[14],-10);
evaluate('const originalRoutes=routes;routes=validateRoutes([{id:"vertical",points:[[0,0,0],[0,0,5]]}]);routeIndex=0;distance=5;changeMode("cable")');
assert.ok([...evaluate('(()=>{const c=camera();return viewMatrix(c.position,c.target)})()')].every(Number.isFinite));
for(const points of [[[0,0,0],[.25,0,0],[0,0,0],[0,1,0]],[[0,0,0],[0,0,.0001]]]){evaluate(`routes=validateRoutes([{id:'edge',points:${JSON.stringify(points)}}]);distance=0`);assert.ok(Math.abs(evaluate('(()=>{const c=camera();return Math.hypot(...sub(c.target,c.position))})()')-1)<1e-9);const basis=evaluate('(()=>{const c=camera();return viewMatrix(c.position,c.target)})()');for(let column=0;column<3;column++)assert.ok(Math.abs(Math.hypot(...basis.slice(column*4,column*4+3))-1)<1e-6);}
evaluate('changeMode("fly");eye=[0,0,0];heading=0;lookPitch=Math.PI/3;keys.add("w");lastTime=0;tick(50);keys.clear()');
assert.ok(Math.abs(evaluate('eye[1]')-.05)<1e-9);
evaluate('routes=originalRoutes;settings.height=1.5;build()');
const fixture=evaluate('({settings,vertices,routes:routes.map(r=>({id:r.id,points:r.points,length:r.length})),units:"metres",stride:6,axes:"east,north,up",columns:"x,y,z,r,g,b"})');
if(process.argv[2]){fs.mkdirSync(new URL('../.local/',import.meta.url),{recursive:true});fs.writeFileSync(process.argv[2],JSON.stringify(fixture));}
evaluate('activatePlant()');
const inventory=plain(evaluate('window.electricalExplorer.plantInventory'));
assert.equal(inventory.modules,151516);assert.equal(inventory.blocks.reduce((sum,b)=>sum+b.modules,0),151516);
assert.equal(inventory.stationCount,10);assert.equal(inventory.blocks.flatMap(b=>b.station.transformers).length,20);
assert.equal(inventory.actualDCMWp,100.00056);assert.equal(inventory.aggregateTransformerMVA,100);
assert.equal(evaluate('routes.length'),10);assert.equal(evaluate('settings.rows'),5);
assert.ok(evaluate('vertices.length')<1000000,'overview remains bounded');
console.log('Explorer: routes, camera, raised geometry and 100 MWp inventory checks passed.');
