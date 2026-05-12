export default async function handler(req, res) {
  const fullPath = req.url.replace('/api/yahoo/path', '')
  const url = `https://query1.finance.yahoo.com${fullPath}`
  
  res.setHeader('Access-Control-Allow-Origin', '*')
  
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    })
    
    if (!response.ok) {
      return res.status(response.status).json({ error: `Yahoo returned ${response.status}`, url })
    }
    
    const data = await response.json()
    res.status(200).json(data)
  } catch (error) {
    res.status(500).json({ error: error.message, url })
  }
}