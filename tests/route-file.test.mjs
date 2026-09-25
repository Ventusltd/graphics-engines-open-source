import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parseRouteFile,serializeRouteFile,MAX_ROUTE_FILE_BYTES} from '../web/route-file.mjs';
const routes=[{id:'DC-1',label:'Circuit A · DC unspecified',points:[[0,0,.4],[1,2,.4],[3,2,.4]]}];
const envelope=()=>({schema:'electrical-routes/1',units:'metres',axes:'ENU',routes});
test('round-trip retains labels, metres and XYZ coordinates',()=>{assert.deepEqual(parseRouteFile(serializeRouteFile(routes)),routes);});
test('requires version and metric ENU; rejects malformed and oversized files',()=>{
 for(const replacement of [{schema:'v2'},{units:'feet'},{axes:'NED'},{routes:[]}])assert.throws(()=>parseRouteFile(JSON.stringify({...envelope(),...replacement})));
 assert.throws(()=>parseRouteFile('{'));
 assert.throws(()=>parseRouteFile(' '.repeat(MAX_ROUTE_FILE_BYTES+1)),/16 MB/);
});
test('rejects invalid route geometry and metadata',()=>{
 for(const r of [{...routes[0],points:[[0,0,0],[0,0,0]]},{...routes[0],points:[[0,0,0],['1',2,3]]},{...routes[0],id:''},{...routes[0],label:{}},{...routes[0],points:[[0,0,0],[1e7,0,0]]}])assert.throws(()=>parseRouteFile(JSON.stringify({...envelope(),routes:[r]})));
 assert.throws(()=>parseRouteFile(JSON.stringify({...envelope(),routes:[routes[0],routes[0]]})),/unique/);
 const many=Array.from({length:11},(_,n)=>({id:String(n),points:Array.from({length:10000},(_,i)=>[i,0,0])}));
 assert.throws(()=>parseRouteFile(JSON.stringify({...envelope(),routes:many})),/100000/);
});
test('import through real viewer API is atomic and export survives roundtrip',()=>{
 const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'2',checked:id==='props',clientWidth:1200,clientHeight:800,getContext:()=>null,addEventListener(){},focus(){},replaceChildren(){},setPointerCapture(){}});return nodes.get(id);};
 const context=vm.createContext({document:{getElementById:node,querySelector:()=>node('aside')},window:{addEventListener(){}},console,Float32Array,Option:class{},requestAnimationFrame(){},devicePixelRatio:1});
 vm.runInContext(fs.readFileSync(new URL('../web/explore.mjs',import.meta.url),'utf8'),context);
 const api=context.window.electricalExplorer;
 api.setRoutes(parseRouteFile(serializeRouteFile(routes)));
 assert.equal(api.state.routes[0].label,routes[0].label);
 const before=serializeRouteFile(api.state.routes);
 assert.throws(()=>api.setRoutes([{id:'bad',points:[[0,0,0],[0,0,0]]}]));
 assert.equal(serializeRouteFile(api.state.routes),before);
 assert.deepEqual(parseRouteFile(before),routes);
});
