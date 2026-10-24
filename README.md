# PINGED

Manhunt in echt: Jäger gegen Läufer, draußen in deiner Stadt. Die Jäger sehen die Läufer nur, wenn sie gepingt werden.

## Was hier drin ist

| Ordner / Datei | Inhalt |
| --- | --- |
| `src/app.src.html` | Aufbau und Design aller Screens |
| `src/app.js` | Spiellogik, Onboarding, Einwilligungen, Pass-Kauf, Trailer |
| `recht/` | AGB, Datenschutz, Impressum, Widerruf, Eltern-Einwilligung, Sicherheitsregeln, Community-Richtlinien |
| `supabase/migrations/` | Datenbank-Schema mit Row Level Security |
| `public/index.html` | Fertig gebaute App (wird von Netlify ausgeliefert) |
| `netlify.toml` | Build- und Sicherheits-Einstellungen für Netlify |

## Bauen

```
npm run build
```

Erzeugt `public/index.html` aus `src/` und `recht/`. Kein `npm install` nötig.

## Stand

Der aktuelle Stand ist ein spielbarer Prototyp: Die Runde läuft mit computergesteuerten Mitspielern, entweder im Demo-Modus oder mit echtem GPS.

Die Spielkarte nutzt MapLibre mit Kartendaten von OpenFreeMap (© OpenStreetMap-Mitwirkende). Das ist gratis, braucht keinen API-Schlüssel und darf kommerziell genutzt werden. Ist die Karte nicht erreichbar, schaltet die App auf ihre eingebaute Karte um. Käufe, E-Mails und SOS-Benachrichtigungen sind nur angedeutet.

Das Supabase-Schema für echtes Multiplayer mit GPS ist fertig (Profile, Einwilligungs-Protokoll, Runden, Pings, Käufe, Meldungen). Die App nutzt es noch nicht.

## Vor dem Launch

- Alle Rechtstexte von einem Anwalt prüfen lassen und die Angaben in eckigen Klammern ausfüllen.
- Echte Käufe über Apple und Google (In-App-Kauf) anbinden.
- E-Mail-Versand für Eltern-Bestätigung und Kaufbestätigung einrichten.
- Echte GPS-Standorte und Supabase Realtime anbinden, Löschjob `pinged_cleanup_positions()` stündlich planen.
