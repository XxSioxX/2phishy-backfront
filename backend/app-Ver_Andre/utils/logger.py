import logging
import colorlog
import os


# Get the current folder and filename dynamically
def get_log_prefix():
    frame = logging.currentframe().f_back.f_back
    filename = os.path.basename(frame.f_code.co_filename)
    foldername = os.path.basename(os.path.dirname(frame.f_code.co_filename))
    return f"{foldername}/{filename}"


# Custom log format: <hh:mm:ss - foldername/filename - loglevel - message>
LOG_FORMAT = "%(log_color)s[%(asctime)s - %(prefix)s - %(levelname)s]%(reset)s %(message)s"


# Create a custom formatter
class CustomFormatter(colorlog.ColoredFormatter):
    def format(self, record):
        record.prefix = get_log_prefix()  # Inject dynamic log prefix
        return super().format(record)


# Setup Logger
def get_logger(name="app_logger"):
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)

    # Colored formatter
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

    # Console handler
    handler = logging.StreamHandler()
    handler.setFormatter(formatter)

    # Avoid duplicate handlers
    if not logger.hasHandlers():
        logger.addHandler(handler)

    return logger
