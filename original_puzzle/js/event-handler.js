(function() {
    window.Puzzle = window.Puzzle || {};

    /**
     * イベントハンドリング・操作モジュール
     */
    window.Puzzle.Events = {
        isDragging: false,
        activePiece: null,
        offset: { x: 0, y: 0 },
        cachedBoardRect: null,

        /**
         * ピースにドラッグイベントを登録する
         */
        attachDragEvents: function(pieceObj, puzzleBoard, onSnap, onComplete) {
            pieceObj.element.addEventListener('pointerdown', (e) => {
                if (pieceObj.isLocked) return;
                e.preventDefault();

                this.isDragging = true;
                this.activePiece = pieceObj;
                this.activePiece.element.setPointerCapture(e.pointerId);

                const rect = this.activePiece.element.getBoundingClientRect();
                this.offset.x = e.clientX - rect.left;
                this.offset.y = e.clientY - rect.top;

                // ボードの矩形情報をキャッシュ
                this.cachedBoardRect = puzzleBoard.getBoundingClientRect();

                // 最前面に移動
                window.Puzzle.Engine.bringPieceToFront(this.activePiece);

                const moveHandler = (moveEvent) => this.onPointerMove(moveEvent, puzzleBoard);
                const upHandler = (upEvent) => {
                    this.onPointerUp(upEvent, onSnap, onComplete);
                    this.activePiece.element.removeEventListener('pointermove', moveHandler);
                    this.activePiece.element.removeEventListener('pointerup', upHandler);
                };

                this.activePiece.element.addEventListener('pointermove', moveHandler);
                this.activePiece.element.addEventListener('pointerup', upHandler);
            });
        },

        onPointerMove: function(e, puzzleBoard) {
            if (!this.isDragging || !this.activePiece || !this.cachedBoardRect) return;
            e.preventDefault();

            const boardRect = this.cachedBoardRect;
            let x = e.clientX - boardRect.left - this.offset.x;
            let y = e.clientY - boardRect.top - this.offset.y;

            const pw = this.activePiece.bboxW;
            const ph = this.activePiece.bboxH;

            // ボード外に出ないように制限
            x = Math.max(-pw / 2, Math.min(x, boardRect.width - pw / 2));
            y = Math.max(-ph / 2, Math.min(y, boardRect.height - ph / 2));

            this.activePiece.element.style.left = `${x}px`;
            this.activePiece.element.style.top = `${y}px`;

            // 相対位置を更新
            this.activePiece.relX = x / boardRect.width;
            this.activePiece.relY = y / boardRect.height;
        },

        onPointerUp: function(e, onSnap, onComplete) {
            if (!this.isDragging || !this.activePiece) return;

            const currentX = parseFloat(this.activePiece.element.style.left);
            const currentY = parseFloat(this.activePiece.element.style.top);

            // 中心点での距離判定
            const currentCenterX = currentX + this.activePiece.centerOffsetX;
            const currentCenterY = currentY + this.activePiece.centerOffsetY;
            const targetCenterX = this.activePiece.targetX + this.activePiece.centerOffsetX;
            const targetCenterY = this.activePiece.targetY + this.activePiece.centerOffsetY;

            const dist = Math.sqrt(
                Math.pow(currentCenterX - targetCenterX, 2) + 
                Math.pow(currentCenterY - targetCenterY, 2)
            );

            // スナップ判定のしきい値（ピースサイズの30%）
            const threshold = Math.min(this.activePiece.bboxW, this.activePiece.bboxH) * 0.3;

            if (dist < threshold) {
                onSnap(this.activePiece);
            }

            this.activePiece.element.releasePointerCapture(e.pointerId);
            
            this.isDragging = false;
            this.activePiece = null;

            if (onComplete) onComplete();
        }
    };
})();
