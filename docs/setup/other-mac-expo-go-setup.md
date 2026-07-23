# Lumis Setup on a Second Mac

Last updated: 2026-07-23

This guide sets up the Lumis staging app on another Mac for iPhone testing with Expo Go. It does not configure or deploy the backend.

## What You Need

- Access to the `triplicityastrology/lumis-mobile` GitHub repository.
- A Mac with an internet connection.
- An iPhone with the current Expo Go app, compatible with Expo SDK 54.
- The Mac and iPhone on the same Wi-Fi network for LAN testing.
- About 5 GB of free disk space for Node.js and project dependencies.

You do **not** need a Supabase database password, an `sb_secret_` key, a service-role key, a Cloudflare signing secret, or the astrology provider key. Those are backend-only credentials and must never be copied to the second Mac for normal app testing.

## 1. Install GitHub Desktop

1. Download GitHub Desktop from <https://desktop.github.com/>.
2. Open it and sign in to the GitHub account that can access the Lumis repository.
3. Select **File > Clone Repository**.
4. Select the **URL** tab.
5. Enter:

   ```text
   https://github.com/triplicityastrology/lumis-mobile.git
   ```

6. Choose a local folder. Recommended final location:

   ```text
   /Users/YOUR-MAC-USERNAME/Documents/Mobile App/lumis-mobile
   ```

7. Select **Clone**.

The command-line alternative is:

```bash
mkdir -p "$HOME/Documents/Mobile App"
cd "$HOME/Documents/Mobile App"
git clone https://github.com/triplicityastrology/lumis-mobile.git
cd "$HOME/Documents/Mobile App/lumis-mobile"
```

For a private repository, GitHub Desktop is easier because it manages GitHub authentication.

## 2. Install Node.js 22

1. Download the Node.js 22 LTS macOS installer from <https://nodejs.org/en/download>.
2. Run the `.pkg` installer using the default options.
3. Close and reopen Terminal.
4. Run:

```bash
node --version
npm --version
```

The Node version should begin with `v22`.

Enable the project package manager:

```bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm --version
```

If `corepack enable` reports a permission error, run:

```bash
sudo corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm --version
```

The Mac password is hidden while entering it in Terminal.

## 3. Install Lumis Dependencies

Run this from the cloned repository:

```bash
cd "$HOME/Documents/Mobile App/lumis-mobile"
pnpm install --frozen-lockfile
```

Installation can take several minutes on the first run.

## 4. Create the Mobile Staging Configuration

Run this complete command. These are publishable mobile settings, not private backend credentials.

```bash
cd "$HOME/Documents/Mobile App/lumis-mobile"
umask 077
printf '%s\n' \
  'EXPO_PUBLIC_SUPABASE_URL=https://bmqhwofmdgebpcihjlnb.supabase.co' \
  'EXPO_PUBLIC_SUPABASE_KEY=sb_publishable_cnoZgNNyPI2lMxgb9xkW6w_d4W_v1QA' \
  'EXPO_PUBLIC_DICE_RITUAL=1' \
  'SUPABASE_PROJECT_REF=bmqhwofmdgebpcihjlnb' \
  > apps/mobile/.env
```

Confirm that the file exists without printing its contents:

```bash
cd "$HOME/Documents/Mobile App/lumis-mobile"
test -f apps/mobile/.env && echo "Lumis mobile configuration is ready."
```

Run the setup doctor:

```bash
cd "$HOME/Documents/Mobile App/lumis-mobile"
pnpm setup:check
```

Do not continue until it prints `Lumis mobile setup is ready.` This check does
not print the publishable key and rejects backend-only secrets if they were
accidentally placed in the mobile environment.

## 5. Install and Prepare Expo Go

1. On the iPhone, install or update **Expo Go** from the App Store.
2. Open **Settings > Apps > Expo Go** on the iPhone.
3. Enable **Local Network** access.
4. Connect the iPhone to the same Wi-Fi network as the Mac.
5. Temporarily disconnect VPNs on both devices while testing LAN mode.

The Lumis app currently uses Expo SDK 54.

## 6. Start Lumis for iPhone Testing

Run this complete command in Terminal:

```bash
(
set -e
cd "$HOME/Documents/Mobile App/lumis-mobile"
pkill -f "expo.*8081" 2>/dev/null || true
pnpm --dir apps/mobile exec expo start --lan --port 8081 --clear
)
```

Keep Terminal open. The Lumis development server only remains available while this command is running.

When the QR code appears:

1. Open the iPhone Camera app or Expo Go.
2. Scan the QR code.
3. Allow Expo Go to connect to devices on the local network if prompted.
4. Wait for the JavaScript bundle to finish loading.

To stop the server, click the Terminal window and press **Control+C**.

## 7. Use Tunnel Mode if Office Wi-Fi Blocks LAN Access

Some office and guest Wi-Fi networks prevent devices from talking directly to each other. If Expo Go reports that it cannot connect to an address such as `192.168.x.x:8081`, stop the LAN server with **Control+C**, then run:

```bash
(
set -e
cd "$HOME/Documents/Mobile App/lumis-mobile"
pkill -f "expo.*8081" 2>/dev/null || true
pnpm --dir apps/mobile exec expo start --tunnel --port 8081 --clear
)
```

If Expo asks to install tunnel support, approve the installation. Scan the new QR code after the tunnel is ready.

Tunnel mode is slower than LAN mode but normally works across restricted office networks.

## 8. Open the Browser Version

For a quick Mac-browser check instead of Expo Go, stop any existing Expo server and run:

```bash
(
set -e
cd "$HOME/Documents/Mobile App/lumis-mobile"
pkill -f "expo.*8081" 2>/dev/null || true
pnpm --dir apps/mobile exec expo start --web --port 8081 --clear
)
```

Then open <http://localhost:8081/> on that Mac.

## 9. Update the Second Mac Later

Before testing a newer build:

1. Stop Expo with **Control+C**.
2. In GitHub Desktop, select **Fetch origin**, then **Pull origin** if available.
3. Run:

```bash
cd "$HOME/Documents/Mobile App/lumis-mobile"
git pull --ff-only
pnpm install --frozen-lockfile
pnpm --dir apps/mobile exec expo start --lan --port 8081 --clear
```

If `git pull --ff-only` says local changes would be overwritten, stop. Do not discard or reset those changes. Review them in GitHub Desktop before continuing.

## 10. Optional Local Verification

Run these commands after installation or a framework upgrade:

```bash
cd "$HOME/Documents/Mobile App/lumis-mobile"
pnpm typecheck
pnpm test:dice
pnpm test:mobile-ui
```

These checks do not require private backend credentials.

## Troubleshooting

### `command not found: node`, `npm`, or `pnpm`

Close and reopen Terminal after installing Node.js. Then repeat the Node and Corepack commands in section 2.

### `Cannot determine the project's Expo SDK version` or `expo is not installed`

Dependencies were not installed from the repository root. Run:

```bash
cd "$HOME/Documents/Mobile App/lumis-mobile"
pnpm install --frozen-lockfile
```

### Expo Go says the project is incompatible

Update Expo Go from the App Store. Lumis currently requires Expo SDK 54.

### Expo Go cannot connect to `192.168.x.x:8081`

- Confirm that Terminal still shows the Expo server running.
- Confirm that the iPhone and Mac use the same Wi-Fi network.
- Enable Local Network access for Expo Go.
- Disable VPN temporarily.
- Try tunnel mode from section 7.

### Port 8081 is already in use

Run:

```bash
pkill -f "expo.*8081" 2>/dev/null || true
```

Then start Expo again.

### The app opens but shows an old version or a blank screen

Stop Expo, restart it with `--clear`, and reopen the project from Expo Go. Keep the Terminal visible and send Technical AI the first red error shown there if loading still fails.

### The Dice ritual does not appear

Confirm that `apps/mobile/.env` contains:

```text
EXPO_PUBLIC_DICE_RITUAL=1
```

Restart Expo with `--clear` after changing environment settings.

## Safe Multi-Mac Working Rule

Use both Macs for testing, but avoid editing and committing the same files from both Macs at the same time. Before switching development machines, commit and push completed work from the first Mac, then pull it on the second Mac. Normal Expo testing does not modify source files.

## Handoff Checklist for Another Technical AI

The Technical AI on the second Mac should:

1. Run `git status --short --branch` before making changes.
2. Run `pnpm setup:check`.
3. Run `pnpm typecheck`, `pnpm test:dice`, and `pnpm test:mobile-ui`.
4. Start Expo in LAN mode, then use tunnel mode only if the office network blocks direct device traffic.
5. Preserve `EXPO_PUBLIC_DICE_RITUAL=1`.
6. Never request or place Supabase secret keys, database passwords, Cloudflare secrets, or provider API keys in `apps/mobile/.env`.
7. Keep the first Mac's work committed and pushed before editing the same feature on the second Mac.
