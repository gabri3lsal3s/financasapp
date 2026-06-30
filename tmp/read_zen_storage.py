import sqlite3
import os
import shutil

db_path = "/home/gabrielsales/.var/app/app.zen_browser.zen/.zen/33tr70tc.Default (release)/storage/default/http+++localhost+5173/ls/data.sqlite"
temp_db_path = "/home/gabrielsales/meus_apps/financas/financasapp/tmp/data_copy.sqlite"

def run():
    shutil.copyfile(db_path, temp_db_path)
    conn = sqlite3.connect(temp_db_path)
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT value FROM data WHERE key='sb-roynkajkdheoharcpiyj-auth-token';")
        row = cursor.fetchone()
        if row:
            val = row[0]
            print("Hex:", val.hex()[:300])
            print("Length:", len(val))
            # Let's try decoding after stripping possible headers
            # Firefox stores string data as UTF-16 LE, but sometimes with a compression or format byte.
            # Let's check if the first byte is a flag.
            print("First few bytes:", list(val[:20]))
            # Let's try to decode from offset 0, 1, 2, 3, 4 etc. using utf-16 with errors='ignore'
            for offset in range(10):
                try:
                    decoded = val[offset:].decode('utf-16', errors='ignore')
                    if "access_token" in decoded:
                        print(f"Offset {offset} decoded contains 'access_token'!")
                        print(decoded[:200])
                except Exception as e:
                    pass
        else:
            print("Not found")
    except Exception as e:
        print("Error:", e)
    finally:
        conn.close()
        if os.path.exists(temp_db_path):
            os.remove(temp_db_path)

if __name__ == "__main__":
    run()
