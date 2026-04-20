"""
⑦ 売却入力シートのセットアップスクリプト

Google Sheets の「売却入力」シートを新規作成し、
預入入力と同様のレイアウトで売却用のフィールドを配置する。

※ 書き込み権限のあるサービスアカウント or OAuth が必要。
  サービスアカウントに書き込み権限がない場合は、
  スプシオーナー（suquare.metal@gmail.com）が
  pj-metal@perfect-atrium-444314-p1.iam.gserviceaccount.com
  に編集権限を付与してください。

シート構造:
  A   B         C              D                E          F              G         H        I
  #   貴金属    1. 売却量(g)    2. 買取単価(円/g)   日付        3. ユーザーID    ユーザー名   備考      4. 売却確定
  1   金        (入力)         (入力)
  2   パラジウム (入力)         (入力)
  3   銀        (入力)         (入力)          (日付E5)    (ID F5)         (自動G5)  (自動H5)  (未確定/確定 I5)
  4   プラチナ  (入力)         (入力)
"""

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

SPREADSHEET_ID = "1WoBLYqZojno8_DVGvkeeCmloJAXJWMXVQ9wcgcLDxLM"
CREDENTIALS_PATH = "mt-dashboard-backend/credentials.json"
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']


def get_service():
    creds = service_account.Credentials.from_service_account_file(CREDENTIALS_PATH, scopes=SCOPES)
    return build('sheets', 'v4', credentials=creds)


def get_sheet_id(service, title: str):
    meta = service.spreadsheets().get(spreadsheetId=SPREADSHEET_ID).execute()
    for s in meta['sheets']:
        if s['properties']['title'] == title:
            return s['properties']['sheetId']
    return None


def ensure_sale_sheet(service):
    sid = get_sheet_id(service, '売却入力')
    if sid is not None:
        print(f"[skip] シート「売却入力」は既に存在 (id={sid})")
        return sid
    res = service.spreadsheets().batchUpdate(
        spreadsheetId=SPREADSHEET_ID,
        body={"requests": [{"addSheet": {"properties": {"title": "売却入力"}}}]}
    ).execute()
    sid = res['replies'][0]['addSheet']['properties']['sheetId']
    print(f"[created] シート「売却入力」作成 (id={sid})")
    return sid


def populate_template(service):
    # ヘッダー3段（預入入力と同じフォーマット）
    values = [
        ["#", "管理者は記入不可", "管理者が記入 (1から順に記入してください)", "", "", "", "", "", "管理者は記入不可"],
        ["", "貴金属", "1. 売却量(g)", "2. 買取単価(円/g)", "日付", "3. ユーザーID", "ユーザー名", "備考", "4. 売却確定"],
        ["1", "金", "", "", "", "", "", "", ""],
        ["2", "パラジウム", "", "", "", "", "", "", ""],
        ["3", "銀", "", "", "", "", "", "", "未確定"],
        ["4", "プラチナ", "", "", "", "", "", "", ""],
        ["⚠️ 売却しない貴金属は空白にしてください"],
        ["⚠️ 売却量と単価はペアで入力してください"],
        ["⚠️ 4. 売却確定で「確定」を選択すると資産が減算され、ユーザーにメール通知が送信されます"],
    ]
    service.spreadsheets().values().update(
        spreadsheetId=SPREADSHEET_ID,
        range="売却入力!A1:I9",
        valueInputOption="RAW",
        body={"values": values}
    ).execute()
    print("[ok] ヘッダーとテンプレートを配置")


def add_data_validation(service, sheet_id: int):
    # I5 の「4. 売却確定」に 未確定/確定 のドロップダウン
    req = {
        "setDataValidation": {
            "range": {
                "sheetId": sheet_id,
                "startRowIndex": 4, "endRowIndex": 5,
                "startColumnIndex": 8, "endColumnIndex": 9
            },
            "rule": {
                "condition": {
                    "type": "ONE_OF_LIST",
                    "values": [{"userEnteredValue": "未確定"}, {"userEnteredValue": "確定"}]
                },
                "showCustomUi": True,
                "strict": True
            }
        }
    }
    service.spreadsheets().batchUpdate(
        spreadsheetId=SPREADSHEET_ID,
        body={"requests": [req]}
    ).execute()
    print("[ok] I5にドロップダウンを設定")


def main():
    service = get_service()
    try:
        sheet_id = ensure_sale_sheet(service)
        populate_template(service)
        add_data_validation(service, sheet_id)
        print("\n完了!")
        print(f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit")
    except HttpError as e:
        print(f"\nエラー: {e}")
        print("→ サービスアカウントに書き込み権限がない可能性があります。")
        print("  スプシオーナーがサービスアカウントのメールに編集権限を付与してください:")
        print("  pj-metal@perfect-atrium-444314-p1.iam.gserviceaccount.com")


if __name__ == '__main__':
    main()
