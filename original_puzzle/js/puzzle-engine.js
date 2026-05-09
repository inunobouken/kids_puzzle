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
        normalizedVertices: [],
        baseBoardSize: { w: 0, h: 0 },
        sourceImg: null,
        edgeData: null,
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
            
            // 辺データの生成
            this.edgeData = window.Puzzle.Geometry.generateEdgeData(rows, cols);

            // 盤面のクリーンアップ
            window.Puzzle.UI.clearBoard(puzzleBoard, puzzleFrame);
            clearMessage.classList.add('hidden');

            // 画像の読み込み待ち
            const img = new Image();
            img.src = imageSrc;
            await img.decode();
            this.sourceImg = img;

            this.setupResizeHandler();
            this.renderPuzzle(this.sourceImg);
        },

        /**
         * パズルの描画（初回およびリサイズ時に使用）
         */
        renderPuzzle: function(img) {
            const { rows, cols, puzzleBoard, puzzleFrame } = this.config;
            const boardRect = puzzleBoard.getBoundingClientRect();
            this.baseBoardSize = { w: boardRect.width, h: boardRect.height };
            
            // サイズ計算の共通処理呼び出し
            const fit = window.Puzzle.Geometry.calculateFitSize(
                boardRect.width, 
                boardRect.height, 
                img.naturalWidth, 
                img.naturalHeight
            );
            
            this.imgWidth = fit.w;
            this.imgHeight = fit.h;

            // フレームサイズ設定
            puzzleFrame.style.width = `${this.imgWidth}px`;
            puzzleFrame.style.height = `${this.imgHeight}px`;

            // 幾何計算
            this.vertices = window.Puzzle.Geometry.generateGridVertices(rows, cols, this.imgWidth, this.imgHeight);
            
            // 誤差累積防止のため、初期状態の正規化頂点（0.0～1.0）を保存
            this.normalizedVertices = this.vertices.map(row => 
                row.map(v => ({ x: v.x / this.imgWidth, y: v.y / this.imgHeight }))
            );

            window.Puzzle.UI.drawGuideLines(puzzleFrame, this.vertices, rows, cols, this.imgWidth, this.imgHeight, this.edgeData);

            const frameX = (boardRect.width - this.imgWidth) / 2;
            const frameY = (boardRect.height - this.imgHeight) / 2;

            // ピース生成ループ
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const geom = window.Puzzle.Geometry.computePieceGeometry(this.vertices, r, c, this.edgeData);
                    const pieceEl = window.Puzzle.UI.createPieceElement(geom, this.imageSrc, this.imgWidth, this.imgHeight);
                    
                    const targetX = frameX + geom.bbox.x - 0.5;
                    const targetY = frameY + geom.bbox.y - 0.5;

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

            // 0.5pxのオフセットを考慮して座標を返す
            return { x: x - 0.5, y: y - 0.5 };
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
            
            // 演出：本体フラッシュと枠線のフェードアウト
            pieceObj.element.classList.add('snap-flash');
            pieceObj.element.classList.add('snap-outline');
            
            // アニメーション完了後にリセット
            setTimeout(() => {
                pieceObj.element.classList.remove('snap-flash');
                // 完全に非表示にする（アニメーション後の状態を確定）
                const paths = pieceObj.element.querySelectorAll('path:not(defs path)');
                paths.forEach(p => p.style.display = 'none');
                
                // zIndex を確定（1 にする）
                this.updateZIndices();
            }, 600);
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
                // ロックされたピースは zIndex 1 固定（未配置ピースの下に回り込むように）、それ以外は 10 からの連番
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
            
            if (!this.sourceImg) return;

            // サイズ計算の共通処理呼び出し
            const fit = window.Puzzle.Geometry.calculateFitSize(
                boardRect.width, 
                boardRect.height, 
                this.sourceImg.naturalWidth, 
                this.sourceImg.naturalHeight
            );

            const scale = fit.w / this.imgWidth;
            this.imgWidth = fit.w;
            this.imgHeight = fit.h;

            // フレーム更新
            puzzleFrame.style.width = `${this.imgWidth}px`;
            puzzleFrame.style.height = `${this.imgHeight}px`;

            // 頂点の再スケーリング（正規化データから計算することで誤差の累積を防ぐ）
            this.vertices = this.normalizedVertices.map(row => 
                row.map(v => ({ x: v.x * this.imgWidth, y: v.y * this.imgHeight }))
            );

            // ガイドライン再描画
            window.Puzzle.UI.drawGuideLines(puzzleFrame, this.vertices, rows, cols, this.imgWidth, this.imgHeight, this.edgeData);

            const frameX = (boardRect.width - this.imgWidth) / 2;
            const frameY = (boardRect.height - this.imgHeight) / 2;

            // 各ピースの更新
            this.pieces.forEach(p => {
                if (!p.isLocked) {
                    // 未ロックの場合は現在の相対位置を維持して移動
                    const newX = p.relX * boardRect.width - 0.5;
                    const newY = p.relY * boardRect.height - 0.5;
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
                const geom = window.Puzzle.Geometry.computePieceGeometry(this.vertices, p.r, p.c, this.edgeData);
                
                p.targetX = frameX + geom.bbox.x - 0.5;
                p.targetY = frameY + geom.bbox.y - 0.5;
                p.bboxW = geom.bbox.w;
                p.bboxH = geom.bbox.h;
                p.centerOffsetX = geom.center.x - geom.bbox.x;
                p.centerOffsetY = geom.center.y - geom.bbox.y;

                // UIの更新（再計算された幾何情報を使用）
                window.Puzzle.UI.applyGeometryToElement(p.element, geom, this.imgWidth, this.imgHeight);

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
