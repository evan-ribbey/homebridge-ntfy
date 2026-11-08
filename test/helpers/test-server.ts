import http from 'node:http';
import type { AddressInfo } from 'node:net';

export interface CapturedRequest {
  method: string;
  url: string;
  headers: http.IncomingHttpHeaders;
  body: string;
}

export interface TestServer {
  url: string;
  requests: CapturedRequest[];
  lastRequest: () => CapturedRequest;
  close: () => Promise<void>;
}

/**
 * Starts a throwaway HTTP server that records what it receives. Using a real
 * server rather than a mocked axios keeps these tests honest about headers,
 * request bodies and status handling.
 */
export const startServer = async (
  status = 200,
  body = '{"id":"ok"}',
  headers: Record<string, string> = {},
): Promise<TestServer> => {
  const requests: CapturedRequest[] = [];

  const server = http.createServer((req, res) => {
    let received = '';
    req.on('data', (chunk) => {
      received += chunk;
    });
    req.on('end', () => {
      requests.push({
        method: req.method ?? '',
        url: req.url ?? '',
        headers: req.headers,
        body: received,
      });
      res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
      res.end(body);
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    lastRequest: () => requests[requests.length - 1],
    close: () => new Promise<void>((resolve) => {
      server.close(() => resolve());
    }),
  };
};
