document.addEventListener('DOMContentLoaded', () => {
    const imageUpload = document.getElementById('image-upload');
    const startBtn = document.getElementById('start-btn');
    const puzzleContainer = document.getElementById('puzzle-container');
    const rowsInput = document.getElementById('rows');
    const colsInput = document.getElementById('cols');
    const clearMessage = document.getElementById('clear-message');
    const restartBtn = document.getElementById('restart-btn');

    const referenceImage = document.getElementById('reference-image');
    const referencePlaceholder = document.getElementById('reference-placeholder');
    const puzzleBoard = document.getElementById('puzzle-board');
    const puzzleFrame = document.getElementById('puzzle-frame');

    let pieces = [];
    let imageSrc = null;
    let imgWidth, imgHeight;
    let pieceWidth, pieceHeight;
    let isDragging = false;
    let activePiece = null;
    let offset = { x: 0, y: 0 };
    let currentMaxZIndex = 10; // Z-Indexの管理用

    // 画像が選択された時の処理
    imageUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                imageSrc = event.target.result;
                // お手本を表示
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
        initPuzzle();
    });

    // リスタートボタン
    restartBtn.addEventListener('click', () => {
        clearMessage.classList.add('hidden');
        // お手本は残し、ピースだけ消去
        const existingPieces = puzzleBoard.querySelectorAll('.puzzle-piece');
        existingPieces.forEach(p => p.remove());
        puzzleFrame.style.width = '0';
        puzzleFrame.style.height = '0';
    });

    async function initPuzzle() {
        // 既存のピースを削除
        const existingPieces = puzzleBoard.querySelectorAll('.puzzle-piece');
        existingPieces.forEach(p => p.remove());
        pieces = [];

        const img = new Image();
        img.src = imageSrc;
        await img.decode();

        const rows = parseInt(rowsInput.value);
        const cols = parseInt(colsInput.value);

        // ボードのサイズに合わせて画像をフィットさせる（比率維持）
        const boardRect = puzzleBoard.getBoundingClientRect();
        const padding = 40; // 枠外に置くための余白
        const availableWidth = boardRect.width - padding * 2;
        const availableHeight = boardRect.height - padding * 2;

        const ratio = Math.min(availableWidth / img.width, availableHeight / img.height);
        
        imgWidth = img.width * ratio;
        imgHeight = img.height * ratio;
        pieceWidth = imgWidth / cols;
        pieceHeight = imgHeight / rows;

        // 正解エリア（グレー背景）のサイズを設定
        puzzleFrame.style.width = `${imgWidth}px`;
        puzzleFrame.style.height = `${imgHeight}px`;

        // パズルボード内でのフレームの位置（中央寄せ）
        const frameX = (boardRect.width - imgWidth) / 2;
        const frameY = (boardRect.height - imgHeight) / 2;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const piece = document.createElement('div');
                piece.className = 'puzzle-piece movable';
                piece.style.width = `${pieceWidth}px`;
                piece.style.height = `${pieceHeight}px`;
                piece.style.backgroundImage = `url(${imageSrc})`;
                piece.style.backgroundSize = `${imgWidth}px ${imgHeight}px`;
                piece.style.backgroundPosition = `-${c * pieceWidth}px -${r * pieceHeight}px`;
                piece.style.borderRadius = '5px';

                // 正解の位置（パズルボード内の相対座標）
                const targetX = frameX + (c * pieceWidth);
                const targetY = frameY + (r * pieceHeight);

                // 初期配置：パズルフレーム（グレー部分）の外側に配置
                let initX, initY;
                let isInside = true;
                
                // フレームの外側になるまでランダム配置を試行（簡易的）
                let attempts = 0;
                while (isInside && attempts < 100) {
                    initX = Math.random() * (boardRect.width - pieceWidth);
                    initY = Math.random() * (boardRect.height - pieceHeight);
                    
                    // フレームの範囲内かチェック
                    const inFrameX = initX + pieceWidth > frameX && initX < frameX + imgWidth;
                    const inFrameY = initY + pieceHeight > frameY && initY < frameY + imgHeight;
                    
                    if (!(inFrameX && inFrameY)) {
                        isInside = false;
                    }
                    attempts++;
                }

                piece.style.left = `${initX}px`;
                piece.style.top = `${initY}px`;

                const pieceObj = {
                    element: piece,
                    targetX: targetX,
                    targetY: targetY,
                    isLocked: false
                };

                piece.addEventListener('pointerdown', (e) => onPointerDown(e, pieceObj));
                puzzleBoard.appendChild(piece);
                pieces.push(pieceObj);
            }
        }
    }

    function onPointerDown(e, pieceObj) {
        if (pieceObj.isLocked) return;

        isDragging = true;
        activePiece = pieceObj;
        activePiece.element.setPointerCapture(e.pointerId);
        
        const rect = activePiece.element.getBoundingClientRect();
        offset.x = e.clientX - rect.left;
        offset.y = e.clientY - rect.top;

        // 最後に触ったピースを最前面にする
        currentMaxZIndex++;
        activePiece.element.style.zIndex = currentMaxZIndex;
        
        activePiece.element.addEventListener('pointermove', onPointerMove);
        activePiece.element.addEventListener('pointerup', onPointerUp);
    }

    function onPointerMove(e) {
        if (!isDragging || !activePiece) return;

        const boardRect = puzzleBoard.getBoundingClientRect();
        let x = e.clientX - boardRect.left - offset.x;
        let y = e.clientY - boardRect.top - offset.y;

        // ボード外に出ないように制限
        x = Math.max(-pieceWidth/2, Math.min(x, boardRect.width - pieceWidth/2));
        y = Math.max(-pieceHeight/2, Math.min(y, boardRect.height - pieceHeight/2));

        activePiece.element.style.left = `${x}px`;
        activePiece.element.style.top = `${y}px`;
    }

    function onPointerUp(e) {
        if (!isDragging || !activePiece) return;

        const currentX = parseFloat(activePiece.element.style.left);
        const currentY = parseFloat(activePiece.element.style.top);

        const dist = Math.sqrt(
            Math.pow(currentX - activePiece.targetX, 2) + 
            Math.pow(currentY - activePiece.targetY, 2)
        );

        const threshold = Math.min(pieceWidth, pieceHeight) * 0.3; // スナップ判定を少し緩めに

        if (dist < threshold) {
            lockPiece(activePiece);
        }

        activePiece.element.releasePointerCapture(e.pointerId);
        activePiece.element.removeEventListener('pointermove', onPointerMove);
        activePiece.element.removeEventListener('pointerup', onPointerUp);
        
        isDragging = false;
        activePiece = null;

        checkClear();
    }

    function lockPiece(pieceObj) {
        pieceObj.isLocked = true;
        pieceObj.element.style.left = `${pieceObj.targetX}px`;
        pieceObj.element.style.top = `${pieceObj.targetY}px`;
        pieceObj.element.classList.remove('movable');
        pieceObj.element.classList.add('locked');
        
        // 固定された時のプチ演出
        pieceObj.element.style.transform = 'scale(1)';
        pieceObj.element.style.zIndex = 1;
    }

    function checkClear() {
        const allLocked = pieces.every(p => p.isLocked);
        if (allLocked && pieces.length > 0) {
            setTimeout(() => {
                clearMessage.classList.remove('hidden');
            }, 500);
        }
    }
});
