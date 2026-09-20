# CLAUDE.md

Richtlijnen en projectcontext voor de website van Wimpie & de Domino's.

## Project Context

Officiële publieke website voor muziekformatie "Wimpie & de Domino's" in Amsterdam. Bevat informatie over optredens, de band, boeken, single releases en de Wall of Fame.

- **UI-taal:** Nederlands.
- **Hosting en Publisher:** Netlify (`wimpie.netlify.app`).
- **Productiedomein:** `wimpieendedominos.nl` (en `www.wimpieendedominos.nl`).
- **Registrar / DNS beheer:** mijn.host.

## Tech Stack

- **Frontend:** Vanilla HTML5, Tailwind CSS (CDN), Lucide Icons, Vanilla JavaScript (`app.js`, `single.js`).
- **Audio:** Lokale audiobestanden (`audio/intro.mp3`) voor cognitive accessibility en voorleesfunctie.
- **Deployment:** Netlify (automatische deployment gekoppeld aan de GitHub repository `juiceboyy/wimpie`).

## DNS Instellingen (mijn.host naar Netlify)

- **Apex (`@`):** `A` record wijst naar `75.2.60.5`
- **Subdomein (`www`):** `CNAME` record wijst naar `wimpie.netlify.app`
