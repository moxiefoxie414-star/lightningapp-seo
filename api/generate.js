module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured.' });

  const { system, messages } = req.body;
  if (!messages || !messages.length) return res.status(400).json({ error: 'No messages provided' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1000,
        system: system || 'You are a world-class direct-response copywriter.',
        messages: messages
      })
    });

    const data = await response.json();

    if (data.type === 'error') {
      return res.status(400).json({ 
        error: data.error?.message || JSON.stringify(data.error) 
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: String(error.message || error) });
  }
}
