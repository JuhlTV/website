# Feuerwehr Checkliste System

Moderne, mobile-first Webanwendung fuer die digitale Fahrzeugpruefung der Freiwilligen Feuerwehr.

## Features

- Login mit Rollen (`benutzer`, `geraetewart`)
- Fahrzeugauswahl fuer FF Rellingen
- Dynamische Checklisten je Fahrzeug
- Maengelverwaltung mit Prioritaet, Zeitstempel, Benutzer
- PDF-Berichtserstellung mit Unterschriftsfeld
- E-Mail-Versand des Berichts (SMTP, z. B. Gmail)
- Dashboard mit Report-Uebersicht
- Vorbereitet fuer Railway Deployment

## Projektstruktur

- `frontend/` React + Vite App
- `backend/` Express API + MongoDB + PDF + Mail

## Schnellstart lokal

1. Abhaengigkeiten installieren:

```bash
npm install
```

2. Backend-Umgebung konfigurieren:

- Datei `backend/.env.example` nach `backend/.env` kopieren
- Werte eintragen (MongoDB, JWT, SMTP)

3. Entwicklungsmodus starten:

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:4000

## Standardnutzer (Seed)

Beim ersten Start wird ein Geraetewart erstellt, falls er nicht existiert:

- Benutzername: `admin`
- Passwort: `admin12345`
- Rolle: `geraetewart`

Passwort nach dem ersten Login aendern.

## Railway Deployment (Kurz)

1. MongoDB-Service in Railway erstellen.
2. App deployen (Node.js).
3. Environment-Variablen aus `backend/.env.example` setzen.
4. Build Command:

```bash
npm install && npm run build
```

5. Start Command:

```bash
npm run start
```

## Railway Deployment (Empfohlen)

1. Services im selben Railway-Projekt:

- Service A: App (`website`)
- Service B: MongoDB

2. Im App-Service unter Variables setzen:

- `NODE_ENV=production`
- `MONGO_URL=<Railway Reference auf Mongo interne URL>`
- `JWT_SECRET=<lange zufaellige Zeichenkette>`
- `JWT_EXPIRES_IN=12h`
- `FRONTEND_ORIGIN=https://<deine-app-domain>`
- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=587`
- `SMTP_SECURE=false`
- `SMTP_USER=<gmail-adresse>`
- `SMTP_PASS=<gmail-app-passwort>`
- `SMTP_FROM=<gmail-adresse>`

3. Wichtig:

- Kein `PORT` setzen (Railway setzt ihn automatisch).
- Fuer Railway-Mongo `MONGO_URL` nutzen, nicht localhost.
- Wenn `MONGO_URL` gesetzt ist, nutzt die App automatisch diese interne Verbindung.

4. Build/Start:

- Build: via `railway.json` automatisch
- Start: `npm run start`

## Erweiterungen (Roadmap)

- Push-Benachrichtigungen bei kritischen Maengeln
- Fahrzeug-Historie
- Wartungsuebersicht
- Offline-Modus (PWA + Sync)
