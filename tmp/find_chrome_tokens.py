import re
import os
import base64
import json

db_dir = '/home/gabrielsales/.var/app/com.google.Chrome/config/google-chrome/Default/Local Storage/leveldb'
jwt_pattern = re.compile(rb'eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}')

def decode_jwt_payload(jwt_bytes):
    try:
        parts = jwt_bytes.split(b'.')
        if len(parts) != 3:
            return None
        payload_b64 = parts[1]
        # Pad base64
        padded = payload_b64 + b'=' * ((4 - len(payload_b64) % 4) % 4)
        payload_json = base64.urlsafe_b64decode(padded)
        return json.loads(payload_json)
    except Exception:
        return None

def run():
    if not os.path.exists(db_dir):
        print(f"Directory not found: {db_dir}")
        return

    for root, dirs, files in os.walk(db_dir):
        for file in files:
            file_path = os.path.join(root, file)
            try:
                with open(file_path, 'rb') as f:
                    content = f.read()
                matches = jwt_pattern.findall(content)
                for match in matches:
                    payload = decode_jwt_payload(match)
                    if payload and 'email' in payload:
                        print(f"Found valid JWT in {file}:")
                        print(f"Email: {payload['email']}")
                        print(f"Exp: {payload.get('exp')}")
                        jwt_str = match.decode('utf-8')
                        print(f"JWT: {jwt_str[:50]}...{jwt_str[-50:]}")
                        with open('/home/gabrielsales/meus_apps/financas/financasapp/tmp/extracted_jwt.txt', 'w') as out:
                            out.write(jwt_str)
                        print("Saved JWT to tmp/extracted_jwt.txt")
                        return
            except Exception as e:
                pass

if __name__ == '__main__':
    run()
