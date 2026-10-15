# KNUSTrack Driver: native iPhone app (tracks with the screen locked)

This is the driver page wrapped as a real iPhone app using Capacitor and a background-location plugin.
Unlike the home-screen web page, iPhone lets this app keep sending the bus position while the phone is locked.

You need: a Mac, Xcode (free, Mac App Store), Node.js LTS (nodejs.org), an iPhone and its cable.

## 1. Build and install on the driver's iPhone

1. Unzip this folder. Open Terminal, then: `cd` into the folder (type `cd `, drag the folder into Terminal, press Enter).
2. Run: `npm run setup`
   This installs everything, copies the page into the app and opens Xcode.
3. In Xcode, click **App** (blue icon, top of the left list) > **Signing & Capabilities**.
   - Team: choose your Apple ID (Xcode > Settings > Accounts > + to add it).
   - Bundle Identifier: change `com.knustrack.driver` to something unique, e.g. `com.yourname.knustrack.driver`.
4. Plug in the iPhone and unlock it. First time only: Settings > Privacy & Security > **Developer Mode** > On (the phone restarts).
5. At the top of Xcode pick your iPhone, press the **Play** button. The first build downloads packages, so keep internet on.
6. On the phone: Settings > General > VPN & Device Management > trust your Apple ID if asked. Open **KNUSTrack Driver**.

## 2. First launch: allow location "Always"

When the app asks for location, choose **Allow While Using App**. Later iPhone asks "Change to Always Allow?": choose **Change to Always Allow**.
If you missed it: Settings > KNUSTrack Driver > Location > **Always**, and keep **Precise Location** on.

## 3. Test

Sign in with the bus and PIN, tap Start trip, then lock the phone. A blue bar or pill shows at the top while it tracks.
On another phone, open the student map: the bus should keep moving. The driver page should say "Background tracking: Native app: runs when locked".

## Important notes

- **Free Apple ID:** the app expires after 7 days and must be reinstalled from Xcode. For drivers' phones use an Apple Developer account (about $99 a year) and **TestFlight**: Xcode > Product > Archive > Distribute App > App Store Connect, then invite drivers in TestFlight (builds last 90 days).
- **The app has its own copy of the driver page** (in `www/`). Changing the website on Netlify does not change the app. After editing, copy the new `driver.html` to `www/index.html` (plus `firebase-config.js` and `ui.css` if they changed), run `npm run sync`, and press Play again.
- Keep the phone charging: background GPS uses battery.
- If the driver swipes the app away (force quit), iPhone stops tracking. Reopening resumes the trip automatically.
- No Mac? See README-CLOUD-WINDOWS.md to build in the cloud.
- Not tested on a device before delivery: if Xcode shows a build error, send a screenshot of it.

## Files

- `www/`: the driver page (`index.html` is `driver.html`), `firebase-config.js`, `ui.css`, `capacitor.js`
- `ios/`: the Xcode project (permissions, Background Modes: Location and the app icon are already set)
- `capacitor.config.json`: app name and id
