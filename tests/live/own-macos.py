#!/usr/bin/env python3
"""Fresh checkout and CLI HOME on the real Mac; no claim of an OS reinstall.

Run through heavy-slot after committing. No browser is launched. Private CLI
links and session cookies remain in memory. EVIDENCE_OWN_SHA optionally selects
the public candidate after demonstrating the exact README start independently.
"""
import datetime
import base64
import gzip
import importlib.util
import json
import os
from pathlib import Path
import platform
import re
import shutil
import subprocess
import tempfile


def event(kind, **data):
    print(json.dumps(dict(event=kind, at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                          **data)), flush=True)


def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def main():
    assert platform.system() == 'Darwin', 'this journey requires the real Mac'
    Server = module('own_remote', 'own-daytona-remote.py').Server
    Owner = module('own_http', 'own-daytona-http.py').Owner
    scratch = Path(tempfile.mkdtemp(prefix='evidence-own-macos-'))
    home, checkout_parent = scratch/'home', scratch/'checkout'
    home.mkdir(mode=0o700)
    checkout_parent.mkdir(mode=0o700)
    server = None

    def start(command, cwd):
        # Server copies this environment into its CLI child synchronously.
        # Restore it immediately; never launch a browser under a scratch HOME.
        values = {'HOME':str(home), 'RER_SERVERS_DIR':str(home/'servers')}
        before = {name:os.environ.get(name) for name in values}
        try:
            os.environ.update(values)
            return Server(command, cwd)
        finally:
            for name, value in before.items():
                if value is None:
                    os.environ.pop(name, None)
                else:
                    os.environ[name] = value

    try:
        event('environment', os='macOS', version=platform.mac_ver(),
              isolation='New empty checkout directory and CLI HOME on existing real macOS')
        server = start(['npx','-y','@runeditrun/rer','dev','just-every/run-evidence'], checkout_parent)
        checkout = checkout_parent/'run-evidence'
        Owner(server.link)
        event('assertion', name='Exact README one-line start and native first-run owner setup')
        sha = os.environ.get('EVIDENCE_OWN_SHA')
        if sha:
            assert re.fullmatch('[a-f0-9]{40}', sha), 'full public candidate SHA required'
            server.stop()
            subprocess.run(['git','fetch','origin',sha], cwd=checkout, check=True,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            subprocess.run(['git','checkout','--detach',sha], cwd=checkout, check=True,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            server = start(['npx','--no-install','rer','dev'], checkout)
        owner = Owner(server.link)
        expected = owner.populate()
        owner.reconcile(expected)
        server.stop()
        state = checkout/'.wrangler/state'
        assert list(state.rglob('*.sqlite')), 'local D1 persistence files absent'
        assert any('r2' in p.parts for p in state.rglob('*') if p.is_file()), 'local R2 persistence files absent'
        server = start(['npx','--no-install','rer','dev'], checkout)
        owner = Owner(server.link)
        owner.reconcile(expected)
        if os.environ.get('EVIDENCE_OWN_EXPORT') == '1':
            # Synthetic acceptance business data only; portable export excludes credentials.
            artifacts = {
                'source.evidence': owner.request('GET','/api/archive/export')[2],
                'source-journal.json': json.dumps(owner.json('GET','/api/archive/journal')).encode(),
                'source-manifest.json': json.dumps(owner.json('GET','/api/archive/manifest')).encode(),
            }
            for name, payload in artifacts.items():
                print('OWN_ARTIFACT ' + name + ' ' + base64.b64encode(gzip.compress(payload)).decode(), flush=True)
        actual = subprocess.check_output(['git','rev-parse','HEAD'], cwd=checkout, text=True).strip()
        event('complete', sha=actual, assertions=['Native setup', 'Retained receipt facts',
              'Original exhibit digest', 'Evaluated test run persists across own-process restart',
              'Local D1 and R2 files present', 'No source connectors enabled'],
              limitation='Fresh install environment on existing macOS, not an OS reinstall; hour capture is separate')
    finally:
        try:
            if server:
                server.stop()
        finally:
            shutil.rmtree(scratch)
            event('cleanup', checkout_and_cli_home_removed=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        event('failed', error_type=type(error).__name__)
        raise SystemExit(1)
