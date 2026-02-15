import os
import resend
from .base import BaseEmailProvider


class ResendProvider(BaseEmailProvider):

    def __init__(self):
        resend.api_key = os.getenv("RESEND_API_KEY")
        self.from_email = os.getenv("EMAIL_FROM")

    def send_email(self, to: str, subject: str, html: str, text: str = None):
        response = resend.Emails.send({
            "from": self.from_email,
            "to": [to],
            "subject": subject,
            "html": html,
            "text": text or "Please view this email in an HTML-compatible client."
        })

        return response
