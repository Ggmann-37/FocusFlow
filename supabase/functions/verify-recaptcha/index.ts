import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

type VerifyBody = {
  token?: string;
  action?: string;
  expectedHostname?: string;
};

type GoogleVerifyResponse = {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ success: false, message: 'Method not allowed' }, 405);
  }

  try {
    const secret = Deno.env.get('reCAPTCHA_secret');
    if (!secret) {
      return jsonResponse(
        { success: false, message: 'No existe el secret reCAPTCHA_secret en Edge Functions.' },
        500,
      );
    }

    const { token, expectedHostname }: VerifyBody = await request.json();
    if (!token) {
      return jsonResponse({ success: false, message: 'Falta el token de reCAPTCHA.' }, 400);
    }

    const forwardedFor = request.headers.get('x-forwarded-for') || '';
    const remoteIp = forwardedFor.split(',')[0]?.trim();

    const body = new URLSearchParams();
    body.set('secret', secret);
    body.set('response', token);
    if (remoteIp) body.set('remoteip', remoteIp);

    const verifyResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const verifyData = (await verifyResponse.json()) as GoogleVerifyResponse;

    if (!verifyData.success) {
      return jsonResponse(
        {
          success: false,
          message: 'reCAPTCHA inválido o expirado. Vuelve a intentarlo.',
          errorCodes: verifyData['error-codes'] || [],
        },
        400,
      );
    }

    if (expectedHostname && verifyData.hostname && verifyData.hostname !== expectedHostname) {
      return jsonResponse(
        {
          success: false,
          message: 'Hostname de reCAPTCHA no coincide.',
          hostname: verifyData.hostname,
        },
        400,
      );
    }

    return jsonResponse({
      success: true,
      challengeTs: verifyData.challenge_ts || null,
      hostname: verifyData.hostname || null,
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Error inesperado validando reCAPTCHA.',
      },
      500,
    );
  }
});
