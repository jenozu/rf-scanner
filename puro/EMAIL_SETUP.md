# Email Setup Guide - Auto-Send Shipping Labels

## Overview
The shipping system can automatically email PDF labels to `aobryan@marind.ca` (or any email address you configure) when shipments are created.

---

## Quick Setup

### Step 1: Add Email Settings to .env File

Open the `.env` file in the `puro` folder and add these lines:

```env
# Email Configuration for Auto-Sending Labels
EMAIL_FROM=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_TO=aobryan@marind.ca
EMAIL_SMTP_SERVER=smtp.gmail.com
EMAIL_SMTP_PORT=587
```

### Step 2: Get Gmail App Password (If Using Gmail)

If you're using Gmail, you need to create an "App Password":

1. Go to your Google Account settings
2. Click "Security"
3. Enable "2-Step Verification" (if not already enabled)
4. Scroll down to "App passwords"
5. Create a new app password for "Mail"
6. Copy the 16-character password
7. Use this as your `EMAIL_PASSWORD` in .env

**Note**: Regular Gmail password won't work - you must use an App Password.

### Step 3: For Other Email Providers

If you're not using Gmail, update the SMTP settings:

**Outlook/Hotmail**:
```env
EMAIL_SMTP_SERVER=smtp-mail.outlook.com
EMAIL_SMTP_PORT=587
```

**Office 365**:
```env
EMAIL_SMTP_SERVER=smtp.office365.com
EMAIL_SMTP_PORT=587
```

**Custom SMTP**:
```env
EMAIL_SMTP_SERVER=your-smtp-server.com
EMAIL_SMTP_PORT=587
```

---

## Complete .env Example

Here's what your complete `.env` file should look like:

```env
# Purolator API Credentials
PUROLATOR_API_USERNAME=714d0583f90941ada8d2175bdc4452bb
PUROLATOR_API_PASSWORD=6qDJZ0Ph
PUROLATOR_API_ACCOUNT=7254525

# Email Configuration (for auto-sending labels)
EMAIL_FROM=your-email@gmail.com
EMAIL_PASSWORD=your-16-char-app-password
EMAIL_TO=aobryan@marind.ca
EMAIL_SMTP_SERVER=smtp.gmail.com
EMAIL_SMTP_PORT=587

# Default Sender Information (Optional)
DEFAULT_SENDER_NAME=Your Warehouse Name
DEFAULT_SENDER_STREET=123 Warehouse Street
DEFAULT_SENDER_CITY=Toronto
DEFAULT_SENDER_PROVINCE=ON
DEFAULT_SENDER_POSTAL=M5J2R8
DEFAULT_SENDER_PHONE=416-555-1234
```

---

## How It Works

### Automatic Email Sending

When you create a shipment:

1. **Shipment is created** with Purolator
2. **Label PDF is downloaded** and saved locally
3. **Email is automatically sent** with the PDF attached
4. **Email goes to** `aobryan@marind.ca` (or EMAIL_TO setting)

### Email Content

Each email contains:
- **Subject**: "Purolator Shipping Label - [Tracking PIN]"
- **Body**: Tracking PIN and reference number
- **Attachment**: The PDF shipping label

### Batch Processing

When processing multiple shipments:
- Each shipment gets its own email (one label per email)
- Each email is sent immediately after the label is created

---

## Testing Email Configuration

### Test 1: Check Configuration

Run this command to verify email settings:

```bash
cd "C:\Users\andel\Desktop\Marind\rf scanner\puro"
python email_utils.py
```

You should see:
```
✓ Email configuration found
  From: your-email@gmail.com
  To: aobryan@marind.ca
  SMTP: smtp.gmail.com:587
```

### Test 2: Create a Test Shipment

1. Open Batch Shipping App:
   ```bash
   python batch_shipping_app.py
   ```

2. Create a test shipment (use your own address for testing)

3. Check the console output - you should see:
   ```
   ✓ Label emailed to aobryan@marind.ca
   ```

4. Check `aobryan@marind.ca` inbox for the email

---

## Troubleshooting

### Problem: "Email not configured"

**Solution**: 
- Check `.env` file exists in `puro` folder
- Verify `EMAIL_FROM` and `EMAIL_PASSWORD` are set
- Restart the Batch Shipping App after changing .env

### Problem: "Authentication failed" error

**Solution**:
- If using Gmail, make sure you're using an **App Password**, not your regular password
- Verify 2-Step Verification is enabled on your Google account
- Check that the email and password are correct

### Problem: "SMTP connection failed"

**Solution**:
- Check your internet connection
- Verify SMTP server and port are correct
- Some networks block SMTP - try a different network
- Check firewall settings

### Problem: "Email sent but not received"

**Solution**:
- Check spam/junk folder
- Verify EMAIL_TO address is correct
- Check email server logs (if available)
- Try sending to a different email address to test

### Problem: "Email works but labels are missing"

**Solution**:
- Check that labels are being created in the `labels` folder
- Verify the label file path is correct
- Check file permissions

---

## Security Notes

### App Passwords (Gmail)

- App passwords are more secure than regular passwords
- Each app gets its own password
- You can revoke an app password without changing your main password
- Never share your app password

### .env File Security

- Never commit `.env` file to version control (git)
- Keep `.env` file secure and private
- Don't share credentials with unauthorized people

### Email Best Practices

- Use a dedicated email account for automated emails
- Consider using a service account or alias
- Monitor sent emails regularly
- Set up email forwarding if needed

---

## Customization

### Change Recipient Email

Edit `.env`:
```env
EMAIL_TO=another-email@example.com
```

### Send to Multiple Recipients

Edit `email_utils.py` to add multiple recipients, or use a distribution list email address.

### Customize Email Subject/Body

Edit the `send_label_email` method in `email_utils.py` to customize the email content.

---

## Advanced: Batch Email Mode

For batch processing, you can also send all labels in one email:

```python
from email_utils import EmailSender

sender = EmailSender()
sender.send_batch_labels_email(
    ['label1.pdf', 'label2.pdf', 'label3.pdf'],
    shipment_info=[
        {'shipment_pin': '123456', 'reference': 'ORD-001'},
        {'shipment_pin': '789012', 'reference': 'ORD-002'},
    ]
)
```

---

## Summary

**Setup Steps**:
1. ✅ Add email settings to `.env` file
2. ✅ Get Gmail App Password (if using Gmail)
3. ✅ Test with a single shipment
4. ✅ Verify email received at `aobryan@marind.ca`

**How It Works**:
- Automatic - no manual steps needed
- Each shipment triggers one email
- PDF label attached automatically
- Works with batch processing

**Default Behavior**:
- Labels are saved locally (in `labels` folder)
- Labels are also emailed automatically
- Both happen simultaneously

---

## Quick Reference

**File**: `puro/email_utils.py` - Email functionality  
**File**: `puro/.env` - Configuration  
**Test**: `python email_utils.py` - Check configuration  

**Required Settings**:
- `EMAIL_FROM` - Your email address
- `EMAIL_PASSWORD` - App password (Gmail) or regular password
- `EMAIL_TO` - Recipient (aobryan@marind.ca)
- `EMAIL_SMTP_SERVER` - SMTP server (smtp.gmail.com for Gmail)
- `EMAIL_SMTP_PORT` - Port (587 for most)

---

**Need Help?** Check the troubleshooting section above or test with `python email_utils.py`

