# GitHub Setup - Step by Step

## IMPORTANT: You must create the repository on GitHub FIRST!

### Step 1: Create Repository on GitHub

1. Open your browser and go to: **https://github.com/new**
2. Fill in:
   - **Repository name**: `village-water-accountant`
   - **Description**: "Smart agricultural tool for Maharashtra farmers"
   - **Public** or **Private**: Your choice
   - ❌ **DO NOT** check "Add a README file" (we already have one)
   - ❌ **DO NOT** check "Add .gitignore" (we already have one)
3. Click **"Create repository"**

### Step 2: Note Your GitHub Username

After creating the repo, GitHub will show commands. Look for your username in the URL:
```
https://github.com/YOUR_ACTUAL_USERNAME/village-water-accountant
```

For example, if your username is `hetbhanushali`, the URL would be:
```
https://github.com/hetbhanushali/village-water-accountant
```

### Step 3: Push Your Code

**Replace `YOUR_ACTUAL_USERNAME` with your real GitHub username:**

```bash
cd "C:\Users\HET\ANTIGRAVITY PROJECT\water-accountant"

# Initialize Git (if not done yet)
git init
git add .
git commit -m "Initial commit: Village Water Accountant"

# Connect to YOUR repository (REPLACE hetbhanushali with YOUR username!)
git remote add origin https://github.com/hetbhanushali/village-water-accountant.git
git branch -M main
git push -u origin main
```

### Step 4: Enter Credentials

When prompted:
- **Username**: Your GitHub username
- **Password**: Use a **Personal Access Token** (not your GitHub password)

**To create a token:**
1. Go to: https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Select `repo` scope
4. Copy the token and use it as password

### Done! 🎉

After pushing, visit:
```
https://github.com/YOUR_USERNAME/village-water-accountant
```

You should see all your code there!

---

## Quick Reference

**What username to use?**
- Check your GitHub profile: https://github.com/[YOUR_USERNAME]
- Or look at the top-right corner when logged into GitHub

**Common Error:**
```
repository 'https://github.com/YOUR_USERNAME/...' not found
```
= You forgot to create the repository on GitHub first OR didn't replace YOUR_USERNAME
