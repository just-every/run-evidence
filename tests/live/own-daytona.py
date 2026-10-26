#!/usr/bin/env python3
"""Held-key OWN Ubuntu journey. Invoke via injector and heavy-slot, after committing.

EVIDENCE_OWN_SHA selects the public full candidate SHA after the exact README
first start. EVIDENCE_OWN_ARTIFACTS must name a private directory outside the repo.
The SDK credential stays in the controller; it is never sent to the sandbox.
"""
import datetime
import json
import os
from pathlib import Path
import re
import subprocess
import time

from daytona import Daytona, DaytonaConfig, CreateSandboxFromImageParams, Resources, DaytonaNotFoundError


def event(kind, **data):
    print(json.dumps(dict(event=kind, at=datetime.datetime.now(datetime.timezone.utc).isoformat(), **data)), flush=True)


def main():
    here = Path(__file__).resolve().parent
    repo = here.parent.parent
    assert not subprocess.check_output(['git','status','--porcelain','--untracked-files=no'], cwd=repo), 'commit tracked changes first'
    output = Path(os.environ['EVIDENCE_OWN_ARTIFACTS']).resolve()
    assert not output.is_relative_to(repo), 'business artifacts must stay outside checkout'
    output = output / 'ubuntu'
    output.mkdir(parents=True, exist_ok=True, mode=0o700)
    sha = os.environ.get('EVIDENCE_OWN_SHA', subprocess.check_output(['git','rev-parse','HEAD'], cwd=repo, text=True).strip())
    assert re.fullmatch('[a-f0-9]{40}', sha)
    client = Daytona(DaytonaConfig(api_url='https://app.daytona.io/api'))
    sandbox = None
    name = 'evidence-own-i816-' + str(int(time.time()))
    try:
        sandbox = client.create(CreateSandboxFromImageParams(name=name,
            image='ubuntu:24.04', os_user='root', public=False, auto_stop_interval=0,
            auto_delete_interval=0, ttl_minutes=180, labels={'run':'sx-evidence-c-i816'},
            resources=Resources(cpu=2, memory=4, disk=12)), timeout=300)
        event('sandbox_created', sandbox_id=sandbox.id)
        bootstrap = ('export DEBIAN_FRONTEND=noninteractive; apt-get update -qq && '
            'apt-get install -y -qq ca-certificates curl git python3 tcpdump xz-utils && '
            'curl -fsSL https://nodejs.org/dist/v22.20.0/node-v22.20.0-linux-x64.tar.xz '
            '| tar -xJ -C /usr/local --strip-components=1 && '
            'test "$(. /etc/os-release; echo "$ID:$VERSION_ID")" = ubuntu:24.04')
        result = sandbox.process.exec('bash -c ' + __import__('shlex').quote(bootstrap), timeout=900)
        assert result.exit_code == 0, 'Ubuntu prerequisite installation failed'
        for name in ('own-daytona-http.py','own-daytona-remote.py'):
            sandbox.fs.upload_file((here/name).read_bytes(), '/tmp/' + name)
        started = sandbox.process.exec('nohup python3 -u /tmp/own-daytona-remote.py > /tmp/own-daytona-events.jsonl 2>/dev/null < /dev/null &',
            env={'EVIDENCE_OWN_SHA':sha}, timeout=10)
        assert started.exit_code == 0
        cursor = 0
        downloaded = False
        deadline = time.monotonic() + 10000
        while time.monotonic() < deadline:
            # This file contains only explicitly reduced events, never CLI output.
            result = sandbox.process.exec('cat /tmp/own-daytona-events.jsonl', timeout=20)
            assert result.exit_code == 0
            lines = result.result.splitlines()
            for line in lines[cursor:]:
                item = json.loads(line)
                print(json.dumps(item), flush=True)
                if item['event'] == 'archive_ready' and not downloaded:
                    for name in ('source.evidence','source-manifest.json','source-journal.json','expected.json'):
                        payload = sandbox.fs.download_file('/tmp/own-daytona-artifacts/' + name)
                        fd = os.open(output/name, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
                        with os.fdopen(fd,'wb') as destination:
                            destination.write(payload)
                    downloaded = True
                    event('archive_downloaded', sha=sha)
                if item['event'] == 'failed':
                    raise RuntimeError('remote native acceptance failed')
                if item['event'] == 'complete':
                    assert downloaded
                    return
            cursor = len(lines)
            time.sleep(20)
        raise RuntimeError('journey deadline exceeded')
    finally:
        # A creation timeout may leave a provider resource before the SDK returns.
        if sandbox is None:
            try:
                sandbox = client.get(name)
            except DaytonaNotFoundError:
                pass
        if sandbox is not None:
            sandbox.delete(timeout=180, wait=True)
            event('sandbox_deleted', sandbox_id=sandbox.id)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        event('failed', error_type=type(error).__name__, status=getattr(error,'status_code',None),
              code=getattr(error,'code',None), source=getattr(error,'source',None))
        raise SystemExit(1)
