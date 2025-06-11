(function() {
    setTimeout(() => {
        const button = document.createElement('button');
        button.textContent = 'AIに聞く';
        Object.assign(button.style, {
            position: 'fixed',
            top: '10px',
            right: '10px',
            zIndex: 9999,
            padding: '10px 16px',
            backgroundColor: '#007BFF',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
        });

        button.addEventListener('click', () => {
            const winbox = new WinBox({
                title: "AI Panel",
                width: 400,
                height: 600,
                x: "right",
                y: "center"
            });

            // Create the chat UI dynamically
            const container = document.createElement('div');
            container.id = 'ai-chat-container';
            Object.assign(container.style, {
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white'
            });

            // Header
            const header = document.createElement('div');
            Object.assign(header.style, {
                padding: '16px 20px',
                background: 'rgba(255,255,255,0.1)',
                backdropFilter: 'blur(10px)',
                borderBottom: '1px solid rgba(255,255,255,0.2)'
            });

            const headerContent = document.createElement('div');
            Object.assign(headerContent.style, {
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
            });

            const avatar = document.createElement('div');
            Object.assign(avatar.style, {
                width: '40px',
                height: '40px',
                background: 'linear-gradient(45deg, #ff6b6b, #feca57)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '18px'
            });
            avatar.textContent = '🤖';

            const info = document.createElement('div');
            const name = document.createElement('div');
            Object.assign(name.style, {
                fontWeight: '600',
                fontSize: '16px'
            });
            name.textContent = 'AI Assistant';

            const status = document.createElement('div');
            Object.assign(status.style, {
                fontSize: '12px',
                opacity: '0.8'
            });
            status.textContent = 'オンライン';

            info.appendChild(name);
            info.appendChild(status);
            headerContent.appendChild(avatar);
            headerContent.appendChild(info);
            header.appendChild(headerContent);

            // Chat Messages
            const chatMessages = document.createElement('div');
            chatMessages.id = 'chat-messages';
            Object.assign(chatMessages.style, {
                flex: '1',
                padding: '20px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
            });

            const welcomeMsg = document.createElement('div');
            Object.assign(welcomeMsg.style, {
                background: 'rgba(255,255,255,0.15)',
                padding: '12px 16px',
                borderRadius: '18px 18px 18px 4px',
                backdropFilter: 'blur(10px)',
                maxWidth: '80%',
                alignSelf: 'flex-start'
            });
            welcomeMsg.textContent = 'こんにちは！何かお手伝いできることはありますか？';
            chatMessages.appendChild(welcomeMsg);

            // Input Area
            const inputArea = document.createElement('div');
            Object.assign(inputArea.style, {
                padding: '16px 20px',
                background: 'rgba(255,255,255,0.1)',
                backdropFilter: 'blur(10px)',
                borderTop: '1px solid rgba(255,255,255,0.2)'
            });

            const inputContainer = document.createElement('div');
            Object.assign(inputContainer.style, {
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-end'
            });

            const chatInput = document.createElement('textarea');
            chatInput.id = 'chat-input';
            chatInput.placeholder = 'メッセージを入力...';
            Object.assign(chatInput.style, {
                flex: '1',
                background: 'rgba(255,255,255,0.9)',
                border: 'none',
                borderRadius: '20px',
                padding: '12px 16px',
                resize: 'none',
                maxHeight: '120px',
                fontFamily: 'inherit',
                fontSize: '14px',
                color: '#333',
                outline: 'none'
            });

            const sendBtn = document.createElement('button');
            sendBtn.id = 'send-btn';
            sendBtn.textContent = '➤';
            Object.assign(sendBtn.style, {
                background: 'linear-gradient(45deg, #ff6b6b, #feca57)',
                border: 'none',
                borderRadius: '50%',
                width: '44px',
                height: '44px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                transition: 'transform 0.2s ease'
            });

            sendBtn.addEventListener('mouseover', () => {
                sendBtn.style.transform = 'scale(1.1)';
            });
            sendBtn.addEventListener('mouseout', () => {
                sendBtn.style.transform = 'scale(1)';
            });

            inputContainer.appendChild(chatInput);
            inputContainer.appendChild(sendBtn);
            inputArea.appendChild(inputContainer);

            // Assemble the UI
            container.appendChild(header);
            container.appendChild(chatMessages);
            container.appendChild(inputArea);

            // Set the content to WinBox
            winbox.body.appendChild(container);

            // Add functionality
            chatInput.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = Math.min(this.scrollHeight, 120) + 'px';
            });

            function sendMessage() {
                const message = chatInput.value.trim();
                if (!message) return;

                // Add user message
                const userMsg = document.createElement('div');
                Object.assign(userMsg.style, {
                    background: 'rgba(255,255,255,0.9)',
                    color: '#333',
                    padding: '12px 16px',
                    borderRadius: '18px 18px 4px 18px',
                    maxWidth: '80%',
                    alignSelf: 'flex-end',
                    wordWrap: 'break-word'
                });
                userMsg.textContent = message;
                chatMessages.appendChild(userMsg);

                // Clear input
                chatInput.value = '';
                chatInput.style.height = 'auto';

                // Scroll to bottom
                chatMessages.scrollTop = chatMessages.scrollHeight;

                // Simulate AI response
                setTimeout(() => {
                    const aiMsg = document.createElement('div');
                    Object.assign(aiMsg.style, {
                        background: 'rgba(255,255,255,0.15)',
                        padding: '12px 16px',
                        borderRadius: '18px 18px 18px 4px',
                        backdropFilter: 'blur(10px)',
                        maxWidth: '80%',
                        alignSelf: 'flex-start',
                        wordWrap: 'break-word'
                    });
                    
                    const responses = [
                        '興味深い質問ですね！詳しく教えてください。',
                        'それについて考えてみますね。どのような背景がありますか？',
                        'なるほど、理解できます。他に何か聞きたいことはありますか？',
                        'そのトピックについて詳しく説明させていただきますね。',
                        'とても良い質問です！一緒に考えてみましょう。'
                    ];
                    
                    aiMsg.textContent = responses[Math.floor(Math.random() * responses.length)];
                    chatMessages.appendChild(aiMsg);
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }, 1000);
            }

            sendBtn.addEventListener('click', sendMessage);

            chatInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            });

            // Focus input on window open
            setTimeout(() => chatInput.focus(), 100);
        });

        document.body.appendChild(button);
    }, 1000); // 1秒後に実行
})();

// Right-click Paint Functionality
(function() {
    let isPainting = false;
    let isRightClickMode = false;
    let canvas = null;
    let ctx = null;
    let lastX = 0;
    let lastY = 0;
    let paintColor = '#ff0000';
    let brushSize = 5;

    // Create paint canvas
    function createPaintCanvas() {
        if (canvas) return canvas;

        canvas = document.createElement('canvas');
        canvas.id = 'right-click-paint-canvas';
        Object.assign(canvas.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100vw',
            height: '100vh',
            zIndex: '99999',
            pointerEvents: 'none',
            background: 'transparent'
        });

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        ctx = canvas.getContext('2d');
        ctx.strokeStyle = paintColor;
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        document.body.appendChild(canvas);
        return canvas;
    }

    // Remove paint canvas
    function removePaintCanvas() {
        if (canvas) {
            canvas.remove();
            canvas = null;
            ctx = null;
        }
    }

    // Draw on canvas
    function draw(e) {
        if (!isPainting || !ctx) return;

        ctx.globalCompositeOperation = 'source-over';
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(e.clientX, e.clientY);
        ctx.stroke();

        lastX = e.clientX;
        lastY = e.clientY;
    }

    // Start painting
    function startPaint(e) {
        if (!isRightClickMode) return;
        
        isPainting = true;
        lastX = e.clientX;
        lastY = e.clientY;
        
        // Enable pointer events on canvas during painting
        if (canvas) {
            canvas.style.pointerEvents = 'auto';
        }
    }

    // Stop painting
    function stopPaint() {
        if (!isPainting) return;
        isPainting = false;
        
        // Disable pointer events on canvas after painting
        if (canvas) {
            canvas.style.pointerEvents = 'none';
        }
    }

    // Create control panel
    function createControlPanel() {
        const panel = document.createElement('div');
        panel.id = 'paint-control-panel';
        Object.assign(panel.style, {
            position: 'fixed',
            top: '60px',
            right: '10px',
            zIndex: '100000',
            background: 'rgba(0,0,0,0.8)',
            color: 'white',
            padding: '15px',
            borderRadius: '8px',
            fontFamily: 'Arial, sans-serif',
            fontSize: '12px',
            minWidth: '200px',
            display: 'none'
        });

        panel.innerHTML = `
            <div style="margin-bottom: 10px; font-weight: bold;">🎨 ペイントモード</div>
            <div style="margin-bottom: 8px;">
                <label>色: </label>
                <input type="color" id="paint-color-picker" value="${paintColor}" style="width: 40px; height: 25px; border: none; border-radius: 3px;">
            </div>
            <div style="margin-bottom: 8px;">
                <label>ブラシサイズ: </label>
                <input type="range" id="brush-size-slider" min="1" max="20" value="${brushSize}" style="width: 100px;">
                <span id="brush-size-display">${brushSize}px</span>
            </div>
            <div style="margin-bottom: 8px;">
                <button id="clear-canvas-btn" style="background: #ff4444; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; margin-right: 5px;">クリア</button>
                <button id="save-canvas-btn" style="background: #4444ff; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">保存</button>
            </div>
            <div style="font-size: 10px; opacity: 0.7;">
                右クリック長押しでペイントモード切替<br>
                Escキーで終了
            </div>
        `;

        document.body.appendChild(panel);

        // Color picker event
        const colorPicker = panel.querySelector('#paint-color-picker');
        colorPicker.addEventListener('input', (e) => {
            paintColor = e.target.value;
            if (ctx) {
                ctx.strokeStyle = paintColor;
            }
        });

        // Brush size slider event
        const brushSlider = panel.querySelector('#brush-size-slider');
        const brushDisplay = panel.querySelector('#brush-size-display');
        brushSlider.addEventListener('input', (e) => {
            brushSize = parseInt(e.target.value);
            brushDisplay.textContent = brushSize + 'px';
            if (ctx) {
                ctx.lineWidth = brushSize;
            }
        });

        // Clear canvas button
        const clearBtn = panel.querySelector('#clear-canvas-btn');
        clearBtn.addEventListener('click', () => {
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        });

        // Save canvas button
        const saveBtn = panel.querySelector('#save-canvas-btn');
        saveBtn.addEventListener('click', () => {
            if (canvas) {
                const link = document.createElement('a');
                link.download = 'paint_' + new Date().getTime() + '.png';
                link.href = canvas.toDataURL();
                link.click();
            }
        });

        return panel;
    }

    // Toggle paint mode
    function togglePaintMode() {
        isRightClickMode = !isRightClickMode;
        const panel = document.getElementById('paint-control-panel');
        
        if (isRightClickMode) {
            createPaintCanvas();
            panel.style.display = 'block';
            document.body.style.cursor = 'crosshair';
            
            // Show notification
            showNotification('🎨 ペイントモード ON - 右クリック+ドラッグで描画');
        } else {
            stopPaint();
            if (panel) panel.style.display = 'none';
            document.body.style.cursor = 'default';
            
            // Show notification
            showNotification('ペイントモード OFF');
        }
    }

    // Show notification
    function showNotification(message) {
        const notification = document.createElement('div');
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.8)',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '20px',
            fontSize: '14px',
            zIndex: '100001',
            transition: 'opacity 0.3s ease'
        });
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }

    // Event listeners
    let rightClickTimer = null;

    document.addEventListener('contextmenu', (e) => {
        if (isRightClickMode) {
            e.preventDefault();
            return false;
        }
    });

    document.addEventListener('mousedown', (e) => {
        if (e.button === 2) { // Right click
            if (isRightClickMode) {
                e.preventDefault();
                startPaint(e);
            } else {
                // Long press detection for mode toggle
                rightClickTimer = setTimeout(() => {
                    e.preventDefault();
                    togglePaintMode();
                }, 500);
            }
        }
    });

    document.addEventListener('mouseup', (e) => {
        if (e.button === 2) { // Right click
            if (rightClickTimer) {
                clearTimeout(rightClickTimer);
                rightClickTimer = null;
            }
            if (isRightClickMode) {
                e.preventDefault();
                stopPaint();
            }
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (isRightClickMode) {
            draw(e);
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isRightClickMode) {
            togglePaintMode();
        }
    });

    // Window resize handler
    window.addEventListener('resize', () => {
        if (canvas) {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            if (ctx) {
                ctx.strokeStyle = paintColor;
                ctx.lineWidth = brushSize;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
            }
        }
    });

    // Initialize control panel
    setTimeout(() => {
        createControlPanel();
    }, 1500);

})();
