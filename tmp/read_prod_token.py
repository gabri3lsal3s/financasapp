import sqlite3
import os
import shutil

db_path = "/home/gabrielsales/.var/app/app.zen_browser.zen/.zen/33tr70tc.Default (release)/storage/default/https+++financasapp-aj5qn6nn1-gabriel-isaacs-projects.vercel.app/ls/data.sqlite"
temp_db_path = "/home/gabrielsales/meus_apps/financas/financasapp/tmp/data_copy_prod.sqlite"

def run():
    if not os.path.exists(db_path):
        print(f"Database not found at: {db_path}")
        return

    shutil.copyfile(db_path, temp_db_path)
    conn = sqlite3.connect(temp_db_path)
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        print("Tables:", tables)

        for table in tables:
            tname = table[0]
            cursor.execute(f"SELECT * FROM {tname};")
            rows = cursor.fetchall()
            for r in rows:
                key = r[0]
                val = r[1]
                print(f"Key: {key}, Type: {type(val)}, Length: {len(val) if hasattr(val, '__len__') else 'N/A'}")
                if "auth-token" in key or "supabase" in key:
                    print(f"Hex: {val.hex()[:200]}")
                    # Try offset 5 decode
                    try:
                        print("Decoded UTF-8 offset 5:", val[5:].decode('utf-8')[:300])
                    except Exception as e:
                        print("Decode failed:", e)
    except Exception as e:
        print("Error:", e)
    finally:
        conn.close()
        if os.path.exists(temp_db_path):
            os.remove(temp_db_path)

if __name__ == "__main__":
    run()
