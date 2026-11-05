# Firebase: sinhronizacija između Maca i telefona

Aplikacija radi i bez ovoga (podaci samo na uređaju). Kad dodaš Firebase postavke, pri pokretanju se
traži prijava, a podaci se čuvaju u tvom Firebase projektu i vide se na svim uređajima na kojima si
prijavljen. Usluga je besplatna u okviru "Spark" paketa (bez kartice).

## 1. Projekat (jednom, u browseru)

1. Otvori https://console.firebase.google.com (lični Google nalog, ne radni) i klikni **Add project**.
   Ime npr. `troskovi`. Google Analytics ti ne treba, isključi ga.
2. **Project settings** (zupčanik) → **Your apps** → ikona **</>** (Web). Ime npr. `troskovi-web`.
   Ne označavaj "Firebase Hosting". Na kraju se prikaže `firebaseConfig` s vrijednostima
   `apiKey`, `authDomain`, `projectId`, `appId`.
3. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable**.
4. **Build → Firestore Database → Create database**. Izaberi lokaciju blizu sebe (npr. `eur3`
   Europe), **Start in production mode**. Lokacija se poslije ne može promijeniti.
5. Na kartici **Rules** zalijepi sadržaj fajla `firestore.rules` iz ovog projekta i klikni
   **Publish**. Bez toga baza ili nije dostupna ili je (u test modu) otvorena svima.

## 2. Postavke u aplikaciji

U korijenu projekta napravi fajl `.env` (kopija `.env.example`) i upiši vrijednosti iz koraka 2:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
```

`.env` nije u gitu. Ovi podaci nisu tajna (svako ih može vidjeti u izgrađenoj aplikaciji): zaštitu
daju prijava i pravila iz `firestore.rules`.

## 3. Mac aplikacija

```
cd ~/bill-tracker
npm run build:mac
```

Pri prvom pokretanju: **Napravi račun** (e-pošta + lozinka od najmanje 6 znakova). Izbor
"Nastavi bez prijave" i dalje radi lokalno, a u gornjem lijevom uglu stoji "Prijavi se za
sinhronizaciju".

### Prenos postojećih podataka s Maca u oblak

1. U aplikaciji _bez prijave_ (lokalni način) na dnu klikni **Izvezi podatke**: dobiješ JSON fajl.
2. Prijavi se (**Prijavi se za sinhronizaciju**).
3. Na dnu klikni **Uvezi podatke** i izaberi taj fajl. Uvoz zamjenjuje sve što je u oblaku.

## 4. iPhone (web verzija)

```
npm run build:web
```

Folder `dist-web` objavi na bilo koji HTTPS hosting (npr. Netlify Drop), otvori adresu u Safariju i
**Share → Add to Home Screen**. Prijavi se istim nalogom: vidiš iste podatke kao na Macu.

Za brzu provjeru izgleda na telefonu: `npm run dev:web` i otvori `Network` adresu iz terminala.

## Šta znati

- Radi i bez interneta: promjene se spremaju na uređaju i šalju kad se veza vrati.
- Podaci svakog korisnika su odvojeni (`users/{uid}/items`).
- Besplatna kvota (Spark) je za ovu upotrebu više nego dovoljna; tačne brojke provjeri na
  https://firebase.google.com/pricing.
- Zaboravljena lozinka: na ekranu za prijavu klikni "Zaboravljena lozinka?".
