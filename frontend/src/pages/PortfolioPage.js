// frontend/src/pages/PortfolioPage.js
import React, { useState, useEffect, useCallback } from 'react';
import { get, post, put, del } from '../api';
import { PlusCircle, Edit, Trash2, Search, Download, FileDown } from 'lucide-react';
import PortfolioSummary from '../components/PortfolioSummary';
import { exportToCSV, generatePortfolioSummary } from '../utils/exportUtils';

// ❗ ACTION REQUIRED: Replace this URL with your actual backend URL from Render.
const API_BASE = process.env.NODE_ENV === 'production' 
  ? 'https://portfolio-tracker-backend-st89.onrender.com' // <-- EDIT THIS LINE
  : 'http://localhost:8000';

const PortfolioPage = () => {
  const [investments, setInvestments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingInv, setEditingInv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    asset_type: 'IND Equity',
    ticker: '',
    name: '',
    units: '',
    currency: 'INR',
    avg_buy_price_native: '',
    conviction_level: 'Medium',
    purchase_date: new Date().toISOString().split('T')[0],
    investment_thesis: '',
    category_id: '',
    subcategory_id: ''
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [invData, catData] = await Promise.all([
        get(`${API_BASE}/api/investments`),
        get(`${API_BASE}/api/categories`),
      ]);
      setInvestments(invData);
      setCategories(catData);
    } catch (error) {
      console.error("Failed to fetch data:", error);
      alert("Failed to fetch portfolio data. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    let newFormData = { ...formData, [name]: value };
    
    // Reset ticker on currency change
    if (name === "currency") {
      newFormData.ticker = "";
    }
    // Reset subcategory if category changes
    if (name === "category_id") {
      newFormData.subcategory_id = '';
    }
    setFormData(newFormData);
  };

// Add this debug version of your handleSubmit function to PortfolioPage.js
// Replace the existing handleSubmit function with this one:

const handleSubmit = async (e) => {
  e.preventDefault();
  setSubmitting(true);
  
  // Validate required fields
  if (!formData.ticker || !formData.name || !formData.units || !formData.avg_buy_price_native) {
    alert("Please fill in all required fields");
    setSubmitting(false);
    return;
  }

  // Validate numeric fields
  if (isNaN(parseFloat(formData.units)) || parseFloat(formData.units) <= 0) {
    alert("Units must be a valid positive number");
    setSubmitting(false);
    return;
  }

  if (isNaN(parseFloat(formData.avg_buy_price_native)) || parseFloat(formData.avg_buy_price_native) <= 0) {
    alert("Average buy price must be a valid positive number");
    setSubmitting(false);
    return;
  }

  // Validate date
  const purchaseDate = new Date(formData.purchase_date);
  if (isNaN(purchaseDate.getTime())) {
    alert("Please provide a valid purchase date");
    setSubmitting(false);
    return;
  }

  const payload = {
    asset_type: formData.asset_type,
    ticker: formData.ticker.trim().toUpperCase(),
    name: formData.name.trim(),
    units: parseFloat(formData.units),
    currency: formData.currency,
    avg_buy_price_native: parseFloat(formData.avg_buy_price_native),
    conviction_level: formData.conviction_level,
    purchase_date: formData.purchase_date + "T00:00:00", // Ensure proper ISO format
    investment_thesis: formData.investment_thesis || "",
    category_id: formData.category_id ? parseInt(formData.category_id) : null,
    subcategory_id: formData.subcategory_id ? parseInt(formData.subcategory_id) : null,
  };
  
  // Debug logging
  console.log("Submitting payload:", JSON.stringify(payload, null, 2));
  
  try {
    if (editingInv) {
      await put(`${API_BASE}/api/investments/${editingInv.id}`, payload);
    } else {
      await post(`${API_BASE}/api/investments`, payload);
    }
    resetForm();
    await fetchData(); // Wait for data to be fetched
    alert(editingInv ? "Investment updated successfully!" : "Investment added successfully!");
  } catch (error) {
    console.error("Failed to save investment:", error);
    console.error("Error details:", error.message);
    
    // Show the actual error message to the user
    alert(`Failed to save investment: ${error.message}`);
  } finally {
    setSubmitting(false);
  }
};

  const handleEdit = (inv) => {
    setEditingInv(inv);
    setFormData({
      asset_type: inv.asset_type,
      ticker: inv.ticker,
      name: inv.name,
      units: inv.units.toString(),
      currency: inv.currency,
      avg_buy_price_native: inv.avg_buy_price_native.toString(),
      conviction_level: inv.conviction_level,
      purchase_date: new Date(inv.purchase_date).toISOString().split('T')[0],
      investment_thesis: inv.investment_thesis || '',
      category_id: inv.category_id?.toString() || '',
      subcategory_id: inv.subcategory_id?.toString() || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this investment?')) {
      try {
        await del(`${API_BASE}/api/investments/${id}`);
        await fetchData();
        alert("Investment deleted successfully!");
      } catch (error) {
        console.error("Failed to delete investment:", error);
        alert("Failed to delete investment. Please try again.");
      }
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingInv(null);
    setFormData({
      asset_type: 'IND Equity',
      ticker: '',
      name: '',
      units: '',
      currency: 'INR',
      avg_buy_price_native: '',
      conviction_level: 'Medium',
      purchase_date: new Date().toISOString().split('T')[0],
      investment_thesis: '',
      category_id: '',
      subcategory_id: ''
    });
  };

  const handleExportCSV = () => {
    exportToCSV(investments, `portfolio_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const filteredInvestments = investments.filter(inv =>
    inv.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.ticker.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedCategory = categories.find(c => c.id.toString() === formData.category_id);

  return (
    <div className="text-white">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Portfolio</h1>
        <button
          onClick={handleExportCSV}
          disabled={investments.length === 0}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg"
        >
          <Download className="w-5 h-5" /> Export CSV
        </button>
      </div>

      {/* Portfolio Summary Dashboard */}
      {investments.length > 0 && <PortfolioSummary investments={investments} />}

      <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or ticker..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <button 
          onClick={() => setShowForm(true)} 
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg"
        >
          <PlusCircle className="w-5 h-5" /> Add Investment
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">{editingInv ? 'Edit' : 'Add'} Investment</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Asset Type & Currency */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Asset Type *</label>
                  <select 
                    name="asset_type" 
                    value={formData.asset_type} 
                    onChange={handleFormChange} 
                    required
                    className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-purple-500 focus:outline-none"
                  >
                    <option value="IND Equity">IND Equity</option>
                    <option value="US Equity">US Equity</option>
                    <option value="Crypto">Crypto</option>
                    <option value="Commodity">Commodity</option>
                    <option value="Debt">Debt</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Currency *</label>
                  <select 
                    name="currency" 
                    value={formData.currency} 
                    onChange={handleFormChange} 
                    required
                    className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-purple-500 focus:outline-none"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              {/* Ticker & Name */}
              <div>
                <label className="block text-sm font-medium mb-1">Ticker *</label>
                <input 
                  type="text" 
                  name="ticker" 
                  placeholder={formData.currency === 'INR' ? "e.g., RELIANCE.NS" : "e.g., AAPL"} 
                  value={formData.ticker} 
                  onChange={handleFormChange} 
                  required 
                  className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-purple-500 focus:outline-none" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input 
                  type="text" 
                  name="name" 
                  placeholder="e.g., Reliance Industries" 
                  value={formData.name} 
                  onChange={handleFormChange} 
                  required 
                  className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-purple-500 focus:outline-none" 
                />
              </div>

              {/* Units & Buy Price */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Units *</label>
                  <input 
                    type="number" 
                    step="any" 
                    name="units" 
                    value={formData.units} 
                    onChange={handleFormChange} 
                    required 
                    min="0"
                    className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-purple-500 focus:outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Avg. Buy Price ({formData.currency}) *</label>
                  <input 
                    type="number" 
                    step="any" 
                    name="avg_buy_price_native" 
                    value={formData.avg_buy_price_native} 
                    onChange={handleFormChange} 
                    required 
                    min="0"
                    className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-purple-500 focus:outline-none" 
                  />
                </div>
              </div>

              {/* Category & Subcategory */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <select 
                    name="category_id" 
                    value={formData.category_id} 
                    onChange={handleFormChange} 
                    className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-purple-500 focus:outline-none"
                  >
                    <option value="">None</option>
                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Subcategory</label>
                  <select 
                    name="subcategory_id" 
                    value={formData.subcategory_id} 
                    onChange={handleFormChange} 
                    disabled={!selectedCategory}
                    className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-purple-500 focus:outline-none disabled:opacity-50"
                  >
                    <option value="">None</option>
                    {selectedCategory?.subcategories.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Conviction & Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Conviction Level *</label>
                  <select 
                    name="conviction_level" 
                    value={formData.conviction_level} 
                    onChange={handleFormChange} 
                    required
                    className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-purple-500 focus:outline-none"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Purchase Date *</label>
                  <input 
                    type="date" 
                    name="purchase_date" 
                    value={formData.purchase_date} 
                    onChange={handleFormChange} 
                    required 
                    className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Investment Thesis */}
              <div>
                <label className="block text-sm font-medium mb-1">Investment Thesis (Optional)</label>
                <textarea 
                  name="investment_thesis" 
                  value={formData.investment_thesis} 
                  onChange={handleFormChange}
                  rows="3"
                  placeholder="Why did you invest in this asset?"
                  className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-purple-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-4 pt-4 border-t border-gray-600">
                <button 
                  type="button" 
                  onClick={resetForm}
                  disabled={submitting}
                  className="px-6 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Saving...' : 'Save Investment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Investments Table */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="p-4 text-left">Asset</th>
                <th className="p-4 text-right">Units</th>
                <th className="p-4 text-right">Buy Price</th>
                <th className="p-4 text-right">Current Price</th>
                <th className="p-4 text-right">Total Value (INR)</th>
                <th className="p-4 text-right">P/L (INR)</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" className="text-center p-8">Loading portfolio...</td></tr>
              ) : filteredInvestments.length === 0 ? (
                <tr><td colSpan="7" className="text-center p-8 text-gray-400">No investments found</td></tr>
              ) : filteredInvestments.map(inv => (
                <tr key={inv.id} className="border-b border-gray-700 hover:bg-gray-750">
                  <td className="p-4">
                    <div className="font-bold">{inv.name}</div>
                    <div className="text-sm text-gray-400">{inv.ticker}</div>
                    <div className="text-xs text-purple-400">{inv.asset_type}</div>
                  </td>
                  <td className="p-4 text-right">{inv.units}</td>
                  <td className="p-4 text-right">{inv.currency === 'USD' ? '$' : '₹'}{inv.avg_buy_price_native.toFixed(2)}</td>
                  <td className="p-4 text-right">{inv.currency === 'USD' ? '$' : '₹'}{inv.current_price_native.toFixed(2)}</td>
                  <td className="p-4 text-right font-bold">₹{inv.total_value_inr.toFixed(2)}</td>
                  <td className={`p-4 text-right font-bold ${inv.unrealized_pnl_inr >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ₹{inv.unrealized_pnl_inr.toFixed(2)}
                    <div className="text-sm font-normal">({inv.unrealized_pnl_percent.toFixed(2)}%)</div>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex justify-center gap-2">
                      <button 
                        onClick={() => handleEdit(inv)} 
                        className="p-2 text-blue-400 hover:text-blue-300 hover:bg-gray-700 rounded"
                        title="Edit Investment"
                      >
                        <Edit size={18}/>
                      </button>
                      <button 
                        onClick={() => handleDelete(inv.id)} 
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-gray-700 rounded"
                        title="Delete Investment"
                      >
                        <Trash2 size={18}/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Show empty state message if no investments */}
      {!loading && investments.length === 0 && (
        <div className="text-center py-12 bg-gray-800 rounded-lg mt-8">
          <PlusCircle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-300 mb-2">No investments yet</h3>
          <p className="text-gray-400 mb-6">Start building your portfolio by adding your first investment</p>
          <button 
            onClick={() => setShowForm(true)} 
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg"
          >
            Add Your First Investment
          </button>
        </div>
      )}
    </div>
  );
};

export default PortfolioPage;

