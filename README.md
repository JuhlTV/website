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
- Dateibasierter Betrieb ohne Datenbank (JSON + PDF im Backend)
- Automatische Loeschung alter Berichte/PDFs nach 30 Tagen
- Vorbereitet fuer Railway Deployment

## Projektstruktur

- `frontend/` React + Vite App
- `backend/` Express API + file-based Storage + PDF + Mail

## Schnellstart lokal

1. Abhaengigkeiten installieren:

```bash
npm install
```

2. Backend-Umgebung konfigurieren:

- Datei `backend/.env.example` nach `backend/.env` kopieren
- Werte eintragen (JWT, SMTP)

3. Entwicklungsmodus starten:

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:4000

## Standardnutzer (Seed)

Benutzer werden ausschliesslich per Script gesetzt (kein Register-Endpunkt):

```bash
npm run access:set -w backend -- --password dein_sicheres_passwort --role geraetewart
```

Rollen: `benutzer` oder `geraetewart`.
Fuer `geraetewart` ist kein Username noetig (intern wird `geraetewart` verwendet).

## Railway Deployment (Kurz)

1. App deployen (Node.js).
2. Environment-Variablen aus `backend/.env.example` setzen.
3. Build Command:

```bash
npm install && npm run build
```

4. Start Command:

```bash
npm run start
```

## Railway Deployment (Empfohlen)

1. Service im Railway-Projekt:

- Service A: App (`website`)

2. Im App-Service unter Variables setzen:

- `NODE_ENV=production`
- `JWT_SECRET=<lange zufaellige Zeichenkette>`
- `JWT_EXPIRES_IN=12h`
- `FRONTEND_ORIGIN=https://website-production-17fc.up.railway.app`
- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=587`
- `SMTP_SECURE=false`
- `SMTP_USER=<gmail-adresse>`
- `SMTP_PASS=<gmail-app-passwort>`
- `SMTP_FROM=<gmail-adresse>`

3. Wichtig:

- Kein `PORT` setzen (Railway setzt ihn automatisch).
- Die App speichert Berichte/Benutzer lokal in `backend/storage`.
- Alte Berichte und PDF-Dateien werden automatisch nach 30 Tagen geloescht.

4. Build/Start:

- Build: via `railway.json` automatisch
- Start: `npm run start`

## Erweiterungen (Roadmap)

- Push-Benachrichtigungen bei kritischen Maengeln
- Fahrzeug-Historie
- Wartungsuebersicht
- Offline-Modus (PWA + Sync)
