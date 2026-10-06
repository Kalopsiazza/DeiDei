"""Calls the authenticated routes; never opens the database directly."""
import argparse
import asyncio
import json
from pathlib import Path
from urllib.parse import urlsplit
import aiohttp


async def main(args):
    url = urlsplit(args.origin)
    if url.scheme != 'https' and not (args.fixture and url.scheme == 'http' and url.hostname in ('127.0.0.1', '::1')):
        raise ValueError('HTTPS_REQUIRED')
    if url.username or url.password or url.query or url.fragment or url.path not in ('', '/'):
        raise ValueError('ORIGIN_REQUIRED')
    token = Path(args.token_file).read_text().strip()
    route = '/admin/v1/export.csv' if args.csv else '/admin/v1/summary'
    params = {key: value for key, value in {'from': args.start, 'to': args.end, 'group': args.group}.items() if value}
    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10), cookie_jar=aiohttp.DummyCookieJar()) as session:
        async with session.get(args.origin.rstrip('/') + route, params=params, headers={'Authorization': 'Bearer ' + token}, allow_redirects=False) as response:
            response.raise_for_status()
            raw = await response.content.read(1024 * 1024 + 1)
            if len(raw) > 1024 * 1024:
                raise ValueError('RESPONSE_LIMIT')
            if args.csv:
                if not args.output:
                    raise ValueError('CSV_OUTPUT_REQUIRED')
                Path(args.output).write_bytes(raw)
                print('Aggregated CSV saved; offline exports are outside game erasure controls.')
            else:
                data = json.loads(raw)
                print(data['population'] + ': ' + str(data['installations']))
                print('偏好选择分母（已上传偏好快照的安装实例）: ' + str(data['preferences_installations']))
                print('group\tuses\tsettings\trecommendation adopted/shown\tperformance reports')
                for row in data['groups']:
                    print(f"{row['group']}\t{row['session_uses']}\t{row['settings_changes']}\t{row['recommendation_adopted']}/{row['recommendation_shown']}\t{row['performance_reports']}")
                print(json.dumps(data['current_choices'], ensure_ascii=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--origin', required=True)
    parser.add_argument('--token-file', required=True)
    parser.add_argument('--fixture', action='store_true')
    parser.add_argument('--from', dest='start')
    parser.add_argument('--to', dest='end')
    parser.add_argument('--group', choices=('app_version', 'day'), default='app_version')
    parser.add_argument('--csv', action='store_true')
    parser.add_argument('--output')
    asyncio.run(main(parser.parse_args()))
