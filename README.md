# Académie Limitless

L'app de formation de l'équipe Limitless (Partner.Co). Site statique, hébergé sur Cloudflare Pages.

- `index.html` : l'app au complet
- `dl/` : stories et témoignages prêts à télécharger
- `cahier-mindset-limitless.pdf` : le cahier mindset à imprimer
- `contenu-limitless.zip` et `skill/` : le skill Claude de l'équipe

Cloudflare Pages : aucune commande de build, dossier de sortie `/`.

## Connexion par courriel (progression synchronisée)

Le dossier `functions/api/` contient la connexion par lien magique et la sauvegarde de la progression.

Dans Cloudflare Pages (projet de l'Académie), Paramètres :
1. **Liaisons** : ajouter un espace de noms KV nommé `ACADEMIE`, avec le nom de variable `ACADEMIE`.
2. **Variables et secrets** : ajouter le secret `GHL_WEBHOOK_URL` (adresse du webhook entrant du workflow GHL).
3. Redéployer.

Le webhook reçoit : `email`, `prenom`, `lien`, `source` (« academie-limitless »).
Sans ces réglages, l'app fonctionne comme avant (progression sur l'appareil seulement).
