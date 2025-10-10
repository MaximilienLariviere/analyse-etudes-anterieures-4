// api/claude.js - Version avec max_tokens corrigé

export default async function handler(req, res) {
  // Activer CORS
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
      max_tokens = 64000,  // ✅ CORRIGÉ: 64000 par défaut
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

    // Construire le body de la requête Anthropic
    const anthropicBody = {
      model: model || 'claude-sonnet-4-5-20250929',
      max_tokens: max_tokens,
      temperature: temperature,
      messages: messages
    };

    // Ajouter le system prompt seulement s'il est fourni et non vide
    if (system && system.trim().length > 0) {
      anthropicBody.system = system;
    }

    console.log('Calling Anthropic API with model:', anthropicBody.model);
    console.log('Max tokens:', anthropicBody.max_tokens);
    console.log('Prompt size:', messages[0]?.content?.length || 0, 'chars');

    // Appel à l'API Anthropic
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(anthropicBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', response.status, errorText);
      
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

      if (response.status === 400) {
        // Parser l'erreur JSON pour plus de détails
        let errorDetails = errorText;
        try {
          const errorJson = JSON.parse(errorText);
          errorDetails = errorJson.error?.message || errorText;
        } catch (e) {
          // Garde le texte brut si pas JSON
        }
        
        return res.status(400).json({ 
          error: 'Requête invalide - Vérifiez le modèle et les paramètres',
          details: errorDetails.substring(0, 1000),
          model: anthropicBody.model,
          max_tokens: anthropicBody.max_tokens
        });
      }
      
      return res.status(response.status).json({ 
        error: `Erreur API Anthropic: ${response.status}`,
        details: errorText.substring(0, 500)
      });
    }

    const data = await response.json();
    console.log('Success! Tokens used:', data.usage?.total_tokens || 'N/A');
    res.status(200).json(data);

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ 
      error: 'Erreur serveur', 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

// Configuration pour Vercel
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
    responseLimit: '10mb',
    maxDuration: 300,
  },
};
