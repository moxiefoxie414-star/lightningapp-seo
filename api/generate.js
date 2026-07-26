module.exports = async function handler(req, res) {
  const ALLOWED = [
    'https://www.promptlightningapp.com',
    'https://promptlightningapp.com'
  ];
  const origin = req.headers.origin;
  if (!ALLOWED.includes(origin)) {
    return res.status(403).json({ error: 'Access denied.' });
  }
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  const rateMap = handler.rateMap || (handler.rateMap = new Map());
  const ip = (req.headers['x-forwarded-for'] || '')
    .split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const window = 60 * 1000;
  const max = 10;
  const history = (rateMap.get(ip) || []).filter(t => now - t < window);
  history.push(now);
  rateMap.set(ip, history);
  if (rateMap.size > 500) {
    for (const [k, v] of rateMap) {
      if (v.every(t => now - t > window)) rateMap.delete(k);
    }
  }
  if (history.length > max) {
    return res.status(429).json({
      error: 'Too many requests. Please wait a minute.'
    });
  }
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Service temporarily unavailable.' });
  }
  const { system, messages } = req.body;
  if (!messages || !messages.length) {
    return res.status(400).json({ error: 'No messages provided.' });
  }
  function sanitize(text, max) {
    if (!text || typeof text !== 'string') return '';
    return text
      .slice(0, max)
      .replace(/ignore\s+(all\s+)?previous\s+instructions?/gi, '')
      .replace(/system\s*prompt/gi, '')
      .replace(/forget\s+(all\s+)?instructions?/gi, '')
      .replace(/you\s+are\s+now/gi, '')
      .trim();
  }
  const safeSystem = sanitize(system || '', 2000);
  const safeMessages = messages.map(m => ({
    role: m.role,
    content: sanitize(m.content || '', 1000)
  }));
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
          { role: 'system', content: safeSystem },
          ...safeMessages
        ]
      })
    });
    const data = await response.json();
    if (data.error) {
      console.error('[generate] Groq error:', data.error.message,
        '| IP:', ip, '| Time:', new Date().toISOString());
      return res.status(400).json({
        error: 'Generation failed. Please try again.'
      });
    }
    const text = data.choices?.[0]?.message?.content || '';
    if (!text) {
      return res.status(500).json({
        error: 'No content returned. Please try again.'
      });
    }
    return res.status(200).json({
      content: [{ type: 'text', text: text }]
    });
  } catch (error) {
    console.error('[generate] Exception:', error.message,
      '| IP:', ip, '| Time:', new Date().toISOString());
    return res.status(500).json({
      error: 'Service temporarily unavailable. Please try again.'
    });
  }
}
