/**
 * 音声認識とテキスト読み上げ機能を提供するクラス
 */
class SpeechService {
    constructor() {
        this.ws = null;
        this.mediaRecorder = null;
        this.stream = null;
        this.isRecording = false;
        this.onTranscriptCallback = null;
        this.onErrorCallback = null;
        this.onStatusCallback = null;
    }

    /**
     * 音声認識を開始
     * @param {Function} onTranscript - 認識結果を受け取るコールバック
     * @param {Function} onError - エラーを受け取るコールバック  
     * @param {Function} onStatus - ステータス変更を受け取るコールバック
     */
    async startRecording(onTranscript, onError, onStatus) {
        try {
            this.onTranscriptCallback = onTranscript;
            this.onErrorCallback = onError;
            this.onStatusCallback = onStatus;

            // WebSocket接続を確立
            const wsUrl = `ws://${window.location.host}/ws/speech`;
            console.log(`WebSocket接続試行: ${wsUrl}`);
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = async () => {
                console.log('WebSocket接続成功');
                this.updateStatus('WebSocket接続が確立されました');
                
                try {
                    // マイクアクセスを取得
                    this.stream = await navigator.mediaDevices.getUserMedia({ 
                        audio: {
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true,
                            sampleRate: 16000
                        } 
                    });
                    
                    // MediaRecorderを設定
                    const options = { mimeType: 'audio/webm;codecs=opus' };
                    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                        options.mimeType = 'audio/webm';
                    }
                    
                    this.mediaRecorder = new MediaRecorder(this.stream, options);
                    
                    this.mediaRecorder.ondataavailable = (event) => {
                        if (event.data.size > 0 && this.ws.readyState === WebSocket.OPEN) {
                            console.log(`音声データ送信: ${event.data.size} bytes`);
                            this.ws.send(event.data);
                        }
                    };
                    
                    this.mediaRecorder.onstart = () => {
                        console.log('MediaRecorder開始');
                        this.updateStatus('録音開始');
                    };
                    
                    this.mediaRecorder.onstop = () => {
                        console.log('MediaRecorder停止');
                        this.updateStatus('録音停止');
                    };
                    
                    this.mediaRecorder.onerror = (event) => {
                        console.error('MediaRecorderエラー:', event.error);
                        this.handleError('録音エラー: ' + event.error.message);
                    };
                    
                    this.mediaRecorder.start(2000); // 2秒ごとにデータを送信（より大きなチャンクで送信）
                    this.isRecording = true;
                    this.updateStatus('録音中...');
                    
                } catch (mediaError) {
                    this.handleError('マイクへのアクセスに失敗しました: ' + mediaError.message);
                }
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.error) {
                        this.handleError(data.error);
                    } else if (data.text || data.transcript) {
                        // 認識結果をコールバックに渡す
                        const transcript = data.text || data.transcript;
                        if (this.onTranscriptCallback && transcript && transcript.trim()) {
                            this.onTranscriptCallback(transcript.trim());
                        }
                    }
                } catch (e) {
                    // JSONでない場合は直接テキストとして処理
                    if (this.onTranscriptCallback && event.data && event.data.trim()) {
                        this.onTranscriptCallback(event.data.trim());
                    }
                }
            };
            
            this.ws.onclose = () => {
                this.updateStatus('WebSocket接続が閉じられました');
                this.stopRecording();
            };
            
            this.ws.onerror = (error) => {
                this.handleError('WebSocket接続エラー: ' + error.message);
            };
            
        } catch (error) {
            this.handleError('音声認識の開始に失敗しました: ' + error.message);
        }
    }

    /**
     * 音声認識を停止
     */
    stopRecording() {
        this.isRecording = false;
        
        if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
            this.mediaRecorder.stop();
        }
        
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.close();
        }
        
        this.updateStatus('録音を停止しました');
    }

    /**
     * テキストを音声に変換して再生
     * @param {string} text - 読み上げるテキスト
     * @returns {Promise<void>}
     */
    async textToSpeech(text) {
        try {
            this.updateStatus('音声を生成中...');
            
            const response = await fetch('/api/text-to-speech', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            
            audio.onloadeddata = () => {
                this.updateStatus('音声を再生中...');
            };
            
            audio.onended = () => {
                URL.revokeObjectURL(audioUrl);
                this.updateStatus('音声再生が完了しました');
            };
            
            audio.onerror = () => {
                URL.revokeObjectURL(audioUrl);
                this.handleError('音声の再生に失敗しました');
            };

            await audio.play();
            
        } catch (error) {
            this.handleError('テキスト読み上げに失敗しました: ' + error.message);
        }
    }

    /**
     * 音声ファイルから文字起こし（ファイルアップロード用）
     * @param {File} audioFile - 音声ファイル
     * @returns {Promise<string>} 認識結果
     */
    async transcribeAudioFile(audioFile) {
        try {
            this.updateStatus('音声ファイルを処理中...');
            
            const formData = new FormData();
            formData.append('audio', audioFile);

            const response = await fetch('/api/speech-to-text', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            this.updateStatus('音声ファイルの処理が完了しました');
            
            return result.text || '';
            
        } catch (error) {
            this.handleError('音声ファイルの処理に失敗しました: ' + error.message);
            return '';
        }
    }

    /**
     * エラーハンドリング
     * @private
     */
    handleError(message) {
        console.error('SpeechService Error:', message);
        if (this.onErrorCallback) {
            this.onErrorCallback(message);
        }
        this.stopRecording();
    }

    /**
     * ステータス更新
     * @private
     */
    updateStatus(message) {
        console.log('SpeechService Status:', message);
        if (this.onStatusCallback) {
            this.onStatusCallback(message);
        }
    }

    /**
     * 録音状態を取得
     * @returns {boolean}
     */
    getRecordingState() {
        return this.isRecording;
    }

    /**
     * ブラウザが音声認識をサポートしているかチェック
     * @returns {boolean}
     */
    static isSupported() {
        return !!(navigator.mediaDevices && 
                 navigator.mediaDevices.getUserMedia && 
                 window.WebSocket && 
                 window.MediaRecorder);
    }

    /**
     * マイクアクセス許可をチェック
     * @returns {Promise<boolean>}
     */
    static async checkMicrophonePermission() {
        try {
            const result = await navigator.permissions.query({ name: 'microphone' });
            return result.state === 'granted';
        } catch (error) {
            // permissions APIがサポートされていない場合
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach(track => track.stop());
                return true;
            } catch (e) {
                return false;
            }
        }
    }
}

// グローバルに公開
window.SpeechService = SpeechService;