/**
 * Square Payment API Endpoint
 * 
 * Processes Square payments and maps them to admissions in the backend.
 * This endpoint handles the server-side payment processing securely.
 */

import type { APIRoute } from 'astro';
import { getSquareEnv } from '../../../lib/square-env';

// Mark this endpoint as server-rendered (not static)
// export const prerender = false;

interface PaymentRequest {
  sourceId: string;
  idempotencyKey: string;
  amountMoney: {
    amount: string;
    currency: string;
  };
  lineItems?: Array<{
    itemId: string;
    itemVariationId: string;
    quantity: string;
  }>;
  verificationToken?: string;
  cardData?: any;
}

interface SquarePaymentResponse {
  success: boolean;
  paymentId?: string;
  admissionId?: string;
  error?: string;
}

export const POST: APIRoute = async (context) => {
  const { request } = context;
  try {
    // Handle empty or malformed request body
    let body: PaymentRequest;
    try {
      const bodyText = await request.text();
      if (!bodyText || bodyText.trim() === '') {
        return new Response(
          JSON.stringify({ success: false, error: 'Request body is empty' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      body = JSON.parse(bodyText);
    } catch (parseError) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON in request body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate request
    if (!body.sourceId || !body.idempotencyKey || !body.amountMoney) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required payment fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Get Square API credentials (from Cloudflare runtime.env or import.meta.env)
    const { squareAccessToken, squareLocationId, squareEnvironment } = getSquareEnv(context);
    
    if (!squareAccessToken || !squareLocationId) {
      console.error('Square API credentials not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Payment service not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Determine Square API base URL based on environment
    const squareApiBaseUrl = squareEnvironment === 'production'
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com';
    
    // Build payment request body
    const paymentBody: any = {
      source_id: body.sourceId,
      idempotency_key: body.idempotencyKey,
      amount_money: {
        amount: parseInt(body.amountMoney.amount),
        currency: body.amountMoney.currency,
      },
      note: 'Admission Purchase',
    };
    
    // Add line items if provided (for catalog item tracking)
    if (body.lineItems && body.lineItems.length > 0) {
      paymentBody.order = {
        location_id: squareLocationId,
        line_items: body.lineItems.map((item: any) => ({
          catalog_object_id: item.itemVariationId,
          catalog_version: null, // Use latest version
          quantity: item.quantity,
        })),
      };
    }
    
    if (body.verificationToken) {
      paymentBody.verification_token = body.verificationToken;
    }
    
    // Create payment using Square API
    const paymentResponse = await fetch(`${squareApiBaseUrl}/v2/payments`, {
      method: 'POST',
      headers: {
        'Square-Version': '2024-01-18',
        'Authorization': `Bearer ${squareAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paymentBody),
    });
    
    const paymentData = await paymentResponse.json();
    
    if (!paymentResponse.ok) {
      const errorMessage = paymentData.errors?.[0]?.detail || paymentData.errors?.[0]?.code || 'Payment processing failed';
      console.error('Square payment error:', paymentData);
      return new Response(
        JSON.stringify({ success: false, error: errorMessage }),
        { status: paymentResponse.status, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Payment successful - map to admissions in backend
    const paymentId = paymentData.payment?.id;
    const amount = paymentData.payment?.amount_money?.amount;
    
    // TODO: Create admission record in your backend
    // This is where you would call your backend API to create an admission record
    // Example:
    // const admissionResponse = await fetch('YOUR_BACKEND_API_URL/admissions', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     paymentId: paymentId,
    //     amount: amount,
    //     currency: body.amountMoney.currency,
    //     timestamp: new Date().toISOString(),
    //   }),
    // });
    
    // For now, we'll return success with the payment ID
    // You should replace this with actual backend integration
    const admissionId = `ADM-${Date.now()}`; // Placeholder - replace with actual admission ID from backend
    
    const response: SquarePaymentResponse = {
      success: true,
      paymentId: paymentId,
      admissionId: admissionId,
    };
    
    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Payment processing error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'An unexpected error occurred' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

