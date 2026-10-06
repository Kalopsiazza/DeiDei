import asyncio
import copy
import datetime as dt
import json
import os
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from aiohttp import ClientSession, web
from deidei_stats.server import make_app, DB


class StatsTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.database = Path(self.temp.name) / 'stats.sqlite3'
        self.token = 'a' * 64
        self.app = await make_app(self.database, self.token)
        self.runner = web.AppRunner(self.app, access_log=None)
        await self.runner.setup()
        self.site = web.TCPSite(self.runner, '127.0.0.1', 0)
        await self.site.start()
        self.origin = 'http://127.0.0.1:' + str(self.site._server.sockets[0].getsockname()[1])
        self.session = ClientSession()
        self.enrollment = {'installation_id': '1' * 32, 'capability': '2' * 64, 'policy_id': 'deidei-stats-v1', 'scopes': {'preferences': True, 'performance': False}, 'revision': 1, 'epoch': '3' * 32}
        self.report = {'scope': 'preferences', 'epoch': '3' * 32, 'consent_revision': 1, 'day': dt.datetime.now(dt.timezone.utc).date().isoformat(), 'app_version': '0.2.0', 'report_revision': 1,
                       'data': {'card_style': 'illustrated', 'graphics': {'ambientMotion': 'full', 'glass': 'full', 'decoration': 'full'}, 'preset': 'high', 'sessions': [{'session_kind': 'solo', 'gameplay': 'classic', 'card_style': 'illustrated', 'skills': [True] * 8, 'count': 1}], 'settings_changes': 1, 'recommendations': {'shown': 2, 'adopted': 1}}}

    async def asyncTearDown(self):
        await self.session.close()
        await self.runner.cleanup()
        self.temp.cleanup()

    async def request(self, method, route, data=None, admin=False, auth=True):
        token = self.token if admin else self.enrollment['capability']
        async with self.session.request(method, self.origin + route, json=data, headers={'Authorization': 'Bearer ' + token} if auth else {}) as response:
            raw = await response.text()
            return response.status, raw if route.endswith('.csv') else json.loads(raw)

    async def enroll(self):
        self.assertEqual((await self.request('POST', '/stats/v1/enrollments', self.enrollment))[0], 200)

    async def upload(self, report=None):
        return await self.request('POST', '/stats/v1/reports', {'installation_id': self.enrollment['installation_id'], 'reports': [report or self.report]})

    async def test_http_db_admin_idempotence_revisions_erasure_restart(self):
        self.assertEqual((await self.request('GET', '/healthz', auth=False))[0], 200)
        await self.enroll(); await self.enroll()
        self.assertEqual((await self.upload())[0], 200)
        self.assertEqual((await self.upload())[0], 200)
        newer = copy.deepcopy(self.report); newer['report_revision'] = 2; newer['data']['sessions'][0]['count'] = 3
        self.assertEqual((await self.upload(newer))[0], 200)
        self.assertEqual((await self.upload())[0], 409)
        bad = copy.deepcopy(newer); bad['data']['settings_changes'] += 1
        self.assertEqual((await self.upload(bad))[0], 409)
        self.assertEqual((await self.request('GET', '/admin/v1/summary', auth=False))[0], 401)
        self.assertEqual((await self.request('GET', '/admin/v1/summary'))[0], 401)
        status, summary = await self.request('GET', '/admin/v1/summary', admin=True)
        self.assertEqual(status, 200); self.assertEqual(summary['installations'], 1)
        self.assertEqual(summary['groups'][0]['session_uses'], 3)
        status, csv = await self.request('GET', '/admin/v1/export.csv', admin=True)
        self.assertEqual(status, 200); self.assertIn('recommendation_adopted', csv); self.assertIn('illustrated/high/full/full/full,1', csv)
        self.assertNotIn(self.enrollment['installation_id'], csv); self.assertNotIn(self.enrollment['capability'], csv)
        conn = sqlite3.connect(self.database)
        self.assertEqual(conn.execute('SELECT count(*) FROM reports').fetchone()[0], 1)
        self.assertNotEqual(conn.execute('SELECT capability FROM installations').fetchone()[0], self.enrollment['capability'])
        conn.close()
        await self.runner.cleanup()
        self.app = await make_app(self.database, self.token)
        self.runner = web.AppRunner(self.app, access_log=None); await self.runner.setup()
        self.site = web.TCPSite(self.runner, '127.0.0.1', 0); await self.site.start()
        self.origin = 'http://127.0.0.1:' + str(self.site._server.sockets[0].getsockname()[1])
        self.assertEqual((await self.upload(newer))[0], 200)
        deletion = {'installation_id': self.enrollment['installation_id']}
        self.assertEqual((await self.request('POST', '/stats/v1/erasure', deletion))[1], {'deleted': True})
        self.assertEqual((await self.request('POST', '/stats/v1/erasure', deletion))[1], {'deleted': True})
        self.assertEqual((await self.upload(newer))[0], 403)
        self.assertEqual((await self.request('POST', '/stats/v1/enrollments', self.enrollment))[0], 403)
        self.assertEqual((await self.request('GET', '/admin/v1/summary', admin=True))[1]['installations'], 0)

    async def test_strict_scope_dimensions_dates_limits_auth_and_consent(self):
        await self.enroll()
        for mutate in (lambda r: r['data'].update(nickname='private'), lambda r: r.update(room_id='private'), lambda r: r['data'].update(preset='smooth'), lambda r: r['data']['recommendations'].update(adopted=3), lambda r: r['data']['sessions'][0].update(gameplay='secret-pack'), lambda r: r.update(day='2000-01-01')):
            report = copy.deepcopy(self.report); mutate(report)
            self.assertEqual((await self.upload(report))[0], 400)
        wrong_epoch = copy.deepcopy(self.report); wrong_epoch['epoch'] = '4' * 32
        self.assertEqual((await self.upload(wrong_epoch))[0], 409)
        next_consent = {k: v for k, v in self.enrollment.items() if k != 'capability'}
        next_consent.update(revision=2, epoch='4' * 32, scopes={'preferences': False, 'performance': False})
        self.assertEqual((await self.request('PUT', '/stats/v1/consent', next_consent))[0], 200)
        self.assertEqual((await self.upload())[0], 409)
        stale = {k: v for k, v in self.enrollment.items() if k != 'capability'}
        self.assertEqual((await self.request('PUT', '/stats/v1/consent', stale))[0], 409)
        self.assertEqual((await self.request('GET', '/admin/v1/summary?from=2000-01-01', admin=True))[0], 400)
        async with self.session.post(self.origin + '/stats/v1/enrollments', data='x' * 40000, headers={'Content-Type': 'application/json'}) as response:
            self.assertEqual(response.status, 413)
        async with self.session.post(self.origin + '/stats/v1/enrollments', data='{"installation_id":"1","installation_id":"2"}', headers={'Content-Type': 'application/json'}) as response:
            self.assertEqual(response.status, 400)

    async def test_db_busy_and_transaction_serialization(self):
        await self.enroll()
        blocker = sqlite3.connect(self.database); blocker.execute('BEGIN IMMEDIATE')
        try:
            self.assertEqual((await self.upload())[0], 503)
        finally:
            blocker.rollback(); blocker.close()
        status = await asyncio.gather(*(self.upload() for _ in range(12)))
        self.assertTrue(all(s[0] == 200 for s in status))
        self.assertEqual((await self.request('GET', '/admin/v1/summary', admin=True))[1]['groups'][0]['session_uses'], 1)
        futures = [asyncio.get_running_loop().create_future() for _ in range(65)]
        for future in futures[:64]: self.app[DB].queue.put_nowait((lambda conn: True, future))
        status, _ = await self.upload()
        self.assertIn(status, (200, 429))
        await asyncio.gather(*futures[:64])

    async def test_http_report_quota_real_429(self):
        await self.enroll()
        def fill(conn):
            for number in range(256):
                report = copy.deepcopy(self.report)
                report['app_version'] = '0.2.' + str(number + 1)
                conn.execute('INSERT INTO reports VALUES(?,?,?,?,?,?,?,?)', (self.enrollment['installation_id'], report['epoch'], report['scope'], report['day'], report['app_version'], 1, json.dumps(report), 0))
        await self.app[DB].call(fill)
        async with self.session.post(self.origin + '/stats/v1/reports', json={'installation_id': self.enrollment['installation_id'], 'reports': [self.report]}, headers={'Authorization': 'Bearer ' + self.enrollment['capability']}) as response:
            self.assertEqual(response.status, 429)
            self.assertEqual(response.headers['Retry-After'], '60')
            self.assertEqual((await response.json())['error'], 'REPORT_QUOTA')

    async def test_performance_only_population_distinct_scopes_and_cli_csv(self):
        self.enrollment['scopes'] = {'preferences': False, 'performance': True}
        await self.enroll()
        graphics = {'ambientMotion': 'reduced', 'glass': 'light', 'decoration': 'simple'}
        performance = copy.deepcopy(self.report)
        performance.update(scope='performance', data={'os': 'macos', 'memory': 'le16', 'parallelism': 'le8', 'compositing': 'hardware', 'pixel_load': 'le8m', 'saved_graphics': graphics, 'effective_graphics': graphics, 'preset': 'balanced', 'reduced_motion': False, 'reduced_transparency': False, 'p95': 'le20', 'long_interval_ratio': 'le1pct', 'algorithm_version': 'graphics-v1', 'samples': 300})
        self.assertEqual((await self.upload(performance))[0], 200)
        status, summary = await self.request('GET', '/admin/v1/summary', admin=True)
        self.assertEqual(status, 200)
        self.assertEqual(summary['installations'], 1)
        self.assertEqual(summary['preferences_installations'], 0)
        self.assertEqual(summary['current_choices'], {})
        self.assertEqual(summary['groups'][0]['performance_reports'], 1)
        status, exported = await self.request('GET', '/admin/v1/export.csv', admin=True)
        self.assertEqual(status, 200)
        self.assertIn('population_totals,installations,preferences_installations', exported)
        self.assertIn(summary['population'] + ',1,0', exported)
        self.assertNotIn(self.enrollment['installation_id'], exported)
        self.assertNotIn(self.enrollment['capability'], exported)
        token_file = Path(self.temp.name) / 'admin.token'; token_file.write_text(self.token); os.chmod(token_file, 0o600)
        env = {**os.environ, 'PYTHONPATH': str(Path(__file__).parents[1])}
        base = [sys.executable, '-m', 'deidei_stats.admin', '--origin', self.origin, '--token-file', str(token_file), '--fixture']
        proc = await asyncio.create_subprocess_exec(*base, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, env=env)
        stdout, stderr = await proc.communicate()
        self.assertEqual(proc.returncode, 0, stderr.decode())
        self.assertIn(summary['population'] + ': 1', stdout.decode())
        self.assertIn('偏好选择分母（已上传偏好快照的安装实例）: 0', stdout.decode())
        csv_file = Path(self.temp.name) / 'performance.csv'
        proc = await asyncio.create_subprocess_exec(*base, '--csv', '--output', str(csv_file), stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, env=env)
        stdout, stderr = await proc.communicate()
        self.assertEqual(proc.returncode, 0, stderr.decode())
        self.assertEqual(csv_file.read_bytes(), exported.encode())
        # Adding the other scope's contribution must not count this installation twice.
        consent = {k: v for k, v in self.enrollment.items() if k != 'capability'}
        consent.update(scopes={'preferences': True, 'performance': True}, revision=2, epoch='4' * 32)
        self.assertEqual((await self.request('PUT', '/stats/v1/consent', consent))[0], 200)
        preferences = copy.deepcopy(self.report); preferences.update(epoch='4' * 32, consent_revision=2)
        self.assertEqual((await self.upload(preferences))[0], 200)
        both = (await self.request('GET', '/admin/v1/summary', admin=True))[1]
        self.assertEqual((both['installations'], both['preferences_installations']), (1, 1))
        self.assertEqual(sum(both['current_choices'].values()), 1)
        self.assertEqual(both['groups'][0]['performance_reports'], 1)

    async def test_admin_cli_calls_authenticated_http_and_csv(self):
        await self.enroll(); await self.upload()
        token_file = Path(self.temp.name) / 'admin.token'; token_file.write_text(self.token); os.chmod(token_file, 0o600)
        env = {**os.environ, 'PYTHONPATH': str(Path(__file__).parents[1])}
        base = [sys.executable, '-m', 'deidei_stats.admin', '--origin', self.origin, '--token-file', str(token_file), '--fixture']
        proc = await asyncio.create_subprocess_exec(*base, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, env=env)
        stdout, stderr = await proc.communicate()
        self.assertEqual(proc.returncode, 0, stderr.decode()); self.assertIn('1/2', stdout.decode())
        csv_file = Path(self.temp.name) / 'aggregate.csv'
        proc = await asyncio.create_subprocess_exec(*base, '--csv', '--output', str(csv_file), stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, env=env)
        stdout, stderr = await proc.communicate()
        self.assertEqual(proc.returncode, 0, stderr.decode()); self.assertIn('session_uses', csv_file.read_text())


if __name__ == '__main__':
    unittest.main()

class RetentionAndLimits(unittest.IsolatedAsyncioTestCase):
    async def test_actual_ttl_report_quota_and_writer_queue_overload(self):
        import time
        from deidei_stats.server import Writer, Reject
        temp = tempfile.TemporaryDirectory()
        now = [time.time()]
        writer = Writer(Path(temp.name) / 'ttl.sqlite3', lambda: now[0])
        try:
            await writer.call(lambda conn: conn.execute('INSERT INTO revoked VALUES(?,?,?)', ('1' * 32, '2' * 64, int(now[0]) + 180 * 86400)).rowcount)
            await writer.call(lambda conn: conn.execute('INSERT INTO reports VALUES(?,?,?,?,?,?,?,?)', ('1' * 32, '3' * 32, 'preferences', (dt.datetime.fromtimestamp(now[0],dt.timezone.utc).date()-dt.timedelta(days=89)).isoformat(), '0.2.0', 1, '{}', int(now[0]))).rowcount)
            now[0] += 86401
            self.assertEqual(await writer.call(lambda conn: conn.execute('SELECT count(*) FROM reports').fetchone()[0]), 0)
            self.assertEqual(await writer.call(lambda conn: conn.execute('SELECT count(*) FROM revoked').fetchone()[0]), 1)
            now[0] += 180 * 86400
            self.assertEqual(await writer.call(lambda conn: conn.execute('SELECT count(*) FROM revoked').fetchone()[0]), 0)
            # Saturate the actual finite queue before the actor gets a chance to run.
            futures = [asyncio.get_running_loop().create_future() for _ in range(64)]
            for future in futures:
                writer.queue.put_nowait((lambda conn: True, future))
            with self.assertRaises(Reject) as rejected:
                await writer.call(lambda conn: True)
            self.assertEqual(rejected.exception.status, 429)
            await asyncio.gather(*futures)
        finally:
            await writer.close()
            temp.cleanup()
