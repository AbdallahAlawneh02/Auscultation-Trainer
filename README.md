# Heart & Lung Auscultation Trainer

## Run

```bash
cd "$(dirname "$0")"
python3 serverpy.py
```

Open:

- `http://localhost:3001/main.html`
- or `http://<raspberry-pi-ip>:3001/main.html`

## Notes

- Start the main app with `serverpy.py`.
- `rfid_reader.py` is only a diagnostic helper to print UID values.
- The web app uses real RFID hardware only for the exam flow.
- Static files are served with no-cache headers so updated JS and CSS are loaded immediately.
- The frontend accepts both the short RC522 UID form like `88 04 3D 56 E7` and the older longer UID aliases.
