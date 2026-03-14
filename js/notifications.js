// ============================================================
//  MEWIK STATIONERY — notifications.js
//  In-app notification polling and display
// ============================================================

'use strict';

let lastNotifCount = 0;
let notifInterval  = null;

function startNotifPolling(userId, intervalMs = 15000) {
  if (notifInterval) clearInterval(notifInterval);
  checkNotifs(userId);
  notifInterval = setInterval(() => checkNotifs(userId), intervalMs);
}

function checkNotifs(userId) {
  const notifs = DB.getNotifs(userId);
  const unread  = notifs.filter(n => !n.read);

  // Show toast for any new unread notifs since last check
  if (unread.length > lastNotifCount) {
    const newest = unread[0];
    if (newest) {
      showToast(newest.title, newest.message, 'info', 6000);
    }
  }
  lastNotifCount = unread.length;
  updateNotifDot(userId);
}

// Auto-start when session is active
document.addEventListener('DOMContentLoaded', () => {
  const user = Session.currentUser();
  if (user) startNotifPolling(user.id);
});
