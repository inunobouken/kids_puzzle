(function() {
    window.Puzzle = window.Puzzle || {};

    /**
     * ゲームエンジンモジュール
     */
    window.Puzzle.Engine = {
        pieces: [],
        imageSrc: null,
        imgWidth: 0,
        imgHeight: 0,

        /**
         * パズルを初期化する
         */
        initPuzzle: async function(config) {
            const { imageSrc, rows, cols, puzzleBoard, puzzleFrame, clearMessage } = config;
            this.imageSrc = imageSrc;
            this.pieces = [];
            
            // Z-indexをリセット
            window.Puzzle.Events.currentMaxZIndex = 10;
            
            // 盤面のクリーンアップ
            window.Puzzle.UI.clearBoard(puzzleBoard, puzzleFrame);
            clearMessage.classList.add('hidden');

            // 画像の読み込み待ち
            const img = new Image();
            img.src = imageSrc;
            await img.decode();

            const boardRect = puzzleBoard.getBoundingClientRect();
            
            // レスポンシブなパディング計算
            const padding = Math.max(15, Math.min(40, boardRect.width * 0.05));
            const availableWidth = boardRect.width - padding * 2;
            const availableHeight = boardRect.height - padding * 2;
            const ratio = Math.min(availableWidth / img.width, availableHeight / img.height);
            
            this.imgWidth = img.width * ratio;
            this.imgHeight = img.height * ratio;

            // フレームサイズ設定
            puzzleFrame.style.width = `${this.imgWidth}px`;
            puzzleFrame.style.height = `${this.imgHeight}px`;

            // 幾何計算
            const vertices = window.Puzzle.Geometry.generateGridVertices(rows, cols, this.imgWidth, this.imgHeight);
            window.Puzzle.UI.drawGuideLines(puzzleFrame, vertices, rows, cols, this.imgWidth, this.imgHeight);

            const frameX = (boardRect.width - this.imgWidth) / 2;
            const frameY = (boardRect.height - this.imgHeight) / 2;

            // ピース生成ループ
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const geom = window.Puzzle.Geometry.computePieceGeometry(vertices, r, c);
                    const pieceEl = window.Puzzle.UI.createPieceElement(geom, this.imageSrc, this.imgWidth, this.imgHeight);
                    
                    const targetX = frameX + geom.bbox.x;
                    const targetY = frameY + geom.bbox.y;

                    // 初期配置（散らばり）の計算
                    const initPos = this.calculateInitialPosition(boardRect, frameX, frameY, geom.bbox);
                    pieceEl.style.left = `${initPos.x}px`;
                    pieceEl.style.top = `${initPos.y}px`;

                    const pieceObj = {
                        element: pieceEl,
                        targetX: targetX,
                        targetY: targetY,
                        bboxW: geom.bbox.w,
                        bboxH: geom.bbox.h,
                        isLocked: false
                    };

                    // イベント登録
                    window.Puzzle.Events.attachDragEvents(
                        pieceObj, 
                        puzzleBoard, 
                        (p) => this.lockPiece(p), 
                        () => this.checkClear(clearMessage)
                    );

                    puzzleBoard.appendChild(pieceEl);
                    this.pieces.push(pieceObj);
                }
            }
        },

        /**
         * ピースの初期配置位置を計算する
         */
        calculateInitialPosition: function(boardRect, frameX, frameY, bbox) {
            const side = Math.floor(Math.random() * 4);
            const scatterRange = Math.max(10, Math.min(40, boardRect.width * 0.04));
            const scatterOffset = Math.max(3, Math.min(5, boardRect.width * 0.01));

            let x, y;
            if (side === 0) { // 上
                x = frameX + Math.random() * this.imgWidth - bbox.w / 2;
                y = frameY - bbox.h - Math.random() * scatterRange - scatterOffset;
            } else if (side === 1) { // 下
                x = frameX + Math.random() * this.imgWidth - bbox.w / 2;
                y = frameY + this.imgHeight + Math.random() * scatterRange + scatterOffset;
            } else if (side === 2) { // 左
                x = frameX - bbox.w - Math.random() * scatterRange - scatterOffset;
                y = frameY + Math.random() * this.imgHeight - bbox.h / 2;
            } else { // 右
                x = frameX + this.imgWidth + Math.random() * scatterRange + scatterOffset;
                y = frameY + Math.random() * this.imgHeight - bbox.h / 2;
            }

            // ボード内に収める
            x = Math.max(0, Math.min(x, boardRect.width - bbox.w));
            y = Math.max(0, Math.min(y, boardRect.height - bbox.h));

            return { x, y };
        },

        /**
         * ピースを固定する
         */
        lockPiece: function(pieceObj) {
            pieceObj.isLocked = true;
            pieceObj.element.style.left = `${pieceObj.targetX}px`;
            pieceObj.element.style.top = `${pieceObj.targetY}px`;
            pieceObj.element.classList.remove('movable');
            pieceObj.element.classList.add('locked');
            
            const borderSvg = pieceObj.element.querySelector('.piece-border-svg');
            if (borderSvg) borderSvg.style.display = 'none';

            pieceObj.element.style.transform = 'scale(1)';
            pieceObj.element.style.zIndex = 1;
        },

        /**
         * クリア判定
         */
        checkClear: function(clearMessageElement) {
            const allLocked = this.pieces.every(p => p.isLocked);
            if (allLocked && this.pieces.length > 0) {
                setTimeout(() => {
                    clearMessageElement.classList.remove('hidden');
                }, 500);
            }
        }
    };
})();
