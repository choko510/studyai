importScripts("/assets/history/config.js?v=2025-06-01");
importScripts("/assets/history/worker.js?v=2025-06-01");
importScripts("/assets/mathematics/bundle.js?v=2025-06-01");
importScripts("/assets/mathematics/config.js?v=2025-06-01");
importScripts(__uv$config.sw || "/assets/mathematics/sw.js?v=2025-06-01");

// Service Worker バージョン - iframe プロキシ対応
const SW_VERSION = "v2025-06-01-iframe-proxy";
console.log(`Service Worker ${SW_VERSION} loaded for iframe proxy`);

const uv = new UVServiceWorker();
const dynamic = new Dynamic();

const userKey = new URL(location).searchParams.get("userkey");
self.dynamic = dynamic;

self.addEventListener("fetch", event => {
  event.respondWith(
    (async () => {
      const url = event.request.url;
      const headers = event.request.headers;
      
      // プロキシバイパスヘッダーがある場合
      if (headers.get('X-Bypass-Proxy') === 'true') {
        console.log('Bypassing proxy due to header:', url);
        return await fetch(event.request);
      }
      
      // 同じオリジンのAPIアクセスはプロキシを通さない
      if (url.startsWith(`${location.origin}/api/`)) {
        console.log('Bypassing proxy for API request:', url);
        return await fetch(event.request);
      }

      // 同じオリジンの静的リソース（CSS、JS、画像など）もプロキシを通さない
      if (url.startsWith(`${location.origin}/`) &&
          !url.startsWith(`${location.origin}/a/`)) {
        console.log('Bypassing proxy for same-origin request:', url);
        return await fetch(event.request);
      }
      
      // Googleのトラッキングリクエストを特別に処理
      if (url.includes('gen_204') || url.includes('client_204') || url.includes('_/js/') || url.includes('favicon.ico')) {
        console.log('Bypassing tracking/resource request:', url);
        return await fetch(event.request, { mode: 'no-cors' });
      }

      if (await dynamic.route(event)) {
        return await dynamic.fetch(event);
      }

      if (url.startsWith(`${location.origin}/a/`)) {
        try {
          const response = await uv.fetch(event);
          
          // iframe プロキシ用のヘッダーを設定（全てのレスポンスに適用）
          const newHeaders = new Headers(response.headers);
          newHeaders.delete('X-Frame-Options');
          newHeaders.delete('Content-Security-Policy');
          newHeaders.set('X-Frame-Options', 'ALLOWALL');
          
          // HTMLレスポンスの場合のみスクリプト注入を試行
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('text/html') && response.status >= 200 && response.status < 300) {
            try {
              const html = await response.text();
              return new Response(html, {
                status: response.status || 200,
                statusText: response.statusText || 'OK',
                headers: newHeaders
              });
            } catch (htmlError) {
              console.log('HTML processing failed, returning original response');
              return new Response(response.body, {
                status: response.status || 200,
                statusText: response.statusText || 'OK',
                headers: newHeaders
              });
            }
          }
          
          // HTML以外はヘッダー修正のみで返す
          return new Response(response.body, {
            status: response.status || 200,
            statusText: response.statusText || 'OK',
            headers: newHeaders
          });
          
        } catch (error) {
          console.error('Proxy request failed:', error);
          return new Response('Proxy Error', { status: 500 });
        }
      }

      return await fetch(event.request);
    })(),
  );
});
