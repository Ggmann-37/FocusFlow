type VerifyBody = {
  token?: string;
  action?: string;
  expectedHostname?: string;
};

type GoogleVerifyResponse = {
  success: boolean;
  score?: number;
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  "error-codes"?: string[];
};

type VerifyAttemptResult = {
  response: Response;
  payloadText: string;
  endpoint: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const REQUIRE_AUTH = false;

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function errorResponse(message: string, status: number) {
  return jsonResponse({ error: { message, status } }, status);
}

async function verifyWithEndpoint(
  endpoint: string,
  body: URLSearchParams,
): Promise<VerifyAttemptResult> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const payloadText = await response.text();
  return { response, payloadText, endpoint };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  // Si en el futuro quieres exigir auth en esta function.
  if (REQUIRE_AUTH) {
    const authorization = request.headers.get("authorization");
    if (!authorization || !authorization.startsWith("Bearer ")) {
      console.info("[verify-recaptcha] auth faltante o inválida");
      return errorResponse("Missing or invalid Authorization header", 401);
    }
  }

  try {
    const secret = Deno.env.get("reCAPTCHA_secret") ?? Deno.env.get("RECAPTCHA_SECRET");
    if (!secret) {
      return errorResponse("No existe reCAPTCHA_secret/RECAPTCHA_SECRET en Edge Functions.", 500);
    }

    // 1) Parseo seguro del body (sin request.json() directo).
    const rawBody = await request.text();
    if (!rawBody) {
      console.info("[verify-recaptcha] body vacío");
      return errorResponse("Body vacío en la request.", 400);
    }

    let requestBody: VerifyBody;
    try {
      requestBody = JSON.parse(rawBody) as VerifyBody;
    } catch {
      return errorResponse("Body no es JSON válido.", 400);
    }

    const token = requestBody?.token;
    const expectedAction = requestBody?.action;
    const expectedHostname = requestBody?.expectedHostname;

    if (!token) {
      console.info("[verify-recaptcha] token faltante");
      return errorResponse("Falta el token de reCAPTCHA.", 400);
    }

    const forwardedFor = request.headers.get("x-forwarded-for") || "";
    const remoteIp = forwardedFor.split(",")[0]?.trim();

    const body = new URLSearchParams();
    body.set("secret", secret);
    body.set("response", token);
    if (remoteIp) body.set("remoteip", remoteIp);

    const primary = await verifyWithEndpoint("https://www.google.com/recaptcha/api/siteverify", body);
    let verifyAttempt = primary;

    if (!primary.response.ok) {
      console.info(
        `[verify-recaptcha] google non-2xx status=${primary.response.status}; intentando fallback recaptcha.net`,
      );
      const fallback = await verifyWithEndpoint("https://www.recaptcha.net/recaptcha/api/siteverify", body);
      verifyAttempt = fallback.response.ok ? fallback : primary;
    }

    console.info(`[verify-recaptcha] endpoint=${verifyAttempt.endpoint} status=${verifyAttempt.response.status}`);

    let verifyData: GoogleVerifyResponse | null = null;
    try {
      verifyData = JSON.parse(verifyAttempt.payloadText) as GoogleVerifyResponse;
    } catch {
      return errorResponse("Respuesta no-JSON de Google reCAPTCHA.", 502);
    }

    if (!verifyAttempt.response.ok) {
      return errorResponse(
        `Google reCAPTCHA respondió con status no-2xx (${verifyAttempt.response.status}).`,
        502,
      );
    }

    if (!verifyData?.success) {
      return jsonResponse(
        {
          success: false,
          message: "reCAPTCHA inválido o expirado. Vuelve a intentarlo.",
          errorCodes: verifyData?.["error-codes"] || [],
          hostname: verifyData?.hostname || null,
        },
        400,
      );
    }

    if (expectedHostname && verifyData.hostname && verifyData.hostname !== expectedHostname) {
      return errorResponse("Hostname de reCAPTCHA no coincide.", 400);
    }


    if (expectedAction && verifyData.action && verifyData.action !== expectedAction) {
      return errorResponse("Action de reCAPTCHA no coincide.", 400);
    }

    const minScoreRaw = Deno.env.get("RECAPTCHA_MIN_SCORE");
    const minScore = minScoreRaw ? Number(minScoreRaw) : null;
    const score = typeof verifyData.score === "number" ? verifyData.score : null;

    if (minScore !== null && !Number.isNaN(minScore) && score !== null && score < minScore) {
      return jsonResponse(
        {
          success: false,
          message: "Score de reCAPTCHA insuficiente.",
          score,
          minScore,
          hostname: verifyData.hostname || null,
        },
        400,
      );
    }
    return jsonResponse({
      success: true,
      challengeTs: verifyData.challenge_ts || null,
      action: verifyData.action || null,
      score: typeof verifyData.score === "number" ? verifyData.score : null,
      hostname: verifyData.hostname || null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error inesperado validando reCAPTCHA.";
    return errorResponse(message, 500);
  }
});
