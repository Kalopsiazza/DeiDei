"""Independent aiohttp collector. All DB operations share one transaction queue."""
import asyncio
import csv
import datetime as dt
import hashlib
import hmac
import io
import json
import sqlite3
import time
from pathlib import Path
from aiohttp import web
from . import schema

DB = web.AppKey('db', object)
ADMIN = web.AppKey('admin', str)
NOW = web.AppKey('now', object)
CONCURRENCY = web.AppKey('concurrency', object)


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False)


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


class Reject(Exception):
    def __init__(self, status, code):
        self.status, self.code = status, code


class Writer:
    def __init__(self, filename, now=time.time):
        Path(filename).parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.connection = sqlite3.connect(filename, timeout=1.5, check_same_thread=False)
        Path(filename).chmod(0o600)
        self.connection.execute('PRAGMA busy_timeout=1500')
        self.connection.execute('PRAGMA journal_mode=WAL')
        self.connection.executescript('''
            CREATE TABLE IF NOT EXISTS installations(id TEXT PRIMARY KEY, capability TEXT UNIQUE, policy TEXT, scopes TEXT, revision INTEGER, epoch TEXT, created INTEGER);
            CREATE TABLE IF NOT EXISTS reports(installation TEXT, epoch TEXT, scope TEXT, day TEXT, version TEXT, revision INTEGER, content TEXT, received INTEGER, PRIMARY KEY(installation,epoch,scope,day,version));
            CREATE TABLE IF NOT EXISTS revoked(id TEXT PRIMARY KEY, capability TEXT, expires INTEGER);
        ''')
        self.connection.commit()
        self.queue = asyncio.Queue(maxsize=64)
        self.now = now
        self.task = asyncio.create_task(self.run())

    def transaction(self, callback):
        conn = self.connection
        try:
            conn.execute('BEGIN IMMEDIATE')
            today = dt.datetime.fromtimestamp(self.now(), dt.timezone.utc).date()
            conn.execute('DELETE FROM reports WHERE day < ?', ((today - dt.timedelta(days=89)).isoformat(),))
            conn.execute('DELETE FROM revoked WHERE expires < ?', (int(self.now()),))
            result = callback(conn)
            conn.commit()
            return result
        except BaseException:
            conn.rollback()
            raise

    async def run(self):
        while True:
            item = await self.queue.get()
            if item is None:
                return
            callback, future = item
            try:
                result = await asyncio.to_thread(self.transaction, callback)
                if not future.done():
                    future.set_result(result)
            except Exception as exc:
                if not future.done():
                    future.set_exception(exc)

    async def call(self, callback):
        future = asyncio.get_running_loop().create_future()
        try:
            self.queue.put_nowait((callback, future))
        except asyncio.QueueFull as exc:
            raise Reject(429, 'BUSY') from exc
        return await future

    async def close(self):
        await self.queue.put(None)
        await self.task
        self.connection.close()


@web.middleware
async def bounded(request, handler):
    semaphore = request.app[CONCURRENCY]
    if semaphore.locked():
        raise Reject(429, 'CONCURRENCY_LIMIT')
    async with semaphore:
        return await handler(request)


@web.middleware
async def errors(request, handler):
    try:
        return await handler(request)
    except Reject as exc:
        return web.json_response({'error': exc.code}, status=exc.status, headers={'Retry-After': '60'} if exc.status == 429 else None)
    except (schema.Invalid, ValueError, KeyError, TypeError, json.JSONDecodeError):
        return web.json_response({'error': 'INVALID_REQUEST'}, status=400)
    except web.HTTPException as exc:
        return web.json_response({'error': 'BODY_LIMIT' if exc.status == 413 else 'HTTP_ERROR'}, status=exc.status)
    except sqlite3.Error:
        return web.json_response({'error': 'DATABASE_UNAVAILABLE'}, status=503)
    except Exception:
        # Never log exception objects: they may contain request fields or addresses.
        return web.json_response({'error': 'SERVICE_UNAVAILABLE'}, status=503)


async def body(request):
    if request.content_type != 'application/json':
        raise Reject(415, 'JSON_REQUIRED')
    raw = await request.read()
    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise schema.Invalid('DUPLICATE_KEY')
            result[key] = value
        return result
    return json.loads(raw, object_pairs_hook=unique, parse_constant=lambda _: (_ for _ in ()).throw(schema.Invalid('NUMBER')))


def capability(request):
    value = request.headers.get('Authorization', '')
    if not value.startswith('Bearer '):
        raise Reject(401, 'AUTH_REQUIRED')
    return digest(schema.identifier(value[7:]))


def authenticate(conn, installation, secret):
    row = conn.execute('SELECT capability,policy,scopes,revision,epoch FROM installations WHERE id=?', (installation,)).fetchone()
    if row is None or not hmac.compare_digest(row[0], secret):
        raise Reject(403, 'CAPABILITY_REVOKED_OR_INVALID')
    return row


def consent_fields(data):
    schema.identifier(data['installation_id'])
    schema.identifier(data['epoch'])
    schema.integer(data['revision'], 1, 2**31 - 1)
    schema.scopes(data['scopes'])
    if data['policy_id'] != 'deidei-stats-v1':
        raise schema.Invalid('POLICY')


async def enroll(request):
    data = await body(request)
    schema.exact(data, ('installation_id', 'capability', 'policy_id', 'scopes', 'revision', 'epoch'))
    consent_fields(data)
    secret = digest(schema.identifier(data['capability']))
    def update(conn):
        if conn.execute('SELECT 1 FROM revoked WHERE id=? OR capability=?', (data['installation_id'], secret)).fetchone():
            raise Reject(403, 'CAPABILITY_REVOKED')
        row = conn.execute('SELECT capability,policy,scopes,revision,epoch FROM installations WHERE id=?', (data['installation_id'],)).fetchone()
        expected = (secret, data['policy_id'], canonical(data['scopes']), data['revision'], data['epoch'])
        if row:
            if row != expected:
                raise Reject(409, 'ENROLLMENT_CONFLICT')
        else:
            if conn.execute('SELECT count(*) FROM installations').fetchone()[0] >= 100_000:
                raise Reject(429, 'INSTALLATION_QUOTA')
            conn.execute('INSERT INTO installations VALUES(?,?,?,?,?,?,?)', (*[data['installation_id']], *expected, int(request.app[NOW]())))
        return {'revision': data['revision'], 'epoch': data['epoch']}
    return web.json_response(await request.app[DB].call(update))


async def consent(request):
    secret = capability(request)
    data = await body(request)
    schema.exact(data, ('installation_id', 'policy_id', 'scopes', 'revision', 'epoch'))
    consent_fields(data)
    def update(conn):
        row = authenticate(conn, data['installation_id'], secret)
        incoming = (data['policy_id'], canonical(data['scopes']), data['revision'], data['epoch'])
        if data['revision'] < row[3] or (data['revision'] == row[3] and incoming != row[1:]):
            raise Reject(409, 'STALE_CONSENT')
        conn.execute('UPDATE installations SET policy=?,scopes=?,revision=?,epoch=? WHERE id=?', (*incoming, data['installation_id']))
        return {'revision': data['revision'], 'epoch': data['epoch']}
    return web.json_response(await request.app[DB].call(update))


async def reports(request):
    secret = capability(request)
    data = await body(request)
    schema.exact(data, ('installation_id', 'reports'))
    schema.identifier(data['installation_id'])
    if not isinstance(data['reports'], list) or not 1 <= len(data['reports']) <= 32:
        raise schema.Invalid('BATCH')
    now = dt.datetime.fromtimestamp(request.app[NOW](), dt.timezone.utc).date()
    for report in data['reports']:
        schema.report(report, now)
    def update(conn):
        row = authenticate(conn, data['installation_id'], secret)
        ack = []
        for report in data['reports']:
            if not json.loads(row[2])[report['scope']] or report['epoch'] != row[4] or report['consent_revision'] != row[3]:
                raise Reject(409, 'CONSENT_MISMATCH')
            key = (data['installation_id'], report['epoch'], report['scope'], report['day'], report['app_version'])
            content = canonical(report)
            old = conn.execute('SELECT revision,content FROM reports WHERE installation=? AND epoch=? AND scope=? AND day=? AND version=?', key).fetchone()
            if old and (report['report_revision'] < old[0] or (report['report_revision'] == old[0] and content != old[1])):
                raise Reject(409, 'REPORT_REVISION_CONFLICT')
            if old and report['scope'] == 'preferences' and report['report_revision'] > old[0]:
                previous = json.loads(old[1])['data']
                incoming = report['data']
                index = lambda entry: canonical({k: v for k, v in entry.items() if k != 'count'})
                previous_sessions = {index(item): item['count'] for item in previous['sessions']}
                incoming_sessions = {index(item): item['count'] for item in incoming['sessions']}
                if incoming['settings_changes'] < previous['settings_changes'] or any(incoming['recommendations'][key] < previous['recommendations'][key] for key in ('shown', 'adopted')) or any(incoming_sessions.get(key, 0) < value for key, value in previous_sessions.items()):
                    raise Reject(409, 'CUMULATIVE_ROLLBACK')
            if not old and conn.execute('SELECT count(*) FROM reports WHERE installation=?', (data['installation_id'],)).fetchone()[0] >= 256:
                raise Reject(429, 'REPORT_QUOTA')
            conn.execute('INSERT OR REPLACE INTO reports VALUES(?,?,?,?,?,?,?,?)', (*key, report['report_revision'], content, int(request.app[NOW]())))
            ack.append({'epoch': report['epoch'], 'scope': report['scope'], 'day': report['day'], 'app_version': report['app_version'], 'report_revision': report['report_revision']})
        return {'ack': ack}
    return web.json_response(await request.app[DB].call(update))


async def erasure(request):
    secret = capability(request)
    data = await body(request)
    schema.exact(data, ('installation_id',))
    schema.identifier(data['installation_id'])
    def update(conn):
        revoked = conn.execute('SELECT capability FROM revoked WHERE id=?', (data['installation_id'],)).fetchone()
        if revoked:
            if not hmac.compare_digest(revoked[0], secret):
                raise Reject(403, 'INVALID_CAPABILITY')
            return {'deleted': True}
        authenticate(conn, data['installation_id'], secret)
        conn.execute('DELETE FROM reports WHERE installation=?', (data['installation_id'],))
        conn.execute('DELETE FROM installations WHERE id=?', (data['installation_id'],))
        conn.execute('INSERT INTO revoked VALUES(?,?,?)', (data['installation_id'], secret, int(request.app[NOW]()) + 180 * 86400))
        return {'deleted': True}
    return web.json_response(await request.app[DB].call(update))


def admin_auth(request):
    token = request.headers.get('Authorization', '')
    if not hmac.compare_digest(token, 'Bearer ' + request.app[ADMIN]):
        raise Reject(401, 'ADMIN_AUTH_REQUIRED')


async def aggregate(request):
    admin_auth(request)
    if set(request.query) - {'from', 'to', 'group'}:
        raise schema.Invalid('QUERY')
    today = dt.datetime.fromtimestamp(request.app[NOW](), dt.timezone.utc).date()
    start = schema.date(request.query.get('from', (today - dt.timedelta(days=6)).isoformat()), today)
    end = schema.date(request.query.get('to', today.isoformat()), today)
    if start > end:
        raise schema.Invalid('RANGE')
    group = schema.enum(request.query.get('group', 'app_version'), ('app_version', 'day'))
    def query(conn):
        rows = conn.execute('SELECT installation,epoch,scope,day,version,content FROM reports WHERE day BETWEEN ? AND ? ORDER BY received,revision', (start.isoformat(), end.isoformat()))
        buckets, latest, reported_installations = {}, {}, set()
        for installation, epoch, scope, day, version, content in rows:
            reported_installations.add(installation)
            key = version if group == 'app_version' else day
            if key not in buckets and len(buckets) >= 128:
                raise Reject(429, 'GROUP_QUOTA')
            bucket = buckets.setdefault(key, {'group': key, 'session_uses': 0, 'settings_changes': 0, 'recommendation_shown': 0, 'recommendation_adopted': 0, 'performance_reports': 0})
            report = json.loads(content)['data']
            if scope == 'preferences':
                bucket['session_uses'] += sum(item['count'] for item in report['sessions'])
                bucket['settings_changes'] += report['settings_changes']
                bucket['recommendation_shown'] += report['recommendations']['shown']
                bucket['recommendation_adopted'] += report['recommendations']['adopted']
                latest[installation] = report
            else:
                bucket['performance_reports'] += 1
        latest = {}
        current_rows = conn.execute('SELECT installation,epoch,scope,day,version,content FROM reports WHERE day BETWEEN ? AND ? ORDER BY received,revision', (start.isoformat(), end.isoformat()))
        for installation, _, scope, day, _, content in current_rows:
            if scope != 'preferences':
                continue
            parsed = json.loads(content)
            order = (parsed['consent_revision'], day, parsed['report_revision'])
            if installation not in latest or order > latest[installation][0]:
                latest[installation] = (order, parsed['data'])
        choices = {}
        for _, value in latest.values():
            key = '/'.join((value['card_style'], value['preset'], value['graphics']['ambientMotion'], value['graphics']['glass'], value['graphics']['decoration']))
            choices[key] = choices.get(key, 0) + 1
        sessions = {}
        session_rows = conn.execute('SELECT installation,epoch,scope,day,version,content FROM reports WHERE day BETWEEN ? AND ?', (start.isoformat(), end.isoformat()))
        for _, _, scope, _, _, content in session_rows:
            if scope == 'preferences':
                for item in json.loads(content)['data']['sessions']:
                    key = item['session_kind'] + '/' + item['gameplay'] + '/' + item['card_style'] + '/' + ''.join('1' if v else '0' for v in item['skills'])
                    sessions[key] = sessions.get(key, 0) + item['count']
        return {'population': '自愿参与的安装实例', 'from': start.isoformat(), 'to': end.isoformat(), 'installations': len(reported_installations), 'preferences_installations': len(latest), 'current_choices': choices, 'session_uses': sessions, 'groups': list(buckets.values())}
    result = await request.app[DB].call(query)
    if request.path.endswith('.csv'):
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(('population', 'group', 'session_uses', 'settings_changes', 'recommendation_shown', 'recommendation_adopted', 'performance_reports'))
        for item in result['groups']:
            writer.writerow((result['population'], *item.values()))
        writer.writerow(('current_choice', 'selection', 'installation_count'))
        for key, count in result['current_choices'].items():
            writer.writerow(('current_choice', key, count))
        writer.writerow(('session_use', 'dimensions', 'count'))
        for key, count in result['session_uses'].items():
            writer.writerow(('session_use', key, count))
        writer.writerow(('population_totals', 'installations', 'preferences_installations'))
        writer.writerow((result['population'], result['installations'], result['preferences_installations']))
        return web.Response(text=output.getvalue(), content_type='text/csv', headers={'Cache-Control': 'no-store'})
    return web.json_response(result, headers={'Cache-Control': 'no-store'})


async def make_app(filename, admin_token, now=time.time):
    if not isinstance(admin_token, str) or len(admin_token) < 32:
        raise ValueError('ADMIN_TOKEN_REQUIRED')
    app = web.Application(middlewares=[errors, bounded], client_max_size=32 * 1024)
    app[DB], app[ADMIN], app[NOW] = Writer(filename, now), admin_token, now
    app[CONCURRENCY] = asyncio.Semaphore(64)
    async def health(_):
        return web.json_response({'ready': True})
    app.router.add_get('/healthz', health)
    app.router.add_post('/stats/v1/enrollments', enroll)
    app.router.add_put('/stats/v1/consent', consent)
    app.router.add_post('/stats/v1/reports', reports)
    app.router.add_post('/stats/v1/erasure', erasure)
    app.router.add_get('/admin/v1/summary', aggregate)
    app.router.add_get('/admin/v1/export.csv', aggregate)
    async def cleanup(_):
        await app[DB].close()
    app.on_cleanup.append(cleanup)
    return app
