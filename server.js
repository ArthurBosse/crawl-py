import express from 'express';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());

// Servir les fichiers statiques du build
app.use(express.static(join(__dirname, 'dist')));

// API pour démarrer le crawler
app.post('/api/start-crawler', (req, res) => {
  const { projectId, startUrl } = req.body;

  if (!projectId || !startUrl) {
    return res.status(400).json({ error: 'projectId et startUrl sont requis' });
  }

  // Commande pour démarrer le crawler avec PM2
  const command = `pm2 start crawler/main.py --name "crawler-${projectId}" --interpreter python3 -- "${startUrl}" "${projectId}"`;

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Erreur d'exécution: ${error}`);
      return res.status(500).json({ error: 'Erreur lors du démarrage du crawler' });
    }
    res.json({ success: true, message: 'Crawler démarré avec succès' });
  });
});

// Route pour toutes les autres requêtes (pour le routage côté client)
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});