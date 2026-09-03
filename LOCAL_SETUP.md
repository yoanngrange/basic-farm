# Faire tourner basic-farm-api + basic-farm-web en local

Prérequis : Node.js 20+, PostgreSQL 16 **avec l'extension PostGIS**
(natif ou Docker), les deux dossiers `basic-farm-api` et `basic-farm-web`
décompressés côte à côte. PostGIS est requis depuis l'ajout du module
Parcelles (`plots.parcels` stocke de vraies géométries, pas juste un
point) — `schema.sql` fait `CREATE EXTENSION postgis`, qui échoue si
l'extension n'est pas installée sur le serveur.

## 1. Base de données

**Option A — Postgres natif déjà installé, avec PostGIS**
```bash
brew install postgis   # macOS — installe l'extension pour Postgres
createdb basic_farm_dev
psql -d basic_farm_dev -f basic-farm-api/db/schema.sql
```

**Option B — Docker (si tu n'as pas Postgres installé)**
```bash
docker run -d --name basic-farm-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=basic_farm_dev \
  -p 5432:5432 postgis/postgis:16-3.4

psql -h localhost -U postgres -d basic_farm_dev -f basic-farm-api/db/schema.sql
# mot de passe : postgres
```

Si tu veux tester avec des données réalistes plutôt que partir à vide,
utilise `seed.sql` (livré avec le jeu de données initial, 320 annonces) au
lieu de partir d'une base neuve — sinon crée juste un compte et une annonce
à la main via l'interface, c'est aussi bien pour un premier test.

## 2. Lancer l'API

```bash
cd basic-farm-api
npm install
cp .env.example .env
```

Édite `.env` — le minimum vital pour que ça démarre :
```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/basic_farm_dev
JWT_SECRET=n-importe-quelle-chaine-longue-pour-tester
```
(Tout le reste — Brevo, Turnstile, GitHub dispatch — peut rester vide :
ces fonctionnalités se dégradent proprement en mode "skip + log" quand
elles ne sont pas configurées, comme prévu.)

```bash
npm start
```

Vérifie : `curl http://localhost:3000/health` doit répondre `{"status":"ok"}`.

## 3. Lancer le front

Dans un **second terminal** :

```bash
cd basic-farm-web
npm install
cp .env.example .env
```

Édite `.env` :
```
VITE_API_BASE_URL=http://localhost:3000/api
```

Puis génère le site complet (CSR + SSG, exactement comme en prod) :
```bash
npm run build
cd dist && python3 -m http.server 5000 && cd ..
```

`python3 -m http.server` sert les fichiers tels quels, sans réécriture d'URL
— le plus proche du comportement réel de GitHub Pages. (`npx serve dist -l 5000`
fonctionne aussi, mais réécrit les URLs propres et peut se perdre sur les
slugs d'annonces, qui contiennent un uuid long — vérifié pendant la
rédaction de ce guide. Si tu préfères `serve`, accède aux pages avec leur
`.html` explicite pour éviter le souci.)

Ouvre `http://localhost:5000/en/index.html`.

## 4. Parcours de test conseillé

1. `/en/index.html` — vérifie que la page se charge, teste le sélecteur de langue
2. `/register.html` → crée un compte agriculteur
3. `/dashboard.html` → le hub, clique sur "Jobs"
4. `/dashboard-jobs.html` → remplis le formulaire ferme (logo/nom/adresse/pays/email/tel), enregistre
5. "New listing" → crée une annonce, enregistre (elle reste en `draft`)
6. Retour dashboard Jobs → clique "Publish"
7. Va chercher l'annonce sur `/fr/index.html` (ou `/en/`) et clique dessus → vérifie la fiche, le JSON-LD (View Source), le formulaire de contact
8. Soumets le formulaire de contact en tant que "candidat"
9. Retour `/dashboard-jobs.html` → vérifie que le contact apparaît dans la table
10. Essaie `/nimportequoi.html` → `python3 -m http.server` affichera sa propre page d'erreur générique (pas notre 404.html) : c'est normal, GitHub Pages est le seul à servir automatiquement `/404.html` pour les routes inconnues — un comportement propre à la plateforme, pas quelque chose que les serveurs statiques locaux répliquent. Pour voir vraiment le tracteur, ouvre directement `http://localhost:5000/404.html`.
11. Vérifie `/sitemap.xml` et `/robots.txt`

## 5. Ce qui ne peut pas être testé en local

- **Déclenchement GitHub Pages** (`GITHUB_DISPATCH_TOKEN`) : nécessite un vrai repo GitHub distant. En local, ça log juste un warning "skipped" — normal.
- **Emails Brevo** : idem, log un warning si `SMTP_HOST` est vide. Pour tester un vrai envoi, il faut de vraies credentials Brevo.
- **Captcha Turnstile réel** : en local, mets `TURNSTILE_SITE_KEY` à une clé de test (ex. `1x00000000000000000000AA`, clé de démo Cloudflare qui valide toujours) pour voir le bouton s'afficher.

## 6. Une fois satisfait

Retour au déploiement Clever Cloud : même `DATABASE_URL`/`JWT_SECRET` mais
avec de vraies valeurs, plus les credentials Brevo/Turnstile/GitHub à
renseigner dans les variables d'environnement de l'app.
