import dotenv from 'dotenv';
import { OfframpClient, Currency } from '@zkp2p/sdk';
import { createWalletClient, custom, http, keccak256, toBytes, encodePacked } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

dotenv.config();

async function main() {
    const walletClient = createWalletClient({
        account: privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`),
        chain: base,
        transport: http(),
    })

    const client = new OfframpClient({
        walletClient,
        chainId: base.id,
        apiKey: process.env.API_KEY!,
    });

    const allowanceResult = await client.ensureAllowance({
            token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            amount: 1000000n,
    });

    if (allowanceResult.hash) {
            console.log('Waiting for approval transaction to be mined...');
            await new Promise(resolve => setTimeout(resolve, 3000)); 
    }

    const result = await client.createDeposit({
        token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        amount: 1000000n, // 1 USDC (6 decimals)
        intentAmountRange: { min: 100000n, max: 1000000n },
        processorNames: ['venmo'],
        depositData: [
            { venmoUsername: 'akhilMah12' }, 
        ],
        conversionRates: [
            [{ currency: Currency.USD, conversionRate: '1020000000000000000' }], // 1.02 (18 decimals)
        ]
    });

    console.log('Deposit created:', result);
}
main()