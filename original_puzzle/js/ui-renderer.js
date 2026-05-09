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
         * ガイドラインをSVGで描画
         */
        drawGuideLines: function(puzzleFrame, vertices, rows, cols, displayW, displayH, edgeData) {
            // 既存のガイド要素を削除
            const existingGuide = puzzleFrame.querySelector('.guide-svg');
            if (existingGuide) existingGuide.remove();

            const svgNS = 'http://www.w3.org/2000/svg';
            const svg = document.createElementNS(svgNS, 'svg');
            svg.classList.add('guide-svg');
            svg.setAttribute('width', displayW);
            svg.setAttribute('height', displayH);
            svg.setAttribute('viewBox', `0 0 ${displayW} ${displayH}`);
            svg.style.position = 'absolute';
            svg.style.top = '0';
            svg.style.left = '0';
            svg.style.pointerEvents = 'none';
            puzzleFrame.appendChild(svg);

            const { verticalEdges, horizontalEdges } = edgeData;

            // 共通のスタイル設定
            const createPath = (d) => {
                const path = document.createElementNS(svgNS, 'path');
                path.setAttribute('d', d);
                path.setAttribute('fill', 'none');
                path.setAttribute('stroke', 'rgba(0, 0, 0, 0.2)');
                path.setAttribute('stroke-width', '1.5');
                path.setAttribute('stroke-dasharray', '6, 4');
                return path;
            };

            // 横方向の線（行の区切り）
            for (let r = 1; r < rows; r++) {
                let d = `M ${vertices[r][0].x},${vertices[r][0].y} `;
                for (let c = 0; c < cols; c++) {
                    const p1 = vertices[r][c];
                    const p2 = vertices[r][c + 1];
                    // 下のピース（r, c）の上面の形状に合わせる
                    const type = horizontalEdges[r - 1][c] * -1;
                    d += window.Puzzle.Geometry.drawJigsawSide(p1, p2, type);
                }
                svg.appendChild(createPath(d));
            }

            // 縦方向の線（列の区切り）
            for (let c = 1; c < cols; c++) {
                let d = `M ${vertices[0][c].x},${vertices[0][c].y} `;
                for (let r = 0; r < rows; r++) {
                    const p1 = vertices[r][c];
                    const p2 = vertices[r + 1][c];
                    // 右のピース（r, c）の左面の形状に合わせる
                    const type = verticalEdges[r][c - 1]; 
                    d += window.Puzzle.Geometry.drawJigsawSide(p1, p2, type);
                }
                svg.appendChild(createPath(d));
            }
        },

        /**
         * ピースのHTML要素（SVG）を生成する
         */
        createPieceElement: function(geom, imageSrc, imgWidth, imgHeight) {
            const svgNS = 'http://www.w3.org/2000/svg';
            
            // ピースのメインコンテナ（SVG自体をピースとする）
            const svg = document.createElementNS(svgNS, 'svg');
            svg.classList.add('puzzle-piece', 'movable');
            // アンチエイリアスによる隙間防止のため、1px大きく描画して隣と重ねる
            svg.setAttribute('width', geom.bbox.w + 1);
            svg.setAttribute('height', geom.bbox.h + 1);
            svg.setAttribute('viewBox', `0 0 ${geom.bbox.w} ${geom.bbox.h}`);
            svg.style.position = 'absolute';
            svg.style.overflow = 'visible';
            svg.style.cursor = 'grab';
            svg.style.pointerEvents = 'none'; // SVG自体はクリックを透過
            svg.style.touchAction = 'none';

            const clipId = `clip-${Math.random().toString(36).substr(2, 9)}`;
            
            // 定義（クリップパス）
            const defs = document.createElementNS(svgNS, 'defs');
            const clipPath = document.createElementNS(svgNS, 'clipPath');
            clipPath.setAttribute('id', clipId);
            const clipPathElem = document.createElementNS(svgNS, 'path');
            clipPathElem.setAttribute('d', geom.pathData);
            clipPath.appendChild(clipPathElem);
            defs.appendChild(clipPath);
            svg.appendChild(defs);

            // 画像レイヤー（SVGのimageタグを使用）
            const image = document.createElementNS(svgNS, 'image');
            image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', imageSrc);
            image.setAttribute('width', imgWidth);
            image.setAttribute('height', imgHeight);
            image.setAttribute('x', -geom.bbox.x);
            image.setAttribute('y', -geom.bbox.y);
            image.setAttribute('clip-path', `url(#${clipId})`);
            image.style.pointerEvents = 'none'; // 画像自体は透過
            svg.appendChild(image);

            // 境界線（白）
            const whiteLine = document.createElementNS(svgNS, 'path');
            whiteLine.setAttribute('d', geom.pathData);
            whiteLine.setAttribute('fill', 'none');
            whiteLine.setAttribute('stroke', 'white');
            whiteLine.setAttribute('stroke-width', this.WHITE_STROKE_WIDTH);
            whiteLine.setAttribute('stroke-linejoin', 'round');
            whiteLine.setAttribute('clip-path', `url(#${clipId})`);
            whiteLine.classList.add('piece-border-white');
            whiteLine.style.pointerEvents = 'none';
            svg.appendChild(whiteLine);

            // 境界線（黒）
            const blackLine = document.createElementNS(svgNS, 'path');
            blackLine.setAttribute('d', geom.pathData);
            blackLine.setAttribute('fill', 'none');
            blackLine.setAttribute('stroke', 'black');
            blackLine.setAttribute('stroke-width', this.BLACK_STROKE_WIDTH);
            blackLine.setAttribute('stroke-linejoin', 'round');
            blackLine.classList.add('piece-border-black');
            blackLine.style.pointerEvents = 'none';
            svg.appendChild(blackLine);

            // ヒットテスト用の透明なパス (クリック判定用)
            const hitPath = document.createElementNS(svgNS, 'path');
            hitPath.classList.add('hit-test-path');
            hitPath.setAttribute('d', geom.pathData);
            hitPath.setAttribute('fill', 'rgba(0,0,0,0)'); // 透明だが判定は持つ
            hitPath.style.pointerEvents = 'auto'; // これだけがクリックを拾う
            svg.appendChild(hitPath);

            return svg;
        },

        /**
         * 盤面をクリアする
         */
        clearBoard: function(puzzleBoard, puzzleFrame) {
            const existingPieces = puzzleBoard.querySelectorAll('.puzzle-piece');
            existingPieces.forEach(p => p.remove());
            
            puzzleFrame.style.width = '0';
            puzzleFrame.style.height = '0';
            
            const guide = puzzleFrame.querySelector('.guide-svg');
            if (guide) guide.remove();
        },

        /**
         * ピース要素に幾何情報を適用する（初期化時およびリサイズ時）
         */
        applyGeometryToElement: function(pieceEl, geom, imgWidth, imgHeight) {
            const svg = pieceEl; // pieceEl 自体が SVG
            
            // 1px大きくして重ねる
            svg.setAttribute('width', geom.bbox.w + 1);
            svg.setAttribute('height', geom.bbox.h + 1);
            svg.setAttribute('viewBox', `0 0 ${geom.bbox.w} ${geom.bbox.h}`);

            // 画像の更新
            const image = svg.querySelector('image');
            if (image) {
                image.setAttribute('width', imgWidth);
                image.setAttribute('height', imgHeight);
                image.setAttribute('x', -geom.bbox.x);
                image.setAttribute('y', -geom.bbox.y);
            }

            // 全てのパス（クリップパス、ヒットパス、境界線）の更新
            const paths = svg.querySelectorAll('path');
            paths.forEach(p => {
                p.setAttribute('d', geom.pathData);
            });
        }
    };
})();
