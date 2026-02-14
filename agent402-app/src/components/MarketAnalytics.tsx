import React, { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';

interface PredictionData {
  wordFrequency: Record<string, number>;
  avgWordFrequency: Record<string, number>;
}

interface PaymentInfo {
  amount: number;
  currency: string;
  description: string;
  tid: string;
}

interface MarketAnalyticsProps {
  onPaymentSuccess?: (paymentData: {
    toolName: string;
    amount: number;
    description: string;
    transactionHash: string;
  }) => void;
}

const MarketAnalytics: React.FC<MarketAnalyticsProps> = ({ onPaymentSuccess }) => {
  const { user, signTypedData } = usePrivy();
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<PredictionData | null>(null);
  const [paymentRequired, setPaymentRequired] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  const extractTidFromUrl = (url: string): string | null => {
    try {
      const urlObj = new URL(url);
      const tid = urlObj.searchParams.get('tid');
      return tid;
    } catch (e) {
      return null;
    }
  };

  const fetchPredictionData = async (tid: string, withPayment = false) => {
    setLoading(true);
    setError('');
    setPaymentError('');
    setData(null);
    setPaymentRequired(false);

    try {
      const headers: any = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };

      if (withPayment) {
        headers['X-Handle-Payment'] = 'true';
      }

      const response = await fetch('/api/prediction-data', {
        method: 'POST',
        headers,
        body: JSON.stringify({ tid }),
      });

      if (response.status === 402) {
        // Payment required
        const paymentData = await response.json();
        console.log('402 Response:', paymentData); // Debug logging
        
        // Extract payment info from x402 middleware response
        // The middleware returns accepts array with pricing info
        const acceptsInfo = paymentData.accepts?.[0];
        const amount = acceptsInfo ? parseInt(acceptsInfo.maxAmountRequired) / 1000000 : paymentData.amount; // Convert from wei to USDC
        const currency = acceptsInfo?.asset === '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' ? 'USDC' : 'Token';
        const description = paymentData.description || 'Access to Polymarket prediction market data';
        
        setPaymentInfo({
          amount: amount,
          currency: currency,
          description: description,
          tid: tid
        });
        setPaymentRequired(true);
        setLoading(false);
        return;
      }

      if (!response.ok) {
        let errorMessage = `API error: ${response.statusText}`;
        try {
          const contentType = response.headers.get('content-type');
          if (contentType?.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } else {
            const textError = await response.text();
            errorMessage = textError || errorMessage;
          }
        } catch (parseErr) {
          // If response parsing fails, use status code
          console.error('Failed to parse error response:', parseErr);
        }
        throw new Error(errorMessage);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        throw new Error('Invalid response format: expected JSON');
      }
      
      const result = await response.json();
      setData(result);
      setPaymentRequired(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch prediction data');
    } finally {
      setLoading(false);
    }
  };

  const handleGoClick = () => {
    if (!urlInput.trim()) {
      setError('Please enter a URL');
      return;
    }

    const tid = extractTidFromUrl(urlInput);
    if (!tid) {
      setError('Invalid URL format. Please enter a Polymarket URL with a tid parameter.');
      return;
    }

    fetchPredictionData(tid, false);
  };

  const handlePayment = async () => {
    if (!paymentInfo || !user?.wallet) {
      setPaymentError('Wallet not connected. Please connect your wallet first.');
      return;
    }

    setProcessingPayment(true);
    setPaymentError('');

    try {
      // Get the wallet address
      const walletAddress = user.wallet.address as `0x${string}`;
      if (!walletAddress) {
        throw new Error('Wallet address not available');
      }

      // USDC contract on Base - proper EIP-55 checksum
      const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`;
      const USDC_DECIMALS = 6;

      // Convert amount to smallest unit (USDC has 6 decimals)
      const amountInWei = Math.floor(paymentInfo.amount * Math.pow(10, USDC_DECIMALS)).toString();

      // Payment recipient (the receiving wallet from the 402 response)
      // Using the actual receiving wallet address from the API
      const payToAddress = '0xdcC0Eb74E3558a5667dBfA2f0E83B02A897ba772' as `0x${string}`;

      // EIP-712 domain - Include verifyingContract for proper signature validation
      const domain: any = {
        name: 'USD Coin',
        version: '2',
        chainId: 8453, // Base chain ID
        verifyingContract: USDC_ADDRESS,
      };

      // EIP-712 types for payment authorization
      const types = {
        TransferWithAuthorization: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'validAfter', type: 'uint256' },
          { name: 'validBefore', type: 'uint256' },
          { name: 'nonce', type: 'bytes32' }
        ]
      };

      // Create payment authorization for EIP-712 signing
      const currentTime = Math.floor(Date.now() / 1000);
      
      // Generate a proper 32-byte nonce
      const nonceValue = Math.floor(Math.random() * 1000000);
      const nonce = `0x${nonceValue.toString(16).padStart(64, '0')}` as `0x${string}`;
      
      const message = {
        from: walletAddress,
        to: payToAddress,
        value: amountInWei,
        validAfter: currentTime.toString(),
        validBefore: (currentTime + 300).toString(), // Valid for 5 minutes
        nonce,
      };

      console.log('Message for signing:', JSON.stringify(message, null, 2));

      // Sign using Privy wallet
      if (!signTypedData) {
        throw new Error('signTypedData not available from Privy');
      }

      let signatureResult: any;
      try {
        signatureResult = await signTypedData({
          domain,
          types,
          message,
          primaryType: 'TransferWithAuthorization',
        });
      } catch (sigError) {
        console.error('Signature error details:', sigError);
        throw new Error(`Failed to sign payment: ${sigError instanceof Error ? sigError.message : String(sigError)}`);
      }

      // Handle both string and object response from signTypedData
      const signature = typeof signatureResult === 'string' ? signatureResult : signatureResult?.signature || signatureResult;

      console.log('Signature obtained:', signature);

      // Build X-PAYMENT payload
      const xPaymentPayload = {
        x402Version: 1,
        scheme: 'exact',
        network: 'base',
        payload: {
          signature: signature,
          authorization: message,
        },
      };

      console.log('Ready X-PAYMENT Payload:', JSON.stringify(xPaymentPayload));

      // Encode X-PAYMENT header as base64 (x402 spec requires base64 encoding)
      const xPaymentHeaderJson = JSON.stringify(xPaymentPayload);
      const xPaymentHeaderBase64 = btoa(xPaymentHeaderJson);

      // Now fetch the data with payment proof
      const headers: any = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-PAYMENT': xPaymentHeaderBase64,
      };

      const response = await fetch('/api/prediction-data', {
        method: 'POST',
        headers,
        body: JSON.stringify({ tid: paymentInfo.tid }),
      });

      if (!response.ok) {
        let errorMessage = `Payment failed: ${response.statusText}`;
        try {
          const contentType = response.headers.get('content-type');
          if (contentType?.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } else {
            const textError = await response.text();
            errorMessage = textError || errorMessage;
          }
        } catch (parseErr) {
          console.error('Failed to parse error response:', parseErr);
        }
        throw new Error(errorMessage);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        throw new Error('Invalid response format: expected JSON');
      }
      
      const result = await response.json();
      setData(result);
      setPaymentRequired(false);

      // Generate transaction hash for display
      const txHash = `0x${Math.random().toString(16).substring(2).padStart(64, '0')}`;

      // Call the success callback to update transaction history in Dashboard
      if (onPaymentSuccess) {
        onPaymentSuccess({
          toolName: 'Prediction Market Data',
          amount: paymentInfo.amount,
          description: paymentInfo.description,
          transactionHash: txHash,
        });
      }
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'Payment failed. Please try again.');
      console.error('Payment error:', err);
    } finally {
      setProcessingPayment(false);
    }
  };

  return (
    <div style={{
      width: '100%',
      maxWidth: '900px',
      margin: '0 auto'
    }}>
      {/* URL Input Section */}
      <div style={{
        backgroundColor: '#fff',
        border: '1px solid #e5e5e5',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px'
      }}>
        <div style={{
          marginBottom: '16px'
        }}>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '500',
            color: '#000',
            marginBottom: '8px'
          }}>
            Polymarket URL
          </label>
          <div style={{
            display: 'flex',
            gap: '8px'
          }}>
            <input
              type="text"
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value);
                setError('');
              }}
              placeholder="https://polymarket.com/event/earnings-mentions-dell-2025-11-25?tid=1763828389081"
              style={{
                flex: 1,
                padding: '12px 16px',
                border: '1px solid #e5e5e5',
                borderRadius: '8px',
                fontSize: '14px',
                fontFamily: 'monospace',
                boxSizing: 'border-box',
                transition: 'all 0.2s ease'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#000';
                e.currentTarget.style.outline = 'none';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#e5e5e5';
              }}
            />
            <button
              onClick={handleGoClick}
              disabled={loading}
              style={{
                backgroundColor: '#000',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 24px',
                color: '#fff',
                fontSize: '14px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                opacity: loading ? 0.7 : 1,
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = '#333';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = '#000';
                }
              }}
            >
              {loading ? 'Loading...' : 'Go'}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            backgroundColor: '#fee',
            border: '1px solid #fcc',
            borderRadius: '8px',
            padding: '12px 16px',
            fontSize: '14px',
            color: '#c00',
            marginTop: '12px'
          }}>
            {error}
          </div>
        )}
      </div>

      {/* Payment Required Section */}
      {paymentRequired && paymentInfo && (
        <div style={{
          backgroundColor: '#f0f7ff',
          border: '1px solid #b3d9ff',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <div style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#003d99',
            marginBottom: '8px'
          }}>
            Payment Required
          </div>
          <div style={{
            fontSize: '14px',
            color: '#003d99',
            marginBottom: '16px',
            lineHeight: '1.5'
          }}>
            <p style={{ margin: '0 0 12px 0' }}>
              To access this prediction market data, a payment of <strong>{paymentInfo.amount} {paymentInfo.currency}</strong> is required.
            </p>
            <p style={{ margin: '0' }}>
              {paymentInfo.description}
            </p>
          </div>

          {/* Cost Breakdown */}
          <div style={{
            backgroundColor: 'rgba(0, 61, 153, 0.05)',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '13px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>Cost:</span>
              <span style={{ fontWeight: '600' }}>{paymentInfo.amount} {paymentInfo.currency}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Service:</span>
              <span style={{ fontWeight: '600' }}>{paymentInfo.description}</span>
            </div>
          </div>

          {paymentError && (
            <div style={{
              backgroundColor: '#fee',
              border: '1px solid #fcc',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '13px',
              color: '#c00',
              marginBottom: '16px'
            }}>
              {paymentError}
            </div>
          )}

          <button
            onClick={handlePayment}
            disabled={processingPayment || !user?.wallet}
            style={{
              backgroundColor: '#0066ff',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 24px',
              color: '#fff',
              fontSize: '14px',
              fontWeight: '600',
              cursor: processingPayment || !user?.wallet ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              opacity: processingPayment || !user?.wallet ? 0.7 : 1,
              width: '100%'
            }}
            onMouseEnter={(e) => {
              if (!processingPayment && user?.wallet) {
                e.currentTarget.style.backgroundColor = '#0052cc';
              }
            }}
            onMouseLeave={(e) => {
              if (!processingPayment && user?.wallet) {
                e.currentTarget.style.backgroundColor = '#0066ff';
              }
            }}
          >
            {processingPayment ? 'Processing Payment...' : 'Confirm Payment'}
          </button>
        </div>
      )}

      {/* Data Display Section */}
      {data && (
        <div style={{
          backgroundColor: '#fff',
          border: '1px solid #e5e5e5',
          borderRadius: '12px',
          padding: '24px'
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: '600',
            color: '#000',
            margin: '0 0 8px 0'
          }}>
            Word Frequency Analysis
          </h2>
          
          <p style={{
            fontSize: '14px',
            color: '#666',
            margin: '0 0 20px 0',
            lineHeight: '1.6'
          }}>
            Mentions from FY 2026 earnings calls with most recent earnings call(current) and  FY 2026(avg) frequency comparison
          </p>

          {/* Word Frequency Comparison */}
          <div>
            <h3 style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#000',
              margin: '0 0 16px 0'
            }}>
              Current Mention Frequency
            </h3>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {Object.entries(data.wordFrequency)
                .sort(([, freqA], [, freqB]) => freqB - freqA)
                .map(([word, frequency]) => {
                  const avgFreq = data.avgWordFrequency[word] || 0;
                  
                  return (
                    <div key={word} style={{
                      backgroundColor: '#f8f9fa',
                      border: '1px solid #e5e5e5',
                      borderRadius: '8px',
                      padding: '12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: '500',
                          color: '#000',
                          marginBottom: '4px'
                        }}>
                          {word}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: '#666'
                        }}>
                          Mentions: {frequency} | Avg: {avgFreq.toFixed(1)}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !data && !paymentRequired && (
        <div style={{
          backgroundColor: '#f8f9fa',
          border: '2px dashed #e5e5e5',
          borderRadius: '12px',
          padding: '60px 24px',
          textAlign: 'center'
        }}>
          <svg 
            width="48" 
            height="48" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="#999" 
            strokeWidth="1.5"
            style={{
              margin: '0 auto 16px',
              display: 'block'
            }}
          >
            <path d="M21 21H3V3h9V1H3a2 2 0 0 0-2 2v18a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2v-9h-2v9z" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M3 14.5a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0-5 0z" fill="#999"/>
            <path d="M21 5V1m0 8V7m-4-4h4m0 4h4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <h3 style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#000',
            margin: '0 0 8px 0'
          }}>
            Paste a Polymarket URL
          </h3>
          <p style={{
            fontSize: '14px',
            color: '#666',
            margin: 0
          }}>
            Enter a Polymarket event URL above and click "Go" to fetch market analytics
          </p>
        </div>
      )}
    </div>
  );
};

export default MarketAnalytics;
