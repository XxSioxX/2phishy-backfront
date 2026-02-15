from datetime import datetime


class EmailTemplates:

    PASSWORD_RESET = "password_reset.html"
    EMAIL_VERIFICATION = "email_verification.html"


def default_context():
    return {
        "year": datetime.utcnow().year
    }
