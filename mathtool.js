// mathtool.js

class DraggableGrid {
    constructor(container, options = {}) {
        this.rows = options.rows || 10;
        this.cols = options.cols || 10;
        this.cellSize = options.cellSize || 40;
        this.circleRadius = options.circleRadius || 14;
        this.gridPadding = options.gridPadding || 30;
        this.rectRadius = options.rectRadius || 30;
        this.redChipCount = options.redChipCount || 5;
        this.greenChipCount = options.greenChipCount || 2;
        this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(null));
        this.greenGrid = Array.from({ length: this.rows }, () => Array(this.cols).fill(null));
        this.container = container;
        this.dragged = null;
        this.init();
    }

    init() {
        // Create SVG
        const abacusWidth = this.cols * this.cellSize + this.gridPadding * 2;
        const abacusHeight = this.rows * this.cellSize + this.gridPadding * 2;
        const gap = 30;
        const width = abacusWidth * 2 + gap;
        const height = abacusHeight;
        this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.svg.setAttribute("width", width);
        this.svg.setAttribute("height", height);
        this.svg.style.display = "block";
        this.container.appendChild(this.svg);

        // Draw first abacus (red grid, left)
        const rect1 = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect1.setAttribute("x", 0);
        rect1.setAttribute("y", 0);
        rect1.setAttribute("width", abacusWidth);
        rect1.setAttribute("height", abacusHeight);
        rect1.setAttribute("rx", this.rectRadius);
        rect1.setAttribute("ry", this.rectRadius);
        rect1.setAttribute("fill", "#bbb");
        this.svg.appendChild(rect1);

        // Draw second abacus (green grid, right)
        const rect2 = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect2.setAttribute("x", abacusWidth + gap);
        rect2.setAttribute("y", 0);
        rect2.setAttribute("width", abacusWidth);
        rect2.setAttribute("height", abacusHeight);
        rect2.setAttribute("rx", this.rectRadius);
        rect2.setAttribute("ry", this.rectRadius);
        rect2.setAttribute("fill", "#bbb");
        this.svg.appendChild(rect2);

        // Draw column and row labels and grid lines for both abaci
        const labelFontSize = 14;
        const labelColor = "#222";
        const vertBarColor = "#afafaf"; // light grey
        const horizBarColor = "#797979"; // dark grey
        // For both abaci
        for (let abacusIdx = 0; abacusIdx < 2; abacusIdx++) {
            const abacusOffsetX = abacusIdx === 0 ? 0 : abacusWidth + gap;
            // Column labels and vertical bars
            for (let c = 0; c < this.cols; c++) {
                // Column label
                const colLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
                colLabel.setAttribute("x", abacusOffsetX + this.gridPadding + c * this.cellSize + this.cellSize / 2);
                colLabel.setAttribute("y", this.gridPadding - 8);
                colLabel.setAttribute("text-anchor", "middle");
                colLabel.setAttribute("font-size", labelFontSize);
                colLabel.setAttribute("fill", labelColor);
                colLabel.textContent = c + 1;
                this.svg.appendChild(colLabel);

                // Vertical bar (skip first col)
                if (c > 0) {
                    const bar = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                    bar.setAttribute("x", abacusOffsetX + this.gridPadding + c * this.cellSize - 2);
                    bar.setAttribute("y", this.gridPadding - 2);
                    bar.setAttribute("width", 4);
                    bar.setAttribute("height", this.rows * this.cellSize + 4);
                    bar.setAttribute("fill", vertBarColor);
                    this.svg.appendChild(bar);
                }
            }
            // Row labels and horizontal bars
            for (let r = 0; r < this.rows; r++) {
                // Row label
                const rowLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
                rowLabel.setAttribute("x", abacusOffsetX + this.gridPadding - 10);
                rowLabel.setAttribute("y", this.gridPadding + r * this.cellSize + this.cellSize / 2 + 5);
                rowLabel.setAttribute("text-anchor", "end");
                rowLabel.setAttribute("font-size", labelFontSize);
                rowLabel.setAttribute("fill", labelColor);
                rowLabel.textContent = r + 1;
                this.svg.appendChild(rowLabel);

                // Horizontal bar (skip first row)
                if (r > 0) {
                    const bar = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                    bar.setAttribute("x", abacusOffsetX + this.gridPadding - 2);
                    bar.setAttribute("y", this.gridPadding + r * this.cellSize - 2);
                    bar.setAttribute("width", this.cols * this.cellSize + 4);
                    bar.setAttribute("height", 4);
                    bar.setAttribute("fill", horizBarColor);
                    this.svg.appendChild(bar);
                }
            }
        }

        // Draw grid and red chips (left abacus)
        this.cellNodes = [];
        let placedRed = 0;
        for (let r = 0; r < this.rows; r++) {
            this.cellNodes[r] = [];
            for (let c = 0; c < this.cols; c++) {
                const cx = this.gridPadding + c * this.cellSize + this.cellSize / 2;
                const cy = this.gridPadding + r * this.cellSize + this.cellSize / 2;
                // Empty field (darkgrey circle)
                const field = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                field.setAttribute("cx", cx);
                field.setAttribute("cy", cy);
                field.setAttribute("r", this.circleRadius);
                field.setAttribute("fill", "#444");
                this.svg.appendChild(field);

                // Red draggable circle (only if we have chips left)
                let red = null;
                if (placedRed < this.redChipCount) {
                    red = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                    red.setAttribute("cx", cx);
                    red.setAttribute("cy", cy);
                    red.setAttribute("r", this.circleRadius - 4);
                    red.setAttribute("fill", "red");
                    red.setAttribute("cursor", "pointer");
                    red.setAttribute("data-row", r);
                    red.setAttribute("data-col", c);
                    red.setAttribute("data-color", "red");
                    red.setAttribute("data-abacus", "red");
                    red.setAttribute("class", "draggable");
                    this.svg.appendChild(red);
                    this.grid[r][c] = red;
                    placedRed++;
                } else {
                    this.grid[r][c] = null;
                }
                this.cellNodes[r][c] = { field, red };
            }
        }

        // Draw grid and green chips (right abacus)
        this.greenCellNodes = [];
        let placedGreen = 0;
        for (let r = 0; r < this.rows; r++) {
            this.greenCellNodes[r] = [];
            for (let c = 0; c < this.cols; c++) {
                const cx = abacusWidth + gap + this.gridPadding + c * this.cellSize + this.cellSize / 2;
                const cy = this.gridPadding + r * this.cellSize + this.cellSize / 2;
                // Empty field (darkgrey circle)
                const field = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                field.setAttribute("cx", cx);
                field.setAttribute("cy", cy);
                field.setAttribute("r", this.circleRadius);
                field.setAttribute("fill", "#444");
                this.svg.appendChild(field);

                // Green draggable circle (only if we have chips left)
                let green = null;
                if (placedGreen < this.greenChipCount) {
                    green = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                    green.setAttribute("cx", cx);
                    green.setAttribute("cy", cy);
                    green.setAttribute("r", this.circleRadius - 4);
                    green.setAttribute("fill", "green");
                    green.setAttribute("cursor", "pointer");
                    green.setAttribute("data-row", r);
                    green.setAttribute("data-col", c);
                    green.setAttribute("data-color", "green");
                    green.setAttribute("data-abacus", "green");
                    green.setAttribute("class", "draggable");
                    this.svg.appendChild(green);
                    this.greenGrid[r][c] = green;
                    placedGreen++;
                } else {
                    this.greenGrid[r][c] = null;
                }
                this.greenCellNodes[r][c] = { field, green };
            }
        }

        this.addDragHandlers();
    }

    addDragHandlers() {
        let offsetX, offsetY, origRow, origCol, origCircle, origAbacus, origColor;
        const svgRect = () => this.svg.getBoundingClientRect();

        const onPointerDown = (e) => {
            if (e.target.classList.contains("draggable")) {
                this.dragged = e.target;
                origRow = +this.dragged.getAttribute("data-row");
                origCol = +this.dragged.getAttribute("data-col");
                origAbacus = this.dragged.getAttribute("data-abacus");
                origColor = this.dragged.getAttribute("data-color");
                origCircle = this.dragged;
                const pt = this.svg.createSVGPoint();
                pt.x = e.clientX;
                pt.y = e.clientY;
                const svgP = pt.matrixTransform(this.svg.getScreenCTM().inverse());
                offsetX = svgP.x - +this.dragged.getAttribute("cx");
                offsetY = svgP.y - +this.dragged.getAttribute("cy");
                this.dragged.setAttribute("opacity", "0.7");
                this.svg.appendChild(this.dragged); // bring to front
                window.addEventListener("pointermove", onPointerMove);
                window.addEventListener("pointerup", onPointerUp);
            }
        };

        const onPointerMove = (e) => {
            if (!this.dragged) return;
            const pt = this.svg.createSVGPoint();
            pt.x = e.clientX;
            pt.y = e.clientY;
            const svgP = pt.matrixTransform(this.svg.getScreenCTM().inverse());
            this.dragged.setAttribute("cx", svgP.x - offsetX);
            this.dragged.setAttribute("cy", svgP.y - offsetY);
        };

        const onPointerUp = (e) => {
            if (!this.dragged) return;
            const pt = this.svg.createSVGPoint();
            pt.x = e.clientX;
            pt.y = e.clientY;
            const svgP = pt.matrixTransform(this.svg.getScreenCTM().inverse());

            // Determine which abacus the drop is closest to
            const abacusWidth = this.cols * this.cellSize + this.gridPadding * 2;
            const gap = 30;
            // Left abacus (red/green overlay)
            let minDistRed = Infinity, targetRowRed = null, targetColRed = null;
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    const cx = this.gridPadding + c * this.cellSize + this.cellSize / 2;
                    const cy = this.gridPadding + r * this.cellSize + this.cellSize / 2;
                    const dist = Math.hypot(svgP.x - cx, svgP.y - cy);
                    if (dist < minDistRed) {
                        minDistRed = dist;
                        targetRowRed = r;
                        targetColRed = c;
                    }
                }
            }
            // Right abacus (green only)
            let minDistGreen = Infinity, targetRowGreen = null, targetColGreen = null;
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    const cx = abacusWidth + gap + this.gridPadding + c * this.cellSize + this.cellSize / 2;
                    const cy = this.gridPadding + r * this.cellSize + this.cellSize / 2;
                    const dist = Math.hypot(svgP.x - cx, svgP.y - cy);
                    if (dist < minDistGreen) {
                        minDistGreen = dist;
                        targetRowGreen = r;
                        targetColGreen = c;
                    }
                }
            }

            // Dragging a green chip
            if (origColor === "green") {
                // If dropped on left abacus, allow overlay on red or empty
                if (minDistRed < minDistGreen) {
                    // Remove from old cell (could be left or right abacus)
                    if (origAbacus === "green") {
                        this.greenGrid[origRow][origCol] = null;
                    } else if (origAbacus === "red") {
                        this.greenGrid[origRow][origCol] = null;
                    }
                    // Place on left abacus if not already occupied by green
                    if (!this.greenGrid[targetRowRed][targetColRed]) {
                        const cx = this.gridPadding + targetColRed * this.cellSize + this.cellSize / 2;
                        const cy = this.gridPadding + targetRowRed * this.cellSize + this.cellSize / 2;
                        this.dragged.setAttribute("cx", cx);
                        this.dragged.setAttribute("cy", cy);
                        this.dragged.setAttribute("data-row", targetRowRed);
                        this.dragged.setAttribute("data-col", targetColRed);
                        this.dragged.setAttribute("data-abacus", "red");
                        // Overlay green chip on left abacus (even if red chip is present)
                        this.greenGrid[targetRowRed][targetColRed] = this.dragged;
                    } else {
                        // Snap back to original cell
                        let cx, cy;
                        if (origAbacus === "green") {
                            cx = abacusWidth + gap + this.gridPadding + origCol * this.cellSize + this.cellSize / 2;
                            cy = this.gridPadding + origRow * this.cellSize + this.cellSize / 2;
                        } else {
                            cx = this.gridPadding + origCol * this.cellSize + this.cellSize / 2;
                            cy = this.gridPadding + origRow * this.cellSize + this.cellSize / 2;
                        }
                        this.dragged.setAttribute("cx", cx);
                        this.dragged.setAttribute("cy", cy);
                        this.greenGrid[origRow][origCol] = this.dragged;
                    }
                } else {
                    // Snap to right abacus (green grid)
                    if (origAbacus === "green") {
                        this.greenGrid[origRow][origCol] = null;
                    } else if (origAbacus === "red") {
                        this.greenGrid[origRow][origCol] = null;
                    }
                    if (
                        this.greenGrid[targetRowGreen][targetColGreen] === null ||
                        this.greenGrid[targetRowGreen][targetColGreen] === this.dragged
                    ) {
                        const cx = abacusWidth + gap + this.gridPadding + targetColGreen * this.cellSize + this.cellSize / 2;
                        const cy = this.gridPadding + targetRowGreen * this.cellSize + this.cellSize / 2;
                        this.dragged.setAttribute("cx", cx);
                        this.dragged.setAttribute("cy", cy);
                        this.dragged.setAttribute("data-row", targetRowGreen);
                        this.dragged.setAttribute("data-col", targetColGreen);
                        this.dragged.setAttribute("data-abacus", "green");
                        this.greenGrid[targetRowGreen][targetColGreen] = this.dragged;
                    } else {
                        // Snap back to original cell
                        let cx, cy;
                        if (origAbacus === "green") {
                            cx = abacusWidth + gap + this.gridPadding + origCol * this.cellSize + this.cellSize / 2;
                            cy = this.gridPadding + origRow * this.cellSize + this.cellSize / 2;
                        } else {
                            cx = this.gridPadding + origCol * this.cellSize + this.cellSize / 2;
                            cy = this.gridPadding + origRow * this.cellSize + this.cellSize / 2;
                        }
                        this.dragged.setAttribute("cx", cx);
                        this.dragged.setAttribute("cy", cy);
                        this.greenGrid[origRow][origCol] = this.dragged;
                    }
                }
            }
            // Dragging a red chip (can only go on left abacus, not over green)
            else if (origColor === "red") {
                this.grid[origRow][origCol] = null;
                // Only allow if no green chip overlays the cell
                if (
                    (!this.greenGrid[targetRowRed][targetColRed]) &&
                    (this.grid[targetRowRed][targetColRed] === null || this.grid[targetRowRed][targetColRed] === this.dragged)
                ) {
                    const cx = this.gridPadding + targetColRed * this.cellSize + this.cellSize / 2;
                    const cy = this.gridPadding + targetRowRed * this.cellSize + this.cellSize / 2;
                    this.dragged.setAttribute("cx", cx);
                    this.dragged.setAttribute("cy", cy);
                    this.dragged.setAttribute("data-row", targetRowRed);
                    this.dragged.setAttribute("data-col", targetColRed);
                    this.dragged.setAttribute("data-abacus", "red");
                    this.grid[targetRowRed][targetColRed] = this.dragged;
                } else {
                    // Snap back to original cell
                    const cx = this.gridPadding + origCol * this.cellSize + this.cellSize / 2;
                    const cy = this.gridPadding + origRow * this.cellSize + this.cellSize / 2;
                    this.dragged.setAttribute("cx", cx);
                    this.dragged.setAttribute("cy", cy);
                    this.grid[origRow][origCol] = this.dragged;
                }
            }
            this.dragged.setAttribute("opacity", "1");
            this.dragged = null;
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerup", onPointerUp);
        };

        this.svg.addEventListener("pointerdown", onPointerDown);
    }
}

// Usage example:
// const container = document.getElementById('your-container');
// new DraggableGrid(container, { redChipCount: 5, greenChipCount: 7 });