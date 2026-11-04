# Académie Limitless

L'app de formation de l'équipe Limitless (Partner.Co). Site statique, hébergé sur Cloudflare Pages.

- `public/index.html` : l'app au complet
- `dl/` : stories et témoignages prêts à télécharger
- `cahier-mindset-limitless.pdf` : le cahier mindset à imprimer
- `contenu-limitless.zip` et `skill/` : le skill Claude de l'équipe

Déploiement : Cloudflare Workers (Git), commande `npx wrangler deploy`.

## Connexion par courriel (progression synchronisée)

L'app est un Worker Cloudflare : `public/` contient les fichiers du site, `src/worker.js` répond aux routes `/api/*` (connexion par lien magique et sauvegarde de la progression).

Réglages :
1. KV : créer l'espace de noms `ACADEMIE`, puis mettre son ID dans `wrangler.jsonc` (section `kv_namespaces`).
2. Secret : dans le Worker, Paramètres, Variables et secrets, ajouter `GHL_WEBHOOK_URL` (adresse du webhook entrant GHL).

Le webhook reçoit : `email`, `prenom`, `lien`, `source` (« academie-limitless »).
Sans ces réglages, l'app fonctionne comme avant (progression sur l'appareil seulement).
