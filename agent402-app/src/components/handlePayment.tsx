
  const { user, signTypedData } = usePrivy();
  const [pendingPayment, setPendingPayment] = useState<any>(null);

// Handle x402 payment approval with EIP-712 signature
  const handlePaymentApproval = async (paymentData: any) => {
    if (!walletAddress || !user?.wallet) {
      alert('Please connect your wallet first');
      return;
    }

    try {
      setIsLoading(true);
      
      // Add signing progress message
      const signingMessage: Message = {
        id: Date.now().toString(),
        content: '🔐 **Requesting Signature...**\n\nPlease check your wallet to sign the payment authorization.',
        role: 'system',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, signingMessage]);
      
      // Extract payment info
      const { x402PaymentRequired, toolCall } = paymentData;
      const acceptsInfo = x402PaymentRequired.accepts[0];


      const domain = {
        name: 'USD Coin',
        version: '2',
        chainId: 8453, // Base chain ID
        verifyingContract: acceptsInfo.asset as `0x${string}` // USDC contract
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
      const nonce = `0x${Date.now().toString(16).padStart(64, '0')}`;
      
      const message = {
        from: user.wallet.address,
        to: acceptsInfo.payTo,
        value: acceptsInfo.maxAmountRequired, // Use the exact amount from the API
        validAfter: currentTime.toString(),
        validBefore: (currentTime + 300).toString(), // Valid for 5 minutes
        nonce // 32-byte nonce
      };

      console.log('Message for signing:', JSON.stringify(message, null, 2));

      // Sign using Privy embedded wallet
      const signature = await signTypedData({
        domain,
        types,
        message,
        primaryType: 'TransferWithAuthorization',
      });

      // Build X-PAYMENT
      const xPaymentPayload = {
        x402Version: 1,
        scheme: 'exact',
        network: 'base',
        payload: {
          signature: signature.signature,
          authorization: message,
        },
      };

      console.log('Ready X-PAYMENT Payload:', JSON.stringify(xPaymentPayload));

      console.log('X-PAYMENT payload:', xPaymentPayload);

      // Retry the tool call with payment
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
      const response = await fetch(`${apiUrl}/confirm-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toolCall,
          userAddress: user.wallet.address,
          xPayment: JSON.stringify(xPaymentPayload)
        }),
      });

      if (!response.ok) {
        throw new Error(`Payment confirmation failed: ${response.status}`);
      }

      const result = await response.json();
      
      // Record the payment in the database
      const paymentAmount = parseInt(acceptsInfo.maxAmountRequired) / 1000000; // Convert from wei to USDC
      const toolName = toolCall.name || 'Unknown Tool';
      const paymentDescription = `${toolName} - Payment authorized for agent tool execution`;
      
      try {
        console.log('🔍 PAYMENT DEBUG - Wallet address:', walletAddress);
        console.log('🔍 PAYMENT DEBUG - Tool:', toolName, 'Amount:', paymentAmount);
        
        const recordResult = await recordPayment(
          walletAddress,
          toolName,
          paymentAmount,
          paymentDescription
        );
        
        console.log('🔍 PAYMENT DEBUG - Record result:', recordResult);
        if (!recordResult) {
          console.error('❌ Payment recording failed!');
        }
        
        // Notify parent component to refresh payment data
        if (onPaymentComplete) {
          onPaymentComplete();
        }
      } catch (recordError) {
        console.error('Failed to record payment in database:', recordError);
        // Continue execution even if database recording fails
      }
      
      // Add the result as a new message
      const resultMessage: Message = {
        id: Date.now().toString(),
        content: `✅ **Payment Authorized & Tool Executed**\n\nSigned authorization from ${user.wallet.address} for ${paymentAmount} USDC to ${acceptsInfo.payTo}\n\n${result.result}`,
        role: 'assistant',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, resultMessage]);
      
    } catch (error) {
      console.error('Payment approval failed:', error);
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: `❌ **Payment Authorization Failed**: ${error instanceof Error ? error.message : 'Unknown error'}`,
        role: 'assistant',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
