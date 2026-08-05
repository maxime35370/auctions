# Auction Intelligence — guide pour Claude Code

Assistant d'investissement pour les enchères : analyse de rentabilité, base de
connaissances des prix, extension Chrome. **Site 100 % statique sur GitHub
Pages** (https://maxime35370.github.io/auctions/) — pas de backend, données en
localStorage. Utilisateur : Maxime (français — répondre en français).

## Commandes

```bash
npm run dev      # http://localhost:3000
npm test         # Vitest — doit rester à 100 % vert
npm run lint     # ESLint
npm run build    # export statique dans out/ (doit passer avant tout commit)
```

## Processus de livraison (établi avec l'utilisateur)

1. Branche de travail : `claude/auction-intelligence-app-e9gxhv`, repartir de
   `origin/main` à chaque itération (`git checkout -B <branche> origin/main`).
2. Tests + lint + build, vérification en navigateur sur l'export statique
   (Playwright, chromium dans /opt/pw-browsers) quand l'UI change.
3. Commit → push → **PR vers main → merge immédiat** (l'utilisateur a validé
   ce fonctionnement). Chaque merge sur main déclenche le déploiement Pages.
4. Petites étapes : une fonctionnalité = une PR. Mettre à jour
   `docs/CAHIER_DES_CHARGES.md` (roadmap) à chaque évolution majeure.

## Architecture (voir docs/CAHIER_DES_CHARGES.md pour le détail)

```
src/lib/engine/     ❤️ moteur métier — fonctions PURES, testées, sans framework
  costs.ts            coût réel façon facture (marteau + frais acheteur +
                      frais plateforme + TVA + déplacement + livraison),
                      budget max (ROI cible 30 %, réduit selon l'origine du lot)
  scoring.ts          score /100 (6 critères pondérés), verdict
  strategy.ts         stratégie conseillée (rapide/normale/optimisée)
  knowledge.ts        stats produits : percentiles, prix d'opportunité (p15/p40),
                      confiance, tendance, maturité, moi-vs-marché, graduation
  advice.ts           checklists, plateformes, origines de lots (pénalités)
src/lib/storage.ts  persistance localStorage derrière une interface — un futur
                    backend ne touchera QUE ce fichier ; zod + valeurs par
                    défaut = migration automatique des données existantes
src/lib/import/     connecteurs (1 site = 1 fichier), format commun
                    StandardAuctionData ; parse.ts = extraction texte testable
                    (prix ancrés sur libellés, grades/origines des cartels,
                    livraison avec garde-fou « sur devis »)
src/lib/cards/      🃏 lots de cartes Pokémon (API pokemontcg.io + dictionnaire
                    FR→EN embarqué pokedex-fr-en.ts)
src/app/            pages client (« use client ») : / (dashboard), /analyse,
                    /objets + /objet, /cartes, /stock, /encheres, /fiche
                    ⚠ routes dynamiques interdites (export statique) → ?id=
extension/          extension Chrome MV3 (popup.js) — payload compact v2 via
                    fragment d'URL #ext-import= / #ext-market=
```

## Principes NON NÉGOCIABLES (validés par l'utilisateur)

- **Le moteur est la source de vérité** : jamais de règle métier dans un
  composant React ; toute règle nouvelle → src/lib/engine + tests.
- **Honnêteté** : jamais de valeur inventée ni de fausse correspondance
  silencieuse. Donnée manquante = champ vide + avertissement (ex. livraison
  « sur devis » ≠ 0 €). Le logiciel dit « je ne peux pas estimer » quand
  c'est le cas.
- **Graduation** : provenance affichée partout — 🔴 Estimation (< 10 données)
  → 🟡 Fiabilité moyenne (10-29) → 🟢 Très fiable (≥ 30). Les heuristiques
  sont remplacées automatiquement par les mesures réelles.
- **Vocabulaire grand public** dans l'UI (pas de jargon technique).
- **Jamais de dépendance API pour le socle** (quotas/CGU changent) ;
  les API publiques (pokemontcg.io) = enrichissement optionnel avec repli.
- **Trois voies d'import** vers le même moteur : 🧩 extension (principale),
  📋 presse-papiers (universelle), 🌐 URL directe (limitée par CORS).

## Pièges connus

- Prisma/SQLite de la V1 supprimés (historique git, PR #1-2) — ne pas
  réintroduire sans demande explicite.
- Export statique : pas d'API routes, pas de `generateStaticParams`,
  `trailingSlash: true`, basePath `/auctions` injecté par le workflow.
- Espaces insécables français dans `euro()` (U+202F) : attention dans les
  tests Playwright (`120 €` ≠ `120 €`).
- pokemontcg.io : base anglophone, extensions 2024+ mal couvertes.
- Réseau sandbox : github.com accessible, la plupart des autres domaines
  bloqués — tester l'UI sur l'export local (python3 -m http.server sur out/),
  jamais contre les API externes.
