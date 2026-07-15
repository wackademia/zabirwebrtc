# Simple WebRTC Video Call

This is a small WebRTC demo that lets two people join the same room and start a video call.

It uses:
- `getUserMedia()` for camera and mic
- `RTCPeerConnection` for the call itself
- `socket.io` for signaling
- a tiny Node server to serve the page

## Files

- `server.js` - serves the app, handles signaling events, and generates `js/turn-config.js` on the fly from environment variables
- `js/client.js` - browser-side WebRTC logic
- `js/turn-config.js` - kept on disk for reference only; not actually served (see below)
- `.env.example` - template for the two environment variables you need locally
- `index.html` - the page UI

## TURN server setup (needed for calls across two different networks)

STUN alone only works when at least one side has a NAT that allows a direct
connection to be discovered. Two separate home networks (two different
ISPs, two different routers) very often can't connect directly at all — that's
exactly the case this app needs a **TURN server** for: it relays the call
through a third machine when a direct path isn't possible.

This app is wired up to use the **free Open Relay TURN service** (20 GB/month
free, no credit card). Your credentials are read from two environment
variables — `METERED_APP_NAME` and `METERED_API_KEY` — never from a
committed file, so the secret key never ends up in git.

1. Sign up for a free account: https://dashboard.metered.ca/signup?tool=turnserver
2. In the dashboard, create an app and generate a TURN credential. You'll get:
   - an **app name** (used as `https://<app-name>.metered.live`)
   - an **API key**
3. **Locally:** copy `.env.example` to `.env` and fill in both values:
   ```
   METERED_APP_NAME=your-app-name
   METERED_API_KEY=your-api-key
   ```
   `.env` is gitignored, so it's never pushed.
4. **On Render:** set the same two variables under the service's
   **Environment** tab (see the deployment section below).
5. Restart the server (`npm start`) / redeploy, then reload the page.

If you skip this, the app still runs, but falls back to STUN-only — the
event log on the page will tell you this happened. For a call between your
home and your boss's home (two different ISPs), TURN is what makes the
connection actually go through when a direct peer-to-peer path fails.

The free tier is shared/rate-limited (20 GB/month) but is enough for regular
one-on-one video calls; if it ever runs out mid-month, video calls will fail
to connect until the next month or until you upgrade.

## Reaching each other over the internet

TURN fixes the *media* relay problem, but there's a separate issue: right
now the signaling server only listens on `localhost:8181`, so your boss
can't reach it from their own home unless it's exposed to the internet.
Two options:

- **Port-forward on your router** — forward external port `8181` to this
  computer's local IP, then have your boss connect to
  `http://<your-public-IP>:8181` instead of `localhost`. Free, but requires
  router access and won't work if your ISP uses CGNAT (common on mobile/some
  cable plans — if port forwarding doesn't seem to work, this is likely why).
- **Deploy the app to a small cloud host** (Render, Railway, Fly.io, a cheap
  VPS) so both of you connect to one public URL instead. More reliable, no
  router configuration, most have a free tier.

## Deploying to Render (free)

Vercel won't work for this app as-is — it runs code as short-lived
serverless functions and can't hold a persistent socket.io connection or
the in-memory room state `server.js` needs. Render runs a normal, always-on
Node process instead, which is what this needs. The repo already includes
`render.yaml` and `server.js` already reads the `PORT` Render assigns, so no
further code changes are needed — just push it and connect it.

1. **Push this folder to GitHub** (from a terminal, inside this folder):
   ```bash
   git init
   git add .
   git commit -m "WebRTC demo"
   git branch -M main
   git remote add origin https://github.com/wackademia/zabirwebrtc.git
   git push -u origin main
   ```

2. **Create the Render service:**
   - Go to https://render.com and sign up/log in (GitHub login is easiest).
   - Click **New +** → **Blueprint**, and pick the `zabirwebrtc` repo —
     Render will read `render.yaml` and pre-fill everything (Node, free
     plan, `npm install` / `npm start`). Alternatively use **New +** →
     **Web Service** and set Build Command to `npm install` and Start
     Command to `npm start` manually.
   - Under the service's **Environment** tab, add:
     - `METERED_APP_NAME` = your Metered app name
     - `METERED_API_KEY` = your Metered API key
   - Click **Create/Deploy**. First build takes a couple of minutes.

3. **Get your public URL** — Render gives you something like
   `https://webrtc-signaling.onrender.com`. That's the link both you and
   your boss open (instead of `localhost:8181`).

Note: on Render's free tier, the service "spins down" after 15 minutes of
no traffic, so the very first visit after a gap can take 30-50 seconds to
wake back up — normal, not a bug. Once it's up, calls connect immediately.

## Run it

```bash
npm start
```

Then open:

```text
http://localhost:8181
```

## How to test

1. Open the site in two tabs or two browsers.
2. Type the same room name in both.
3. Click the join button in both tabs.
4. Allow camera and microphone access.
5. The call should connect once the second person joins.

## Notes

- Each room only supports 2 users right now.
- If someone clicks Hang Up, the other side is told the call ended.
- STUN alone often isn't enough between two different home networks — set
  up TURN credentials (see above) for reliable connections.
