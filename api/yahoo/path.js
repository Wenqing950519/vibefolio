export default async function handler(req, res) {
  const reqUrl = new URL(req.url, 'http://localhost')
  const path = reqUrl.searchParams.get('path') || ''
  
  const allParams = new URLSearchParams(reqUrl.search)
  allParams.delete('path')
  const queryString = allParams.toString()
  
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${path}${queryString ? '?' + queryString : ''}`
  
  res.setHeader('Access-Control-Allow-Origin', '*')
  
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    })
    const data = await response.json()
    res.status(200).json(data)
  } catch (error) {
    res.status(500).json({ error: error.message, url })
  }
}