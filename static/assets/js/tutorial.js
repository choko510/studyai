// チュートリアル機能
(function() {
    'use strict';

    // チュートリアルの設定
    const TUTORIAL_CONFIG = {
        steps: [
            {
                element: '.url-bar',
                title: 'URLバー',
                content: 'ここにURLや検索語を入力して、ウェブサイトに移動できます。例：「数学の問題」や「https://example.com」など',
                position: 'bottom'
            },
            {
                element: '#ai-btn',
                title: 'AI質問ボタン',
                content: 'AIに質問したり、画面をキャプチャしてAIに分析してもらうことができます。クリックするとAIチャットウィンドウが開きます。',
                position: 'bottom'
            },
            {
                element: '#voice-demo-btn',
                title: '音声デモ',
                content: '音声でAIと会話できるデモ機能です。マイクを使って話しかけると、音声で返答してくれます。',
                position: 'bottom'
            },
            {
                element: '.proxy-iframe',
                title: 'ブラウザエリア',
                content: 'ここにウェブサイトが表示されます。StudyAIの特別な機能を使って、画面上の内容をAIに質問できます。',
                position: 'top'
            },
            {
                element: '.proxy-iframe',
                title: '🖱️ 右クリックマーカー機能',
                content: '右クリックを押したまま画面上をドラッグすると、赤いマーカーで範囲を囲むことができます。これが「囲って検索」機能です！',
                position: 'top'
            },
            {
                element: '.proxy-iframe',
                title: '⭕ 範囲を閉じる',
                content: 'マーカーで範囲を囲んだら、最初の位置に戻るように線を引いて「閉じた形」を作ってください。円や四角形のような形になればOKです。',
                position: 'top'
            },
            {
                element: '.proxy-iframe',
                title: '🤖 自動AI分析',
                content: '閉じた範囲を検出すると、確認ダイアログが表示されます。「はい」を押すと、囲んだ部分だけを自動でキャプチャしてAIが分析してくれます！',
                position: 'top'
            },
            {
                element: '.proxy-iframe',
                title: '💡 活用例',
                content: '数学の問題を囲んで解法を聞いたり、英文を囲んで翻訳してもらったり、図表を囲んで説明してもらうなど、様々な使い方ができます。',
                position: 'top'
            }
        ]
    };

    // ローカルストレージのキー
    const TUTORIAL_SHOWN_KEY = 'studyai_tutorial_shown';

    // チュートリアルが完了済みかチェック
    function isTutorialCompleted() {
        return localStorage.getItem(TUTORIAL_SHOWN_KEY) === 'true';
    }

    // チュートリアル完了を記録
    function markTutorialCompleted() {
        localStorage.setItem(TUTORIAL_SHOWN_KEY, 'true');
    }

    // チュートリアル完了状態をリセット（デバッグ用）
    function resetTutorial() {
        localStorage.removeItem(TUTORIAL_SHOWN_KEY);
    }

    // チュートリアル開始確認ダイアログを表示
    function showTutorialDialog() {
        const dialog = document.createElement('div');
        dialog.id = 'tutorial-dialog';
        Object.assign(dialog.style, {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'white',
            borderRadius: '16px',
            padding: '32px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            zIndex: '10000',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            color: '#1a1a1a',
            maxWidth: '400px',
            textAlign: 'center',
            border: '1px solid #e5e7eb'
        });

        dialog.innerHTML = `
            <div style="margin-bottom: 24px;">
                <div style="
                    width: 64px;
                    height: 64px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-radius: 50%;
                    margin: 0 auto 16px auto;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 24px;
                    color: white;
                ">
                    <i class="fas fa-graduation-cap"></i>
                </div>
                <h2 style="margin: 0 0 16px 0; font-size: 24px; color: #374151; font-weight: 600;">
                    StudyAIへようこそ！
                </h2>
                <p style="margin: 0; font-size: 16px; color: #6b7280; line-height: 1.6;">
                    チュートリアルを開始しますか？
                </p>
            </div>
            <div style="display: flex; gap: 12px; justify-content: center;">
                <button id="tutorial-start" style="
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 16px;
                    font-weight: 500;
                    transition: all 0.2s ease;
                ">
                    <i class="fas fa-play-circle"></i> はい、開始
                </button>
                <button id="tutorial-skip" style="
                    background: #f3f4f6;
                    color: #6b7280;
                    border: 1px solid #d1d5db;
                    padding: 12px 24px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 16px;
                    font-weight: 500;
                    transition: all 0.2s ease;
                ">
                    <i class="fas fa-times"></i> スキップ
                </button>
            </div>
            <div style="margin-top: 16px;">
                <label style="display: flex; align-items: center; justify-content: center; font-size: 14px; color: #6b7280; cursor: pointer;">
                    <input type="checkbox" id="dont-show-again" style="margin-right: 8px;">
                    今後このダイアログを表示しない
                </label>
            </div>
        `;

        document.body.appendChild(dialog);

        // ボタンのホバーエフェクト
        const startBtn = dialog.querySelector('#tutorial-start');
        const skipBtn = dialog.querySelector('#tutorial-skip');

        startBtn.addEventListener('mouseover', () => {
            startBtn.style.transform = 'translateY(-2px)';
            startBtn.style.boxShadow = '0 8px 20px rgba(102, 126, 234, 0.4)';
        });
        startBtn.addEventListener('mouseout', () => {
            startBtn.style.transform = 'translateY(0)';
            startBtn.style.boxShadow = 'none';
        });

        skipBtn.addEventListener('mouseover', () => {
            skipBtn.style.background = '#e5e7eb';
            skipBtn.style.borderColor = '#9ca3af';
        });
        skipBtn.addEventListener('mouseout', () => {
            skipBtn.style.background = '#f3f4f6';
            skipBtn.style.borderColor = '#d1d5db';
        });

        // イベントリスナー
        startBtn.addEventListener('click', () => {
            const dontShowAgain = dialog.querySelector('#dont-show-again').checked;
            if (dontShowAgain) {
                markTutorialCompleted();
            }
            dialog.remove();
            startTutorial();
        });

        skipBtn.addEventListener('click', () => {
            // スキップした場合は常にチュートリアル完了とみなす
            markTutorialCompleted();
            dialog.remove();
        });

        // ESCキーで閉じる
        document.addEventListener('keydown', function escHandler(e) {
            if (e.key === 'Escape') {
                dialog.remove();
                document.removeEventListener('keydown', escHandler);
            }
        });
    }

    // Driver.jsを動的に読み込む関数
    function loadDriverJS() {
        return new Promise((resolve, reject) => {
            // 既に読み込まれている場合はそのまま使用
            if (typeof window.driver !== 'undefined') {
                resolve();
                return;
            }

            // CSS を読み込み
            const cssLink = document.createElement('link');
            cssLink.rel = 'stylesheet';
            cssLink.href = 'https://cdn.jsdelivr.net/npm/driver.js@1.3.6/dist/driver.min.css';
            document.head.appendChild(cssLink);

            // JavaScript を読み込み
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/driver.js@1.3.6/dist/driver.js.iife.min.js';
            script.onload = () => {
                console.log('Driver.js が正常に読み込まれました');
                resolve();
            };
            script.onerror = () => {
                console.error('Driver.js の読み込みに失敗しました');
                reject(new Error('Driver.js load failed'));
            };
            document.head.appendChild(script);
        });
    }

    // チュートリアル実行
    async function startTutorial() {
        try {
            // Driver.jsを動的に読み込み
            await loadDriverJS();
            
            // 最新のDriver.js API を使用
            const driverObj = window.driver({
                showProgress: true,
                steps: TUTORIAL_CONFIG.steps.map(step => ({
                    element: step.element,
                    popover: {
                        title: step.title,
                        description: step.content,
                        side: step.position === 'bottom' ? 'bottom' : 'top',
                        align: 'start'
                    }
                })),
                nextBtnText: '次へ',
                prevBtnText: '前へ',
                doneBtnText: '完了',
                allowClose: true,
                onDestroyed: () => {
                    console.log('チュートリアル終了');
                    markTutorialCompleted();
                }
            });

            driverObj.drive();
        } catch (error) {
            console.error('Driver.js エラー:', error);
            console.log('フォールバックチュートリアルに切り替えます');
            showFallbackTutorial();
        }
    }

    // フォールバック用の簡易チュートリアル
    function showFallbackTutorial() {
        let currentStep = 0;
        
        function showStep(stepIndex) {
            if (stepIndex >= TUTORIAL_CONFIG.steps.length) {
                markTutorialCompleted();
                return;
            }

            const step = TUTORIAL_CONFIG.steps[stepIndex];
            const element = document.querySelector(step.element);
            
            if (!element) {
                showStep(stepIndex + 1);
                return;
            }

            // 要素をハイライト
            const originalStyle = {
                position: element.style.position,
                zIndex: element.style.zIndex,
                boxShadow: element.style.boxShadow,
                border: element.style.border
            };

            Object.assign(element.style, {
                position: 'relative',
                zIndex: '9999',
                boxShadow: '0 0 0 4px rgba(102, 126, 234, 0.5), 0 0 0 8px rgba(102, 126, 234, 0.2)',
                border: '2px solid #667eea',
                borderRadius: '8px'
            });

            // 説明ポップアップを作成
            const popup = document.createElement('div');
            popup.id = 'tutorial-popup';
            Object.assign(popup.style, {
                position: 'fixed',
                background: 'white',
                borderRadius: '12px',
                padding: '20px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
                zIndex: '10001',
                maxWidth: '300px',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                border: '1px solid #e5e7eb'
            });

            popup.innerHTML = `
                <h3 style="margin: 0 0 12px 0; font-size: 18px; color: #374151; font-weight: 600;">
                    ${step.title}
                </h3>
                <p style="margin: 0 0 20px 0; font-size: 14px; color: #6b7280; line-height: 1.5;">
                    ${step.content}
                </p>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 12px; color: #9ca3af;">
                        ${stepIndex + 1} / ${TUTORIAL_CONFIG.steps.length}
                    </span>
                    <div style="display: flex; gap: 8px;">
                        ${stepIndex > 0 ? `
                            <button id="prev-btn" style="
                                background: #f3f4f6;
                                color: #6b7280;
                                border: 1px solid #d1d5db;
                                padding: 8px 16px;
                                border-radius: 6px;
                                cursor: pointer;
                                font-size: 14px;
                            ">前へ</button>
                        ` : ''}
                        <button id="next-btn" style="
                            background: #667eea;
                            color: white;
                            border: none;
                            padding: 8px 16px;
                            border-radius: 6px;
                            cursor: pointer;
                            font-size: 14px;
                        ">${stepIndex === TUTORIAL_CONFIG.steps.length - 1 ? '完了' : '次へ'}</button>
                        <button id="close-btn" style="
                            background: transparent;
                            color: #6b7280;
                            border: none;
                            padding: 8px;
                            border-radius: 6px;
                            cursor: pointer;
                            font-size: 14px;
                        ">×</button>
                    </div>
                </div>
            `;

            // ポップアップの位置を計算
            const rect = element.getBoundingClientRect();
            const popupRect = { width: 300, height: 150 }; // 推定サイズ

            let top, left;
            if (step.position === 'bottom') {
                top = rect.bottom + 10;
                left = rect.left + (rect.width / 2) - (popupRect.width / 2);
            } else if (step.position === 'top') {
                top = rect.top - popupRect.height - 10;
                left = rect.left + (rect.width / 2) - (popupRect.width / 2);
            }

            // 画面端の調整
            if (left < 10) left = 10;
            if (left + popupRect.width > window.innerWidth - 10) {
                left = window.innerWidth - popupRect.width - 10;
            }
            if (top < 10) top = 10;
            if (top + popupRect.height > window.innerHeight - 10) {
                top = window.innerHeight - popupRect.height - 10;
            }

            popup.style.top = top + 'px';
            popup.style.left = left + 'px';

            document.body.appendChild(popup);

            // イベントリスナー
            const nextBtn = popup.querySelector('#next-btn');
            const prevBtn = popup.querySelector('#prev-btn');
            const closeBtn = popup.querySelector('#close-btn');

            function cleanup() {
                // スタイルを復元
                Object.assign(element.style, originalStyle);
                popup.remove();
            }

            nextBtn.addEventListener('click', () => {
                cleanup();
                if (stepIndex === TUTORIAL_CONFIG.steps.length - 1) {
                    markTutorialCompleted();
                } else {
                    showStep(stepIndex + 1);
                }
            });

            if (prevBtn) {
                prevBtn.addEventListener('click', () => {
                    cleanup();
                    showStep(stepIndex - 1);
                });
            }

            closeBtn.addEventListener('click', () => {
                cleanup();
                markTutorialCompleted();
            });

            // ESCキーで閉じる
            function escHandler(e) {
                if (e.key === 'Escape') {
                    cleanup();
                    markTutorialCompleted();
                    document.removeEventListener('keydown', escHandler);
                }
            }
            document.addEventListener('keydown', escHandler);
        }

        showStep(0);
    }

    // 初期化関数
    function initTutorial() {
        // ページが完全に読み込まれるまで少し待つ
        setTimeout(() => {
            if (!isTutorialCompleted()) {
                showTutorialDialog();
            }
        }, 1000);
    }

    // DOMが読み込まれたら初期化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTutorial);
    } else {
        initTutorial();
    }

    // グローバルに公開（デバッグ用）
    window.StudyAITutorial = {
        start: startTutorial,
        reset: resetTutorial,
        showDialog: showTutorialDialog
    };

})();