"""USB JSON -> durable SQLite outbox -> authenticated ClimateGuard HTTPS.

Credentials/config and queue must live outside the repository. Never log bodies,
headers, passwords or tokens. UTC timestamps represent bridge receipt, not an RTC.
"""
import argparse
import datetime as dt
import json
import math
import sqlite3
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

CHANNELS = {'temperature_c': 'C', 'humidity_pct': '%', 'water_level_m': 'm'}


def envelopes(frame, config):
    if frame.get('schema') != 'climateguard.uno.v1':
        raise ValueError('Unknown serial schema')
    captured = dt.datetime.now(dt.timezone.utc).isoformat()
    result = []
    for field, unit in CHANNELS.items():
        value = frame.get(field)
        if value is None:
            continue
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
            raise ValueError('Non-numeric reading')
        if field == 'water_level_m' and frame.get('water_calibrated') is not True:
            continue
        if field == 'temperature_c' and not 0 <= value <= 50:
            raise ValueError('Temperature outside DHT11 range')
        if field == 'humidity_pct' and not 0 <= value <= 100:
            raise ValueError('Humidity outside range')
        if field == 'water_level_m' and not 0 <= value <= 4:
            raise ValueError('Level outside HC-SR04 range')
        channel = config['channels'][field]
        if channel['unit'] != unit:
            raise ValueError('Catalog unit mismatch')
        result.append((channel['sensorId'], {'deviceId': channel['deviceId'],
            'measurementId': 'UNO_' + uuid.uuid4().hex, 'value': round(value, 2),
            'capturedAt': captured, 'unit': unit}))
    return result


class Queue:
    def __init__(self, file):
        self.retry_at = 0.0
        self.db = sqlite3.connect(file)
        self.db.execute('PRAGMA journal_mode=WAL')
        self.db.execute('PRAGMA synchronous=FULL')
        self.db.execute('CREATE TABLE IF NOT EXISTS pending (id INTEGER PRIMARY KEY, sensor INTEGER, body TEXT, status TEXT DEFAULT \'pending\', http INTEGER)')
        self.db.commit()

    def save(self, readings):
        with self.db:
            self.db.executemany('INSERT INTO pending(sensor,body) VALUES (?,?)',
                [(sensor, json.dumps(body, allow_nan=False)) for sensor, body in readings])

    def flush(self, client):
        if time.monotonic() < self.retry_at:
            return 0
        sent = 0
        for row, sensor, body in self.db.execute("SELECT id,sensor,body FROM pending WHERE status='pending' ORDER BY id LIMIT 30").fetchall():
            try:
                code, response = client.call(f'/sensors/{sensor}/readings/ingest', json.loads(body))
            except urllib.error.HTTPError as error:
                code = error.code
                if code == 429 or code >= 500 or code == 401:
                    self.retry_at = time.monotonic() + (60 if code == 429 else 15)
                    break
                # Keep rejected payloads for review, never silently change their IDs.
                with self.db:
                    self.db.execute("UPDATE pending SET status='rejected',http=? WHERE id=?", (code, row))
                print(json.dumps({'event': 'rejected', 'http': code, 'sensorId': sensor}), flush=True)
                continue
            except (OSError, TimeoutError):
                self.retry_at = time.monotonic() + 15
                break
            if code not in (200, 201) or 'sensorReadingId' not in response:
                break
            with self.db:
                self.db.execute("UPDATE pending SET status='sent',http=? WHERE id=?", (code, row))
            sent += 1
            print(json.dumps({'event': 'persisted', 'sensorId': sensor, 'readingId': response['sensorReadingId'],
                'http': code, 'duplicate': response.get('duplicate', False),
                'alertEvaluationPending': response.get('alertEvaluationPending')}), flush=True)
        return sent


class Client:
    def __init__(self, config):
        self.config = config
        if config['baseUrl'] != 'https://climateguard.garher.lat/api':
            raise ValueError('Unexpected API origin')
        self.access = None
        self.refresh = None

    def request(self, path, body=None, token=None):
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = 'Bearer ' + token
        req = urllib.request.Request(self.config['baseUrl'] + path,
            data=json.dumps(body).encode() if body is not None else None, headers=headers)
        # Default TLS verification stays enabled. No token-bearing redirects.
        opener = urllib.request.build_opener(NoRedirect)
        with opener.open(req, timeout=15) as response:
            return response.status, json.load(response)

    def authenticate(self):
        pair = None
        if self.refresh:
            try:
                _, pair = self.request('/auth/refresh', {'refreshToken': self.refresh})
            except urllib.error.HTTPError as error:
                if error.code != 401:
                    raise
        if pair is None:
            _, pair = self.request('/auth/login', {'email': self.config['email'], 'password': self.config['password']})
        self.access, self.refresh = pair['accessToken'], pair['refreshToken']

    def call(self, path, body=None):
        if not self.access:
            self.authenticate()
        try:
            return self.request(path, body, self.access)
        except urllib.error.HTTPError as error:
            if error.code != 401:
                raise
            self.authenticate()
            return self.request(path, body, self.access)

    def close(self):
        if self.refresh:
            try:
                self.request('/auth/logout', {'refreshToken': self.refresh})
            except Exception:
                pass


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def run():
    import serial
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', required=True)
    parser.add_argument('--seconds', type=int, default=0, help='0: run until Ctrl+C')
    args = parser.parse_args()
    config = json.loads(Path(args.config).read_text(encoding='utf-8-sig'))
    queue = Queue(Path(args.config).parent / 'readings.sqlite3')
    client = Client(config)
    stop_file = Path(args.config).parent / 'arduino-bridge.stop'
    started = time.monotonic()
    port = None
    last_flush = 0.0
    try:
        while (not args.seconds or time.monotonic() - started < args.seconds) and not stop_file.exists():
            if port is None:
                try:
                    port = serial.Serial(config['port'], 115200, timeout=1)
                    print(json.dumps({'event': 'serial_connected', 'port': config['port']}), flush=True)
                except serial.SerialException:
                    print(json.dumps({'event': 'serial_unavailable', 'port': config['port']}), flush=True)
                    time.sleep(5)
            if port is not None:
                try:
                    raw = port.readline(2048)
                    if raw:
                        frame = json.loads(raw)
                        readings = envelopes(frame, config)
                        queue.save(readings)  # Commit before the first network attempt.
                        print(json.dumps({'event': 'captured', 'channels': len(readings),
                            'distanceAvailable': frame.get('distance_cm') is not None,
                            'waterCalibrated': frame.get('water_calibrated') is True}), flush=True)
                except (ValueError, UnicodeError):
                    print(json.dumps({'event': 'invalid_serial_frame'}), flush=True)
                except (serial.SerialException, OSError):
                    port.close()
                    port = None
            if time.monotonic() - last_flush >= 10:
                queue.flush(client)
                last_flush = time.monotonic()
    except KeyboardInterrupt:
        pass
    finally:
        if port is not None:
            port.close()
        client.close()
        queue.db.close()


if __name__ == '__main__':
    try:
        run()
    except Exception as error:
        print(json.dumps({'event': 'stopped', 'errorType': type(error).__name__}), flush=True)
        raise SystemExit(1)
