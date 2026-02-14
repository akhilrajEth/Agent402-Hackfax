/**
 * Payment handling utility for 402 Payment Required responses
 * This module handles payment processing for API calls that require payment
 */

export interface PaymentRequest {
  amount: number; // Amount in USDC
  description: string;
  metadata?: Record<string, any>;
}

export interface PaymentResponse {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

/**
 * Handles 402 Payment Required scenarios
 * Initiates payment flow and retries the original request
 */
export const handlePayment = async (
  paymentRequest: PaymentRequest,
  retryRequest: () => Promise<Response>
): Promise<PaymentResponse> => {
  try {
    console.log('[Payment Handler] Processing payment request:', paymentRequest);

    // Step 1: Validate user has sufficient balance
    const balanceCheck = await checkUserBalance(paymentRequest.amount);
    if (!balanceCheck.hasSufficientBalance) {
      return {
        success: false,
        error: `Insufficient balance. Required: ${paymentRequest.amount} USDC, Available: ${balanceCheck.availableBalance} USDC`
      };
    }

    // Step 2: Process the payment
    const paymentResult = await processPayment(paymentRequest);
    if (!paymentResult.success) {
      return {
        success: false,
        error: paymentResult.error || 'Payment processing failed'
      };
    }

    console.log('[Payment Handler] Payment successful:', paymentResult.transactionHash);

    // Step 3: Retry the original request with payment proof
    const retryResponse = await retryRequest();
    
    if (!retryResponse.ok) {
      console.error('[Payment Handler] Retry request failed:', retryResponse.status);
      return {
        success: false,
        error: 'Request failed after payment'
      };
    }

    return {
      success: true,
      transactionHash: paymentResult.transactionHash
    };
  } catch (error) {
    console.error('[Payment Handler] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Payment handling failed'
    };
  }
};

/**
 * Check if user has sufficient balance for payment
 */
export const checkUserBalance = async (
  requiredAmount: number
): Promise<{
  hasSufficientBalance: boolean;
  availableBalance: number;
}> => {
  try {
    // This would call your backend to check the actual balance
    // For now, returning mock data
    const response = await fetch('/api/user/balance');
    
    if (!response.ok) {
      console.error('Failed to fetch balance');
      return {
        hasSufficientBalance: false,
        availableBalance: 0
      };
    }

    const data = await response.json();
    const availableBalance = parseFloat(data.balance || '0');

    return {
      hasSufficientBalance: availableBalance >= requiredAmount,
      availableBalance
    };
  } catch (error) {
    console.error('[Payment Handler] Balance check failed:', error);
    return {
      hasSufficientBalance: false,
      availableBalance: 0
    };
  }
};

/**
 * Process the actual payment
 * This would integrate with your blockchain/payment system
 */
export const processPayment = async (
  paymentRequest: PaymentRequest
): Promise<{
  success: boolean;
  transactionHash?: string;
  error?: string;
}> => {
  try {
    console.log('[Payment Handler] Initiating payment transaction...');

    // Example payment logic:
    // 1. Deduct from user's balance in database
    // 2. Send payment to smart contract or payment address
    // 3. Return transaction hash

    const paymentResponse = await fetch('/api/payment/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: paymentRequest.amount,
        description: paymentRequest.description,
        metadata: paymentRequest.metadata,
      }),
    });

    if (!paymentResponse.ok) {
      const error = await paymentResponse.text();
      throw new Error(`Payment API error: ${error}`);
    }

    const result = await paymentResponse.json();

    if (result.success) {
      console.log('[Payment Handler] Transaction successful:', result.transactionHash);
      return {
        success: true,
        transactionHash: result.transactionHash,
      };
    } else {
      throw new Error(result.error || 'Payment failed');
    }
  } catch (error) {
    console.error('[Payment Handler] Payment processing error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Payment failed',
    };
  }
};

/**
 * Utility to handle 402 responses from API calls
 * Can be used as a middleware in fetch requests
 */
export const handleApiResponse = async (
  response: Response,
  originalRequest: () => Promise<Response>
): Promise<Response> => {
  if (response.status === 402) {
    // Payment required - extract payment details from response
    const paymentData = await response.json();
    
    const paymentRequest: PaymentRequest = {
      amount: paymentData.amount || 0.01,
      description: paymentData.description || 'API access',
      metadata: {
        endpoint: paymentData.endpoint,
        timestamp: new Date().toISOString(),
      },
    };

    // Handle the payment
    const paymentResult = await handlePayment(
      paymentRequest,
      originalRequest
    );

    if (!paymentResult.success) {
      throw new Error(paymentResult.error || 'Payment handling failed');
    }

    // Retry the original request
    return originalRequest();
  }

  return response;
};

/**
 * Format payment amount for display
 */
export const formatPaymentAmount = (amount: number): string => {
  return `$${amount.toFixed(2)} USDC`;
};
