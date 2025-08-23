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

export default PortfolioSummary;
