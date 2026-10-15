# Build the iPhone app from Windows with Codemagic (no Mac)

You need: an **Apple Developer account** (about $99 a year, developer.apple.com/programs, approval can take up to 2 days), a GitHub account and a Codemagic account (free plan includes monthly build minutes).

## 1. Put the project on GitHub
1. Unzip `knustrack-driver-ios.zip`.
2. On github.com create a new **private** repository (e.g. `knustrack-driver-ios`).
3. Upload everything from the unzipped folder (drag the files and folders into the page, or use GitHub Desktop). `codemagic.yaml` must sit at the top level of the repo.

## 2. Pick your app id
Open `codemagic.yaml` and change `com.knustrack.driver` to something unique, e.g. `com.yourname.knustrack.driver`. It appears twice (`bundle_identifier` and `BUNDLE_ID`); keep both the same.

## 3. Apple side (developer.apple.com and appstoreconnect.apple.com)
1. Certificates, Identifiers & Profiles > Identifiers > **+** > App IDs > App: enter your app id.
2. App Store Connect > **Apps** > **+** > New App: iOS, name "KNUSTrack Driver", choose that app id, any SKU.
3. App Store Connect > Users and Access > **Integrations** > App Store Connect API > generate a key (access: App Manager). Download the `.p8` file (only once!) and note the **Issuer ID** and **Key ID**.

## 4. Codemagic
1. Sign in at codemagic.io with GitHub, **Add application**, pick your repo, choose the **codemagic.yaml** option.
2. Teams > Personal Account > Integrations > **App Store Connect** > Connect: name the key exactly `KNUSTrack`, enter Issuer ID and Key ID, upload the `.p8`.
3. Start a build with workflow **KNUSTrack Driver (iOS to TestFlight)**. It takes about 10 to 15 minutes.

## 5. Install on iPhones with TestFlight
1. After the build, the app appears in App Store Connect > your app > **TestFlight** (processing takes 10 to 30 minutes).
2. Install the **TestFlight** app from the App Store on the driver's iPhone.
3. To invite drivers: TestFlight > External Testing > create a group > add the build > turn on **Public Link** and share it. The first external build needs Apple's quick beta review (usually about a day). Or add drivers as Internal Testers under Users and Access (up to 100).
4. First launch: allow location, then **Change to Always Allow**.

## Updating the app later
Change files in `www/` (copy the new `driver.html` to `www/index.html`), commit to GitHub, and start a new Codemagic build. Each build gets a new build number automatically and a new TestFlight build appears.

## If a build fails
Open the failed build in Codemagic, copy the red error lines from the log and send them to me.
