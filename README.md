# Football Field Booking App

Full-stack football field booking platform built with React, Express, Sequelize, and MySQL.

## Overview

This project lets players, captains, field owners, and admins manage football fields, bookings, teams, matches, and notifications in one application.

The repository contains:
- `frontend/`: React client
- `backend/`: Express API with Sequelize models and MySQL integration

## Features

- Authentication with JWT and role-based access control
- Public browsing for fields, teams, and league data pages
- Team creation, team management, and member requests
- Field listing, field details, and owner field management
- Booking flow for matches and field reservations
- Notifications and profile/settings pages
- Owner dashboard and booking management views
- Admin user management and role request review
- Demo seed script with sample users, fields, teams, bookings, and match history
- Optional live league standings and match data via `football-data.org`

## Role Relationships

The application is organized around four active roles plus public visitors. Each role has a clear relationship to the others:

| Role | Primary responsibility | Works most closely with | Typical interactions |
|------|------------------------|--------------------------|----------------------|
| Guest | Browse public content | Players, captains, field owners | View public fields and teams, then register for an account |
| Player | Join teams and participate in matches | Captains | Request to join teams, manage profile, follow bookings and match activity |
| Captain | Organize teams and create team-side bookings | Players, field owners | Create teams, manage members, invite players, request bookings, open matches |
| Field owner | Manage venues and booking approval | Captains, admins | Create and update fields, review bookings, manage owner dashboard data |
| Admin | Govern the platform | All roles | Review role requests, manage users, oversee platform activity |

### How roles connect

- Guests become authenticated users by registering, and new accounts default to `player`.
- Players are the entry point for team participation. They can join teams and later request a role upgrade.
- Captains are team operators. They coordinate players and interact with field owners to secure matches and bookings.
- Field owners are venue operators. They do not manage teams directly, but they are the key counterpart for captains during the booking flow.
- Admins are platform supervisors. They do not replace the day-to-day role of captain or owner, but they can intervene across all areas.

### Role upgrade path

- A new user starts as `player`.
- A player can request upgrade to `captain` or `field_owner`.
- An admin reviews and approves or rejects role requests.
- Once approved, access changes immediately because the backend resolves the latest role from the database on authenticated requests.

### Collaboration model in the app

- `Player <-> Captain`: team membership, invitations, join requests, and match participation.
- `Captain <-> Field owner`: field reservations, booking confirmation, match scheduling, and venue coordination.
- `Captain <-> Admin`: escalations, moderation, and role-governed access to team-related flows.
- `Field owner <-> Admin`: owner permissions, field oversight, and dispute resolution.
- `Admin <-> Everyone`: user management, role governance, and system-wide visibility.

## Tech Stack

### Frontend
- React 19
- React Router 6
- Tailwind CSS
- Axios
- Heroicons
- React App Rewired

### Backend
- Node.js
- Express 5
- Sequelize
- MySQL / MariaDB
- JWT
- bcryptjs
- express-validator
- helmet
- cors
- multer

## Project Structure

```text
Football-Field-Booking-App/
|-- backend/
|   |-- src/
|   |   |-- config/
|   |   |-- controllers/
|   |   |-- middleware/
|   |   |-- models/
|   |   |-- routes/
|   |   `-- utils/
|   |-- server.js              # Full production server
|   |-- server-simple.js       # Lightweight server with mock data
|   |-- mock-server.js         # Complete mock server
|   `-- package.json
|-- frontend/
|   |-- public/
|   |-- src/
|   |   |-- components/
|   |   |-- context/
|   |   |-- pages/
|   |   |-- services/
|   |   `-- utils/
|   |-- package.json
|   `-- tailwind.config.js
`-- README.md
```

## Prerequisites

- Node.js 18+
- MySQL 8+ or MariaDB
- npm

## Getting Started

### 1. Install dependencies

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 2. Configure the backend

Create `backend/.env`:

```env
NODE_ENV=development
PORT=5000
JWT_SECRET=replace_with_a_secret_at_least_32_characters_long
JWT_EXPIRES_IN=7d

DB_HOST=localhost
DB_PORT=3306
DB_NAME=football_booking
DB_USER=root
DB_PASSWORD=your_password

CORS_ORIGIN=http://localhost:3000
RATE_LIMITING=true
HTTP_LOGGING=true
DB_SYNC_ALTER=false
APP_TIMEZONE=Asia/Bangkok

# Optional: enables league data pages
FOOTBALL_API_KEY=your_football_data_org_api_key
```

Notes:
- `JWT_SECRET` is required and must be at least 32 characters.
- If `FOOTBALL_API_KEY` is missing, the league endpoints return `503` and the rest of the app still works.

### 3. Create the database

```sql
CREATE DATABASE football_booking;
```

### 4. Seed demo data

From `backend/`:

```bash
npm run seed
```

Sample seeded accounts:
- `admin1@example.com / Password123`
- `field_owner2@example.com / Password123`
- `captain5@example.com / Password123`
- `player10@example.com / Password123`

### 5. Start the backend

From `backend/`:

**Option 1: Full production server (requires database)**
```bash
npm run dev
```

**Option 2: Simple server with mock data (no database required)**
```bash
npm run dev:simple
```

**Option 3: Mock server for frontend development**
```bash
npm run dev:mock
```

Backend URLs:
- API root: `http://localhost:5000/`
- Health check: `http://localhost:5000/health`

### 6. Start the frontend

From `frontend/`:

```bash
npm start
```

Frontend URL:
- `http://localhost:3000`

The frontend defaults to `/api` and uses the local proxy in development, so a frontend `.env` file is optional unless you want to override `REACT_APP_API_URL`.

## Available Scripts

### Backend

```bash
npm start         # start production server (server.js)
npm run dev       # start with nodemon (server.js)
npm run start:simple    # start simple server (server-simple.js)
npm run dev:simple      # start simple server with nodemon
npm run start:mock    # start mock server (mock-server.js)
npm run dev:mock      # start mock server with nodemon
npm run seed       # reset and seed demo data
npm run db:create  # create database
npm test          # run tests
```

**Server Options:**
- **server.js** - Full production server with database integration
- **server-simple.js** - Lightweight server with mock data and basic auth
- **mock-server.js** - Complete mock server for frontend development

### Frontend

```bash
npm start
npm run build
npm test
npm run lint
npm run lint:fix
```

## Main Routes

### Frontend pages
- Public: `/`, `/fields`, `/fields/:id`, `/teams`, `/teams/:id`, `/league`, `/login`, `/register`
- App area: `/app/dashboard`, `/app/teams`, `/app/bookings`, `/app/open-matches`, `/app/notifications`, `/app/profile`, `/app/settings`
- Owner area: `/owner/dashboard`, `/owner/fields`, `/owner/bookings`, `/owner/matches`
- Admin area: `/app/admin/users`, `/app/admin/role-requests`

### Backend API
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/profile`
- `GET /api/users`
- `GET /api/fields`
- `GET /api/bookings`
- `GET /api/teams`
- `GET /api/public/teams`
- `GET /api/team-members`
- `GET /api/match-results`
- `GET /api/notifications`
- `GET /api/ratings`
- `GET /api/dashboard/stats`
- `GET /api/matches`
- `GET /api/leagues/standings`

## Uploads and Static Assets

Uploaded files are served from:
- `frontend/public/uploads/`
- `backend/uploads/` for backward compatibility

If a field image is missing, the backend falls back to `frontend/public/hero-manu.jpg`.

## Development Options

### Choosing the Right Server

**Use `server.js` (production server) when:**
- You need full database integration
- Testing complete application functionality
- Production-like environment
- All features including real authentication

**Use `server-simple.js` when:**
- Quick frontend development without database setup
- Testing UI components and flows
- Lightweight development environment
- Basic authentication with mock data

**Use `mock-server.js` when:**
- Pure frontend development
- API contract testing
- No backend dependencies needed
- Complete isolation from backend

## Notes for Development

- The backend validates required environment variables during startup.
- In development, Sequelize runs a safe sync by default.
- Set `DB_SYNC_ALTER=true` only if you explicitly want alter-based schema sync.
- The server applies rate limiting, CORS, helmet, compression, and centralized error handling.

## Current Scope

This root README documents the app with its multiple server options:
- **server.js**: Full production server with complete database integration
- **server-simple.js**: Lightweight server with mock data for quick development
- **mock-server.js**: Complete mock server for isolated frontend development

The main application routes and features are consistent across all server variants, with differences in data persistence and authentication methods. Choose the appropriate server based on your development needs as outlined in the Development Options section.

## License

MIT
