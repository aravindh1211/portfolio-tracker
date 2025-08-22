import React, { useState, useEffect, useCallback } from 'react';
import { get, post } from '../api';
import { Plus } from 'lucide-react';

// ❗ ACTION REQUIRED: Replace this URL with your actual backend URL from Render.
const API_BASE = process.env.NODE_ENV === 'production' 
  ? 'https://portfolio-tracker-backend-st89.onrender.com' // <-- EDIT THIS LINE
  : 'http://localhost:8000';

const CategoriesPage = () => {
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState('');
  const [newSubCategory, setNewSubCategory] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await get(`${API_BASE}/api/categories`);
      setCategories(data);
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategory.trim()) return;
    try {
        await post(`${API_BASE}/api/categories`, { name: newCategory });
        setNewCategory('');
        fetchData();
    } catch (error) {
        console.error("Failed to add category:", error);
    }
  };

  const handleAddSubCategory = async (e) => {
    e.preventDefault();
    if (!newSubCategory.trim() || !selectedCategoryId) return;
    try {
        await post(`${API_BASE}/api/subcategories`, { name: newSubCategory, category_id: selectedCategoryId });
        setNewSubCategory('');
        fetchData();
    } catch (error) {
        console.error("Failed to add subcategory:", error);
    }
  };

  if (loading) return <div className="text-white">Loading categories...</div>;

  return (
    <div className="text-white">
      <h1 className="text-3xl font-bold mb-6">Manage Categories</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Add Category */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Add New Category</h2>
          <form onSubmit={handleAddCategory} className="flex gap-4">
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="e.g., US Equity"
              className="flex-grow p-2 bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button type="submit" className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg flex items-center gap-2">
                <Plus size={18} /> Add
            </button>
          </form>
        </div>
        
        {/* Add Subcategory */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Add New Subcategory</h2>
          <form onSubmit={handleAddSubCategory} className="flex flex-col gap-4">
            <select
                value={selectedCategoryId || ''}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="p-2 bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
            >
                <option value="" disabled>Select a Category</option>
                {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
            </select>
            <div className="flex gap-4">
                <input
                    type="text"
                    value={newSubCategory}
                    onChange={(e) => setNewSubCategory(e.target.value)}
                    placeholder="e.g., Technology"
                    className="flex-grow p-2 bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button type="submit" className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg flex items-center gap-2">
                    <Plus size={18} /> Add
                </button>
            </div>
          </form>
        </div>
      </div>

      {/* Display Categories and Subcategories */}
      <div className="mt-8 bg-gray-800 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Existing Categories</h2>
        <div className="space-y-4">
            {categories.length > 0 ? categories.map(cat => (
                <div key={cat.id} className="bg-gray-700 p-4 rounded-md">
                    <h3 className="text-lg font-bold">{cat.name}</h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                        {cat.subcategories.length > 0 ? cat.subcategories.map(sub => (
                            <span key={sub.id} className="px-3 py-1 bg-gray-600 text-sm rounded-full">
                                {sub.name}
                            </span>
                        )) : (
                            <p className="text-sm text-gray-400">No subcategories yet.</p>
                        )}
                    </div>
                </div>
            )) : <p>No categories created yet.</p>}
        </div>
      </div>
    </div>
  );
};

export default CategoriesPage;