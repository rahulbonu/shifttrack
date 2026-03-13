# ⏱ ShiftTrack — Store Time Management

A modern, real-time employee shift tracking web application built for multi-store retail operations. ShiftTrack replaces paper time cards with a clean digital experience — accessible from any device, with data synced live via Firebase.

🌐 **Live App:** [rahulbonu.github.io/shifttrack](https://rahulbonu.github.io/shifttrack/)

---

## 📸 Screenshots

### Login Screen
![Login Screen](screenshots/01-login.png)
> Dual-role login — employees use their name + access code, managers use a secure manager code.

### Employee Login
![Employee Login](screenshots/02-employee-login.png)
> Employees enter their name and access code assigned by the manager.

### Manager Dashboard
![Manager Dashboard](screenshots/03-manager-dashboard.png)
> Manager view showing Employee Management panel, weekly calendar, stats, and shift log.

### Shift Log
![Shift Log](screenshots/04-shift-log.png)
> Full shift history sorted by date (newest first), with active shifts pinned at top. Managers can filter by store or employee, add shifts, edit clock-in/out times, and delete entries.

### Manager Analytics — KPIs
![Manager Analytics](screenshots/05-manager-analytics.png)
> Live analytics showing Hours by Employee, Top Performer, Active Now, and On-Time Openings.

### Manager Analytics — Store Breakdown & Payroll
![Manager Analytics Lower](screenshots/06-manager-analytics-lower.png)
> Hours by Store progress bars, OT Watch panel, Store Opening Status grid, and Payroll table for current week.

### Payroll — Week Navigation
![Payroll Navigation](screenshots/07-payroll-navigation.png)
> Navigate to previous weeks directly from the Payroll section to review historical pay data.

### Employee Dashboard
![Employee Dashboard](screenshots/08-employee-dashboard.png)
> Employee view with Clock In / Clock Out buttons, live duration counter, and personal shift log.

### Employee Analytics
![Employee Analytics](screenshots/09-employee-analytics.png)
> Personalized analytics: estimated earnings, hours this week vs last week, work streak, avg clock-in time, day-by-day bar chart, and all-time records.

### Calendar Week Picker
![Calendar Picker](screenshots/10-calendar-picker.png)
> Click the 📅 icon to open a full month calendar — click any date to jump directly to that week.

---

## ✨ Features

### 👔 Manager Features
- **Employee Management** — Add employees with name, access code, and hourly rate
- **Shift Log** — Full history of all shifts across all stores, sorted by date
- **Add / Edit Shifts** — Manually add shifts or edit clock-in/clock-out times for any employee
- **Force-Complete Active Shifts** — Fix forgotten clock-outs directly from the log
- **Week Navigation** — Navigate backward through any previous week using `←` arrows or the 📅 calendar picker
- **Manager Analytics (Live)**
  - **Hours by Employee** — Visual bar comparison of each employee's weekly hours with per-store breakdown
  - **Top Performer** — Employee with the most hours this week
  - **Active Now** — Real-time count of employees currently clocked in
  - **On-Time Openings** — Tracks which stores opened on time each day (9 AM ± 15 min grace)
  - **Hours by Store** — Progress bars showing total hours logged per store
  - **OT Watch** — Flags employees approaching or exceeding the overtime threshold
  - **Store Opening Status Grid** — 7-day × 3-store matrix showing ✓ on-time, ! late, — unstaffed, ∞ 24/7
- **Payroll Table** — Weekly breakdown by day, with total hours, OT hours, rate, and gross pay
- **OT Threshold** — Configurable overtime threshold (blank = no OT tracking)
- **Export CSV** — Download payroll data as a spreadsheet
- **Print Payroll** — Print-ready payroll report
- **Change Manager Code** — Update the manager access code at any time

### 👷 Employee Features
- **Clock In / Clock Out** — One-tap shift start and end
- **Live Duration Counter** — Shows how long the current shift has been running
- **Store Selection** — Employees select their store on login (Step 2 after authentication)
- **Personal Shift Log** — View own shift history with filtering
- **Week Navigation** — Navigate previous weeks to review past shifts
- **Calendar Picker** — Jump to any week from the 📅 month calendar
- **Employee Analytics (Live)**
  - **Est. Earnings** — Weekly pay estimate based on hours × hourly rate
  - **Hours This Week** — Total hours with week-over-week % change
  - **Work Streak** — Consecutive days worked (building momentum!)
  - **Avg Clock-In Time** — Average start time across all shifts this week
  - **Day-by-Day Chart** — Visual bar chart of hours per day of the week
  - **All-Time Records** — Total shifts, total hours, longest shift, avg shift length, best week, all-time earnings

---

## 🏪 Stores Supported

| Store | Hours |
|---|---|
| 🏪 Loteria Store | 9:00 AM – 12:00 AM (all days) |
| 🛒 Maria's Groceries | 9:00 AM – 12:00 AM (Mon–Fri, Sun) · 9:00 AM – 1:00 AM (Sat) |
| 🌙 Sam's 24/7 | Open 24 hours, 7 days |

---

## 🛠 Tech Stack

| Technology | Purpose |
|---|---|
| HTML5 | Page structure |
| CSS3 | Styling, animations, responsive layout |
| Vanilla JavaScript | All app logic — no frameworks |
| Google Fonts (Syne + DM Mono) | Typography |
| Firebase Realtime Database | Cloud data storage, real-time sync across devices |
| GitHub Pages | Free hosting |

---

## 🔄 How It Works

### Data Flow
All data (employees, shifts, active shifts, payroll settings) is stored in **Firebase Realtime Database**. Any change made on one device is instantly reflected on all other devices viewing the app — no refresh needed.

### Login Flow
```
Open App
   │
   ├─ Employee tab → Enter Name + Access Code → Select Store → Employee Dashboard
   │
   └─ Manager tab → Enter Manager Code → Manager Dashboard
```

### Shift Recording Flow
```
Employee logs in → Selects store → Clicks "Clock In"
      │
      ▼
Active shift saved to Firebase (visible to manager in real-time)
      │
Employee clicks "Clock Out"
      │
      ▼
Shift completed → Duration calculated → Added to Shift Log → Payroll updated
```

---

## 📁 File Structure

```
shifttrack/
├── index.html          ← App structure and all HTML
├── app.js              ← All JavaScript logic + Firebase integration
├── style.css           ← All styling and animations
├── screenshots/        ← README screenshot images
└── README.md           ← This file
```

---

## 🚀 Running Locally

### Prerequisites
- A web browser
- [VS Code](https://code.visualstudio.com) (recommended)
- [Live Server extension](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) for VS Code

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/rahulbonu/shifttrack.git
cd shifttrack

# 2. Open in VS Code
code .
```

Then right-click `index.html` → **Open with Live Server**

The app opens at `http://127.0.0.1:5500` and connects to the live Firebase database.

---

## 🔑 Default Access

| Role | Credential |
|---|---|
| Manager | Code: `MANAGER2024` (changeable in-app) |
| Employee | Name + code set by manager |

---

## ☁️ Firebase Setup (for your own deployment)

1. Go to [firebase.google.com](https://firebase.google.com) and create a project
2. Add a Web app and copy the `firebaseConfig`
3. Enable **Realtime Database** (start in test mode)
4. Replace the `firebaseConfig` object in `app.js` with your own
5. Set database rules:
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```
6. Restrict your API key to your domain in [Google Cloud Console](https://console.cloud.google.com/apis/credentials)

---

## 📱 Usage Guide

### For Managers
1. Open the app and click the **Manager** tab
2. Enter the manager code → click **Login**
3. Add employees with their name, access code, and hourly rate using **+ Add**
4. Use **+ Add Shift** to manually log shifts for employees
5. Click the **✎** pencil icon on any shift to edit clock-in/clock-out times
6. Navigate weeks using `←` arrows or the **📅** calendar icon
7. Scroll down to **Analytics** to see real-time store performance
8. Scroll to **Payroll** to review weekly pay and export/print reports

### For Employees
1. Open the app and stay on the **Employee** tab
2. Enter your name and access code → click **Login**
3. Select your store on the next screen
4. Click **Clock In** when your shift starts
5. Click **Clock Out** when your shift ends
6. Scroll to see your shift history and personal analytics

---

## 🌐 Deployment

The app is hosted on **GitHub Pages** at:
[https://rahulbonu.github.io/shifttrack/](https://rahulbonu.github.io/shifttrack/)

To deploy your own copy:
1. Fork this repository
2. Go to **Settings → Pages → Source: main branch**
3. Replace the Firebase config in `app.js` with your own project's config
4. Push — your app will be live at `https://YOUR_USERNAME.github.io/shifttrack`

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
