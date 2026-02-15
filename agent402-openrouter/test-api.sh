#!/bin/bash

# Test the /diagnose endpoint
# This endpoint requires x402 payment, so the first request will return 402 Payment Required

echo "Testing /diagnose endpoint..."
echo ""

# Basic request (will return 402 Payment Required with payment details)
curl -X POST http://localhost:3001/diagnose \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "symptoms": "Headache, fever, and fatigue for the past 3 days",
    "healthHistory": "No known allergies, generally healthy"
  }' \
  -v

echo ""
echo ""
echo "---"
echo "Note: This endpoint requires x402 payment."
echo "The response will include payment details in the 402 response."
echo "You'll need to include X-PAYMENT header with a valid payment signature for subsequent requests."
