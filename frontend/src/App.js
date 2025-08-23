import React, { useState, useEffect } from 'react';
import { PlusCircle, Edit, Trash2, RefreshCw, TrendingUp, TrendingDown, DollarSign, PieChart, Download, Sun, Moon } from 'lucide-react';

// ❗ IMPORTANT: Update this URL with your actual backend URL from Render
const API_BASE = process.env.NODE_ENV === 'production' 
  ? 'https://portfolio-tracker-backend-st89.onrender.com'  // <-- REPLACE WITH YOUR BACKEND URL
  : 'http://localhost:8000';

function App() {
  const [investments, setInvestments] = useState([]);
  const [portfolioStats, setPortfolioStats] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  const [formData, setFormData] = useState({
    asset_type: 'Stock',
    ticker: '',
    name: '',
    units: '',
    avg_buy_price: '',
    investment_thesis: '',
    conviction_level: 'Medium',
    purchase_date: new Date().toISOString().split('T')[0]
  });

  // Load theme preference from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setDarkMode(savedTheme === 'dark');
    }
  }, []);

  // Update theme in localStorage when changed
  useEffect(() => {
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Fetch investments and stats
  const fetchData = async () => {
    try {
      console.log('Fetching data from:', API_BASE);
      
      const [investmentsRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/api/investments`),
        fetch(`${API_BASE}/api/portfolio/stats`)
      ]);
      
      if (investmentsRes.ok && statsRes.ok) {
        const investmentsData = await investmentsRes.json();
        const statsData = await statsRes.json();
        
        console.log('Fetched investments:', investmentsData.length);
        setInvestments(investmentsData);
        setPortfolioStats(statsData);
      } else {
        console.error('Failed to fetch data:', investmentsRes.status, statsRes.status);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.ticker || !formData.name || !formData.units || !formData.avg_buy_price) {
      alert('Please fill in all required fields');
      return;
    }
    
    const payload = {
      asset_type: formData.asset_type,
      ticker: formData.ticker.trim().toUpperCase(),
      name: formData.name.trim(),
      units: parseFloat(formData.units),
      avg_buy_price: parseFloat(formData.avg_buy_price),
      investment_thesis: formData.investment_thesis || "",
      conviction_level: formData.conviction_level,
      purchase_date: new Date(formData.purchase_date).toISOString()
    };

    console.log('Submitting investment:', payload);

    try {
      const url = editingInvestment 
        ? `${API_BASE}/api/investments/${editingInvestment.id}`
        : `${API_BASE}/api/investments`;
      
      const method = editingInvestment ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        console.log('Investment saved successfully');
        await fetchData();
        resetForm();
        alert(editingInvestment ? 'Investment updated!' : 'Investment added!');
      } else {
        const errorText = await response.text();
        console.error('Failed to save investment:', response.status, errorText);
        alert(`Failed to save investment: ${response.status}`);
      }
    } catch (error) {
      console.error('Error saving investment:', error);
      alert('Error saving investment. Please check your connection.');
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      asset_type: 'Stock',
      ticker: '',
      name: '',
      units: '',
      avg_buy_price: '',
      investment_thesis: '',
      conviction_level: 'Medium',
      purchase_date: new Date().toISOString().split('T')[0]
    });
    setShowAddForm(false);
    setEditingInvestment(null);
  };

  // Handle edit
  const handleEdit = (investment) => {
    setFormData({
      asset_type: investment.asset_type,
      ticker: investment.ticker,
      name: investment.name,
      units: investment.units.toString(),
      avg_buy_price: investment.avg_buy_price.toString(),
      investment_thesis: investment.investment_thesis || '',
      conviction_level: investment.conviction_level,
      purchase_date: investment.purchase_date.split('T')[0]
    });
    setEditingInvestment(investment);
    setShowAddForm(true);
  };

  // Handle delete
  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this investment?')) {
      try {
        const response = await fetch(`${API_BASE}/api/investments/${id}`, {
          method: 'DELETE'
        });
        if (response.ok) {
          await fetchData();
          alert('Investment deleted!');
        }
      } catch (error) {
        console.error('Error deleting investment:', error);
        alert('Error deleting investment.');
      }
    }
  };

  // Refresh prices
  const handleRefreshPrices = async () => {
    setRefreshing(true);
    try {
      console.log('Refreshing prices...');
      await fetch(`${API_BASE}/api/refresh-prices`, { method: 'POST' });
      await fetchData();
      alert('Prices updated!');
    } catch (error) {
      console.error('Error refreshing prices:', error);
      alert('Error refreshing prices.');
    } finally {
      setRefreshing(false);
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Ticker', 'Name', 'Asset Type', 'Units', 'Avg Buy Price', 'Current Price', 'Total Value', 'Unrealized P/L', 'P/L %', 'Conviction', 'Purchase Date'];
    const csvContent = [
      headers.join(','),
      ...investments.map(inv => [
        inv.ticker,
        `"${inv.name}"`,
        inv.asset_type,
        inv.units,
        inv.avg_buy_price.toFixed(2),
        inv.current_price.toFixed(2),
        inv.total_value.toFixed(2),
        inv.unrealized_pnl.toFixed(2),
        inv.unrealized_pnl_percent.toFixed(2) + '%',
        inv.conviction_level,
        new Date(inv.purchase_date).toLocaleDateString()
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portfolio_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const getConvictionBadgeColor = (conviction) => {
    if (darkMode) {
      switch (conviction) {
        case 'High': return 'bg-green-900/30 text-green-400 border border-green-700';
        case 'Medium': return 'bg-yellow-900/30 text-yellow-400 border border-yellow-700';
        case 'Low': return 'bg-red-900/30 text-red-400 border border-red-700';
        default: return 'bg-gray-800 text-gray-300';
      }
    } else {
      switch (conviction) {
        case 'High': return 'bg-green-100 text-green-800 border border-green-200';
        case 'Medium': return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
        case 'Low': return 'bg-red-100 text-red-800 border border-red-200';
        default: return 'bg-gray-100 text-gray-800';
      }
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'} flex items-center justify-center`}>
        <div className={`${darkMode ? 'text-white' : 'text-gray-900'} text-center`}>
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <div className="text-xl">Loading your portfolio...</div>
        </div>
      </div>
    );
  }

  const bgClass = darkMode ? 'bg-gray-900' : 'bg-gray-50';
  const textClass = darkMode ? 'text-white' : 'text-gray-900';
  const cardClass = darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const tableClass = darkMode ? 'bg-gray-800' : 'bg-white border border-gray-200';
  const tableHeaderClass = darkMode ? 'bg-gray-700' : 'bg-gray-100';
  const tableBorderClass = darkMode ? 'border-gray-700' : 'border-gray-200';
  const inputClass = darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900';
  const modalClass = darkMode ? 'bg-gray-800' : 'bg-white';

  return (
    <div className={`min-h-screen ${bgClass} ${textClass} transition-colors duration-200`}>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
          <h1 className="text-3xl font-bold">📊 Investment Portfolio Tracker</h1>
          
          <div className="flex gap-2 sm:gap-4 flex-wrap">
            {/* Theme Toggle */}
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg transition-all duration-200"
            >
              <PlusCircle className="w-5 h-5" />
              <span className="hidden sm:inline">Add Investment</span>
            </button>
          </div>
        </div>

        {/* Portfolio Stats */}
        {portfolioStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className={`${cardClass} border p-6 rounded-lg shadow-sm transition-all duration-200 hover:shadow-md`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Total Invested</p>
                  <p className="text-2xl font-bold">{formatCurrency(portfolioStats.total_invested)}</p>
                </div>
                <DollarSign className="w-8 h-8 text-blue-500" />
              </div>
            </div>
            
            <div className={`${cardClass} border p-6 rounded-lg shadow-sm transition-all duration-200 hover:shadow-md`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Current Value</p>
                  <p className="text-2xl font-bold">{formatCurrency(portfolioStats.current_value)}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-500" />
              </div>
            </div>
            
            <div className={`${cardClass} border p-6 rounded-lg shadow-sm transition-all duration-200 hover:shadow-md`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Net Return</p>
                  <p className={`text-2xl font-bold ${portfolioStats.net_return_percent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {portfolioStats.net_return_percent.toFixed(2)}%
                  </p>
                  <p className={`text-sm ${portfolioStats.total_unrealized_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatCurrency(portfolioStats.total_unrealized_pnl)}
                  </p>
                </div>
                {portfolioStats.net_return_percent >= 0 ? 
                  <TrendingUp className="w-8 h-8 text-green-500" /> : 
                  <TrendingDown className="w-8 h-8 text-red-500" />
                }
              </div>
            </div>
            
            <div className={`${cardClass} border p-6 rounded-lg shadow-sm transition-all duration-200 hover:shadow-md`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Total Holdings</p>
                  <p className="text-2xl font-bold">{portfolioStats.total_holdings}</p>
                  <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'} mt-1 space-x-2`}>
                    <span className="text-green-400">High: {portfolioStats.high_conviction_count}</span>
                    <span className="text-yellow-400">Med: {portfolioStats.medium_conviction_count}</span>
                    <span className="text-red-400">Low: {portfolioStats.low_conviction_count}</span>
                  </div>
                </div>
                <PieChart className="w-8 h-8 text-purple-500" />
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Form Modal */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className={`${modalClass} rounded-lg p-6 w-full max-w-md max-h-screen overflow-y-auto shadow-2xl`}>
              <h2 className="text-xl font-bold mb-4">
                {editingInvestment ? '📝 Edit Investment' : '➕ Add New Investment'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Asset Type</label>
                  <select
                    value={formData.asset_type}
                    onChange={(e) => setFormData({...formData, asset_type: e.target.value})}
                    className={`w-full ${inputClass} border rounded px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all`}
                    required
                  >
                    <option value="Stock">📈 Stock</option>
                    <option value="Crypto">₿ Cryptocurrency</option>
                    <option value="Mutual Fund">📊 Mutual Fund</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Ticker/Symbol</label>
                  <input
                    type="text"
                    value={formData.ticker}
                    onChange={(e) => setFormData({...formData, ticker: e.target.value})}
                    className={`w-full ${inputClass} border rounded px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all`}
                    placeholder="e.g., TCS.NS, AAPL, BTC-USD"
                    required
                  />
                  <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-1`}>
                    🇮🇳 Indian: TCS.NS, RELIANCE.NS | 🇺🇸 US: AAPL, GOOGL | 🪙 Crypto: BTC-USD, ETH-USD
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Company/Asset Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className={`w-full ${inputClass} border rounded px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all`}
                    placeholder="e.g., Tata Consultancy Services"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Units/Shares</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={formData.units}
                      onChange={(e) => setFormData({...formData, units: e.target.value})}
                      className={`w-full ${inputClass} border rounded px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all`}
                      placeholder="10"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Avg Buy Price (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.avg_buy_price}
                      onChange={(e) => setFormData({...formData, avg_buy_price: e.target.value})}
                      className={`w-full ${inputClass} border rounded px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all`}
                      placeholder="3200"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Conviction Level</label>
                  <select
                    value={formData.conviction_level}
                    onChange={(e) => setFormData({...formData, conviction_level: e.target.value})}
                    className={`w-full ${inputClass} border rounded px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all`}
                    required
                  >
                    <option value="High">🚀 High - Very confident</option>
                    <option value="Medium">⚡ Medium - Moderately confident</option>
                    <option value="Low">⚠️ Low - Experimental</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Purchase Date</label>
                  <input
                    type="date"
                    value={formData.purchase_date}
                    onChange={(e) => setFormData({...formData, purchase_date: e.target.value})}
                    className={`w-full ${inputClass} border rounded px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all`}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Investment Thesis (Optional)</label>
                  <textarea
                    value={formData.investment_thesis}
                    onChange={(e) => setFormData({...formData, investment_thesis: e.target.value})}
                    className={`w-full ${inputClass} border rounded px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all`}
                    rows="3"
                    placeholder="Why did you invest in this asset? What's your long-term view?"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg font-medium transition-all duration-200 hover:shadow-lg"
                  >
                    {editingInvestment ? '💾 Update Investment' : '➕ Add Investment'}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className={`flex-1 py-2 rounded-lg font-medium transition-all duration-200 ${
                      darkMode 
                        ? 'bg-gray-600 hover:bg-gray-700 text-white' 
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    }`}
                  >
                    ❌ Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Investments Table */}
        <div className={`${tableClass} rounded-lg overflow-hidden shadow-sm`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={tableHeaderClass}>
                <tr>
                  <th className="px-4 py-3 text-left">Asset</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-right">Units</th>
                  <th className="px-4 py-3 text-right">Buy Price</th>
                  <th className="px-4 py-3 text-right">Current Price</th>
                  <th className="px-4 py-3 text-right">Total Value</th>
                  <th className="px-4 py-3 text-right">P/L</th>
                  <th className="px-4 py-3 text-center">Conviction</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {investments.length === 0 ? (
                  <tr>
                    <td colSpan="9" className={`px-4 py-12 text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      <div className="space-y-4">
                        <PieChart className="w-16 h-16 mx-auto opacity-50" />
                        <div>
                          <p className="text-lg font-medium">No investments added yet</p>
                          <p className="text-sm">Click "Add Investment" to start tracking your portfolio! 🚀</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  investments.map((investment) => (
                    <tr key={investment.id} className={`border-t ${tableBorderClass} hover:${darkMode ? 'bg-gray-750' : 'bg-gray-50'} transition-all duration-200`}>
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-bold text-lg">{investment.ticker}</div>
                          <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{investment.name}</div>
                          <div className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                            {new Date(investment.last_price_update).toLocaleString()}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                          investment.asset_type === 'Stock' ? 'bg-blue-100 text-blue-800' :
                          investment.asset_type === 'Crypto' ? 'bg-orange-100 text-orange-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {investment.asset_type === 'Stock' ? '📈' : 
                           investment.asset_type === 'Crypto' ? '₿' : '📊'} {investment.asset_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{investment.units}</td>
                      <td className="px-4 py-3 text-right font-mono">₹{investment.avg_buy_price.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        <span className={investment.current_price > 0 ? '' : 'text-gray-400'}>
                          ₹{investment.current_price.toFixed(2)}
                          {investment.current_price === 0 && ' (Pending)'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold">
                        {formatCurrency(investment.total_value)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className={`font-bold ${investment.unrealized_pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {investment.unrealized_pnl >= 0 ? '📈' : '📉'} {formatCurrency(investment.unrealized_pnl)}
                        </div>
                        <div className={`text-sm font-medium ${investment.unrealized_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {investment.unrealized_pnl >= 0 ? '+' : ''}{investment.unrealized_pnl_percent.toFixed(2)}%
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-3 py-1 text-xs rounded-full font-medium ${getConvictionBadgeColor(investment.conviction_level)}`}>
                          {investment.conviction_level === 'High' ? '🚀' : 
                           investment.conviction_level === 'Medium' ? '⚡' : '⚠️'} {investment.conviction_level}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => handleEdit(investment)}
                            className={`p-2 rounded-lg transition-all duration-200 ${
                              darkMode 
                                ? 'text-blue-400 hover:text-blue-300 hover:bg-blue-900/20' 
                                : 'text-blue-600 hover:text-blue-500 hover:bg-blue-50'
                            }`}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(investment.id)}
                            className={`p-2 rounded-lg transition-all duration-200 ${
                              darkMode 
                                ? 'text-red-400 hover:text-red-300 hover:bg-red-900/20' 
                                : 'text-red-600 hover:text-red-500 hover:bg-red-50'
                            }`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Investment Thesis Details */}
        {investments.some(inv => inv.investment_thesis) && (
          <div className="mt-8">
            <h3 className="text-xl font-bold mb-4">💡 Investment Thesis</h3>
            <div className="space-y-4">
              {investments
                .filter(investment => investment.investment_thesis)
                .map((investment) => (
                  <details key={`thesis-${investment.id}`} className={`${cardClass} border rounded-lg shadow-sm`}>
                    <summary className="cursor-pointer p-4 font-medium hover:bg-opacity-80 transition-all duration-200 rounded-lg">
                      📋 {investment.ticker} - {investment.name}
                    </summary>
                    <div className={`px-4 pb-4 ${darkMode ? 'text-gray-300' : 'text-gray-600'} whitespace-pre-wrap leading-relaxed`}>
                      {investment.investment_thesis}
                    </div>
                  </details>
                ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className={`mt-16 text-center ${darkMode ? 'text-gray-400 border-gray-700' : 'text-gray-500 border-gray-200'} border-t pt-8 transition-colors`}>
          <div className="space-y-2">
            <p className="font-medium">🚀 Personal Investment Portfolio Tracker v2.0</p>
            <p className="text-sm">
              📊 Prices updated every 15 minutes • 🔄 Data from Yahoo Finance & CoinGecko
            </p>
            <p className="text-xs opacity-75">
              💡 Track Indian stocks (.NS), US stocks, and cryptocurrencies (-USD) in real-time
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App; setDarkMode(!darkMode)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${
                darkMode 
                  ? 'bg-gray-700 hover:bg-gray-600 text-yellow-400 hover:text-yellow-300' 
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700 hover:text-gray-800'
              }`}
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              <span className="hidden sm:inline">{darkMode ? 'Light' : 'Dark'}</span>
            </button>

            <button
              onClick={handleRefreshPrices}
              disabled={refreshing}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg disabled:opacity-50 transition-all duration-200"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{refreshing ? 'Updating...' : 'Refresh'}</span>
            </button>

            <button
              onClick={exportToCSV}
              disabled={investments.length === 0}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg disabled:opacity-50 transition-all duration-200"
            >
              <Download className="w-5 h-5" />
              <span className="hidden sm:inline">Export</span>
            </button>

            <button
              onClick={() =>
