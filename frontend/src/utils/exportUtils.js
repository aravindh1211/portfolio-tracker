// frontend/src/utils/exportUtils.js

export const exportToCSV = (investments, filename = 'portfolio_data.csv') => {
  const headers = [
    'Name',
    'Ticker',
    'Asset Type',
    'Units',
    'Currency',
    'Buy Price',
    'Current Price',
    'Total Invested (INR)',
    'Current Value (INR)',
    'P/L (INR)',
    'P/L (%)',
    'Conviction Level',
    'Purchase Date'
  ];

  const csvData = investments.map(inv => [
    inv.name,
    inv.ticker,
    inv.asset_type,
    inv.units,
    inv.currency,
    inv.avg_buy_price_native,
    inv.current_price_native,
    (inv.units * inv.avg_buy_price_native * (inv.currency === 'USD' ? 83 : 1)).toFixed(2),
    inv.total_value_inr.toFixed(2),
    inv.unrealized_pnl_inr.toFixed(2),
    inv.unrealized_pnl_percent.toFixed(2),
    inv.conviction_level,
    new Date(inv.purchase_date).toLocaleDateString()
  ]);

  const csvContent = [headers, ...csvData]
    .map(row => row.map(field => `"${field}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

export const exportAllocationToCSV = (allocationData, filename = 'allocation_analysis.csv') => {
  const headers = ['Category', 'Current Value (INR)', 'Current Allocation (%)', 'Target Allocation (%)'];
  
  const csvData = Object.entries(allocationData.current_allocation_by_value || {}).map(([category, value]) => [
    category,
    value.toFixed(2),
    (allocationData.current_allocation_by_percent[category] || 0).toFixed(2),
    (allocationData.ideal_allocation_by_percent[category] || 0).toFixed(2)
  ]);

  const csvContent = [headers, ...csvData]
    .map(row => row.map(field => `"${field}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

export const generatePortfolioSummary = (investments) => {
  let totalInvested = 0;
  let totalCurrentValue = 0;
  let totalGainLoss = 0;

  investments.forEach(inv => {
    const invested = inv.units * inv.avg_buy_price_native * (inv.currency === 'USD' ? 83 : 1);
    totalInvested += invested;
    totalCurrentValue += inv.total_value_inr;
    totalGainLoss += inv.unrealized_pnl_inr;
  });

  const totalGainLossPercent = totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0;

  return {
    totalInvested,
    totalCurrentValue,
    totalGainLoss,
    totalGainLossPercent,
    totalHoldings: investments.length
  };
};
