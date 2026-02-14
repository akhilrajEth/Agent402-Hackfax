import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { PrivyProvider } from '@privy-io/react-auth';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import { base } from 'viem/chains'
import './App.css';

const App: React.FC = () => {
  const privyAppId = import.meta.env.VITE_PRIVY_APP_ID;

  if (!privyAppId) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-lg shadow-md max-w-md">
          <h2 className="text-xl font-bold text-red-600 mb-4">Configuration Required</h2>
          <div className="bg-gray-100 p-3 rounded text-xs">
            <strong>Missing:</strong> VITE_PRIVY_APP_ID
          </div>
        </div>
      </div>
    );
  }

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'all-users',
          },
        },
        loginMethods: ['email'],
        appearance: {
          theme: 'light',
          accentColor: '#000000'
        },
        supportedChains: [base],
        defaultChain: base,
      }}
      onSuccess={() => {
        // Suppress analytics events
        (window as any).__PRIVY_SUPPRESS_ANALYTICS__ = true;
      }}
    >
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </Router>
    </PrivyProvider>
  );
};

export default App;