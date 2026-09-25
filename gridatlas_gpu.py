"""All valid solar points against all valid substations in supplied Atlas snapshots.
Geographic proximity only: no connectivity, voltage suitability or capacity inference.
"""
import argparse,hashlib,json,time,math
from pathlib import Path
import numpy as np
import cupy as cp
p=argparse.ArgumentParser();p.add_argument('projects',type=Path);p.add_argument('substations',type=Path);a=p.parse_args()
def load(path):
    b=path.read_bytes();return json.loads(b),hashlib.sha256(b).hexdigest()
projects,ph=load(a.projects);subs,sh=load(a.substations)
def valid(lon,lat):
    return all(type(v) in (int,float) and math.isfinite(v) for v in (lon,lat)) and -180<=lon<=180 and -90<=lat<=90 and not(lon==0 and lat==0) and not(abs(lon+7.55716)<1e-4 and abs(lat-49.766807)<1e-4)
solar=[];solar_total=0
for row in projects['rows']:
    r=dict(zip(projects['fields'],row));technology=projects['dictionaries']['technology'][r['technology']]
    if technology!='solar':continue
    solar_total+=1
    if valid(r['longitude'],r['latitude']):solar.append((str(r['repd_ref']),r['longitude'],r['latitude']))
stations=[]
for i,f in enumerate(subs['features']):
    g=f.get('geometry') or {};xy=g.get('coordinates') or []
    if g.get('type')=='Point' and len(xy)>=2 and valid(xy[0],xy[1]):stations.append((i,float(xy[0]),float(xy[1])))
if not stations or not solar:raise ValueError('No usable coordinates')
s=np.array([r[1:] for r in solar]);b=np.array([r[1:] for r in stations]);br=np.deg2rad(b);sr=np.deg2rad(s)
def unit(r):return np.c_[np.cos(r[:,1])*np.cos(r[:,0]),np.cos(r[:,1])*np.sin(r[:,0]),np.sin(r[:,1])]
gb=cp.asarray(unit(br));out=[];maxerr=0;start=time.perf_counter()
for first in range(0,len(s),256):
    last=min(len(s),first+256);ga=cp.asarray(unit(sr[first:last]));delta=ga[:,None,:]-gb[None,:,:]
    chord=cp.sqrt(cp.sum(delta*delta,axis=2));dist=2*6371000.0*cp.arcsin(cp.clip(chord/2,0,1));near=cp.argmin(dist,axis=1);vals=dist[cp.arange(last-first),near]
    # Independent CPU haversine for EVERY pair, not just selected nearest points.
    lat=sr[first:last,1,None];lon=sr[first:last,0,None]
    hav=np.sin((lat-br[None,:,1])/2)**2+np.cos(lat)*np.cos(br[None,:,1])*np.sin((lon-br[None,:,0])/2)**2
    cpu=2*6371000.0*np.arctan2(np.sqrt(np.clip(hav,0,1)),np.sqrt(np.clip(1-hav,0,1)))
    host=dist.get();error=float(np.max(np.abs(host-cpu)));maxerr=max(maxerr,error);assert error<1e-5,error
    ids=near.get();assert np.all(np.abs(cpu[np.arange(last-first),ids]-cpu.min(axis=1))<1e-5)
    for k,(idx,d) in enumerate(zip(ids,vals.get())):out.append({'repd_ref':solar[first+k][0],'substation_snapshot_index':stations[int(idx)][0],'straight_distance_m':float(d)})
cp.cuda.Stream.null.synchronize()
result={'project_sha256':ph,'substation_sha256':sh,'solar_records':solar_total,'valid_solar':len(solar),'unlocated_solar':solar_total-len(solar),'substation_records':len(subs['features']),'valid_substations':len(stations),'unlocated_substations':len(subs['features'])-len(stations),'all_pair_checks':len(s)*len(b),'gpu_cpu_max_error_m':maxerr,'elapsed_s':time.perf_counter()-start,'device':cp.cuda.runtime.getDeviceProperties(0)['name'].decode(),'meaning':'Nearest among this coordinate snapshot, on a spherical Earth. Not connection suitability, network capacity, actual route or national completeness.'}
root=Path(__file__).parent/'.local';root.mkdir(exist_ok=True)
(root/'atlas-gpu-summary.json').write_text(json.dumps(result,indent=2));(root/'atlas-nearest.json').write_text(json.dumps({'provenance':result,'results':out},separators=(',',':')))
print(json.dumps(result))
