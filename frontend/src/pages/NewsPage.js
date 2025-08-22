import React, { useState, useEffect, useCallback } from 'react';
import { get } from '../api';

// ❗ ACTION REQUIRED: Replace this URL with your actual backend URL from Render.
const API_BASE = process.env.NODE_ENV === 'production' 
  ? 'https://portfolio-tracker-backend-st89.onrender.com' // <-- EDIT THIS LINE
  : 'http://localhost:8000';

const NewsPage = () => {
    const [news, setNews] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchNews = useCallback(async () => {
        try {
            setLoading(true);
            const newsData = await get(`${API_BASE}/api/news`);
            setNews(newsData);
        } catch (error) {
            console.error("Failed to fetch news:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNews();
    }, [fetchNews]);

    if (loading) {
        return <div className="text-white text-center">Loading news...</div>;
    }

    return (
        <div className="text-white">
            <h1 className="text-3xl font-bold mb-6">News Feed</h1>
            <div className="space-y-6">
                {news.length > 0 ? (
                    news.map((item, index) => (
                        <a 
                            key={index} 
                            href={item.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="block bg-gray-800 p-6 rounded-lg hover:bg-gray-700 transition-colors"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-semibold bg-purple-600 px-3 py-1 rounded-full">{item.ticker}</span>
                                <span className="text-sm text-gray-400">{new Date(item.datetime * 1000).toLocaleDateString()}</span>
                            </div>
                            <h2 className="text-xl font-semibold mb-2">{item.headline}</h2>
                            <p className="text-gray-300">{item.summary}</p>
                        </a>
                    ))
                ) : (
                    <div className="text-center py-10 bg-gray-800 rounded-lg">
                        <p>No news available for your current holdings.</p>
                        <p className="text-sm text-gray-400">News is available for US and Indian stocks.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NewsPage;