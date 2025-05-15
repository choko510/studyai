/**
 * PyProxy クライアントサイドスクリプト
 */
document.addEventListener('DOMContentLoaded', function() {
    // URLフォーム
    const urlForm = document.querySelector('form');
    const urlInput = document.getElementById('url');
    
    if (urlForm && urlInput) {
        // フォーム送信前の処理
        urlForm.addEventListener('submit', function(event) {
            // URLを整形 
            let url = urlInput.value.trim();
            
            // プロトコルがなければhttpsを追加
            if (url && !url.match(/^https?:\/\//i)) {
                url = 'https://' + url;
                urlInput.value = url;
            }
            
            // URLバリデーション
            if (!isValidUrl(url)) {
                event.preventDefault();
                showError('無効なURLです。正しいURLを入力してください。');
                return false;
            }
        });
        
        // フォーカス時にURLを選択
        urlInput.addEventListener('focus', function() {
            this.select();
        });
        
        // URLの例をクリックするとフォームに入力
        const examples = document.querySelectorAll('.url-example');
        examples.forEach(function(example) {
            example.addEventListener('click', function(event) {
                event.preventDefault();
                urlInput.value = this.getAttribute('data-url');
                urlForm.submit();
            });
        });
    }
    
    // エラーメッセージを表示
    function showError(message) {
        const formHint = document.querySelector('.form-hint');
        if (formHint) {
            formHint.innerHTML = `<span style="color: red;">${message}</span>`;
            setTimeout(() => {
                formHint.innerHTML = 'URLを入力してください（例: https://example.com）';
            }, 3000);
        }
    }
    
    // URLバリデーション
    function isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch (error) {
            return false;
        }
    }
    
    // ブラウザの戻るボタンでフォームの値を保持
    window.addEventListener('pageshow', function(event) {
        if (event.persisted && urlInput) {
            // bfcacheから復元された場合
            urlInput.value = '';
        }
    });
});