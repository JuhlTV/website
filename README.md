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
- `backend/` Express API + MySQL + PDF + Mail
- `backend/database/schema.sql` Datenbankschema

## Schnellstart lokal

1. Abhaengigkeiten installieren:

```bash
npm install
```

2. Backend-Umgebung konfigurieren:

- Datei `backend/.env.example` nach `backend/.env` kopieren
- Werte eintragen (MySQL, JWT, SMTP)

3. Datenbank anlegen:

- SQL aus `backend/database/schema.sql` ausfuehren

4. Entwicklungsmodus starten:

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

1. MySQL-Service in Railway erstellen.
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

## Erweiterungen (Roadmap)

- Push-Benachrichtigungen bei kritischen Maengeln
- Fahrzeug-Historie
- Wartungsuebersicht
- Offline-Modus (PWA + Sync)
