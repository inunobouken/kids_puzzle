document.addEventListener('DOMContentLoaded', () => {
    const imageUpload = document.getElementById('image-upload');
    const startBtn = document.getElementById('start-btn');
    const puzzleContainer = document.getElementById('puzzle-container');
    const rowsInput = document.getElementById('rows');
    const colsInput = document.getElementById('cols');
    const clearMessage = document.getElementById('clear-message');
    const restartBtn = document.getElementById('restart-btn');

    const referenceImage = document.getElementById('reference-image');
    const referencePlaceholder = document.getElementById('reference-placeholder');
    const puzzleBoard = document.getElementById('puzzle-board');
    const puzzleFrame = document.getElementById('puzzle-frame');

    let pieces = [];
    let imageSrc = null;
    let imgWidth, imgHeight;
    let isDragging = false;
    let activePiece = null;
    let offset = { x: 0, y: 0 };
    let currentMaxZIndex = 10; // Z-Indexの管理用

    // 画像が選択された時の処理
    imageUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                imageSrc = event.target.result;
                // お手本を表示
                referenceImage.src = imageSrc;
                referenceImage.classList.remove('hidden');
                referencePlaceholder.classList.add('hidden');
            };
            reader.readAsDataURL(file);
        }
    });

    // スタートボタン
    startBtn.addEventListener('click', () => {
        if (!imageSrc) {
            alert('しゃしんをえらんでね！');
            return;
        }
        initPuzzle();
    });

    // リスタートボタン
    restartBtn.addEventListener('click', () => {
        clearMessage.classList.add('hidden');
        // お手本は残し、ピースだけ消去
        const existingPieces = puzzleBoard.querySelectorAll('.puzzle-piece');
        existingPieces.forEach(p => p.remove());
        puzzleFrame.style.width = '0';
        puzzleFrame.style.height = '0';
        // ガイドラインcanvasも消去
        const canvas = puzzleFrame.querySelector('canvas');
        if (canvas) canvas.remove();
    });

    /**
     * グリッド頂点を生成する。
     * 外周の頂点は固定し、内部の頂点はランダムにずらす。
     * @returns {Array<Array<{x: number, y: number}>>} (rows+1) x (cols+1) の頂点配列
     */
    function generateGridVertices(rows, cols, width, height) {
        const cellW = width / cols;
        const cellH = height / rows;
        // ずらし量の最大値（セルサイズの一定割合）
        const jitterRatioX = 0.25;
        const jitterRatioY = 0.25;

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
                    x += (Math.random() * 2 - 1) * cellW * jitterRatioX;
                }
                if (!isEdgeY) {
                    y += (Math.random() * 2 - 1) * cellH * jitterRatioY;
                }

                // 範囲内に収める
                x = Math.max(0, Math.min(width, x));
                y = Math.max(0, Math.min(height, y));

                row.push({ x, y });
            }
            vertices.push(row);
        }
        return vertices;
    }

    /**
     * 頂点の配列から角の丸まったSVGパス文字列(d属性用)を生成する
     */
    function generateRoundedPath(points, radius) {
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
    }


    /**
     * ピースのバウンディングボックスとclip-pathを計算
     * @returns {{ bbox: {x, y, w, h}, clipPath: string, center: {x, y} }}
     */
    function computePieceGeometry(vertices, r, c) {
        // 四隅の頂点（左上、右上、右下、左下）
        const tl = vertices[r][c];
        const tr = vertices[r][c + 1];
        const br = vertices[r + 1][c + 1];
        const bl = vertices[r + 1][c];

        // バウンディングボックス
        const minX = Math.min(tl.x, tr.x, br.x, bl.x);
        const minY = Math.min(tl.y, tr.y, br.y, bl.y);
        const maxX = Math.max(tl.x, tr.x, br.x, bl.x);
        const maxY = Math.max(tl.y, tr.y, br.y, bl.y);
        const w = maxX - minX;
        const h = maxY - minY;

        // clip-pathはバウンディングボックス内のローカル座標で指定（隙間ができないよう sharp polygon）
        const points = [tl, tr, br, bl].map(p => {
            const px = ((p.x - minX) / w) * 100;
            const py = ((p.y - minY) / h) * 100;
            return `${px.toFixed(2)}% ${py.toFixed(2)}%`;
        });
        const clipPath = `polygon(${points.join(', ')})`;

        // ピースの中心（4頂点の重心）
        const center = {
            x: (tl.x + tr.x + br.x + bl.x) / 4,
            y: (tl.y + tr.y + br.y + bl.y) / 4
        };

        // バウンディングボックス内のローカルピクセル座標（SVG描画用）
        const localPoints = [tl, tr, br, bl].map(p => ({
            x: p.x - minX,
            y: p.y - minY
        }));

        // 枠線用の角丸パス（半径10px）
        const borderPathData = generateRoundedPath(localPoints, 10);

        return {
            bbox: { x: minX, y: minY, w, h },
            clipPath,
            borderPathData,
            center,
            corners: { tl, tr, br, bl },
            localPoints
        };
    }

    async function initPuzzle() {
        // 既存のピースを削除
        const existingPieces = puzzleBoard.querySelectorAll('.puzzle-piece');
        existingPieces.forEach(p => p.remove());
        pieces = [];
        currentMaxZIndex = 10;

        const img = new Image();
        img.src = imageSrc;
        await img.decode();

        const rows = parseInt(rowsInput.value);
        const cols = parseInt(colsInput.value);

        // ボードのサイズに合わせて画像をフィットさせる（比率維持）
        const boardRect = puzzleBoard.getBoundingClientRect();
        // パディングをボードサイズに比例させる（スマホ対応）
        const padding = Math.max(15, Math.min(40, boardRect.width * 0.05));
        const availableWidth = boardRect.width - padding * 2;
        const availableHeight = boardRect.height - padding * 2;

        const ratio = Math.min(availableWidth / img.width, availableHeight / img.height);
        
        imgWidth = img.width * ratio;
        imgHeight = img.height * ratio;

        // 正解エリア（グレー背景）のサイズを設定
        puzzleFrame.style.width = `${imgWidth}px`;
        puzzleFrame.style.height = `${imgHeight}px`;

        // グリッド頂点を生成
        const vertices = generateGridVertices(rows, cols, imgWidth, imgHeight);

        // ガイドラインを描画
        drawGuideLinesScaled(vertices, rows, cols, imgWidth, imgHeight);

        // パズルボード内でのフレームの位置（中央寄せ）
        const frameX = (boardRect.width - imgWidth) / 2;
        const frameY = (boardRect.height - imgHeight) / 2;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const geom = computePieceGeometry(vertices, r, c);

                const piece = document.createElement('div');
                piece.className = 'puzzle-piece movable';
                piece.style.width = `${geom.bbox.w}px`;
                piece.style.height = `${geom.bbox.h}px`;
                piece.style.borderRadius = '0';

                // 画像レイヤー（ここを sharp polygon でクリップすることで隙間をなくす）
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

                // SVGオーバーレイで枠線を描画（piece直下に置くことでclipPathの影響を受けず、linejoin="round"が有効になる）
                const svgNS = 'http://www.w3.org/2000/svg';
                const svg = document.createElementNS(svgNS, 'svg');
                svg.setAttribute('width', geom.bbox.w);
                svg.setAttribute('height', geom.bbox.h);
                svg.setAttribute('viewBox', `0 0 ${geom.bbox.w} ${geom.bbox.h}`);
                svg.style.position = 'absolute';
                svg.style.top = '0';
                svg.style.left = '0';
                svg.style.pointerEvents = 'none';
                svg.style.overflow = 'visible'; // 枠線の丸みがはみ出せるように
                svg.classList.add('piece-border-svg');

                const pointsStr = geom.localPoints.map(p => `${p.x},${p.y}`).join(' ');

                // SVGの内部でクリップパスを定義（白線が外にはみ出ないようにするため）
                const defs = document.createElementNS(svgNS, 'defs');
                const clipPath = document.createElementNS(svgNS, 'clipPath');
                const clipId = `clip-${Math.random().toString(36).substr(2, 9)}`;
                clipPath.setAttribute('id', clipId);
                const clipPoly = document.createElementNS(svgNS, 'polygon');
                clipPoly.setAttribute('points', pointsStr);
                clipPath.appendChild(clipPoly);
                defs.appendChild(clipPath);
                svg.appendChild(defs);

                // 白の内側枠線（角丸パスを使用）
                const whiteLine = document.createElementNS(svgNS, 'path');
                whiteLine.setAttribute('d', geom.borderPathData);
                whiteLine.setAttribute('fill', 'none');
                whiteLine.setAttribute('stroke', 'white');
                whiteLine.setAttribute('stroke-width', '9');
                whiteLine.setAttribute('stroke-linejoin', 'round');
                whiteLine.setAttribute('clip-path', `url(#${clipId})`);
                svg.appendChild(whiteLine);

                // 黒の外側枠線（角丸パスを使用）
                const blackLine = document.createElementNS(svgNS, 'path');
                blackLine.setAttribute('d', geom.borderPathData);
                blackLine.setAttribute('fill', 'none');
                blackLine.setAttribute('stroke', 'black');
                blackLine.setAttribute('stroke-width', '3');
                blackLine.setAttribute('stroke-linejoin', 'round');
                svg.appendChild(blackLine);

                piece.appendChild(svg);

                // 正解の位置（パズルボード内の相対座標）
                const targetX = frameX + geom.bbox.x;
                const targetY = frameY + geom.bbox.y;

                // 初期配置：完成エリア（グレー部分）の外周にギリギリまで近づけて配置
                let initX, initY;
                const side = Math.floor(Math.random() * 4); // 0:上, 1:下, 2:左, 3:右
                // 散らばる範囲をボードサイズに比例させる（スマホ対応）
                const scatterRange = Math.max(10, Math.min(40, boardRect.width * 0.04));
                const scatterOffset = Math.max(3, Math.min(5, boardRect.width * 0.01));

                if (side === 0) { // 上
                    initX = frameX + Math.random() * imgWidth - geom.bbox.w / 2;
                    initY = frameY - geom.bbox.h - Math.random() * scatterRange - scatterOffset;
                } else if (side === 1) { // 下
                    initX = frameX + Math.random() * imgWidth - geom.bbox.w / 2;
                    initY = frameY + imgHeight + Math.random() * scatterRange + scatterOffset;
                } else if (side === 2) { // 左
                    initX = frameX - geom.bbox.w - Math.random() * scatterRange - scatterOffset;
                    initY = frameY + Math.random() * imgHeight - geom.bbox.h / 2;
                } else { // 右
                    initX = frameX + imgWidth + Math.random() * scatterRange + scatterOffset;
                    initY = frameY + Math.random() * imgHeight - geom.bbox.h / 2;
                }

                // ボード内に収まるようにclamp
                initX = Math.max(0, Math.min(initX, boardRect.width - geom.bbox.w));
                initY = Math.max(0, Math.min(initY, boardRect.height - geom.bbox.h));

                piece.style.left = `${initX}px`;
                piece.style.top = `${initY}px`;

                const pieceObj = {
                    element: piece,
                    targetX: targetX,
                    targetY: targetY,
                    bboxW: geom.bbox.w,
                    bboxH: geom.bbox.h,
                    isLocked: false
                };

                piece.addEventListener('pointerdown', (e) => onPointerDown(e, pieceObj));
                puzzleBoard.appendChild(piece);
                pieces.push(pieceObj);
            }
        }
    }

    /**
     * ガイドラインをcanvasに描画（displayサイズに合わせてスケーリング）
     */
    function drawGuideLinesScaled(vertices, rows, cols, displayW, displayH) {
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
    }

    function onPointerDown(e, pieceObj) {
        if (pieceObj.isLocked) return;
        e.preventDefault(); // タッチ操作時のページスクロール防止

        isDragging = true;
        activePiece = pieceObj;
        activePiece.element.setPointerCapture(e.pointerId);
        
        const rect = activePiece.element.getBoundingClientRect();
        offset.x = e.clientX - rect.left;
        offset.y = e.clientY - rect.top;

        // 最後に触ったピースを最前面にする
        currentMaxZIndex++;
        activePiece.element.style.zIndex = currentMaxZIndex;
        
        activePiece.element.addEventListener('pointermove', onPointerMove);
        activePiece.element.addEventListener('pointerup', onPointerUp);
    }

    function onPointerMove(e) {
        if (!isDragging || !activePiece) return;
        e.preventDefault(); // タッチ操作時のページスクロール防止

        const boardRect = puzzleBoard.getBoundingClientRect();
        let x = e.clientX - boardRect.left - offset.x;
        let y = e.clientY - boardRect.top - offset.y;

        const pw = activePiece.bboxW;
        const ph = activePiece.bboxH;

        // ボード外に出ないように制限
        x = Math.max(-pw / 2, Math.min(x, boardRect.width - pw / 2));
        y = Math.max(-ph / 2, Math.min(y, boardRect.height - ph / 2));

        activePiece.element.style.left = `${x}px`;
        activePiece.element.style.top = `${y}px`;
    }

    function onPointerUp(e) {
        if (!isDragging || !activePiece) return;

        const currentX = parseFloat(activePiece.element.style.left);
        const currentY = parseFloat(activePiece.element.style.top);

        const dist = Math.sqrt(
            Math.pow(currentX - activePiece.targetX, 2) + 
            Math.pow(currentY - activePiece.targetY, 2)
        );

        const threshold = Math.min(activePiece.bboxW, activePiece.bboxH) * 0.3; // スナップ判定を少し緩めに

        if (dist < threshold) {
            lockPiece(activePiece);
        }

        activePiece.element.releasePointerCapture(e.pointerId);
        activePiece.element.removeEventListener('pointermove', onPointerMove);
        activePiece.element.removeEventListener('pointerup', onPointerUp);
        
        isDragging = false;
        activePiece = null;

        checkClear();
    }

    function lockPiece(pieceObj) {
        pieceObj.isLocked = true;
        pieceObj.element.style.left = `${pieceObj.targetX}px`;
        pieceObj.element.style.top = `${pieceObj.targetY}px`;
        pieceObj.element.classList.remove('movable');
        pieceObj.element.classList.add('locked');
        
        // 枠線SVGを非表示にする
        const borderSvg = pieceObj.element.querySelector('.piece-border-svg');
        if (borderSvg) borderSvg.style.display = 'none';

        // 固定された時のプチ演出
        pieceObj.element.style.transform = 'scale(1)';
        pieceObj.element.style.zIndex = 1;
    }

    function checkClear() {
        const allLocked = pieces.every(p => p.isLocked);
        if (allLocked && pieces.length > 0) {
            setTimeout(() => {
                clearMessage.classList.remove('hidden');
            }, 500);
        }
    }
});
