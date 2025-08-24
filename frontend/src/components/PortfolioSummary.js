import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, PieChart } from 'lucide-react';

const PortfolioSummary = ({ investments }) => {
  const calculateSummary = () => {
    let totalInvested = 0;
    let totalCurrentValue = 0;
    let totalGainLoss = 0;
    let bestPerformer = null;
    let worstPerformer = null;

    investments.forEach(inv => {
      const invested = inv.units * inv.avg_buy_price_native * (inv.currency === 'USD' ? 83 : 1);
      totalInvested += invested;
      totalCurrentValue += inv.total_value_inr;
      totalGainLoss += inv.unrealized_pnl_inr;

      if (!bestPerformer || inv.unrealized_pnl_percent > bestPerformer.unrealized_pnl_percent) {
        bestPerformer = inv;
      }
      if (!worstPerformer || inv.unrealized_pnl_percent < worstPerformer.unrealized_pnl_percent) {
        worstPerformer = inv;
      }
    });

    const totalGainLossPercent = totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0;

    return {
      totalInvested,
      totalCurrentValue,
      totalGainLoss,
      totalGainLossPercent,
      totalHoldings: investments.length,
      bestPerformer,
      worstPerformer
    };
  };

  const summary = calculateSummary();

  const SummaryCard = ({ title, value, subtitle, icon: Icon, color = "text-white" }) => (
    <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-sm font-medium">{title}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <Icon className={`w-8 h-8 ${color.replace('text-', 'text-').split('-')[1] === 'white' ? 'text-gray-400' : color}`} />
      </div>
    </div>
  );

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-bold text-white mb-4">Portfolio Summary</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <SummaryCard
          title="Total Invested"
          value={`₹${summary.totalInvested.toFixed(2)}`}
          icon={DollarSign}
        />
        
        <SummaryCard
          title="Current Value"
          value={`₹${summary.totalCurrentValue.toFixed(2)}`}
          icon={TrendingUp}
        />
        
        <SummaryCard
          title="Total P/L"
          value={`₹${summary.totalGainLoss.toFixed(2)}`}
          subtitle={`${summary.totalGainLossPercent >= 0 ? '+' : ''}${summary.totalGainLossPercent.toFixed(2)}%`}
          icon={summary.totalGainLoss >= 0 ? TrendingUp : TrendingDown}
          color={summary.totalGainLoss >= 0 ? "text-green-400" : "text-red-400"}
        />
        
        <SummaryCard
          title="Total Holdings"
          value={summary.totalHoldings}
          icon={PieChart}
        />
      </div>

      {/* Best and Worst Performers */}
      {summary.bestPerformer && summary.worstPerformer && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div className="bg-gray-800 p-4 rounded-lg border border-green-500/20">
            <h3 className="text-green-400 font-semibold mb-2">🏆 Best Performer</h3>
            <p className="text-white font-medium">{summary.bestPerformer.name}</p>
            <p className="text-green-400 text-sm">+{summary.bestPerformer.unrealized_pnl_percent.toFixed(2)}%</p>
          </div>
          
          <div className="bg-gray-800 p-4 rounded-lg border border-red-500/20">
            <h3 className="text-red-400 font-semibold mb-2">📉 Worst Performer</h3>
            <p className="text-white font-medium">{summary.worstPerformer.name}</p>
            <p className="text-red-400 text-sm">{summary.worstPerformer.unrealized_pnl_percent.toFixed(2)}%</p>
          </div>
        </div>
      )}
    </div>
  );
};

// Updated frontend logic to handle the new currency requirements

const renderInvestmentRow = (investment) => {
  const {
    id,
    ticker,
    name,
    asset_type,
    units,
    avg_buy_price,
    current_price,
    current_price_inr,  // New: INR converted price for crypto
    buy_price_formatted,     // e.g., "$191.48" or "₹67000"
    current_price_formatted, // e.g., "$340.01" or "₹95000" 
    total_value_inr,         // Always in INR
    total_invested_inr,      // Always in INR
    unrealized_pnl_inr,      // Always in INR
    unrealized_pnl_percent,
    conviction_level,
    currency,
    usd_to_inr_rate
  } = investment;

  // Determine display logic based on asset type
  const getDisplayPrices = () => {
    if (asset_type.toLowerCase() === 'crypto') {
      return {
        buyPrice: `₹${avg_buy_price.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
        currentPrice: `₹${current_price_inr.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
        note: `(Live: $${current_price.toFixed(2)} USD)`
      };
    } else if (ticker.endsWith('.NS') || ticker.endsWith('.BO')) {
      return {
        buyPrice: `₹${avg_buy_price.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
        currentPrice: `₹${current_price.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
        note: null
      };
    } else {
      return {
        buyPrice: `$${avg_buy_price.toFixed(2)}`,
        currentPrice: `$${current_price.toFixed(2)}`,
        note: null
      };
    }
  };

  const displayPrices = getDisplayPrices();

  return (
    <tr key={id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
      {/* Asset Column */}
      <td className="py-3 px-4">
        <div className="font-semibold text-gray-900 dark:text-white">{ticker}</div>
        <div className="text-sm text-gray-600 dark:text-gray-400">{name}</div>
        <div className="text-xs text-gray-500 dark:text-gray-500">{formatDate(investment.purchase_date)}</div>
      </td>

      {/* Type Column */}
      <td className="py-3 px-4">
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getAssetTypeColor(asset_type)}`}>
          {getAssetTypeIcon(asset_type)} {asset_type}
        </span>
      </td>

      {/* Units Column */}
      <td className="py-3 px-4 font-mono text-gray-900 dark:text-white">
        {asset_type.toLowerCase() === 'crypto' ? units.toFixed(8) : units.toFixed(4)}
      </td>

      {/* Buy Price Column */}
      <td className="py-3 px-4 font-mono text-gray-900 dark:text-white">
        {displayPrices.buyPrice}
      </td>

      {/* Current Price Column */}
      <td className="py-3 px-4">
        <div className="font-mono text-gray-900 dark:text-white">
          {displayPrices.currentPrice}
        </div>
        {displayPrices.note && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {displayPrices.note}
          </div>
        )}
      </td>

      {/* Total Value Column - Always in INR */}
      <td className="py-3 px-4 font-mono text-gray-900 dark:text-white">
        ₹{isNaN(total_value_inr) ? '0.00' : total_value_inr.toLocaleString('en-IN', {
          minimumFractionDigits: 2, 
          maximumFractionDigits: 2
        })}
      </td>

      {/* P/L Column - Always in INR */}
      <td className="py-3 px-4">
        <div className={`font-mono ${unrealized_pnl_inr >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {unrealized_pnl_inr >= 0 ? '+' : '-'}₹{isNaN(unrealized_pnl_inr) ? '0.00' : Math.abs(unrealized_pnl_inr).toLocaleString('en-IN', {
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2
          })}
        </div>
        <div className={`text-xs ${unrealized_pnl_percent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {isNaN(unrealized_pnl_percent) ? '0.00%' : `${unrealized_pnl_percent >= 0 ? '+' : ''}${unrealized_pnl_percent.toFixed(2)}%`}
        </div>
      </td>

      {/* Conviction Column */}
      <td className="py-3 px-4">
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getConvictionColor(conviction_level)}`}>
          ⚡ {conviction_level}
        </span>
      </td>

      {/* Actions Column */}
      <td className="py-3 px-4">
        <div className="flex space-x-2">
          <button 
            onClick={() => handleEdit(id)}
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
            title="Edit Investment"
          >
            ✏️
          </button>
          <button 
            onClick={() => handleDelete(id)}
            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"
            title="Delete Investment"
          >
            🗑️
          </button>
        </div>
      </td>
    </tr>
  );
};

// Helper functions
const getAssetTypeColor = (type) => {
  switch(type?.toLowerCase()) {
    case 'stock': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    case 'crypto': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
    case 'mutual fund': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
  }
};

const getAssetTypeIcon = (type) => {
  switch(type?.toLowerCase()) {
    case 'stock': return '📊';
    case 'crypto': return '₿';
    case 'mutual fund': return '🏦';
    default: return '📈';
  }
};

const getConvictionColor = (level) => {
  switch(level?.toLowerCase()) {
    case 'high': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    case 'low': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
  }
};

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

// Updated Add Investment Form Logic
const AddInvestmentForm = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    asset_type: 'Stock',
    ticker: '',
    name: '',
    units: '',
    avg_buy_price: '',
    currency: 'INR', // Will be determined automatically
    investment_thesis: '',
    conviction_level: 'Medium',
    purchase_date: new Date().toISOString().split('T')[0]
  });

  // Determine currency based on asset type and ticker
  const determineCurrency = (assetType, ticker) => {
    if (ticker.endsWith('.NS') || ticker.endsWith('.BO')) {
      return 'INR'; // Indian stocks
    } else if (assetType.toLowerCase() === 'crypto') {
      return 'INR'; // You input crypto buy prices in INR
    } else if (assetType.toLowerCase() === 'stock') {
      return 'USD'; // US stocks buy prices in USD
    } else {
      return 'INR'; // Default
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      
      // Auto-determine currency when asset type or ticker changes
      if (name === 'asset_type' || name === 'ticker') {
        updated.currency = determineCurrency(
          name === 'asset_type' ? value : prev.asset_type,
          name === 'ticker' ? value : prev.ticker
        );
      }
      
      return updated;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Format the data before submitting
    const submitData = {
      ...formData,
      units: parseFloat(formData.units),
      avg_buy_price: parseFloat(formData.avg_buy_price),
      purchase_date: new Date(formData.purchase_date).toISOString()
    };
    
    onSubmit(submitData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Add New Investment</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Asset Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Asset Type
            </label>
            <select
              name="asset_type"
              value={formData.asset_type}
              onChange={handleInputChange}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="Stock">Stock</option>
              <option value="Crypto">Cryptocurrency</option>
              <option value="Mutual Fund">Mutual Fund</option>
            </select>
          </div>

          {/* Ticker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Ticker Symbol
            </label>
            <input
              type="text"
              name="ticker"
              value={formData.ticker}
              onChange={handleInputChange}
              placeholder="e.g., AAPL, BTC-USD, RELIANCE.NS"
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Use .NS for NSE stocks, .BO for BSE stocks, -USD for crypto
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Investment Name
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="e.g., Apple Inc., Bitcoin, Reliance"
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Units */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Units/Quantity
            </label>
            <input
              type="number"
              name="units"
              value={formData.units}
              onChange={handleInputChange}
              step="0.00000001"
              placeholder="e.g., 100, 0.5, 0.00245"
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Average Buy Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Average Buy Price ({formData.currency})
            </label>
            <input
              type="number"
              name="avg_buy_price"
              value={formData.avg_buy_price}
              onChange={handleInputChange}
              step="0.01"
              placeholder={`Enter price in ${formData.currency}`}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {formData.asset_type === 'Crypto' && 'Enter crypto buy price in INR'}
              {formData.asset_type === 'Stock' && !formData.ticker.endsWith('.NS') && !formData.ticker.endsWith('.BO') && 'Enter US stock price in USD'}
              {(formData.ticker.endsWith('.NS') || formData.ticker.endsWith('.BO')) && 'Enter Indian stock price in INR'}
            </div>
          </div>

          {/* Conviction Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Conviction Level
            </label>
            <select
              name="conviction_level"
              value={formData.conviction_level}
              onChange={handleInputChange}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          {/* Purchase Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Purchase Date
            </label>
            <input
              type="date"
              name="purchase_date"
              value={formData.purchase_date}
              onChange={handleInputChange}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Investment Thesis */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Investment Thesis (Optional)
            </label>
            <textarea
              name="investment_thesis"
              value={formData.investment_thesis}
              onChange={handleInputChange}
              rows="3"
              placeholder="Why did you invest in this asset?"
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              Add Investment
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 font-medium py-3 px-4 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Currency Information Display Component
const CurrencyInfo = ({ usdToInrRate }) => {
  return (
    <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 bg-blue-100 dark:bg-blue-800 rounded-lg flex items-center justify-center">
            <span className="text-xl">💱</span>
          </div>
          <div>
            <h3 className="font-medium text-blue-900 dark:text-blue-100">Currency Logic</h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Live USD/INR Rate: ₹{usdToInrRate?.toFixed(2) || '83.00'}
            </p>
          </div>
        </div>
        <div className="text-sm text-blue-600 dark:text-blue-300 space-y-1">
          <div>🇺🇸 US Stocks: USD prices, INR totals</div>
          <div>₿ Crypto: INR buy price, INR display</div>
          <div>🇮🇳 Indian: All INR</div>
        </div>
      </div>
    </div>
  );
};

export default PortfolioSummary;
