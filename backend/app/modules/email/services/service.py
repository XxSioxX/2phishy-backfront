from app.modules.email.providers.resend_provider import ResendProvider
from app.modules.email.services.template_renderer import render
from app.modules.email.services.registry import EmailTemplates, default_context


class EmailService:

    def __init__(self):
        self.provider = ResendProvider()

    def send_password_reset(self, to_email: str, reset_link: str):

        context = {
            **default_context(),
            "reset_link": reset_link,
            "expiration_minutes": 15
        }

        html_content = render(
            EmailTemplates.PASSWORD_RESET,
            context
        )

    # 👇 PUT IT HERE
        text_content = f"Reset your password using this link: {reset_link}"

        self.provider.send_email(
            to=to_email,
            subject="Reset Your Password",
            html=html_content,
            text=text_content
        )
