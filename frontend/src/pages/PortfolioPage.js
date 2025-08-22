import React, { useState, useEffect, useCallback } from 'react';
import { get, post, put, del } from '../api';
import { PlusCircle, Edit, Trash2, RefreshCw, Download, Search } from 'lucide-react';

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

  const [formData, setFormData] = useState({
    asset_type: 'IND Equity',
    ticker: '',
    name: '',
    units: '',
    currency: 'INR',
    avg_buy_price_native: '',
    conviction_level: 'Medium',
    purchase_date: new Date().toISOString().split('T')[0],
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
    // If currency is changed to INR, ticker suffix logic might be added here if needed
    if (name === "currency") {
        newFormData.ticker = ""; // Reset ticker on currency change
    }
    // Reset subcategory if category changes
    if (name === "category_id") {
        newFormData.subcategory_id = '';
    }
    setFormData(newFormData);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...formData,
      units: parseFloat(formData.units),
      avg_buy_price_native: parseFloat(formData.avg_buy_price_native),
      category_id: formData.category_id ? parseInt(formData.category_id) : null,
      subcategory_id: formData.subcategory_id ? parseInt(formData.subcategory_id) : null,
    };
    
    try {
      if (editingInv) {
        await put(`${API_BASE}/api/investments/${editingInv.id}`, payload);
      } else {
        await post(`${API_BASE}/api/investments`, payload);
      }
      resetForm();
      fetchData();
    } catch (error) {
      console.error("Failed to save investment:", error);
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
      category_id: inv.category_id?.toString() || '',
      subcategory_id: inv.subcategory_id?.toString() || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure?')) {
      try {
        await del(`${API_BASE}/api/investments/${id}`);
        fetchData();
      } catch (error) {
        console.error("Failed to delete investment:", error);
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
      category_id: '',
      subcategory_id: ''
    });
  };

  const filteredInvestments = investments.filter(inv =>
    inv.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.ticker.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedCategory = categories.find(c => c.id.toString() === formData.category_id);

  return (
    <div className="text-white">
      <h1 className="text-3xl font-bold mb-6">Portfolio</h1>
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
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg">
          <PlusCircle className="w-5 h-5" /> Add Investment
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">{editingInv ? 'Edit' : 'Add'} Investment</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Asset Type & Currency */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label>Asset Type</label>
                  <select name="asset_type" value={formData.asset_type} onChange={handleFormChange} className="w-full mt-1 p-2 bg-gray-700 rounded">
                    <option>IND Equity</option>
                    <option>US Equity</option>
                    <option>Crypto</option>
                    <option>Commodity</option>
                    <option>Debt</option>
                  </select>
                </div>
                <div>
                  <label>Currency</label>
                  <select name="currency" value={formData.currency} onChange={handleFormChange} className="w-full mt-1 p-2 bg-gray-700 rounded">
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>
              {/* Ticker & Name */}
              <div>
                <label>Ticker</label>
                <input type="text" name="ticker" placeholder={formData.currency === 'INR' ? "e.g., RELIANCE.NS" : "e.g., AAPL"} value={formData.ticker} onChange={handleFormChange} required className="w-full mt-1 p-2 bg-gray-700 rounded" />
              </div>
              <div>
                <label>Name</label>
                <input type="text" name="name" placeholder="e.g., Reliance Industries" value={formData.name} onChange={handleFormChange} required className="w-full mt-1 p-2 bg-gray-700 rounded" />
              </div>
              {/* Units & Buy Price */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label>Units</label>
                  <input type="number" step="any" name="units" value={formData.units} onChange={handleFormChange} required className="w-full mt-1 p-2 bg-gray-700 rounded" />
                </div>
                <div>
                  <label>Avg. Buy Price ({formData.currency})</label>
                  <input type="number" step="any" name="avg_buy_price_native" value={formData.avg_buy_price_native} onChange={handleFormChange} required className="w-full mt-1 p-2 bg-gray-700 rounded" />
                </div>
              </div>
              {/* Category & Subcategory */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label>Category</label>
                    <select name="category_id" value={formData.category_id} onChange={handleFormChange} className="w-full mt-1 p-2 bg-gray-700 rounded">
                        <option value="">None</option>
                        {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                    </select>
                </div>
                <div>
                    <label>Subcategory</label>
                    <select name="subcategory_id" value={formData.subcategory_id} onChange={handleFormChange} className="w-full mt-1 p-2 bg-gray-700 rounded" disabled={!selectedCategory}>
                        <option value="">None</option>
                        {selectedCategory?.subcategories.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                    </select>
                </div>
              </div>
              {/* Conviction & Date */}
               <div className="grid grid-cols-2 gap-4">
                <div>
                    <label>Conviction</label>
                    <select name="conviction_level" value={formData.conviction_level} onChange={handleFormChange} className="w-full mt-1 p-2 bg-gray-700 rounded">
                        <option>High</option>
                        <option>Medium</option>
                        <option>Low</option>
                    </select>
                </div>
                <div>
                    <label>Purchase Date</label>
                    <input type="date" name="purchase_date" value={formData.purchase_date} onChange={handleFormChange} required className="w-full mt-1 p-2 bg-gray-700 rounded"/>
                </div>
               </div>
              <div className="flex justify-end gap-4 pt-4">
                <button type="button" onClick={resetForm} className="px-4 py-2 bg-gray-600 rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-purple-600 rounded">Save</button>
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
                <tr><td colSpan="7" className="text-center p-8">Loading...</td></tr>
              ) : filteredInvestments.map(inv => (
                <tr key={inv.id} className="border-b border-gray-700 hover:bg-gray-750">
                  <td className="p-4">
                    <div className="font-bold">{inv.name}</div>
                    <div className="text-sm text-gray-400">{inv.ticker}</div>
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
                    <button onClick={() => handleEdit(inv)} className="p-2 text-blue-400 hover:text-blue-300"><Edit size={18}/></button>
                    <button onClick={() => handleDelete(inv.id)} className="p-2 text-red-400 hover:text-red-300"><Trash2 size={18}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PortfolioPage;