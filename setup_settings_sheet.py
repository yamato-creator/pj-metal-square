"""
2026/09/26 星さん要望（見積もり②・8万）＋ ⑤ユーザー名表示 のスプシ側セットアップ（冪等）。

1. 「settings」シートを作成し、メンテナンスON/OFFと文言を置く
     A1:B1  項目 / 値
     A2:B2  メンテナンス / OFF        ← ON にするとアプリが「メンテナンス中」画面になる（最大約1分で反映）
     A3:B3  メンテナンス文言 / （既定文）
2. 「transactions」の C列に「ユーザー名」（users!A:B から VLOOKUP・ARRAYFORMULA）。2026/09/29 K→C 移動
   ※ 既存 A〜J の位置は変えない（バックエンド/GASは A:J を固定参照しているため、右端に追加）

実行: mt-dashboard-backend/.venv/bin/python setup_settings_sheet.py
"""
from google.oauth2 import service_account
from googleapiclient.discovery import build

SPREADSHEET_ID = "1WoBLYqZojno8_DVGvkeeCmloJAXJWMXVQ9wcgcLDxLM"
CREDENTIALS_PATH = "mt-dashboard-backend/credentials.json"
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
DEFAULT_MSG = "ただいまメンテナンス中です。恐れ入りますが、しばらく時間をおいて再度アクセスしてください。"
# 2026/09/29: 旧式 IF(B:B="","",…) は全行に "" を吐き、GAS の getLastRow() が末尾(2111)を返して
# 売却入力の行が最下部に飛ぶ不具合を起こした。LEN(B:B) 判定＋末尾の空引数で true blank を返す形に修正。
USERNAME_FORMULA = '=ARRAYFORMULA(IF(ROW(A:A)=1,"ユーザー名",IF(LEN(B:B),IFERROR(VLOOKUP(B:B,users!A:B,2,FALSE),""),)))'


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
    """transactions の「ユーザー名」列を C に置く（2026/09/29 星さん「IDの横」に合わせて K→C 移動）。
    冪等: C1 が既に ユーザー名 の数式ならスキップ。旧 K列（ユーザー名）が残っていれば削除。
    ※ backend/GAS は同時に 11列レイアウト (A:K, status=I) へ更新済みであること。"""
    props = sheet_props(s, 'transactions'); sheet_id = props['sheetId']
    c1 = s.spreadsheets().values().get(spreadsheetId=SPREADSHEET_ID, range="transactions!C1").execute().get('values', [])
    if c1 and c1[0] and c1[0][0] == "ユーザー名":
        print("[skip] transactions!C1 は既に ユーザー名"); return
    reqs = [{"insertDimension": {"range": {"sheetId": sheet_id, "dimension": "COLUMNS", "startIndex": 2, "endIndex": 3}, "inheritFromBefore": False}}]
    s.spreadsheets().batchUpdate(spreadsheetId=SPREADSHEET_ID, body={"requests": reqs}).execute()
    print("[inserted] C列を挿入（旧C〜Kは D〜L へ）")
    s.spreadsheets().values().update(spreadsheetId=SPREADSHEET_ID, range="transactions!C1", valueInputOption="USER_ENTERED",
                                     body={"values": [[USERNAME_FORMULA]]}).execute()
    s.spreadsheets().batchUpdate(spreadsheetId=SPREADSHEET_ID, body={"requests": [
        {"repeatCell": {"range": {"sheetId": sheet_id, "startRowIndex": 0, "endRowIndex": 1, "startColumnIndex": 2, "endColumnIndex": 3},
                        "cell": {"userEnteredFormat": {"numberFormat": {"type": "TEXT", "pattern": "@"}}}, "fields": "userEnteredFormat.numberFormat"}},
        {"updateDimensionProperties": {"range": {"sheetId": sheet_id, "dimension": "COLUMNS", "startIndex": 2, "endIndex": 3}, "properties": {"pixelSize": 220}, "fields": "pixelSize"}},
    ]}).execute()
    print("[written] transactions!C1 に ユーザー名 の ARRAYFORMULA（書式テキスト・幅220）")
    # 旧 K（挿入後は L）にユーザー名の数式が残っていれば削除
    l1 = s.spreadsheets().values().get(spreadsheetId=SPREADSHEET_ID, range="transactions!L1", valueRenderOption="FORMULA").execute().get('values', [])
    if l1 and l1[0] and "ユーザー名" in str(l1[0][0]):
        s.spreadsheets().batchUpdate(spreadsheetId=SPREADSHEET_ID, body={"requests": [
            {"deleteDimension": {"range": {"sheetId": sheet_id, "dimension": "COLUMNS", "startIndex": 11, "endIndex": 12}}}]}).execute()
        print("[deleted] 旧ユーザー名列（L）を削除 → A〜K の11列")


def ensure_maintenance_dropdown(s):
    """settings!B2 を ON/OFF のプルダウン（入力規則）にする。
    2026/10/08 小倉: 手打ちだと表記ゆれ・打ち間違いでメンテが効かない/外れない事故が起きうるため。
    ・リストは ON / OFF の2択、リスト以外の入力は拒否（strict）
    ・セル右に▼を表示（showCustomUi）
    冪等: 何度流しても同じ状態になる。
    """
    props = sheet_props(s, 'settings')
    if not props:
        print("[skip] settings シートが無いためプルダウン未設定")
        return
    sheet_id = props['sheetId']
    s.spreadsheets().batchUpdate(spreadsheetId=SPREADSHEET_ID, body={"requests": [
        {"setDataValidation": {
            # B2 のみ（0始まり・終端排他）
            "range": {"sheetId": sheet_id, "startRowIndex": 1, "endRowIndex": 2,
                      "startColumnIndex": 1, "endColumnIndex": 2},
            "rule": {
                "condition": {"type": "ONE_OF_LIST",
                              "values": [{"userEnteredValue": "ON"}, {"userEnteredValue": "OFF"}]},
                "inputMessage": "ON＝アプリ全体をメンテナンス画面にする／OFF＝通常運転。約1分で反映されます。",
                "strict": True,
                "showCustomUi": True,
            },
        }}
    ]}).execute()
    print("[set] settings!B2 に ON/OFF プルダウンを設定")


ASSETS_USERNAME_FORMULA = (
    '=ARRAYFORMULA(IF(ROW(A:A)=1,"ユーザー名",'
    'IF(LEN(B:B),IFERROR(VLOOKUP(B:B,users!A:B,2,FALSE),""),)))'
)


def ensure_assets_username_column(s):
    """assets の C列に「ユーザー名」を挿入する（2026/10/09 星さん「IDの横にあった方が分かりやすい」）。
    transactions!C と同じ ARRAYFORMULA（users!A:B を VLOOKUP。未入力行は true blank）。

    ★前提: backend `asset_service.py` と GAS（シートに入力した時.gs／売却入力処理.gs）が
      「ヘッダー名から列を特定する」版に更新・反映済みであること。旧コードのまま挿入すると
      金属・保有量・更新日時の列がズレて売却の減算先が狂う。
    冪等: C1 が既に ユーザー名 ならスキップ。
    実行: setup_settings_sheet.py --assets-username （通常実行では走らない）
    """
    props = sheet_props(s, 'assets')
    if not props:
        print("[skip] assets シートが無い")
        return
    sheet_id = props['sheetId']
    c1 = s.spreadsheets().values().get(spreadsheetId=SPREADSHEET_ID, range="assets!C1",
                                      valueRenderOption="FORMULA").execute().get('values', [])
    if c1 and c1[0] and 'ユーザー名' in str(c1[0][0]):
        print("[skip] assets!C1 は既に ユーザー名")
        return
    hdr = s.spreadsheets().values().get(spreadsheetId=SPREADSHEET_ID, range="assets!A1:E1").execute().get('values', [[]])[0]
    assert hdr[:5] == ['asset_id', 'user_id', 'metal_type', 'weight_g', 'updated_at'], f"想定外のヘッダー: {hdr}"
    s.spreadsheets().batchUpdate(spreadsheetId=SPREADSHEET_ID, body={"requests": [
        {"insertDimension": {"range": {"sheetId": sheet_id, "dimension": "COLUMNS", "startIndex": 2, "endIndex": 3},
                             "inheritFromBefore": False}},
    ]}).execute()
    s.spreadsheets().values().update(spreadsheetId=SPREADSHEET_ID, range="assets!C1", valueInputOption="USER_ENTERED",
                                     body={"values": [[ASSETS_USERNAME_FORMULA]]}).execute()
    s.spreadsheets().batchUpdate(spreadsheetId=SPREADSHEET_ID, body={"requests": [
        {"updateDimensionProperties": {"range": {"sheetId": sheet_id, "dimension": "COLUMNS", "startIndex": 2, "endIndex": 3},
                                       "properties": {"pixelSize": 220}, "fields": "pixelSize"}},
    ]}).execute()
    print("[inserted] assets!C に ユーザー名（ARRAYFORMULA）を挿入")


if __name__ == "__main__":
    s = svc()
    ensure_settings(s)
    ensure_maintenance_dropdown(s)
    import sys
    if '--assets-username' in sys.argv:
        ensure_assets_username_column(s)
    ensure_username_column(s)
    # 結果確認
    print("assets!A1:F1 =", s.spreadsheets().values().get(spreadsheetId=SPREADSHEET_ID, range="assets!A1:F1").execute().get('values'))
    print("settings!A1:B3 =", s.spreadsheets().values().get(spreadsheetId=SPREADSHEET_ID, range="settings!A1:B3").execute().get('values'))
    print("transactions!J1:K3 =", s.spreadsheets().values().get(spreadsheetId=SPREADSHEET_ID, range="transactions!J1:K3").execute().get('values'))
