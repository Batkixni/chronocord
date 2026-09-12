# Chronocord

<div align="center">

<img src="./assets/avatar.jpg" width="128" height="128" style="border-radius: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.12);" alt="Chronocord Logo" />
<br />
<br />

**The Executive Meeting & Scheduling Engine for Discord Teams**

*Engineered with Discord Components V2, React 19, PostgreSQL, and Transactional Email Dispatch.*

[![Node.js Version](https://img.shields.io/badge/node.js-v22+-68a063?style=flat-square&logo=node.js)](https://nodejs.org)
[![React Version](https://img.shields.io/badge/react-19-61dafb?style=flat-square&logo=react)](https://react.dev)
[![Discord.js](https://img.shields.io/badge/discord.js-v14-5865F2?style=flat-square&logo=discord)](https://discord.js.org)
[![PostgreSQL](https://img.shields.io/badge/database-PostgreSQL%2016-4169e1?style=flat-square&logo=postgresql)](https://www.postgresql.org)
[![Docker](https://img.shields.io/badge/docker-ready-2496ed?style=flat-square&logo=docker)](https://www.docker.com)
[![License: MPL-2.0](https://img.shields.io/badge/license-MPL--2.0-blue?style=flat-square)](LICENSE)

</div>

---

## Highlights

- **Executive Monochrome Discord UI**: Styled strictly with Discord's native **Components V2** containers, sections, and progress bars. Zero clutter, zero annoying emojis, designed for professional teams, DAOs, and engineering studios.
- **Modern Web Control Panel**: Built with **React 19** and Tailwind CSS. Manage meetings, inspect server calendars, resolve mutual member schedules, and manage notification preferences via Discord OAuth2.
- **Dual Notification Engine**: Delivers reminders directly to targeted Discord users via Direct Messages and channels, as well as high-deliverability transactional emails via **OpenMail / SMTP**.
- **1-Click Google Calendar Sync**: Generates instant, public Google Calendar events embedded directly inside Discord cards, DMs, emails, and the web dashboard.
- **Team Availability Resolver (`/timefinder`)**: Automatically computes the mathematical intersection of members' weekly schedules to uncover the optimal meeting window.
- **Interactive Time Polling (`/timevote`)**: Create candidate meeting slots with live voting progress bars and one-click finalization.
- **Zero-Friction Self-Hosting**: Shipped with production-ready multi-stage **Docker** and **Docker Compose** configurations.

---

## Architecture Overview

```
                                  +---------------------------------------+
                                  |         Discord Developer API         |
                                  |    (Slash Commands & Components V2)   |
                                  +-------------------+-------------------+
                                                      |
                                                      v
  +-----------------------+              +------------------------+              +-----------------------+
  |    React 19 Web App   | <=== OAuth2 ===> |     Chronocord Core    | <=== SMTP ===> |    OpenMail / SMTP    |
  |  (Vite + TailwindCSS) |  (Port 3001) | (Node.js 22 + Express) |  (REST API)  | (Email Notifications) |
  +-----------------------+              +-----------+------------+              +-----------------------+
                                                     |
                                                     v
                                         +-----------------------+
                                         | PostgreSQL / Neon DB  |
                                         |  (Connection Pooling) |
                                         +-----------------------+
```

---

## Quickstart (Docker Compose)

The easiest and recommended way to deploy Chronocord in production is with Docker Compose.

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/chronocord.git
cd chronocord
```

### 2. Configure Environment Variables
Copy the sample environment file:
```bash
cp .env.example .env
```
Edit `.env` with your Discord Bot credentials, database connection, and OpenMail API key.

### 3. Launch with Docker Compose
```bash
docker compose up -d
```
Chronocord will build the React web dashboard, initialize the PostgreSQL schema, register Discord slash commands, and start the background reminder daemon.

Visit the Web Dashboard at: **`http://localhost:3001`**

---

## Manual Installation (Node.js)

### Prerequisites
- **Node.js**: `>= 22.0.0`
- **PostgreSQL**: `>= 14` (Local, Docker, Supabase, or Neon)
- **npm** or **pnpm**

### Step-by-Step Setup

1. **Install Root & Server Dependencies**:
   ```bash
   npm install
   ```

2. **Build the Web Dashboard**:
   ```bash
   cd client
   npm install
   npm run build
   cd ..
   ```

3. **Configure Environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

4. **Start the Application**:
   ```bash
   # Production mode
   npm start

   # Development mode (with auto-reload)
   npm run dev
   ```

---

## Discord Developer Portal Setup

Follow these steps to configure your Discord bot application:

1. Visit the [Discord Developer Portal](https://discord.com/developers/applications) and click **New Application**.
2. Navigate to the **Bot** tab:
   - Click **Reset Token** to copy your **`DISCORD_TOKEN`**.
   - Under **Privileged Gateway Intents**, enable:
     - **Server Members Intent** (Required to resolve server member lists)
     - **Message Content Intent** (Optional, recommended for DM handling)
3. Navigate to the **OAuth2** tab:
   - Copy **Client ID** into `DISCORD_CLIENT_ID`.
   - Copy **Client Secret** into `DISCORD_CLIENT_SECRET`.
   - In **Redirects**, add:
     ```
     https://your-domain.com/auth/discord/callback
     # (or http://localhost:3001/auth/discord/callback for local testing)
     ```
4. **Invite the Bot**:
   - Go to **OAuth2 -> URL Generator**.
   - Select scopes: `bot`, `applications.commands`.
   - Select bot permissions: `Send Messages`, `Embed Links`, `Attach Files`, `Use External Emojis`, `Manage Messages`.
   - Open the generated URL in your browser to invite the bot to your server.

---

## Slash Commands Reference

| Command | Description |
| :--- | :--- |
| `/meeting` | Schedule a meeting, publish attendance poll, and dispatch notifications. |
| `/event` | Create an organization-wide calendar event with recurring options. |
| `/list` | View the top 5 upcoming meetings or server calendar events. |
| `/timefinder` | Calculate common free slots across targeted members for a set duration. |
| `/timevote` | Create a candidate time poll to collect attendee availability. |
| `/availability` | Inspect recurring weekly availability for yourself or a designated member. |
| `/email status` | Check currently linked notification email and dispatch state. |
| `/email set` | Link or update your notification email address. |
| `/email test` | Dispatch a sample verification email via OpenMail. |
| `/settings` | Configure server member schedule visibility (Public / Admins only). |

---

## Environment Variables Reference

| Variable | Required | Default | Description |
| :--- | :---: | :---: | :--- |
| `DISCORD_TOKEN` | **Yes** | - | Discord Bot authorization token. |
| `DISCORD_CLIENT_ID` | **Yes** | - | Discord Application Client ID. |
| `DISCORD_CLIENT_SECRET` | **Yes** | - | Discord Application Client Secret. |
| `DATABASE_URL` | **Yes** | - | PostgreSQL connection URI (`postgresql://...`). |
| `DATABASE_SSL` | No | `false` | Set to `true` if using SSL (e.g. Neon, Supabase). |
| `WEB_BASE_URL` | **Yes** | `http://localhost:3001` | Public URL for the Web Dashboard and OAuth2 redirects. |
| `PORT` | No | `3001` | Port for the Express backend and React SPA. |
| `COOKIE_SECRET` | **Yes** | - | Random secret string used to sign session cookies. |
| `OPENMAIL_API_KEY` | No | - | OpenMail API key for transactional email notifications. |
| `OPENMAIL_FROM_EMAIL` | No | `notifications@chronocord.app` | Verified sender email address in OpenMail. |
| `TZ` | No | `UTC` | Timezone for schedule calculations (e.g., `America/New_York`, `Asia/Taipei`). |

---

## Self-Hosting & Performance

- **PostgreSQL Connection Pool**: Built on `pg.Pool` with automated reconnection and idle timeouts.
- **Resource Footprint**: Consumes under **120 MB RAM** under typical production server workloads.
- **Database Indexing**: Automatic index creation on `rsvps`, `availabilities`, and `guild_events`.
- **Stateless & Scalable**: All state resides within PostgreSQL, allowing graceful container restarts without losing session state or reminders.

---

## License

This project is licensed under the [Mozilla Public License 2.0 (MPL-2.0)](LICENSE).
