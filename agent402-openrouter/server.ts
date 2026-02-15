import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { facilitator } from "@coinbase/x402";
import { OpenRouter } from '@openrouter/sdk';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Get configuration from environment variables

const evmAddress = process.env.EVM_ADDRESS as `0x${string}`;

if (!evmAddress) {
  console.error("EVM_ADDRESS environment variable is required");
  process.exit(1);
}

const facilitatorClient = new HTTPFacilitatorClient(facilitator);

// Create resource server and register EVM scheme
const server = new x402ResourceServer(facilitatorClient)
  .register("eip155:8453", new ExactEvmScheme()); // Base mainnet

// Initialize OpenRouter client
const openRouter = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

if (!process.env.OPENROUTER_API_KEY) {
  console.error("OPENROUTER_API_KEY environment variable is required");
  process.exit(1);
}

// Add logging middleware to see what's happening
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - Headers:`, JSON.stringify(req.headers, null, 2));
  next();
});

// Configure payment middleware for the LLM endpoint
const paymentConfig = {
  "POST /diagnose": {
    accepts: [
      { 
        scheme: "exact", 
        price: "$0.001", 
        network: "eip155:8453" as `${string}:${string}`, 
        payTo: evmAddress,
      }
    ],
    description: "Healthcare diagnosis and treatment recommendation",
    mimeType: "application/json",
  },
};

// Apply payment middleware
app.use(paymentMiddleware(paymentConfig, server));

// LLM diagnosis endpoint - this will only be reached if payment is valid
app.post("/diagnose", async (req, res) => {
  try {
    const { symptoms, healthHistory } = req.body;

    if (!symptoms) {
      return res.status(400).json({ 
        error: "Symptoms are required. Please provide a 'symptoms' field in the request body." 
      });
    }

    // Build messages array
    const messages = [
      {
        role: "system" as const,
        content: "You are a healthcare assistant. You are given a user's health history and a list of symptoms. You need to diagnose the user's condition and recommend a treatment plan."
      },
      {
        role: "user" as const,
        content: healthHistory 
          ? `Health History: ${healthHistory}\n\nSymptoms: ${symptoms}`
          : `Symptoms: ${symptoms}`
      }
    ];

    // Stream the response
    const stream = await openRouter.chat.send({
      chatGenerationParams: {
        model: "arcee-ai/trinity-large-preview:free",
        messages,
        stream: true
      }
    });

    // Set headers for streaming response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let response = "";
    let chunkCount = 0;
    let usageInfo: any = null;

    try {
      for await (const chunk of stream) {
        chunkCount++;
        const content = chunk.choices[0]?.delta?.content;
        
        if (content) {
          response += content;
          // Send chunk to client
          res.write(content);
        }
        
        // Usage information comes in the final chunk
        if (chunk.usage) {
          usageInfo = chunk.usage;
        }
        
      }
      
      res.end();
    } catch (streamError) {
      console.error("Error during streaming:", streamError);
      res.write(`\n\n[Error during streaming]: ${streamError}\n`);
      res.write(`[Chunks received before error: ${chunkCount}]\n`);
      res.write(`[Response length before error: ${response.length} characters]\n`);
      res.end();
    }
  } catch (error) {
    console.error("Error in /diagnose endpoint:", error);
    res.status(500).json({ 
      error: "Internal server error", 
      message: error instanceof Error ? error.message : String(error) 
    });
  }
});

app.post("/diagnose-test", async (req, res) => {
    try {
      const { symptoms, healthHistory } = req.body;
  
      if (!symptoms) {
        return res.status(400).json({ 
          error: "Symptoms are required. Please provide a 'symptoms' field in the request body." 
        });
      }
  
      // Build messages array
      const messages = [
        {
          role: "system" as const,
          content: "You are a healthcare assistant. You are given a user's health history and a list of symptoms. You need to diagnose the user's condition and recommend a treatment plan."
        },
        {
          role: "user" as const,
          content: healthHistory 
            ? `Health History: ${healthHistory}\n\nSymptoms: ${symptoms}`
            : `Symptoms: ${symptoms}`
        }
      ];
  
      // Stream the response
      const stream = await openRouter.chat.send({
        chatGenerationParams: {
          model: "arcee-ai/trinity-large-preview:free",
          messages,
          stream: true
        }
      });
  
      // Set headers for streaming response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
  
      let response = "";
      let chunkCount = 0;
      let usageInfo: any = null;
  
      try {
        for await (const chunk of stream) {
          chunkCount++;
          const content = chunk.choices[0]?.delta?.content;
          
          if (content) {
            response += content;
            // Send chunk to client
            res.write(content);
          }
          
          // Usage information comes in the final chunk
          if (chunk.usage) {
            usageInfo = chunk.usage;
          }
          
        }
        
        res.end();
      } catch (streamError) {
        console.error("Error during streaming:", streamError);
        res.write(`\n\n[Error during streaming]: ${streamError}\n`);
        res.write(`[Chunks received before error: ${chunkCount}]\n`);
        res.write(`[Response length before error: ${response.length} characters]\n`);
        res.end();
      }
    } catch (error) {
      console.error("Error in /diagnose endpoint:", error);
      res.status(500).json({ 
        error: "Internal server error", 
        message: error instanceof Error ? error.message : String(error) 
      });
    }
  });

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});


const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`LLM endpoint (with x402 payment): POST http://localhost:${PORT}/diagnose`);
});