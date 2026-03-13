# ⏱ ShiftTrack — Store Time Management

A beautiful, modern employee time tracking web app — built to replace paper time cards with a clean digital experience.

## ✨ Features

- **Clock In / Clock Out** — One click to start and end a shift
- **Multiple Employees** — Add any number of staff, switch between them
- **Weekly Summary** — Visual bar chart of hours per day
- **Shift Log** — Full history table with filtering by employee
- **Analytics Dashboard** — Earliest open, latest close, longest shift, averages
- **CSV Export** — Download all records for payroll
- **Persistent Storage** — Data saved in browser localStorage (no server needed)
- **Fully Responsive** — Works on mobile and desktop

## 🚀 How to Run Locally (Beginner Guide for Mac)

### Step 1 — Install VS Code
Download from: https://code.visualstudio.com

### Step 2 — Open the project in VS Code
```bash
# Open Terminal (Command + Space, type Terminal, press Enter)
cd ~/Downloads/timetracker   # navigate to the folder
code .                        # open in VS Code
```

### Step 3 — Install Live Server extension in VS Code
- Press `Cmd + Shift + X` to open Extensions
- Search: `Live Server`
- Click Install (by Ritwick Dey)

### Step 4 — Run the app
- Right-click `index.html` in VS Code
- Click **"Open with Live Server"**
- Your browser opens at `http://127.0.0.1:5500`

## 📁 File & Folder Structure

```
timetracker/
├── index.html          ← Main page (structure)
├── css/
│   └── style.css       ← All styling
├── js/
│   └── app.js          ← All logic
└── README.md           ← This file
```

## 🌐 Deploy to GitHub Pages (Free Hosting)

### Step 1 — Create a GitHub account
Go to https://github.com and sign up

### Step 2 — Install Git on Mac
```bash
xcode-select --install
```

### Step 3 — Initialize and push the project
```bash
cd ~/Downloads/timetracker
git init
git add .
git commit -m "Initial commit: ShiftTrack app"
```

### Step 4 — Create repo on GitHub
- Go to https://github.com/new
- Name it: `shifttrack`
- Do NOT check "Initialize with README"
- Click Create Repository

### Step 5 — Push your code
```bash
git remote add origin https://github.com/YOUR_USERNAME/shifttrack.git
git branch -M main
git push -u origin main
```

### Step 6 — Enable GitHub Pages
- Go to your repo → Settings → Pages
- Source: Deploy from branch → `main` → `/ (root)`
- Click Save
- Your site will be live at: `https://YOUR_USERNAME.github.io/shifttrack`

## 📱 Usage Guide

1. **Add an employee** — Type name in the box and click `+ Add`
2. **Select the employee** — Click their name chip
3. **Clock In** — Press the green `Clock In` button when shift starts
4. **Clock Out** — Press the red `Clock Out` button when shift ends
5. **View analytics** — Scroll down to see trends and insights
6. **Export records** — Click `⬇ Export CSV` for payroll

## 🛠 Tech Stack
- HTML5, CSS3, Vanilla JavaScript
- Google Fonts (Syne + DM Mono)
- localStorage (no backend needed)
