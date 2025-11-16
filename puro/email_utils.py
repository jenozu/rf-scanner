"""
Email utility for sending shipping labels
"""

import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from pathlib import Path
from typing import Optional, List
from dotenv import load_dotenv

load_dotenv()


class EmailSender:
    """Simple email sender for shipping labels"""
    
    def __init__(self):
        """Initialize email configuration from environment"""
        self.smtp_server = os.getenv('EMAIL_SMTP_SERVER', 'smtp.gmail.com')
        self.smtp_port = int(os.getenv('EMAIL_SMTP_PORT', '587'))
        self.email_from = os.getenv('EMAIL_FROM')
        self.email_password = os.getenv('EMAIL_PASSWORD')
        self.email_to = os.getenv('EMAIL_TO', 'recipient@example.com')
        
        # Check if email is configured
        self.is_configured = bool(self.email_from and self.email_password)
    
    def send_label_email(self, label_filepath: str, shipment_pin: str, 
                        reference: str = None, recipient_email: str = None) -> bool:
        """
        Send shipping label PDF via email
        
        Args:
            label_filepath: Path to the PDF label file
            shipment_pin: Purolator tracking PIN
            reference: Order reference number
            recipient_email: Optional override for recipient email
            
        Returns:
            True if email sent successfully, False otherwise
        """
        if not self.is_configured:
            print("⚠ Email not configured. Set EMAIL_FROM and EMAIL_PASSWORD in .env")
            return False
        
        if not Path(label_filepath).exists():
            print(f"⚠ Label file not found: {label_filepath}")
            return False
        
        try:
            # Create message
            msg = MIMEMultipart()
            msg['From'] = self.email_from
            msg['To'] = recipient_email or self.email_to
            msg['Subject'] = f"Purolator Shipping Label - {shipment_pin}"
            
            # Email body
            body = f"""
Purolator Shipping Label

Tracking PIN: {shipment_pin}
Reference: {reference or 'N/A'}

Label PDF attached.

This is an automated email from the RF Scanner Shipping System.
"""
            msg.attach(MIMEText(body, 'plain'))
            
            # Attach PDF
            with open(label_filepath, 'rb') as attachment:
                part = MIMEBase('application', 'octet-stream')
                part.set_payload(attachment.read())
            
            encoders.encode_base64(part)
            
            filename = Path(label_filepath).name
            part.add_header(
                'Content-Disposition',
                f'attachment; filename= {filename}'
            )
            
            msg.attach(part)
            
            # Send email
            server = smtplib.SMTP(self.smtp_server, self.smtp_port)
            server.starttls()
            server.login(self.email_from, self.email_password)
            text = msg.as_string()
            server.sendmail(self.email_from, recipient_email or self.email_to, text)
            server.quit()
            
            print(f"✓ Label emailed to {recipient_email or self.email_to}")
            return True
            
        except Exception as e:
            print(f"✗ Error sending email: {str(e)}")
            return False
    
    def send_batch_labels_email(self, label_filepaths: List[str], 
                                shipment_info: List[dict] = None) -> bool:
        """
        Send multiple labels in one email
        
        Args:
            label_filepaths: List of PDF label file paths
            shipment_info: Optional list of dicts with shipment_pin and reference
            
        Returns:
            True if email sent successfully
        """
        if not self.is_configured:
            print("⚠ Email not configured. Set EMAIL_FROM and EMAIL_PASSWORD in .env")
            return False
        
        if not label_filepaths:
            return False
        
        try:
            # Create message
            msg = MIMEMultipart()
            msg['From'] = self.email_from
            msg['To'] = self.email_to
            msg['Subject'] = f"Purolator Shipping Labels - {len(label_filepaths)} Shipment(s)"
            
            # Email body
            if shipment_info:
                info_text = "\n".join([
                    f"  - PIN: {info.get('shipment_pin', 'N/A')}, Ref: {info.get('reference', 'N/A')}"
                    for info in shipment_info
                ])
            else:
                info_text = f"{len(label_filepaths)} shipment(s)"
            
            body = f"""
Purolator Shipping Labels - Batch

Shipments:
{info_text}

Label PDFs attached.

This is an automated email from the RF Scanner Shipping System.
"""
            msg.attach(MIMEText(body, 'plain'))
            
            # Attach all PDFs
            for label_filepath in label_filepaths:
                if not Path(label_filepath).exists():
                    continue
                
                with open(label_filepath, 'rb') as attachment:
                    part = MIMEBase('application', 'octet-stream')
                    part.set_payload(attachment.read())
                
                encoders.encode_base64(part)
                
                filename = Path(label_filepath).name
                part.add_header(
                    'Content-Disposition',
                    f'attachment; filename= {filename}'
                )
                
                msg.attach(part)
            
            # Send email
            server = smtplib.SMTP(self.smtp_server, self.smtp_port)
            server.starttls()
            server.login(self.email_from, self.email_password)
            text = msg.as_string()
            server.sendmail(self.email_from, self.email_to, text)
            server.quit()
            
            print(f"✓ {len(label_filepaths)} label(s) emailed to {self.email_to}")
            return True
            
        except Exception as e:
            print(f"✗ Error sending batch email: {str(e)}")
            return False


# Convenience function
def send_label_email(label_filepath: str, shipment_pin: str, 
                    reference: str = None, recipient_email: str = None) -> bool:
    """
    Quick function to send a label email
    
    Args:
        label_filepath: Path to PDF label
        shipment_pin: Tracking PIN
        reference: Order reference
        recipient_email: Optional recipient override
        
    Returns:
        True if sent successfully
    """
    sender = EmailSender()
    return sender.send_label_email(label_filepath, shipment_pin, reference, recipient_email)


if __name__ == '__main__':
    # Test email configuration
    sender = EmailSender()
    
    if sender.is_configured:
        print("✓ Email configuration found")
        print(f"  From: {sender.email_from}")
        print(f"  To: {sender.email_to}")
        print(f"  SMTP: {sender.smtp_server}:{sender.smtp_port}")
    else:
        print("⚠ Email not configured")
        print("\nAdd to .env file:")
        print("  EMAIL_FROM=your-email@gmail.com")
        print("  EMAIL_PASSWORD=your-app-password")
        print("  EMAIL_TO=recipient@example.com")
        print("  EMAIL_SMTP_SERVER=smtp.gmail.com")
        print("  EMAIL_SMTP_PORT=587")

