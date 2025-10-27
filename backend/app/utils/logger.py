import logging
import colorlog
import os

# Custom log format: <hh:mm:ss - module.py - level - message>
LOG_FORMAT = "%(log_color)s[%(asctime)s - %(module)s.py - %(levelname)s]%(reset)s %(message)s"

class CustomFormatter(colorlog.ColoredFormatter):
    def format(self, record):
        # Optional: shorten pathname (if you want full path)
        # record.pathname = os.path.relpath(record.pathname)
        return super().format(record)

def get_logger(name=None):
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)

    formatter = CustomFormatter(
        LOG_FORMAT,
        datefmt="%H:%M:%S",
        log_colors={
            "DEBUG": "cyan",
            "INFO": "green",
            "WARNING": "yellow",
            "ERROR": "red",
            "CRITICAL": "bold_red",
        },
    )

    handler = logging.StreamHandler()
    handler.setFormatter(formatter)

    if not logger.hasHandlers():
        logger.addHandler(handler)

    return logger
