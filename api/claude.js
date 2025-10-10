// api/claude.js - À placer dans le dossier api/ de votre projet Vercel

export default async function handler(req, res) {
  // Activer CORS pour votre domaine
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Gérer les requêtes OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      apiKey, 
      model, 
      max_tokens = 65536, 
      temperature = 0.2, 
      messages,
      system
    } = req.body;

    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    // Appel à l'API Anthropic
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model || 'claude-3-5-sonnet-20241022',
        max_tokens: max_tokens,
        temperature: temperature,
        messages: messages,
        system: system || "Tu es un expert en évaluation environnementale."
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', errorText);
      
      // Gérer les erreurs spécifiques
      if (response.status === 401) {
        return res.status(401).json({ 
          error: 'Clé API invalide. Vérifiez votre clé Anthropic.' 
        });
      }
      
      if (response.status === 429) {
        return res.status(429).json({ 
          error: 'Limite de taux dépassée. Attendez quelques secondes.' 
        });
      }

      if (response.status === 504 || response.status === 502) {
        return res.status(504).json({ 
          error: 'Timeout - Document trop volumineux. Réessayez.' 
        });
      }
      
      return res.status(response.status).json({ 
        error: `Erreur API Anthropic: ${response.status}`,
        details: errorText.substring(0, 500)
      });
    }

    const data = await response.json();
    res.status(200).json(data);

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ 
      error: 'Erreur serveur', 
      message: error.message 
    });
  }
}

// Configuration pour Vercel (augmenter les timeouts)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
    responseLimit: '10mb',
    // Timeout de 5 minutes pour les longues analyses
    maxDuration: 300,
  },
};
