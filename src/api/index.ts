export interface ApiTrafficEntry {
  id: number;
  endpoint: string;
  payload: Record<string, any>;
  response?: any;
  error?: string;
  status?: number;
  duration: number;
  timestamp: string;
}

type ApiTrafficListener = (entry: ApiTrafficEntry) => void;
const trafficListeners = new Set<ApiTrafficListener>();
let trafficSequence = 0;

export const subscribeToApiTraffic = (listener: ApiTrafficListener) => {
  trafficListeners.add(listener);
  return () => trafficListeners.delete(listener);
};

const publishApiTraffic = (entry: Omit<ApiTrafficEntry, 'id'>) => {
  const completeEntry = { ...entry, id: ++trafficSequence };
  trafficListeners.forEach(listener => listener(completeEntry));
};

export const sendRequest = async (
  endpoint: string,
  payload: Record<string, any>,
  options: { signal?: AbortSignal } = {}
): Promise<any> => {
  const url = "/api/proxy";
  const startedAt = performance.now();
  const requestTimestamp = new Date().toISOString();
  
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ endpoint, payload }),
      signal: options.signal,
    });
  } catch (fetchErr: any) {
    const message = `Koneksi gagal: ${fetchErr.message}`;
    publishApiTraffic({ endpoint, payload, error: message, duration: Math.round(performance.now() - startedAt), timestamp: requestTimestamp });
    throw new Error(message);
  }

  const responseText = await response.text();

  if (!response.ok) {
    // Attempt to parse JSON error message from the response text
    let errorMessage: string | null = null;
    try {
      const errJson = JSON.parse(responseText);
      if (errJson && (errJson.error || errJson.message)) {
        errorMessage = errJson.error || errJson.message;
      }
    } catch {
      // ignore parsing error and throw generic status error
    }
    const message = errorMessage || `HTTP Error ${response.status}: ${responseText.slice(0, 150)}`;
    publishApiTraffic({ endpoint, payload, error: message, status: response.status, duration: Math.round(performance.now() - startedAt), timestamp: requestTimestamp });
    throw new Error(message);
  }

  try {
    const data = JSON.parse(responseText);
    publishApiTraffic({ endpoint, payload, response: data, status: response.status, duration: Math.round(performance.now() - startedAt), timestamp: requestTimestamp });
    return data;
  } catch (jsonErr) {
    if (responseText.trim().startsWith("<!doctype") || responseText.trim().startsWith("<html") || responseText.trim().startsWith("<!DOCTYPE")) {
      const message = `Gagal memuat data dari server (Menerima halaman HTML). Silakan segarkan halaman dan coba lagi.`;
      publishApiTraffic({ endpoint, payload, error: message, status: response.status, duration: Math.round(performance.now() - startedAt), timestamp: requestTimestamp });
      throw new Error(message);
    }
    const message = `Gagal membaca respons server (Format tidak valid): ${responseText.slice(0, 150)}`;
    publishApiTraffic({ endpoint, payload, error: message, status: response.status, duration: Math.round(performance.now() - startedAt), timestamp: requestTimestamp });
    throw new Error(message);
  }
};

