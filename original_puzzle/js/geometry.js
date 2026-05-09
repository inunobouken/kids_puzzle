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
        TAB_SIZE_RATIO: 0.20, // ピースサイズに対するタブの大きさ

        /**
         * 全ての辺の凹凸データを生成する
         */
        generateEdgeData: function(rows, cols) {
            const verticalEdges = []; // verticalEdges[r][c] (0 <= r < rows, 0 <= c < cols-1)
            for (let r = 0; r < rows; r++) {
                const row = [];
                for (let c = 0; c < cols - 1; c++) {
                    row.push(Math.random() > 0.5 ? 1 : -1);
                }
                verticalEdges.push(row);
            }

            const horizontalEdges = []; // horizontalEdges[r][c] (0 <= r < rows-1, 0 <= c < cols)
            for (let r = 0; r < rows - 1; r++) {
                const row = [];
                for (let c = 0; c < cols; c++) {
                    row.push(Math.random() > 0.5 ? 1 : -1);
                }
                horizontalEdges.push(row);
            }

            return { verticalEdges, horizontalEdges };
        },

        /**
         * 1辺のパス（ベジェ曲線による凹凸）を生成する
         */
        drawJigsawSide: function(p1, p2, type) {
            if (type === 0) return `L ${p2.x},${p2.y} `;

            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            
            // 垂直ベクトル（凹凸の向き）
            // type=1 の時、進行方向に対して右側に凸、type=-1 の時、左側に凸
            const nx = -dy / length * type;
            const ny = dx / length * type;

            const tabSize = length * this.TAB_SIZE_RATIO;
            
            // 単一の3次ベジェ曲線で「ぷっくりとした円形」を描画する
            // 1. タブの開始点と終了点 (辺の 40% から 60% の位置)
            const tp1 = { x: p1.x + dx * 0.40, y: p1.y + dy * 0.40 };
            const tp2 = { x: p1.x + dx * 0.60, y: p1.y + dy * 0.60 };

            // 2. 制御点の計算 (開始点・終了点よりさらに外側に振ることで丸みを作る)
            // ux, uy: 辺の単位方向ベクトル
            const ux = dx / length;
            const uy = dy / length;
            
            // cp1: tp1 から「戻る方向」かつ「外側」にオフセット
            const cp1 = {
                x: tp1.x - ux * tabSize * 0.8 + nx * tabSize * 2.0,
                y: tp1.y - uy * tabSize * 0.8 + ny * tabSize * 2.0
            };
            
            // cp2: tp2 から「進む方向」かつ「外側」にオフセット
            const cp2 = {
                x: tp2.x + ux * tabSize * 0.8 + nx * tabSize * 2.0,
                y: tp2.y + uy * tabSize * 0.8 + ny * tabSize * 2.0
            };

            // 直線 -> 単一ベジェ曲線 -> 直線
            // tp1, tp2 の付け根はあえてカドにする
            return `L ${tp1.x},${tp1.y} ` +
                   `C ${cp1.x},${cp1.y} ${cp2.x},${cp2.y} ${tp2.x},${tp2.y} ` +
                   `L ${p2.x},${p2.y} `;
        },

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
         * ピースのバウンディングボックスと描画パスを計算
         */
        computePieceGeometry: function(vertices, r, c, edgeData) {
            const tl = vertices[r][c];
            const tr = vertices[r][c + 1];
            const br = vertices[r + 1][c + 1];
            const bl = vertices[r + 1][c];

            // 辺のタイプを取得
            // top: r,c の上の辺 (horizontalEdges[r-1][c])
            // right: r,c の右の辺 (verticalEdges[r][c])
            // bottom: r,c の下の辺 (horizontalEdges[r][c])
            // left: r,c の左の辺 (verticalEdges[r][c-1])
            const { verticalEdges, horizontalEdges } = edgeData;
            const typeT = r > 0 ? horizontalEdges[r - 1][c] * -1 : 0; // 上のピースの下辺の逆
            const typeR = c < verticalEdges[0].length ? verticalEdges[r][c] : 0;
            const typeB = r < horizontalEdges.length ? horizontalEdges[r][c] : 0;
            const typeL = c > 0 ? verticalEdges[r][c - 1] * -1 : 0; // 左のピースの右辺の逆

            // 凹凸の飛び出し分を含めたバウンディングボックスの計算
            // タブのサイズを計算 (辺の長さに基づいて制限をかける)
            const edgeLen = Math.sqrt(Math.pow(tr.x - tl.x, 2) + Math.pow(tr.y - tl.y, 2));
            const tabSize = edgeLen * this.TAB_SIZE_RATIO * 1.5;
            
            let minX = Math.min(tl.x, tr.x, br.x, bl.x);
            let minY = Math.min(tl.y, tr.y, br.y, bl.y);
            let maxX = Math.max(tl.x, tr.x, br.x, bl.x);
            let maxY = Math.max(tl.y, tr.y, br.y, bl.y);

            // 飛び出しによる拡張（一律で拡張するのが安全）
            minX -= tabSize;
            minY -= tabSize;
            maxX += tabSize;
            maxY += tabSize;

            const w = maxX - minX;
            const h = maxY - minY;

            // 相対座標への変換
            const local = (p) => ({ x: p.x - minX, y: p.y - minY });
            const ltl = local(tl), ltr = local(tr), lbr = local(br), lbl = local(bl);

            // パスの構築
            let d = `M ${ltl.x},${ltl.y} `;
            d += this.drawJigsawSide(ltl, ltr, typeT);
            d += this.drawJigsawSide(ltr, lbr, typeR);
            d += this.drawJigsawSide(lbr, lbl, typeB);
            d += this.drawJigsawSide(lbl, ltl, typeL);
            d += "Z";

            // clip-path 用のポリゴン（近似）または SVG path を使用する
            // clip-path: path() は対応ブラウザに制限があるため、ここでは SVG の clipPath 要素を使用するように UI モジュールで対応
            
            const center = {
                x: (tl.x + tr.x + br.x + bl.x) / 4,
                y: (tl.y + tr.y + br.y + bl.y) / 4
            };

            return {
                bbox: { x: minX, y: minY, w, h },
                pathData: d,
                center,
                corners: { tl, tr, br, bl }
            };
        }
    };
})();
