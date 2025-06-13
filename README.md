# AIBrowser - AI統合型ブラウザプロキシ

![Version](https://img.shields.io/badge/version-5.2.5-blue.svg)
![Node.js](https://img.shields.io/badge/node.js-16%2B-green.svg)
![License](https://img.shields.io/badge/license-GPL--3.0-red.svg)

AIBrowserは、Google Gemini AIを統合した次世代ブラウザプロキシです。画面上で範囲を囲んで検索したり、AIに質問したりできる革新的な機能を提供します。

## 🌟 主な機能

### 🤖 AI画像解析
- **Gemini 2.0 Flash**を使用した高精度な画像解析
- スクリーンショットの自動解析
- 数学問題の解説とステップバイステップの解答
- LaTeX数式レンダリング対応

### 🖼️ インタラクティブなマーキング機能
- 画面上で右クリックして範囲を囲む
- 囲んだ範囲を自動でAIに送信・解析
- リアルタイムでの範囲検出

### 💬 リアルタイムAIチャット
- ストリーミング形式でのAI応答
- 会話履歴の保持（24時間）
- 画像アップロード対応
- Markdown形式での回答表示

### 🌐 高性能ウェブプロキシ
- Bare Serverを使用した安全なプロキシ機能
- 複数のアセットソース対応
- キャッシュ機能付き（30日間）

### 📊 数学式レンダリング
- MathJax統合によるLaTeX数式表示
- インライン数式とディスプレイ数式両対応
- リアルタイムレンダリング

## 🚀 インストール

### 前提条件
- Node.js 16.0.0以上
- npm 7.0.0以上
- Google Gemini APIキー

### インストール手順

1. **リポジトリのクローン**
```bash
git clone https://github.com/your-username/AIBrowser.git
cd AIBrowser
```

2. **依存関係のインストール**
```bash
# npmを使用する場合
npm install

# pnpmを使用する場合（推奨）
pnpm install
```

3. **環境変数の設定**
```bash
# .envファイルを作成
cp .env.example .env
```

`.env`ファイルに以下を設定：
```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=8080
```

4. **サーバーの起動**
```bash
# 本番環境
npm start

# 開発環境（ホットリロード）
npm run dev
```

## ⚙️ 設定

### config.js設定オプション

```javascript
const config = {
  // パスワード保護の有効/無効
  challenge: false, // trueに設定すると認証が必要
  
  // ユーザー認証情報
  users: {
    username: "password"
  },
  
  // Gemini APIキー
  geminiApiKey: process.env.GEMINI_API_KEY || "YOUR_GEMINI_API_KEY_HERE"
};
```

### パスワード保護の有効化

セキュリティを強化したい場合：

1. `config.js`で`challenge: true`に設定
2. `users`オブジェクトにユーザー名とパスワードを追加
3. サーバーを再起動

## 📖 使用方法

### 基本的なブラウジング

1. ブラウザで`http://localhost:8080`にアクセス
2. URL入力欄にアクセスしたいウェブサイトのURLを入力
3. 「移動」ボタンをクリック

### AI機能の使用

#### 画面マーキング機能
1. ウェブページを表示
2. 解析したい部分で**右クリック**してドラッグ
3. 範囲を囲んで閉じた図形を作成
4. 確認ダイアログで「はい」をクリック
5. AIが自動で範囲を解析し、説明を提供

#### AIチャット機能
1. 「AI質問」ボタンをクリック
2. チャット窓が開く
3. テキストで質問するか、画像をアップロード
4. リアルタイムでAIの回答を確認

#### スクリーンキャプチャ
1. AIチャット内の📷ボタンをクリック
2. 画面共有を許可
3. メッセージ送信時に現在の画面も自動送信

## 🔧 API仕様

### POST /api/aireq
画像解析API

**パラメータ:**
- `image`: 画像ファイル（multipart/form-data）
- `prompt`: 分析のプロンプト（オプション）
- `sessionId`: セッションID（オプション）

**レスポンス:**
- ストリーミング形式のJSON
- `type: 'content'`: コンテンツデータ
- `type: 'sessionId'`: セッションID
- `type: 'end'`: ストリーム終了

### POST /api/text
テキスト質問API

**パラメータ:**
```json
{
  "message": "質問内容",
  "sessionId": "セッションID（オプション）"
}
```

**レスポンス:**
- ストリーミング形式のJSON応答

## 🏗️ 技術仕様

### アーキテクチャ

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   フロントエンド   │ ←→ │   Express.js    │ ←→ │   Gemini API    │
│   (Vanilla JS)   │    │     サーバー      │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         ↕                       ↕
┌─────────────────┐    ┌─────────────────┐
│   Bare Server   │    │   Static Files  │
│    (プロキシ)     │    │   (HTML/CSS)    │
└─────────────────┘    └─────────────────┘
```

### 使用技術

**バックエンド:**
- Node.js & Express.js
- Google Generative AI SDK
- Bare Server Node
- Multer（ファイルアップロード）
- Cookie Parser, CORS

**フロントエンド:**
- HTML5, CSS3, Vanilla JavaScript
- MathJax（数式レンダリング）
- Marked（Markdownパーサー）
- DOMPurify（XSS防止）
- WinBox（ウィンドウ管理）
- Dom-to-Image（画面キャプチャ）

### パフォーマンス特性

- **キャッシュ**: 30日間のアセットキャッシュ
- **セッション管理**: 24時間の会話履歴保持
- **メモリ効率**: ストリーミングレスポンスによる低メモリ使用
- **セキュリティ**: DOMPurifyによるXSS防止

## 🎯 使用シナリオ

### 学習・教育
- 数学問題のステップバイステップ解説
- 画像内のテキストや図表の解析
- リアルタイムでの学習サポート

### 研究・分析  
- ウェブページの特定部分の詳細分析
- 画像データの自動解析
- 多言語コンテンツの理解

### 開発・デバッグ
- エラーメッセージの解析
- コードスニペットの説明
- UI/UXの改善提案

## 🚨 注意事項

1. **APIキー**: Gemini APIキーは適切に管理してください
2. **リソース**: 画像解析は計算リソースを消費します
3. **プライバシー**: アップロード画像は適切に処理されます
4. **レート制限**: Gemini APIのレート制限にご注意ください

## 🛠️ 開発者向け情報

### 開発コマンド

```bash
# コードフォーマット
npm run format

# リンティング
npm run lint

# プリコミットチェック
npm run precommit
```

### ファイル構造

```
AIBrowser/
├── index.js              # メインサーバーファイル
├── config.js             # 設定ファイル
├── package.json          # プロジェクト設定
├── static/               # 静的ファイル
│   ├── index.html        # メインHTML
│   ├── assets/
│   │   ├── css/          # スタイルシート
│   │   ├── js/           # JavaScript
│   │   └── mathematics/  # 数学関連
│   └── manifest.json     # PWA設定
└── README.md            # このファイル
```

## 📝 ライセンス

このプロジェクトはGPL-3.0ライセンスの下で公開されています。

## 🙏 クレジット

- **開発者**: AIBrowserNetwork
- **AI**: Google Gemini 2.0 Flash
- **プロキシ**: Nebula Services Bare Server
- **UI**: WinBox by nextapps-de

## 🆘 サポート

問題が発生した場合や質問がある場合は、以下の方法でサポートを受けられます：

1. **Issues**: GitHub Issuesで問題を報告
2. **Documentation**: このREADMEファイルを参照
3. **Community**: プロジェクトコミュニティに参加

---

**AIBrowser**で、AI統合型ブラウジングエクスペリエンスをお楽しみください！ 🚀✨