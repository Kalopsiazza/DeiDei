"""Closed aggregate schema: there is no generic event/metadata field."""
import datetime as dt
import re

SCOPES = ('preferences', 'performance')
PRESETS = {'high': {'ambientMotion': 'full', 'glass': 'full', 'decoration': 'full'},
           'balanced': {'ambientMotion': 'reduced', 'glass': 'light', 'decoration': 'simple'},
           'smooth': {'ambientMotion': 'off', 'glass': 'off', 'decoration': 'simple'}}


class Invalid(ValueError):
    pass


def exact(value, keys):
    if not isinstance(value, dict) or set(value) != set(keys):
        raise Invalid('FIELDS')
    return value


def integer(value, low=0, high=1_000_000):
    if type(value) is not int or not low <= value <= high:
        raise Invalid('INTEGER')
    return value


def enum(value, choices):
    if type(value) is not str or value not in choices:
        raise Invalid('ENUM')
    return value


def identifier(value):
    if not isinstance(value, str) or not re.fullmatch(r'[a-f0-9]{32,64}', value):
        raise Invalid('IDENTIFIER')
    return value


def scopes(value):
    exact(value, SCOPES)
    if any(type(v) is not bool for v in value.values()):
        raise Invalid('SCOPE')
    return value


def graphics(value):
    exact(value, ('ambientMotion', 'glass', 'decoration'))
    enum(value['ambientMotion'], ('full', 'reduced', 'off'))
    enum(value['glass'], ('full', 'light', 'off'))
    enum(value['decoration'], ('full', 'simple'))
    return value


def preset(value, setting):
    enum(value, (*PRESETS, 'custom'))
    expected = next((name for name, config in PRESETS.items() if setting == config), 'custom')
    if value != expected:
        raise Invalid('PRESET')


def date(value, now, days=90):
    if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
        raise Invalid('DATE')
    try:
        parsed = dt.date.fromisoformat(value)
    except ValueError as exc:
        raise Invalid('DATE') from exc
    if not 0 <= (now - parsed).days < days:
        raise Invalid('DATE_RANGE')
    return parsed


def report(value, now):
    exact(value, ('scope', 'epoch', 'consent_revision', 'day', 'app_version', 'report_revision', 'data'))
    enum(value['scope'], SCOPES)
    identifier(value['epoch'])
    integer(value['consent_revision'], 1, 2**31 - 1)
    integer(value['report_revision'], 1, 2**31 - 1)
    date(value['day'], now)
    if not isinstance(value['app_version'], str) or not re.fullmatch(r'\d{1,5}\.\d{1,5}\.\d{1,5}(?:-(?:alpha|beta|rc)\.\d{1,4})?', value['app_version']):
        raise Invalid('APP_VERSION')
    data = value['data']
    if value['scope'] == 'preferences':
        exact(data, ('card_style', 'graphics', 'preset', 'sessions', 'settings_changes', 'recommendations'))
        enum(data['card_style'], ('classic', 'illustrated'))
        preset(data['preset'], graphics(data['graphics']))
        integer(data['settings_changes'])
        exact(data['recommendations'], ('shown', 'adopted'))
        integer(data['recommendations']['shown'])
        integer(data['recommendations']['adopted'], 0, data['recommendations']['shown'])
        if not isinstance(data['sessions'], list) or len(data['sessions']) > 64:
            raise Invalid('SESSIONS')
        seen = set()
        for item in data['sessions']:
            exact(item, ('session_kind', 'gameplay', 'card_style', 'skills', 'count'))
            enum(item['session_kind'], ('solo', 'multiplayer'))
            enum(item['gameplay'], ('classic', 'firepower', 'loan', 'lucky', 'custom_pack'))
            enum(item['card_style'], ('classic', 'illustrated'))
            if not isinstance(item['skills'], list) or len(item['skills']) != 8 or any(type(v) is not bool for v in item['skills']):
                raise Invalid('SKILLS')
            integer(item['count'], 1)
            key = (item['session_kind'], item['gameplay'], item['card_style'], tuple(item['skills']))
            if key in seen:
                raise Invalid('DUPLICATE_DIMENSION')
            seen.add(key)
    else:
        exact(data, ('os', 'memory', 'parallelism', 'compositing', 'pixel_load', 'saved_graphics', 'effective_graphics', 'preset', 'reduced_motion', 'reduced_transparency', 'p95', 'long_interval_ratio', 'algorithm_version', 'samples'))
        enum(data['os'], ('macos', 'windows', 'linux', 'other'))
        enum(data['memory'], ('unknown', 'le4', 'le8', 'le16', 'gt16'))
        enum(data['parallelism'], ('unknown', 'le2', 'le4', 'le8', 'gt8'))
        enum(data['compositing'], ('unknown', 'hardware', 'software'))
        enum(data['pixel_load'], ('unknown', 'le1m', 'le3m', 'le8m', 'gt8m'))
        graphics(data['saved_graphics'])
        preset(data['preset'], graphics(data['effective_graphics']))
        if type(data['reduced_motion']) is not bool or type(data['reduced_transparency']) is not bool:
            raise Invalid('BOOLEAN')
        enum(data['p95'], ('le20', 'le33', 'le50', 'gt50'))
        enum(data['long_interval_ratio'], ('le1pct', 'le5pct', 'gt5pct'))
        enum(data['algorithm_version'], ('graphics-v1',))
        integer(data['samples'], 240, 4096)
    return value
