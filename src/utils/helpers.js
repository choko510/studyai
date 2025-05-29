// ヘルパー関数
const crypto = require('crypto');

/**
 * 文字列をハッシュ化
 * @param {string} input - ハッシュ化する文字列
 * @param {string} algorithm - ハッシュアルゴリズム（デフォルト: sha256）
 * @returns {string} ハッシュ値
 */
function hash(input, algorithm = 'sha256') {
    return crypto.createHash(algorithm).update(input).digest('hex');
}

/**
 * ランダムな文字列を生成
 * @param {number} length - 文字列の長さ
 * @returns {string} ランダム文字列
 */
function generateRandomString(length = 16) {
    return crypto.randomBytes(length).toString('hex').slice(0, length);
}

/**
 * URLを検証
 * @param {string} url - 検証するURL
 * @returns {boolean} 有効なURLかどうか
 */
function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

/**
 * IPアドレスがプライベート範囲かチェック
 * @param {string} ip - IPアドレス
 * @returns {boolean} プライベートIPかどうか
 */
function isPrivateIP(ip) {
    const privateRanges = [
        /^127\./,
        /^10\./,
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
        /^192\.168\./,
        /^169\.254\./,
        /^::1$/,
        /^fe80:/
    ];
    
    return privateRanges.some(range => range.test(ip));
}

/**
 * バイト数を人間が読みやすい形式に変換
 * @param {number} bytes - バイト数
 * @returns {string} フォーマットされた文字列
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 時間をフォーマット
 * @param {number} seconds - 秒数
 * @returns {string} フォーマットされた時間
 */
function formatDuration(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (days > 0) {
        return `${days}日 ${hours}時間`;
    } else if (hours > 0) {
        return `${hours}時間 ${minutes}分`;
    } else if (minutes > 0) {
        return `${minutes}分 ${secs}秒`;
    } else {
        return `${secs}秒`;
    }
}

/**
 * オブジェクトを安全にJSONに変換
 * @param {any} obj - 変換するオブジェクト
 * @returns {string} JSON文字列
 */
function safeStringify(obj) {
    try {
        return JSON.stringify(obj, null, 2);
    } catch (error) {
        return '[JSON変換エラー]';
    }
}

module.exports = {
    hash,
    generateRandomString,
    isValidUrl,
    isPrivateIP,
    formatBytes,
    formatDuration,
    safeStringify
};