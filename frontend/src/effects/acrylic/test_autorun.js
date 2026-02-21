export async function run(params, reportProgress) {
    let image = params.stroke_input.image_rgba;
    let transparentLayer = {
        width: image.width,
        height: image.height,
        data: new Uint8ClampedArray(image.width * image.height * 4),
    };
    if (reportProgress) reportProgress(0.5);
    if (reportProgress) reportProgress(1.0);
    return transparentLayer;
}
