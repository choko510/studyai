// チュートリアル機能
(function() {
    'use strict';

    // 端末検出機能
    function detectDevice() {
        const userAgent = navigator.userAgent.toLowerCase();
        const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
        const isTablet = /ipad/i.test(userAgent) || (isMobile && window.innerWidth > 600);
        const isDesktop = !isMobile;
        const isMac = /mac/i.test(userAgent);
        const isWindows = /windows/i.test(userAgent);
        const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        return {
            isMobile: isMobile && !isTablet,
            isTablet,
            isDesktop,
            isMac,
            isWindows,
            isTouch
        };
    }

    // 端末別の操作説明を生成
    function getDeviceSpecificInstructions() {
        const device = detectDevice();
        
        if (device.isMobile) {
            return {
                markerTitle: '📱 タッチマーカー機能',
                markerContent: '画面を長押しして、指でドラッグすると赤いマーカーで範囲を囲むことができます。これが「囲って検索」機能です！\n\n📍 操作方法：\n• 長押し（約1秒）してから指を動かす\n• 赤い線が表示されたら成功です',
                closeInstruction: '⭕ 範囲を閉じる',
                closeContent: 'マーカーで範囲を囲んだら、最初の位置に戻るように指を動かして「閉じた形」を作ってください。円や四角形のような形になればOKです。\n\n💡 コツ：ゆっくりと指を動かすと正確に線を引けます',
                additionalTips: '📱 スマートフォンでのコツ',
                additionalContent: '• 画面を縦向きにすると操作しやすくなります\n• 指が乾いていると滑りにくいので、少し湿らせると良いでしょう\n• 急がずゆっくりと範囲を囲んでください'
            };
        } else if (device.isTablet) {
            return {
                markerTitle: '📱 タッチマーカー機能',
                markerContent: 'タブレットでは画面を長押しして、指でドラッグすると赤いマーカーで範囲を囲むことができます。これが「囲って検索」機能です！\n\n📍 操作方法：\n• 長押し（約1秒）してから指を動かす\n• 赤い線が表示されたら成功です',
                closeInstruction: '⭕ 範囲を閉じる',
                closeContent: 'マーカーで範囲を囲んだら、最初の位置に戻るように指を動かして「閉じた形」を作ってください。円や四角形のような形になればOKです。\n\n💡 コツ：大きな画面を活かして、ゆったりと範囲を囲んでください',
                additionalTips: '📱 タブレットでのコツ',
                additionalContent: '• 両手で持って親指で操作すると安定します\n• ペンがある場合はより正確に操作できます\n• 画面の角度を調整して見やすい位置にしてください'
            };
        } else {
            // デスクトップ
            const rightClickText = device.isMac ? 
                '右クリック（または control + クリック）' : 
                '右クリック';
            
            return {
                markerTitle: '🖱️ マウスマーカー機能',
                markerContent: `${rightClickText}を押したまま画面上をドラッグすると、赤いマーカーで範囲を囲むことができます。これが「囲って検索」機能です！\n\n🖱️ 操作方法：\n• ${rightClickText}を押し続ける\n• そのままマウスを動かしてドラッグ\n• 赤い線が表示されたら成功です`,
                closeInstruction: '⭕ 範囲を閉じる',
                closeContent: 'マーカーで範囲を囲んだら、最初の位置に戻るように線を引いて「閉じた形」を作ってください。円や四角形のような形になればOKです。\n\n💡 コツ：マウスの動きをゆっくりと、正確に行ってください',
                additionalTips: `💻 ${device.isMac ? 'Mac' : 'Windows'}でのコツ`,
                additionalContent: device.isMac ? 
                    '• Magic Mouseの場合、しっかりと右クリックを押し続けてください\n• Controlキー + クリックでも同じ操作ができます\n• トラックパッドの場合は二本指でクリックしながらドラッグしてください' :
                    '• マウスの右ボタンをしっかりと押し続けてください\n• ドラッグ中は右ボタンを離さないように注意してください\n• マウスパッドを清潔に保つとスムーズに操作できます'
            };
        }
    }

    // チュートリアルの設定（端末別対応）
    function getTutorialConfig() {
        const deviceInstructions = getDeviceSpecificInstructions();
        
        return {
            steps: [
                {
                    element: '.url-bar',
                    title: '🔍 URLバー',
                    content: 'ここにURLや検索語を入力して、ウェブサイトに移動できます。\n\n📝 入力例：\n• 「数学の問題」「英語 文法」などの検索語\n• 「https://example.com」などのURL\n• 「Wikipedia」「YouTube」などのサイト名',
                    position: 'bottom'
                },
                {
                    element: '#ai-btn',
                    title: '🤖 AI質問ボタン',
                    content: 'AIに質問したり、画面をキャプチャしてAIに分析してもらうことができます。\n\n✨ できること：\n• テキストでの質問・相談\n• 画面全体のキャプチャと分析\n• 学習のサポートとアドバイス\n\nクリックするとAIチャットウィンドウが開きます。',
                    position: 'bottom'
                },
                {
                    element: '#voice-demo-btn',
                    title: '🎤 音声デモ',
                    content: '音声でAIと会話できるデモ機能です。\n\n🎯 使い方：\n• ボタンをクリックして音声機能を開始\n• マイクに向かって話しかけてください\n• AIが音声で返答してくれます\n\n💡 音声認識の精度を上げるため、静かな環境で明瞭に話してください。',
                    position: 'bottom'
                },
                {
                    element: '.proxy-iframe',
                    title: '🌐 ブラウザエリア',
                    content: 'ここにウェブサイトが表示されます。StudyAIの特別な機能を使って、画面上の内容をAIに質問できます。\n\n🔥 特徴：\n• 通常のブラウザと同じように操作可能\n• 表示内容をAIが理解・分析\n• 学習に特化した便利機能が利用可能',
                    position: 'top'
                },
                {
                    element: '.proxy-iframe',
                    title: deviceInstructions.markerTitle,
                    content: deviceInstructions.markerContent,
                    position: 'top'
                },
                {
                    element: '.proxy-iframe',
                    title: deviceInstructions.closeInstruction,
                    content: deviceInstructions.closeContent,
                    position: 'top'
                },
                {
                    element: '.proxy-iframe',
                    title: '🤖 自動AI分析',
                    content: '閉じた範囲を検出すると、確認ダイアログが表示されます。\n\n📋 手順：\n1. 「はい」ボタンをクリック\n2. 囲んだ部分が自動でキャプチャされます\n3. AIが内容を分析して回答します\n\n⚡ 数秒で結果が表示されるので、お待ちください！',
                    position: 'top'
                },
                {
                    element: '.proxy-iframe',
                    title: '💡 活用例とアイデア',
                    content: '「囲って検索」機能の様々な使い方をご紹介します：\n\n📚 学習活用例：\n• 数学の問題を囲んで → 解法と解説\n• 英文を囲んで → 翻訳と文法説明\n• 図表やグラフを囲んで → データ分析と解釈\n• 歴史の年表を囲んで → 背景や関連事項\n• 科学の実験図を囲んで → 原理や仕組み',
                    position: 'top'
                },
                {
                    element: '.proxy-iframe',
                    title: deviceInstructions.additionalTips,
                    content: deviceInstructions.additionalContent,
                    position: 'top'
                }
            ]
        };
    }

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
        const device = detectDevice();
        const deviceName = device.isMobile ? 'スマートフォン' : 
                          device.isTablet ? 'タブレット' : 
                          device.isMac ? 'Mac' : 'PC';
        
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
                <p style="margin: 0 0 12px 0; font-size: 16px; color: #6b7280; line-height: 1.6;">
                    ${deviceName}に最適化されたチュートリアルを開始しますか？
                </p>
                <p style="margin: 0; font-size: 14px; color: #9ca3af; line-height: 1.4;">
                    ご利用の端末に合わせた操作方法をご案内します
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
            
            const tutorialConfig = getTutorialConfig();
            
            // 最新のDriver.js API を使用
            const driverObj = window.driver({
                showProgress: true,
                steps: tutorialConfig.steps.map(step => ({
                    element: step.element,
                    popover: {
                        title: step.title,
                        description: step.content.replace(/\n/g, '<br>'),
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
        const tutorialConfig = getTutorialConfig();
        let currentStep = 0;
        
        function showStep(stepIndex) {
            if (stepIndex >= tutorialConfig.steps.length) {
                markTutorialCompleted();
                return;
            }

            const step = tutorialConfig.steps[stepIndex];
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
                maxWidth: '350px',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                border: '1px solid #e5e7eb'
            });

            popup.innerHTML = `
                <h3 style="margin: 0 0 12px 0; font-size: 18px; color: #374151; font-weight: 600;">
                    ${step.title}
                </h3>
                <p style="margin: 0 0 20px 0; font-size: 14px; color: #6b7280; line-height: 1.5; white-space: pre-line;">
                    ${step.content}
                </p>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 12px; color: #9ca3af;">
                        ${stepIndex + 1} / ${tutorialConfig.steps.length}
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
                        ">${stepIndex === tutorialConfig.steps.length - 1 ? '完了' : '次へ'}</button>
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
            const popupRect = { width: 350, height: 200 }; // 推定サイズ

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
                if (stepIndex === tutorialConfig.steps.length - 1) {
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
        showDialog: showTutorialDialog,
        detectDevice: detectDevice
    };

})();