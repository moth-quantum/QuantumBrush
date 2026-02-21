export function pointsWithinRadius(points, radius = 10, border = null, returnDistance = false) {
    let coords = [];
    let distances = [];
    if (points.length === 0) return returnDistance ? [coords, distances] : coords;

    let height = border ? border[0] : Infinity;
    let width = border ? border[1] : Infinity;
    let r2 = radius * radius;
    let rInt = Math.ceil(radius);

    let minDistMap;
    if (border) {
        minDistMap = new Float32Array(width * height);
        minDistMap.fill(Infinity);
    } else {
        minDistMap = new Map();
    }

    let boundStartX = Infinity, boundEndX = -Infinity;
    let boundStartY = Infinity, boundEndY = -Infinity;

    for (let i = 0; i < points.length; i++) {
        let px = points[i][0];
        let py = points[i][1];

        let startX = Math.max(0, Math.floor(px - rInt));
        let endX = Math.min(width - 1, Math.ceil(px + rInt));
        let startY = Math.max(0, Math.floor(py - rInt));
        let endY = Math.min(height - 1, Math.ceil(py + rInt));

        if (startX < boundStartX) boundStartX = startX;
        if (endX > boundEndX) boundEndX = endX;
        if (startY < boundStartY) boundStartY = startY;
        if (endY > boundEndY) boundEndY = endY;

        for (let y = startY; y <= endY; y++) {
            let dy = y - py;
            for (let x = startX; x <= endX; x++) {
                let dx = x - px;
                let dist2 = dy * dy + dx * dx;

                if (dist2 <= r2) {
                    if (border) {
                        let idx = y * width + x;
                        if (dist2 < minDistMap[idx]) {
                            minDistMap[idx] = dist2;
                        }
                    } else {
                        let key = y + ',' + x;
                        let currentDist2 = minDistMap.get(key);
                        if (currentDist2 === undefined || dist2 < currentDist2) {
                            minDistMap.set(key, dist2);
                        }
                    }
                }
            }
        }
    }

    if (border) {
        if (boundStartX !== Infinity) {
            for (let y = boundStartY; y <= boundEndY; y++) {
                for (let x = boundStartX; x <= boundEndX; x++) {
                    let idx = y * width + x;
                    let d2 = minDistMap[idx];
                    if (d2 !== Infinity) {
                        coords.push([y, x]);
                        if (returnDistance) distances.push(Math.sqrt(d2) / radius);
                    }
                }
            }
        }
    } else {
        for (let [key, d2] of minDistMap.entries()) {
            let parts = key.split(',');
            coords.push([parseInt(parts[0]), parseInt(parts[1])]);
            if (returnDistance) distances.push(Math.sqrt(d2) / radius);
        }
    }

    return returnDistance ? [coords, distances] : coords;
}

export function pointsWithinLasso(points, border = null) {
    if (points.length < 3) return [];

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (let p of points) {
        let x = p[0], y = p[1];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    }

    minX = Math.max(0, Math.floor(minX));
    maxX = Math.floor(maxX);
    minY = Math.max(0, Math.floor(minY));
    maxY = Math.floor(maxY);

    if (border) {
        let height = border[0], width = border[1];
        maxX = Math.min(maxX, width - 1);
        maxY = Math.min(maxY, height - 1);
    }

    let coords = [];

    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            let inside = false;
            for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
                let xi = points[i][0], yi = points[i][1];
                let xj = points[j][0], yj = points[j][1];

                let intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
                if (intersect) inside = !inside;
            }
            if (inside) {
                coords.push([y, x]);
            }
        }
    }
    return coords;
}

export function bresenhamLine(x1, y1, x2, y2) {
    let points = [];
    let dx = Math.abs(x2 - x1);
    let dy = Math.abs(y2 - y1);
    let sx = x1 < x2 ? 1 : -1;
    let sy = y1 < y2 ? 1 : -1;
    let err = (dx > dy ? dx : -dy) / 2.0;

    if (dx > dy) {
        err = dx / 2.0;
        while (x1 !== x2) {
            points.push([x1, y1]);
            err -= dy;
            if (err < 0) {
                y1 += sy;
                err += dx;
            }
            x1 += sx;
        }
    } else {
        err = dy / 2.0;
        while (y1 !== y2) {
            points.push([x1, y1]);
            err -= dx;
            if (err < 0) {
                x1 += sx;
                err += dy;
            }
            y1 += sy;
        }
    }
    points.push([x2, y2]);
    return points;
}

export function interpolatePixels(pixelList) {
    if (pixelList.length === 0) return [];
    let interpolated = [[pixelList[0][0], pixelList[0][1]]];
    let last = pixelList[0];

    for (let i = 1; i < pixelList.length; i++) {
        let px = pixelList[i];
        if (px[0] !== last[0] || px[1] !== last[1]) {
            let line = bresenhamLine(last[0], last[1], px[0], px[1]);
            for (let j = 1; j < line.length; j++) {
                interpolated.push(line[j]);
            }
            last = px;
        }
    }
    return interpolated;
}

export function splitPathFromClicks(path, clicks) {
    let splitPaths = [];
    let clickIndices = [];
    let c = 0;

    const arraysEqual = (a, b) => a[0] === b[0] && a[1] === b[1];

    for (let i = 0; i < path.length; i++) {
        if (arraysEqual(path[i], clicks[c])) {
            clickIndices.push(i);
            c++;
            if (c >= clicks.length) break;
        }
    }
    for (let idx = 0; idx < clickIndices.length; idx++) {
        let start = clickIndices[idx];
        let end = (idx + 1 < clickIndices.length) ? clickIndices[idx + 1] : path.length;
        let p = path.slice(start, end);
        let interpPath = interpolatePixels(p);
        splitPaths.push(interpPath);
    }
    return splitPaths;
}

export function getPatch(imageRgba, coords) {
    let patch = new Float32Array(coords.length * 4);
    for (let i = 0; i < coords.length; i++) {
        let y = coords[i][0];
        let x = coords[i][1];
        let idx = (y * imageRgba.width + x) * 4;
        patch[i * 4] = imageRgba.data[idx] / 255.0;
        patch[i * 4 + 1] = imageRgba.data[idx + 1] / 255.0;
        patch[i * 4 + 2] = imageRgba.data[idx + 2] / 255.0;
        patch[i * 4 + 3] = imageRgba.data[idx + 3] / 255.0;
    }
    return patch;
}

export function setPatch(imageRgba, coords, patch, blur = false, distance = null) {
    for (let i = 0; i < coords.length; i++) {
        let y = coords[i][0];
        let x = coords[i][1];
        let idx = (y * imageRgba.width + x) * 4;

        let origR = imageRgba.data[idx] / 255.0;
        let origG = imageRgba.data[idx + 1] / 255.0;
        let origB = imageRgba.data[idx + 2] / 255.0;

        let pR = patch[i * 4];
        let pG = patch[i * 4 + 1];
        let pB = patch[i * 4 + 2];
        let pA = patch[i * 4 + 3];

        if (blur && distance) {
            pA *= (1 - Math.exp(-Math.pow(Math.abs((distance[i] - 1) / 0.5), 4)));
        }

        let r = (1 - pA) * origR + pA * pR;
        let g = (1 - pA) * origG + pA * pG;
        let b = (1 - pA) * origB + pA * pB;

        imageRgba.data[idx] = r * 255;
        imageRgba.data[idx + 1] = g * 255;
        imageRgba.data[idx + 2] = b * 255;
    }
}
