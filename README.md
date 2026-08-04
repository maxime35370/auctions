# ◆ Auction Intelligence

Assistant d'investissement spécialisé dans les enchères : analyse de rentabilité,
budget maximal conseillé, scoring sur 100 et historique des enchères observées.

**➡ Application en ligne : https://maxime35370.github.io/auctions/**

Aucune installation nécessaire : l'application tourne entièrement dans le
navigateur. Les données sont stockées localement (localStorage) et peuvent être
sauvegardées / restaurées en JSON depuis la page Historique.

## Utilisation

- **Tableau de bord** — enchères observées, pépites, ROI moyen, top
  opportunités, catégories les plus rentables
- **Nouvelle analyse** — URL ou saisie manuelle (titre, catégorie, maison de
  vente, prix, frais acheteur, TVA, déplacement, livraison, état,
  commentaires…) avec analyse **en temps réel**
- **Historique** — toutes les enchères, avec ⬇ Sauvegarder / ⬆ Importer (JSON)
- **Fiche** — détail complet, modification, suppression

## Règles métier

- **Frais acheteur** = prix marteau × frais %
- **TVA** = (prix marteau + frais) × TVA %
- **Coût total réel** = marteau + frais + TVA + déplacement + livraison
- **Bénéfice net** = prix de revente − coût total réel (3 scénarios :
  rapide / normal / optimisé)
- **ROI** = bénéfice net ÷ coût total réel
- **Budget maximal conseillé** = prix marteau le plus élevé qui préserve un
  ROI de 30 % sur le scénario de revente « normal »
- **Score /100** = moyenne pondérée de 6 critères : rentabilité (35 %),
  risque maîtrisé (20 %), facilité de revente (15 %), popularité (10 %),
  remise en état (10 %), confiance (10 %). Verdicts : ≥ 80 💎 Pépite,
  ≥ 65 ✅ Bonne affaire, ≥ 50 🟡 Correct, < 50 🔴 À éviter.

## Stack technique

| Couche | Choix | Pourquoi |
|---|---|---|
| Application | **Next.js 15** (TypeScript, export statique) | React moderne, déployable sur GitHub Pages |
| Données | **localStorage** derrière une couche `storage.ts` | zéro serveur ; interface prête pour un futur backend |
| Styles | **Tailwind CSS 4** | UI moderne et rapide à faire évoluer |
| Validation | **zod** | import JSON et lecture du stockage sécurisés |
| Tests | **Vitest** | le moteur de calcul est testé unitairement |

## Architecture

```
src/
  lib/
    engine/            # ❤️ MOTEUR MÉTIER — fonctions pures, sans framework
      types.ts         #   types + catégories + états
      costs.ts         #   coût total réel, budget max, scénarios de revente
      scoring.ts       #   6 critères pondérés → score /100 + verdict
      index.ts         #   analyzeAuction() : point d'entrée unique
      __tests__/       #   tests unitaires des règles métier
    storage.ts         # persistance navigateur (localStorage) + export/import
    examples.ts        # données de démonstration
    format.ts          # formatage € / % / dates
  app/
    page.tsx           # tableau de bord
    analyse/           # formulaire (création et édition via ?id=)
    encheres/          # historique + sauvegarde/restauration
    fiche/             # fiche détaillée (?id=)
  components/          # AnalysisPanel, AuctionForm, ScoreStars
.github/workflows/deploy.yml  # build + déploiement GitHub Pages automatique
```

**Principes de conception :**

- **Le moteur est la source de vérité.** `analyzeAuction()` calcule tout ;
  le stockage n'enregistre que des snapshots recalculés à chaque sauvegarde.
- **Fonctions pures, testées.** Les règles métier vivent dans
  `src/lib/engine`, jamais dans les composants React.
- **Stockage isolé.** Toutes les pages passent par `src/lib/storage.ts` ;
  réintroduire un backend (SQLite/PostgreSQL + API) ne touchera que ce
  fichier. La version serveur initiale (Prisma + API REST) reste disponible
  dans l'historique git si besoin.

## Développement local

```bash
npm install
npm run dev    # http://localhost:3000
npm test       # tests du moteur
npm run build  # export statique dans out/
```

## Déploiement

Automatique : chaque push sur `main` déclenche le workflow GitHub Actions
(tests → build → publication sur GitHub Pages).

Prérequis une seule fois : **Settings → Pages → Source = « GitHub Actions »**.

## Feuille de route

- **V2 — Base de connaissances** : fiches objets, historique des prix réels,
  lots multi-objets, conseils de revente par plateforme, radar des pépites.
- **Intelligence** : popularité et facilité de revente apprises depuis les
  ventes réelles (au lieu des heuristiques de `scoring.ts`).
- **V-future** : import automatique d'une annonce depuis son URL, recherche de
  prix multi-plateformes, notifications — ces fonctions nécessiteront un
  backend, que la couche `storage.ts` permet de brancher sans refonte.
