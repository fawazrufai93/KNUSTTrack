/**
 * KNUSTrack - Firebase settings and data layer (live data only, no demo mode).
 * Paste your Firebase web config below, then publish database.rules.json.
 */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js';
import {
  getDatabase, ref, set, update, onValue, remove, get, increment
} from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js';
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, signInAnonymously
} from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js';

export const firebaseConfig = {
  apiKey: "AIzaSyDFZ5FOhDrj-6mbKWShR-FxHpam9mFD0do",
  authDomain: "knust-track.firebaseapp.com",
  databaseURL: "https://knust-track-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "knust-track",
  appId: "1:848899788137:web:58784732e3f0b07c5e81f8"
};

// Map framing only (where the student map opens).
export const KNUST_CAMPUS = {
  center: { lat: 6.6745, lng: -1.5716 },
  defaultZoom: 15, minZoom: 13, maxZoom: 19
};

export function isFirebaseConfigured() {
  return !/YOUR_/.test(firebaseConfig.apiKey + firebaseConfig.databaseURL);
}

// Call at the top of every page. Shows a setup message instead of a broken app.
export function requireConfig() {
  if (isFirebaseConfigured()) return true;
  document.body.innerHTML = '<div style="padding:32px;font-family:system-ui;color:#e2e8f0;background:#0f172a;min-height:100vh"><h1 style="font-size:20px;margin:0 0 8px">KNUSTrack is not connected yet</h1><p>Open <b>firebase-config.js</b>, paste your Firebase web config, and reload this page. See README.md for the steps.</p></div>';
  return false;
}

const app = isFirebaseConfigured() ? initializeApp(firebaseConfig) : null;
const db = app ? getDatabase(app) : null;
// Drivers use their own app instance, which never carries an admin sign-in. Without this, a browser that is
// signed in as admin on the same site could start trips without the bus PIN.
const driverApp = app ? initializeApp(firebaseConfig, 'driver') : null;
const driverDb = driverApp ? getDatabase(driverApp) : null;
const auth = app ? getAuth(app) : null;

// Turns a Firebase error into a plain message that says what to fix.
export function explainError(e) {
  const c = String((e && (e.code || e.message)) || e || '');
  if (/operation-not-allowed|admin-restricted/i.test(c)) return 'Anonymous sign-in is switched off. In Firebase: Authentication > Sign-in method > enable Anonymous.';
  if (/PERMISSION_DENIED|permission/i.test(c)) return 'Firebase refused the write. Publish the latest database.rules.json in Realtime Database > Rules.';
  if (/network|unavailable|offline/i.test(c)) return 'No internet connection. Try again.';
  if (/unauthorized-domain/i.test(c)) return 'This site is not allowed. Add it under Authentication > Settings > Authorized domains.';
  return 'Unexpected error: ' + c.slice(0, 120);
}

// ---------- Public reads (students, drivers, admin) ----------
export function subscribeToShuttles(cb) {
  return onValue(ref(db, 'shuttles'), s => cb(s.val() || {}));
}
export function subscribeToCampusAlerts(cb) {
  return onValue(ref(db, 'alerts/active'), s => cb(s.val()));
}

// Live positions live at live/{id}/pos (public). The secret at live/{id}/k is never readable.
// We follow the shuttle list and listen to each shuttle's position.
export function subscribeToLiveShuttles(cb) {
  const live = {}, listeners = {};
  return onValue(ref(db, 'shuttles'), snap => {
    const ids = Object.keys(snap.val() || {});
    ids.forEach(id => {
      if (listeners[id]) return;
      listeners[id] = onValue(ref(db, `live/${id}/pos`), s => {
        const p = s.val();
        if (p && !p.off) live[id] = p; else delete live[id];
        cb({ ...live });
      });
    });
    Object.keys(listeners).forEach(id => {
      if (!ids.includes(id)) { listeners[id](); delete listeners[id]; delete live[id]; }
    });
    cb({ ...live });
  });
}

// ---------- Driver ----------
// The PIN is checked by the database rules: a write only succeeds with the right PIN.
export async function verifyDriverCredentials(shuttleId, pin) {
  try {
    await set(ref(driverDb, `live/${shuttleId}`), { k: String(pin), pos: { off: true, ts: Date.now() } });
    return true;
  } catch (e) { return false; }
}
export function updateShuttleLiveLocation(shuttleId, p) {
  return set(ref(driverDb, `live/${shuttleId}`), {
    k: String(p.pin),
    pos: { lat: p.lat, lng: p.lng, speed: p.speed || 0, heading: p.heading || 0, acc: Math.round(p.acc || 0), ts: Date.now(), crowd: p.crowd || 0 }
  });
}
export function removeShuttleLiveLocation(shuttleId, pin) {
  return set(ref(driverDb, `live/${shuttleId}`), { k: String(pin), pos: { off: true, ts: Date.now() } });
}

// ---------- Admin (Firebase email + password sign-in) ----------
export const adminSignIn = (email, pw) => signInWithEmailAndPassword(auth, email, pw);
export const adminSignOut = () => signOut(auth);
export function onAdminState(cb) {
  return onAuthStateChanged(auth, user => {
    if (!user) return cb(false);
    onValue(ref(db, `admins/${user.uid}`), s => cb(s.val() === true), () => cb(false));
  });
}
export function subscribeToPins(cb) {
  return onValue(ref(db, 'pins'), s => cb(s.val() || {}), () => cb({}));
}
export async function saveShuttleRecord(data) {
  const { pin, ...meta } = data;
  const id = meta.id;
  await update(ref(db), { [`shuttles/${id}`]: meta, [`pins/${id}`]: String(pin) });
  return meta;
}
export async function deleteShuttleRecord(id) {
  await update(ref(db), { [`shuttles/${id}`]: null, [`pins/${id}`]: null, [`live/${id}`]: null });
}
export function setCampusAlert(alert) {
  const r = ref(db, 'alerts/active');
  return alert ? set(r, alert) : remove(r);
}


// ---------- Lateness ----------
// A bus may have scheduled trip times, e.g. "06:30, 12:00, 16:30". When a driver starts a trip we compare the
// start time with the nearest scheduled time. More than GRACE_MIN minutes after it counts as a late trip.
export const GRACE_MIN = 5;
export function lateMinutes(times, now = new Date()) {
  const list = String(times || '').split(/[,\s]+/).map(t => t.match(/^(\d{1,2}):(\d{2})$/)).filter(Boolean).map(m => +m[1] * 60 + +m[2]);
  if (!list.length) return null;                       // no schedule set, so lateness is not tracked
  const cur = now.getHours() * 60 + now.getMinutes();
  const near = list.reduce((a, b) => Math.abs(b - cur) < Math.abs(a - cur) ? b : a);
  const diff = cur - near;
  return diff > GRACE_MIN && diff <= 120 ? diff : 0;  // 0 = on time
}

// ---------- Trip statistics (late trips per driver) ----------
// stats/{id}/k is the bus PIN (never readable). stats/{id}/d is public: { trips, late, recent:[{t,m}] }
export function subscribeToStats(cb) {
  const data = {}, listeners = {};
  return onValue(ref(db, 'shuttles'), snap => {
    const ids = Object.keys(snap.val() || {});
    ids.forEach(id => {
      if (listeners[id]) return;
      listeners[id] = onValue(ref(db, `stats/${id}/d`), s => { if (s.val()) data[id] = s.val(); else delete data[id]; cb({ ...data }); });
    });
    Object.keys(listeners).forEach(id => { if (!ids.includes(id)) { listeners[id](); delete listeners[id]; delete data[id]; } });
    cb({ ...data });
  });
}
export function subscribeToMyStats(id, cb) { return onValue(ref(driverDb, `stats/${id}/d`), s => cb(s.val())); }
export async function recordTrip(id, pin, lateMin) {
  const snap = await get(ref(driverDb, `stats/${id}/d`));
  const d = snap.val() || { trips: 0, late: 0 };
  const recent = Array.isArray(d.recent) ? d.recent.slice(-39) : Object.values(d.recent || {}).slice(-39);
  recent.push({ t: Date.now(), m: lateMin || 0 });
  await set(ref(driverDb, `stats/${id}`), { k: String(pin), d: { trips: (d.trips || 0) + 1, late: (d.late || 0) + (lateMin > 0 ? 1 : 0), recent } });
}
export const resetStats = (id) => remove(ref(db, `stats/${id}`));

// ---------- Student reviews ----------
// Students sign in anonymously (no account) the first time they send a review: one review per student per bus.
export function subscribeToReviews(cb) { return onValue(ref(db, 'reviews'), s => cb(s.val() || {}), () => cb({})); }
export async function currentStudentId() { await auth.authStateReady(); return auth.currentUser ? auth.currentUser.uid : null; }
export async function submitReview(busId, rating, comment, tags) {
  await auth.authStateReady();
  if (!auth.currentUser) await signInAnonymously(auth);
  const r = { rating, ts: Date.now() };
  if (comment) r.comment = comment;
  if (tags && tags.length) r.tags = tags.join(',');
  await set(ref(db, `reviews/${busId}/${auth.currentUser.uid}`), r);
}
export const deleteReview = (busId, uid) => remove(ref(db, `reviews/${busId}/${uid}`));

// ---------- Campus bus stops ----------
export function subscribeToStops(cb) { return onValue(ref(db, 'stops'), s => cb(s.val() || {}), () => cb({})); }
export const saveStop = (id, stop) => set(ref(db, `stops/${id}`), stop);
export const deleteStop = (id) => remove(ref(db, `stops/${id}`));

// ---------- Ads ----------
export function subscribeToAds(cb) { return onValue(ref(db, 'ads'), s => cb(s.val() || {}), () => cb({})); }
export function subscribeToAdStats(cb) { return onValue(ref(db, 'adStats'), s => cb(s.val() || {}), () => cb({})); }
export const saveAd = (id, ad) => set(ref(db, `ads/${id}`), ad);
export const deleteAd = (id) => update(ref(db), { [`ads/${id}`]: null, [`adStats/${id}`]: null });
export const setAdActive = (id, active) => set(ref(db, `ads/${id}/active`), active);
export const logAdEvent = (id, kind) => set(ref(db, `adStats/${id}/${kind}`), increment(1));   // kind: 'views' | 'clicks'
