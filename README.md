# ◆ Auction Intelligence

Assistant d'investissement spécialisé dans les enchères : analyse de rentabilité,
budget maximal conseillé, scoring sur 100 et historique des enchères observées.

L'objectif n'est pas d'être un simple calculateur, mais de construire
progressivement une **base de connaissances** capable d'indiquer automatiquement
si une enchère est une bonne affaire.

## Stack technique

| Couche | Choix | Pourquoi |
|---|---|---|
| Frontend + Backend | **Next.js 15** (App Router, TypeScript) | une seule app moderne : pages React + API REST |
| Base de données | **SQLite** via **Prisma** | zéro configuration en local, migration PostgreSQL triviale |
| Styles | **Tailwind CSS 4** | UI moderne et rapide à faire évoluer |
| Validation | **zod** | schémas partagés entre les routes API |
| Tests | **Vitest** | le moteur de calcul est testé unitairement |

## Démarrage

```bash
npm install            # installe les dépendances + génère le client Prisma
cp .env.example .env   # (déjà fourni : SQLite locale)
npx prisma migrate dev # crée la base de données locale
npx prisma db seed     # (optionnel) 3 enchères d'exemple
npm run dev            # http://localhost:3000
```

Autres commandes : `npm test` (tests du moteur), `npm run db:studio`
(explorateur de base), `npm run build && npm start` (production).

## Architecture

```
prisma/
  schema.prisma        # Auction (analyses) + Item (fiches objets, V2)
  seed.ts              # données d'exemple
src/
  lib/
    engine/            # ❤️ MOTEUR MÉTIER — fonctions pures, sans framework
      types.ts         #   types + catégories + états
      costs.ts         #   coût total réel, budget max, scénarios de revente
      scoring.ts       #   6 critères pondérés → score /100 + verdict
      index.ts         #   analyzeAuction() : point d'entrée unique
      __tests__/       #   tests unitaires des règles métier
    prisma.ts          # client Prisma singleton
    validation.ts      # schémas zod des entrées API
    format.ts          # formatage € / % / dates (affichage uniquement)
  app/
    page.tsx           # tableau de bord (stats, pépites, catégories)
    analyse/           # formulaire d'analyse avec aperçu en temps réel
    encheres/          # historique + fiche détaillée + édition
    api/auctions/      # API REST (CRUD, recalcul systématique côté serveur)
  components/          # AnalysisPanel, AuctionForm, ScoreStars…
```

**Principes de conception :**

- **Le moteur est la source de vérité.** `analyzeAuction()` est appelé par le
  navigateur (aperçu en direct) *et* par le serveur (persistance). Les chiffres
  envoyés par le client ne sont jamais enregistrés tels quels.
- **Fonctions pures, testées.** Toute évolution des règles métier se fait dans
  `src/lib/engine`, jamais dans les composants React.
- **Schéma prêt pour la V2.** La table `Item` (fiches objets) et les champs
  `finalPrice` / `soldPrice` / `status` existent déjà pour accueillir
  l'historique des prix réels et l'apprentissage.

## Règles métier (V1)

- **Frais acheteur** = prix marteau × frais %
- **TVA** = (prix marteau + frais) × TVA %
- **Coût total réel** = marteau + frais + TVA + déplacement + livraison
- **Bénéfice net** = prix de revente − coût total réel (par scénario :
  rapide / normal / optimisé)
- **ROI** = bénéfice net ÷ coût total réel
- **Budget maximal conseillé** = prix marteau le plus élevé qui préserve un
  ROI de 30 % sur le scénario de revente « normal »
- **Score /100** = moyenne pondérée de 6 critères : rentabilité (35 %),
  risque maîtrisé (20 %), facilité de revente (15 %), popularité (10 %),
  remise en état (10 %), confiance (10 %). Verdicts : ≥ 80 💎 Pépite,
  ≥ 65 ✅ Bonne affaire, ≥ 50 🟡 Correct, < 50 🔴 À éviter.

## Feuille de route

- **V2 — Base de connaissances** : fiches objets (`Item`, déjà en base),
  historique des prix réels, lots multi-objets, conseils de revente par
  plateforme, radar des pépites dédié.
- **Intelligence** : popularité et facilité de revente apprises depuis les
  ventes réelles (au lieu des heuristiques actuelles de `scoring.ts`) —
  l'interface `ScoreCriterion` ne changera pas.
- **V-future** : import automatique d'une annonce depuis son URL, recherche de
  prix multi-plateformes, détection du modèle, estimation des frais de
  transport, notifications.

## Migration vers PostgreSQL

1. `prisma/schema.prisma` : `provider = "postgresql"`
2. `.env` : `DATABASE_URL="postgresql://user:password@host:5432/auctions"`
3. `npx prisma migrate dev`

Aucun type spécifique à SQLite n'est utilisé (les JSON sont sérialisés en
texte), la migration ne demande aucun autre changement.
