module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Add GROQ_API_KEY to Vercel environment variables.' });
  const { system, messages } = req.body;
  if (!messages || !messages.length) return res.status(400).json({ error: 'No messages provided' });
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1000,
        messages: [
          { role: 'system', content: system || 'You are a world-class direct-response copywriter.' },
          ...messages
        ]
      })
    });
    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error.message || JSON.stringify(data.error) });
    const text = data.choices?.[0]?.message?.content || '';
    if (!text) return res.status(500).json({ error: 'No content returned' });
    return res.status(200).json({ content: [{ type: 'text', text: text }] });
  } catch (error) {
    return res.status(500).json({ error: String(error.message || error) });
  }
}
