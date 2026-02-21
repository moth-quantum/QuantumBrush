export function rgbToHls(r, g, b) {
    let max = Math.max(r, g, b);
    let min = Math.min(r, g, b);
    let sumc = (max + min);
    let rangec = (max - min);
    let l = sumc / 2.0;
    if (min === max) return [0.0, l, 1.0];
    let s = (l <= 0.5) ? (rangec / sumc) : (rangec / (2.0 - max - min));
    let rc = (max - r) / rangec;
    let gc = (max - g) / rangec;
    let bc = (max - b) / rangec;
    let h;
    if (r === max) h = bc - gc;
    else if (g === max) h = 2.0 + rc - bc;
    else h = 4.0 + gc - rc;
    h = (h / 6.0) % 1.0;
    if (h < 0) h += 1.0;
    return [h, l, s];
}

export function hlsToRgb(h, l, s) {
    if (s === 0.0) return [l, l, l];
    let m2 = l <= 0.5 ? l * (1.0 + s) : l + s - (l * s);
    let m1 = 2.0 * l - m2;
    const v = (n1, n2, hue) => {
        hue = hue % 1.0;
        if (hue < 0) hue += 1.0;
        if (hue < 1.0 / 6.0) return n1 + (n2 - n1) * hue * 6.0;
        if (hue < 0.5) return n2;
        if (hue < 2.0 / 3.0) return n1 + (n2 - n1) * (2.0 / 3.0 - hue) * 6.0;
        return n1;
    };
    return [v(m1, m2, h + 1.0 / 3.0), v(m1, m2, h), v(m1, m2, h - 1.0 / 3.0)];
}

export function colorToSpherical(color) {
    let rgb = [color[0] / 255.0, color[1] / 255.0, color[2] / 255.0];
    let [hue, lightness, saturation] = rgbToHls(rgb[0], rgb[1], rgb[2]);
    let phi = 2 * Math.PI * hue;
    let theta = Math.PI * lightness;
    return [phi, theta, saturation];
}

export function rgbToHlsArray(rgba) {
    let hls = new Float32Array(rgba.length);
    for (let i = 0; i < rgba.length; i += 4) {
        let [h, l, s] = rgbToHls(rgba[i], rgba[i + 1], rgba[i + 2]);
        hls[i] = h;
        hls[i + 1] = l;
        hls[i + 2] = s;
        hls[i + 3] = rgba[i + 3];
    }
    return hls;
}

export function hlsToRgbArray(hls) {
    let rgb = new Float32Array(hls.length);
    for (let i = 0; i < hls.length; i += 4) {
        let [r, g, b] = hlsToRgb(hls[i], hls[i + 1], hls[i + 2]);
        rgb[i] = r;
        rgb[i + 1] = g;
        rgb[i + 2] = b;
        rgb[i + 3] = hls[i + 3];
    }
    return rgb;
}

export function rgbToHsv(r, g, b) {
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, v = max;
    let d = max - min;
    s = max === 0 ? 0 : d / max;
    if (max === min) h = 0;
    else {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [h, s, v];
}

export function hsvToRgb(h, s, v) {
    let r, g, b;
    let i = Math.floor(h * 6);
    let f = h * 6 - i;
    let p = v * (1 - s);
    let q = v * (1 - f * s);
    let t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }
    return [r, g, b];
}
