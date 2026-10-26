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
import shlex
import socket
import subprocess
import threading
import time
import urllib.parse


def event(kind, **data):
    print(json.dumps(dict(event=kind, at=datetime.datetime.now(datetime.timezone.utc).isoformat(), **data)), flush=True)


def failure_reason(error):
    text = str(error)
    if re.fullmatch(r'(?:runtime|startup|listener)_[a-z_]+', text):
        return text
    if re.fullmatch(r'native HTTP action failed: (?:GET|POST|PUT|DELETE) status=\d{3}', text):
        return text
    return 'failure_details_withheld'


class Server:
    def __init__(self, command, cwd):
        self.link = None
        self.identity = None
        self.foreground = '--foreground' in command
        self.checkout = Path(cwd if self.foreground else Path(cwd)/'run-evidence').resolve()
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
            if self.foreground and self.process.poll() is None:
                os.killpg(self.process.pid, signal.SIGTERM)
                self.process.wait(timeout=45)
            raise RuntimeError('startup_no_private_entry')
        self.port = urllib.parse.urlsplit(self.link).port
        if self.port is None:
            raise RuntimeError('startup_missing_port')
        # The exact README command hands off to a detached rer dispatcher.
        # The dispatcher, rather than Vite, owns the public proxy listener.
        pids = self.listener_pids()
        if len(pids) != 1:
            raise RuntimeError('runtime_listener_ambiguous')
        self.identity = self.process_identity(next(iter(pids)))
        if self.identity is None:
            raise RuntimeError('runtime_identity_missing')
        _, _, directory, command_line = self.identity
        arguments = shlex.split(command_line)
        checks = dict(checkout=directory == str(self.checkout), foreground='--foreground' in arguments,
                      dev='dev' in arguments, executable=any(argument.endswith('/bin/rer.mjs') for argument in arguments))
        if not all(checks.values()):
            event('runtime_identity_refused', checks=checks)
            self.identity = None
            raise RuntimeError('runtime_identity_refused')
        if self.foreground and os.getpgid(self.identity[0]) != self.process.pid:
            self.identity = None
            raise RuntimeError('runtime_group_refused')
        event('runtime_owned', mode='foreground' if self.foreground else 'README detached dispatcher')

    @staticmethod
    def process_identity(pid):
        try:
            if Path('/proc').is_dir():
                root = Path('/proc')/str(pid)
                stat = (root/'stat').read_text().rsplit(')', 1)[1].split()
                if stat[0] == 'Z':
                    return None
                command = (root/'cmdline').read_bytes().rstrip(b'\0').replace(b'\0', b' ').decode()
                return pid, stat[19], str((root/'cwd').resolve(strict=True)), command
            def ps(field):
                return subprocess.check_output(['ps','-ww','-p',str(pid),'-o',field+'='],
                    text=True, stderr=subprocess.DEVNULL).strip()
            directory = subprocess.check_output(['lsof','-a','-p',str(pid),'-d','cwd','-Fn'],
                text=True, stderr=subprocess.DEVNULL)
            paths = [line[1:] for line in directory.splitlines() if line.startswith('n')]
            if len(paths) != 1:
                return None
            return pid, ps('lstart'), str(Path(paths[0]).resolve()), ps('command')
        except (OSError, subprocess.SubprocessError, UnicodeError, IndexError):
            return None

    def listener_pids(self):
        if not Path('/proc').is_dir():
            result = subprocess.run(['lsof','-nP','-iTCP:'+str(self.port),'-sTCP:LISTEN','-t'],
                text=True, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
            if result.returncode not in (0,1):
                raise RuntimeError('listener_inspection_failed')
            return {int(line) for line in result.stdout.splitlines() if line.isdigit()}
        inodes = set()
        for name in ('tcp','tcp6'):
            for line in (Path('/proc/net')/name).read_text().splitlines()[1:]:
                fields = line.split()
                if fields[3] == '0A' and int(fields[1].split(':')[1],16) == self.port:
                    inodes.add(fields[9])
        owners = set()
        for directory in Path('/proc').iterdir():
            if not directory.name.isdigit():
                continue
            try:
                for fd in (directory/'fd').iterdir():
                    try:
                        target = os.readlink(fd)
                    except FileNotFoundError:
                        continue
                    if target.startswith('socket:[') and target[8:-1] in inodes:
                        owners.add(int(directory.name))
            except FileNotFoundError:
                continue
        return owners

    def alive(self):
        return bool(self.identity and self.process_identity(self.identity[0]) == self.identity
                    and self.listener_pids() == {self.identity[0]})

    def stop(self):
        if self.identity is None:
            raise RuntimeError('runtime_stop_without_identity')
        pid = self.identity[0]
        current = self.process_identity(pid)
        if current is not None and current != self.identity:
            raise RuntimeError('runtime_identity_changed')
        if current is not None:
            try:
                if self.foreground:
                    if os.getpgid(pid) != self.process.pid:
                        raise RuntimeError('runtime_group_changed')
                    os.killpg(self.process.pid, signal.SIGTERM)
                else:
                    os.kill(pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
        deadline = time.monotonic() + 60
        while time.monotonic() < deadline:
            # Refuse replacement listeners; never stop them to free the port.
            listeners = self.listener_pids()
            if listeners - {pid}:
                raise RuntimeError('runtime_port_replaced')
            if not listeners and self.process_identity(pid) is None:
                self.process.wait(timeout=15)
                event('runtime_stopped', port_closed=True)
                return
            current = self.process_identity(pid)
            if current is not None and current != self.identity:
                raise RuntimeError('runtime_identity_changed')
            time.sleep(.25)
        raise RuntimeError('runtime_stop_timeout')


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
            server = Server(['npx','--no-install','rer','dev','--foreground'], checkout)
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
        server = Server(['npx','--no-install','rer','dev','--foreground'], checkout)
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
            if not server.alive():
                raise RuntimeError('runtime_not_surviving_monitored_hour')
            owner.reconcile(expected)
            event('heartbeat', elapsed_seconds=int(time.monotonic() - capture.started))
            time.sleep(30)
        capture.close()
        capture = None
        event('complete', sha=actual)
    finally:
        try:
            if server:
                server.stop()
        finally:
            if capture and capture.process.poll() is None:
                capture.process.send_signal(signal.SIGINT)
                capture.process.wait(timeout=15)


if __name__ == '__main__':
    try:
        run()
    except Exception as error:
        event('failed', error_type=type(error).__name__, reason=failure_reason(error))
        raise SystemExit(1)  # Never traceback with private request context.
