import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Home, PieChart, Tag, Newspaper, LogOut } from 'lucide-react';

const Sidebar = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const navLinkClasses = ({ isActive }) =>
    `flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors duration-200 ${
      isActive
        ? 'bg-purple-600 text-white'
        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
    }`;

  return (
    <div className="flex flex-col w-64 bg-gray-800 text-white">
      <div className="flex items-center justify-center h-20 border-b border-gray-700">
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
      <div className="px-4 py-4 border-t border-gray-700">
        <button
          onClick={handleLogout}
          className="flex items-center w-full px-4 py-2.5 text-sm font-medium rounded-lg text-gray-300 hover:bg-red-600 hover:text-white transition-colors duration-200"
        >
          <LogOut className="w-5 h-5 mr-3" />
          Logout
        </button>
      </div>
    </div>
  );
};

export default Sidebar;