# Auction Intelligence — Cahier des charges

> Document de référence de l'architecture et de la feuille de route.
> Chaque module futur doit s'inscrire dans ce cadre — mise à jour à chaque
> évolution majeure.

## 1. Vision

Un **assistant d'investissement spécialisé dans les enchères**, pas un simple
calculateur. Il répond à cinq questions :

1. Faut-il acheter ?
2. Jusqu'à quel prix enchérir ?
3. Quel bénéfice espérer (brut et réel) ?
4. Quelle stratégie de revente est la plus rentable ?
5. Quels sont les risques ?

À terme : gestion de **capital** (portefeuille, stock, ventes) et **base de
connaissances** qui rend les recommandations de plus en plus fiables.

## 2. Principes d'architecture (non négociables)

| Principe | Concrètement |
|---|---|
| **Le moteur est la source de vérité** | Tous les calculs dans `src/lib/engine` (fonctions pures, testées). Jamais de règle métier dans un composant React. |
| **Le stockage est isolé** | Toutes les pages passent par `src/lib/storage.ts`. Changer de backend (localStorage → API/PostgreSQL) ne touche que ce fichier. |
| **Les connecteurs sont indépendants** | 1 site = 1 connecteur (`src/lib/import/connectors/`). Tous produisent le même `StandardAuctionData`. Ajouter un site n'impacte rien d'autre. |
| **Les heuristiques sont remplaçables** | Popularité, délais, probabilités : valeurs documentées aujourd'hui, statistiques réelles demain — mêmes interfaces. |
| **Petites étapes validées** | Une fonctionnalité = une PR = un déploiement. Jamais de refonte massive. |

## 3. Écrans

| Écran | Route | Contenu |
|---|---|---|
| Tableau de bord | `/` | 🔥 Pépite du jour, stats, 🏆 portefeuille, ⚡ fins d'enchères proches, podium des catégories (ventes réelles), meilleures opportunités |
| Nouvelle analyse | `/analyse` | ⚡ assistant d'import (URL / 📋 presse-papiers / 🧪 démo) + formulaire complet + analyse en temps réel |
| Édition | `/analyse?id=…` | même formulaire, pré-rempli |
| Fiche | `/fiche?id=…` | photos, infos, ⚠️ checklist, 🏁 résultat réel, 🔄 pipeline, analyse complète |
| Mon stock | `/stock` | lots possédés + avancement, capital engagé, valeur du stock, bénéfice latent/réalisé |
| Historique | `/encheres` | table de toutes les enchères + ⬇ sauvegarde / ⬆ import JSON |

## 4. Modèle de données (`AuctionRecord`)

- **Saisie** : titre, catégorie, maison de vente, localisation, URL, date de
  fin, photos (URLs), état, commentaires
- **Coûts d'achat** : prix actuel, frais acheteur %, TVA %, déplacement, livraison
- **Revente** : 3 prix (rapide/normale/optimisée), commission plateforme %,
  frais de revente fixes, gain minimum visé
- **Temps** : remise en état, nettoyage, photos, annonce, emballage, SAV (heures)
- **Suivi** : statut (analysée → suivie → achetée → revendue / perdue),
  checklist cochable, pipeline (7 étapes), prix d'adjudication réel, prix de
  revente réel
- **Snapshot calculé** : coût total, budget max, gains, ROI, score

Migration des données : chaque lecture passe par un schéma zod avec valeurs
par défaut — les anciens enregistrements restent valides à chaque évolution.

## 5. Moteur de calcul (`src/lib/engine`)

- **Coûts** : total réel = marteau + frais % + TVA (sur marteau+frais) +
  déplacement + livraison
- **Gains** : brut = revente − coût total ; **réel** = brut − commission % −
  frais fixes de revente ; ROI = réel / coût total
- **Budget max** : prix marteau préservant 30 % de ROI sur la revente normale
- **Stratégie** (`strategy.ts`) : rapide si ≥ 80 % du meilleur gain ;
  optimisée si supplément ≥ 100 € et ≥ 25 % ; normale sinon ; « ne pas
  acheter » si tout est perdant. Délais/probabilités heuristiques (V2 : réels)
- **Score /100** (`scoring.ts`) : rentabilité 35 %, risque 20 %, facilité de
  revente 15 %, popularité 10 %, temps de travail 10 %, confiance 10 %.
  Verdicts : ≥ 80 pépite, ≥ 65 bonne affaire, ≥ 50 correct, < 50 à éviter
- **Conseils** (`advice.ts`) : explication ✔/✘ du score, plateformes par
  catégorie, checklists par catégorie

## 6. Import (`src/lib/import`)

```
URL / texte collé
      ↓
registry.detectConnector(url)         ← 1 site = 1 connecteur
      ↓
connector.extract({url, html, report})  → raconte sa progression (ImportStep)
      ↓
StandardAuctionData                   ← format commun à tous les connecteurs
      ↓
importer.toDraft()                    → catégorie/état devinés, défauts sûrs
      ↓
Formulaire pré-rempli → moteur d'analyse
```

- **Connecteurs actuels** : `demo` (jeu de données réaliste, teste tout le
  flux), `interencheres` (sélecteurs spécifiques + générique en filet),
  `generic` (JSON-LD schema.org → OpenGraph → heuristiques texte)
- **Acquisition** : site statique ⇒ l'accès direct dépend du CORS du site
  cible. Modes : fetch direct (quand autorisé) et 📋 presse-papiers
  (universel). **Principe : ne jamais dépendre d'une API** (quotas, tarifs et
  autorisations changent) — les API officielles (eBay…) seront un bonus
  optionnel, jamais le socle
- **📊 Étude de marché** (`market.ts`) : la voie principale d'alimentation —
  coller une page de résultats entière → extraction de toutes les annonces
  (prix + contexte, frais de port filtrés) → résumé (n, min/moyen/maxi,
  médiane, 🎯 opportunité) → l'utilisateur valide, jamais l'application
- **Progression** : chaque étape est annoncée (✅ site reconnu, 📷 5 photos
  trouvées, ⚠ frais non trouvés) — jamais de « analyse impossible » sec

## 7. Backend futur (quand le besoin arrivera)

Déclencheurs : synchronisation multi-appareils, base de prix partagée,
notifications. Plan : API Node (Next.js API routes ou Fastify) + PostgreSQL +
Prisma (le schéma initial existe dans l'historique git, PR #1). `storage.ts`
devient un client d'API — les pages ne changent pas.

## 8. Feuille de route

| Étape | Contenu | État |
|---|---|---|
| V1 | Analyse, scoring, scénarios | ✅ livré |
| V1.1 | Site statique GitHub Pages + localStorage | ✅ livré |
| V1.2 | Conseils (stratégie, jauge, checklist), stock, portefeuille | ✅ livré |
| V1.3 | Connecteurs + import démo/presse-papiers + progression | ✅ livré |
| V2 | **Base de connaissances** : fiches produits, ventes observées multi-sources, courbe de prix, prix suggérés (percentiles), indice de confiance calculé, tendance/indice de marché, analyse intelligente (produit connu), transactions → observations automatiques | ✅ livré |
| V2.1 | **Moteur statistique** : 🎯 prix d'opportunité (p15/p40, zones d'achat), stabilité (écart-type/CV), moi vs marché, temps moyen de revente réel, observations rejetées (3ᵉ base) ; **📊 Étude de marché** : import en masse d'une page de résultats collée (eBay/Leboncoin/Marketplace) → dizaines d'observations validées d'un clic | ✅ livré |
| V2.2 | Connecteur Interencheres affiné sur pages réelles ; bibliothèque de snapshots datés comparables ; temps de vente réels alimentant délais et probabilités des scénarios | à venir |
| V3 | Backend + comptes + synchronisation ; alertes/notifications ; détection automatique du modèle depuis titre/photos | à venir |

## 9. Qualité

- Tests unitaires (Vitest) obligatoires pour moteur et parsing d'import
- Lint + build + tests à chaque push (GitHub Actions) avant déploiement Pages
- Vérification manuelle du parcours complet en navigateur avant chaque merge
- Les données utilisateur ne se perdent jamais : zod + valeurs par défaut,
  export/import JSON
