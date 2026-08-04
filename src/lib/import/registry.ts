/**
 * Registre des connecteurs.
 *
 * Ajouter un site = écrire un connecteur (src/lib/import/connectors/) et
 * l'ajouter à CONNECTORS ci-dessous. Rien d'autre à modifier.
 * L'ordre compte : le premier connecteur dont `matches(url)` est vrai gagne ;
 * le générique, qui accepte tout, reste en dernier.
 */

import { demoConnector } from "./connectors/demo";
import { interencheresConnector } from "./connectors/interencheres";
import { genericConnector } from "./connectors/generic";
import type { Connector } from "./types";

export const CONNECTORS: Connector[] = [
  demoConnector,
  interencheresConnector,
  // ➕ futurs connecteurs : agorastore, encheres-domaine…
  genericConnector,
];

/** Trouve le connecteur responsable d'une URL. */
export function detectConnector(url: string): Connector {
  return CONNECTORS.find((c) => c.matches(url)) ?? genericConnector;
}
