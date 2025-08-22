import React, { useState, useEffect, useCallback } from 'react';
import { get, post } from '../api';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// ❗ ACTION REQUIRED: Replace this URL with your actual backend URL from Render.
const API_BASE = process.env.NODE_ENV === 'production' 
  ? 'https://portfolio-tracker-backend-st89.onrender.com' // <-- EDIT THIS LINE
  : 'http://localhost:8000';

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088fe', '#00c49f'];

const AllocationPage = () => {
    const [analysis, setAnalysis] = useState(null);
    const [categories, setCategories] = useState([]);
    const [goals, setGoals] = useState({});
    const [loading, setLoading] = useState(true);

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
            alert("Failed to save goals.");
        }
    };
    
    const currentChartData = analysis ? Object.entries(analysis.current_allocation_by_percent).map(([name, value]) => ({ name, value })) : [];
    const idealChartData = Object.entries(goals)
        .map(([categoryId, value]) => {
            const category = categories.find(c => c.id.toString() === categoryId);
            return { name: category?.name, value };
        })
        .filter(item => item.value > 0 && item.name);


    if (loading) return <div className="text-white">Loading allocation data...</div>;

    return (
        <div className="text-white">
            <h1 className="text-3xl font-bold mb-6">Allocation Analysis</h1>
            
            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <div className="bg-gray-800 p-6 rounded-lg">
                    <h2 className="text-xl font-semibold mb-4 text-center">Current Allocation</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie data={currentChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={120} fill="#8884d8" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                {currentChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                            </Pie>
                            <Tooltip formatter={(value) => `${value.toFixed(2)}%`} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="bg-gray-800 p-6 rounded-lg">
                    <h2 className="text-xl font-semibold mb-4 text-center">Ideal Allocation</h2>
                     <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie data={idealChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={120} fill="#82ca9d" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                {idealChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                            </Pie>
                             <Tooltip formatter={(value) => `${value.toFixed(2)}%`} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Set Goals */}
            <div className="bg-gray-800 p-6 rounded-lg">
                <h2 className="text-xl font-semibold mb-4">Set Your Ideal Allocation Goals</h2>
                <div className="space-y-4">
                    {categories.map(cat => (
                        <div key={cat.id} className="flex items-center justify-between">
                            <label className="text-lg">{cat.name}</label>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="number" 
                                    value={goals[cat.id] || ''}
                                    onChange={(e) => handleGoalChange(cat.id, e.target.value)}
                                    className="w-24 p-2 bg-gray-700 rounded-md text-right"
                                    placeholder="0"
                                />
                                <span>%</span>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-700">
                    <div className="text-lg font-bold">
                        Total: {Object.values(goals).reduce((sum, val) => sum + val, 0).toFixed(2)}%
                    </div>
                    <button onClick={handleSaveGoals} className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg">
                        Save Goals
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AllocationPage;