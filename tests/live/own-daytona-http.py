"""Native owner HTTP actions. Credentials exist only in this process's memory."""
import datetime
import hashlib
import http.cookiejar
import json
import urllib.error
import urllib.parse
import urllib.request


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        return None


class Owner:
    def __init__(self, private_link):
        url = urllib.parse.urlsplit(private_link)
        self.origin = urllib.parse.urlunsplit((url.scheme, url.netloc, '', '', ''))
        self.client = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()), NoRedirect())
        fragment = urllib.parse.parse_qs(url.fragment)
        self.request('GET', url.path or '/', expected=(200, 303))
        # This is the exchange performed by the RER_OPEN page's EXCHANGE_SCRIPT.
        self.request('POST', '/__dev/key', {'key': fragment['rer-dev'][0]}, expected=(200, 204))
        target = fragment.get('next', [None])[0]
        if target is None:
            target = '/auth/dev/enter?as=' + urllib.parse.quote(fragment.get('as', ['owner'])[0])
        self.request('GET', target, expected=(200, 303))
        _, _, body = self.request('GET', '/setup', expected=(200, 303))
        if b'Finish setup' in body:
            self.request('POST', '/setup', b'confirm=yes',
                         content_type='application/x-www-form-urlencoded', expected=(303,))
        self.request('GET', '/api/desk')

    def request(self, method, path, body=None, *, expected=(200,), content_type=None, token=None):
        headers = {'Origin': self.origin}
        if isinstance(body, dict):
            body = json.dumps(body).encode()
            content_type = 'application/json'
        if content_type:
            headers['Content-Type'] = content_type
        if token:
            headers['Authorization'] = 'Bearer ' + token
            # Bearer transport must not inherit the owner's native session.
            headers['Cookie'] = ''
        request = urllib.request.Request(self.origin + path, body, headers, method=method)
        try:
            response = self.client.open(request, timeout=120)
        except urllib.error.HTTPError as error:
            response = error
        data = response.read()
        if response.code not in expected:
            # Never include bodies, URLs, cookie headers or tokens in diagnostics.
            raise RuntimeError('native HTTP action failed: ' + method + ' status=' + str(response.code))
        return response.code, response.headers, data

    def json(self, method, path, body=None, **options):
        return json.loads(self.request(method, path, body, **options)[2])

    def populate(self):
        form = urllib.parse.urlencode(dict(name='OWN retained control', group='Access',
            proof='Retained acceptance original', cadence='daily')).encode()
        _, headers, _ = self.request('POST', '/app/controls', form,
            content_type='application/x-www-form-urlencoded', expected=(303,))
        requirement = headers['Location'].split('/')[-1]
        control = next(q['control_id'] for q in self.json('GET', '/api/desk')['requirements']
                       if q['id'] == requirement)
        original = b'OWN-001 clean Ubuntu retained original\n'
        day = datetime.datetime.now(datetime.timezone.utc).date().isoformat()
        boundary = 'evidence-own-acceptance-boundary'
        chunks = []
        for name, value in dict(source='Owner acceptance upload', covered_from=day, covered_to=day).items():
            chunks.append(('--' + boundary + '\r\nContent-Disposition: form-data; name="' + name +
                           '"\r\n\r\n' + value + '\r\n').encode())
        chunks.extend([('--' + boundary + '\r\nContent-Disposition: form-data; name="file"; '
                        'filename="own-proof.txt"\r\nContent-Type: text/plain\r\n\r\n').encode(),
                       original, ('\r\n--' + boundary + '--\r\n').encode()])
        _, headers, _ = self.request('POST', '/app/requirements/' + requirement + '/uploads',
            b''.join(chunks), content_type='multipart/form-data; boundary=' + boundary, expected=(303,))
        receipt_path = headers['Location'].replace('/app/', '/api/')
        receipt = self.json('GET', receipt_path)
        grant = self.json('POST', '/api/api-tokens', dict(name='OWN local inventory',
            scopes=['resource-push'], expires_at=(datetime.datetime.now(datetime.timezone.utc) +
            datetime.timedelta(days=2)).isoformat().replace('+00:00', 'Z')), expected=(201,))
        token = grant['token']
        self.json('PUT', '/v1/resource-types/own_acceptance',
            {'schema': {'fields': {'secure': 'boolean'}, 'required': ['secure']}}, token=token)
        self.json('PUT', '/v1/resources/own_acceptance', {'resources': [{'uniqueId':
            'synthetic-evidence-own', 'displayName': 'OWN local resource', 'attributes': {'secure': True}}]}, token=token)
        test = self.json('POST', '/api/tests', dict(name='OWN retained evaluation',
            resourceType='own_acceptance', criteria=json.dumps([{'attribute':'secure','op':'equals','value':True}]),
            cadence='daily', category='identity', severity='high', controls=[control]), expected=(201,))
        self.json('POST', '/api/tests/' + test['id'] + '/run', {})
        result = self.json('GET', '/api/tests/' + test['id'])
        assert result['latest'] and all(r['result'] == 'pass' for r in result['latest'])
        return dict(requirement=requirement, control=control, receipt_path=receipt_path,
                    receipt=receipt, test=test['id'], runs=result['runs'], latest=result['latest'],
                    original_sha256=hashlib.sha256(original).hexdigest())

    def reconcile(self, expected):
        assert any(q['id'] == expected['requirement'] for q in self.json('GET', '/api/desk')['requirements'])
        assert self.json('GET', expected['receipt_path']) == expected['receipt']
        raw = self.request('GET', expected['receipt_path'] + '/download')[2]
        assert hashlib.sha256(raw).hexdigest() == expected['original_sha256']
        result = self.json('GET', '/api/tests/' + expected['test'])
        assert result['runs'] == expected['runs']
        # Time-derived display fields may advance; evaluated facts may not.
        facts = lambda rows: [{k:v for k,v in row.items() if k not in ('sla','due','tickets')} for row in rows]
        assert facts(result['latest']) == facts(expected['latest'])
        assert not self.json('GET', '/api/connections')['connections']
