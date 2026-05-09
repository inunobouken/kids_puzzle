(function() {
    window.Puzzle = window.Puzzle || {};

    /**
     * イベントハンドリング・操作モジュール
     */
    window.Puzzle.Events = {
        isDragging: false,
        activePiece: null,
        offset: { x: 0, y: 0 },
        currentMaxZIndex: 10,

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

                this.currentMaxZIndex++;
                this.activePiece.element.style.zIndex = this.currentMaxZIndex;

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
            if (!this.isDragging || !this.activePiece) return;
            e.preventDefault();

            const boardRect = puzzleBoard.getBoundingClientRect();
            let x = e.clientX - boardRect.left - this.offset.x;
            let y = e.clientY - boardRect.top - this.offset.y;

            const pw = this.activePiece.bboxW;
            const ph = this.activePiece.bboxH;

            // ボード外に出ないように制限
            x = Math.max(-pw / 2, Math.min(x, boardRect.width - pw / 2));
            y = Math.max(-ph / 2, Math.min(y, boardRect.height - ph / 2));

            this.activePiece.element.style.left = `${x}px`;
            this.activePiece.element.style.top = `${y}px`;
        },

        onPointerUp: function(e, onSnap, onComplete) {
            if (!this.isDragging || !this.activePiece) return;

            const currentX = parseFloat(this.activePiece.element.style.left);
            const currentY = parseFloat(this.activePiece.element.style.top);

            const dist = Math.sqrt(
                Math.pow(currentX - this.activePiece.targetX, 2) + 
                Math.pow(currentY - this.activePiece.targetY, 2)
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
