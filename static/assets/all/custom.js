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
            html2canvas(document.body).then(canvas => {
                const link = document.createElement('a');
                link.download = 'screenshot.png';
                link.href = canvas.toDataURL();
                link.click();
            });
        });

        document.body.appendChild(button);
    }, 1000); // 1秒後に実行
})();
