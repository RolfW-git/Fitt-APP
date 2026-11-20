# 🚴 Tretmann Web-App (PWA)

Die moderne, schnelle und zuverlässige Progressive Web App zur Erfassung und Auswertung von Ergometer-Trainingseinheiten – optimiert für Smartphone (Android/iOS) und PC.

---

## 🌟 Vorteile gegenüber der Python/Kivy-App
- **100 % zuverlässig**: Kein Buildozer, keine NDK-Kompilierung, keine Android-Sicherheitsabbrüche oder Scoped-Storage-Fehler.
- **Echtes App-Feeling**: Kann mit einem Klick über den Browser ("Zum Startbildschirm hinzufügen") als vollwertige Vollbild-App auf dem Smartphone installiert werden.
- **Vollständig Offline-fähig**: Verwendet den internen `IndexedDB`-Speicher des Smartphones sowie einen `Service Worker` – funktioniert ohne Internetverbindung.
- **Automatische Formatierung**:
  - **Datum**: Tippe z. B. nur `19` ein, und die App vervollständigt automatisch auf `19.11.2026`.
  - **Zeit**: Tippe `30` ein, und die App macht automatisch `30:00` daraus.
- **Personalisierung**: Werte wie Widerstand, RPM oder Trainingszeit können pro Person als Standard hinterlegt werden.
- **Sicherheit & Backup**: Integrierter Ein-Klick-Export und Import für JSON-Backups.

---

## 🚀 So startest du die App

### Option A: Sofort am PC testen (ohne Installation)
Doppelklicke einfach auf die Datei `index.html` im Ordner:
`E:\Meine Python\2026\Tretmann\Tretmann WEB-APP\index.html`

### Option B: Über das lokale WLAN auf dem Android-Smartphone öffnen
Damit der Offline-Service-Worker aktiv wird und du die App auf dem Handy installieren kannst, starte im Ordner einen kleinen lokalen Python-Webserver:

1. Öffne ein Terminal (PowerShell oder Eingabeaufforderung) in diesem Verzeichnis:
   ```powershell
   cd "E:\Meine Python\2026\Tretmann\Tretmann WEB-APP"
   python -m http.server 8000
   ```
2. Ermittle die IP-Adresse deines PCs im WLAN (z. B. `192.168.178.50`).
3. Öffne auf deinem Android-Handy Chrome und rufe auf:
   ```text
   http://192.168.178.50:8000
   ```
4. Im Chrome-Menü (drei Punkte oben rechts) auf **„App installieren“** oder **„Zum Startbildschirm hinzufügen“** tippen. Fertig! Die App hat jetzt ein eigenes App-Symbol und startet wie eine echte native App.

### Option C: Dauerhaft kostenlos auf GitHub Pages hosten (Empfohlen)
Da du ohnehin ein GitHub-Repository hast, kannst du die Dateien einfach auf GitHub hochladen:
1. Erstelle ein Repository (z. B. `tretmann-app`) oder erstelle einen Branch `gh-pages`.
2. Lade den Inhalt dieses Ordners (`index.html`, `style.css`, `app.js`, `manifest.json`, `sw.js`, `icon.svg`) hoch.
3. Aktiviere in den GitHub-Repository-Einstellungen unter **Pages** die Bereitstellung.
4. Du erhältst eine HTTPS-Adresse (z. B. `https://RolfW-git.github.io/tretmann-app/`), die du auf jedem Handy der Welt ohne Server mit voller HTTPS-Unterstützung öffnen und als App installieren kannst.

---

## 📱 Enthaltene Funktionen
1. **Eingabemaske**:
   - Name mit Dropdown-Auswahl aller bisherigen Personen.
   - Datum mit Schnellvervollständigung.
   - Widerstand, Distanz (km), RPM, Trainingszeit, Durchschnitts-km/h, Kalorien, Puls.
   - **⭐ Voreinstellen**: Speichert die aktuell eingegebenen Trainingsparameter als Standard für die ausgewählte Person.
2. **Daten- & Monatsübersicht**:
   - Gesamtkilometerstand der Person über alle Trainings.
   - Monatszusammenfassung: Trainingsanzahl, Monatsdistanz, Gesamtzeit, Kalorien, Durchschnittspuls und Durchschnittsgeschwindigkeit.
   - Filter nach Name, Monat und Jahr.
   - **📅 Tag**: Monatskalender-Ansicht mit Markierung aller Tage, an denen ein Training absolviert wurde.
   - **✏️ Ändern** & **🗑️ Löschen** bestehender Trainingseinheiten.
3. **Datensicherung**:
   - **💾 Export**: Lädt alle Trainings und Profile als JSON-Datei herunter.
   - **📂 Import**: Stellt Trainings und Profile aus einer zuvor exportierten Datei wieder her.
