type VerifyBody = {
  token?: string;
  action?: string;
  expectedHostname?: string;
};

type GoogleVerifyResponse = {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  "error-codes"?: string[];
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ success: false, message: "Method not allowed" }, 405);
  }

  try {
    const secret =
      Deno.env.get("reCAPTCHA_secret") ??
      Deno.env.get("RECAPTCHA_SECRET");

    if (!secret) {
      return jsonResponse(
        {
          success: false,
          message:
            "No existe el secret reCAPTCHA_secret/RECAPTCHA_SECRET en Edge Functions.",
        },
        500
      );
    }

    // Parseo robusto del body: evita fallos de request.json()
    const raw = await request.text();
    if (!raw) {
      return jsonResponse({ success: false, message: "Body vacío en la request." }, 400);
    }

    let parsed: VerifyBody;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return jsonResponse(
        {
          success: false,
          message: "Body no es JSON válido.",
          raw: raw.slice(0, 500),
        },
        400
      );
    }

    const { token, expectedHostname, action } = parsed;

    if (!token) {
      return jsonResponse({ success: false, message: "Falta el token de reCAPTCHA." }, 400);
    }

    // IP (opcional)
    const forwardedFor = request.headers.get("x-forwarded-for") || "";
    const remoteIp = forwardedFor.split(",")[0]?.trim();

    // Llamada a Google
    const body = new URLSearchParams();
    body.set("secret", secret);
    body.set("response", token);
    if (remoteIp) body.set("remoteip", remoteIp);

    const verifyResponse = await fetch(
      "https://www.google.com/recaptcha/api/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      }
    );

    // Leer como texto y luego parsear JSON (por si Google responde algo raro)
    const verifyText = await verifyResponse.text();
    let verifyData: GoogleVerifyResponse | null = null;

    try {
      verifyData = JSON.parse(verifyText) as GoogleVerifyResponse;
    } catch {
      return jsonResponse(
        {
          success: false,
          message: "Respuesta no-JSON de Google reCAPTCHA.",
          googleStatus: verifyResponse.status,
          googleBody: verifyText.slice(0, 300),
        },
        502
      );
    }

    // Si Google responde non-2xx, devolvemos 502 (pero siempre JSON)
    if (verifyResponse.status < 200 || verifyResponse.status >= 300) {
      return jsonResponse(
        {
          success: false,
          message: "Google reCAPTCHA respondió con status no-2xx.",
          googleStatus: verifyResponse.status,
          errorCodes: verifyData?.["error-codes"] || [],
          hostname: verifyData?.hostname || null,
        },
        502
      );
    }

    // Validación reCAPTCHA
    if (!verifyData?.success) {
      return jsonResponse(
        {
          success: false,
          message: "reCAPTCHA inválido o expirado. Vuelve a intentarlo.",
          errorCodes: verifyData?.["error-codes"] || [],
          hostname: verifyData?.hostname || null,
          action: action || null,
        },
        400
      );
    }

    // Hostname check (opcional)
    if (
      expectedHostname &&
      verifyData.hostname &&
      verifyData.hostname !== expectedHostname
    ) {
      return jsonResponse(
        {
          success: false,
          message: "Hostname de reCAPTCHA no coincide.",
          hostname: verifyData.hostname,
          expectedHostname,
        },
        400
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
        message:
          error instanceof Error
            ? error.message
            : "Error inesperado validando reCAPTCHA.",
      },
      500
    );
  }
});
