# 🔒 Security Remediation Guide - Exposed Credentials

## ⚠️ CRITICAL: Exposed Credentials

GitGuardian has detected that the following credentials were exposed in your Git repository:

### Exposed Information:
- **Purolator API Username**: `[REDACTED_IN_REPO]`
- **Purolator API Password**: `[REDACTED_IN_REPO]`
- **Purolator API Account**: `[REDACTED_IN_REPO]`
- **Email Address**: `[REDACTED_IN_REPO]`
- **Email Recipient**: `[REDACTED_IN_REPO]`

---

## ✅ What Has Been Fixed

I have removed all hardcoded credentials from the following files:
1. `puro\env_template.txt`
2. `puro\00_START_HERE.txt`
3. `NEXT_STEPS.md`
4. `puro\EMAIL_SETUP.md`
5. `puro\ADDRESS_BOOK_GUIDE.md`
6. `puro\ADDRESS_BOOK_README.md`
7. `puro\IMPLEMENTATION_COMPLETE.md`
8. `puro\README.md`
9. `puro\FILES_FOR_RF_INTEGRATION.md`
10. `puro\INTEGRATION_GUIDE.md`
11. `puro\RF_INTEGRATION_SUMMARY.md`
12. `SETUP_AND_TESTING.md`
13. `SHIPPING_API_DOCUMENTATION.md`
14. `DEPLOY_SHIPPING.md`
15. `src\pages\shipping-page.tsx`
16. `puro\email_utils.py`

All credentials have been replaced with placeholder values like:
- `your_purolator_username`
- `your_purolator_password`
- `your_account_number`
- `your-email@gmail.com`
- `recipient@example.com`

---

## 🚨 URGENT: What You MUST Do Now

### Step 1: Rotate Your Credentials (HIGHEST PRIORITY)

Since these credentials were committed to Git, they should be considered compromised.

#### A. Purolator API Credentials
1. **Contact Purolator immediately**
   - Call your Purolator account representative
   - Request a password reset for the previously exposed API username
   - If possible, request new API credentials entirely

2. **Verify account activity**
   - Ask Purolator if there has been any unauthorized API usage
   - Review recent shipments for anything suspicious

#### B. Gmail/Email Credentials
1. **Change your Gmail App Password**
   - Go to https://myaccount.google.com/apppasswords
   - Revoke the app password that was exposed
   - Generate a new 16-character app password
   - Update your `.env` file with the new password

2. **Enable 2FA if not already enabled**
   - Go to https://myaccount.google.com/security
   - Enable 2-Step Verification

3. **Review Gmail account activity**
   - Check https://myaccount.google.com/security-checkup
   - Look for any suspicious logins or activity

### Step 2: Update Your Local Environment

After getting new credentials:

1. Create a `.env` file in your project root (if it doesn't exist)
2. Add your NEW credentials:

```env
# Purolator API Credentials (NEW - after rotation)
PUROLATOR_API_USERNAME=your_new_username
PUROLATOR_API_PASSWORD=your_new_password
PUROLATOR_API_ACCOUNT=your_account_number

# Email Configuration (NEW - after rotation)
EMAIL_FROM=your-email@gmail.com
EMAIL_PASSWORD=your_new_16_char_app_password
EMAIL_TO=recipient@example.com
EMAIL_SMTP_SERVER=smtp.gmail.com
EMAIL_SMTP_PORT=587
```

3. Verify `.env` is in `.gitignore` (✅ already done)

### Step 3: Clean Git History

Even though the credentials are removed from the current files, they still exist in Git history.

#### Option A: If Repository is Private and Not Shared
```powershell
# Navigate to your project
cd "C:\Users\andel\Desktop\Marind\rf scanner"

# Create a backup first
git branch backup-before-cleanup

# Use BFG Repo Cleaner (recommended)
# Download from: https://rtyley.github.io/bfg-repo-cleaner/

# Create a file with exposed credentials
echo "your_old_username_here" > credentials.txt
echo "your_old_password_here" >> credentials.txt
echo "your_old_email_here" >> credentials.txt

# Run BFG to remove credentials from history
java -jar bfg.jar --replace-text credentials.txt

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push (ONLY if you're the only user or have coordinated with your team)
# git push --force --all
```

#### Option B: Nuclear Option (If Repository is Private)
```powershell
# Start fresh with a new repository
cd ..
mv "rf scanner" "rf scanner-old"
mkdir "rf scanner"
cd "rf scanner"
git init

# Copy all files EXCEPT .git directory
Copy-Item -Path "..\rf scanner-old\*" -Destination "." -Recurse -Exclude ".git"

# Make first commit with clean history
git add .
git commit -m "Initial commit with sanitized credentials"

# If pushing to remote, use a new repository or force push
# git remote add origin <your-repo-url>
# git push -u origin main --force
```

### Step 4: Verify the Fix

1. **Check current files**:
```powershell
# Search for any remaining credentials
git grep "your_old_username_here"
git grep "your_old_password_here"
git grep "your_old_email_here"
```

Should return NO results.

2. **Check Git history** (if you cleaned it):
```powershell
git log --all --full-history --source --find-object=<hash>
```

3. **Verify .env is ignored**:
```powershell
git status
# .env should NOT appear in untracked files if it exists
```

---

## 📋 Best Practices Going Forward

### 1. Never Commit Credentials
- ✅ Always use `.env` files for secrets
- ✅ Keep `.env` in `.gitignore` (already configured)
- ✅ Use `env_template.txt` with placeholder values only

### 2. Use Secret Scanning
```powershell
# Install git-secrets (prevents committing secrets)
# Download from: https://github.com/awslabs/git-secrets

git secrets --install
git secrets --register-aws
```

### 3. Regular Security Audits
- Review what files are committed before pushing
- Use `git diff --cached` before committing
- Enable GitGuardian for continuous monitoring

### 4. Credential Rotation Schedule
- Rotate API credentials every 90 days
- Use different credentials for dev/staging/production
- Document when credentials were last rotated

---

## 🔍 GitGuardian Alert Response

When you receive a GitGuardian alert:

1. **Acknowledge the alert** in GitGuardian dashboard
2. **Follow this remediation guide**
3. **Mark as resolved** only after:
   - ✅ Credentials rotated
   - ✅ Files cleaned
   - ✅ Git history cleaned (if needed)
   - ✅ Verified no unauthorized access

---

## 📞 Need Help?

### Purolator API Support
- Contact your account representative
- Explain: "API credentials may have been exposed, need to rotate"
- Request new credentials if possible

### Gmail Support
- Help Center: https://support.google.com/accounts
- Security Help: https://support.google.com/accounts/answer/6294825

---

## ✅ Remediation Checklist

- [ ] Contacted Purolator to rotate API credentials
- [ ] Changed Gmail App Password
- [ ] Updated local `.env` with new credentials
- [ ] Tested application with new credentials
- [ ] Cleaned Git history (if applicable)
- [ ] Verified no credentials in current files
- [ ] Reviewed account activity for suspicious behavior
- [ ] Marked GitGuardian alert as resolved
- [ ] Set calendar reminder to rotate credentials in 90 days

---

## 🎯 Summary

**What happened**: API and email credentials were committed to Git and detected by GitGuardian.

**Immediate risk**: Exposed credentials could be used to:
- Create unauthorized Purolator shipments (costs money!)
- Send emails from your account
- Access sensitive shipping/customer data

**What's been done**: All hardcoded credentials removed from 16+ files.

**What you must do**: 
1. Rotate credentials (contact Purolator + reset Gmail app password)
2. Clean Git history
3. Implement better secrets management

---

*This guide was generated in response to GitGuardian security alert for exposed SMTP/API credentials.*

