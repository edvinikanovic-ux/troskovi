# Troskovi

Aplikacija za Mac za praćenje mjesečnih troškova: računi (režije), dodatni troškovi, pretplate,
rate i krediti, mjesec po mjesec. Sekcije i redove u njima možeš poredati kako ti odgovara
(prevuci za ručku ⋮⋮). Podaci se čuvaju samo na tvom računaru.

## Instalacija

Potreban je Mac (Apple Silicon ili Intel). Otvori **Terminal** (Cmd+Space, upiši "Terminal") i
zalijepi ovu komandu:

```bash
curl -fsSL https://github.com/edvinikanovic-ux/troskovi/releases/latest/download/install.sh | bash
```

Skripta skine verziju za tvoj procesor, instalira je u Applications i otvori je.

**Zašto preko Terminala?** Aplikacija nije potpisana Apple Developer certifikatom. Kad se skine
preko browsera, macOS je označi i kaže da je "oštećena i ne može se otvoriti". Kad se skine
preko `curl`-a, te oznake nema.

### Ručna instalacija

1. Na stranici [Releases](https://github.com/edvinikanovic-ux/troskovi/releases/latest) skini
   `Troskovi-arm64.dmg` za Apple Silicon (M1, M2, M3…) ili `Troskovi-x64.dmg` za Intel. Koji
   procesor imaš piše u Apple meniju → About This Mac.
2. Otvori DMG i prevuci Troskovi u Applications.
3. U Terminalu ukloni oznaku "skinuto s interneta":
   ```bash
   xattr -cr /Applications/Troskovi.app
   ```
4. Otvori aplikaciju.

## Ažuriranje

Zatvori aplikaciju (Cmd+Q) i ponovo pokreni komandu iz [Instalacije](#instalacija). Podaci ostaju.

## Podaci

Sve je u jednom fajlu: `~/Library/Application Support/bill-tracker/bills.db`. Ostaje i kad
obrišeš aplikaciju. Za rezervnu kopiju kopiraj taj fajl dok je aplikacija zatvorena, ili u
aplikaciji klikni **Izvezi podatke**.

## Deinstalacija

```bash
rm -rf /Applications/Troskovi.app
# i podaci, ako ih više ne trebaš:
rm -rf ~/Library/Application\ Support/bill-tracker
```

## Za developere

Electron + React + TypeScript, podaci u SQLite (`better-sqlite3`). Treba Node.js 22 ili noviji.

```bash
npm install
npm run dev            # Mac aplikacija u razvojnom modu
npm run typecheck
npm run lint
npm run test:parity    # testovi sloja podataka (SQLite i browser verzija moraju se slagati)
npm run dev:web        # ista aplikacija u browseru, podaci u localStorage
```

### Novo izdanje

1. Podigni `version` u `package.json` (tag izdanja je `v` + verzija).
2. Prijavi GitHub CLI na github.com: `gh auth login --hostname github.com`
3. Pokreni:
   ```bash
   scripts/release.sh edvinikanovic-ux/troskovi
   ```
   Skripta builda DMG za Apple Silicon i Intel i objavi ih na GitHubu zajedno s `install.sh`, pa
   komanda iz [Instalacije](#instalacija) odmah instalira novu verziju.
