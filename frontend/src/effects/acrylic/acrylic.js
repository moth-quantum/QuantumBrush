import * as utils from '../../utils/imageUtils.js';

export async function run(params, reportProgress) {
    console.log("[acrylic] Entering run()");
    let image = params.stroke_input.image_rgba;
    let radius = params.user_input.Radius;
    let path = params.stroke_input.path;
    let blur = params.user_input['Blur Edges'];
    let alpha = params.user_input.Alpha;
    let color = params.user_input.Color;

    console.log(`[acrylic] Path length: ${path.length}, Radius: ${radius}, Color: ${color}`);

    let r, g, b;
    if (typeof color === 'string') {
        r = parseInt(color.slice(1, 3), 16) / 255.0;
        g = parseInt(color.slice(3, 5), 16) / 255.0;
        b = parseInt(color.slice(5, 7), 16) / 255.0;
    } else {
        r = color[0] / 255.0; g = color[1] / 255.0; b = color[2] / 255.0;
    }

    let border = [image.height, image.width];
    console.log(`[acrylic] Finding points within radius...`);
    let res = utils.pointsWithinRadius(path, radius, border, true);
    let region = res[0];
    let distance = res[1];
    console.log(`[acrylic] Found ${region.length} points.`);

    if (reportProgress) reportProgress(0.5);

    let patch = utils.getPatch(image, region);
    for (let i = 0; i < region.length; i++) {
        patch[i * 4] = r;
        patch[i * 4 + 1] = g;
        patch[i * 4 + 2] = b;
        patch[i * 4 + 3] = alpha;
    }

    utils.setPatch(image, region, patch, blur, distance);
    console.log(`[acrylic] Patch applied successfully.`);

    if (reportProgress) reportProgress(1.0);
    return image;
}
