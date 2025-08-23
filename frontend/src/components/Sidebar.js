// frontend/src/components/Sidebar.js
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useTheme } from '../contexts/ThemeContext';
import { Home, PieChart, Tag, Newspaper, LogOut, Sun, Moon } from 'lucide-react';

const Sidebar = () => {
  const navigate = useNavigate();
  const { isDarkMode, toggleTheme } = useTheme();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const navLinkClasses = ({ isActive }) =>
    `flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors duration-200 ${
      isActive
        ? 'bg-purple-600 text-white'
        : isDarkMode 
          ? 'text-gray-300 hover:bg-gray-700 hover:text-white'
          : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
    }`;

  return (
    <div className={`flex flex-col w-64 ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800 border-r border-gray-200'}`}>
      <div className={`flex items-center justify-center h-20 ${isDarkMode ? 'border-b border-gray-700' : 'border-b border-gray-200'}`}>
        <h1 className="text-xl font-bold">Portfolio v2.0</h1>
      </div>
      
      <nav className="flex-1 px-4 py-6 space-y-2">
        <NavLink to="/" end className={navLinkClasses}>
          <Home className="w-5 h-5 mr-3" />
          Portfolio
        </NavLink>
        <NavLink to="/allocation" className={navLinkClasses}>
          <PieChart className="w-5 h-5 mr-3" />
          Allocation
        </NavLink>
        <NavLink to="/categories" className={navLinkClasses}>
          <Tag className="w-5 h-5 mr-3" />
          Categories
        </NavLink>
        <NavLink to="/news" className={navLinkClasses}>
          <Newspaper className="w-5 h-5 mr-3" />
          News
        </NavLink>
      </nav>
      
      <div className={`px-4 py-4 space-y-2 ${isDarkMode ? 'border-t border-gray-700' : 'border-t border-gray-200'}`}>
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className={`flex items-center w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-colors duration-200 ${
            isDarkMode 
              ? 'text-gray-300 hover:bg-gray-700 hover:text-white' 
              : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
          }`}
        >
          {isDarkMode ? <Sun className="w-5 h-5 mr-3" /> : <Moon className="w-5 h-5 mr-3" />}
          {isDarkMode ? 'Light Mode' : 'Dark Mode'}
        </button>
        
        {/* Logout */}
        <button
          onClick={handleLogout}
          className={`flex items-center w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-colors duration-200 ${
            isDarkMode 
              ? 'text-gray-300 hover:bg-red-600 hover:text-white' 
              : 'text-gray-600 hover:bg-red-500 hover:text-white'
          }`}
        >
          <LogOut className="w-5 h-5 mr-3" />
          Logout
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
