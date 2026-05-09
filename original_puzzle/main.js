document.addEventListener('DOMContentLoaded', () => {
    // DOM要素の取得
    const imageUpload = document.getElementById('image-upload');
    const startBtn = document.getElementById('start-btn');
    const rowsInput = document.getElementById('rows');
    const colsInput = document.getElementById('cols');
    const puzzleBoard = document.getElementById('puzzle-board');
    const puzzleFrame = document.getElementById('puzzle-frame');
    const referenceImage = document.getElementById('reference-image');
    const referencePlaceholder = document.getElementById('reference-placeholder');
    const clearMessage = document.getElementById('clear-message');
    const restartBtn = document.getElementById('restart-btn');

    const controls = document.querySelector('.controls');

    let imageSrc = null;

    // 画像選択時の処理
    imageUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                imageSrc = event.target.result;
                // お手本の表示更新
                referenceImage.src = imageSrc;
                referenceImage.classList.remove('hidden');
                referencePlaceholder.classList.add('hidden');
            };
            reader.readAsDataURL(file);
        }
    });

    // スタートボタン
    startBtn.addEventListener('click', () => {
        if (!imageSrc) {
            alert('しゃしんをえらんでね！');
            return;
        }

        const rows = parseInt(rowsInput.value);
        const cols = parseInt(colsInput.value);

        // 設定パネルを隠す
        controls.classList.add('hidden');

        // エンジンを起動
        window.Puzzle.Engine.initPuzzle({
            imageSrc,
            rows,
            cols,
            puzzleBoard,
            puzzleFrame,
            clearMessage
        });
    });

    // リスタート（もういっかい）ボタン
    restartBtn.addEventListener('click', () => {
        clearMessage.classList.add('hidden');
        
        // 設定パネルを再表示
        controls.classList.remove('hidden');

        // ボードとエンジンの状態をクリア
        window.Puzzle.Engine.reset();
        window.Puzzle.UI.clearBoard(puzzleBoard, puzzleFrame);
    });
});
