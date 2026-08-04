# 🧩 Extension Chrome/Edge — Auction Intelligence

Deux boutons, deux gestes :

- **🔍 Analyser cette enchère** — depuis la page d'un lot (Interencheres en
  priorité, mais aussi Agorastore, Leboncoin, eBay…) : extrait titre, prix,
  frais, quantité, localisation, date de fin, état, photos et ouvre la page
  Nouvelle analyse pré-remplie. Le produit est reconnu automatiquement si sa
  fiche existe, et les prix du marché déjà connus s'appliquent.
- **📊 Actualiser le marché** — depuis une page de résultats (eBay « ventes
  réussies »…) : envoie toutes les annonces vers la bonne fiche produit,
  avec prévisualisation avant validation. Fini le Ctrl+A / Ctrl+C.

L'extension envoie un **JSON compact et structuré** (jamais la page brute),
avec repli automatique si le contenu est trop volumineux.

## Confidentialité

- Permission **`activeTab` uniquement** : l'extension n'accède qu'à la page où
  vous cliquez, au moment où vous cliquez — jamais en arrière-plan, sur aucun
  autre onglet.
- Les données extraites transitent par le **fragment d'URL** (`#…`), qui n'est
  **jamais envoyé à un serveur** : tout reste dans votre navigateur.

## Installation (2 minutes)

1. Téléchargez ce dossier `extension/` (ou clonez le dépôt).
2. Ouvrez `chrome://extensions` dans Chrome (ou Edge : `edge://extensions`).
3. Activez le **Mode développeur** (interrupteur en haut à droite).
4. Cliquez **« Charger l'extension non empaquetée »** et sélectionnez le
   dossier `extension/`.
5. (Conseillé) Épinglez l'icône : puzzle 🧩 dans la barre d'outils →
   épingler « Auction Intelligence ».

## Utilisation

**Analyser une enchère :**
1. Ouvrez la page du lot → icône Auction Intelligence → **🔍 Analyser cette enchère**.
2. L'application s'ouvre : chaque champ trouvé est annoncé (💰 Prix trouvé :
   210 € · 💶 Frais : 24 % · 🔢 Quantité : 3 · ⚠️ État non indiqué…).
3. Vérifiez le formulaire pré-rempli, corrigez si besoin — l'analyse
   (coût réel, scénarios, ROI, budget max, score, stratégie) est déjà calculée.

**Actualiser le marché :**
1. Recherche eBay « ventes réussies » du produit → icône → **📊 Actualiser le marché**.
2. L'application ouvre la base de connaissances : annonces extraites, résumé
   (n, mini/médiane/maxi, 🎯 opportunité), fiche produit reconnue.
3. « Conserver ces N observations » — c'est vous qui validez.

## Usage en développement local

Dans `background.js`, remplacez :

```js
const APP_URL = "https://maxime35370.github.io/auctions";
```

par `http://localhost:3000` puis rechargez l'extension (`chrome://extensions`
→ ↻).

## Fonctionnement technique

L'extension extrait : balises `<meta>` + `<title>` + scripts JSON-LD
(schema.org), texte visible de la page (60 Ko max) et URLs des images
principales. Côté application, ce contenu passe par les **mêmes connecteurs**
que les imports URL et presse-papiers (`src/lib/import/`) — l'extension est
simplement une troisième voie d'acquisition. Format du payload :
`src/lib/import/extension.ts` (versionné).
