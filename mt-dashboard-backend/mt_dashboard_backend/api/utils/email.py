import httpx
import logging
import math
from typing import Optional
import pandas as pd

class EmailSender:
    """メール送信を担当するユーティリティクラス"""
    
    def __init__(self):
        self.email_function_url = "https://asia-northeast1-astute-maxim-457911-g9.cloudfunctions.net/send_email_http_square"
        self.headers = {"Content-Type": "application/json"}
        # 複数の管理者メールアドレスを配列で定義
        self.admin_emails = [
            "precious.metal.mine@gmail.com",
            "square.hirata@gmail.com", 
            "square_hoshi@outlook.jp",
            "kobesendaikanto@outlook.jp"
        ]
        

    async def send_email(self, to: str, subject: str, body: str) -> bool:
        """
        メールを送信する
        
        Args:
            to (str): 送信先メールアドレス
            subject (str): メールの件名
            body (str): メール本文
            
        Returns:
            bool: 送信成功時True、失敗時False
        """
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    self.email_function_url,
                    json={
                        "to": to,
                        "subject": subject,
                        "body": body
                    },
                    headers=self.headers
                )
                if response.status_code == 200:
                    return True
                else:
                    logging.error(f"メール送信失敗: ステータスコード={response.status_code}")
                    return False
                
        except Exception as e:
            logging.error(f"メール送信エラー: {str(e)}")
            return False

    # 管理者全員にメールを送信する新しいメソッド
    async def send_email_to_all_admins(self, subject: str, body: str) -> bool:
        """
        すべての管理者にメールを送信する
        
        Args:
            subject (str): メールの件名
            body (str): メール本文
            
        Returns:
            bool: 少なくとも1つの送信が成功した場合にTrue
        """
        success = False
        for admin_email in self.admin_emails:
            result = await self.send_email(admin_email, subject, body)
            if result:
                success = True
            else:
                logging.error(f"管理者 {admin_email} へのメール送信に失敗しました。")
        return success

    async def send_user_registration_email(self, user_email: str, username: str, created_at: str) -> bool:
        """ユーザー登録完了メールを送信"""
        subject = "ユーザー登録完了のお知らせ"
        body = f"""
貴金属売買サイトへのユーザー登録が完了しました。

ユーザー情報:
ユーザー名: {username}
メールアドレス: {user_email}
登録日時: {created_at}

以下のURLからログインしてください：
https://www.preciousmetalmine.com/

ご利用ありがとうございます。"""
        
        # ユーザー向けメール送信
        success = await self.send_email(user_email, subject, body)
        
        # 管理者向けメール送信
        if success:
            admin_subject = "新規ユーザー登録の通知"
            admin_body = f"""
新しいユーザーが登録されました。

ユーザー情報:
ユーザー名: {username}
メールアドレス: {user_email}
登録日時: {created_at}"""
            
            await self.send_email_to_all_admins(admin_subject, admin_body)
        
        return success

    async def send_password_change_email(self, user_email: str, change_datetime: str) -> bool:
        """パスワード変更完了メールを送信"""
        subject = "パスワード変更完了のお知らせ"
        body = f"""
パスワードの変更が完了しましたのでお知らせいたします。

変更日時: {change_datetime}

心当たりのない変更の場合は、直ちに管理者までご連絡ください。
"""
        # ユーザー向けメール送信
        success = await self.send_email(user_email, subject, body)
        
        # 管理者向けメール送信
        if success:
            admin_subject = "ユーザーのパスワード変更通知"
            admin_body = f"""
以下のユーザーがパスワードを変更しました。

メールアドレス: {user_email}
変更日時: {change_datetime}"""
            
            await self.send_email_to_all_admins(admin_subject, admin_body)
        
        return success

    async def send_email_change_notification(
        self,
        old_email: str,
        new_email: str,
        user_id: str,
        change_datetime: str
    ) -> bool:
        """メールアドレス変更完了メールを送信"""
        subject = "メールアドレス変更完了のお知らせ"
        body = f"""
メールアドレスの変更が完了しましたのでお知らせいたします。

変更前: {old_email}
変更後: {new_email}
変更日時: {change_datetime}

心当たりのない変更の場合は、直ちに管理者までご連絡ください。
"""
        # 新しいアドレスに送信
        success = await self.send_email(new_email, subject, body)
        
        # 管理者向けメール送信
        if success:
            admin_subject = "ユーザーのメールアドレス変更通知"
            admin_body = f"""
以下のユーザーがメールアドレスを変更しました。

ユーザーID: {user_id}
変更前: {old_email}
変更後: {new_email}
変更日時: {change_datetime}"""
            
            await self.send_email_to_all_admins(admin_subject, admin_body)
        
        return success

    async def send_deactivation_email(self, user_email: str, deactivation_datetime: str) -> bool:
        """退会完了メールを送信"""
        subject = "退会手続き完了のお知らせ"
        body = f"""
退会手続きが完了しましたのでお知らせいたします。

ご利用ありがとうございました。
今後も何かございましたら、お気軽にお問い合わせください。

退会したアカウント: {user_email}
退会処理日時: {deactivation_datetime}
"""
        # ユーザー向けメール送信
        success = await self.send_email(user_email, subject, body)
        
        # 管理者向けメール送信
        if success:
            admin_subject = "ユーザー退会の通知"
            admin_body = f"""
以下のユーザーが退会しました。

メールアドレス: {user_email}
退会処理日時: {deactivation_datetime}"""
            
            await self.send_email_to_all_admins(admin_subject, admin_body)
        
        return success

    async def send_sale_completion_email(
        self,
        user_email: str,
        sales_details: str,
        total_amount: int,
        tax: int,
        total: int
    ) -> bool:
        """売却完了メールを送信"""
        sale_datetime = pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')
        subject = "貴金属売却完了のお知らせ"
        body = f"""
貴金属の売却が完了しましたのでお知らせいたします。

売却内容:
{sales_details}

売却合計金額: {total_amount:,}円
消費税: {tax:,}円
総合計: {total:,}円

ご利用ありがとうございました。

取引日時: {sale_datetime}"""
        
        # ユーザー向けメール送信
        success = await self.send_email(user_email, subject, body)
        
        # 管理者向けメール送信
        if success:
            admin_subject = "新規貴金属売却取引の通知"
            admin_body = f"""
新しい貴金属売却取引が完了しました。

売却内容:
{sales_details}

売却合計金額: {total_amount:,}円
消費税: {tax:,}円
総合計: {total:,}円

取引日時: {sale_datetime}"""
            
            await self.send_email_to_all_admins(admin_subject, admin_body)
        
        return success

    async def send_sale_quote_request_email(
        self,
        user_email: str,
        username: str,
        user_id: str,
        quote_details: str,
        reference_total: int,
        transaction_id: str,
    ) -> bool:
        """売却見積もり依頼の通知メール（ユーザー受付 + スクエア管理者通知）"""
        request_datetime = pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')

        # ユーザー向け: 受付完了通知
        user_subject = "売却見積もり依頼を受け付けました"
        user_body = f"""
Precious Metal Mineをご利用いただきありがとうございます。
以下の内容で売却見積もり依頼を受け付けました。

依頼内容:
{quote_details}

参考合計金額(税抜): {reference_total:,}円

受付日時: {request_datetime}
依頼番号: {transaction_id}

担当者が内容を確認のうえ、改めて正式な見積もりをご連絡いたします。
今しばらくお待ちください。
"""
        success = await self.send_email(user_email, user_subject, user_body)

        # スクエア管理者向け: 依頼通知
        admin_subject = "【要対応】新規の売却見積もり依頼"
        admin_body = f"""
ユーザーより売却見積もり依頼が届きました。内容をご確認のうえ、正式な見積もり金額を提示してください。

■ユーザー情報
ユーザー名: {username}
ユーザーID: {user_id}
メールアドレス: {user_email}

■依頼内容
{quote_details}

参考合計金額(税抜): {reference_total:,}円

受付日時: {request_datetime}
依頼番号: {transaction_id}
"""
        await self.send_email_to_all_admins(admin_subject, admin_body)

        return success

    async def send_transaction_cancel_email(
        self,
        user_email: str,
        transaction_details: str,
        transaction_date: str
    ) -> bool:
        """取引キャンセル完了メールを送信"""
        cancel_datetime = pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')
        subject = "貴金属売却取引キャンセル完了のお知らせ"
        body = f"""
貴金属の売却取引がキャンセルされましたのでお知らせいたします。

キャンセル内容:
{transaction_details}

元の取引日時: {transaction_date}
キャンセル処理日時: {cancel_datetime}

売却した金属は資産に返却されました。
ご不明な点がございましたら、お気軽にお問い合わせください。"""
        
        # ユーザー向けメール送信
        success = await self.send_email(user_email, subject, body)
        
        # 管理者向けメール送信
        if success:
            admin_subject = "貴金属売却取引キャンセルの通知"
            admin_body = f"""
貴金属売却取引がキャンセルされました。

キャンセル内容:
{transaction_details}

元の取引日時: {transaction_date}
キャンセル処理日時: {cancel_datetime}

ユーザーメールアドレス: {user_email}"""
            
            await self.send_email_to_all_admins(admin_subject, admin_body)
        
        return success

    async def send_deposit_completion_email(
        self,
        user_email: str,
        deposit_details: str
    ) -> bool:
        """預入完了メールを送信"""
        current_datetime = pd.Timestamp.now().strftime('%Y年%m月%d日 %H:%M:%S')
        subject = "貴金属預入完了のお知らせ"
        body = f"""
貴金属の預入処理が完了しましたのでお知らせいたします。

預入日時: {current_datetime}

預入内容:
{deposit_details}

ご利用ありがとうございます。
"""
        # ユーザー向けメール送信
        success = await self.send_email(user_email, subject, body)
        
        # 管理者向けメール送信
        if success:
            admin_subject = "ユーザーの貴金属預入通知"
            admin_body = f"""
以下のユーザーが貴金属を預入しました。

メールアドレス: {user_email}
預入日時: {current_datetime}
預入内容:
{deposit_details}"""
            
            await self.send_email_to_all_admins(admin_subject, admin_body)
        
        return success

    async def send_withdraw_completion_email(
        self,
        user_email: str,
        withdraw_details: str
    ) -> bool:
        """現物返却完了メールを送信"""
        current_datetime = pd.Timestamp.now().strftime('%Y年%m月%d日 %H:%M:%S')
        subject = "貴金属現物返却完了のお知らせ"
        body = f"""
貴金属の現物返却処理が完了しましたのでお知らせいたします。

返却日時: {current_datetime}

返却内容:
{withdraw_details}

ご利用ありがとうございます。
"""
        # ユーザー向けメール送信
        success = await self.send_email(user_email, subject, body)
        
        # 管理者向けメール送信
        if success:
            admin_subject = "ユーザーの貴金属現物返却通知"
            admin_body = f"""
以下のユーザーが貴金属の現物返却を行いました。

メールアドレス: {user_email}
返却日時: {current_datetime}
返却内容:
{withdraw_details}"""
            
            await self.send_email_to_all_admins(admin_subject, admin_body)
        
        return success
