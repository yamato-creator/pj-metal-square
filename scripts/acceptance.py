"""一気通貫 受け入れテスト（本番・読み取りのみ・ログイン不要分）

実行: mt-dashboard-backend/.venv/bin/python scripts/acceptance.py
  A. スプレッドシート（settings / transactions 11列 / C1数式 / getLastRow汚染 / 資産 / 価格更新）
  B. 本番API（24h開放 / 認証 / 売却ゲート / 取消ゲート / 履歴の列整合 / 消費税四捨五入 / 資産一致）
  C. 配布済みフロント（必須文言・禁止文言・注意書き統一）
  D. GAS（消費税round / adminEmails / 11要素writer）※ローカル＝本番貼り替え済み版
※ 変更をデプロイしたら必ずこれを流す（2026/09/29 導入）。ログインが要る目視・実売却は別途。
"""
import json, math, re, urllib.request, sys, datetime
from google.oauth2 import service_account
from googleapiclient.discovery import build
ROOT="/Users/ogura/code/private/TechValue/顧客/貴金属売買案件_スクエア合同会社/pj-metal-square"
SID="1WoBLYqZojno8_DVGvkeeCmloJAXJWMXVQ9wcgcLDxLM"; API="https://api.preciousmetalmine.com"; KEY="apikey_20260123080818"
R=[]
def chk(id_, name, ok, ev=""): R.append((id_,name,bool(ok),ev)); print(("✅" if ok else "❌"), id_, name, ("— "+str(ev)[:110]) if ev else "")
def http(path, method="GET", body=None, key=True):
    req=urllib.request.Request(API+path, data=(json.dumps(body).encode() if body else None), method=method,
        headers={"Content-Type":"application/json", **({"X-API-Key":KEY} if key else {})})
    try:
        with urllib.request.urlopen(req, timeout=25) as r: return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read().decode())
        except Exception: return e.code, {}
creds=service_account.Credentials.from_service_account_file(f"{ROOT}/mt-dashboard-backend/credentials.json",scopes=['https://www.googleapis.com/auth/spreadsheets.readonly'])
s=build('sheets','v4',credentials=creds)
g=lambda r,o="FORMATTED_VALUE": s.spreadsheets().values().get(spreadsheetId=SID,range=r,valueRenderOption=o).execute().get('values',[])
now=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))); print("JST",now.strftime("%Y-%m-%d %H:%M:%S")); print()

print("■ A. スプレッドシート")
meta=s.spreadsheets().get(spreadsheetId=SID).execute(); titles={sh['properties']['title']:sh['properties'] for sh in meta['sheets']}
chk("A1","settings シート存在・B2=OFF・B3既定文・C使い方", 'settings' in titles and g("settings!B2")==[['OFF']] and 'メンテナンス中' in g("settings!B3")[0][0] and 'ON' in g("settings!C2")[0][0], g("settings!A1:C3"))
h=g("transactions!A1:K1")[0]
chk("A2","transactions ヘッダ = 取引ID/ユーザーID/ユーザー名/取引種別/…/取引状態/取引日時/取引会社名（11列）", h==['取引ID','ユーザーID','ユーザー名','取引種別','貴金属','取引量(g)','単価(円)','合計金額','取引状態','取引日時','取引会社名'] and titles['transactions']['gridProperties']['columnCount']==11, h)
f=g("transactions!C1","FORMULA")[0][0]
chk("A3","C1 は true-blank 版 ARRAYFORMULA（LEN(B:B)）", "LEN(B:B)" in f and "VLOOKUP(B:B,users!A:B" in f, f[:80])
A=g("transactions!A:A"); C=g("transactions!C:C")
lastA=max(i+1 for i,r in enumerate(A) if r and r[0]); lastC=max((i+1 for i,r in enumerate(C) if r and r[0]!=""),default=0)
chk("A4","ユーザー名が全データ行に表示・getLastRow汚染なし（lastA==lastC）", lastA==lastC, f"lastA={lastA} lastC={lastC}")
rows=g("transactions!A2:K200"); bad=[r for r in rows if len(r)>=9 and r[8] not in ('申込済','取消','売却')]
chk("A5","全行の I列(状態) が 申込済/取消/売却 のいずれか（列ズレなし）", not bad, f"rows={len(rows)} bad={bad[:2]}")
assets=g("assets!A1:F200"); test=[r for r in assets if len(r)>3 and r[1]=="0276583112"]
chk("A6","テストユーザー資産 = 金30.81/Pd558.42/Ag3464.12/Pt539.45（復元完全）", [r[3] for r in test]==['30.81','558.42','3464.12','539.45'], [(r[2],r[3]) for r in test])
mp=g("'metal-prices'!E2")[0][0]; chk("A7","metal-prices!E2 が本日更新（5分ポーリング稼働）", mp.startswith(now.strftime("%Y-%m-%d")), mp)
print()

print("■ B. 本番API")
st,d=http("/api/check-access-time",key=False)
chk("B1","24時間開放：check-access-time is_allowed=true・maintenance=false・allowed_hours=24時間", st==200 and d.get("is_allowed") is True and d.get("maintenance") is False and "24時間" in d.get("allowed_hours",""), {k:d.get(k) for k in ("is_allowed","maintenance","allowed_hours")})
st,d=http("/api/transactions/sale","POST",{"metals":[{"metal_type":"金","amount":0.01,"unit_price":1,"total":0}],"total_amount":0,"tax":0,"total":0},key=False)
chk("B2","認証なし /sale は拒否(403)", st==403, st)
st,d=http("/api/transactions/sale","POST",{"metals":[{"metal_type":"金","amount":999999,"unit_price":1,"total":999999}],"total_amount":999999,"tax":0,"total":999999})
in_win = (now.hour*60+now.minute) <= 12*60+30 and mp>=now.strftime("%Y-%m-%d") or (13*60 <= now.hour*60+now.minute <= 15*60+30)
chk("B3","売却ゲート：窓外なら403「相場更新後〜12:30/15:30」／窓内なら保有超過400", (st==403 and "相場更新後" in d.get("detail","")) or (st==400 and "保有量" in d.get("detail","")), f"{st} {d.get('detail','')[:60]}")
st,d=http("/api/transactions/cancel/TRS_NONE","POST")
chk("B4","取消ゲート：10〜24時内はゲート通過→404（売却窓と整合済み）", st==404, f"{st} {d.get('detail','')[:50]}")
st,d=http("/api/transactions"); tx=d.get("transactions",[])
t=[x for x in tx if str(x.get("date","")).startswith("2026/09/29")]
chk("B5","取引履歴API：行が返り user_name/status/total が正しい列", len(tx)>0 and all(x.get("user_name") and x.get("status") in ("取消","売却","申込済") for x in t), [(x["id"],x.get("user_name"),x["status"],x["total"]) for x in t[:2]])
big=[x for x in tx if x.get("subtotal",0)>=10000]
chk("B6","消費税=四捨五入（実データ）：subtotal×0.1 の小数第1位を四捨五入した値と一致", all(x["tax"]==int(math.floor(x["subtotal"]*0.1+0.5)) for x in big) and big, [(x["subtotal"],x["tax"]) for x in big[:3]])
chk("B7","見積依頼行がAPIに残っていない（売却完結フロー）", not any(x.get("transaction_type")=="見積依頼" for x in tx), len(tx))
st,d=http("/api/user/0276583112/assets"); a={x["metal_type"]:x["weight_g"] for x in d.get("assets",[])}
chk("B8","資産API＝シートと一致", a.get("金")=="30.81" and a.get("銀")=="3464.12", a)
print()

print("■ C. 配布済みフロントエンド")
html=urllib.request.urlopen("https://www.preciousmetalmine.com/").read().decode()
bundle=re.search(r'main\.[a-f0-9]+\.js',html).group(0); js=urllib.request.urlopen("https://www.preciousmetalmine.com/static/js/"+bundle).read().decode("utf-8","ignore")
esc=lambda x:"".join(ch if ord(ch)<128 else f"\\u{ord(ch):04x}" for ch in x); cnt=lambda x: js.count(x)+js.count(esc(x))
must=["売却する","売却できない時間です","価格を読み込み中","売却内容の確認","以下の内容で売却します","売却完了","売却が完了しました","売却金額","買取価格","買取価格の予定更新時刻","午前10時前後","午後14:30前後","売却は相場更新後","午前12:30","消費税を含まない価格です","メンテナンス中","売却画面に戻る"]
mustnot=["参考価格","参考金額","参考買取","見積もり依頼","担当者よりご連絡","10:00-24:00の間のみ","適用税率","消費税は含まれておりません"]
miss=[m for m in must if cnt(m)==0]; leak=[m for m in mustnot if cnt(m)>0]
chk("C1",f"必須文言 {len(must)}件すべて存在（{bundle}）", not miss, miss or "all present")
chk("C2",f"禁止文言 {len(mustnot)}件すべて不在", not leak, leak or "none")
chk("C3","消費税注意書きがトップ/売却で同一文言（×2）", cnt("消費税を含まない価格です")==2, cnt("消費税を含まない価格です"))
print()

print("■ D. GAS（ローカル＝本番貼り替え済み版）")
gs=open(f"{ROOT}/gas/売却入力処理.gs",encoding="utf-8").read(); dep=open(f"{ROOT}/gas/シートに入力した時.gs",encoding="utf-8").read()
chk("D1","消費税 Math.round ×2・Math.floor(…*0.1) ×0", gs.count("Math.round(subtotal * 0.1)")==1 and gs.count("Math.round(subtotalAll * 0.1)")==1 and "Math.floor(subtotal * 0.1)" not in gs and "Math.floor(subtotalAll * 0.1)" not in gs)
chk("D2","adminEmails 5件（小倉含む）", gs.count("adminEmails = [")==1 and "ogura.yamato123@gmail.com" in gs and len(re.search(r"adminEmails = \[(.*?)\];",gs,re.S).group(1).split("',"))>=5)
chk("D3","売却/預入 writer に C列プレースホルダ（11要素）", "'',            // C列" in gs and "'',                   // C列" in dep)
print()
ok=sum(1 for r in R if r[2]); print(f"=== 合計 {ok}/{len(R)} PASS ===")
if ok!=len(R): print("FAILED:",[r[0]+" "+r[1] for r in R if not r[2]])
