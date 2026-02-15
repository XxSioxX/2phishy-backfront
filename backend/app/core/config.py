import os

class Settings:
    DEBUG: bool = os.getenv("DEBUG", "False") == "True"

    FRONTEND_URL_DEV: str = os.getenv("FRONTEND_URL")
    FRONTEND_URL_PROD: str = os.getenv("FRONTEND_PROD_URL")

    @property
    def FRONTEND_URL(self) -> str:
        return self.FRONTEND_URL_DEV if self.DEBUG else self.FRONTEND_URL_PROD


settings = Settings()
