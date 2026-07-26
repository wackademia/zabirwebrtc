# WebRTC Video Call

Uses `getUserMedia()` for camera/mic, `RTCPeerConnection` for the call,
`socket.io` for signaling, and a small Node server to serve everything.

## Files

- `server.js` - serves the app, handles signaling, and generates
  `js/turn-config.js` from env vars
- `js/client.js` - browser-side WebRTC logic
- `js/turn-config.js` - not actually served, just here for reference
- `.env.example` - template for the env vars
- `index.html` - the page itself

## TURN setup (self-hosted coturn)

The app reads four env vars and builds the ICE server list from them - a STUN
entry plus a TURN entry over both UDP and TCP. Just fill in your coturn creds:

1. Copy `.env.example` to `.env` and fill in:
   ```
   TURN_HOST=your.server.ip      # public IP or domain of the coturn box
   TURN_PORT=3478
   TURN_USERNAME=your-turn-username
   TURN_PASSWORD=your-turn-password
   ```
2. On Render (or wherever it's deployed), add the same four vars under Environment.
3. Restart / redeploy.

If the vars are missing the app falls back to STUN only (Google's public STUN),
which works on the same network but usually not across NATs.

### Standing up coturn on the Linux server

Connect over SSH from PowerShell (`ssh username@server-ip`, then password), then:

```bash
sudo apt update
sudo apt install -y coturn
```

Enable the service:

```bash
sudo sed -i 's/^#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn
```

Put this in `/etc/turnserver.conf` (replace the placeholders). This uses
long-term (static username/password) auth, which matches the four env vars above:

```
listening-port=3478
fingerprint
lt-cred-mech
user=your-turn-username:your-turn-password
realm=your.server.ip
# Uncomment and set if the box is behind a NAT (cloud VM with a private IP):
# external-ip=PUBLIC_IP/PRIVATE_IP
```

Restart and enable on boot:

```bash
sudo systemctl restart coturn
sudo systemctl enable coturn
```

Open the firewall so browsers can reach it (UDP + TCP 3478, plus the relay
port range if you set one):

```bash
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 49152:65535/udp
```
If the server is a cloud VM, add the same ports in the provider's security group.

Test it end to end at https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/
- add `turn:your.server.ip:3478` with your username/password and click
"Gather candidates". You should see a `relay` candidate.

## Getting to each other over the internet

Signaling server only runs on localhost by default, so either:

- port-forward 8181 on my router (won't work if my ISP does CGNAT), or
- deploy it somewhere with a public URL (what I did - see below)

## Deployed on Render

Went with Render instead of Vercel since this needs a persistent process
for socket.io (Vercel's serverless functions won't hold a connection open).

Repo already has `render.yaml` and reads `process.env.PORT`, so:

1. Push to GitHub
2. New + Blueprint on Render, point it at the repo
3. Add `TURN_HOST`, `TURN_PORT`, `TURN_USERNAME`, `TURN_PASSWORD` under Environment
4. Deploy, get the `.onrender.com` URL, share it

Free tier spins down after 15 min idle, so first load after a gap takes
30-50s to wake up. Normal.

## Running locally

```bash
npm start
```

Then open `http://localhost:8181`

## Testing

Open it in two tabs/browsers, same room name in both, join, allow camera/mic.
Call connects once the second person joins.

## Notes

- 2 people per room max
- Hanging up tells the other side the call ended
- TURN credentials matter most when testing across two different networks
