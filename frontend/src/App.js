import React, { useState, useEffect } from 'react';
import { PlusCircle, Edit, Trash2, RefreshCw, TrendingUp, TrendingDown, DollarSign, PieChart, Download, Sun, Moon } from 'lucide-react';

const API_BASE = process.env.NODE_ENV === 'production' 
  ? 'https://your-app-name.onrender.com' 
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
      const [investmentsRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/api/investments`),
        fetch(`${API_BASE}/api/portfolio/stats`)
      ]);
      
      if (investmentsRes.ok && statsRes.ok) {
        setInvestments(await investmentsRes.json());
        setPortfolioStats(await statsRes.json());
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
    
    const payload = {
      ...formData,
      units: parseFloat(formData.units),
      avg_buy_price: parseFloat(formData.avg_buy_price),
      purchase_date: new Date(formData.purchase_date).toISOString()
    };

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
        await fetchData();
        resetForm();
      }
    } catch (error) {
      console.error('Error saving investment:', error);
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
        }
      } catch (error) {
        console.error('Error deleting investment:', error);
      }
    }
  };

  // Refresh prices
  const handleRefreshPrices = async () => {
    setRefreshing(true);
    try {
      await fetch(`${API_BASE}/api/refresh-prices`, { method: 'POST' });
      await fetchData();
    } catch (error) {
      console.error('Error refreshing prices:', error);
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
        <div className={`${darkMode ? 'text-white' : 'text-gray-900'} text-xl`}>Loading portfolio...</div>
      </div>
    );
  }

  const bgClass = darkMode ? 'bg-gray-900' : 'bg-gray-50';
  const textClass = darkMode ? 'text-white' : 'text-gray-900';
  const cardClass = darkMode ? 'bg-gray-800' : 'bg-white border border-gray-200';
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
          <h1 className="text-3xl font-bold">Investment Portfolio Tracker</h1>
          
          <div className="flex gap-2 sm:gap-4 flex-wrap">
            {/* Theme Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                darkMode 
                  ? 'bg-gray-700 hover:bg-gray-600 text-yellow-400' 
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              <span className="hidden sm:inline">{darkMode ? 'Light' : 'Dark'}</span>
            </button>

            <button
              onClick={handleRefreshPrices}
              disabled={refreshing}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>

            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Add Investment</span>
            </button>
          </div>
        </div>

        {/* Portfolio Stats */}
        {portfolioStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className={`${cardClass} p-6 rounded-lg shadow-sm`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Total Invested</p>
                  <p className="text-2xl font-bold">{formatCurrency(portfolioStats.total_invested)}</p>
                </div>
                <DollarSign className="w-8 h-8 text-blue-500" />
              </div>
            </div>
            
            <div className={`${cardClass} p-6 rounded-lg shadow-sm`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Current Value</p>
                  <p className="text-2xl font-bold">{formatCurrency(portfolioStats.current_value)}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-500" />
              </div>
            </div>
            
            <div className={`${cardClass} p-6 rounded-lg shadow-sm`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Net Return</p>
                  <p className={`text-2xl font-bold ${portfolioStats.net_return_percent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {portfolioStats.net_return_percent.toFixed(2)}%
                  </p>
                </div>
                {portfolioStats.net_return_percent >= 0 ? 
                  <TrendingUp className="w-8 h-8 text-green-500" /> : 
                  <TrendingDown className="w-8 h-8 text-red-500" />
                }
              </div>
            </div>
            
            <div className={`${cardClass} p-6 rounded-lg shadow-sm`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Total Holdings</p>
                  <p className="text-2xl font-bold">{portfolioStats.total_holdings}</p>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    High: {portfolioStats.high_conviction_count} | 
                    Med: {portfolioStats.medium_conviction_count} | 
                    Low: {portfolioStats.low_conviction_count}
                  </p>
                </div>
                <PieChart className="w-8 h-8 text-purple-500" />
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Form Modal */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className={`${modalClass} rounded-lg p-6 w-full max-w-md max-h-screen overflow-y-auto shadow-xl`}>
              <h2 className="text-xl font-bold mb-4">
                {editingInvestment ? 'Edit Investment' : 'Add New Investment'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Asset Type</label>
                  <select
                    value={formData.asset_type}
                    onChange={(e) => setFormData({...formData, asset_type: e.target.value})}
                    className={`w-full ${inputClass} border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                    required
                  >
                    <option value="Stock">Stock</option>
                    <option value="Crypto">Cryptocurrency</option>
                    <option value="Mutual Fund">Mutual Fund</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Ticker/Symbol</label>
                  <input
                    type="text"
                    value={formData.ticker}
                    onChange={(e) => setFormData({...formData, ticker: e.target.value})}
                    className={`w-full ${inputClass} border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                    placeholder="e.g., TCS.NS, AAPL, BTC-USD"
                    required
                  />
                  <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-1`}>
                    Indian stocks: Add .NS (TCS.NS), US stocks: AAPL, Crypto: BTC-USD
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className={`w-full ${inputClass} border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                    placeholder="Company/Asset name"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Units/Shares</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.units}
                      onChange={(e) => setFormData({...formData, units: e.target.value})}
                      className={`w-full ${inputClass} border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Avg Buy Price</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.avg_buy_price}
                      onChange={(e) => setFormData({...formData, avg_buy_price: e.target.value})}
                      className={`w-full ${inputClass} border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Conviction Level</label>
                  <select
                    value={formData.conviction_level}
                    onChange={(e) => setFormData({...formData, conviction_level: e.target.value})}
                    className={`w-full ${inputClass} border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                    required
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Purchase Date</label>
                  <input
                    type="date"
                    value={formData.purchase_date}
                    onChange={(e) => setFormData({...formData, purchase_date: e.target.value})}
                    className={`w-full ${inputClass} border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Investment Thesis</label>
                  <textarea
                    value={formData.investment_thesis}
                    onChange={(e) => setFormData({...formData, investment_thesis: e.target.value})}
                    className={`w-full ${inputClass} border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                    rows="3"
                    placeholder="Why did you invest in this asset? (supports markdown)"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg font-medium transition-colors"
                  >
                    {editingInvestment ? 'Update Investment' : 'Add Investment'}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                      darkMode 
                        ? 'bg-gray-600 hover:bg-gray-700 text-white' 
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    }`}
                  >
                    Cancel
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
                    <td colSpan="9" className={`px-4 py-8 text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      No investments added yet. Click "Add Investment" to get started!
                    </td>
                  </tr>
                ) : (
                  investments.map((investment) => (
                    <tr key={investment.id} className={`border-t ${tableBorderClass} hover:${darkMode ? 'bg-gray-750' : 'bg-gray-50'} transition-colors`}>
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium">{investment.ticker}</div>
                          <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{investment.name}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded ${darkMode ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-700'}`}>
                          {investment.asset_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">{investment.units}</td>
                      <td className="px-4 py-3 text-right">₹{investment.avg_buy_price.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">₹{investment.current_price.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatCurrency(investment.total_value)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className={`font-medium ${investment.unrealized_pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {formatCurrency(investment.unrealized_pnl)}
                        </div>
                        <div className={`text-sm ${investment.unrealized_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {investment.unrealized_pnl_percent.toFixed(2)}%
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 text-xs rounded ${getConvictionBadgeColor(investment.conviction_level)}`}>
                          {investment.conviction_level}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => handleEdit(investment)}
                            className="p-1 text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(investment.id)}
                            className="p-1 text-red-400 hover:text-red-300 transition-colors"
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

        {/* Investment Details - Show thesis when row is expanded */}
        <div className="mt-8 space-y-4">
          {investments.map((investment) => (
            investment.investment_thesis && (
              <details key={`thesis-${investment.id}`} className={`${cardClass} rounded-lg shadow-sm`}>
                <summary className="cursor-pointer p-4 font-medium hover:bg-opacity-80 transition-colors">
                  Investment Thesis: {investment.ticker}
                </summary>
                <div className={`px-4 pb-4 ${darkMode ? 'text-gray-300' : 'text-gray-600'} whitespace-pre-wrap`}>
                  {investment.investment_thesis}
                </div>
              </details>
            )
          ))}
        </div>

        {/* Footer */}
        <footer className={`mt-16 text-center ${darkMode ? 'text-gray-400 border-gray-700' : 'text-gray-500 border-gray-200'} border-t pt-8 transition-colors`}>
          <p>Personal Investment Portfolio Tracker</p>
          <p className="text-sm mt-2">
            Prices updated every 15 minutes • Data from Yahoo Finance & CoinGecko
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;