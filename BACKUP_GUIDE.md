# Backup & Version Control Guide

## Current Status

✅ **Git repository initialized**  
✅ **All Phase 1 changes committed**  
✅ **Tagged as: v1.0-phase1**

## How to View Your Backup History

### See all commits:
```powershell
git log --oneline
```

### See what changed in Phase 1:
```powershell
git show v1.0-phase1
```

### See differences between versions:
```powershell
git diff HEAD~1  # Compare with previous commit
```

## How to Revert Back to This Version

If you make changes later and want to go back to the Phase 1 state:

### Option 1: Reset to this commit (discards changes)
```powershell
git reset --hard v1.0-phase1
```
⚠️ **Warning:** This will delete any uncommitted changes!

### Option 2: Create a new branch from this point
```powershell
git checkout -b revert-to-phase1 v1.0-phase1
```
This creates a new branch without affecting your current work.

### Option 3: View files from this version (read-only)
```powershell
git show v1.0-phase1:src/pages/receive-page.tsx
```

## Manual Backup Copy (Alternative)

If you prefer a physical copy instead of Git:

### PowerShell Script:
```powershell
# Navigate to parent directory
cd "C:\Users\andel\Desktop\Marind"

# Create backup with timestamp
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
Copy-Item -Path "rf scanner" -Destination "rf scanner-backup-$timestamp" -Recurse

# Example result: rf scanner-backup-20251029-200000
```

### Manual Steps:
1. Navigate to `C:\Users\andel\Desktop\Marind`
2. Right-click `rf scanner` folder
3. Copy (Ctrl+C)
4. Paste (Ctrl+V)
5. Rename to `rf scanner-backup-[date]`

## Creating a Backup Before Future Changes

Before making major changes, create a backup commit:

```powershell
# Stage all changes
git add -A

# Commit with descriptive message
git commit -m "Description of your changes"

# Optionally tag important versions
git tag -a v1.1-new-feature -m "Description"
```

## Quick Commands Reference

| Command | Purpose |
|---------|---------|
| `git status` | See what files changed |
| `git log` | View commit history |
| `git diff` | See what changed |
| `git reset --hard v1.0-phase1` | Revert to Phase 1 |
| `git tag -l` | List all tags |
| `git checkout v1.0-phase1` | View Phase 1 files (detached HEAD) |

## Best Practices

1. **Commit often**: Make small, frequent commits with clear messages
2. **Tag milestones**: Use tags for important versions (v1.0, v2.0, etc.)
3. **Create branches**: Use branches for experimental features
4. **Never commit sensitive data**: Keep API keys, passwords out of Git

## Current Git State

- **Latest commit**: Phase 1 Implementation
- **Tag**: v1.0-phase1
- **Files changed**: 11 files, 852 insertions
- **New files**: config.ts, enhanced types, receive-page updates

## Need Help?

- `git help <command>` - Get help for any Git command
- `git log --oneline --graph --all` - Visual history
- `git status` - Always check status before reverting

---

**Last Updated**: 2025-10-29  
**Current Version**: v1.0-phase1 (Phase 1 Implementation)

