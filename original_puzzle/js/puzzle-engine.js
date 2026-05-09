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
        timeouts: [], // 実行中のタイマーを管理
        maxZIndex: 100, // 現在の最大 zIndex

        /**
         * 画像を読み込み、デコード完了を待機する共通メソッド
         * 読み込みに失敗した場合は例外を投げるため、呼び出し側で適切にハンドリングすること
         */
        loadImage: async function(src) {
            if (!src) return null;
            const img = new Image();
            img.src = src;
            await img.decode();
            return img;
        },

        /**
         * パズルを初期化する
         */
        initPuzzle: async function(config) {
            // 開始前に状態をリセット
            this.reset();

            const { imageSrc, image, rows, cols, puzzleBoard, puzzleFrame, clearMessage } = config;
            this.imageSrc = imageSrc;
            this.config = config;
            this.rows = rows;
            this.cols = cols;
            
            // 辺データの生成
            this.edgeData = window.Puzzle.Geometry.generateEdgeData(rows, cols);

            // 盤面のクリーンアップ（UI側）
            window.Puzzle.UI.clearBoard(puzzleBoard, puzzleFrame);
            clearMessage.classList.add('hidden');

            // 画像の読み込み待ち（既に渡されている場合でも安全のためにdecodeを確認）
            if (image) {
                try {
                    // すでにオブジェクトがあるため、デコード完了を待機する
                    await image.decode();
                } catch (e) {
                    // 失敗してもオブジェクト自体は有効な可能性があるため、ログだけ出して続行
                    console.warn("Image decode failed or already in progress", e);
                }
                this.sourceImg = image;
            } else {
                // 画像がまだ準備されていない場合は、共通メソッドで読み込む（失敗時は例外を投げて処理を中断する）
                this.sourceImg = await this.loadImage(imageSrc);
            }

            // レイアウトの計算とピースの生成
            this.refreshLayout();
            this.createPieces();
            this.setupResizeHandler();
        },

        /**
         * ボードやフレームのサイズ、頂点情報を現在の状況に合わせて更新する
         * （初期化時およびリサイズ時の共通処理）
         */
        refreshLayout: function() {
            const { rows, cols, puzzleBoard, puzzleFrame } = this.config;
            const boardRect = puzzleBoard.getBoundingClientRect();
            this.baseBoardSize = { w: boardRect.width, h: boardRect.height };
            
            // サイズ計算の共通処理呼び出し
            const fit = window.Puzzle.Geometry.calculateFitSize(
                boardRect.width, 
                boardRect.height, 
                this.sourceImg.naturalWidth, 
                this.sourceImg.naturalHeight
            );
            
            this.imgWidth = fit.w;
            this.imgHeight = fit.h;

            // フレームサイズの更新
            puzzleFrame.style.width = `${this.imgWidth}px`;
            puzzleFrame.style.height = `${this.imgHeight}px`;

            // 頂点の計算
            if (this.normalizedVertices.length === 0) {
                // 初回：ランダムな頂点を生成し、正規化データを保存
                this.vertices = window.Puzzle.Geometry.generateGridVertices(rows, cols, this.imgWidth, this.imgHeight);
                this.normalizedVertices = this.vertices.map(row => 
                    row.map(v => ({ x: v.x / this.imgWidth, y: v.y / this.imgHeight }))
                );
            } else {
                // リサイズ時：正規化データから現在のサイズに復元（誤差累積防止）
                this.vertices = this.normalizedVertices.map(row => 
                    row.map(v => ({ x: v.x * this.imgWidth, y: v.y * this.imgHeight }))
                );
            }

            // ガイドライン描画
            window.Puzzle.UI.drawGuideLines(puzzleFrame, this.vertices, rows, cols, this.imgWidth, this.imgHeight, this.edgeData);
        },

        /**
         * ピースを新規生成してボードに配置する（初回のみ）
         */
        createPieces: function() {
            const { rows, cols, puzzleBoard } = this.config;
            const boardRect = puzzleBoard.getBoundingClientRect();
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
            
            // ガイドラインを消す
            window.Puzzle.UI.fadeGuideLines(this.config.puzzleFrame, pieceObj.r, pieceObj.c);
            
            // アニメーション完了後にリセット
            const tid = setTimeout(() => {
                pieceObj.element.classList.remove('snap-flash');
                // 完全に非表示にする（アニメーション後の状態を確定）
                const paths = pieceObj.element.querySelectorAll('path:not(defs path)');
                paths.forEach(p => p.style.display = 'none');
                
                // zIndex を確定（ロックされたピースは一番下へ）
                pieceObj.element.style.zIndex = 1;
                
                // 完了したタイマーを配列から削除
                this.timeouts = this.timeouts.filter(id => id !== tid);
            }, 600);

            this.timeouts.push(tid);
        },

        /**
         * エンジンの状態を完全にリセットする
         */
        reset: function() {
            // 全ての実行中のタイマーをクリア
            this.timeouts.forEach(tid => clearTimeout(tid));
            this.timeouts = [];

            // ピース配列をクリア
            this.pieces = [];
            this.maxZIndex = 100;
            
            // その他内部データのクリア
            this.vertices = [];
            this.normalizedVertices = [];
            this.edgeData = null;
        },

        /**
         * ピースを最前面に移動する（インクリメント方式）
         */
        bringPieceToFront: function(pieceObj) {
            if (pieceObj.isLocked) return;
            
            // 掴んだピースだけを新しい最大値に設定する（全ループを避ける）
            this.maxZIndex++;
            pieceObj.element.style.zIndex = this.maxZIndex;
        },

        /**
         * 全ピースの zIndex を初期状態に設定する（ピース生成直後に実行）
         */
        updateZIndices: function() {
            this.maxZIndex = 100;
            this.pieces.forEach((p, i) => {
                if (p.isLocked) {
                    p.element.style.zIndex = 1;
                } else {
                    this.maxZIndex++;
                    p.element.style.zIndex = this.maxZIndex;
                }
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
                // リサイズが始まった瞬間にドラッグを強制終了（座標の不整合を防ぐ）
                window.Puzzle.Events.cancelDrag();

                clearTimeout(timeout);
                timeout = setTimeout(() => this.handleResize(), 200);
            };
            window.addEventListener('resize', this.resizeListener);
        },

        /**
         * 実際のサイズ更新処理
         */
        handleResize: function() {
            if (!this.config || !this.pieces.length || !this.sourceImg) return;

            const { puzzleBoard } = this.config;
            const boardRect = puzzleBoard.getBoundingClientRect();
            
            // レイアウトを更新（共通処理）
            this.refreshLayout();

            // ピースの位置と形状を更新
            const frameX = (boardRect.width - this.imgWidth) / 2;
            const frameY = (boardRect.height - this.imgHeight) / 2;

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
                } else {
                    const newX = p.relX * boardRect.width - 0.5;
                    const newY = p.relY * boardRect.height - 0.5;
                    p.element.style.left = `${newX}px`;
                    p.element.style.top = `${newY}px`;
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
