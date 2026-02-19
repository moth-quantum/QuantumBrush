use image::{GenericImageView, RgbaImage};
use std::path::Path;

/// Load an image from disk and return it as an RGBA image
pub fn load_image(path: &str) -> Result<RgbaImage, Box<dyn std::error::Error + Send + Sync>> {
    let img = image::open(Path::new(path))?.to_rgba8();
    Ok(img)
}

/// Alpha-blend a foreground image onto a background image
pub fn composite_images(
    background: &RgbaImage,
    foreground: &RgbaImage,
) -> Result<RgbaImage, Box<dyn std::error::Error + Send + Sync>> {
    let mut result = background.clone();

    let (fg_w, fg_h) = foreground.dimensions();
    let (bg_w, bg_h) = background.dimensions();

    let width = fg_w.min(bg_w);
    let height = fg_h.min(bg_h);

    for y in 0..height {
        for x in 0..width {
            let fg_pixel = foreground.get_pixel(x, y);
            if fg_pixel[3] > 0 {
                let bg_pixel = result.get_pixel(x, y);
                let blended = alpha_blend(bg_pixel, fg_pixel);
                result.put_pixel(x, y, blended);
            }
        }
    }

    Ok(result)
}

fn alpha_blend(
    bg: &image::Rgba<u8>,
    fg: &image::Rgba<u8>,
) -> image::Rgba<u8> {
    let fg_a = fg[3] as f32 / 255.0;
    let bg_a = bg[3] as f32 / 255.0;
    let out_a = fg_a + bg_a * (1.0 - fg_a);

    if out_a == 0.0 {
        return image::Rgba([0, 0, 0, 0]);
    }

    let r = ((fg[0] as f32 * fg_a + bg[0] as f32 * bg_a * (1.0 - fg_a)) / out_a) as u8;
    let g = ((fg[1] as f32 * fg_a + bg[1] as f32 * bg_a * (1.0 - fg_a)) / out_a) as u8;
    let b = ((fg[2] as f32 * fg_a + bg[2] as f32 * bg_a * (1.0 - fg_a)) / out_a) as u8;
    let a = (out_a * 255.0) as u8;

    image::Rgba([r, g, b, a])
}

/// Get image dimensions without loading the full image
pub fn get_image_dimensions(path: &str) -> Result<(u32, u32), Box<dyn std::error::Error + Send + Sync>> {
    let img = image::open(Path::new(path))?;
    Ok(img.dimensions())
}
