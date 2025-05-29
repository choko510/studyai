// Ultraviolet Proxy - メインアプリケーション
class UltravioletProxy {
    constructor() {
        this.config = {
            prefix: '/service/',
            bare: '/bare/',
            encodeUrl: this.encodeUrl.bind(this),
            decodeUrl: this.decodeUrl.bind(this),
            handler: '/uv/uv.handler.js',
            bundle: '/uv/uv.bundle.js',
            config: '/uv/uv.config.js',
            sw: '/uv/uv.sw.js'
        };
        
        this.settings = {
            adblock: true,
            security: true,
            javascript: 'enabled',
            userAgent: 'default',
            theme: 'auto',
            language: 'ja',
            cookies: true,
            images: true,
            autoplay: false,
            customCSS: ''
        };
        
        this.stats = {
            requests: 0,
            blocked: 0,
            userAgentChanges: 0
        };
        
        this.isReady = false;
        this.currentUrl = '';
        
        this.init();
    }
    
    async init() {
        try {
            // ローディング画面を表示
            this.showLoading();
            
            // 設定を読み込み
            await this.loadSettings();
            
            // イベントリスナーを設定
            this.setupEventListeners();
            
            // Service Worker を登録
            await this.registerServiceWorker();
            
            // テーマを適用
            this.applyTheme();
            
            // UI を初期化
            this.initializeUI();
            
            // ローディング画面を非表示
            setTimeout(() => {
                this.hideLoading();
                this.isReady = true;
            }, 1000);
            
        } catch (error) {
            console.error('初期化エラー:', error);
            this.showError('アプリケーションの初期化に失敗しました');
        }
    }
    
    showLoading() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.classList.remove('hidden');
        }
    }
    
    hideLoading() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
        }
    }
    
    async loadSettings() {
        try {
            const saved = localStorage.getItem('ultraviolet-settings');
            if (saved) {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
            }
        } catch (error) {
            console.warn('設定の読み込みに失敗しました:', error);
        }
    }
    
    saveSettings() {
        try {
            localStorage.setItem('ultraviolet-settings', JSON.stringify(this.settings));
        } catch (error) {
            console.warn('設定の保存に失敗しました:', error);
        }
    }
    
    setupEventListeners() {
        // プロキシフォームの送信
        const proxyForm = document.getElementById('proxyForm');
        if (proxyForm) {
            proxyForm.addEventListener('submit', this.handleProxySubmit.bind(this));
        }
        
        // 設定ボタン
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', this.toggleSettings.bind(this));
        }
        
        // クイックアクションボタン
        const quickBtns = document.querySelectorAll('.quick-btn');
        quickBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const url = e.target.getAttribute('data-url');
                if (url) {
                    this.navigateToUrl(url);
                }
            });
        });
        
        // モーダルクローズ
        const modalCloses = document.querySelectorAll('.modal-close');
        modalCloses.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modalId = e.target.getAttribute('data-modal');
                if (modalId) {
                    this.closeModal(modalId);
                }
            });
        });
        
        // 設定変更
        this.setupSettingsListeners();
        
        // キーボードショートカット
        document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));
        
        // ウィンドウイベント
        window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
    }
    
    setupSettingsListeners() {
        // 広告ブロック
        const adblockToggle = document.getElementById('adblockToggle');
        if (adblockToggle) {
            adblockToggle.checked = this.settings.adblock;
            adblockToggle.addEventListener('change', (e) => {
                this.settings.adblock = e.target.checked;
                this.saveSettings();
                this.updateStatus();
            });
        }
        
        // セキュリティ
        const securityToggle = document.getElementById('securityToggle');
        if (securityToggle) {
            securityToggle.checked = this.settings.security;
            securityToggle.addEventListener('change', (e) => {
                this.settings.security = e.target.checked;
                this.saveSettings();
                this.updateStatus();
            });
        }
        
        // JavaScript制御
        const jsControl = document.getElementById('javascriptControl');
        if (jsControl) {
            jsControl.value = this.settings.javascript;
            jsControl.addEventListener('change', (e) => {
                this.settings.javascript = e.target.value;
                this.saveSettings();
                this.updateStatus();
            });
        }
        
        // ユーザーエージェント
        const uaSelect = document.getElementById('userAgentSelect');
        if (uaSelect) {
            uaSelect.value = this.settings.userAgent;
            uaSelect.addEventListener('change', (e) => {
                this.settings.userAgent = e.target.value;
                this.saveSettings();
                this.updateUserAgentStatus();
            });
        }
        
        // テーマ
        const themeSelect = document.getElementById('themeSelect');
        if (themeSelect) {
            themeSelect.value = this.settings.theme;
            themeSelect.addEventListener('change', (e) => {
                this.settings.theme = e.target.value;
                this.saveSettings();
                this.applyTheme();
            });
        }
        
        // テーマボタン
        const themeBtn = document.getElementById('themeBtn');
        if (themeBtn) {
            themeBtn.addEventListener('click', this.toggleTheme.bind(this));
        }
    }
    
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js', {
                    scope: this.config.prefix
                });
                console.log('Service Worker registered:', registration);
                return registration;
            } catch (error) {
                console.error('Service Worker registration failed:', error);
                throw error;
            }
        } else {
            throw new Error('Service Worker not supported');
        }
    }
    
    handleProxySubmit(e) {
        e.preventDefault();
        
        const urlInput = document.getElementById('urlInput');
        if (!urlInput) return;
        
        const url = urlInput.value.trim();
        if (!url) {
            this.showError('URLを入力してください');
            return;
        }
        
        this.navigateToUrl(url);
    }
    
    async navigateToUrl(inputUrl) {
        if (!this.isReady) {
            this.showError('アプリケーションの準備中です');
            return;
        }
        
        try {
            // URL検証
            const url = this.validateAndFormatUrl(inputUrl);
            
            // セキュリティチェック
            if (this.settings.security) {
                const securityCheck = await this.checkUrlSecurity(url);
                if (!securityCheck.safe) {
                    const proceed = await this.showSecurityWarning(securityCheck.reason, url);
                    if (!proceed) return;
                }
            }
            
            // プロキシURLを生成
            const proxyUrl = this.generateProxyUrl(url);
            
            // 統計を更新
            this.stats.requests++;
            this.updateStatus();
            
            // 履歴に追加
            this.addToHistory(url);
            
            // ナビゲート
            window.location.href = proxyUrl;
            
        } catch (error) {
            console.error('ナビゲーションエラー:', error);
            this.showError('URLにアクセスできませんでした: ' + error.message);
        }
    }
    
    validateAndFormatUrl(input) {
        if (!input) {
            throw new Error('URLが入力されていません');
        }
        
        let url = input.trim();
        
        // プロトコルが省略されている場合は https:// を追加
        if (!/^https?:\/\//i.test(url)) {
            url = 'https://' + url;
        }
        
        try {
            const urlObj = new URL(url);
            return urlObj.href;
        } catch (error) {
            throw new Error('無効なURLです');
        }
    }
    
    async checkUrlSecurity(url) {
        try {
            const response = await fetch(`/api/test?url=${encodeURIComponent(url)}`);
            const result = await response.json();
            
            return {
                safe: result.accessible && result.warnings.length === 0,
                reason: result.warnings.join(', ') || '安全性に問題があります',
                warnings: result.warnings
            };
        } catch (error) {
            console.warn('セキュリティチェックに失敗しました:', error);
            return { safe: true }; // エラーの場合は通す
        }
    }
    
    showSecurityWarning(reason, url) {
        return new Promise((resolve) => {
            const modal = document.getElementById('warningModal');
            const message = document.getElementById('warningMessage');
            const proceedBtn = document.getElementById('proceedBtn');
            const cancelBtn = document.getElementById('cancelBtn');
            
            if (!modal || !message || !proceedBtn || !cancelBtn) {
                resolve(true);
                return;
            }
            
            message.textContent = reason;
            modal.classList.add('active');
            
            const handleProceed = () => {
                modal.classList.remove('active');
                cleanup();
                resolve(true);
            };
            
            const handleCancel = () => {
                modal.classList.remove('active');
                cleanup();
                resolve(false);
            };
            
            const cleanup = () => {
                proceedBtn.removeEventListener('click', handleProceed);
                cancelBtn.removeEventListener('click', handleCancel);
            };
            
            proceedBtn.addEventListener('click', handleProceed);
            cancelBtn.addEventListener('click', handleCancel);
        });
    }
    
    generateProxyUrl(url) {
        const encodedUrl = this.encodeUrl(url);
        return `${this.config.prefix}${encodedUrl}`;
    }
    
    encodeUrl(url) {
        // XOR エンコーディング (シンプル版)
        const encoded = btoa(url).replace(/=/g, '');
        return encoded;
    }
    
    decodeUrl(encoded) {
        try {
            return atob(encoded);
        } catch (error) {
            throw new Error('URLのデコードに失敗しました');
        }
    }
    
    addToHistory(url) {
        try {
            let history = JSON.parse(localStorage.getItem('ultraviolet-history') || '[]');
            
            const historyItem = {
                url: url,
                title: this.extractDomain(url),
                timestamp: Date.now()
            };
            
            // 重複を除去
            history = history.filter(item => item.url !== url);
            
            // 新しいアイテムを先頭に追加
            history.unshift(historyItem);
            
            // 履歴を100件に制限
            if (history.length > 100) {
                history = history.slice(0, 100);
            }
            
            localStorage.setItem('ultraviolet-history', JSON.stringify(history));
        } catch (error) {
            console.warn('履歴の保存に失敗しました:', error);
        }
    }
    
    extractDomain(url) {
        try {
            return new URL(url).hostname;
        } catch (error) {
            return url;
        }
    }
    
    toggleSettings() {
        const panel = document.getElementById('settingsPanel');
        if (panel) {
            panel.classList.toggle('active');
        }
    }
    
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
    }
    
    applyTheme() {
        const theme = this.settings.theme;
        const root = document.documentElement;
        
        // 既存のテーマクラスを削除
        document.body.classList.remove('theme-light', 'theme-dark', 'theme-blue');
        
        if (theme === 'auto') {
            // システムのダークモード設定を確認
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.body.classList.add(prefersDark ? 'theme-dark' : 'theme-light');
        } else {
            document.body.classList.add(`theme-${theme}`);
        }
    }
    
    toggleTheme() {
        const themes = ['auto', 'light', 'dark', 'blue'];
        const currentIndex = themes.indexOf(this.settings.theme);
        const nextIndex = (currentIndex + 1) % themes.length;
        
        this.settings.theme = themes[nextIndex];
        this.saveSettings();
        this.applyTheme();
        
        // 設定パネルの選択も更新
        const themeSelect = document.getElementById('themeSelect');
        if (themeSelect) {
            themeSelect.value = this.settings.theme;
        }
    }
    
    updateStatus() {
        // 接続状態
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            statusElement.textContent = this.isReady ? '準備完了' : '接続中';
            statusElement.className = 'status-value ' + (this.isReady ? 'status-ready' : 'status-connecting');
        }
        
        // ブロック数
        const blockedElement = document.getElementById('blockedCount');
        if (blockedElement) {
            blockedElement.textContent = this.stats.blocked;
        }
        
        // 速度インジケーター
        this.updateSpeedIndicator();
    }
    
    updateUserAgentStatus() {
        const uaElement = document.getElementById('currentUA');
        if (uaElement) {
            const uaNames = {
                'default': 'デフォルト',
                'chrome': 'Chrome',
                'firefox': 'Firefox',
                'safari': 'Safari',
                'mobile_ios': 'iPhone',
                'mobile_android': 'Android',
                'random': 'ランダム'
            };
            
            uaElement.textContent = uaNames[this.settings.userAgent] || 'デフォルト';
        }
        
        if (this.settings.userAgent !== 'default') {
            this.stats.userAgentChanges++;
        }
    }
    
    updateSpeedIndicator() {
        const speedElement = document.getElementById('speedIndicator');
        if (speedElement) {
            // 簡易的な速度計算 (実際の実装では詳細な測定が必要)
            const speed = this.calculateSpeed();
            speedElement.textContent = speed;
        }
    }
    
    calculateSpeed() {
        // プレースホルダー実装
        const speeds = ['高速', '普通', '低速'];
        return speeds[Math.floor(Math.random() * speeds.length)];
    }
    
    handleKeyboardShortcuts(e) {
        // Ctrl/Cmd + K: URL入力にフォーカス
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            const urlInput = document.getElementById('urlInput');
            if (urlInput) {
                urlInput.focus();
                urlInput.select();
            }
        }
        
        // Ctrl/Cmd + , : 設定を開く
        if ((e.ctrlKey || e.metaKey) && e.key === ',') {
            e.preventDefault();
            this.toggleSettings();
        }
        
        // Escape: モーダルを閉じる
        if (e.key === 'Escape') {
            const activeModal = document.querySelector('.modal.active');
            if (activeModal) {
                activeModal.classList.remove('active');
            } else {
                // 設定パネルを閉じる
                const settingsPanel = document.getElementById('settingsPanel');
                if (settingsPanel && settingsPanel.classList.contains('active')) {
                    settingsPanel.classList.remove('active');
                }
            }
        }
    }
    
    handleBeforeUnload() {
        // 設定を保存
        this.saveSettings();
    }
    
    initializeUI() {
        // ステータスを更新
        this.updateStatus();
        this.updateUserAgentStatus();
        
        // ツールチップを初期化
        this.initializeTooltips();
        
        // ダークモード監視
        this.setupDarkModeListener();
    }
    
    initializeTooltips() {
        // 簡易的なツールチップ実装
        const tooltipElements = document.querySelectorAll('[title]');
        tooltipElements.forEach(element => {
            element.addEventListener('mouseenter', this.showTooltip.bind(this));
            element.addEventListener('mouseleave', this.hideTooltip.bind(this));
        });
    }
    
    showTooltip(e) {
        // ツールチップ表示のプレースホルダー
        console.log('Tooltip:', e.target.getAttribute('title'));
    }
    
    hideTooltip(e) {
        // ツールチップ非表示のプレースホルダー
    }
    
    setupDarkModeListener() {
        if (window.matchMedia) {
            const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
            darkModeQuery.addEventListener('change', () => {
                if (this.settings.theme === 'auto') {
                    this.applyTheme();
                }
            });
        }
    }
    
    showError(message) {
        // 簡易的なエラー表示
        console.error('Error:', message);
        alert(message); // 実際の実装では専用のエラーモーダルを使用
    }
    
    showSuccess(message) {
        // 簡易的な成功メッセージ表示
        console.log('Success:', message);
    }
    
    // API メソッド
    async getStats() {
        try {
            const response = await fetch('/api/stats');
            return await response.json();
        } catch (error) {
            console.error('統計の取得に失敗しました:', error);
            return null;
        }
    }
    
    async getConfig() {
        try {
            const response = await fetch('/api/config');
            return await response.json();
        } catch (error) {
            console.error('設定の取得に失敗しました:', error);
            return null;
        }
    }
}

// アプリケーションを初期化
document.addEventListener('DOMContentLoaded', () => {
    window.ultravioletProxy = new UltravioletProxy();
});

// グローバル関数として公開
window.navigateToUrl = function(url) {
    if (window.ultravioletProxy) {
        window.ultravioletProxy.navigateToUrl(url);
    }
};