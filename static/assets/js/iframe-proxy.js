// iframe-proxy.js - iframeベースのプロキシ制御

class IframeProxy {
  constructor() {
    this.iframe = document.getElementById('proxy-iframe');
    this.urlInput = document.getElementById('url-input');
    this.loadingEl = document.getElementById('loading');
    this.errorEl = document.getElementById('error-message');
    
    this.history = [];
    this.currentIndex = -1;
    this.defaultHome = 'https://google.com';
    this.sessionId = this.generateSessionId();
    
    // セッション復元
    this.restoreSession();
    
    // URL変化の監視を開始
    this.lastUrl = "";
    this.startUrlChangeMonitoring();
  }
  
  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
  
  saveSession() {
    const sessionData = {
      history: this.history,
      currentIndex: this.currentIndex,
      currentUrl: this.urlInput.value,
      timestamp: Date.now()
    };
    localStorage.setItem('proxySession_' + this.sessionId, JSON.stringify(sessionData));
    localStorage.setItem('currentSessionId', this.sessionId);
  }
  
  restoreSession() {
    const savedSessionId = localStorage.getItem('currentSessionId');
    if (savedSessionId) {
      const sessionData = localStorage.getItem('proxySession_' + savedSessionId);
      if (sessionData) {
        try {
          const data = JSON.parse(sessionData);
          // セッションが24時間以内のものであることを確認
          if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
            this.history = data.history || [];
            this.currentIndex = data.currentIndex || -1;
            this.sessionId = savedSessionId;
            
            // 前回のURLを復元
            if (data.currentUrl && data.currentUrl !== this.defaultHome) {
              setTimeout(() => {
                this.navigate(data.currentUrl);
                console.log('セッション復元: ' + data.currentUrl);
              }, 100);
              return;
            }
          }
        } catch (error) {
          console.error('セッション復元エラー:', error);
        }
      }
    }
    
    // セッション復元に失敗した場合は初期ページを読み込み
    setTimeout(() => {
      this.navigate(this.defaultHome);
    }, 100);
  }
  
  initializeEventListeners() {
    // Enterキーでナビゲート
    this.urlInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.navigate();
      }
    });
    
    // iframe読み込み状態の監視
    this.iframe.addEventListener('load', () => {
      this.onIframeLoad();
    });
    
    // iframe error監視
    this.iframe.addEventListener('error', () => {
      this.onIframeError();
    });
  }
  
  // iframeのURL変化を監視するメソッド
  startUrlChangeMonitoring() {
    setInterval(() => {
      this.checkIframeUrlChange();
    }, 500);
  }
  
  checkIframeUrlChange() {
    try {
      const currentUrl = this.iframe.contentWindow.location.href;
      if (currentUrl !== this.lastUrl) {
        this.lastUrl = currentUrl;
        console.log("iframe URL changed:", currentUrl);
        
        // URLが変化した時にurlInputを更新
        const realUrl = this.extractRealUrlFromProxy(currentUrl) || currentUrl;
        if (realUrl && realUrl !== this.urlInput.value) {
          this.urlInput.value = realUrl;
          // 履歴も更新
          if (this.history[this.currentIndex] !== realUrl) {
            if (this.currentIndex < this.history.length - 1) {
              this.history = this.history.slice(0, this.currentIndex + 1);
            }
            this.history.push(realUrl);
            this.currentIndex = this.history.length - 1;
            this.updateNavigationButtons();
            this.saveSession();
          }
          
          // 囲むモードボタンの表示チェック
          if (typeof checkAndToggleMarkerButton === 'function') {
            checkAndToggleMarkerButton();
          }
        }
      }
    } catch (error) {
      // 別オリジンだとここでエラーになる
      console.warn("Cannot access iframe URL due to cross-origin restrictions.");
    }
  }
  
  navigate(url = null) {
    const targetUrl = url || this.urlInput.value.trim();
    
    if (!targetUrl) {
      this.showError('URLを入力してください');
      return;
    }
    
    const processedUrl = this.processUrl(targetUrl);
    const proxyUrl = this.buildProxyUrl(processedUrl);
    
    this.hideError();
    
    // 履歴を更新（重複を避ける）
    if (this.history[this.currentIndex] !== processedUrl) {
      if (this.currentIndex < this.history.length - 1) {
        this.history = this.history.slice(0, this.currentIndex + 1);
      }
      this.history.push(processedUrl);
      this.currentIndex = this.history.length - 1;
    }
    
    this.loadUrl(processedUrl);
    this.updateNavigationButtons();
    
    // セッションを保存
    this.saveSession();
  }
  
  processUrl(input) {
    let url = input.trim();
    
    // 検索エンジンの設定を取得
    const engine = localStorage.getItem("engine") || "https://www.google.com/search?q=";
    
    // URLかどうか判定
    if (!this.isUrl(url)) {
      // 検索クエリとして処理
      url = engine + encodeURIComponent(url);
    } else if (!(url.startsWith("https://") || url.startsWith("http://"))) {
      // プロトコルを追加
      url = `https://${url}`;
    }
    
    return url;
  }
  
  buildProxyUrl(url) {
    // Ultravioletの既存のエンコーディングを使用
    if (typeof __uv$config !== 'undefined' && __uv$config.encodeUrl) {
      const encodedUrl = __uv$config.encodeUrl(url);
      return `/a/${encodedUrl}`;
    } else {
      // フォールバック: シンプルエンコーディング
      const encodedUrl = encodeURIComponent(url);
      return `/a/${encodedUrl}`;
    }
  }
  
  isUrl(val = "") {
    return /^https?:\/\//.test(val) || 
           (val.includes(".") && val.substr(0, 1) !== " ");
  }
  
  extractDomain(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }
  
  goBack() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      const url = this.history[this.currentIndex];
      this.loadUrl(url);
      this.updateNavigationButtons();
      this.saveSession();
    }
  }
  
  goForward() {
    if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++;
      const url = this.history[this.currentIndex];
      this.loadUrl(url);
      this.updateNavigationButtons();
      this.saveSession();
    }
  }
  
  loadUrl(url) {
    // URLを読み込む共通メソッド
    const proxyUrl = this.buildProxyUrl(url);
    this.iframe.src = proxyUrl;
    this.urlInput.value = url;
    
    // タイトルを更新
    document.title = `${this.extractDomain(url)} - Interstellar Proxy`;
  }
  
  refresh() {
    if (this.iframe.src) {
      this.iframe.src = this.iframe.src;
    }
  }
  
  updateNavigationButtons() {
    const backBtn = document.getElementById('back-btn');
    const forwardBtn = document.getElementById('forward-btn');
    
    backBtn.disabled = this.currentIndex <= 0;
    forwardBtn.disabled = this.currentIndex >= this.history.length - 1;
  }
  
  showError(message) {
    this.errorEl.textContent = message;
    this.errorEl.style.display = 'block';
    this.hideLoading();
  }
  
  hideError() {
    this.errorEl.style.display = 'none';
  }
  
  onIframeLoad() {
    this.hideLoading();
    this.hideError();
    try {
      // URLを同期
      const proxySrc = this.iframe.src;
      const realUrl = this.extractRealUrlFromProxy(proxySrc) || proxySrc;
      console.log('onIframeLoad:', realUrl);
      if (realUrl && realUrl !== this.urlInput.value) {
        this.urlInput.value = realUrl;
      }
      // タイトルを同期
      const iframeDoc = this.iframe.contentDocument;
      if (iframeDoc && iframeDoc.title) {
        document.title = `${iframeDoc.title} - Interstellar Proxy`;
      } else {
        document.title = `${this.extractDomain(realUrl)} - Interstellar Proxy`;
      }
    } catch (error) {
      console.log('onIframeLoad sync failed:', error);
    }
  }
  onIframeError() {
    this.showError('ページの読み込みに失敗しました。URLを確認してください。');
  }
  
  extractRealUrlFromProxy(proxyUrl) {
    try {
      // プロキシURLのパターン: /a/[encoded-url]
      const match = proxyUrl.match(/\/a\/(.+)$/);
      if (match) {
        // Ultravioletのデコーディングを使用
        if (typeof __uv$config !== 'undefined' && __uv$config.decodeUrl) {
          return __uv$config.decodeUrl(match[1]);
        } else {
          // フォールバック: シンプルデコーディング
          return decodeURIComponent(match[1]);
        }
      }
    } catch (error) {
      console.error('URL extraction failed:', error);
    }
    return null;
  }
}

// グローバル関数（HTMLから呼び出し用）
let proxyInstance;

function navigate() {
  proxyInstance.navigate();
}

function goBack() {
  proxyInstance.goBack();
}

function goForward() {
  proxyInstance.goForward();
}

function refresh() {
  proxyInstance.refresh();
}

function openAI() {
  proxyInstance.openAI();
}


// 初期化
document.addEventListener('DOMContentLoaded', () => {
  proxyInstance = new IframeProxy();
});

// 既存の関数（後方互換性のため）
function go(value) {
  proxyInstance.navigate(value);
}

function blank(value) {
  proxyInstance.navigate(value);
}

function dy(value) {
  proxyInstance.navigate(value);
}