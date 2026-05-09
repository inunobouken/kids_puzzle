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
        rows: 0,
        cols: 0,
        vertices: [],
        baseBoardSize: { w: 0, h: 0 },
        config: null,

        /**
         * パズルを初期化する
         */
        initPuzzle: async function(config) {
            const { imageSrc, rows, cols, puzzleBoard, puzzleFrame, clearMessage } = config;
            this.imageSrc = imageSrc;
            this.pieces = [];
            this.config = config;
            this.rows = rows;
            this.cols = cols;
            
            // 盤面のクリーンアップ
            window.Puzzle.UI.clearBoard(puzzleBoard, puzzleFrame);
            clearMessage.classList.add('hidden');

            // 画像の読み込み待ち
            const img = new Image();
            img.src = imageSrc;
            await img.decode();

            this.setupResizeHandler();
            this.renderPuzzle(img);
        },

        /**
         * パズルの描画（初回およびリサイズ時に使用）
         */
        renderPuzzle: function(img) {
            const { rows, cols, puzzleBoard, puzzleFrame } = this.config;
            const boardRect = puzzleBoard.getBoundingClientRect();
            this.baseBoardSize = { w: boardRect.width, h: boardRect.height };
            
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
            this.vertices = window.Puzzle.Geometry.generateGridVertices(rows, cols, this.imgWidth, this.imgHeight);
            window.Puzzle.UI.drawGuideLines(puzzleFrame, this.vertices, rows, cols, this.imgWidth, this.imgHeight);

            const frameX = (boardRect.width - this.imgWidth) / 2;
            const frameY = (boardRect.height - this.imgHeight) / 2;

            // ピース生成ループ
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const geom = window.Puzzle.Geometry.computePieceGeometry(this.vertices, r, c);
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
                        relX: initPos.x / boardRect.width,
                        relY: initPos.y / boardRect.height,
                        centerOffsetX: geom.center.x - geom.bbox.x,
                        centerOffsetY: geom.center.y - geom.bbox.y,
                        r: r,
                        c: c,
                        isLocked: false
                    };

                    // イベント登録
                    window.Puzzle.Events.attachDragEvents(
                        pieceObj, 
                        puzzleBoard, 
                        (p) => this.lockPiece(p), 
                        () => this.checkClear(this.config.clearMessage)
                    );

                    puzzleBoard.appendChild(pieceEl);
                    this.pieces.push(pieceObj);
                }
            }
            
            // 初回の zIndex 設定
            this.updateZIndices();
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
            
            // 相対座標を更新（リサイズ対応用）
            const boardRect = this.config.puzzleBoard.getBoundingClientRect();
            pieceObj.relX = pieceObj.targetX / boardRect.width;
            pieceObj.relY = pieceObj.targetY / boardRect.height;
            
            const borderSvg = pieceObj.element.querySelector('.piece-border-svg');
            if (borderSvg) borderSvg.style.display = 'none';

            pieceObj.element.style.transform = 'scale(1)';
            pieceObj.element.style.zIndex = 1;
        },

        /**
         * ピースを最前面に移動し、全ピースの zIndex を更新する
         */
        bringPieceToFront: function(pieceObj) {
            const index = this.pieces.indexOf(pieceObj);
            if (index > -1) {
                // 配列から削除して最後に追加
                this.pieces.splice(index, 1);
                this.pieces.push(pieceObj);
                
                // 全ピースの zIndex を更新
                this.updateZIndices();
            }
        },

        /**
         * 全ピースの zIndex を配列の順序に基づいて更新する
         */
        updateZIndices: function() {
            this.pieces.forEach((p, i) => {
                // ロックされたピースは zIndex 1 固定、それ以外は 10 からの連番
                p.element.style.zIndex = p.isLocked ? 1 : i + 10;
            });
        },

        /**
         * ウィンドウリサイズ時の処理を登録
         */
        setupResizeHandler: function() {
            // 重複登録を避ける
            if (this.resizeListener) {
                window.removeEventListener('resize', this.resizeListener);
            }
            
            let timeout;
            this.resizeListener = () => {
                clearTimeout(timeout);
                timeout = setTimeout(() => this.handleResize(), 200);
            };
            window.addEventListener('resize', this.resizeListener);
        },

        /**
         * 実際のサイズ更新処理
         */
        handleResize: function() {
            if (!this.config || !this.pieces.length) return;

            const { rows, cols, puzzleBoard, puzzleFrame } = this.config;
            const boardRect = puzzleBoard.getBoundingClientRect();
            
            // 画像のアスペクト比を維持して再計算
            const img = new Image();
            img.src = this.imageSrc;
            
            // paddingの再計算
            const padding = Math.max(15, Math.min(40, boardRect.width * 0.05));
            const availableWidth = boardRect.width - padding * 2;
            const availableHeight = boardRect.height - padding * 2;
            
            // img.width/height が未取得の場合のために元の比率を保持する必要があるが
            // ここでは簡易的に現在の imgWidth/Height から比率を出す
            const currentRatio = this.imgWidth / this.imgHeight;
            let newImgW, newImgH;
            
            if (availableWidth / availableHeight > currentRatio) {
                newImgH = availableHeight;
                newImgW = availableHeight * currentRatio;
            } else {
                newImgW = availableWidth;
                newImgH = availableWidth / currentRatio;
            }

            const scale = newImgW / this.imgWidth;
            this.imgWidth = newImgW;
            this.imgHeight = newImgH;

            // フレーム更新
            puzzleFrame.style.width = `${this.imgWidth}px`;
            puzzleFrame.style.height = `${this.imgHeight}px`;

            // 頂点の再スケーリング
            this.vertices = this.vertices.map(row => 
                row.map(v => ({ x: v.x * scale, y: v.y * scale }))
            );

            // ガイドライン再描画
            window.Puzzle.UI.drawGuideLines(puzzleFrame, this.vertices, rows, cols, this.imgWidth, this.imgHeight);

            const frameX = (boardRect.width - this.imgWidth) / 2;
            const frameY = (boardRect.height - this.imgHeight) / 2;

            // 各ピースの更新
            this.pieces.forEach(p => {
                // target座標の更新
                p.targetX = frameX + (p.targetX - (this.baseBoardSize.w - this.imgWidth / scale) / 2) * scale;
                // 正確なスケール計算のために、geomをベースに再計算するのが安全
                // ここでは簡略化のため、現在の targetX/Y を基準に再計算
                
                // 正しいやり方: pieceObj にオリジナルの geom.bbox を保持しておく
                // 今回は既存構造を活かし、現在の値をスケールさせる
                p.bboxW *= scale;
                p.bboxH *= scale;
                p.targetX = frameX + (p.targetX - (this.baseBoardSize.w - this.imgWidth / scale) / 2) * scale;
                // ※上記の targetX 計算は少し複雑なので、initPuzzle 時に相対座標を保存するように改善が必要
                
                // ピース要素のスケール更新
                window.Puzzle.UI.updatePieceElement(p.element, scale, this.imgWidth, this.imgHeight);

                if (p.isLocked) {
                    // ロック中の場合は新ターゲットへ
                    // initPuzzle と同じロジックで再計算
                    // p.relX = targetX / boardRect.width
                } else {
                    // ドラッグ中の場合は現在の相対位置を維持
                    const newX = p.relX * boardRect.width;
                    const newY = p.relY * boardRect.height;
                    p.element.style.left = `${newX}px`;
                    p.element.style.top = `${newY}px`;
                }
            });

            // 基準値を更新
            this.baseBoardSize = { w: boardRect.width, h: boardRect.height };
            
            // ターゲット座標を正しく再設定（全ピース一括）
            this.recalculateTargets(boardRect);
        },

        /**
         * 全ピースのターゲット座標を現在のボードサイズに合わせて再計算
         */
        recalculateTargets: function(boardRect) {
            const frameX = (boardRect.width - this.imgWidth) / 2;
            const frameY = (boardRect.height - this.imgHeight) / 2;
            
            // 全ピースに対して新しいターゲットを計算
            this.pieces.forEach(p => {
                const geom = window.Puzzle.Geometry.computePieceGeometry(this.vertices, p.r, p.c);
                
                p.targetX = frameX + geom.bbox.x;
                p.targetY = frameY + geom.bbox.y;
                p.bboxW = geom.bbox.w;
                p.bboxH = geom.bbox.h;
                p.centerOffsetX = geom.center.x - geom.bbox.x;
                p.centerOffsetY = geom.center.y - geom.bbox.y;

                if (p.isLocked) {
                    p.element.style.left = `${p.targetX}px`;
                    p.element.style.top = `${p.targetY}px`;
                    p.relX = p.targetX / boardRect.width;
                    p.relY = p.targetY / boardRect.height;
                }
            });
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
