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
            slice_bytes = val[5:]
            print("Total bytes length of slice:", len(slice_bytes))
            # Let's print bytes around 426
            start = max(0, 426 - 50)
            end = min(len(slice_bytes), 426 + 50)
            print(f"Bytes from {start} to {end}:")
            for i in range(start, end):
                b = slice_bytes[i]
                print(f"{i}: {b} (0x{b:02x}) -> {chr(b) if 32 <= b <= 126 else '.'}")
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
