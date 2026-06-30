import sqlite3
import os
import shutil
import json

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
            token_json = val[5:].decode('utf-8')
            parsed = json.loads(token_json)
            print("Successfully parsed token JSON!")
            print("User email:", parsed.get('user', {}).get('email'))
            # Print access token to a hidden file or just export it
            with open("/home/gabrielsales/meus_apps/financas/financasapp/tmp/token.json", "w") as f:
                json.dump(parsed, f)
            print("Saved token to tmp/token.json")
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
