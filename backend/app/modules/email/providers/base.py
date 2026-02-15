from abc import ABC, abstractmethod

class BaseEmailProvider(ABC):

    @abstractmethod
    def send_email(self, to: str, subject: str, html: str):
        pass
