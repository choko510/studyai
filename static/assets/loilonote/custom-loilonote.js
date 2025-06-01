//初期処理
(function() {
    const xpath = "/html/body/div/div[1]/div[4]";
    const timeout = 10000; // 10秒
    const interval = 100;  // チェック間隔

    const start = Date.now();

    const timer = setInterval(() => {
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const element = result.singleNodeValue;

        if (element) {
            element.remove();
            clearInterval(timer);
        } else if (Date.now() - start > timeout) {
            clearInterval(timer);
        }
    }, interval);
})();

function getElementByXPath(xpath) {
    return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
}

async function aireq(){
    try {
        console.log("画面をキャプチャ中...");
        
        let canvas;
        
        try {
            // まず安全なオプションでキャプチャを試行
            canvas = await html2canvas(document.body, {
                useCORS: false,
                allowTaint: false,
                scale: 0.5,
                scrollX: 0,
                scrollY: 0,
                width: window.innerWidth,
                height: window.innerHeight,
                ignoreElements: (element) => {
                    // 問題を起こす可能性のある要素をスキップ
                    return  element.tagName === 'IFRAME' ||
                            element.tagName === 'EMBED' ||
                            element.tagName === 'OBJECT' ||
                            element.classList.contains('winbox') ||
                            element.style.position === 'fixed';
                },
                onclone: (clonedDoc) => {
                    // クローンされたドキュメントから問題のある要素を削除
                    const problematicElements = clonedDoc.querySelectorAll('iframe, embed, object, .winbox');
                    problematicElements.forEach(el => {
                        try {
                            el.remove();
                        } catch (e) {
                            console.warn('要素の削除に失敗:', e);
                        }
                    });
                },
                backgroundColor: '#ffffff',
                logging: false
            });
        } catch (captureError) {
            console.warn("通常のキャプチャに失敗、より単純な方法を試行:", captureError);
            
            // より単純なキャプチャ方法を試行
            const targetElement = document.querySelector('body') || document.documentElement;
            canvas = await html2canvas(targetElement, {
                useCORS: false,
                allowTaint: false,
                scale: 0.3,
                logging: false,
                ignoreElements: () => false, // すべての要素を含める
                backgroundColor: '#ffffff'
            });
        }
        
        if (canvas) {
            // キャンバスをBlobに変換
            canvas.toBlob(async (blob) => {
                if (!blob) {
                    console.error("画像の変換に失敗しました、テキスト解析にフォールバック");
                    await fallbackTextAnalysis();
                    return;
                }
                
                console.log("AIに画像を送信中...");
                await sendToAI(blob, 'image');
                
            }, 'image/png', 0.8);
        } else {
            console.warn("キャンバス作成に失敗、テキスト解析にフォールバック");
            await fallbackTextAnalysis();
        }
        
    } catch (error) {
        console.error("画面キャプチャエラー:", error);
        console.log("テキスト解析にフォールバック...");
        await fallbackTextAnalysis();
    }
}

// AI にデータを送信する共通関数
async function sendToAI(data, type) {
    try {
        const formData = new FormData();
        
        if (type === 'image') {
            formData.append('image', data, 'screenshot.png');
            formData.append('prompt', 'この画面の内容について詳しく説明してください。特に表示されているテキストや要素について教えてください。');
        } else {
            // テキストの場合は、ダミー画像を作成してテキストをプロンプトに含める
            const canvas = document.createElement('canvas');
            canvas.width = 100;
            canvas.height = 100;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 100, 100);
            ctx.fillStyle = '#000000';
            ctx.font = '12px Arial';
            ctx.fillText('Text Analysis', 10, 50);
            
            // ダミー画像を作成して送信
            const blob = await new Promise(resolve => {
                canvas.toBlob(resolve, 'image/png');
            });
            
            formData.append('image', blob, 'text-analysis.png');
            formData.append('prompt', `画面から抽出されたテキスト内容を解析してください:\n\n${data}`);
        }
        
        console.log("AIに送信中...");
        
        // プロキシを完全に回避するため、XMLHttpRequestを使用
        const apiUrl = `${window.location.protocol}//${window.location.host}/api/aireq`;
        console.log('API URL:', apiUrl);
        
        try {
            // まずXMLHttpRequestでの送信を試行
            await sendWithXHR(apiUrl, formData);
        } catch (xhrError) {
            console.warn('XMLHttpRequest failed, trying fetch:', xhrError);
            
            // フォールバックとしてfetchを使用
            const originalFetch = window.fetch || self.fetch;
            
            const response = await originalFetch(apiUrl, {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Bypass-Proxy': 'true',
                    'Cache-Control': 'no-cache'
                },
                cache: 'no-cache'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // ストリーミングレスポンスを読み取り
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';
            
            console.log("AIからのレスポンス:");
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                fullResponse += chunk;
                console.log(chunk); // リアルタイムでコンソールに出力
            }
            
            console.log("--- AI解析完了 ---");
            console.log("完全なレスポンス:", fullResponse);
        }
        
    } catch (error) {
        console.error("AI API エラー:", error);
    }
}

// XMLHttpRequestを使ってプロキシを完全に回避
function sendWithXHR(url, formData) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.open('POST', url, true);
        xhr.setRequestHeader('X-Bypass-Proxy', 'true');
        xhr.setRequestHeader('Cache-Control', 'no-cache');
        
        let fullResponse = '';
        
        xhr.onprogress = (event) => {
            // プログレッシブなレスポンスを処理
            const chunk = xhr.responseText.substring(fullResponse.length);
            if (chunk) {
                fullResponse += chunk;
                console.log(chunk);
            }
        };
        
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                console.log("--- AI解析完了 (XHR) ---");
                console.log("完全なレスポンス:", xhr.responseText);
                resolve(xhr.responseText);
            } else {
                reject(new Error(`XHR HTTP error! status: ${xhr.status}`));
            }
        };
        
        xhr.onerror = () => {
            reject(new Error('XHR network error'));
        };
        
        xhr.ontimeout = () => {
            reject(new Error('XHR timeout'));
        };
        
        xhr.timeout = 30000; // 30秒タイムアウト
        
        console.log("AIからのレスポンス (XHR):");
        xhr.send(formData);
    });
}

// テキスト解析のフォールバック機能
async function fallbackTextAnalysis() {
    try {
        console.log("画面のテキストを抽出中...");
        
        // 画面上の可視テキストを抽出
        const textContent = document.body.innerText || document.body.textContent || '';
        const trimmedText = textContent.trim().substring(0, 2000); // 最初の2000文字
        
        if (trimmedText.length > 0) {
            console.log("抽出されたテキスト:", trimmedText.substring(0, 200) + "...");
            await sendToAI(trimmedText, 'text');
        } else {
            console.warn("抽出できるテキストが見つかりませんでした");
        }
        
    } catch (error) {
        console.error("テキスト解析エラー:", error);
    }
}

(function() {
    let currentUrl = location.href;

    const checkUrlChange = () => {
    if (location.href !== currentUrl) {
        
        
        // 少し待ってから実行
        setTimeout(() => {
            // 挿入先の要素を取得
            const target = getElementByXPath("/html/body/div/div[1]/div[3]/div[3]/div/div/div/div[3]");
            
            if (target) {
            
            // 新しい要素を作成
            const newElement = document.createElement('div');
            newElement.className = "editorButtonWrapper editorHeaderItem";
            newElement.innerHTML = `
                <div class="uiButton editorButton editorTextButton" role="button" tabindex="-1" aria-haspopup="menu" onclick="aireq()">AIに聞く</div>
                <div></div>
            `;
            
            // 先頭に挿入
            target.insertBefore(newElement, target.firstChild);
            } else {
            console.warn("XPathで要素が見つかりませんでした。");
            }
        }, 500); // 500ms待機
        currentUrl = location.href;
    }
    };

    const wrap = (method) => {
    const original = history[method];
    return function(...args) {
        const result = original.apply(this, args);
        checkUrlChange();
        return result;
    };
    };

    history.pushState = wrap('pushState');
    history.replaceState = wrap('replaceState');
    window.addEventListener('popstate', checkUrlChange);
})();

console.log("%cカスタムスクリプトが読み込まれました", "color: #9ACD32; font-weight: bold;");