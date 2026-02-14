import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface User {
  id: string;
  spend_wallet_address: string;
  smart_wallet_address: string;
  enabled_tools: string[];
  total_spend: number;
  agent_payment_history: PaymentRecord[];
  created_at: string;
  updated_at: string;
}

export interface PaymentRecord {
  id: string;
  tool_name: string;
  amount: number; // in USDC
  timestamp: string;
  transaction_hash?: string;
  description?: string;
}

export const recordPayment = async (
  walletAddress: string, 
  toolName: string, 
  amount: number, 
  description?: string,
  transactionHash?: string
): Promise<boolean> => {
  try {
    console.log('recordPayment called with:', { walletAddress, toolName, amount, description });
    
    const paymentRecord: PaymentRecord = {
      id: `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tool_name: toolName,
      amount: amount,
      timestamp: new Date().toISOString(),
      transaction_hash: transactionHash,
      description: description
    };

    console.log('Fetching user data for spend_wallet_address:', walletAddress);
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('total_spend, agent_payment_history, smart_wallet_address')
      .eq('spend_wallet_address', walletAddress)
      .single();

    console.log('User data fetch result:', { userData, fetchError });

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching user data:', fetchError);
      return false;
    }

    const currentTotalSpend = userData?.total_spend || 0;
    const newTotalSpend = currentTotalSpend + amount;

    const currentHistory = userData?.agent_payment_history || [];
    const newHistory = [paymentRecord, ...currentHistory].slice(0, 100); // Keep last 100 records

    const updateData = {
      spend_wallet_address: walletAddress,
      smart_wallet_address: userData?.smart_wallet_address || walletAddress, // Use existing or fallback to same address
      total_spend: newTotalSpend,
      agent_payment_history: newHistory,
      updated_at: new Date().toISOString()
    };
    
    console.log('Updating user record with:', updateData);
    const { error: updateError } = await supabase
      .from('users')
      .upsert(updateData, {
        onConflict: 'spend_wallet_address'
      });

    if (updateError) {
      console.error('Error updating payment data:', updateError);
      return false;
    }

    console.log('Payment recorded successfully:', {
      toolName,
      amount,
      newTotalSpend,
      walletAddress
    });

    return true;
  } catch (error) {
    console.error('Error recording payment:', error);
    return false;
  }
};

export const getUserPaymentData = async (walletAddress: string): Promise<{
  totalSpend: number;
  paymentHistory: PaymentRecord[];
} | null> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('total_spend, agent_payment_history')
      .eq('spend_wallet_address', walletAddress)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching payment data:', error);
      return null;
    }

    return {
      totalSpend: data?.total_spend || 0,
      paymentHistory: data?.agent_payment_history || []
    };
  } catch (error) {
    console.error('Error getting payment data:', error);
    return null;
  }
};

export const formatCurrency = (amount: number): string => {
  return `$${amount.toFixed(2)}`;
};