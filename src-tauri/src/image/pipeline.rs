use image::{
    codecs::jpeg::JpegEncoder,
    codecs::png::{CompressionType, FilterType, PngEncoder},
    imageops, ColorType, DynamicImage, GenericImageView, ImageBuffer, ImageEncoder, Rgba, RgbaImage,
};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub struct Point2D {
    pub x: f64,
    pub y: f64,
}

impl Point2D {
    pub fn new(x: f64, y: f64) -> Self {
        Self { x, y }
    }

    pub fn distance_to(&self, other: &Point2D) -> f64 {
        let dx = other.x - self.x;
        let dy = other.y - self.y;
        (dx * dx + dy * dy).sqrt()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct QuadPoints {
    pub top_left: Point2D,
    pub top_right: Point2D,
    pub bottom_right: Point2D,
    pub bottom_left: Point2D,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CropRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ImageProcessOperation {
    WarpPerspective {
        quad: QuadPoints,
        max_dimension: Option<u32>,
        quality: Option<u8>,
        mime_type: Option<String>,
    },
    Crop {
        rect: CropRect,
        max_dimension: Option<u32>,
        quality: Option<u8>,
        mime_type: Option<String>,
    },
    Rotate {
        angle_deg: i32,
        quality: Option<u8>,
        mime_type: Option<String>,
    },
    Flip {
        horizontal: bool,
        vertical: bool,
        quality: Option<u8>,
        mime_type: Option<String>,
    },
    CropPolygon {
        points: Vec<Point2D>,
        max_dimension: Option<u32>,
        quality: Option<u8>,
        mime_type: Option<String>,
    },
    CropEllipse {
        cx: f64,
        cy: f64,
        rx: f64,
        ry: f64,
        max_dimension: Option<u32>,
        quality: Option<u8>,
        mime_type: Option<String>,
    },
    Resize {
        max_dimension: u32,
        quality: Option<u8>,
        mime_type: Option<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessImageRequest {
    pub source: String,
    pub operation: ImageProcessOperation,
    pub output_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessImageResponse {
    pub data_url: String,
    pub file_path: Option<String>,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadedImageFile {
    pub name: String,
    pub mime: String,
    pub file_path: String,
    pub width: Option<u32>,
    pub height: Option<u32>,
}

pub fn calculate_target_dimensions(quad: &QuadPoints, max_dimension: u32) -> (u32, u32) {
    let width_top = quad.top_left.distance_to(&quad.top_right);
    let width_bottom = quad.bottom_left.distance_to(&quad.bottom_right);
    let height_left = quad.top_left.distance_to(&quad.bottom_left);
    let height_right = quad.top_right.distance_to(&quad.bottom_right);

    let max_w = width_top.max(width_bottom);
    let max_h = height_left.max(height_right);

    let mut target_w = (max_w.round() as u32).max(10);
    let mut target_h = (max_h.round() as u32).max(10);

    let max_side = target_w.max(target_h);
    if max_side > max_dimension {
        let scale = max_dimension as f64 / max_side as f64;
        target_w = ((target_w as f64 * scale).round() as u32).max(10);
        target_h = ((target_h as f64 * scale).round() as u32).max(10);
    }

    (target_w, target_h)
}

pub fn load_image(source: &str) -> Result<DynamicImage, String> {
    if let Some(rest) = source.strip_prefix("data:") {
        let comma_pos = rest
            .find(',')
            .ok_or_else(|| "Неверный формат Data URL: отсутствует запятая".to_string())?;
        let base64_str = &rest[comma_pos + 1..];
        let bytes = base64_decode(base64_str.trim())
            .map_err(|e| format!("Ошибка декодирования Base64: {e}"))?;
        image::load_from_memory(&bytes)
            .map_err(|e| format!("Ошибка декодирования изображения: {e}"))
    } else {
        let p = Path::new(source);
        let file = fs::File::open(p)
            .map_err(|e| format!("Не удалось открыть изображение по пути {source}: {e}"))?;
        let reader = std::io::BufReader::with_capacity(1024 * 1024, file);
        let ext = p.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
        if ext == "tif" || ext == "tiff" {
            image::load(reader, image::ImageFormat::Tiff)
                .map_err(|e| format!("Ошибка декодирования TIFF {source}: {e}"))
        } else {
            image::ImageReader::new(reader)
                .with_guessed_format()
                .map_err(|e| format!("Ошибка определения формата изображения {source}: {e}"))?
                .decode()
                .map_err(|e| format!("Ошибка декодирования изображения {source}: {e}"))
        }
    }
}

pub fn calculate_homography_matrix(
    src: &[(f64, f64); 4],
    dst: &[(f64, f64); 4],
) -> Result<[f64; 9], String> {
    let mut a = [[0.0f64; 8]; 8];
    let mut b = [0.0f64; 8];

    for i in 0..4 {
        let (x, y) = src[i];
        let (u, v) = dst[i];

        a[2 * i][0] = x;
        a[2 * i][1] = y;
        a[2 * i][2] = 1.0;
        a[2 * i][3] = 0.0;
        a[2 * i][4] = 0.0;
        a[2 * i][5] = 0.0;
        a[2 * i][6] = -x * u;
        a[2 * i][7] = -y * u;
        b[2 * i] = u;

        a[2 * i + 1][0] = 0.0;
        a[2 * i + 1][1] = 0.0;
        a[2 * i + 1][2] = 0.0;
        a[2 * i + 1][3] = x;
        a[2 * i + 1][4] = y;
        a[2 * i + 1][5] = 1.0;
        a[2 * i + 1][6] = -x * v;
        a[2 * i + 1][7] = -y * v;
        b[2 * i + 1] = v;
    }

    let h = solve_linear_system_8x8(&mut a, &mut b)?;
    Ok([
        h[0], h[1], h[2],
        h[3], h[4], h[5],
        h[6], h[7], 1.0,
    ])
}

fn solve_linear_system_8x8(a: &mut [[f64; 8]; 8], b: &mut [f64; 8]) -> Result<[f64; 8], String> {
    let n = 8;
    for i in 0..n {
        let mut max_row = i;
        let mut max_val = a[i][i].abs();
        for k in (i + 1)..n {
            if a[k][i].abs() > max_val {
                max_val = a[k][i].abs();
                max_row = k;
            }
        }
        if max_val < 1e-12 {
            return Err("Матрица гомографии вырождена".to_string());
        }
        if max_row != i {
            a.swap(i, max_row);
            b.swap(i, max_row);
        }

        for k in (i + 1)..n {
            let factor = a[k][i] / a[i][i];
            for j in i..n {
                a[k][j] -= factor * a[i][j];
            }
            b[k] -= factor * b[i];
        }
    }

    let mut x = [0.0f64; 8];
    for i in (0..n).rev() {
        let mut sum = 0.0;
        for j in (i + 1)..n {
            sum += a[i][j] * x[j];
        }
        x[i] = (b[i] - sum) / a[i][i];
    }
    Ok(x)
}

pub fn invert_3x3(m: &[f64; 9]) -> Option<[f64; 9]> {
    let det = m[0] * (m[4] * m[8] - m[5] * m[7])
        - m[1] * (m[3] * m[8] - m[5] * m[6])
        + m[2] * (m[3] * m[7] - m[4] * m[6]);

    if det.abs() < 1e-12 {
        return None;
    }
    let inv_det = 1.0 / det;

    Some([
        (m[4] * m[8] - m[5] * m[7]) * inv_det,
        (m[2] * m[7] - m[1] * m[8]) * inv_det,
        (m[1] * m[5] - m[2] * m[4]) * inv_det,
        (m[5] * m[6] - m[3] * m[8]) * inv_det,
        (m[0] * m[8] - m[2] * m[6]) * inv_det,
        (m[2] * m[3] - m[0] * m[5]) * inv_det,
        (m[3] * m[7] - m[4] * m[6]) * inv_det,
        (m[1] * m[6] - m[0] * m[7]) * inv_det,
        (m[0] * m[4] - m[1] * m[3]) * inv_det,
    ])
}

pub fn warp_perspective(
    img: &DynamicImage,
    src_corners: &[(f64, f64); 4],
    target_width: u32,
    target_height: u32,
) -> Result<DynamicImage, String> {
    let dst_corners = [
        (0.0, 0.0),
        (target_width as f64 - 1.0, 0.0),
        (target_width as f64 - 1.0, target_height as f64 - 1.0),
        (0.0, target_height as f64 - 1.0),
    ];

    let h = calculate_homography_matrix(src_corners, &dst_corners)?;
    let h_inv = invert_3x3(&h).ok_or("Не удалось обратить матрицу гомографии")?;

    let src_w = img.width() as f64;
    let src_h = img.height() as f64;
    let rgba_img = img.to_rgba8();

    let rows: Vec<Vec<u8>> = (0..target_height)
        .into_par_iter()
        .map(|y| {
            let mut row = vec![0u8; target_width as usize * 4];
            let yd = y as f64;

            for x in 0..target_width {
                let xd = x as f64;
                let denom = h_inv[6] * xd + h_inv[7] * yd + h_inv[8];
                if denom.abs() > 1e-9 {
                    let xs = (h_inv[0] * xd + h_inv[1] * yd + h_inv[2]) / denom;
                    let ys = (h_inv[3] * xd + h_inv[4] * yd + h_inv[5]) / denom;

                    if xs >= 0.0 && xs < src_w - 1.0 && ys >= 0.0 && ys < src_h - 1.0 {
                        let x0 = xs.floor() as u32;
                        let y0 = ys.floor() as u32;
                        let x1 = x0 + 1;
                        let y1 = y0 + 1;

                        let fx = xs - x0 as f64;
                        let fy = ys - y0 as f64;

                        let p00 = rgba_img.get_pixel(x0, y0).0;
                        let p10 = rgba_img.get_pixel(x1, y0).0;
                        let p01 = rgba_img.get_pixel(x0, y1).0;
                        let p11 = rgba_img.get_pixel(x1, y1).0;

                        let offset = x as usize * 4;
                        for c in 0..4 {
                            let top = p00[c] as f64 * (1.0 - fx) + p10[c] as f64 * fx;
                            let bot = p01[c] as f64 * (1.0 - fx) + p11[c] as f64 * fx;
                            row[offset + c] = (top * (1.0 - fy) + bot * fy).clamp(0.0, 255.0) as u8;
                        }
                    }
                }
            }
            row
        })
        .collect();

    let mut out_buffer: ImageBuffer<Rgba<u8>, Vec<u8>> = ImageBuffer::new(target_width, target_height);
    for (y, row) in rows.into_iter().enumerate() {
        for x in 0..target_width {
            let offset = x as usize * 4;
            let pixel = Rgba([row[offset], row[offset + 1], row[offset + 2], row[offset + 3]]);
            out_buffer.put_pixel(x, y as u32, pixel);
        }
    }

    Ok(DynamicImage::ImageRgba8(out_buffer))
}

pub fn crop_image(img: &DynamicImage, rect: &CropRect) -> Result<RgbaImage, String> {
    let (src_w, src_h) = img.dimensions();

    let x = (rect.x.round() as i64).clamp(0, src_w as i64) as u32;
    let y = (rect.y.round() as i64).clamp(0, src_h as i64) as u32;
    let mut w = (rect.width.round() as u32).max(1);
    let mut h = (rect.height.round() as u32).max(1);

    if x + w > src_w {
        w = src_w.saturating_sub(x).max(1);
    }
    if y + h > src_h {
        h = src_h.saturating_sub(y).max(1);
    }

    let cropped = imageops::crop_imm(img, x, y, w, h).to_image();
    Ok(cropped)
}

pub fn rotate_image(img: &DynamicImage, angle_deg: i32) -> RgbaImage {
    let norm_angle = angle_deg.rem_euclid(360);
    match norm_angle {
        90 => imageops::rotate90(img),
        180 => imageops::rotate180(img),
        270 => imageops::rotate270(img),
        _ => img.to_rgba8(),
    }
}

pub fn flip_image(img: &DynamicImage, horizontal: bool, vertical: bool) -> RgbaImage {
    let mut res = img.to_rgba8();
    if horizontal {
        res = imageops::flip_horizontal(&res);
    }
    if vertical {
        res = imageops::flip_vertical(&res);
    }
    res
}

pub fn resize_image(img: &DynamicImage, max_dimension: u32) -> RgbaImage {
    let (w, h) = img.dimensions();
    if w <= max_dimension && h <= max_dimension {
        return img.to_rgba8();
    }
    let scale = max_dimension as f64 / (w.max(h) as f64);
    let target_w = ((w as f64 * scale).round() as u32).max(1);
    let target_h = ((h as f64 * scale).round() as u32).max(1);
    imageops::resize(img, target_w, target_h, imageops::FilterType::Lanczos3)
}

pub fn point_in_polygon(px: f64, py: f64, points: &[Point2D]) -> bool {
    let n = points.len();
    if n < 3 {
        return false;
    }
    let mut inside = false;
    let mut j = n - 1;
    for i in 0..n {
        let pi = &points[i];
        let pj = &points[j];
        if ((pi.y > py) != (pj.y > py))
            && (px < (pj.x - pi.x) * (py - pi.y) / (pj.y - pi.y + 1e-12) + pi.x)
        {
            inside = !inside;
        }
        j = i;
    }
    inside
}

pub fn crop_polygon(img: &DynamicImage, points: &[Point2D]) -> Result<RgbaImage, String> {
    if points.len() < 3 {
        return Err("Полигон должен содержать минимум 3 вершины".to_string());
    }
    let (src_w, src_h) = img.dimensions();
    let mut min_x = f64::MAX;
    let mut max_x = f64::MIN;
    let mut min_y = f64::MAX;
    let mut max_y = f64::MIN;

    for pt in points {
        min_x = min_x.min(pt.x);
        max_x = max_x.max(pt.x);
        min_y = min_y.min(pt.y);
        max_y = max_y.max(pt.y);
    }

    let bx0 = (min_x.floor() as i64).clamp(0, src_w as i64) as u32;
    let by0 = (min_y.floor() as i64).clamp(0, src_h as i64) as u32;
    let bx1 = (max_x.ceil() as i64).clamp(0, src_w as i64) as u32;
    let by1 = (max_y.ceil() as i64).clamp(0, src_h as i64) as u32;

    let target_w = bx1.saturating_sub(bx0).max(1);
    let target_h = by1.saturating_sub(by0).max(1);

    let cropped_box = imageops::crop_imm(img, bx0, by0, target_w, target_h).to_image();
    let mut dst = cropped_box;

    let row_stride = target_w as usize;
    let rows: Vec<Vec<u8>> = (0..target_h)
        .into_par_iter()
        .map(|y| {
            let mut row = vec![0u8; row_stride * 4];
            let py = by0 as f64 + y as f64 + 0.5;
            for x in 0..target_w {
                let px = bx0 as f64 + x as f64 + 0.5;
                let offset = x as usize * 4;
                if point_in_polygon(px, py, points) {
                    row[offset] = 255;
                }
            }
            row
        })
        .collect();

    for y in 0..target_h {
        let mask_row = &rows[y as usize];
        for x in 0..target_w {
            if mask_row[x as usize * 4] == 0 {
                let p = dst.get_pixel_mut(x, y);
                p.0[3] = 0;
            }
        }
    }

    Ok(dst)
}

pub fn crop_ellipse(
    img: &DynamicImage,
    cx: f64,
    cy: f64,
    rx: f64,
    ry: f64,
) -> Result<RgbaImage, String> {
    if rx <= 0.0 || ry <= 0.0 {
        return Err("Радиусы эллипса должны быть положительными".to_string());
    }
    let (src_w, src_h) = img.dimensions();

    let bx0 = ((cx - rx).floor() as i64).clamp(0, src_w as i64) as u32;
    let by0 = ((cy - ry).floor() as i64).clamp(0, src_h as i64) as u32;
    let bx1 = ((cx + rx).ceil() as i64).clamp(0, src_w as i64) as u32;
    let by1 = ((cy + ry).ceil() as i64).clamp(0, src_h as i64) as u32;

    let target_w = bx1.saturating_sub(bx0).max(1);
    let target_h = by1.saturating_sub(by0).max(1);

    let cropped_box = imageops::crop_imm(img, bx0, by0, target_w, target_h).to_image();
    let mut dst = cropped_box;

    let inv_rx2 = 1.0 / (rx * rx);
    let inv_ry2 = 1.0 / (ry * ry);

    for y in 0..target_h {
        let py = by0 as f64 + y as f64 + 0.5;
        let dy = py - cy;
        let dy_part = dy * dy * inv_ry2;
        for x in 0..target_w {
            let px = bx0 as f64 + x as f64 + 0.5;
            let dx = px - cx;
            if dx * dx * inv_rx2 + dy_part > 1.0 {
                let p = dst.get_pixel_mut(x, y);
                p.0[3] = 0;
            }
        }
    }

    Ok(dst)
}

pub fn detect_board_corners(img: &DynamicImage) -> [(f64, f64); 4] {
    let w = img.width() as f64;
    let h = img.height() as f64;

    [
        (w * 0.04, h * 0.04),
        (w * 0.96, h * 0.04),
        (w * 0.96, h * 0.96),
        (w * 0.04, h * 0.96),
    ]
}

pub fn encode_to_data_url(
    img: &RgbaImage,
    mime_type: Option<&str>,
    quality: Option<u8>,
) -> Result<String, String> {
    let mime = mime_type.unwrap_or("image/jpeg");
    let mut bytes = Vec::new();

    if mime == "image/png" {
        let encoder = PngEncoder::new(&mut bytes);
        encoder
            .write_image(
                img.as_raw(),
                img.width(),
                img.height(),
                ColorType::Rgba8.into(),
            )
            .map_err(|e| format!("Ошибка кодирования PNG: {e}"))?;
    } else {
        let q = quality.unwrap_or(94).clamp(1, 100);
        let rgb_img = DynamicImage::ImageRgba8(img.clone()).to_rgb8();
        let mut encoder = JpegEncoder::new_with_quality(&mut bytes, q);
        encoder
            .encode(
                rgb_img.as_raw(),
                rgb_img.width(),
                rgb_img.height(),
                ColorType::Rgb8.into(),
            )
            .map_err(|e| format!("Ошибка кодирования JPEG: {e}"))?;
    }

    let b64 = base64_encode(&bytes);
    Ok(format!("data:{mime};base64,{b64}"))
}

pub fn save_image_to_file(
    img: &RgbaImage,
    path: &Path,
    mime_type: Option<&str>,
    quality: Option<u8>,
) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let file = fs::File::create(path)
        .map_err(|e| format!("Не удалось создать файл для сохранения {}: {e}", path.display()))?;
    let mut writer = std::io::BufWriter::with_capacity(1024 * 1024, file);

    let is_png = if let Some(m) = mime_type {
        m == "image/png"
    } else {
        path.extension()
            .and_then(|e| e.to_str())
            .map(|s| s.eq_ignore_ascii_case("png"))
            .unwrap_or(false)
    };

    if is_png {
        let encoder = PngEncoder::new_with_quality(
            &mut writer,
            CompressionType::Fast,
            FilterType::NoFilter,
        );
        encoder
            .write_image(
                img.as_raw(),
                img.width(),
                img.height(),
                ColorType::Rgba8.into(),
            )
            .map_err(|e| format!("Ошибка записи PNG: {e}"))?;
    } else {
        let q = quality.unwrap_or(94).clamp(1, 100);
        let (w, h) = (img.width(), img.height());
        let raw_rgba = img.as_raw();
        let mut rgb_bytes = vec![0u8; (w * h * 3) as usize];
        rgb_bytes
            .par_chunks_exact_mut(3)
            .zip(raw_rgba.par_chunks_exact(4))
            .for_each(|(rgb, rgba)| {
                rgb[0] = rgba[0];
                rgb[1] = rgba[1];
                rgb[2] = rgba[2];
            });

        let mut encoder = JpegEncoder::new_with_quality(&mut writer, q);
        encoder
            .encode(
                &rgb_bytes,
                w,
                h,
                ColorType::Rgb8.into(),
            )
            .map_err(|e| format!("Ошибка записи JPEG: {e}"))?;
    }
    Ok(())
}

pub fn save_image_to_session_cache(
    img: &DynamicImage,
    session_dir: &Path,
    prefix: &str,
) -> Result<(String, PathBuf), String> {
    let images_dir = session_dir.join("images");
    fs::create_dir_all(&images_dir).map_err(|e| e.to_string())?;

    let filename = format!("{}_{}.png", prefix, Uuid::new_v4().simple());
    let dest_path = images_dir.join(&filename);

    img.save_with_format(&dest_path, image::ImageFormat::Png)
        .map_err(|e| format!("Ошибка сохранения изображения {}: {}", dest_path.display(), e))?;

    Ok((filename, dest_path))
}

pub fn process_image(
    req: ProcessImageRequest,
    session_cache_dir: &Path,
) -> Result<ProcessImageResponse, String> {
    let img = load_image(&req.source)?;

    let (res_img, out_mime, quality) = match req.operation {
        ImageProcessOperation::WarpPerspective {
            quad,
            max_dimension,
            quality,
            mime_type,
        } => {
            let max_dim = max_dimension.unwrap_or(32768);
            let (tw, th) = calculate_target_dimensions(&quad, max_dim);
            let corners = [
                (quad.top_left.x, quad.top_left.y),
                (quad.top_right.x, quad.top_right.y),
                (quad.bottom_right.x, quad.bottom_right.y),
                (quad.bottom_left.x, quad.bottom_left.y),
            ];
            let warped = warp_perspective(&img, &corners, tw, th)?;
            (warped.to_rgba8(), mime_type.unwrap_or_else(|| "image/jpeg".to_string()), quality)
        }
        ImageProcessOperation::Crop {
            rect,
            max_dimension,
            quality,
            mime_type,
        } => {
            let cropped = crop_image(&img, &rect)?;
            let final_img = if let Some(max_dim) = max_dimension {
                let dynamic = DynamicImage::ImageRgba8(cropped);
                resize_image(&dynamic, max_dim)
            } else {
                cropped
            };
            (final_img, mime_type.unwrap_or_else(|| "image/jpeg".to_string()), quality)
        }
        ImageProcessOperation::Rotate {
            angle_deg,
            quality,
            mime_type,
        } => {
            let rotated = rotate_image(&img, angle_deg);
            (rotated, mime_type.unwrap_or_else(|| "image/jpeg".to_string()), quality)
        }
        ImageProcessOperation::Flip {
            horizontal,
            vertical,
            quality,
            mime_type,
        } => {
            let flipped = flip_image(&img, horizontal, vertical);
            (flipped, mime_type.unwrap_or_else(|| "image/jpeg".to_string()), quality)
        }
        ImageProcessOperation::CropPolygon {
            points,
            max_dimension,
            quality,
            mime_type,
        } => {
            let poly_crop = crop_polygon(&img, &points)?;
            let final_img = if let Some(max_dim) = max_dimension {
                let dynamic = DynamicImage::ImageRgba8(poly_crop);
                resize_image(&dynamic, max_dim)
            } else {
                poly_crop
            };
            (final_img, mime_type.unwrap_or_else(|| "image/png".to_string()), quality)
        }
        ImageProcessOperation::CropEllipse {
            cx,
            cy,
            rx,
            ry,
            max_dimension,
            quality,
            mime_type,
        } => {
            let ell_crop = crop_ellipse(&img, cx, cy, rx, ry)?;
            let final_img = if let Some(max_dim) = max_dimension {
                let dynamic = DynamicImage::ImageRgba8(ell_crop);
                resize_image(&dynamic, max_dim)
            } else {
                ell_crop
            };
            (final_img, mime_type.unwrap_or_else(|| "image/png".to_string()), quality)
        }
        ImageProcessOperation::Resize {
            max_dimension,
            quality,
            mime_type,
        } => {
            let resized = resize_image(&img, max_dimension);
            (resized, mime_type.unwrap_or_else(|| "image/jpeg".to_string()), quality)
        }
    };

    let width = res_img.width();
    let height = res_img.height();

    let is_png = out_mime.contains("png");
    let ext = if is_png { "png" } else { "jpg" };

    let resolved_out_path = if let Some(ref p) = req.output_path {
        let pb = PathBuf::from(p);
        if pb.is_absolute() {
            pb
        } else {
            session_cache_dir.join("images").join(p)
        }
    } else {
        session_cache_dir
            .join("images")
            .join(format!("proc_{}_{}.{}", Uuid::new_v4().simple(), width, ext))
    };

    save_image_to_file(&res_img, &resolved_out_path, Some(&out_mime), quality)?;

    let file_path_str = resolved_out_path.to_string_lossy().to_string();
    let data_url = format!("data:{};base64,", out_mime);

    Ok(ProcessImageResponse {
        data_url,
        file_path: Some(file_path_str),
        width,
        height,
    })
}

pub fn read_image_file_info(path: &str, session_cache_dir: Option<&Path>) -> Result<LoadedImageFile, String> {
    let p = Path::new(path);
    if !p.is_file() {
        return Err(format!("Файл не существует или недоступен: {path}"));
    }
    let ext = p
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png")
        .to_lowercase();
    let name = p
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Image")
        .to_string();

    if ext == "tif" || ext == "tiff" {
        let file_meta = fs::metadata(p).ok();
        let file_len = file_meta.as_ref().map(|m| m.len()).unwrap_or(0);
        let mtime = file_meta
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);

        // Детерминированный хэш пути, размера и даты модификации
        let mut hasher = std::collections::hash_map::DefaultHasher::new();
        std::hash::Hash::hash(&path, &mut hasher);
        std::hash::Hash::hash(&file_len, &mut hasher);
        std::hash::Hash::hash(&mtime, &mut hasher);
        let hash_val = std::hash::Hasher::finish(&hasher);

        let cache_dir = if let Some(sd) = session_cache_dir {
            sd.join("images")
        } else {
            dirs::cache_dir()
                .unwrap_or_else(std::env::temp_dir)
                .join("mycad")
                .join("images")
        };
        let _ = fs::create_dir_all(&cache_dir);

        let cached_jpg = cache_dir.join(format!("tiff_{:016x}.jpg", hash_val));
        let cached_png = cache_dir.join(format!("tiff_{:016x}.png", hash_val));

        // Мгновенный возврат, если файл уже был сконвертирован в кэше
        if cached_jpg.is_file() {
            if let Ok((w, h)) = image::image_dimensions(&cached_jpg) {
                return Ok(LoadedImageFile {
                    name: format!("{name}.jpg"),
                    mime: "image/jpeg".to_string(),
                    file_path: cached_jpg.to_string_lossy().to_string(),
                    width: Some(w),
                    height: Some(h),
                });
            }
        }
        if cached_png.is_file() {
            if let Ok((w, h)) = image::image_dimensions(&cached_png) {
                return Ok(LoadedImageFile {
                    name: format!("{name}.png"),
                    mime: "image/png".to_string(),
                    file_path: cached_png.to_string_lossy().to_string(),
                    width: Some(w),
                    height: Some(h),
                });
            }
        }

        // Декодируем TIFF с ускоренным 1МБ буфером
        let dynamic_img = load_image(path)?;
        let rgba = dynamic_img.to_rgba8();
        let (w, h) = (rgba.width(), rgba.height());

        // Параллельная проверка на наличие прозрачных пикселей (сканы плат на 100% непрозрачны)
        let has_transparency = rgba
            .as_raw()
            .par_chunks_exact(4)
            .any(|c| c[3] < 255);

        if has_transparency {
            save_image_to_file(&rgba, &cached_png, Some("image/png"), None)?;
            return Ok(LoadedImageFile {
                name: format!("{name}.png"),
                mime: "image/png".to_string(),
                file_path: cached_png.to_string_lossy().to_string(),
                width: Some(w),
                height: Some(h),
            });
        } else {
            // Сохраняем в высококачественный JPEG (качество 95) — в 20-30 раз быстрее PNG!
            save_image_to_file(&rgba, &cached_jpg, Some("image/jpeg"), Some(95))?;
            return Ok(LoadedImageFile {
                name: format!("{name}.jpg"),
                mime: "image/jpeg".to_string(),
                file_path: cached_jpg.to_string_lossy().to_string(),
                width: Some(w),
                height: Some(h),
            });
        }
    }

    let mime = match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        "svg" => "image/svg+xml",
        _ => "application/octet-stream",
    }
    .to_string();

    let (width, height) = match image::image_dimensions(p) {
        Ok((w, h)) => (Some(w), Some(h)),
        Err(_) => (None, None),
    };

    Ok(LoadedImageFile {
        name: p
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(&name)
            .to_string(),
        mime,
        file_path: path.to_string(),
        width,
        height,
    })
}

pub fn base64_encode(bytes: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::with_capacity((bytes.len() + 2) / 3 * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0];
        let b1 = if chunk.len() > 1 { chunk[1] } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] } else { 0 };

        result.push(CHARS[(b0 >> 2) as usize] as char);
        result.push(CHARS[(((b0 & 0x03) << 4) | (b1 >> 4)) as usize] as char);
        if chunk.len() > 1 {
            result.push(CHARS[(((b1 & 0x0F) << 2) | (b2 >> 6)) as usize] as char);
        } else {
            result.push('=');
        }
        if chunk.len() > 2 {
            result.push(CHARS[(b2 & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
    }
    result
}

pub fn base64_decode(input: &str) -> Result<Vec<u8>, String> {
    fn decode_char(c: u8) -> Result<u8, String> {
        match c {
            b'A'..=b'Z' => Ok(c - b'A'),
            b'a'..=b'z' => Ok(c - b'a' + 26),
            b'0'..=b'9' => Ok(c - b'0' + 52),
            b'+' => Ok(62),
            b'/' => Ok(63),
            b'=' => Ok(0),
            _ => Err(format!("Недопустимый символ Base64: {}", c as char)),
        }
    }

    let clean: Vec<u8> = input
        .bytes()
        .filter(|&b| !b.is_ascii_whitespace())
        .collect();
    if clean.len() % 4 != 0 {
        return Err("Длина строки Base64 не кратна 4".to_string());
    }

    let mut out = Vec::with_capacity(clean.len() / 4 * 3);
    for chunk in clean.chunks_exact(4) {
        let c0 = decode_char(chunk[0])?;
        let c1 = decode_char(chunk[1])?;
        let c2 = decode_char(chunk[2])?;
        let c3 = decode_char(chunk[3])?;

        out.push((c0 << 2) | (c1 >> 4));
        if chunk[2] != b'=' {
            out.push(((c1 & 0x0F) << 4) | (c2 >> 2));
        }
        if chunk[3] != b'=' {
            out.push(((c2 & 0x03) << 6) | c3);
        }
    }
    Ok(out)
}
