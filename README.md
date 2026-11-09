# FinWise

FinWise is a personal finance tracker with a free hosted preview and a local account-enabled version.

## Open the hosted preview

Visit <https://otaku-ace-coder.github.io/finwise-personal-finance/> on a computer or phone. In the hosted preview, changes are saved in that browser only. Sign-up and account sync are available in the local version below.

## Preview

### Dashboard

![FinWise dashboard preview](previews/dashboard.png)

### Notifications

![FinWise notification panel preview](previews/notifications.png)

## Start the app

1. Install Node.js 24 or newer.
2. Open a terminal in this folder.
3. Run `npm start`.
4. Open `http://localhost:3000` in your browser.

## Google sign-in

Create a Google OAuth client of type **Web application** and register `http://localhost:3000/api/google/callback` as an authorized redirect URI. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the environment where you run `npm start`. If you use a different origin, set `GOOGLE_REDIRECT_URI` to the matching registered callback URL. Open the app using the same origin as the callback, then open the avatar menu and choose **Continue with Google**. Google accounts start with an empty tracker.

Keep the client secret on the server. The GitHub Pages demo and phone preview do not support sign-in. To offer Google sign-in publicly, deploy the account server with persistent storage over HTTPS and register its callback URL with Google.

### Deploy the account-enabled site

1. On a Node.js 24 host, connect this repository and set the start command to `npm start`. Use one server instance because FinWise stores accounts in a JSON file and keeps sessions in memory.
2. Mount persistent storage and set `FINWISE_DATA_DIR` to the mount path (for example, `/var/data`). Set `FINWISE_HOST=0.0.0.0` and `NODE_ENV=production`. FinWise listens on the host-provided `PORT`.
3. Once you have the HTTPS site address, add its exact `/api/google/callback` URL to your Google OAuth web client. Set `GOOGLE_REDIRECT_URI` to that URL and enter `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the host's environment settings.
4. Open the new HTTPS site, choose **Continue with Google** in the avatar menu, and test sign-in, sign-out, and saving. Account data should survive a restart. Users sign in again after a server restart.

## Phone preview

For a preview on a phone connected to the same Wi-Fi, run `npm run preview:phone`. Find this computer's IPv4 address with `ipconfig`, then open `http://<computer-ip>:3000` on the phone. Phone preview mode disables sign-up, sign-in, and account APIs; it only serves the app and sample data.

The app has no external package dependencies. It serves the web pages and handles account sign-up and sign-in from `server.js`.

FinWise includes an overview, transaction search and filters, a six-month income and spending report, monthly budgets, savings pots, recurring bills, notifications, and light or dark display themes. Export transactions from the Transactions page as a CSV file.

## How the files fit together

- `index.html` is the page frame and navigation.
- `styles.css` controls the colors, layout, and small-screen view.
- `app.js` draws each screen, handles buttons, and saves changes.
- `server.js` serves the app, checks sign-up and sign-in, hashes passwords, and stores each account's finance data separately.
- `.finwise/users.json` is created on this computer when the first account is registered. It is excluded from Git.

Settings include currency display, a light/dark theme, and a profile photo. Photos are resized in the browser before they are saved with the account.

Passwords are never saved in the browser. The server stores a one-way password hash. Sign-in sessions last until the server restarts or the cookie expires.

The GitHub Pages version serves only the static demo files. Account data and passwords are not collected by that hosted preview.
