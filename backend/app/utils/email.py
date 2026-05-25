import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.config import settings

def send_verification_email(email: str, token: str, name: str):
    verification_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: linear-gradient(135deg, #0a192f, #020c1b); padding: 20px; text-align: center; }}
            .header h1 {{ color: #2dd4bf; }}
            .button {{ display: inline-block; padding: 12px 24px; background: #2dd4bf; color: white; text-decoration: none; border-radius: 6px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header"><h1>🛡️ AegisPhish</h1></div>
            <div class="content">
                <h2>Welcome, {name}!</h2>
                <p>Please verify your email address:</p>
                <a href="{verification_url}" class="button">Verify Email</a>
                <p>Or copy: {verification_url}</p>
                <p>This link expires in 24 hours.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    msg = MIMEMultipart()
    msg["Subject"] = "Verify Your AegisPhish Account"
    msg["From"] = settings.SMTP_USER
    msg["To"] = email
    msg.attach(MIMEText(html, "html"))
    
    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
        return True
    except Exception as e:
        print(f"Email error: {e}")
        return False