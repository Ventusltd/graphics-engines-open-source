// Portable local metric routes. No network requests or inferred site geometry.
export const MAX_ROUTE_FILE_BYTES=16*1024*1024;
export function parseRouteFile(text){
 if(typeof text!=='string'||text.length>MAX_ROUTE_FILE_BYTES)throw Error('Route file must be JSON, at most 16 MB.');
 const data=JSON.parse(text);
 if(!data||data.schema!=='electrical-routes/1'||data.units!=='metres'||data.axes!=='ENU')throw Error('Expected electrical-routes/1 with units metres and axes ENU.');
 if(!Array.isArray(data.routes)||!data.routes.length||data.routes.length>1000)throw Error('Provide 1–1000 cable routes.');
 let count=0;const ids=new Set();
 return data.routes.map(r=>{
  if(!r||typeof r.id!=='string'||!r.id.trim()||r.id.length>200||ids.has(r.id))throw Error('Each route requires a unique ID of 1–200 characters.');
  ids.add(r.id);
  if(r.label!==undefined&&(typeof r.label!=='string'||r.label.length>1000))throw Error('Route labels must be text, at most 1000 characters.');
  if(!Array.isArray(r.points)||r.points.length<2||r.points.length>10000)throw Error('Each route requires 2–10000 points.');
  count+=r.points.length;if(count>100000)throw Error('Maximum 100000 cable points per file.');
  const points=r.points.map((p,i)=>{
   if(!Array.isArray(p)||p.length!==3||!p.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<1e7))throw Error('Points must contain finite east, north, up coordinates in metres.');
   if(i&&Math.hypot(...p.map((v,j)=>v-r.points[i-1][j]))<1e-6)throw Error('Repeated consecutive points are not allowed.');
   return [...p];
  });
  return {id:r.id,label:r.label??r.id,points};
 });
}
export function serializeRouteFile(routes){
 const envelope={schema:'electrical-routes/1',units:'metres',axes:'ENU',routes:routes.map(r=>({id:r.id,label:r.label??r.id,points:r.points}))};
 const text=JSON.stringify(envelope,null,2);
 parseRouteFile(text);
 if(new TextEncoder().encode(text).length>MAX_ROUTE_FILE_BYTES)throw Error('Export exceeds the 16 MB file limit.');
 return text;
}
