(function() {
    window.Puzzle = window.Puzzle || {};

    /**
     * 計算ロジック（頂点生成、パス生成、幾何計算）
     */
    window.Puzzle.Geometry = {
        // 設定値（定数）
        JITTER_RATIO_X: 0.25,
        JITTER_RATIO_Y: 0.25,
        DEFAULT_RADIUS: 10,
        MIN_PADDING: 15,
        MAX_PADDING: 40,
        PADDING_RATIO: 0.05,

        /**
         * ボードのサイズに合わせて画像をフィットさせるサイズを計算する
         */
        calculateFitSize: function(boardW, boardH, imgW, imgH) {
            const padding = Math.max(this.MIN_PADDING, Math.min(this.MAX_PADDING, boardW * this.PADDING_RATIO));
            const availW = boardW - padding * 2;
            const availH = boardH - padding * 2;
            
            const ratio = Math.min(availW / imgW, availH / imgH);
            
            return {
                w: imgW * ratio,
                h: imgH * ratio,
                padding: padding
            };
        },

        /**
         * グリッド頂点を生成する。
         * 外周の頂点は固定し、内部の頂点はランダムにずらす。
         */
        generateGridVertices: function(rows, cols, width, height) {
            const cellW = width / cols;
            const cellH = height / rows;

            const vertices = [];
            for (let r = 0; r <= rows; r++) {
                const row = [];
                for (let c = 0; c <= cols; c++) {
                    let x = c * cellW;
                    let y = r * cellH;

                    // 外周の頂点はずらさない
                    const isEdgeX = (c === 0 || c === cols);
                    const isEdgeY = (r === 0 || r === rows);

                    if (!isEdgeX) {
                        x += (Math.random() * 2 - 1) * cellW * this.JITTER_RATIO_X;
                    }
                    if (!isEdgeY) {
                        y += (Math.random() * 2 - 1) * cellH * this.JITTER_RATIO_Y;
                    }

                    // 範囲内に収める
                    x = Math.max(0, Math.min(width, x));
                    y = Math.max(0, Math.min(height, y));

                    row.push({ x, y });
                }
                vertices.push(row);
            }
            return vertices;
        },

        /**
         * 頂点の配列から角の丸まったSVGパス文字列(d属性用)を生成する
         */
        generateRoundedPath: function(points, radius) {
            if (points.length < 3) return "";
            let d = "";
            for (let i = 0; i < points.length; i++) {
                const p1 = points[(i + points.length - 1) % points.length];
                const p2 = points[i];
                const p3 = points[(i + 1) % points.length];

                const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
                const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
                const l1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
                const l2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
                
                const r = Math.min(radius, l1 / 2, l2 / 2);
                
                const n1 = { x: v1.x / l1, y: v1.y / l1 };
                const n2 = { x: v2.x / l2, y: v2.y / l2 };

                const q1 = { x: p2.x + n1.x * r, y: p2.y + n1.y * r };
                const q2 = { x: p2.x + n2.x * r, y: p2.y + n2.y * r };

                if (i === 0) {
                    d += `M ${q1.x},${q1.y} `;
                } else {
                    d += `L ${q1.x},${q1.y} `;
                }
                d += `Q ${p2.x},${p2.y} ${q2.x},${q2.y} `;
            }
            return d + "Z";
        },

        /**
         * ピースのバウンディングボックスとclip-pathを計算
         */
        computePieceGeometry: function(vertices, r, c) {
            const tl = vertices[r][c];
            const tr = vertices[r][c + 1];
            const br = vertices[r + 1][c + 1];
            const bl = vertices[r + 1][c];

            const minX = Math.min(tl.x, tr.x, br.x, bl.x);
            const minY = Math.min(tl.y, tr.y, br.y, bl.y);
            const maxX = Math.max(tl.x, tr.x, br.x, bl.x);
            const maxY = Math.max(tl.y, tr.y, br.y, bl.y);
            const w = maxX - minX;
            const h = maxY - minY;

            const points = [tl, tr, br, bl].map(p => {
                const px = ((p.x - minX) / w) * 100;
                const py = ((p.y - minY) / h) * 100;
                return `${px.toFixed(2)}% ${py.toFixed(2)}%`;
            });
            const clipPath = `polygon(${points.join(', ')})`;

            const center = {
                x: (tl.x + tr.x + br.x + bl.x) / 4,
                y: (tl.y + tr.y + br.y + bl.y) / 4
            };

            const localPoints = [tl, tr, br, bl].map(p => ({
                x: p.x - minX,
                y: p.y - minY
            }));

            const borderPathData = this.generateRoundedPath(localPoints, this.DEFAULT_RADIUS);

            return {
                bbox: { x: minX, y: minY, w, h },
                clipPath,
                borderPathData,
                center,
                corners: { tl, tr, br, bl },
                localPoints
            };
        }
    };
})();
