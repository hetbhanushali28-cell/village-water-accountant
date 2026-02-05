# How to Push to GitHub

## Step 1: Initialize Git Repository

Open terminal in the `water-accountant` folder and run:

```bash
git init
git add .
git commit -m "Initial commit: Village Water Accountant with Maharashtra location DB"
```

## Step 2: Create GitHub Repository

1. Go to https://github.com
2. Click "New repository" (green button)
3. Name it: `village-water-accountant`
4. **DO NOT** check "Initialize with README" (we already have one)
5. Click "Create repository"

## Step 3: Connect and Push

GitHub will show you commands like this (replace `YOUR_USERNAME`):

```bash
git remote add origin https://github.com/YOUR_USERNAME/village-water-accountant.git
git branch -M main
git push -u origin main
```

## Step 4: Verify

Visit your GitHub repository URL to see your code!

## Future Updates

After making changes, push with:
```bash
git add .
git commit -m "Description of changes"
git push
```

---

**Note:** The `.gitignore` file will automatically exclude:
- `node_modules/` (frontend dependencies)
- `venv/` (Python virtual environment)
- Build files
- IDE settings
