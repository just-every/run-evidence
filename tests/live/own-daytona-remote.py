"""Runs inside the disposable Ubuntu sandbox; never writes private CLI output."""
import collections
import datetime
import hashlib
import importlib.util
import ipaddress
import json
import os
from pathlib import Path
import re
import signal
import socket
import subprocess
import threading
import time


def event(kind, **data):
    print(json.dumps(dict(event=kind, at=datetime.datetime.now(datetime.timezone.utc).isoformat(), **data)), flush=True)


class Server:
    def __init__(self, command, cwd):
        self.link = None
        self.ready = threading.Event()
        self.process = subprocess.Popen(command, cwd=cwd, stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT, text=True, start_new_session=True,
            env={**os.environ, 'WRANGLER_SEND_METRICS':'false'})
        def consume():
            for line in self.process.stdout:
                match = re.match(r'RER_OPEN (\S+)', line)
                if match:
                    self.link = match[1]
                    self.ready.set()
            self.ready.set()
        threading.Thread(target=consume, daemon=True).start()
        if not self.ready.wait(1800) or not self.link:
            self.stop()
            raise RuntimeError('README startup did not yield private owner entry')

    def stop(self):
        # Only this newly created process group, never a name-based stop.
        if self.process.poll() is None:
            os.killpg(self.process.pid, signal.SIGTERM)
            try:
                self.process.wait(timeout=45)
            except subprocess.TimeoutExpired:
                os.killpg(self.process.pid, signal.SIGKILL)
                self.process.wait(timeout=15)


class Capture:
    def __init__(self):
        self.destinations = collections.Counter()
        self.domains = collections.Counter()
        self.parse_error = False
        self.author_addresses = set()
        self.author_hosts = ('runeditrun.com', 'run-evidence.com', 'www.runeditrun.com',
                             'app.runeditrun.com', 'api.runeditrun.com')
        for host in self.author_hosts:
            try:
                self.author_addresses.update(r[4][0] for r in socket.getaddrinfo(host, None))
            except socket.gaierror:
                pass
        self.process = subprocess.Popen(['tcpdump','-n','-l','-Q','out','-i','any',
            'not net 127.0.0.0/8 and not host ::1'], stdout=subprocess.PIPE,
            stderr=subprocess.PIPE, text=True)
        self.started = time.monotonic()
        self.start_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
        def consume():
            for line in self.process.stdout:
                match = re.search(r'\bIP6?\s+\S+\s+>\s+(\S+):', line)
                if match:
                    endpoint = match[1]
                    host = endpoint.rsplit('.', 1)[0] if re.search(r'\.\d+$', endpoint) else endpoint
                    try:
                        if not ipaddress.ip_address(host).is_loopback:
                            self.destinations[host] += 1
                    except ValueError:
                        self.parse_error = True
                query = re.search(r'\b(?:A|AAAA|HTTPS)\?\s+(\S+)', line)
                if query:
                    self.domains[query[1].rstrip('.').lower()] += 1
        self.reader = threading.Thread(target=consume, daemon=True)
        self.reader.start()
        time.sleep(1)
        if self.process.poll() is not None:
            raise RuntimeError('tcpdump cannot capture outbound sandbox packets')

    def close(self):
        duration = time.monotonic() - self.started
        self.process.send_signal(signal.SIGINT)
        self.process.wait(timeout=15)
        self.reader.join(timeout=10)
        diagnostics = self.process.stderr.read()
        dropped = re.search(r'(\d+) packets dropped by kernel', diagnostics)
        assert self.process.returncode == 0 and dropped and int(dropped[1]) == 0, 'incomplete packet capture'
        assert not self.parse_error, 'unclassified packet destination'
        matches = [name for name in self.domains if any(name == h or name.endswith('.' + h)
                   for h in ('runeditrun.com','run-evidence.com'))]
        matched_ips = sorted(set(self.destinations) & self.author_addresses)
        event('capture', started_at=self.start_at, seconds=duration, destinations=dict(self.destinations),
              dns_queries=dict(self.domains), author_dns_matches=matches, author_ip_matches=matched_ips,
              classification='Known author DNS suffixes and addresses resolved before capture; all outbound destinations retained')
        assert duration >= 3600, 'less than the required hour'
        assert not matches and not matched_ips, 'outbound traffic to known author host'


def run():
    spec = importlib.util.spec_from_file_location('own_http', '/tmp/own-daytona-http.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    root = Path('/root/own-acceptance')
    root.mkdir()
    server = capture = None
    try:
        server = Server(['npx','-y','@runeditrun/rer','dev','just-every/run-evidence'], root)
        checkout = root / 'run-evidence'
        owner = module.Owner(server.link)
        event('assertion', name='README exact one-line start and first-run native owner setup')
        sha = os.environ.get('EVIDENCE_OWN_SHA')
        if sha:
            assert re.fullmatch('[a-f0-9]{40}', sha), 'expected full candidate SHA'
            server.stop()
            subprocess.run(['git','fetch','origin',sha], cwd=checkout, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            subprocess.run(['git','checkout','--detach',sha], cwd=checkout, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            server = Server(['npx','--no-install','rer','dev'], checkout)
            owner = module.Owner(server.link)
        actual = subprocess.check_output(['git','rev-parse','HEAD'], cwd=checkout, text=True).strip()
        event('candidate', sha=actual, os='Ubuntu 24.04', installation_traffic='Completed before monitored hour')
        assert not owner.json('GET','/api/connections')['connections']
        capture = Capture()
        event('hour_started', sha=actual)
        expected = owner.populate()
        owner.reconcile(expected)
        server.stop()
        # Only prove physical local-state presence, never inspect credential files.
        state = checkout / '.wrangler/state'
        assert list(state.rglob('*.sqlite')), 'D1 persistence files absent'
        assert any('r2' in p.parts for p in state.rglob('*') if p.is_file()), 'R2 persistence files absent'
        server = Server(['npx','--no-install','rer','dev'], checkout)
        owner = module.Owner(server.link)
        owner.reconcile(expected)
        event('assertion', name='Receipt facts, original bytes and evaluated test survive own-process restart in local D1 and R2')
        artifacts = Path('/tmp/own-daytona-artifacts')
        artifacts.mkdir(mode=0o700)
        # Synthetic business artifacts only. No cookie or private entry material.
        (artifacts/'source-manifest.json').write_text(json.dumps(owner.json('GET','/api/archive/manifest')))
        (artifacts/'source-journal.json').write_text(json.dumps(owner.json('GET','/api/archive/journal')))
        archive = owner.request('GET','/api/archive/export')[2]
        (artifacts/'source.evidence').write_bytes(archive)
        (artifacts/'expected.json').write_text(json.dumps(expected))
        event('archive_ready', sha=actual, bytes=len(archive), sha256=hashlib.sha256(archive).hexdigest())
        while time.monotonic() - capture.started < 3605:
            assert server.process.poll() is None, 'app stopped during monitored hour'
            owner.reconcile(expected)
            event('heartbeat', elapsed_seconds=int(time.monotonic() - capture.started))
            time.sleep(30)
        capture.close()
        capture = None
        event('complete', sha=actual)
    finally:
        if server:
            server.stop()
        if capture and capture.process.poll() is None:
            capture.process.send_signal(signal.SIGINT)
            capture.process.wait(timeout=15)


if __name__ == '__main__':
    try:
        run()
    except Exception as error:
        event('failed', error_type=type(error).__name__)
        raise SystemExit(1)  # Never traceback with private request context.
