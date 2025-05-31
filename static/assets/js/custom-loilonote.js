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
            console.log("要素を削除しました。");
        } else if (Date.now() - start > timeout) {
            clearInterval(timer);
            console.warn("タイムアウト：要素が見つかりませんでした。");
        }
    }, interval);
})();