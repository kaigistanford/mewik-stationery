# MEWIK STATIONERY — Setup Guide

## Sync Between Devices (JSONBin.io)

**Setup takes 2 minutes:**

1. Open your browser and go to: **https://jsonbin.io**
2. Click **Sign Up** — create a free account with your email
3. After logging in, look at the **left sidebar** — click **"API Keys"**
4. Click **"Create Access Key"** — type any name like `Mewik`
5. A long key will appear — **copy it**
6. Open the file `js/sync-config.js` in your project
7. Find this line:
   ```js
   masterKey: 'YOUR_MASTER_KEY',
   ```
8. Replace `YOUR_MASTER_KEY` with your copied key:
   ```js
   masterKey: '$2a$10$abc123xyz...',
   ```
9. Save the file and upload to GitHub — **done!**

**What happens after setup:**
- All devices share the same data automatically
- The topbar shows **"● Synced HH:MM"** when connected
- Data updates every 12 seconds across all devices
- Works in Local Mode (localStorage) if offline

---

## File Delivery (Google Drive)

Admin does this when a student's work is ready:

1. Upload the completed PDF to **Google Drive**
2. Right-click the file → **"Get link"**
3. Click **"Change to Anyone with the link"** → Copy link
4. In Admin Panel → open the student's request → click **Manage**
5. Paste the link in the **"Delivery File — Google Drive Link"** field
6. Change status to **Completed**
7. Click **Save & Notify Student**

**The student will then see a Download button** in their dashboard. Clicking it downloads the file directly to their device without opening any new tab (for small files) or opens the Google Drive download page (for larger files that Google scans).

---

## Admin Login

Email: `admin@mewik.co.tz`
Password: `admin@mewik2024`

Change your password from: **Admin Panel → Account**

---

## Deploy to GitHub Pages

1. Push all files to a GitHub repository
2. Settings → Pages → Branch: main → Save
3. Your site: `https://yourusername.github.io/mewik-stationery/`
