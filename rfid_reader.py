import re
import time

try:
    import RPi.GPIO as GPIO  # type: ignore
    from mfrc522 import SimpleMFRC522  # type: ignore
except ImportError:
    print("[ERROR] RFID hardware libraries (RPi.GPIO, mfrc522) are not installed.")
    print("Run this helper on a Raspberry Pi with the RC522 connected.")
    raise SystemExit(1)


def normalize_uid(uid):
    if uid is None:
        return None

    if isinstance(uid, int):
        hex_value = format(uid, 'X')
        if len(hex_value) % 2:
            hex_value = '0' + hex_value
        return ' '.join(hex_value[i:i+2] for i in range(0, len(hex_value), 2))

    raw = str(uid).strip().upper()
    compact = re.sub(r'[^0-9A-F]', '', raw)
    if compact and len(compact) % 2 == 0:
        return ' '.join(compact[i:i+2] for i in range(0, len(compact), 2))
    return raw or None


def aliases(uid):
    normalized = normalize_uid(uid)
    if not normalized:
        return []
    parts = normalized.split()
    results = [normalized]
    if len(parts) == 5 and parts[0] == '88':
        results.append(' '.join(parts[1:4]))
    return results


def main():
    print('Initializing RC522 RFID reader helper...')
    reader = SimpleMFRC522()
    print('Ready. This helper only prints UIDs for mapping and debugging.')
    print('The web app itself should be started with: python3 serverpy.py')

    try:
        while True:
            try:
                uid = reader.read_id()
            except AttributeError:
                uid, _ = reader.read()

            normalized = normalize_uid(uid)
            print('\n[RFID] Tag detected!')
            print(f'[RFID] Raw UID:       {uid}')
            print(f'[RFID] Normalized UID: {normalized}')
            print(f'[RFID] Match aliases:  {", ".join(aliases(uid))}')
            time.sleep(1.0)
    except KeyboardInterrupt:
        print('\nStopping helper...')
    finally:
        try:
            GPIO.cleanup()
        except Exception:
            pass


if __name__ == '__main__':
    main()
