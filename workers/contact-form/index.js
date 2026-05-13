// Cloudflare Worker: お問い合わせフォーム → メール転送
// デプロイ後、環境変数 MAILCHANNELS_TO にメールアドレスを設定する
// (Cloudflare MailChannels 無料統合を使用)

const ALLOWED_ORIGIN = 'https://pethoken-navi.com';

const TYPES = {
  article: '記事内容の誤り',
  ad: '広告・アフィリエイトに関して',
  other: 'その他',
};

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(request) });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response('Bad Request', { status: 400 });
    }

    const { name, email, type, message } = body;
    if (!name || !email || !type || !message) {
      return json({ ok: false, error: 'missing fields' }, 400, request);
    }

    const typeLabel = TYPES[type] ?? type;
    const toAddress = env.CONTACT_TO_EMAIL ?? 'djkatman@gmail.com';

    const mailRes = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: toAddress }] }],
        from: { email: 'noreply@pethoken-navi.com', name: 'ペット保険ナビ お問い合わせ' },
        reply_to: { email, name },
        subject: `[ペット保険ナビ] ${typeLabel}`,
        content: [
          {
            type: 'text/plain',
            value: `お名前: ${name}\nメール: ${email}\n種別: ${typeLabel}\n\n${message}`,
          },
        ],
      }),
    });

    if (!mailRes.ok) {
      const err = await mailRes.text();
      console.error('MailChannels error:', err);
      return json({ ok: false }, 500, request);
    }

    return json({ ok: true }, 200, request);
  },
};

function json(data, status, request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
  });
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin') ?? '';
  const allowed = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN;
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
