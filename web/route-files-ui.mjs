import {MAX_ROUTE_FILE_BYTES,parseRouteFile,serializeRouteFile} from './route-file.mjs';
const input=document.getElementById('route-file'),status=document.getElementById('route-file-status');
input.addEventListener('change',async()=>{
 const file=input.files?.[0];if(!file)return;
 try{
  if(file.size>MAX_ROUTE_FILE_BYTES)throw Error('Choose a JSON file smaller than 16 MB.');
  const routes=parseRouteFile(await file.text());
  window.electricalExplorer.setRoutes(routes);
  status.textContent=`Loaded ${routes.length} cable routes. Select a cable to walk it, or use Full-site blueprint.`;
 }catch(error){status.textContent='Import failed: '+error.message;}
 finally{input.value='';}
});
document.getElementById('export-routes').addEventListener('click',()=>{
 try{
  const text=serializeRouteFile(window.electricalExplorer.state.routes),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');
  a.href=url;a.download='electrical-routes.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  status.textContent='Exported all modelled cable routes as metric ENU JSON.';
 }catch(error){status.textContent='Export failed: '+error.message;}
});
