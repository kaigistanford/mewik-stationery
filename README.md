# 🎓 MEWIK STATIONERY — Academic Services Platform

A full Progressive Web Application (PWA) for academic assistance and secretarial services, built for Tanzanian university students.

---

## 📁 Project Structure

```
mewik-stationery/
├── index.html          — Landing page
├── login.html          — Student/Admin login
├── signup.html         — Student registration
├── dashboard.html      — Student dashboard
├── admin.html          — Admin panel
├── services.html       — Services catalog
│
├── css/
│   └── style.css       — Complete stylesheet
│
├── js/
│   ├── app.js          — Core utilities, DB layer, helpers
│   ├── auth.js         — Login, signup, logout, profile
│   ├── dashboard.js    — Student dashboard logic
│   ├── admin.js        — Admin panel logic
│   └── notifications.js — In-app notification polling
│
├── data/
│   └── sample-data.json — Reference data (not used at runtime)
│
├── icons/
│   ├── favicon.svg     — Browser favicon
│   ├── icon-192.png    — PWA icon (192×192)
│   └── icon-512.png    — PWA icon (512×512)
│
├── manifest.json       — PWA manifest
├── service-worker.js   — Offline caching
└── README.md
```

---

## 🚀 Deploying on GitHub Pages

### Step 1 — Create GitHub Repository

1. Go to [github.com](https://github.com) and create a new public repository, e.g. `mewik-stationery`
2. Do **not** initialise with a README (you already have one)

### Step 2 — Push Files

```bash
cd mewik-stationery/
git init
git add .
git commit -m "Initial deployment of Mewik Stationery PWA"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/mewik-stationery.git
git push -u origin main
```

### Step 3 — Enable GitHub Pages

1. In your repository, go to **Settings → Pages**
2. Under **Source**, select `main` branch, folder `/` (root)
3. Click **Save**
4. Your site will be live at:
   ```
   https://YOUR_USERNAME.github.io/mewik-stationery/
   ```

### Step 4 — Verify PWA Installation

Open the site on a mobile browser (Chrome on Android or Safari on iOS). You should see the **"Install Mewik Stationery"** banner at the bottom. Tap **Install** to add it to your Home Screen.

---

## 🔐 Admin Access

Default admin credentials (pre-seeded on first load):

| Field    | Value                    |
|----------|--------------------------|
| Email    | `admin@mewik.co.tz`      |
| Password | `admin@mewik2024`        |

> ⚠️ **Change the admin password after first login.** Update `APP.adminPass` in `js/app.js` before deployment.

---

## 📱 PWA Mobile App Features

| Feature | Status |
|---------|--------|
| Installable from browser | ✅ |
| Offline caching (app shell) | ✅ |
| Home screen icon | ✅ |
| Standalone display (no browser bar) | ✅ |
| Install prompt banner | ✅ |
| Theme colour (Android status bar) | ✅ |

---

## 💾 Data Storage

All data is stored in **localStorage** in the user's browser. This is by design for a GitHub Pages deployment (no server required).

### Storage Keys

| Key                | Contents                     |
|--------------------|------------------------------|
| `mewik_users`      | Registered user accounts     |
| `mewik_requests`   | All service requests         |
| `mewik_services`   | Service definitions          |
| `mewik_pricing`    | Price ranges per service     |
| `mewik_logs`       | Permanent admin logs         |
| `mewik_notifs`     | In-app notifications         |
| `mewik_session`    | Current logged-in user       |

### Password Security

All passwords are hashed using **SHA-256** via the Web Crypto API before storage. Plain text passwords are never stored.

---

## 📤 How Admin Uploads Completed Work

1. Complete the student's work and save as **PDF**
2. Upload the PDF to **Google Drive**
3. Right-click the file → **Get shareable link** → Set to **"Anyone with the link can view"**
4. Copy the sharing URL
5. In the Admin Panel, open the student's request → paste the URL in **"Delivery File Link"**
6. Change status to **Completed** → click **Save Changes**
7. The student will receive an in-app notification and see a **Download PDF** button

---

## ⬇️ How Students Download Completed Work

1. Student logs in → goes to **My Requests** or **Dashboard**
2. When status is **Completed**, a green **⬇ Download PDF** button appears
3. Clicking opens the Google Drive file in a new tab

---

## 🔔 Notification System

Notifications are delivered in two ways:

- **Toast popups** — appear at top-right of screen when admin updates a request
- **Notification bell** — in the topbar; badge dot shows unread count

### Notification Triggers

| Event | Message |
|-------|---------|
| Request submitted | Confirmation sent to student |
| Status → Under Review | "Your request is now under review." |
| Status → In Progress | "We have started working on your request." |
| Status → Quality Check | "Your work is in final quality check." |
| Status → Completed | "Your work is complete! Download it now." |
| Admin custom message | Custom text entered in admin panel |

---

## 🗑️ Automatic Data Cleanup

- **Student history**: Completed requests are hidden from the student dashboard after **3 days** automatically
- **Admin logs**: All log entries are **permanent** and never auto-deleted
- **Export logs**: Admin can export all logs to Excel (`.xlsx`) at any time

---

## 💰 Configurable Pricing

Admin can update price ranges for each service directly from the **Admin Panel → Pricing** section. Prices are stored in localStorage and reflected on the landing page and request form.

---

## 🛠️ Customisation

### Change WhatsApp Number

In `js/app.js`, line 8:
```js
whatsapp: '255744000000',   // Replace with your real number
```

Also update the WhatsApp links in `index.html` and `services.html`.

### Change Admin Credentials

In `js/app.js`, line 10:
```js
adminPass: 'admin@mewik2024',   // Change this before deployment
```

Clear localStorage once and reload to re-seed the admin account.

### Add More Services

Edit the `services` array inside the `initSampleData()` function in `js/app.js`. Clear localStorage to reset.

---

## 🌐 Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, Vanilla JavaScript (ES6) |
| Fonts | Playfair Display, DM Sans, DM Mono (Google Fonts) |
| Excel Export | SheetJS (XLSX) via CDN |
| Password Hashing | Web Crypto API (SHA-256) |
| Storage | localStorage (browser) |
| Hosting | GitHub Pages |
| PWA | manifest.json + Service Worker |

---

## 📞 Support

For technical support or to report issues:

- 📱 WhatsApp: +255 744 000 000
- ✉️ Email: info@mewikstationery.co.tz

---

© 2024 Mewik Stationery. Built for Tanzanian students.
