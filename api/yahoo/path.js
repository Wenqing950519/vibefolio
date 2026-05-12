export default async function handler(req, res) {
  const fullPath = req.url.replace('/api/yahoo/path', '')
  const url = `https://query1.finance.yahoo.com${fullPath}`
  
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    const data = await response.json()
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.status(200).json(data)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch' })
  }
}