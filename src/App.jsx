import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, RefreshCw, Home, LogOut, Check, X, Edit2, PieChart as PieChartIcon, LayoutGrid, List } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import Auth from './Auth'
import { supabase } from './supabase'

const ASSET_TYPES = [
  { value: 'Stock', label: '美股', color: '#3b82f6' },
  { value: 'TWStock', label: '台股', color: '#10b981' },
  { value: 'Crypto', label: '加密', color: '#8b5cf6' },
  { value: 'Other', label: '其他', color: '#f59e0b' },
  { value: 'Cash', label: '現金', color: '#64748b' },
];

const App = () => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  
  const [viewMode, setViewMode] = useState('current');
  const [activeTab, setActiveTab] = useState('home'); // 'home', 'trade', 'chart'
  const [chartView, setChartView] = useState('detail'); // 'detail' or 'category'
  const [expandedId, setExpandedId] = useState(null);
  
  const [currency, setCurrency] = useState('USD');
  const [exchangeRate, setExchangeRate] = useState(32.5); 
  
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ quantity: '', costPrice: '' });

  const [txType, setTxType] = useState('buy'); // 'buy' or 'sell'
  const [newAsset, setNewAsset] = useState({
    type: 'Stock',
    symbol: '',
    quantity: '',
    costPrice: '',
    transactionDate: new Date().toISOString().split('T')[0],
  });
  
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const [priceMessage, setPriceMessage] = useState('');

  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  const [chartRange, setChartRange] = useState('30D');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      fetchAssets();
      fetchTransactions();
      fetchExchangeRate();
    }
  }, [session]);

  useEffect(() => {
    if (newAsset.type === 'Cash') {
      setNewAsset(prev => ({ ...prev, symbol: currency, costPrice: '1' }));
      setPriceMessage('');
    }
  }, [currency, newAsset.type]);

  const fetchAssets = async () => {
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: true });
    
    if (!error && data) {
      const mappedData = data.map(item => ({
        ...item,
        costPrice: item.cost_price,
        currentPrice: item.current_price,
      }));
      setAssets(mappedData);
    }
  };

  const fetchTransactions = async () => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', session.user.id)
      .order('transaction_date', { ascending: true });
      
    if (!error && data) {
      setTransactions(data);
    }
  };

  const fetchExchangeRate = async () => {
    try {
      const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=USDTTWD');
      const data = await res.json();
      if (data.price) {
        setExchangeRate(parseFloat(data.price));
      }
    } catch (error) {
      console.error("Fetch exchange rate error:", error);
    }
  };

  const fetchYahooPrice = async (symbol) => {
    try {
      const res = await fetch(`/api/yahoo/${symbol}`)
      const data = await res.json();
      return data.chart.result[0].meta.regularMarketPrice;
    } catch { 
      return null; 
    }
  };

  const fetchBinancePrice = async (symbol) => {
    try {
      const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}USDT`);
      const data = await res.json();
      return parseFloat(data.price);
    } catch { 
      return null; 
    }
  };

  const handleFetchHistoricalPrice = async (dateStr, symbol, type) => {
    if (!symbol) {
      setPriceMessage('請先輸入標的代碼');
      return;
    }
    if (!dateStr || type === 'Cash' || type === 'Other') return;
    
    setIsFetchingPrice(true);
    setPriceMessage('載入中...');
    
    try {
      const startMs = new Date(dateStr).getTime();
      const endMs = startMs + 86400000;
      const startTimestamp = Math.floor(startMs / 1000);
      const endTimestamp = Math.floor(endMs / 1000);
      
      let fetchedPrice = null;

      if (type === 'Crypto') {
        const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=1d&startTime=${startMs}&endTime=${endMs}&limit=1`);
        const data = await res.json();
        if (data && data.length > 0) {
          fetchedPrice = parseFloat(data[0][4]); 
        }
      } else if (type === 'Stock' || type === 'TWStock') {
        let sym = type === 'TWStock' ? `${symbol}.TW` : symbol;
        const res = await fetch(`/api/yahoo/${sym}?interval=1d&period1=${startTimestamp}&period2=${endTimestamp}`)
        const data = await res.json();
        if (data.chart.result && data.chart.result[0].indicators.quote[0].close) {
          const closePrices = data.chart.result[0].indicators.quote[0].close;
          fetchedPrice = closePrices.find(p => p !== null);
        }
      }

      if (fetchedPrice) {
        setNewAsset(prev => ({ ...prev, costPrice: parseFloat(fetchedPrice.toFixed(4)) }));
        const nativeCurrency = getAssetCurrency(type, symbol);
        setPriceMessage(`已自動帶入 ${dateStr.replace(/-/g, '/')} 收盤價 (${nativeCurrency})`);
      } else {
        setPriceMessage('查無此日期報價，請手動輸入');
      }
    } catch (error) {
      setPriceMessage('查無此日期報價，請手動輸入');
    } finally {
      setIsFetchingPrice(false);
    }
  };

  const handleUpdatePrices = async () => {
    cancelEditing(); 
    setIsUpdating(true);
    
    try {
      const updatedAssets = await Promise.all(assets.map(async (a) => {
        if (a.quantity <= 0 || a.type === 'Cash' || a.type === 'Other') return a;
        
        let newPrice = a.currentPrice;
        if (a.type === 'Crypto') {
          const p = await fetchBinancePrice(a.symbol);
          if (p) newPrice = p;
        } else if (a.type === 'Stock' || a.type === 'TWStock') {
          let sym = a.type === 'TWStock' ? `${a.symbol}.TW` : a.symbol;
          const p = await fetchYahooPrice(sym);
          if (p) newPrice = p;
        }

        if (newPrice !== a.currentPrice) {
          const { error } = await supabase
            .from('assets')
            .update({ current_price: newPrice })
            .eq('id', a.id);
          
          if (!error) {
            return { ...a, currentPrice: newPrice };
          }
        }
        return a;
      }));

      setAssets(updatedAssets);
      setLastUpdated(new Date().toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit' }));
    } catch (error) {
      console.error("數據更新失敗", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddAsset = async (e) => {
    e.preventDefault();
    if (!newAsset.symbol || !newAsset.quantity || !newAsset.costPrice || !newAsset.transactionDate) return;

    const symbolUpper = newAsset.symbol.toUpperCase();
    const quantity = parseFloat(newAsset.quantity);
    const costPrice = parseFloat(newAsset.costPrice);

    let currentAssetId = null;
    const existingIndex = assets.findIndex(a => a.symbol === symbolUpper && a.type === newAsset.type);

    if (txType === 'buy') {
      if (existingIndex >= 0) {
        const existing = assets[existingIndex];
        currentAssetId = existing.id;
        const oldTotalCost = existing.quantity * existing.costPrice;
        const newTotalCost = quantity * costPrice;
        const newTotalQty = existing.quantity + quantity;
        const newAvgPrice = newTotalQty > 0 ? (oldTotalCost + newTotalCost) / newTotalQty : 0;
        const finalCostPrice = parseFloat(newAvgPrice.toFixed(4));

        const { error } = await supabase
          .from('assets')
          .update({ quantity: newTotalQty, cost_price: finalCostPrice })
          .eq('id', existing.id);

        if (!error) {
          const updatedAssets = [...assets];
          updatedAssets[existingIndex] = { ...existing, quantity: newTotalQty, costPrice: finalCostPrice };
          setAssets(updatedAssets);
        }
      } else {
        const { data, error } = await supabase
          .from('assets')
          .insert([{
            user_id: session.user.id,
            type: newAsset.type,
            symbol: symbolUpper,
            quantity: quantity,
            cost_price: costPrice,
            current_price: costPrice
          }])
          .select()
          .single();

        if (!error && data) {
          currentAssetId = data.id;
          const { cost_price, current_price, ...restData } = data;
          const mappedNewAsset = {
            ...restData,
            costPrice: cost_price,
            currentPrice: current_price,
          };
          setAssets([...assets, mappedNewAsset]);
        }
      }
    } else if (txType === 'sell') {
      if (existingIndex < 0) {
        setPriceMessage('未持有該資產，無法賣出');
        return;
      }
      const existing = assets[existingIndex];
      if (quantity > existing.quantity) {
        setPriceMessage('賣出數量大於當前持倉');
        return;
      }
      
      currentAssetId = existing.id;
      const newTotalQty = existing.quantity - quantity;
      
      if (newTotalQty === 0) {
        const { error } = await supabase.from('assets').delete().eq('id', existing.id);
        if (!error) {
          setAssets(assets.filter(a => a.id !== existing.id));
          if (expandedId === existing.id) setExpandedId(null);
          currentAssetId = null; 
        }
      } else {
        const { error } = await supabase
          .from('assets')
          .update({ quantity: newTotalQty })
          .eq('id', existing.id);

        if (!error) {
          const updatedAssets = [...assets];
          updatedAssets[existingIndex] = { ...existing, quantity: newTotalQty };
          setAssets(updatedAssets);
        }
      }
    }

    if (currentAssetId) {
      const { data: txData } = await supabase
        .from('transactions')
        .insert([{
          user_id: session.user.id,
          asset_id: currentAssetId,
          symbol: symbolUpper,
          type: txType,
          asset_type: newAsset.type,
          quantity: quantity,
          price: costPrice,
          transaction_date: newAsset.transactionDate
        }])
        .select()
        .single();
        
      if (txData) {
        setTransactions([...transactions, txData]);
      }
    }
    
    setNewAsset({ type: 'Stock', symbol: '', quantity: '', costPrice: '', transactionDate: new Date().toISOString().split('T')[0] });
    setPriceMessage('');
    setActiveTab('home');
  };

  const handleDeleteAsset = async (id) => {
    const { error } = await supabase.from('assets').delete().eq('id', id);
    if (!error) {
      setAssets(assets.filter(a => a.id !== id));
      if (expandedId === id) setExpandedId(null);
    }
  };

  const saveEditing = async (id) => {
    const newQty = parseFloat(editForm.quantity);
    const newCost = parseFloat(editForm.costPrice);
    
    if (isNaN(newQty) || isNaN(newCost)) return;

    const { error } = await supabase
      .from('assets')
      .update({ quantity: newQty, cost_price: newCost })
      .eq('id', id);

    if (!error) {
      setAssets(assets.map(a => {
        if (a.id === id) {
          return { ...a, quantity: newQty, costPrice: newCost };
        }
        return a;
      }));
      setEditingId(null);
    }
  };

  const startEditing = (asset) => {
    setEditingId(asset.id);
    setEditForm({ quantity: asset.quantity, costPrice: asset.costPrice });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({ quantity: '', costPrice: '' });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const getAssetCurrency = (type, symbol) => {
    if (type === 'TWStock') return 'TWD';
    if (type === 'Cash') return symbol === 'TWD' ? 'TWD' : 'USD';
    return 'USD';
  };

  const getConvertedValue = (value, assetType, symbol) => {
    if (assetType === 'Cash') {
      if (symbol === 'USD') return currency === 'TWD' ? value * exchangeRate : value;
      if (symbol === 'TWD') return currency === 'TWD' ? value : value / exchangeRate;
      return currency === 'TWD' ? value * exchangeRate : value; 
    }
    if (currency === 'TWD') return assetType === 'TWStock' ? value : value * exchangeRate;
    return assetType === 'TWStock' ? value / exchangeRate : value;
  };

  const formatPrice = (value, assetType, symbol) => {
    const converted = getConvertedValue(value, assetType, symbol);
    const formatted = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(converted);
    return currency === 'TWD' ? `NT$${formatted}` : `$${formatted}`;
  };

  const formatValue = (value, assetType, symbol) => {
    const converted = getConvertedValue(value, assetType, symbol);
    const formatted = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(converted);
    return currency === 'TWD' ? `NT$${formatted}` : `$${formatted}`;
  };

  const formatAggregated = (value) => {
    const formatted = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
    return currency === 'TWD' ? `NT$${formatted}` : `$${formatted}`;
  };

  const formatAggregatedPnL = (value) => {
    const formatted = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.abs(value));
    const prefix = value >= 0 ? '+' : '-';
    return currency === 'TWD' ? `${prefix}NT$${formatted}` : `${prefix}$${formatted}`;
  };

  const { chartData, displayData, topCardsTotalValue, totalProfitLoss, totalProfitLossPercent, costTotalValue, currentTotalValue, uniqueHoldings } = useMemo(() => {
    let currentTotal = 0;
    let costTotal = 0;
    
    const holdings = assets.filter(a => a.quantity > 0).map(a => ({ symbol: a.symbol, type: a.type }));
    const uniqueHoldings = Array.from(new Set(holdings.map(a => a.symbol))).map(sym => holdings.find(h => h.symbol === sym));

    const detailData = assets.filter(a => a.quantity > 0).map(asset => {
      const currentValRaw = asset.quantity * asset.currentPrice;
      const costValRaw = asset.quantity * asset.costPrice;
      
      const currentValConverted = getConvertedValue(currentValRaw, asset.type, asset.symbol);
      const costValConverted = getConvertedValue(costValRaw, asset.type, asset.symbol);
      
      currentTotal += currentValConverted;
      costTotal += costValConverted;
      
      const valueForChart = viewMode === 'principal' ? costValConverted : currentValConverted;

      return {
        ...asset,
        name: asset.symbol,
        value: valueForChart,
        currentValConverted,
        costValConverted,
        color: ASSET_TYPES.find(t => t.value === asset.type)?.color || '#3b82f6'
      };
    }).sort((a, b) => b.currentValConverted - a.currentValConverted);

    let groupedData = [];
    if (chartView === 'category') {
      const groups = {};
      detailData.forEach(item => {
        if (!groups[item.type]) groups[item.type] = { value: 0, count: 0 };
        groups[item.type].value += item.value;
        groups[item.type].count += 1;
      });

      groupedData = Object.entries(groups).map(([type, data]) => {
        const typeInfo = ASSET_TYPES.find(t => t.value === type);
        return {
          name: typeInfo ? typeInfo.label.split(' ')[0] : type,
          fullName: typeInfo ? typeInfo.label : type,
          value: data.value,
          count: data.count,
          color: typeInfo ? typeInfo.color : '#94a3b8',
          isCategory: true
        };
      }).sort((a, b) => b.value - a.value);
    }

    const pnl = currentTotal - costTotal;
    const pnlPercent = costTotal > 0 ? (pnl / costTotal) * 100 : 0;
    const displayedTotalValue = viewMode === 'principal' ? costTotal : currentTotal;

    return { 
      chartData: chartView === 'category' ? groupedData : detailData,
      displayData: detailData,
      topCardsTotalValue: displayedTotalValue,
      totalProfitLoss: pnl,
      totalProfitLossPercent: pnlPercent,
      costTotalValue: costTotal,
      currentTotalValue: currentTotal,
      uniqueHoldings
    };
  }, [assets, viewMode, chartView, currency, exchangeRate]);

  const sparklinePath = useMemo(() => {
    const width = 100;
    const height = 30;
    const pointsCount = chartRange === '7D' ? 7 : chartRange === '30D' ? 30 : 50;
    
    const startVal = costTotalValue;
    const endVal = currentTotalValue;
    
    if (startVal === 0 && endVal === 0) return `M0,${height/2} L${width},${height/2}`;

    const points = [];
    for (let i = 0; i < pointsCount; i++) {
      const fraction = i / (pointsCount - 1);
      const easeFraction = fraction < 0.5 ? 2 * fraction * fraction : 1 - Math.pow(-2 * fraction + 2, 2) / 2;
      const val = startVal + (endVal - startVal) * easeFraction;
      points.push(val);
    }

    const min = Math.min(...points) * 0.99;
    const max = Math.max(...points) * 1.01;
    const range = max - min === 0 ? 1 : max - min;

    const coords = points.map((val, i) => {
      const x = (i / (pointsCount - 1)) * width;
      const y = height - ((val - min) / range) * height;
      return `${x},${y}`;
    });

    return `M${coords.join(' L')}`;
  }, [costTotalValue, currentTotalValue, chartRange]);

  const pnlColor = totalProfitLoss >= 0 ? '#10b981' : '#f43f5e';

  if (loading) return <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center text-[#3b82f6] font-mono text-sm">LOADING...</div>;
  if (!session) return <Auth />;

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const currentChartTotal = chartData.reduce((acc, curr) => acc + curr.value, 0);
      const percent = currentChartTotal > 0 ? (data.value / currentChartTotal) * 100 : 0;
      return (
        <div className="bg-[#12121a]/90 backdrop-blur-md p-4 border border-[#1a1a24] shadow-2xl rounded-xl z-50">
          <p className="font-extrabold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: data.color || '#94a3b8' }}></span>
            {data.fullName || data.name}
          </p>
          <div className="mt-2 space-y-1">
            <p className="text-gray-400 text-sm font-medium flex justify-between gap-4">
              {viewMode === 'principal' ? '投入本金: ' : '當前市值: '}
              <span className="font-bold text-white">{formatAggregated(data.value)}</span>
            </p>
            <p className="text-[#3b82f6] font-extrabold text-sm flex justify-between gap-4">
              配置佔比: 
              <span>{percent.toFixed(1)}%</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-100 font-sans pb-24 selection:bg-[#3b82f6]/30">
      <div className="max-w-md mx-auto relative min-h-screen border-x border-[#1a1a24] bg-[#0a0a0f]">
        
        {/* Header */}
        <header className="px-4 py-4 flex justify-between items-center sticky top-0 bg-[#0a0a0f]/90 backdrop-blur-md z-40 border-b border-[#1a1a24]">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              VibeFolio
              <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6] shadow-[0_0_8px_#3b82f6]"></span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-[#12121a] p-1 rounded-lg border border-[#1a1a24]">
              <button
                onClick={() => setCurrency('USD')}
                className={`px-3 py-1 rounded text-xs font-bold transition-all ${currency === 'USD' ? 'bg-[#1e1e2d] text-white shadow' : 'text-gray-500'}`}
              >
                USD
              </button>
              <button
                onClick={() => setCurrency('TWD')}
                className={`px-3 py-1 rounded text-xs font-bold transition-all ${currency === 'TWD' ? 'bg-[#1e1e2d] text-white shadow' : 'text-gray-500'}`}
              >
                TWD
              </button>
            </div>
            <button onClick={handleSignOut} className="flex items-center gap-1.5 text-gray-500 hover:text-white transition-colors">
              <span className="text-[11px] font-bold">登出</span>
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {/* Ticker */}
        <div className="bg-[#0f0f16] border-b border-[#1a1a24] text-[10px] text-gray-500 py-1.5 px-4 flex justify-between font-mono">
          <span>1 USD = {exchangeRate} TWD</span>
          <span>更新 {lastUpdated || '--:--'}</span>
        </div>

        {activeTab === 'home' && (
          <div className="p-4 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Hero Card */}
            <div className="rounded-2xl bg-[#12121a] border border-[#1a1a24] p-6 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-[#3b82f6]/5 to-transparent pointer-events-none"></div>
              
              <div className="flex justify-between items-center mb-6 relative z-10">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                  {viewMode === 'principal' ? '總投入本金' : '當前總資產'}
                </span>
                <div className="flex items-center gap-3">
                  <div className={`flex bg-[#0a0a0f] p-0.5 rounded-md border border-[#1a1a24] transition-opacity duration-300 ${viewMode === 'current' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    {['7D', '30D', 'ALL'].map(range => (
                      <button 
                        key={range}
                        onClick={() => setChartRange(range)} 
                        className={`px-2 py-1 text-[9px] font-bold rounded transition-colors ${chartRange === range ? 'bg-[#1a1a24] text-white' : 'text-gray-600'}`}
                      >
                        {range}
                      </button>
                    ))}
                  </div>
                  <div className="w-px h-4 bg-[#1a1a24]"></div>
                  <div className="flex bg-[#0a0a0f] p-0.5 rounded-md border border-[#1a1a24]">
                    <button onClick={() => setViewMode('principal')} className={`px-2 py-1 text-[10px] font-bold rounded ${viewMode === 'principal' ? 'bg-[#1a1a24] text-[#3b82f6]' : 'text-gray-600'}`}>本金</button>
                    <button onClick={() => setViewMode('current')} className={`px-2 py-1 text-[10px] font-bold rounded ${viewMode === 'current' ? 'bg-[#1a1a24] text-[#3b82f6]' : 'text-gray-600'}`}>市值</button>
                  </div>
                </div>
              </div>

              <div className={`relative z-10 transition-all duration-300 ${viewMode === 'current' ? 'mb-6' : 'mb-0'}`}>
                <div className="text-4xl font-black font-mono tracking-tight text-white mb-2">
                  {formatAggregated(topCardsTotalValue)}
                </div>
                <div className="flex items-center gap-2">
                  <div className={`font-mono text-sm font-bold flex items-center gap-1.5 ${totalProfitLoss >= 0 ? 'text-[#10b981]' : 'text-[#f43f5e]'}`}>
                    {formatAggregatedPnL(totalProfitLoss)}
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold bg-opacity-10 ${totalProfitLoss >= 0 ? 'bg-[#10b981]' : 'bg-[#f43f5e]'}`}>
                      {totalProfitLoss >= 0 ? '+' : ''}{totalProfitLossPercent.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Sparkline decoration */}
              <div className={`absolute bottom-0 left-0 right-0 pointer-events-none overflow-hidden transition-all duration-300 ${viewMode === 'current' ? 'h-16 opacity-80' : 'h-0 opacity-0'}`}>
                <svg width="100%" height="100%" viewBox="0 0 100 30" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="curveGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor={pnlColor} stopOpacity="0.2" />
                      <stop offset="100%" stopColor={pnlColor} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={`${sparklinePath} L100,30 L0,30 Z`} fill="url(#curveGrad)" />
                  <path d={sparklinePath} fill="none" stroke={pnlColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>

            {/* Asset List */}
            <div className="space-y-0">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest px-2 mb-3">持倉明細</h3>
              {displayData.map((asset) => {
                const isExpanded = expandedId === asset.id;
                const isEditing = editingId === asset.id;
                const pnlRaw = (asset.currentPrice - asset.costPrice) * asset.quantity;
                const pnlPercent = asset.costPrice > 0 ? (pnlRaw / (asset.costPrice * asset.quantity)) * 100 : 0;
                const isPositive = pnlRaw >= 0;

                return (
                  <div key={asset.id} className="border-b border-[#1a1a24] last:border-0 bg-[#0a0a0f] hover:bg-[#12121a] transition-colors overflow-hidden">
                    <div 
                      className="p-4 flex justify-between items-center cursor-pointer"
                      onClick={() => !isEditing && setExpandedId(isExpanded ? null : asset.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: asset.color, boxShadow: `0 0 8px ${asset.color}` }}></div>
                        <div>
                          <div className="font-black text-white text-base">{asset.symbol}</div>
                          <div className="text-[10px] text-gray-500 font-bold uppercase">{ASSET_TYPES.find(t=>t.value===asset.type)?.label.split(' ')[0]}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-white text-sm">
                          {formatValue(asset.quantity * asset.currentPrice, asset.type, asset.symbol)}
                        </div>
                        {asset.type !== 'Cash' ? (
                          <div className={`font-mono text-[11px] font-bold ${isPositive ? 'text-[#10b981]' : 'text-[#f43f5e]'}`}>
                            {isPositive ? '+' : ''}{formatValue(Math.abs(pnlRaw), asset.type, asset.symbol)} ({isPositive?'+':''}{pnlPercent.toFixed(1)}%)
                          </div>
                        ) : (
                          <div className="font-mono text-[11px] text-gray-600">-</div>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-200">
                        <div className="bg-[#12121a] rounded-xl p-4 border border-[#1a1a24]">
                          {isEditing ? (
                            <div className="space-y-4">
                              <div className="flex gap-3">
                                <div className="flex-1">
                                  <label className="text-[10px] text-gray-500 font-bold uppercase">數量</label>
                                  <input type="number" value={editForm.quantity} onChange={e=>setEditForm({...editForm, quantity: e.target.value})} className="w-full bg-[#0a0a0f] border border-[#1a1a24] text-white text-sm font-mono px-3 py-2 rounded focus:border-[#3b82f6] outline-none mt-1" />
                                </div>
                                <div className="flex-1">
                                  <label className="text-[10px] text-gray-500 font-bold uppercase">成本均價 ({getAssetCurrency(asset.type, asset.symbol)})</label>
                                  <input type="number" value={editForm.costPrice} onChange={e=>setEditForm({...editForm, costPrice: e.target.value})} className="w-full bg-[#0a0a0f] border border-[#1a1a24] text-white text-sm font-mono px-3 py-2 rounded focus:border-[#3b82f6] outline-none mt-1" />
                                </div>
                              </div>
                              <div className="flex gap-2 justify-end pt-2">
                                <button onClick={cancelEditing} className="px-3 py-1.5 rounded text-xs font-bold text-gray-400 hover:text-white bg-[#1a1a24]">取消</button>
                                <button onClick={() => saveEditing(asset.id)} className="px-3 py-1.5 rounded text-xs font-bold text-white bg-[#3b82f6]">儲存</button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="flex justify-between text-xs font-mono text-gray-400 mb-2">
                                <span>持倉</span>
                                <span className="text-white">{asset.quantity.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between text-xs font-mono text-gray-400 mb-2">
                                <span>成本 ({getAssetCurrency(asset.type, asset.symbol)})</span>
                                <span className="text-white">{asset.type === 'Cash' ? '-' : asset.costPrice}</span>
                              </div>
                              <div className="flex justify-between text-xs font-mono text-gray-400 mb-4">
                                <span>現價 ({getAssetCurrency(asset.type, asset.symbol)})</span>
                                <span className="text-white">{asset.type === 'Cash' ? '-' : asset.currentPrice}</span>
                              </div>
                              <div className="flex gap-2 border-t border-[#1a1a24] pt-3">
                                <button onClick={(e) => { e.stopPropagation(); startEditing(asset); }} className="flex-1 py-2 rounded bg-[#1a1a24] text-gray-300 text-xs font-bold flex items-center justify-center gap-1.5 hover:text-white">
                                  <Edit2 size={14} /> 編輯
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteAsset(asset.id); }} className="flex-1 py-2 rounded bg-[#f43f5e]/10 text-[#f43f5e] text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[#f43f5e]/20">
                                  <Trash2 size={14} /> 刪除
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {displayData.length === 0 && (
                <div className="text-center py-10 text-gray-600 text-sm font-bold">尚未新增任何資產</div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: 交易 (新增/賣出) */}
        {activeTab === 'trade' && (
          <div className="p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex bg-[#12121a] p-1 rounded-xl border border-[#1a1a24] mb-6">
              <button
                onClick={() => { setTxType('buy'); setPriceMessage(''); }}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${txType === 'buy' ? 'bg-[#3b82f6] text-white shadow-[0_0_12px_rgba(59,130,246,0.3)]' : 'text-gray-500'}`}
              >
                買入資產
              </button>
              <button
                onClick={() => { setTxType('sell'); setPriceMessage(''); }}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${txType === 'sell' ? 'bg-[#f43f5e] text-white shadow-[0_0_12px_rgba(244,63,94,0.3)]' : 'text-gray-500'}`}
              >
                賣出資產
              </button>
            </div>

            {uniqueHoldings.length > 0 && (
              <div className="mb-6">
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">快捷選擇持有標的</label>
                <div className="flex flex-wrap gap-2">
                  {uniqueHoldings.map(a => (
                    <button
                      key={a.symbol}
                      type="button"
                      onClick={() => {
                        setNewAsset({...newAsset, type: a.type, symbol: a.symbol});
                        setPriceMessage('');
                      }}
                      className="px-3 py-1.5 rounded-full text-xs font-bold bg-[#1a1a24] text-gray-400 hover:text-white border border-[#2a2a36] transition-colors"
                    >
                      {a.symbol}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={(e) => { handleAddAsset(e); }} className="space-y-6">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">資產類型</label>
                <div className="flex flex-wrap gap-2">
                  {ASSET_TYPES.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => {
                        setNewAsset({...newAsset, type: t.value});
                        setPriceMessage('');
                      }}
                      className={`px-4 py-2.5 rounded-full text-xs font-bold transition-all ${newAsset.type === t.value ? (txType === 'buy' ? 'bg-[#3b82f6] text-white shadow-[0_0_12px_rgba(59,130,246,0.4)]' : 'bg-[#f43f5e] text-white shadow-[0_0_12px_rgba(244,63,94,0.4)]') : 'bg-[#12121a] text-gray-400 border border-[#1a1a24]'}`}
                    >
                      {t.label.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">標的代碼</label>
                <input 
                  type="text" 
                  placeholder={newAsset.type === 'Cash' ? currency : "例如 AAPL, BTC"}
                  value={newAsset.symbol}
                  disabled={newAsset.type === 'Cash'}
                  onChange={(e) => {
                    setNewAsset({...newAsset, symbol: e.target.value});
                    setPriceMessage('');
                  }}
                  className="w-full bg-[#12121a] border border-[#1a1a24] text-white text-base font-black px-4 py-4 rounded-xl focus:border-[#3b82f6] outline-none disabled:opacity-50 placeholder-gray-700 uppercase"
                />
              </div>
              
              {newAsset.type !== 'Cash' && newAsset.type !== 'Other' && (
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">交易日期 (選填，自動帶入收盤價)</label>
                  <input 
                    type="date" 
                    value={newAsset.transactionDate}
                    onChange={(e) => {
                      const newDate = e.target.value;
                      setNewAsset({...newAsset, transactionDate: newDate});
                      handleFetchHistoricalPrice(newDate, newAsset.symbol, newAsset.type);
                    }}
                    className="w-full bg-[#12121a] border border-[#1a1a24] text-white text-base font-mono font-bold px-4 py-4 rounded-xl focus:border-[#3b82f6] outline-none placeholder-gray-700"
                  />
                  {isFetchingPrice ? (
                    <p className="text-[10px] text-[#3b82f6] font-bold mt-2 animate-pulse">{priceMessage}</p>
                  ) : priceMessage ? (
                    <p className={`text-[10px] font-bold mt-2 ${priceMessage.includes('查無') || priceMessage.includes('請先') || priceMessage.includes('無法') || priceMessage.includes('大於') ? 'text-[#f43f5e]' : 'text-[#10b981]'}`}>{priceMessage}</p>
                  ) : null}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">數量</label>
                <input 
                  type="number" 
                  step="any"
                  placeholder="0.00"
                  value={newAsset.quantity}
                  onChange={(e) => setNewAsset({...newAsset, quantity: e.target.value})}
                  className="w-full bg-[#12121a] border border-[#1a1a24] text-white text-base font-mono font-bold px-4 py-4 rounded-xl focus:border-[#3b82f6] outline-none placeholder-gray-700"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">交易單價 ({getAssetCurrency(newAsset.type, newAsset.symbol)})</label>
                <input 
                  type="number" 
                  step="any"
                  placeholder={newAsset.type === 'Cash' ? "1" : "0.00"}
                  disabled={newAsset.type === 'Cash'}
                  value={newAsset.costPrice}
                  onChange={(e) => setNewAsset({...newAsset, costPrice: e.target.value})}
                  className="w-full bg-[#12121a] border border-[#1a1a24] text-white text-base font-mono font-bold px-4 py-4 rounded-xl focus:border-[#3b82f6] outline-none disabled:opacity-50 placeholder-gray-700"
                />
              </div>

              <div className="pt-4 pb-10">
                <button 
                  type="submit"
                  className={`w-full text-white font-black text-base py-4 rounded-xl active:scale-95 transition-transform ${txType === 'buy' ? 'bg-[#3b82f6] shadow-[0_0_20px_rgba(59,130,246,0.3)]' : 'bg-[#f43f5e] shadow-[0_0_20px_rgba(244,63,94,0.3)]'}`}
                >
                  {txType === 'buy' ? '確認買入' : '確認賣出'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 3: 配置 (Chart) */}
        {activeTab === 'chart' && (
          <div className="p-4 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-[#12121a] rounded-2xl p-6 border border-[#1a1a24]">
              <div className="flex justify-between items-center mb-6 relative z-10">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                  資產分佈
                </span>
                <div className="flex bg-[#0a0a0f] p-0.5 rounded-md border border-[#1a1a24]">
                  <button onClick={() => setChartView('detail')} className={`px-2 py-1 text-[10px] font-bold rounded ${chartView === 'detail' ? 'bg-[#1a1a24] text-[#3b82f6]' : 'text-gray-600'}`}>標的</button>
                  <button onClick={() => setChartView('category')} className={`px-2 py-1 text-[10px] font-bold rounded ${chartView === 'category' ? 'bg-[#1a1a24] text-[#3b82f6]' : 'text-gray-600'}`}>分類</button>
                </div>
              </div>

              <div className="w-full h-64 relative mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="none"
                      cornerRadius={4}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} style={{ filter: `drop-shadow(0px 0px 8px ${entry.color}60)` }} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} cursor={{fill: 'transparent'}} />
                  </PieChart>
                </ResponsiveContainer>
                
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none mt-[-10px]">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{chartView === 'category' ? '大類' : '標的'}</span>
                  <span className="text-2xl font-black text-white block mt-1">{chartData.length}</span>
                </div>
              </div>

              <div className="space-y-3">
                {chartData.map((entry, index) => {
                  const currentChartTotal = chartData.reduce((acc, curr) => acc + curr.value, 0);
                  const percent = currentChartTotal > 0 ? (entry.value / currentChartTotal) * 100 : 0;
                  return (
                    <div key={index} className="flex justify-between items-center text-sm p-3 bg-[#0a0a0f] rounded-xl border border-[#1a1a24]">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color, boxShadow: `0 0 8px ${entry.color}` }}></div>
                        <div>
                          <span className="font-bold text-white block">{entry.name}</span>
                          {chartView === 'category' && <span className="text-[10px] text-gray-500 font-bold">{entry.count} 筆資產</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="block font-bold text-white">{percent.toFixed(1)}%</span>
                        <span className="text-[10px] font-bold text-gray-500">{formatAggregated(entry.value)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* FAB Refresh Button */}
        {activeTab === 'home' && (
          <button 
            onClick={handleUpdatePrices}
            disabled={isUpdating}
            className={`fixed bottom-24 right-4 w-12 h-12 bg-[#3b82f6] text-white rounded-full flex items-center justify-center z-40 transition-all ${isUpdating ? 'shadow-[0_0_20px_rgba(59,130,246,0.6)]' : 'shadow-lg active:scale-90'}`}
          >
            <RefreshCw size={20} className={isUpdating ? "animate-spin" : ""} />
          </button>
        )}

        {/* Bottom Tab Bar */}
        <div className="fixed bottom-0 w-full max-w-md h-16 bg-[#0a0a0f]/90 backdrop-blur-xl border-t border-[#1a1a24] flex items-center justify-around px-6 z-50">
          <button onClick={() => setActiveTab('home')} className={`p-2 flex flex-col items-center gap-1 transition-colors ${activeTab === 'home' ? 'text-[#3b82f6]' : 'text-gray-500'}`}>
            <Home size={20} />
            <span className="text-[9px] font-bold">總覽</span>
          </button>
          <button onClick={() => setActiveTab('trade')} className={`p-2 flex flex-col items-center gap-1 transition-colors ${activeTab === 'trade' ? 'text-[#3b82f6]' : 'text-gray-500'}`}>
            <Plus size={20} />
            <span className="text-[9px] font-bold">交易</span>
          </button>
          <button onClick={() => setActiveTab('chart')} className={`p-2 flex flex-col items-center gap-1 transition-colors ${activeTab === 'chart' ? 'text-[#3b82f6]' : 'text-gray-500'}`}>
            <PieChartIcon size={20} />
            <span className="text-[9px] font-bold">配置</span>
          </button>
        </div>

      </div>
    </div>
  );
};

export default App;