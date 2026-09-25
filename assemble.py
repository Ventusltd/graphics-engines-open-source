"""Copy the explicitly listed original prototype files; no project data."""
from pathlib import Path
import hashlib,json,argparse
ROOT=Path(__file__).parent
parser=argparse.ArgumentParser();parser.add_argument('source',type=Path);SOURCE=parser.parse_args().source
files={'web/explore.html':'web/index.html','web/explore.mjs':'web/explore.mjs','web/explore.css':'web/explore.css','web/gridatlas.mjs':'web/gridatlas.mjs','web/atlas-picker.mjs':'web/atlas-picker.mjs','LICENSE-ARRAY':'LICENSE','tests/explore.test.mjs':'tests/explore.test.mjs','tests/gridatlas.test.mjs':'tests/gridatlas.test.mjs'}
manifest=[]
for src,dst in files.items():
    raw=(SOURCE/src).read_bytes();p=ROOT/dst;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(raw)
    manifest.append({'source_repository':'Ventusltd/kuiper-drawing-engine','source_file':src,'destination':dst,'sha256':hashlib.sha256(raw).hexdigest(),'basis':'local working-tree prototype, not a released upstream version'})
(ROOT/'source-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf8')
print(json.dumps({'files':len(files),'web_bytes':sum((ROOT/v).stat().st_size for v in files.values() if v.startswith('web/'))}))
