// frontend/src/pages/AllocationPage.js
import React, { useState, useEffect, useCallback } from 'react';
import { get, post } from '../api';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, Tag } from 'lucide-react';
import { exportAllocationToCSV } from '../utils/exportUtils';

// ❗ ACTION REQUIRED: Replace this URL with your actual backend URL from Render.
const API_BASE = process.env.NODE_ENV === 'production' 
  ? 'https://portfolio-tracker-backend-st89.onrender.com' // <-- EDIT THIS LINE
  : 'http://localhost:8000';

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088fe', '#00c49f', '#ff7c7c', '#8dd1e1'];

const AllocationPage = () => {
    const [analysis, setAnalysis] = useState(null);
    const [categories, setCategories] = useState([]);
    const [goals, setGoals] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [analysisData, catData, goalData] = await Promise.all([
                get(`${API_BASE}/api/reports/allocation-analysis`),
                get(`${API_BASE}/api/categories`),
                get(`${API_BASE}/api/allocation-goals`)
            ]);
            setAnalysis(analysisData);
            setCategories(catData);
            
            const initialGoals = {};
            catData.forEach(cat => {
                const existingGoal = goalData.find(g => g.category_id === cat.id);
                initialGoals[cat.id] = existingGoal ? existingGoal.percentage : 0;
            });
            setGoals(initialGoals);
        } catch (error) {
            console.error("Failed to fetch data:", error);
            alert("Failed to fetch allocation data. Please check your connection.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleGoalChange = (categoryId, value) => {
        const newGoals = { ...goals, [categoryId]: parseFloat(value) || 0 };
        setGoals(newGoals);
    };

    const handleSaveGoals = async () => {
        const total = Object.values(goals).reduce((sum, val) => sum + val, 0);
        if (total > 100) {
            alert("Total allocation cannot exceed 100%.");
            return;
        }
        
        setSaving(true);
        const payload = Object.entries(goals).map(([categoryId, percentage]) => ({
            category_id: parseInt(categoryId),
            percentage: percentage
        }));
        
        try {
            await post(`${API_BASE}/api/allocation-goals`, payload);
            alert("Goals saved successfully!");
            fetchData(); // Refresh data to update charts
        } catch (error) {
            console.error("Failed to save goals:", error);
            alert("Failed to save goals. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    const handleExportCSV = () => {
        if (analysis) {
            exportAllocationToCSV(analysis, `allocation_analysis_${new Date().toISOString().split('T')[0]}.csv`);
        }
    };
    
    const currentChartData = analysis ? Object.entries(analysis.current_allocation_by_percent).map(([name, value]) => ({ 
        name, 
        value: parseFloat(value.toFixed(2))
    })) : [];
    
    const idealChartData = Object.entries(goals)
        .map(([categoryId, value]) => {
            const category = categories.find(c => c.id.toString() === categoryId);
            return { name: category?.name, value: parseFloat(value) };
        })
        .filter(item => item.value > 0 && item.name);

    if (loading) return (
        <div className="flex items-center justify-center min-h-64 text-white">
            <div className="text-center">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-500 mx-auto"></div>
                <p className="mt-4">Loading allocation data...</p>
            </div>
        </div>
    );

    return (
        <div className="text-white">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Allocation Analysis</h1>
                <button
                    onClick={handleExportCSV}
                    disabled={!analysis}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg"
                >
                    <Download className="w-5 h-5" /> Export CSV
                </button>
            </div>
            
            {/* Portfolio Value Summary */}
            {analysis && (
                <div className="bg-gray-800 p-6 rounded-lg mb-8 border border-gray-700">
                    <h2 className="text-xl font-semibold mb-4">Portfolio Summary</h2>
                    <div className="text-3xl font-bold text-green-400">
                        ₹{analysis.total_portfolio_value_inr.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </div>
                    <p className="text-gray-400 mt-2">Total Portfolio Value</p>
                </div>
            )}
            
            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                    <h2 className="text-xl font-semibold mb-4 text-center">Current Allocation</h2>
                    {currentChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie 
                                    data={currentChartData} 
                                    dataKey="value" 
                                    nameKey="name" 
                                    cx="50%" 
                                    cy="50%" 
                                    outerRadius={100} 
                                    fill="#8884d8" 
                                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                                >
                                    {currentChartData.map((entry, index) => 
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    )}
                                </Pie>
                                <Tooltip formatter={(value) => `${value.toFixed(2)}%`} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-300 flex items-center justify-center text-gray-400">
                            <div className="text-center">
                                <PieChart className="w-16 h-16 mx-auto mb-4 opacity-50" />
                                <p>No allocation data available</p>
                                <p className="text-sm">Add investments with categories</p>
                            </div>
                        </div>
                    )}
                </div>
                
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                    <h2 className="text-xl font-semibold mb-4 text-center">Target Allocation</h2>
                    {idealChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie 
                                    data={idealChartData} 
                                    dataKey="value" 
                                    nameKey="name" 
                                    cx="50%" 
                                    cy="50%" 
                                    outerRadius={100} 
                                    fill="#82ca9d" 
                                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                                >
                                    {idealChartData.map((entry, index) => 
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    )}
                                </Pie>
                                <Tooltip formatter={(value) => `${value.toFixed(2)}%`} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-300 flex items-center justify-center text-gray-400">
                            <div className="text-center">
                                <PieChart className="w-16 h-16 mx-auto mb-4 opacity-50" />
                                <p>No target allocation set</p>
                                <p className="text-sm">Set your allocation goals below</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Current vs Target Comparison Table */}
            {analysis && Object.keys(analysis.current_allocation_by_percent).length > 0 && (
                <div className="bg-gray-800 p-6 rounded-lg mb-8 border border-gray-700">
                    <h2 className="text-xl font-semibold mb-4">Allocation Comparison</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-600">
                                    <th className="text-left p-3">Category</th>
                                    <th className="text-right p-3">Current Value</th>
                                    <th className="text-right p-3">Current %</th>
                                    <th className="text-right p-3">Target %</th>
                                    <th className="text-right p-3">Difference</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(analysis.current_allocation_by_percent).map(([category, currentPercent]) => {
                                    const targetPercent = analysis.ideal_allocation_by_percent[category] || 0;
                                    const difference = currentPercent - targetPercent;
                                    const currentValue = analysis.current_allocation_by_value[category] || 0;
                                    
                                    return (
                                        <tr key={category} className="border-b border-gray-700">
                                            <td className="p-3 font-medium">{category}</td>
                                            <td className="p-3 text-right">₹{currentValue.toLocaleString('en-IN')}</td>
                                            <td className="p-3 text-right">{currentPercent.toFixed(2)}%</td>
                                            <td className="p-3 text-right">{targetPercent.toFixed(2)}%</td>
                                            <td className={`p-3 text-right font-semibold ${
                                                difference > 0 ? 'text-orange-400' : 
                                                difference < 0 ? 'text-blue-400' : 'text-gray-400'
                                            }`}>
                                                {difference > 0 ? '+' : ''}{difference.toFixed(2)}%
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Set Goals */}
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                <h2 className="text-xl font-semibold mb-4">Set Your Target Allocation Goals</h2>
                {categories.length > 0 ? (
                    <>
                        <div className="space-y-4 mb-6">
                            {categories.map(cat => (
                                <div key={cat.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                                    <label className="text-lg font-medium">{cat.name}</label>
                                    <div className="flex items-center gap-3">
                                        <input 
                                            type="number" 
                                            value={goals[cat.id] || ''}
                                            onChange={(e) => handleGoalChange(cat.id, e.target.value)}
                                            className="w-24 p-2 bg-gray-600 border border-gray-500 rounded-md text-right focus:border-purple-500 focus:outline-none"
                                            placeholder="0"
                                            min="0"
                                            max="100"
                                            step="0.1"
                                        />
                                        <span className="text-gray-300">%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        <div className="flex justify-between items-center pt-4 border-t border-gray-600">
                            <div className="text-lg font-bold">
                                Total: <span className={Object.values(goals).reduce((sum, val) => sum + val, 0) > 100 ? 'text-red-400' : 'text-green-400'}>
                                    {Object.values(goals).reduce((sum, val) => sum + val, 0).toFixed(2)}%
                                </span>
                            </div>
                            <button 
                                onClick={handleSaveGoals} 
                                disabled={saving || Object.values(goals).reduce((sum, val) => sum + val, 0) > 100}
                                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg"
                            >
                                {saving ? 'Saving...' : 'Save Goals'}
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="text-center py-8 text-gray-400">
                        <Tag className="w-16 h-16 mx-auto mb-4 opacity-50" />
                        <p className="text-lg mb-2">No categories available</p>
                        <p>Create categories first to set allocation goals</p>
                        <button 
                            onClick={() => window.location.href = '/categories'}
                            className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white"
                        >
                            Go to Categories
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AllocationPage;

