"""
Dev-friendly email sender.

By default this just logs the reset link to the console so you can develop
without configuring SMTP. Swap the body of send_reset_email() for a real
provider (SMTP, SendGrid, SES, Postmark, etc.) when you're ready to go live.
"""

import logging

logger = logging.getLogger("rootline.email")
logging.basicConfig(level=logging.INFO)


def send_reset_email(to_email: str, reset_link: str) -> None:
    logger.info(
        "\n"
        "──────────────────────────────────────────────\n"
        f"Password reset requested for: {to_email}\n"
        f"Reset link (valid for a limited time):\n{reset_link}\n"
        "──────────────────────────────────────────────"
    )
