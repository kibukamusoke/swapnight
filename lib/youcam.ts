const base = 'https://yce-api-01.makeupar.com/s2s/v2.0';
export async function youcam(path: string, method = 'GET', body?: unknown) {
 const key = process.env.YOUCAM_API_KEY;
 if (!key) throw new Error('The fitting room is almost ready. Add a YouCam API key to enable real try-ons.');
 const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), cache: 'no-store', signal: AbortSignal.timeout(25000) });
 const data = await response.json();
 if (!response.ok || data.error) throw new Error(data.error_code === 'CreditInsufficiency' ? 'This YouCam account needs AI Clothes credits before a real try-on can run.' : response.status === 401 ? 'The YouCam API key needs updating.' : response.status === 429 ? 'The fitting room is busy. Please try again in a moment.' : 'YouCam could not process this request. Please check your photo and API credits.');
 return data.data;
}

