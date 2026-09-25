"""Compare actual renderer panel vertices and route travel with CuPy calculations."""
from pathlib import Path
import json,time,hashlib,argparse
import numpy as np
import cupy as cp
ROOT=Path(__file__).parent
parser=argparse.ArgumentParser();parser.add_argument('fixture',nargs='?',type=Path,default=ROOT/'.local'/'explore-geometry.json');fixture=parser.parse_args().fixture
raw=fixture.read_bytes();data=json.loads(raw);s=data['settings'];v=np.array(data['vertices']).reshape(-1,6)
panel=v[np.all(np.isclose(v[:,3:],[.7,.79,.88],atol=1e-12),axis=1),:3]
started=time.perf_counter();cp.cuda.Stream.null.synchronize()
nt,nr,nc=s['tables'],s['rows'],s['columns'];w,l=s['moduleWidth'],s['moduleLength'];g=.02;t=np.deg2rad(s['tilt'])
table,row,col,edge=cp.meshgrid(cp.arange(nt),cp.arange(nr),cp.arange(nc),cp.arange(8),indexing='ij')
dx=cp.array([0,w,w,w,w,0,0,0],dtype=cp.float64)[edge.ravel()]
dy=cp.array([0,0,0,l,l,l,l,0],dtype=cp.float64)[edge.ravel()]
across=int(np.ceil(np.sqrt(nt)));span=nc*(w+g)-g;run=nr*(l+g)-g
x=col.ravel()*(w+g)+dx;y=row.ravel()*(l+g)+dy
local=cp.stack([x,y,cp.zeros_like(x)],axis=1)
rotation=cp.array([[1,0,0],[0,np.cos(t),-np.sin(t)],[0,np.sin(t),np.cos(t)]])
actual=local@rotation.T
actual[:,0]+=(table.ravel()%across)*(span+5)
actual[:,1]+=(table.ravel()//across)*(run*np.cos(t)+6)
actual[:,2]+=s['height']
assert panel.shape==actual.shape,(panel.shape,actual.shape)
panel_error=float(cp.max(cp.abs(actual-cp.asarray(panel))))
assert panel_error<1e-9,panel_error
route_results=[]
for r in data['routes']:
    p=np.array(r['points'],dtype=np.float64);segments=np.linalg.norm(np.diff(p,axis=0),axis=1);cum=np.r_[0,np.cumsum(segments)]
    gp=cp.asarray(p);gl=cp.sqrt(cp.sum(cp.diff(gp,axis=0)**2,axis=1));gc=cp.concatenate((cp.zeros(1),cp.cumsum(gl)))
    ds=np.unique(np.r_[np.linspace(0,cum[-1],65536),cum]);gd=cp.asarray(ds);idx=cp.minimum(cp.searchsorted(gc,gd,side='right')-1,len(p)-2)
    fraction=(gd-gc[idx])/gl[idx];positions=gp[idx]+fraction[:,None]*(gp[idx+1]-gp[idx])
    witness=np.stack([np.interp(ds,cum,p[:,k]) for k in range(3)],axis=1)
    error=float(cp.max(cp.abs(positions-cp.asarray(witness))));assert error<1e-9
    assert abs(float(gc[-1])-r['length'])<1e-9
    route_results.append({'id':r['id'],'samples':len(ds),'length_m':float(gc[-1]),'max_error_m':error})
cp.cuda.Stream.null.synchronize()
result={'device':cp.cuda.runtime.getDeviceProperties(0)['name'].decode(),'fixture_sha256':hashlib.sha256(raw).hexdigest(),'panel_vertices':len(panel),'panel_max_error_m':panel_error,'routes':route_results,'elapsed_s':time.perf_counter()-started,'scope':'Actual renderer geometry and route interpolation agreement. Not browser raster validation, collision clearance, electrical or structural approval.'}
out=ROOT/'.local';out.mkdir(exist_ok=True);(out/'gpu-scene-check.json').write_text(json.dumps(result,indent=2),encoding='utf8');print(json.dumps(result))
