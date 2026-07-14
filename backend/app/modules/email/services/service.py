try:
    from app.modules.email.providers.resend_provider import ResendProvider
except (ImportError, RuntimeError):
    ResendProvider = None

from app.modules.email.services.template_renderer import render
from app.modules.email.services.registry import EmailTemplates, default_context


class EmailService:

    def __init__(self):
        if ResendProvider is None:
            raise RuntimeError("Email service is not properly configured. Install the 'resend' package to use email functionality.")
        self.provider = ResendProvider()

    def send_password_reset(self, to_email: str, reset_link: str):
        expiration_minutes = 15

        context = {
            **default_context(),
            "reset_link": reset_link,
            "expiration_minutes": expiration_minutes
        }

        html_content = render(
            EmailTemplates.PASSWORD_RESET,
            context
        )

        text_content = (
            "Reset your 2Phishy password\n\n"
            "We received a request to reset your password. "
            f"This link expires in {expiration_minutes} minutes and can only be used once:\n\n"
            f"{reset_link}\n\n"
            "If you did not request this reset, ignore this email. "
            "Your password will stay unchanged."
        )

        self.provider.send_email(
            to=to_email,
            subject="Reset your 2Phishy password",
            html=html_content,
            text=text_content
        )
