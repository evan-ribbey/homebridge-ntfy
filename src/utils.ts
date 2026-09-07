export const wait = (delay: number): Promise<void> => new Promise((resolve) => {
  setTimeout(resolve, delay);
});

export const isValidJson = (str: string) => {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Normalizes a user supplied ntfy server address into a base URL without a
 * trailing slash. Assumes https when no protocol is given and keeps any base
 * path, so servers behind a reverse proxy (e.g. https://home.example.com/ntfy)
 * keep working. Returns undefined when the address cannot be parsed.
 */
export const normalizeServerUrl = (url?: string): string | undefined => {
  const trimmed = url?.trim();
  if (!trimmed) {
    return undefined;
  }

  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch (e) {
    return undefined;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return undefined;
  }

  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`;
};
