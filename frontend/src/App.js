import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Layout from './components/Layout';
import PortfolioPage from './pages/PortfolioPage';
import AllocationPage from './pages/AllocationPage';
import CategoriesPage from './pages/CategoriesPage';
import NewsPage from './pages/NewsPage';
import AuthPage from './pages/AuthPage';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check for an active session when the app loads
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setLoading(false);
    };
    getSession();

    // Listen for changes in authentication state (e.g., login, logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        // If user logs out, redirect to the login page
        navigate('/login');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        Loading...
      </div>
    );
  }

  // If there is no active session, show the login/signup page.
  // Otherwise, show the main application dashboard with all its pages.
  return (
    <Routes>
      {!session ? (
        <Route path="*" element={<AuthPage />} />
      ) : (
        <Route element={<Layout />}>
          <Route path="/" element={<PortfolioPage />} />
          <Route path="/allocation" element={<AllocationPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/news" element={<NewsPage />} />
        </Route>
      )}
    </Routes>
  );
}

export default App;
