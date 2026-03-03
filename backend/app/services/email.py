"""
Email service — async background email via SendGrid.
Falls back to logging in development mode.
"""

import asyncio
import logging
from datetime import datetime

from app.core.config import settings

logger = logging.getLogger(__name__)


async def send_booking_confirmation(
    booking_id: int,
    organizer_email: str,
    room_name: str,
    title: str,
    start_time: datetime,
    end_time: datetime,
):
    """Send booking confirmation email."""
    if not settings.SENDGRID_API_KEY:
        logger.info(
            f"[EMAIL STUB] Booking #{booking_id} confirmed → "
            f"{organizer_email} | {room_name} | {title} | "
            f"{start_time.isoformat()} - {end_time.isoformat()}"
        )
        return

    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail

        message = Mail(
            from_email=settings.FROM_EMAIL,
            to_emails=organizer_email,
            subject=f"Booking Confirmed: {title}",
            html_content=f"""
            <h2>Booking Confirmed</h2>
            <p><strong>Room:</strong> {room_name}</p>
            <p><strong>Title:</strong> {title}</p>
            <p><strong>When:</strong> {start_time.strftime('%B %d, %Y %I:%M %p')} –
               {end_time.strftime('%I:%M %p')}</p>
            <p><strong>Booking ID:</strong> #{booking_id}</p>
            <hr>
            <p><em>RoomBook — Enterprise Room Booking System</em></p>
            """,
        )

        sg = SendGridAPIClient(settings.SENDGRID_API_KEY)
        # Run synchronous SendGrid call in a thread to avoid blocking the event loop
        await asyncio.to_thread(sg.send, message)
        logger.info(f"Confirmation email sent for booking #{booking_id}")

    except Exception as e:
        logger.error(f"Failed to send email for booking #{booking_id}: {e}")


async def send_booking_cancellation(
    booking_id: int,
    organizer_email: str,
    room_name: str,
    title: str,
):
    """Send booking cancellation email."""
    if not settings.SENDGRID_API_KEY:
        logger.info(
            f"[EMAIL STUB] Booking #{booking_id} cancelled → {organizer_email}"
        )
        return

    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail

        message = Mail(
            from_email=settings.FROM_EMAIL,
            to_emails=organizer_email,
            subject=f"Booking Cancelled: {title}",
            html_content=f"""
            <h2>Booking Cancelled</h2>
            <p><strong>Room:</strong> {room_name}</p>
            <p><strong>Title:</strong> {title}</p>
            <p><strong>Booking ID:</strong> #{booking_id}</p>
            <hr>
            <p><em>RoomBook — Enterprise Room Booking System</em></p>
            """,
        )

        sg = SendGridAPIClient(settings.SENDGRID_API_KEY)
        await asyncio.to_thread(sg.send, message)
        logger.info(f"Cancellation email sent for booking #{booking_id}")

    except Exception as e:
        logger.error(f"Failed to send cancellation email for booking #{booking_id}: {e}")
