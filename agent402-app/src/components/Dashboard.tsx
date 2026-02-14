import React, { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import './Dashboard.css';
import { getUserPaymentData, formatCurrency, PaymentRecord } from '../lib/supabase';
import { logout as clearAuth } from './ProtectedRoute';

const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('Wallet address copied!');
  const [usdcBalance, setUsdcBalance] = useState<string>('--');
  const [walletBalance, setWalletBalance] = useState<string>('--');
  const [isBalanceLoading, setIsBalanceLoading] = useState<boolean>(false);
  const [totalSpend, setTotalSpend] = useState<string>('$0.00');
  const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([]);
  const [isLoadingPaymentData, setIsLoadingPaymentData] = useState<boolean>(false);
  const [showWalletDropdown, setShowWalletDropdown] = useState(false);
  const [showBalanceDropdown, setShowBalanceDropdown] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showTransferCryptoModal, setShowTransferCryptoModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [isTopUpLoading, setIsTopUpLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const { ready, authenticated, user, login, logout } = usePrivy();

  const getWalletAddress = () => {
    return user?.wallet?.address;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    });
  };

  const publicClient = createPublicClient({
    chain: base,
    transport: http()
  });

  // ERC20 ABI for balanceOf and transfer functions
  const erc20ABI = [
    {
      constant: true,
      inputs: [{ name: '_owner', type: 'address' }],
      name: 'balanceOf',
      outputs: [{ name: 'balance', type: 'uint256' }],
      type: 'function',
    },
    {
      constant: false,
      inputs: [
        { name: '_to', type: 'address' },
        { name: '_value', type: 'uint256' }
      ],
      name: 'transfer',
      outputs: [{ name: '', type: 'bool' }],
      type: 'function',
    },
  ] as const;

  // Fetch balance for a specific wallet without setting loading state
  const fetchSpecificWalletBalance = async (walletAddress: string): Promise<string> => {
    try {
      console.log('Fetching specific USDC balance for:', walletAddress);
      
      // USDC contract address on Base
      const usdcContractAddress = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
      
      // Read the balance from the USDC contract
      const balance = await publicClient.readContract({
        address: usdcContractAddress as `0x${string}`,
        abi: erc20ABI,
        functionName: 'balanceOf',
        args: [walletAddress as `0x${string}`],
      });

      // Convert from wei (6 decimals for USDC) to readable format
      const balanceInUsdc = Number(balance) / 1000000;
      return balanceInUsdc.toFixed(2);
      
    } catch (error) {
      console.error('Error fetching specific USDC balance:', error);
      return '--';
    }
  };

  // Fetch balances for both wallets
  const fetchAllWalletBalances = async () => {
    setIsBalanceLoading(true);

    try {
      const walletAddr = getWalletAddress();

      if (walletAddr) {
        const balance = await fetchSpecificWalletBalance(walletAddr);
        setWalletBalance(balance);
        setUsdcBalance(balance);
      } else {
        setWalletBalance('--');
        setUsdcBalance('--');
      }

    } catch (error) {
      console.error('Error fetching wallet balance:', error);
      setUsdcBalance('--');
      setWalletBalance('--');
    } finally {
      setIsBalanceLoading(false);
    }
  };

  // Fetch payment data from database
  const fetchPaymentData = async () => {
    const walletAddr = getWalletAddress(); // Use connected external wallet
    console.log('fetchPaymentData using wallet address:', walletAddr);
    if (!walletAddr) return;
    
    setIsLoadingPaymentData(true);
    try {
      const paymentData = await getUserPaymentData(walletAddr);
      if (paymentData) {
        setTotalSpend(formatCurrency(paymentData.totalSpend));
        setPaymentHistory(paymentData.paymentHistory);
      }
    } catch (error) {
      console.error('Error fetching payment data:', error);
    } finally {
      setIsLoadingPaymentData(false);
    }
  };

  // Manual refresh function
  const refreshBalance = () => {
    const walletAddress = getWalletAddress();
    if (walletAddress) {
      fetchAllWalletBalances();
    }
  };



  // Withdrawal function (connected wallet functionality removed)
  const executeGaslessWithdrawal = async (
    amount: number,
    destinationAddress: string
  ): Promise<string> => {
    throw new Error('Gasless withdrawals require connected wallet functionality. Please use your connected wallet to transfer funds directly.');
  };

  // Fetch balance and payment data when wallet addresses change
  React.useEffect(() => {
    const walletAddress = getWalletAddress();
    if (walletAddress) {
      fetchAllWalletBalances();
      fetchPaymentData();
    }
  }, [user?.wallet?.address]);

  // Close dropdown on escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowWalletDropdown(false);
        setShowBalanceDropdown(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Handle window resize for mobile detection
  React.useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) {
        setShowMobileSidebar(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close balance dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showBalanceDropdown) {
        const target = event.target as Element;
        if (!target.closest('[data-balance-dropdown]')) {
          setShowBalanceDropdown(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showBalanceDropdown]);

  const sidebarStyle: React.CSSProperties = {
    position: 'fixed',
    left: isMobile ? (showMobileSidebar ? '0' : '-100%') : '0',
    top: 0,
    width: isMobile ? '280px' : '200px',
    height: '100vh',
    backgroundColor: '#ffffff',
    borderRight: '1px solid #e5e5e5',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    paddingTop: '20px',
    zIndex: 1001,
    transition: 'left 0.3s ease',
    ...(isMobile && {
      boxShadow: showMobileSidebar ? '2px 0 10px rgba(0, 0, 0, 0.1)' : 'none',
    }),
  };

  const logoStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '40px',
    padding: '0 12px',
    gap: '8px',
  };

  const logoDotStyle: React.CSSProperties = {
    width: '8px',
    height: '8px',
    backgroundColor: '#00ff00',
    borderRadius: '50%',
    flexShrink: 0,
  };

  const logoTextStyle: React.CSSProperties = {
    color: '#000',
    fontWeight: '600',
    fontSize: '14px',
    whiteSpace: 'nowrap',
  };

  const navButtonStyle = (isActive: boolean): React.CSSProperties => ({
    width: '170px',
    height: '44px',
    backgroundColor: isActive ? '#000000' : 'transparent',
    border: 'none',
    borderRadius: '8px',
    margin: '4px 15px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    cursor: 'pointer',
    color: isActive ? '#fff' : '#666',
    fontSize: '14px',
    fontWeight: '500',
    padding: '0 12px',
    gap: '8px',
    transition: 'all 0.2s ease',
  });

  const mainContentStyle: React.CSSProperties = {
    marginLeft: isMobile ? '0' : '200px',
    backgroundColor: '#ffffff',
    minHeight: '100vh',
    color: '#000',
    fontFamily: 'inherit',
    padding: isMobile ? '20px 16px' : '40px',
    paddingTop: isMobile ? '80px' : '40px', // Account for mobile header
  };

  const headerStyle: React.CSSProperties = {
    fontSize: '32px',
    fontWeight: '600',
    marginBottom: '40px',
    color: '#000',
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '24px',
    border: '1px solid #e5e5e5',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  };

  const cardTitleStyle: React.CSSProperties = {
    fontSize: '16px',
    color: '#666',
    marginBottom: '8px',
    fontWeight: '500',
  };

  const cardValueStyle: React.CSSProperties = {
    fontSize: '28px',
    fontWeight: '600',
    color: '#000',
  };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: isMobile ? '16px' : '24px',
  };

  // Show loading state while Privy is initializing
  if (!ready) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        backgroundColor: '#ffffff'
      }}>
        <div>Loading...</div>
      </div>
    );
  }

  // Show non-authenticated state
  if (!authenticated) {
    return (
      <div className="dashboard-container" style={{ cursor: 'auto' }}>
        {/* Sidebar */}
        <div style={sidebarStyle}>
          <div style={logoStyle}>
            <div style={logoDotStyle}></div>
            <span style={logoTextStyle}>Agent 402</span>
          </div>
        </div>

        {/* Main Content - Non-authenticated */}
        <div style={mainContentStyle}>
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '60vh',
            textAlign: 'center'
          }}>
            <h1 style={{ 
              fontSize: '48px', 
              fontWeight: '600', 
              marginBottom: '16px',
              color: '#000'
            }}>
              Welcome to Agent 402
            </h1>
            <p style={{ 
              fontSize: '18px', 
              color: '#666', 
              marginBottom: '32px',
              maxWidth: '500px'
            }}>
              First time? No worries, an account will be created for you on sign in
            </p>
            <button
              onClick={login}
              style={{
                backgroundColor: '#000',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '16px 32px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#333';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#000';
              }}
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container" style={{ cursor: 'auto' }}>
      {/* Mobile Header */}
      {isMobile && (
        <>
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: '60px',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #e5e5e5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            zIndex: 1000
          }}>
            {/* Hamburger Menu */}
            <button
              onClick={() => setShowMobileSidebar(!showMobileSidebar)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '4px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <div style={{
                width: '20px',
                height: '2px',
                backgroundColor: '#000',
                borderRadius: '1px',
                transition: 'all 0.3s ease',
                transform: showMobileSidebar ? 'rotate(45deg) translateY(6px)' : 'none'
              }} />
              <div style={{
                width: '20px',
                height: '2px',
                backgroundColor: '#000',
                borderRadius: '1px',
                opacity: showMobileSidebar ? '0' : '1',
                transition: 'all 0.3s ease'
              }} />
              <div style={{
                width: '20px',
                height: '2px',
                backgroundColor: '#000',
                borderRadius: '1px',
                transition: 'all 0.3s ease',
                transform: showMobileSidebar ? 'rotate(-45deg) translateY(-6px)' : 'none'
              }} />
            </button>

            {/* Logo */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <div style={logoDotStyle}></div>
              <span style={{
                ...logoTextStyle,
                fontSize: '16px'
              }}>Agent 402</span>
            </div>

            {/* Wallet Info */}
            {getWalletAddress() && (
              <div style={{
                position: 'relative'
              }}>
                <div 
                  onClick={() => setShowWalletDropdown(!showWalletDropdown)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#f5f5f5',
                    border: '1px solid #e5e5e5',
                    borderRadius: '20px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    color: '#000'
                  }}
                >
                  <div style={{
                    width: '6px',
                    height: '6px',
                    backgroundColor: '#00ff00',
                    borderRadius: '50%',
                    flexShrink: 0
                  }}></div>
                  <span>
                    {`${getWalletAddress()!.slice(0, 4)}...${getWalletAddress()!.slice(-3)}`}
                  </span>
                </div>
                {/* Mobile wallet dropdown would go here if needed */}
              </div>
            )}
          </div>

          {/* Mobile Sidebar Backdrop */}
          {showMobileSidebar && (
            <div 
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                zIndex: 1000
              }}
              onClick={() => setShowMobileSidebar(false)}
            />
          )}
        </>
      )}
      {/* Sidebar */}
      <div style={sidebarStyle}>
        <div style={logoStyle}>
          <div style={logoDotStyle}></div>
          <span style={logoTextStyle}>Agent 402</span>
        </div>

        <button
          style={navButtonStyle(activeTab === 'dashboard')}
          onClick={() => setActiveTab('dashboard')}
          onMouseEnter={(e) => {
            if (activeTab !== 'dashboard') {
              e.currentTarget.style.backgroundColor = '#f5f5f5';
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'dashboard') {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ marginRight: '2px' }}>
            <rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke={activeTab === 'dashboard' ? '#ffffff' : '#666666'} strokeWidth="1.5"/>
            <path d="M7 14L10.5 10.5L13.5 13.5L17 10" fill="none" stroke={activeTab === 'dashboard' ? '#ffffff' : '#666666'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="7" cy="14" r="1" fill={activeTab === 'dashboard' ? '#ffffff' : '#666666'}/>
            <circle cx="10.5" cy="10.5" r="1" fill={activeTab === 'dashboard' ? '#ffffff' : '#666666'}/>
            <circle cx="13.5" cy="13.5" r="1" fill={activeTab === 'dashboard' ? '#ffffff' : '#666666'}/>
            <circle cx="17" cy="10" r="1" fill={activeTab === 'dashboard' ? '#ffffff' : '#666666'}/>
          </svg>
          <span>Dashboard</span>
        </button>

        <button
          style={navButtonStyle(activeTab === 'api')}
          onClick={() => setActiveTab('api')}
          onMouseEnter={(e) => {
            if (activeTab !== 'api') {
              e.currentTarget.style.backgroundColor = '#f5f5f5';
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'api') {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ marginRight: '2px' }}>
            <path d="M12 2L15.09 8.26L22 9L16.5 14.15L17.82 21L12 17.77L6.18 21L7.5 14.15L2 9L8.91 8.26L12 2Z" fill="none" stroke={activeTab === 'api' ? '#ffffff' : '#666666'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>API</span>
        </button>

        {/* User Info & Logout */}
        <div style={{ 
          marginTop: 'auto', 
          marginBottom: '20px',
          padding: '0 15px',
          width: '170px'
        }}>
          {user && (
            <div style={{ 
              marginBottom: '12px',
              fontSize: '12px',
              color: '#666',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>
                {getWalletAddress() ? 
                  `${getWalletAddress()!.slice(0, 6)}...${getWalletAddress()!.slice(-4)}` :
                  user.email?.address || 'Connected'
                }
              </span>
              {getWalletAddress() && (
                <button
                  onClick={() => copyToClipboard(getWalletAddress()!)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    color: '#666',
                    fontSize: '10px'
                  }}
                  title="Copy wallet address"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                </button>
              )}
            </div>
          )}
          <button
            onClick={() => {
              logout();
              clearAuth();
            }}
            style={{
              width: '100%',
              backgroundColor: 'transparent',
              border: '1px solid #e5e5e5',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '12px',
              color: '#666',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f5f5f5';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Disconnect
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={mainContentStyle}>
        {activeTab === 'dashboard' && (
          <>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: isMobile ? 'flex-start' : 'center', 
              marginBottom: isMobile ? '24px' : '40px',
              flexDirection: isMobile ? 'column' : 'row',
              gap: isMobile ? '16px' : '0'
            }}>
              <h1 style={{
                ...headerStyle,
                fontSize: isMobile ? '24px' : '32px',
                marginBottom: '0'
              }}>Dashboard</h1>
              {getWalletAddress() && (
                <div style={{ position: 'relative' }}>
                  <div 
                    onClick={() => setShowWalletDropdown(!showWalletDropdown)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      backgroundColor: '#f5f5f5',
                      border: '1px solid #e5e5e5',
                      borderRadius: '20px',
                      padding: '8px 16px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      color: '#000'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#e5e5e5';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }}
                  >
                    <div style={{
                      width: '8px',
                      height: '8px',
                      backgroundColor: '#00ff00',
                      borderRadius: '50%',
                      flexShrink: 0
                    }}></div>
                    <span>
                      {`${getWalletAddress()!.slice(0, 6)}...${getWalletAddress()!.slice(-4)}`}
                    </span>
                    <span style={{
                      fontSize: '12px',
                      color: '#666',
                      fontWeight: '400'
                    }}>
                      Beta
                    </span>
                    <svg 
                      width="12" 
                      height="12" 
                      viewBox="0 0 12 12" 
                      fill="none"
                      style={{
                        transform: showWalletDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease'
                      }}
                    >
                      <path d="M3 4.5L6 7.5L9 4.5" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>

                  {/* Dropdown Menu */}
                  {showWalletDropdown && (
                    <>
                      {/* Backdrop */}
                      <div 
                        style={{
                          position: 'fixed',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          zIndex: 998
                        }}
                        onClick={() => setShowWalletDropdown(false)}
                      />
                      
                      {/* Dropdown */}
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        right: isMobile ? '16px' : 0,
                        left: isMobile ? '16px' : 'auto',
                        marginTop: '8px',
                        width: isMobile ? 'auto' : '280px',
                        maxWidth: isMobile ? 'calc(100vw - 32px)' : '280px',
                        backgroundColor: '#fff',
                        border: '1px solid #e5e5e5',
                        borderRadius: '12px',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                        zIndex: 999,
                        overflow: 'hidden'
                      }}>
                        {/* Header with address */}
                        <div style={{
                          padding: '16px',
                          borderBottom: '1px solid #f0f0f0'
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            marginBottom: '8px'
                          }}>
                            <div style={{
                              width: '8px',
                              height: '8px',
                              backgroundColor: '#00ff00',
                              borderRadius: '50%',
                              flexShrink: 0
                            }}></div>
                            <div>
                              <div style={{
                                fontSize: '16px',
                                fontWeight: '600',
                                color: '#000'
                              }}>
                                {`${getWalletAddress()!.slice(0, 6)}...${getWalletAddress()!.slice(-4)}`}
                              </div>
                              <div style={{
                                fontSize: '12px',
                                color: '#666',
                                marginTop: '2px'
                              }}>
                                {usdcBalance} USDC
                              </div>
                            </div>
                          </div>
                          
                          {/* Copy Address Button */}
                          <button
                            onClick={() => {
                              copyToClipboard(getWalletAddress()!);
                              setShowWalletDropdown(false);
                            }}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              backgroundColor: '#f8f9fa',
                              border: '1px solid #e9ecef',
                              borderRadius: '8px',
                              fontSize: '12px',
                              color: '#495057',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#e9ecef';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#f8f9fa';
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                            Copy Address
                          </button>
                        </div>

                        {/* Menu Items */}
                        <div style={{ padding: '8px 0' }}>
                          <button
                            onClick={() => {
                              setShowWalletDropdown(false);
                              setShowDepositModal(true);
                            }}
                            style={{
                              width: '100%',
                              padding: '12px 16px',
                              backgroundColor: 'transparent',
                              border: 'none',
                              fontSize: '14px',
                              color: '#000',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              transition: 'background-color 0.2s ease',
                              textAlign: 'left'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#f8f9fa';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M12 5V19M5 12L19 12" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            Deposit
                          </button>
                          
                          <button
                            onClick={() => {
                              setShowWalletDropdown(false);
                              setShowWithdrawModal(true);
                            }}
                            style={{
                              width: '100%',
                              padding: '12px 16px',
                              backgroundColor: 'transparent',
                              border: 'none',
                              fontSize: '14px',
                              color: '#000',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              transition: 'background-color 0.2s ease',
                              textAlign: 'left'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#f8f9fa';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M5 12H19M12 5L19 12L12 19" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            Withdraw
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            
            {/* Top Row - 2 Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
              gap: isMobile ? '16px' : '24px',
              marginBottom: isMobile ? '16px' : '24px'
            }}>
              <div 
                data-balance-dropdown
                style={{
                  ...cardStyle,
                  position: 'relative'
                }}>
                <div style={{
                  ...cardTitleStyle,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  Agent Wallet Balance
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={() => setShowBalanceDropdown(!showBalanceDropdown)}
                      style={{
                        background: 'none',
                        border: '1px solid #e5e5e5',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        fontSize: '11px',
                        color: '#666',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f8f9fa';
                        e.currentTarget.style.borderColor = '#000';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.borderColor = '#e5e5e5';
                      }}
                    >
                      Details
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="6,9 12,15 18,9"></polyline>
                      </svg>
                    </button>
                    <button
                      onClick={refreshBalance}
                      disabled={isBalanceLoading}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: isBalanceLoading ? '#ccc' : '#666',
                        cursor: isBalanceLoading ? 'not-allowed' : 'pointer',
                        padding: '4px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        transition: 'color 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (!isBalanceLoading) {
                          e.currentTarget.style.color = '#000';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isBalanceLoading) {
                          e.currentTarget.style.color = '#666';
                        }
                      }}
                    >
                      <svg 
                        width="16" 
                        height="16" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2"
                        style={{
                          animation: isBalanceLoading ? 'spin 1s linear infinite' : 'none'
                        }}
                      >
                        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                </div>
                <div style={cardValueStyle}>
                  {isBalanceLoading ? (
                    <span style={{ color: '#999' }}>Loading...</span>
                  ) : (
                    `${usdcBalance} USDC`
                  )}
                </div>
                <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                  Base network
                </div>
                
                {/* Balance Breakdown Dropdown */}
                {showBalanceDropdown && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: '0',
                    right: '0',
                    marginTop: '8px',
                    backgroundColor: '#fff',
                    border: '1px solid #e5e5e5',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                    zIndex: 1000,
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid #f0f0f0',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#666'
                    }}>
                      Wallet Breakdown
                    </div>
                    
                    {/* Connected Wallet Balance */}
                    {getWalletAddress() && (
                      <div style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #f8f9fa',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontSize: '13px',
                            fontWeight: '500',
                            color: '#000',
                            marginBottom: '2px'
                          }}>
                            Connected Wallet
                          </div>
                          <div style={{
                            fontSize: '11px',
                            color: '#666',
                            fontFamily: 'monospace',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}>
                            {`${getWalletAddress()!.slice(0, 6)}...${getWalletAddress()!.slice(-4)}`}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(getWalletAddress()!);
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '2px',
                                display: 'flex',
                                alignItems: 'center',
                                color: '#666',
                                transition: 'color 0.2s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = '#000';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = '#666';
                              }}
                              title="Copy connected wallet address"
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                              </svg>
                            </button>
                          </div>
                        </div>
                        <div style={{
                          fontSize: '13px',
                          fontWeight: '600',
                          color: walletBalance === '--' ? '#999' : '#000'
                        }}>
                          {walletBalance} USDC
                        </div>
                      </div>
                    )}
                    
                    {/* Embedded Wallet Balance */}
                    {getWalletAddress() && getWalletAddress() !== getWalletAddress() && (
                      <div style={{
                        padding: '12px 16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontSize: '13px',
                            fontWeight: '500',
                            color: '#000',
                            marginBottom: '2px'
                          }}>
                            Wallet
                          </div>
                          <div style={{
                            fontSize: '11px',
                            color: '#666',
                            fontFamily: 'monospace',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}>
                            {`${getWalletAddress()!.slice(0, 6)}...${getWalletAddress()!.slice(-4)}`}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(getWalletAddress()!);
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '2px',
                                display: 'flex',
                                alignItems: 'center',
                                color: '#666',
                                transition: 'color 0.2s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = '#000';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = '#666';
                              }}
                              title="Copy embedded wallet address"
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                              </svg>
                            </button>
                          </div>
                        </div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowBalanceDropdown(false);
                              setShowTopUpModal(true);
                            }}
                            style={{
                              backgroundColor: '#000',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '4px 8px',
                              fontSize: '10px',
                              color: '#fff',
                              cursor: 'pointer',
                              fontWeight: '500',
                              transition: 'all 0.2s ease',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#333';
                              e.currentTarget.style.transform = 'translateY(-1px)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#000';
                              e.currentTarget.style.transform = 'translateY(0)';
                            }}
                            title="Top up spend wallet"
                          >
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <line x1="12" y1="5" x2="12" y2="19"></line>
                              <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                            Top-up
                          </button>
                          <div style={{
                            fontSize: '13px',
                            fontWeight: '600',
                            color: walletBalance === '--' ? '#999' : '#000'
                          }}>
                            {walletBalance} USDC
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div style={cardStyle}>
                <div style={cardTitleStyle}>Total Volume</div>
                <div style={cardValueStyle}>{totalSpend}</div>
                <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                  Lifetime payments
                </div>
              </div>
            </div>

            {/* Bottom Section - Transaction History */}
            <div style={cardStyle}>
              <div style={{
                ...cardTitleStyle,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                Transaction History
                <button
                  onClick={fetchPaymentData}
                  disabled={isLoadingPaymentData}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: isLoadingPaymentData ? '#ccc' : '#666',
                    cursor: isLoadingPaymentData ? 'not-allowed' : 'pointer',
                    padding: '4px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'color 0.2s ease',
                    fontSize: '12px'
                  }}
                  onMouseEnter={(e) => {
                    if (!isLoadingPaymentData) {
                      e.currentTarget.style.color = '#000';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isLoadingPaymentData) {
                      e.currentTarget.style.color = '#666';
                    }
                  }}
                  title="Refresh transaction history"
                >
                  <svg 
                    width="14" 
                    height="14" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2"
                    style={{
                      animation: isLoadingPaymentData ? 'spin 1s linear infinite' : 'none'
                    }}
                  >
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
              <div style={{
                marginTop: '16px',
                border: '1px solid #e5e5e5',
                borderRadius: '8px',
                padding: '16px',
                backgroundColor: '#fafafa',
                maxHeight: '300px',
                overflowY: 'auto'
              }}>
                {isLoadingPaymentData ? (
                  <div style={{ 
                    textAlign: 'center', 
                    color: '#999', 
                    fontSize: '14px',
                    padding: '40px 0'
                  }}>
                    Loading transaction history...
                  </div>
                ) : paymentHistory.length === 0 ? (
                  <div style={{ 
                    textAlign: 'center', 
                    color: '#999', 
                    fontSize: '14px',
                    padding: '40px 0'
                  }}>
                    No transactions yet
                    <div style={{ fontSize: '12px', marginTop: '8px' }}>
                      Agent payments will appear here once you start using the service
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {paymentHistory.map((payment) => (
                      <div key={payment.id} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px',
                        backgroundColor: '#fff',
                        borderRadius: '8px',
                        border: '1px solid #f0f0f0'
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#000',
                            marginBottom: '4px'
                          }}>
                            {payment.tool_name}
                          </div>
                          {payment.description && (
                            <div style={{
                              fontSize: '12px',
                              color: '#666',
                              marginBottom: '4px'
                            }}>
                              {payment.description}
                            </div>
                          )}
                          <div style={{
                            fontSize: '11px',
                            color: '#999'
                          }}>
                            {new Date(payment.timestamp).toLocaleString()}
                          </div>
                        </div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <div style={{
                            fontSize: '14px',
                            fontWeight: '600',
                            color: '#000'
                          }}>
                            {formatCurrency(payment.amount)}
                          </div>
                          {payment.transaction_hash && (
                            <a
                              href={`https://basescan.org/tx/${payment.transaction_hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                fontSize: '11px',
                                color: '#666',
                                textDecoration: 'none',
                                padding: '2px 6px',
                                backgroundColor: '#f8f9fa',
                                borderRadius: '4px',
                                border: '1px solid #e9ecef'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#e9ecef';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#f8f9fa';
                              }}
                            >
                              View Tx
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'api' && (
          <div style={{ 
            padding: isMobile ? '16px' : '20px 40px 20px 20px',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            <h1 style={{
              fontSize: isMobile ? '24px' : '32px',
              fontWeight: '600',
              color: '#000',
              margin: '0 0 32px 0'
            }}>
              API
            </h1>
            {/* API content will go here */}
          </div>
        )}
      </div>

      {/* Deposit Modal */}
      {showDepositModal && (
        <>
          {/* Modal Backdrop */}
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 1000,
              display: 'flex',
              alignItems: isMobile ? 'flex-end' : 'center',
              justifyContent: 'center'
            }}
            onClick={() => setShowDepositModal(false)}
          >
            {/* Modal Content */}
            <div 
              style={{
                backgroundColor: '#ffffff',
                borderRadius: isMobile ? '16px 16px 0 0' : '16px',
                width: isMobile ? '100vw' : '440px',
                maxWidth: isMobile ? '100vw' : '90vw',
                maxHeight: isMobile ? '80vh' : '90vh',
                overflow: 'hidden',
                position: 'relative',
                color: '#000'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{
                padding: isMobile ? '20px 16px 16px 16px' : '24px 24px 16px 24px',
                textAlign: 'center',
                position: 'relative',
                borderBottom: '1px solid #e5e5e5'
              }}>
                <h2 style={{
                  fontSize: '24px',
                  fontWeight: '600',
                  margin: 0,
                  marginBottom: '8px'
                }}>
                  Deposit
                </h2>
                <p style={{
                  fontSize: '14px',
                  color: '#666',
                  margin: 0
                }}>
                  Balance: {usdcBalance} USDC
                </p>
                
                {/* Close Button */}
                <button
                  onClick={() => setShowDepositModal(false)}
                  style={{
                    position: 'absolute',
                    top: '20px',
                    right: '20px',
                    background: 'none',
                    border: 'none',
                    color: '#666',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '4px',
                    transition: 'color 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#000';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#666';
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <div style={{
                padding: '24px'
              }}>
                {/* Transfer Crypto Option */}
                <button
                  onClick={() => {
                    setShowDepositModal(false);
                    setShowTransferCryptoModal(true);
                  }}
                  style={{
                    width: '100%',
                    backgroundColor: '#f8f9fa',
                    border: '1px solid #e5e5e5',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '16px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    textAlign: 'left',
                    color: '#000'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#e9ecef';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#f8f9fa';
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px'
                  }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      backgroundColor: '#000',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                        <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        marginBottom: '4px'
                      }}>
                        Transfer Crypto
                      </div>
                      <div style={{
                        fontSize: '14px',
                        color: '#666',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        No limit • Instant
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          {/* USDC icon */}
                          <img 
                            src="/usdc-icon.png" 
                            alt="USDC" 
                            style={{
                              width: '20px',
                              height: '20px',
                              borderRadius: '50%'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </button>

                {/* Deposit with Card Option */}
                <button
                  disabled
                  style={{
                    width: '100%',
                    backgroundColor: '#f8f9fa',
                    border: '1px solid #e5e5e5',
                    borderRadius: '12px',
                    padding: '16px',
                    cursor: 'not-allowed',
                    textAlign: 'left',
                    color: '#999',
                    opacity: 0.6
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px'
                  }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      backgroundColor: '#ccc',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2">
                        <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                        <line x1="1" y1="10" x2="23" y2="10"></line>
                      </svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '4px'
                      }}>
                        <span style={{
                          fontSize: '16px',
                          fontWeight: '600',
                          color: '#999'
                        }}>
                          Deposit with Card
                        </span>
                        <span style={{
                          backgroundColor: '#999',
                          color: '#fff',
                          fontSize: '10px',
                          fontWeight: '600',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}>
                          SOON
                        </span>
                      </div>
                      <div style={{
                        fontSize: '14px',
                        color: '#999',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <span>$50,000 limit • 5 min</span>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <img 
                            src="/mastercard-icon.png" 
                            alt="Mastercard" 
                            style={{
                              width: '24px',
                              height: 'auto'
                            }}
                          />
                          <img 
                            src="/visa-icon.png" 
                            alt="Visa" 
                            style={{
                              width: '24px',
                              height: '24px'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Transfer Crypto Modal */}
      {showTransferCryptoModal && (
        <>
          {/* Modal Backdrop */}
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 1000,
              display: 'flex',
              alignItems: isMobile ? 'flex-end' : 'center',
              justifyContent: 'center'
            }}
            onClick={() => setShowTransferCryptoModal(false)}
          >
            {/* Modal Content */}
            <div 
              style={{
                backgroundColor: '#ffffff',
                borderRadius: isMobile ? '16px 16px 0 0' : '16px',
                width: isMobile ? '100vw' : '440px',
                maxWidth: isMobile ? '100vw' : '90vw',
                maxHeight: isMobile ? '80vh' : '90vh',
                overflow: 'hidden',
                position: 'relative',
                color: '#000'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{
                padding: isMobile ? '16px 16px 12px 16px' : '20px 24px 16px 24px',
                textAlign: 'center',
                position: 'relative',
                borderBottom: '1px solid #e5e5e5'
              }}>
                {/* Back Button */}
                <button
                  onClick={() => {
                    setShowTransferCryptoModal(false);
                    setShowDepositModal(true);
                  }}
                  style={{
                    position: 'absolute',
                    top: '20px',
                    left: '20px',
                    background: 'none',
                    border: 'none',
                    color: '#666',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '4px',
                    transition: 'color 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#000';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#666';
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 12H5M12 19L5 12L12 5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                <h2 style={{
                  fontSize: '24px',
                  fontWeight: '600',
                  margin: 0,
                  marginBottom: '8px'
                }}>
                  Transfer Crypto
                </h2>
                <p style={{
                  fontSize: '14px',
                  color: '#666',
                  margin: 0
                }}>
                  Balance: {usdcBalance} USDC
                </p>
                
                {/* Close Button */}
                <button
                  onClick={() => setShowTransferCryptoModal(false)}
                  style={{
                    position: 'absolute',
                    top: '20px',
                    right: '20px',
                    background: 'none',
                    border: 'none',
                    color: '#666',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '4px',
                    transition: 'color 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#000';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#666';
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <div style={{
                padding: '24px'
              }}>
                {/* Token and Chain Selection */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  marginBottom: '32px'
                }}>
                  <div>
                    <div style={{
                      fontSize: '14px',
                      color: '#666',
                      marginBottom: '8px'
                    }}>Supported token</div>
                    <div style={{
                      backgroundColor: '#f8f9fa',
                      border: '1px solid #e5e5e5',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <img 
                        src="/usdc-icon.png" 
                        alt="USDC" 
                        style={{
                          width: '16px',
                          height: '16px'
                        }}
                      />
                      <span style={{ fontSize: '14px', fontWeight: '500' }}>USDC</span>
                    </div>
                  </div>

                  <div>
                    <div style={{
                      fontSize: '14px',
                      color: '#666',
                      marginBottom: '8px'
                    }}>Supported chain</div>
                    <div style={{
                      backgroundColor: '#f8f9fa',
                      border: '1px solid #e5e5e5',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <img 
                        src="/base-icon.png" 
                        alt="Base" 
                        style={{
                          width: '16px',
                          height: '16px'
                        }}
                      />
                      <span style={{ fontSize: '14px', fontWeight: '500' }}>Base</span>
                    </div>
                  </div>
                </div>



                {/* Deposit Address */}
                <div>
                  <div style={{
                    fontSize: '14px',
                    color: '#666',
                    marginBottom: '12px'
                  }}>Your deposit address</div>
                  
                  <div style={{
                    backgroundColor: '#f8f9fa',
                    border: '1px solid #e5e5e5',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '12px',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    wordBreak: 'break-all',
                    color: '#000'
                  }}>
                    {getWalletAddress() || '0x416793Fa4d3Dcc072Cf927B381FC06F9f68b6Cf2'}
                  </div>

                  <button
                    onClick={() => {
                      const address = getWalletAddress() || '0x416793Fa4d3Dcc072Cf927B381FC06F9f68b6Cf2';
                      copyToClipboard(address);
                    }}
                    style={{
                      width: '100%',
                      backgroundColor: '#000',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '12px',
                      color: '#fff',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#333';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#000';
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    Copy address
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <>
          {/* Modal Backdrop */}
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 1000,
              display: 'flex',
              alignItems: isMobile ? 'flex-end' : 'center',
              justifyContent: 'center'
            }}
            onClick={() => setShowWithdrawModal(false)}
          >
            {/* Modal Content */}
            <div 
              style={{
                backgroundColor: '#ffffff',
                borderRadius: isMobile ? '16px 16px 0 0' : '16px',
                width: isMobile ? '100vw' : '440px',
                maxWidth: isMobile ? '100vw' : '90vw',
                maxHeight: isMobile ? '80vh' : '90vh',
                overflow: 'hidden',
                position: 'relative',
                color: '#000'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{
                padding: isMobile ? '16px 16px 12px 16px' : '20px 24px 16px 24px',
                textAlign: 'center',
                position: 'relative',
                borderBottom: '1px solid #e5e5e5'
              }}>
                <h2 style={{
                  fontSize: '24px',
                  fontWeight: '600',
                  margin: 0,
                  marginBottom: '8px'
                }}>
                  Withdraw
                </h2>
                <p style={{
                  fontSize: '14px',
                  color: '#666',
                  margin: 0,
                  marginBottom: '4px'
                }}>
                  Balance: {usdcBalance} USDC
                </p>
                
                {/* Close Button */}
                <button
                  onClick={() => {
                    setShowWithdrawModal(false);
                    setWithdrawAmount('');
                    setWithdrawAddress('');
                  }}
                  style={{
                    position: 'absolute',
                    top: '20px',
                    right: '20px',
                    background: 'none',
                    border: 'none',
                    color: '#666',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '4px',
                    transition: 'color 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#000';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#666';
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <div style={{
                padding: '24px'
              }}>
                {/* Token and Chain Info */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  marginBottom: '24px'
                }}>
                  <div>
                    <div style={{
                      fontSize: '14px',
                      color: '#666',
                      marginBottom: '8px'
                    }}>Token</div>
                    <div style={{
                      backgroundColor: '#f8f9fa',
                      border: '1px solid #e5e5e5',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <img 
                        src="/usdc-icon.png" 
                        alt="USDC" 
                        style={{
                          width: '16px',
                          height: '16px'
                        }}
                      />
                      <span style={{ fontSize: '14px', fontWeight: '500' }}>USDC</span>
                    </div>
                  </div>

                  <div>
                    <div style={{
                      fontSize: '14px',
                      color: '#666',
                      marginBottom: '8px'
                    }}>Network</div>
                    <div style={{
                      backgroundColor: '#f8f9fa',
                      border: '1px solid #e5e5e5',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <img 
                        src="/base-icon.png" 
                        alt="Base" 
                        style={{
                          width: '16px',
                          height: '16px'
                        }}
                      />
                      <span style={{ fontSize: '14px', fontWeight: '500' }}>Base</span>
                    </div>
                  </div>
                </div>

                {/* Amount Input */}
                <div style={{ marginBottom: '24px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    color: '#666',
                    marginBottom: '8px'
                  }}>
                    Amount
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="0.00"
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        paddingRight: '60px',
                        border: '1px solid #e5e5e5',
                        borderRadius: '8px',
                        fontSize: '16px',
                        backgroundColor: '#ffffff',
                        color: '#000',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#000';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#e5e5e5';
                      }}
                    />
                    <div style={{
                      position: 'absolute',
                      right: '16px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: '14px',
                      color: '#666',
                      fontWeight: '500'
                    }}>
                      USDC
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const balance = parseFloat(usdcBalance);
                      if (!isNaN(balance)) {
                        setWithdrawAmount(balance.toString());
                      }
                    }}
                    style={{
                      marginTop: '8px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#0066cc',
                      fontSize: '12px',
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                  >
                    Use max balance
                  </button>
                </div>

                {/* Destination Address Input */}
                <div style={{ marginBottom: '32px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    color: '#666',
                    marginBottom: '8px'
                  }}>
                    Destination Address
                  </label>
                  <input
                    type="text"
                    value={withdrawAddress}
                    onChange={(e) => setWithdrawAddress(e.target.value)}
                    placeholder="0x..."
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '1px solid #e5e5e5',
                      borderRadius: '8px',
                      fontSize: '14px',
                      backgroundColor: '#ffffff',
                      color: '#000',
                      outline: 'none',
                      boxSizing: 'border-box',
                      fontFamily: 'monospace'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#000';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#e5e5e5';
                    }}
                  />
                  <div style={{
                    fontSize: '12px',
                    color: '#999',
                    marginTop: '4px'
                  }}>
                    Enter the wallet address where you want to receive USDC
                  </div>
                </div>

                {/* Withdraw Button */}
                <button
                  onClick={async () => {
                    if (!withdrawAmount || !withdrawAddress) {
                      alert('Please enter both amount and destination address');
                      return;
                    }

                    // Validate address format (basic validation)
                    if (!withdrawAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
                      alert('Please enter a valid Ethereum address');
                      return;
                    }

                    // Validate amount
                    const amount = parseFloat(withdrawAmount);
                    const balance = parseFloat(usdcBalance);
                    if (isNaN(amount) || amount <= 0) {
                      alert('Please enter a valid amount');
                      return;
                    }
                    if (!isNaN(balance) && amount > balance) {
                      alert('Insufficient balance');
                      return;
                    }

                    setIsWithdrawing(true);
                    
                    try {
                      console.log('🎯 Initiating withdrawal...');

                      // Execute withdrawal through connected wallet
                      const txHash = await executeGaslessWithdrawal(amount, withdrawAddress);
                      
                      console.log('✅ Smart wallet withdrawal successful:', txHash);
                      
                      // Show success message
                      alert(
                        `🎉 Withdrawal Successful!\\n\\n` +
                        `Amount: ${amount} USDC\\n` +
                        `To: ${withdrawAddress}\\n` +
                        `Transaction: ${txHash}\\n\\n` +
                        `View on BaseScan: https://basescan.org/tx/${txHash}`
                      );
                      
                      // Reset form and close modal
                      setWithdrawAmount('');
                      setWithdrawAddress('');
                      setShowWithdrawModal(false);
                      
                      // Refresh balance after a short delay to allow transaction to be processed
                      setTimeout(() => {
                        const smartWalletAddress = getWalletAddress();
                        if (smartWalletAddress) {
                          fetchAllWalletBalances();
                        }
                      }, 3000);
                      
                    } catch (error: any) {
                      console.error('❌ Smart wallet withdrawal failed:', error);
                      console.error('Full error object:', JSON.stringify(error, null, 2));
                      
                      let errorMessage = 'Unknown error occurred';
                      if (error.message) {
                        if (error.message.includes('insufficient funds') || 
                            error.message.includes('insufficient balance') ||
                            error.message.includes('Insufficient USDC balance')) {
                          errorMessage = error.message;
                        } else if (error.message.includes('user rejected') || error.message.includes('user denied')) {
                          errorMessage = 'Transaction was cancelled by user';
                        } else if (error.message.includes('network') || error.message.includes('paymaster')) {
                          errorMessage = 'Network or paymaster error. Please check your connection and try again';
                        } else if (error.message.includes('Pimlico API key')) {
                          errorMessage = 'Paymaster configuration error. Please contact support';
                        } else if (error.message.includes('UserOperation reverted')) {
                          errorMessage = 'Transaction simulation failed. This might be due to insufficient balance, invalid address, or contract restrictions. Please check the console for details.';
                        } else {
                          errorMessage = error.message;
                        }
                      }
                      
                      alert(`Withdrawal failed: ${errorMessage}`);
                    } finally {
                      setIsWithdrawing(false);
                    }
                  }}
                  disabled={isWithdrawing || !withdrawAmount || !withdrawAddress}
                  style={{
                    width: '100%',
                    backgroundColor: (isWithdrawing || !withdrawAmount || !withdrawAddress) ? '#ccc' : '#000',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '16px',
                    color: '#fff',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: (isWithdrawing || !withdrawAmount || !withdrawAddress) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'background-color 0.2s ease',
                    opacity: (isWithdrawing || !withdrawAmount || !withdrawAddress) ? 0.6 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!isWithdrawing && withdrawAmount && withdrawAddress) {
                      e.currentTarget.style.backgroundColor = '#333';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isWithdrawing && withdrawAmount && withdrawAddress) {
                      e.currentTarget.style.backgroundColor = '#000';
                    }
                  }}
                >
                  {isWithdrawing ? (
                    <>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid #fff',
                        borderTop: '2px solid transparent',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }}></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12H19M12 5L19 12L12 19" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Withdraw {withdrawAmount ? `${withdrawAmount} USDC` : ''}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Top-up Modal */}
      {showTopUpModal && (
        <>
          {/* Modal Backdrop */}
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 1000,
              display: 'flex',
              alignItems: isMobile ? 'flex-end' : 'center',
              justifyContent: 'center',
              padding: isMobile ? '0' : '20px'
            }}
            onClick={() => setShowTopUpModal(false)}
          >
            <div 
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: '#fff',
                borderRadius: isMobile ? '24px 24px 0 0' : '16px',
                width: isMobile ? '100%' : '400px',
                maxWidth: isMobile ? '100%' : '400px',
                maxHeight: isMobile ? '80vh' : 'auto',
                overflow: 'auto',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
                animation: isMobile ? 'slideUp 0.3s ease-out' : 'fadeIn 0.3s ease-out'
              }}
            >
              {/* Header */}
              <div style={{
                padding: '24px 24px 16px',
                borderBottom: '1px solid #f0f0f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <h3 style={{
                  margin: 0,
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#000'
                }}>
                  Top-up Wallet
                </h3>
                <button
                  onClick={() => setShowTopUpModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    color: '#666'
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div style={{ padding: '24px' }}>
                <div style={{
                  backgroundColor: '#f8f9fa',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '24px'
                }}>
                  <div style={{
                    fontSize: '14px',
                    color: '#666',
                    marginBottom: '8px'
                  }}>
                    Transfer from Connected Wallet to Wallet
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontSize: '12px', color: '#999' }}>Connected Wallet Balance</div>
                      <div style={{ fontSize: '16px', fontWeight: '600', color: '#000' }}>
                        {walletBalance} USDC
                      </div>
                    </div>
                    <div style={{ margin: '0 16px', color: '#666' }}>→</div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#999' }}>Wallet Balance</div>
                      <div style={{ fontSize: '16px', fontWeight: '600', color: '#000' }}>
                        {walletBalance} USDC
                      </div>
                    </div>
                  </div>
                </div>

                {/* Amount Input */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#000',
                    marginBottom: '8px'
                  }}>
                    Amount to Transfer
                  </label>
                  <input
                    type="number"
                    placeholder="Enter USDC amount"
                    value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #e5e5e5',
                      borderRadius: '8px',
                      fontSize: '16px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      fontFamily: 'monospace'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#000';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#e5e5e5';
                    }}
                  />
                  <div style={{
                    fontSize: '12px',
                    color: '#999',
                    marginTop: '4px'
                  }}>
                    Available: {walletBalance} USDC in Connected Wallet
                  </div>
                </div>

                {/* Transfer Button */}
                <button
                  onClick={async () => {
                    if (!topUpAmount) {
                      alert('Please enter an amount');
                      return;
                    }

                    const embeddedAddr = getWalletAddress();
                    if (!embeddedAddr) {
                      alert('Embedded wallet not found. Please try again.');
                      return;
                    }

                    // Validate amount
                    const amount = parseFloat(topUpAmount);
                    const balance = parseFloat(walletBalance);
                    if (isNaN(amount) || amount <= 0) {
                      alert('Please enter a valid amount');
                      return;
                    }
                    if (!isNaN(balance) && amount > balance) {
                      alert('Insufficient balance in Connected Wallet');
                      return;
                    }

                    setIsTopUpLoading(true);
                    
                    try {
                      console.log('🎯 Initiating top-up transfer...');
                      console.log('Transfer details:', {
                        to: embeddedAddr,
                        amount: amount
                      });

                      // Execute transfer through connected wallet
                      const txHash = await executeGaslessWithdrawal(amount, embeddedAddr);
                      
                      console.log('✅ Top-up transfer successful:', txHash);
                      
                      alert(
                        `🎉 Top-up Successful!\\n\\n` +
                        `Amount: ${amount} USDC\\n` +
                        `From: Connected Wallet\\n` +
                        `To: Wallet\\n` +
                        `Transaction: ${txHash}\\n\\n` +
                        `View on BaseScan: https://basescan.org/tx/${txHash}`
                      );
                      
                      // Reset form and close modal
                      setTopUpAmount('');
                      setShowTopUpModal(false);
                      
                      // Refresh balance after a short delay to allow transaction to be processed
                      setTimeout(() => {
                        const smartWalletAddress = getWalletAddress();
                        if (smartWalletAddress) {
                          fetchAllWalletBalances();
                        }
                      }, 3000);
                      
                    } catch (error: any) {
                      console.error('❌ Top-up transfer failed:', error);
                      
                      let errorMessage = 'Unknown error occurred';
                      if (error.message) {
                        if (error.message.includes('insufficient funds') || 
                            error.message.includes('insufficient balance') ||
                            error.message.includes('Insufficient USDC balance')) {
                          errorMessage = error.message;
                        } else if (error.message.includes('user rejected') || error.message.includes('user denied')) {
                          errorMessage = 'Transaction was cancelled by user';
                        } else if (error.message.includes('network') || error.message.includes('paymaster')) {
                          errorMessage = 'Network or paymaster error. Please check your connection and try again';
                        } else {
                          errorMessage = error.message;
                        }
                      }
                      
                      alert(`Top-up failed: ${errorMessage}`);
                    } finally {
                      setIsTopUpLoading(false);
                    }
                  }}
                  disabled={isTopUpLoading || !topUpAmount}
                  style={{
                    width: '100%',
                    backgroundColor: (isTopUpLoading || !topUpAmount) ? '#ccc' : '#000',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '16px',
                    color: '#fff',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: (isTopUpLoading || !topUpAmount) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'background-color 0.2s ease',
                    opacity: (isTopUpLoading || !topUpAmount) ? 0.6 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!isTopUpLoading && topUpAmount) {
                      e.currentTarget.style.backgroundColor = '#333';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isTopUpLoading && topUpAmount) {
                      e.currentTarget.style.backgroundColor = '#000';
                    }
                  }}
                >
                  {isTopUpLoading ? (
                    <>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid #fff',
                        borderTop: '2px solid transparent',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }}></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                      Transfer {topUpAmount ? `${topUpAmount} USDC` : ''}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {showToast && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          backgroundColor: '#000',
          color: '#fff',
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '14px',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          animation: 'slideIn 0.3s ease-out'
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20,6 9,17 4,12"></polyline>
          </svg>
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default Dashboard;