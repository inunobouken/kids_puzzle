(function() {
    window.Puzzle = window.Puzzle || {};

    /**
     * 描画・DOM操作モジュール
     */
    window.Puzzle.UI = {
        // 設定値（定数）
        WHITE_STROKE_WIDTH: 9,
        BLACK_STROKE_WIDTH: 3,

        /**
         * ガイドラインをcanvasに描画
         */
        drawGuideLines: function(puzzleFrame, vertices, rows, cols, displayW, displayH) {
            // 既存のキャンバスを削除
            const existingCanvas = puzzleFrame.querySelector('canvas');
            if (existingCanvas) existingCanvas.remove();

            const dpr = window.devicePixelRatio || 1;
            const canvas = document.createElement('canvas');
            canvas.width = displayW * dpr;
            canvas.height = displayH * dpr;
            canvas.style.width = `${displayW}px`;
            canvas.style.height = `${displayH}px`;
            canvas.style.position = 'absolute';
            canvas.style.top = '0';
            canvas.style.left = '0';
            canvas.style.pointerEvents = 'none';
            puzzleFrame.appendChild(canvas);

            const ctx = canvas.getContext('2d');
            ctx.scale(dpr, dpr);
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 4]);

            // 横方向の線（行の区切り）を描画
            for (let r = 1; r < rows; r++) {
                ctx.beginPath();
                ctx.moveTo(vertices[r][0].x, vertices[r][0].y);
                for (let c = 1; c <= cols; c++) {
                    ctx.lineTo(vertices[r][c].x, vertices[r][c].y);
                }
                ctx.stroke();
            }

            // 縦方向の線（列の区切り）を描画
            for (let c = 1; c < cols; c++) {
                ctx.beginPath();
                ctx.moveTo(vertices[0][c].x, vertices[0][c].y);
                for (let r = 1; r <= rows; r++) {
                    ctx.lineTo(vertices[r][c].x, vertices[r][c].y);
                }
                ctx.stroke();
            }
        },

        /**
         * ピースのHTML要素を生成する
         */
        createPieceElement: function(geom, imageSrc, imgWidth, imgHeight) {
            const piece = document.createElement('div');
            piece.className = 'puzzle-piece movable';
            piece.style.width = `${geom.bbox.w}px`;
            piece.style.height = `${geom.bbox.h}px`;
            piece.style.borderRadius = '0';

            // 画像レイヤー
            const imageLayer = document.createElement('div');
            imageLayer.style.position = 'absolute';
            imageLayer.style.top = '0';
            imageLayer.style.left = '0';
            imageLayer.style.width = '100%';
            imageLayer.style.height = '100%';
            imageLayer.style.backgroundImage = `url(${imageSrc})`;
            imageLayer.style.backgroundSize = `${imgWidth}px ${imgHeight}px`;
            imageLayer.style.backgroundPosition = `-${geom.bbox.x}px -${geom.bbox.y}px`;
            imageLayer.style.clipPath = geom.clipPath;
            piece.appendChild(imageLayer);

            // SVGオーバーレイ
            const svgNS = 'http://www.w3.org/2000/svg';
            const svg = document.createElementNS(svgNS, 'svg');
            svg.setAttribute('width', geom.bbox.w);
            svg.setAttribute('height', geom.bbox.h);
            svg.setAttribute('viewBox', `0 0 ${geom.bbox.w} ${geom.bbox.h}`);
            svg.style.position = 'absolute';
            svg.style.top = '0';
            svg.style.left = '0';
            svg.style.pointerEvents = 'none';
            svg.style.overflow = 'visible';
            svg.classList.add('piece-border-svg');

            const pointsStr = geom.localPoints.map(p => `${p.x},${p.y}`).join(' ');

            const defs = document.createElementNS(svgNS, 'defs');
            const clipPath = document.createElementNS(svgNS, 'clipPath');
            const clipId = `clip-${Math.random().toString(36).substr(2, 9)}`;
            clipPath.setAttribute('id', clipId);
            const clipPoly = document.createElementNS(svgNS, 'polygon');
            clipPoly.setAttribute('points', pointsStr);
            clipPath.appendChild(clipPoly);
            defs.appendChild(clipPath);
            svg.appendChild(defs);

            const whiteLine = document.createElementNS(svgNS, 'path');
            whiteLine.setAttribute('d', geom.borderPathData);
            whiteLine.setAttribute('fill', 'none');
            whiteLine.setAttribute('stroke', 'white');
            whiteLine.setAttribute('stroke-width', this.WHITE_STROKE_WIDTH);
            whiteLine.setAttribute('stroke-linejoin', 'round');
            whiteLine.setAttribute('clip-path', `url(#${clipId})`);
            svg.appendChild(whiteLine);

            const blackLine = document.createElementNS(svgNS, 'path');
            blackLine.setAttribute('d', geom.borderPathData);
            blackLine.setAttribute('fill', 'none');
            blackLine.setAttribute('stroke', 'black');
            blackLine.setAttribute('stroke-width', this.BLACK_STROKE_WIDTH);
            blackLine.setAttribute('stroke-linejoin', 'round');
            svg.appendChild(blackLine);

            piece.appendChild(svg);
            return piece;
        },

        /**
         * 盤面をクリアする
         */
        clearBoard: function(puzzleBoard, puzzleFrame) {
            const existingPieces = puzzleBoard.querySelectorAll('.puzzle-piece');
            existingPieces.forEach(p => p.remove());
            
            puzzleFrame.style.width = '0';
            puzzleFrame.style.height = '0';
            
            const canvas = puzzleFrame.querySelector('canvas');
            if (canvas) canvas.remove();
        },

        /**
         * ピース要素をスケーリングする
         */
        updatePieceElement: function(pieceEl, scale, imgWidth, imgHeight) {
            // 現在のサイズを取得してスケール
            const curW = parseFloat(pieceEl.style.width);
            const curH = parseFloat(pieceEl.style.height);
            pieceEl.style.width = `${curW * scale}px`;
            pieceEl.style.height = `${curH * scale}px`;

            // 画像レイヤーの更新
            const imageLayer = pieceEl.firstChild;
            if (imageLayer) {
                imageLayer.style.backgroundSize = `${imgWidth}px ${imgHeight}px`;
                const curPosX = parseFloat(imageLayer.style.backgroundPositionX);
                const curPosY = parseFloat(imageLayer.style.backgroundPositionY);
                imageLayer.style.backgroundPosition = `${curPosX * scale}px ${curPosY * scale}px`;
            }

            // SVGの更新
            const svg = pieceEl.querySelector('svg');
            if (svg) {
                const curSvgW = parseFloat(svg.getAttribute('width'));
                const curSvgH = parseFloat(svg.getAttribute('height'));
                svg.setAttribute('width', curSvgW * scale);
                svg.setAttribute('height', curSvgH * scale);
                // viewBox はそのまま（中身が自動でスケールされる）
            }
        }
    };
})();
