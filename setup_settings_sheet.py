"""
2026/09/26 星さん要望（見積もり②・8万）＋ ⑤ユーザー名表示 のスプシ側セットアップ（冪等）。

1. 「settings」シートを作成し、メンテナンスON/OFFと文言を置く
     A1:B1  項目 / 値
     A2:B2  メンテナンス / OFF        ← ON にするとアプリが「メンテナンス中」画面になる（最大約1分で反映）
     A3:B3  メンテナンス文言 / （既定文）
2. 「transactions」に K列「ユーザー名」を追加（users!A:B から VLOOKUP・ARRAYFORMULAで自動）
   ※ 既存 A〜J の位置は変えない（バックエンド/GASは A:J を固定参照しているため、右端に追加）

実行: mt-dashboard-backend/.venv/bin/python setup_settings_sheet.py
"""
from google.oauth2 import service_account
from googleapiclient.discovery import build

SPREADSHEET_ID = "1WoBLYqZojno8_DVGvkeeCmloJAXJWMXVQ9wcgcLDxLM"
CREDENTIALS_PATH = "mt-dashboard-backend/credentials.json"
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
DEFAULT_MSG = "ただいまメンテナンス中です。恐れ入りますが、しばらく時間をおいて再度アクセスしてください。"
USERNAME_FORMULA = '=ARRAYFORMULA(IF(ROW(A:A)=1,"ユーザー名",IF(B:B="","",IFERROR(VLOOKUP(B:B,users!A:B,2,FALSE),""))))'


def svc():
    creds = service_account.Credentials.from_service_account_file(CREDENTIALS_PATH, scopes=SCOPES)
    return build('sheets', 'v4', credentials=creds)


def sheet_props(s, title):
    meta = s.spreadsheets().get(spreadsheetId=SPREADSHEET_ID).execute()
    for sh in meta['sheets']:
        if sh['properties']['title'] == title:
            return sh['properties']
    return None


def ensure_settings(s):
    if sheet_props(s, 'settings'):
        print("[skip] settings シートは既に存在")
    else:
        s.spreadsheets().batchUpdate(spreadsheetId=SPREADSHEET_ID, body={"requests": [
            {"addSheet": {"properties": {"title": "settings", "gridProperties": {"rowCount": 20, "columnCount": 3}}}}
        ]}).execute()
        print("[created] settings シート作成")
    cur = s.spreadsheets().values().get(spreadsheetId=SPREADSHEET_ID, range="settings!A1:B3").execute().get('values', [])
    if cur and len(cur) >= 2 and len(cur[1]) >= 2 and cur[1][0] == "メンテナンス":
        print(f"[skip] settings 値は設定済み: {cur}")
        return
    s.spreadsheets().values().update(
        spreadsheetId=SPREADSHEET_ID, range="settings!A1:B3", valueInputOption="USER_ENTERED",
        body={"values": [["項目", "値"], ["メンテナンス", "OFF"], ["メンテナンス文言", DEFAULT_MSG]]},
    ).execute()
    print("[written] settings!A1:B3 に メンテナンス=OFF と既定文言を設定")


def ensure_username_column(s):
    props = sheet_props(s, 'transactions')
    cols = props['gridProperties']['columnCount']
    sheet_id = props['sheetId']
    if cols < 11:
        s.spreadsheets().batchUpdate(spreadsheetId=SPREADSHEET_ID, body={"requests": [
            {"appendDimension": {"sheetId": sheet_id, "dimension": "COLUMNS", "length": 11 - cols}}
        ]}).execute()
        print(f"[expanded] transactions 列数 {cols} → 11（K列を追加。A〜Jは不変）")
    else:
        print(f"[skip] transactions 列数は {cols}（K列あり）")
    k1 = s.spreadsheets().values().get(spreadsheetId=SPREADSHEET_ID, range="transactions!K1", valueInputOption=None).execute().get('values', []) if False else \
         s.spreadsheets().values().get(spreadsheetId=SPREADSHEET_ID, range="transactions!K1").execute().get('values', [])
    if k1 and k1[0] and k1[0][0] == "ユーザー名":
        print("[skip] transactions!K1 は既に ユーザー名 の数式あり")
        return
    s.spreadsheets().values().update(
        spreadsheetId=SPREADSHEET_ID, range="transactions!K1", valueInputOption="USER_ENTERED",
        body={"values": [[USERNAME_FORMULA]]},
    ).execute()
    print("[written] transactions!K1 に ユーザー名 の ARRAYFORMULA を設定（users!A:B から自動）")


if __name__ == "__main__":
    s = svc()
    ensure_settings(s)
    ensure_username_column(s)
    # 結果確認
    print("settings!A1:B3 =", s.spreadsheets().values().get(spreadsheetId=SPREADSHEET_ID, range="settings!A1:B3").execute().get('values'))
    print("transactions!J1:K3 =", s.spreadsheets().values().get(spreadsheetId=SPREADSHEET_ID, range="transactions!J1:K3").execute().get('values'))
