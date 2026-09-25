"""Bounded repeat checks of a fixed renderer fixture; no editing or publishing."""
from pathlib import Path
import argparse
import datetime as dt
import hashlib
import json
import os
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
SCOPE = ('Repeated CuPy reproducibility checks of the fixed baseline renderer fixture. '
         'Not new design exploration, 100 MWp preset coverage, browser rendering, '
         'electrical approval, collision checking, or automatic repair.')


def stamp():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def atomic_json(path, value):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(value, indent=2), encoding='utf-8')
    os.replace(temporary, path)


def hashes(fixture):
    files = [fixture, ROOT / 'check_scene_gpu.py', ROOT / 'web/explore.mjs',
             ROOT / 'tests/explore.test.mjs', Path(__file__).resolve()]
    return {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in files}


def run_watch(args):
    output = ROOT / '.local/watch'
    output.mkdir(parents=True, exist_ok=True)
    run_id = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    run_dir = output / run_id
    run_dir.mkdir()
    started = time.monotonic()
    deadline = started + args.duration
    state = {'run_id': run_id, 'state': 'running', 'started_at': stamp(),
             'duration_s': args.duration, 'interval_s': args.interval,
             'samples': 0, 'scope': SCOPE, 'run_directory': str(run_dir)}
    def save():
        state['updated_at'] = stamp()
        atomic_json(output / 'status.json', state)
        atomic_json(run_dir / 'status.json', state)
    save()
    try:
        baseline = hashes(args.fixture)
        state['source_hashes'] = baseline
        save()
        for sample in range(1, 61):
            due = started + (sample - 1) * args.interval
            if due >= deadline:
                break
            time.sleep(max(0, due - time.monotonic()))
            current = hashes(args.fixture)
            if current != baseline:
                raise RuntimeError('Source or fixture changed; stopped to avoid reporting stale-fixture validation.')
            record = {'sample': sample, 'started_at': stamp(), 'source_hashes': current}
            flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0) if os.name == 'nt' else 0
            result = subprocess.run([sys.executable, str(ROOT / 'check_scene_gpu.py'),
                                     str(args.fixture)], cwd=ROOT, capture_output=True,
                                    text=True, timeout=45, creationflags=flags)
            record.update(returncode=result.returncode, finished_at=stamp())
            log = (result.stdout + '\n' + result.stderr)[-65536:]
            (run_dir / f'log-{sample % 10:02d}.txt').write_text(log, encoding='utf-8')
            if result.returncode == 0:
                record['result'] = json.loads(result.stdout.strip().splitlines()[-1])
                if record['result'].get('fixture_sha256') != baseline[str(args.fixture)]:
                    raise RuntimeError('Checker result refers to a different fixture.')
            else:
                record['error'] = log[-4000:]
            atomic_json(run_dir / f'sample-{sample:02d}.json', record)
            state['samples'] = sample
            state['last_sample'] = record
            save()
            if result.returncode:
                raise RuntimeError(f'GPU check failed with exit code {result.returncode}; see sample log.')
            if time.monotonic() >= deadline:
                break
        time.sleep(max(0, deadline - time.monotonic()))
        state['state'] = 'complete'
    except (Exception, KeyboardInterrupt) as error:
        state['state'] = 'failed'
        state['error'] = str(error) or type(error).__name__
    finally:
        state['finished_at'] = stamp()
        state['elapsed_s'] = round(time.monotonic() - started, 3)
        save()
    if args.dispatch_summary and state['state'] == 'complete':
        result = state['last_sample']['result']
        summary = {'schema': 'local-gpu-summary/1', 'status': 'pass',
                   'samples': state['samples'], 'fixture_sha256': result['fixture_sha256'],
                   'panel_max_error_m': result['panel_max_error_m'],
                   'route_max_error_m': max((r['max_error_m'] for r in result['routes']), default=0)}
        try:
            flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0) if os.name == 'nt' else 0
            dispatch = subprocess.run(['gh', 'workflow', 'run', 'geometry-check.yml',
                                       '--repo', 'Ventusltd/graphics-engines-open-source',
                                       '-f', 'local_gpu_summary=' + json.dumps(summary, separators=(',', ':'))],
                                      capture_output=True, text=True, timeout=30, creationflags=flags)
            state['dispatch'] = {'state': 'submitted' if dispatch.returncode == 0 else 'failed',
                                 'returncode': dispatch.returncode}
            if dispatch.returncode:
                state['dispatch']['error'] = dispatch.stderr[-2000:]
        except Exception as error:
            state['dispatch'] = {'state': 'failed', 'error': str(error)}
        save()
    return 0 if state['state'] == 'complete' else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fixture', type=Path, default=ROOT / '.local/explore-geometry.json')
    parser.add_argument('--duration', type=float, default=3600)
    parser.add_argument('--interval', type=float, default=60)
    parser.add_argument('--dispatch-summary', action='store_true',
                        help='Opt in to sending only allowlisted numeric/hash results to the public CPU workflow after success.')
    args = parser.parse_args()
    if not 1 <= args.duration <= 3600 or not 1 <= args.interval <= 3600:
        parser.error('duration and interval must be between 1 and 3600 seconds')
    args.fixture = args.fixture.resolve()
    return run_watch(args)


if __name__ == '__main__':
    raise SystemExit(main())
