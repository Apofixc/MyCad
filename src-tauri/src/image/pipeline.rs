use image::{
    codecs::jpeg::JpegEncoder,
    codecs::png::{CompressionType, FilterType, PngEncoder},
    imageops, ColorType, DynamicImage, GenericImageView, ImageEncoder, RgbaImage,
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
#[serde(rename_all = "camelCase")]
pub struct WarpOptions {
    pub max_dimension: Option<u32>,
    pub quality: Option<u8>,
    pub mime_type: Option<String>,
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

const CHARSET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

pub fn base64_encode(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0];
        let b1 = chunk.get(1).copied().unwrap_or(0);
        let b2 = chunk.get(2).copied().unwrap_or(0);
        out.push(CHARSET[(b0 >> 2) as usize] as char);
        out.push(CHARSET[(((b0 & 3) << 4) | (b1 >> 4)) as usize] as char);
        if chunk.len() > 1 {
            out.push(CHARSET[(((b1 & 0x0f) << 2) | (b2 >> 6)) as usize] as char);
        } else {
            out.push('=');
        }
        if chunk.len() > 2 {
            out.push(CHARSET[(b2 & 0x3f) as usize] as char);
        } else {
            out.push('=');
        }
    }
    out
}

pub fn base64_decode(input: &str) -> Result<Vec<u8>, String> {
    let mut table = [255u8; 256];
    for (i, &c) in CHARSET.iter().enumerate() {
        table[c as usize] = i as u8;
    }

    let input_bytes = input.as_bytes();
    let mut out = Vec::with_capacity(input_bytes.len() * 3 / 4);

    let mut buf = [0u8; 4];
    let mut buf_idx = 0;

    for &b in input_bytes {
        if b.is_ascii_whitespace() {
            continue;
        }
        if b == b'=' {
            buf[buf_idx] = 0;
            buf_idx += 1;
            if buf_idx == 4 {
                break;
            }
            continue;
        }

        let val = table[b as usize];
        if val == 255 {
            return Err(format!("Недопустимый символ base64: {}", b as char));
        }
        buf[buf_idx] = val;
        buf_idx += 1;

        if buf_idx == 4 {
            out.push((buf[0] << 2) | (buf[1] >> 4));
            out.push(((buf[1] & 0x0f) << 4) | (buf[2] >> 2));
            out.push(((buf[2] & 0x03) << 6) | buf[3]);
            buf_idx = 0;
        }
    }

    if buf_idx == 2 {
        out.push((buf[0] << 2) | (buf[1] >> 4));
    } else if buf_idx == 3 {
        out.push((buf[0] << 2) | (buf[1] >> 4));
        out.push(((buf[1] & 0x0f) << 4) | (buf[2] >> 2));
    }

    Ok(out)
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
        image::open(source)
            .map_err(|e| format!("Не удалось открыть изображение по пути {source}: {e}"))
    }
}

pub fn calculate_target_dimensions(quad: &QuadPoints, max_dimension: u32) -> (u32, u32) {
    let top_w = quad.top_left.distance_to(&quad.top_right);
    let bot_w = quad.bottom_left.distance_to(&quad.bottom_right);
    let avg_w = (top_w + bot_w) / 2.0;

    let left_h = quad.top_left.distance_to(&quad.bottom_left);
    let right_h = quad.top_right.distance_to(&quad.bottom_right);
    let avg_h = (left_h + right_h) / 2.0;

    let raw_w = avg_w.round().max(1.0) as u32;
    let raw_h = avg_h.round().max(1.0) as u32;

    let max_side = raw_w.max(raw_h);
    if max_side > max_dimension {
        let scale = max_dimension as f64 / max_side as f64;
        (
            ((raw_w as f64 * scale).round() as u32).max(1),
            ((raw_h as f64 * scale).round() as u32).max(1),
        )
    } else {
        (raw_w, raw_h)
    }
}

pub fn warp_perspective(
    img: &DynamicImage,
    quad: &QuadPoints,
    options: Option<&WarpOptions>,
) -> Result<RgbaImage, String> {
    let max_dim = options.and_then(|o| o.max_dimension).unwrap_or(32768);
    let (target_w, target_h) = calculate_target_dimensions(quad, max_dim);

    let (src_w, src_h) = img.dimensions();
    let rgba_src = img.to_rgba8();
    let src_raw = rgba_src.as_raw();

    let x0 = quad.top_left.x;
    let y0 = quad.top_left.y;
    let x1 = quad.top_right.x;
    let y1 = quad.top_right.y;
    let x2 = quad.bottom_right.x;
    let y2 = quad.bottom_right.y;
    let x3 = quad.bottom_left.x;
    let y3 = quad.bottom_left.y;

    let dx1 = x1 - x2;
    let dx2 = x3 - x2;
    let sx = x0 - x1 + x2 - x3;

    let dy1 = y1 - y2;
    let dy2 = y3 - y2;
    let sy = y0 - y1 + y2 - y3;

    let det = dx1 * dy2 - dx2 * dy1;

    let (a, b, c, d, e, f, g, h);

    if det.abs() < 1e-7 || (sx.abs() < 1e-7 && sy.abs() < 1e-7) {
        a = x1 - x0;
        b = x3 - x0;
        c = x0;
        d = y1 - y0;
        e = y3 - y0;
        f = y0;
        g = 0.0;
        h = 0.0;
    } else {
        g = (sx * dy2 - sy * dx2) / det;
        h = (dx1 * sy - dy1 * sx) / det;
        a = x1 - x0 + g * x1;
        b = x3 - x0 + h * x3;
        c = x0;
        d = y1 - y0 + g * y1;
        e = y3 - y0 + h * y3;
        f = y0;
    }

    let inv_w = 1.0 / target_w as f64;
    let inv_h = 1.0 / target_h as f64;
    let src_w_f = src_w as f64;
    let src_h_f = src_h as f64;
    let src_w_usize = src_w as usize;

    let mut dst_buffer = vec![0u8; (target_w * target_h * 4) as usize];
    let row_stride = (target_w * 4) as usize;

    dst_buffer
        .par_chunks_exact_mut(row_stride)
        .enumerate()
        .for_each(|(yd, row)| {
            let v = (yd as f64 + 0.5) * inv_h;
            let bv_c = b * v + c;
            let ev_f = e * v + f;
            let hv_1 = h * v + 1.0;

            for xd in 0..target_w as usize {
                let u = (xd as f64 + 0.5) * inv_w;
                let denom = g * u + hv_1;
                let inv_denom = if denom.abs() > 1e-7 { 1.0 / denom } else { 1.0 };

                let xs = (a * u + bv_c) * inv_denom;
                let ys = (d * u + ev_f) * inv_denom;

                let pixel_offset = xd * 4;

                if xs >= 0.0 && xs < src_w_f - 1.0 && ys >= 0.0 && ys < src_h_f - 1.0 {
                    let x_floor = xs.floor() as usize;
                    let y_floor = ys.floor() as usize;
                    let fx = xs - (x_floor as f64);
                    let fy = ys - (y_floor as f64);
                    let ifx = 1.0 - fx;
                    let ify = 1.0 - fy;

                    let w00 = ifx * ify;
                    let w10 = fx * ify;
                    let w01 = ifx * fy;
                    let w11 = fx * fy;

                    let row0 = y_floor * src_w_usize;
                    let row1 = (y_floor + 1) * src_w_usize;
                    let idx00 = (row0 + x_floor) * 4;
                    let idx10 = (row0 + x_floor + 1) * 4;
                    let idx01 = (row1 + x_floor) * 4;
                    let idx11 = (row1 + x_floor + 1) * 4;

                    for ch in 0..4 {
                        let val = src_raw[idx00 + ch] as f64 * w00
                            + src_raw[idx10 + ch] as f64 * w10
                            + src_raw[idx01 + ch] as f64 * w01
                            + src_raw[idx11 + ch] as f64 * w11;
                        row[pixel_offset + ch] = val.round().clamp(0.0, 255.0) as u8;
                    }
                } else if xs >= -0.5 && xs < src_w_f && ys >= -0.5 && ys < src_h_f {
                    let cl_x = (xs.round() as usize).clamp(0, src_w_usize - 1);
                    let cl_y = (ys.round() as usize).clamp(0, src_h as usize - 1);
                    let idx = (cl_y * src_w_usize + cl_x) * 4;
                    row[pixel_offset..pixel_offset + 4].copy_from_slice(&src_raw[idx..idx + 4]);
                } else {
                    row[pixel_offset + 3] = 0;
                }
            }
        });

    RgbaImage::from_raw(target_w, target_h, dst_buffer)
        .ok_or_else(|| "Не удалось создать целевой буфер изображения".to_string())
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
    let norm_angle = ((angle_deg % 360) + 360) % 360;
    match norm_angle {
        90 => imageops::rotate90(img),
        180 => imageops::rotate180(img),
        270 => imageops::rotate270(img),
        _ => img.to_rgba8(),
    }
}

pub fn flip_image(img: &DynamicImage, horizontal: bool, vertical: bool) -> RgbaImage {
    let mut current = img.to_rgba8();
    if horizontal {
        current = imageops::flip_horizontal(&current);
    }
    if vertical {
        current = imageops::flip_vertical(&current);
    }
    current
}

pub fn point_in_polygon(px: f64, py: f64, points: &[Point2D]) -> bool {
    let mut inside = false;
    let n = points.len();
    if n < 3 {
        return false;
    }
    let mut j = n - 1;
    for i in 0..n {
        let xi = points[i].x;
        let yi = points[i].y;
        let xj = points[j].x;
        let yj = points[j].y;

        let intersect = ((yi > py) != (yj > py))
            && (px < (xj - xi) * (py - yi) / (yj - yi + 1e-12) + xi);
        if intersect {
            inside = !inside;
        }
        j = i;
    }
    inside
}

pub fn crop_polygon(
    img: &DynamicImage,
    points: &[Point2D],
    max_dimension: Option<u32>,
) -> Result<RgbaImage, String> {
    if points.len() < 3 {
        return Err("Многоугольник должен содержать не менее 3 точек".to_string());
    }
    let (src_w, src_h) = img.dimensions();
    let mut min_x = f64::INFINITY;
    let mut min_y = f64::INFINITY;
    let mut max_x = f64::NEG_INFINITY;
    let mut max_y = f64::NEG_INFINITY;
    for pt in points {
        min_x = min_x.min(pt.x);
        min_y = min_y.min(pt.y);
        max_x = max_x.max(pt.x);
        max_y = max_y.max(pt.y);
    }
    let box_x0 = (min_x.floor() as i64).clamp(0, src_w as i64) as u32;
    let box_y0 = (min_y.floor() as i64).clamp(0, src_h as i64) as u32;
    let box_x1 = (max_x.ceil() as i64).clamp(0, src_w as i64) as u32;
    let box_y1 = (max_y.ceil() as i64).clamp(0, src_h as i64) as u32;
    let box_w = (box_x1.saturating_sub(box_x0)).max(1);
    let box_h = (box_y1.saturating_sub(box_y0)).max(1);

    let max_dim = max_dimension.unwrap_or(32768);
    let max_side = box_w.max(box_h);
    let scale = if max_side > max_dim {
        max_dim as f64 / max_side as f64
    } else {
        1.0
    };
    let target_w = ((box_w as f64 * scale).round() as u32).max(1);
    let target_h = ((box_h as f64 * scale).round() as u32).max(1);

    let src_rgba = img.to_rgba8();
    let mut dst_buffer = vec![0u8; (target_w * target_h * 4) as usize];
    let row_stride = (target_w * 4) as usize;

    let inv_scale = 1.0 / scale;

    dst_buffer
        .par_chunks_exact_mut(row_stride)
        .enumerate()
        .for_each(|(yd, row)| {
            let ys = box_y0 as f64 + (yd as f64 + 0.5) * inv_scale;
            for xd in 0..target_w as usize {
                let xs = box_x0 as f64 + (xd as f64 + 0.5) * inv_scale;
                let pixel_offset = xd * 4;
                if point_in_polygon(xs, ys, points) {
                    let cl_x = (xs.round() as u32).min(src_w - 1);
                    let cl_y = (ys.round() as u32).min(src_h - 1);
                    let pixel = src_rgba.get_pixel(cl_x, cl_y);
                    row[pixel_offset..pixel_offset + 4].copy_from_slice(&pixel.0);
                } else {
                    row[pixel_offset + 3] = 0;
                }
            }
        });

    RgbaImage::from_raw(target_w, target_h, dst_buffer)
        .ok_or_else(|| "Не удалось создать целевой буфер изображения".to_string())
}

pub fn crop_ellipse(
    img: &DynamicImage,
    cx: f64,
    cy: f64,
    rx: f64,
    ry: f64,
    max_dimension: Option<u32>,
) -> Result<RgbaImage, String> {
    if rx <= 0.0 || ry <= 0.0 {
        return Err("Радиус эллипса должен быть больше 0".to_string());
    }
    let (src_w, src_h) = img.dimensions();
    let box_x0 = ((cx - rx).floor() as i64).clamp(0, src_w as i64) as u32;
    let box_y0 = ((cy - ry).floor() as i64).clamp(0, src_h as i64) as u32;
    let box_x1 = ((cx + rx).ceil() as i64).clamp(0, src_w as i64) as u32;
    let box_y1 = ((cy + ry).ceil() as i64).clamp(0, src_h as i64) as u32;
    let box_w = (box_x1.saturating_sub(box_x0)).max(1);
    let box_h = (box_y1.saturating_sub(box_y0)).max(1);

    let max_dim = max_dimension.unwrap_or(32768);
    let max_side = box_w.max(box_h);
    let scale = if max_side > max_dim {
        max_dim as f64 / max_side as f64
    } else {
        1.0
    };
    let target_w = ((box_w as f64 * scale).round() as u32).max(1);
    let target_h = ((box_h as f64 * scale).round() as u32).max(1);

    let src_rgba = img.to_rgba8();
    let mut dst_buffer = vec![0u8; (target_w * target_h * 4) as usize];
    let row_stride = (target_w * 4) as usize;

    let inv_scale = 1.0 / scale;
    let inv_rx = 1.0 / rx;
    let inv_ry = 1.0 / ry;

    dst_buffer
        .par_chunks_exact_mut(row_stride)
        .enumerate()
        .for_each(|(yd, row)| {
            let ys = box_y0 as f64 + (yd as f64 + 0.5) * inv_scale;
            let dy = (ys - cy) * inv_ry;
            let dy2 = dy * dy;

            for xd in 0..target_w as usize {
                let xs = box_x0 as f64 + (xd as f64 + 0.5) * inv_scale;
                let dx = (xs - cx) * inv_rx;
                let dist_sq = dx * dx + dy2;

                let pixel_offset = xd * 4;
                if dist_sq <= 1.0 {
                    let cl_x = (xs.round() as u32).min(src_w - 1);
                    let cl_y = (ys.round() as u32).min(src_h - 1);
                    let pixel = src_rgba.get_pixel(cl_x, cl_y);
                    row[pixel_offset..pixel_offset + 4].copy_from_slice(&pixel.0);
                } else {
                    row[pixel_offset + 3] = 0;
                }
            }
        });

    RgbaImage::from_raw(target_w, target_h, dst_buffer)
        .ok_or_else(|| "Не удалось создать целевой буфер изображения".to_string())
}

pub fn detect_board_corners(source: &str) -> Result<QuadPoints, String> {
    let img = load_image(source)?;
    let (orig_w, orig_h) = img.dimensions();

    if orig_w == 0 || orig_h == 0 {
        return Err("Изображение имеет нулевой размер".to_string());
    }

    let fallback = QuadPoints {
        top_left: Point2D::new(orig_w as f64 * 0.05, orig_h as f64 * 0.05),
        top_right: Point2D::new(orig_w as f64 * 0.95, orig_h as f64 * 0.05),
        bottom_right: Point2D::new(orig_w as f64 * 0.95, orig_h as f64 * 0.95),
        bottom_left: Point2D::new(orig_w as f64 * 0.05, orig_h as f64 * 0.95),
    };

    let max_analysis_dim = 800u32;
    let max_side = orig_w.max(orig_h);
    let scale = if max_side > max_analysis_dim {
        max_analysis_dim as f64 / max_side as f64
    } else {
        1.0
    };

    let ana_w = ((orig_w as f64 * scale).round() as u32).max(10);
    let ana_h = ((orig_h as f64 * scale).round() as u32).max(10);

    let small_rgb = img.thumbnail(ana_w, ana_h).to_rgb8();
    let (sw, sh) = small_rgb.dimensions();
    if sw < 10 || sh < 10 {
        return Ok(fallback);
    }

    let mut bg_r_sum: u64 = 0;
    let mut bg_g_sum: u64 = 0;
    let mut bg_b_sum: u64 = 0;
    let mut bg_count: u64 = 0;

    for x in 0..sw {
        let p0 = small_rgb.get_pixel(x, 0);
        let p1 = small_rgb.get_pixel(x, sh - 1);
        bg_r_sum += p0[0] as u64 + p1[0] as u64;
        bg_g_sum += p0[1] as u64 + p1[1] as u64;
        bg_b_sum += p0[2] as u64 + p1[2] as u64;
        bg_count += 2;
    }
    for y in 1..(sh - 1) {
        let p0 = small_rgb.get_pixel(0, y);
        let p1 = small_rgb.get_pixel(sw - 1, y);
        bg_r_sum += p0[0] as u64 + p1[0] as u64;
        bg_g_sum += p0[1] as u64 + p1[1] as u64;
        bg_b_sum += p0[2] as u64 + p1[2] as u64;
        bg_count += 2;
    }

    let bg_r = (bg_r_sum / bg_count.max(1)) as i32;
    let bg_g = (bg_g_sum / bg_count.max(1)) as i32;
    let bg_b = (bg_b_sum / bg_count.max(1)) as i32;

    let diff_threshold = 28;
    let mut mask = vec![0u8; (sw * sh) as usize];

    for y in 0..sh {
        for x in 0..sw {
            let p = small_rgb.get_pixel(x, y);
            let diff = (p[0] as i32 - bg_r).abs()
                + (p[1] as i32 - bg_g).abs()
                + (p[2] as i32 - bg_b).abs();
            if diff > diff_threshold {
                mask[(y * sw + x) as usize] = 1;
            }
        }
    }

    let mut row_sums = vec![0u32; sh as usize];
    for y in 0..sh as usize {
        let mut count = 0;
        for x in 0..sw as usize {
            if mask[y * sw as usize + x] == 1 {
                count += 1;
            }
        }
        row_sums[y] = count;
    }

    let mut col_sums = vec![0u32; sw as usize];
    for x in 0..sw as usize {
        let mut count = 0;
        for y in 0..sh as usize {
            if mask[y * sw as usize + x] == 1 {
                count += 1;
            }
        }
        col_sums[x] = count;
    }

    let min_board_density = (sw.min(sh) as f64 * 0.08) as u32;

    let y_start = row_sums.iter().position(|&s| s > min_board_density).unwrap_or(0);
    let y_end = row_sums.iter().rposition(|&s| s > min_board_density).unwrap_or(sh as usize - 1);

    let x_start = col_sums.iter().position(|&s| s > min_board_density).unwrap_or(0);
    let x_end = col_sums.iter().rposition(|&s| s > min_board_density).unwrap_or(sw as usize - 1);

    if (x_end <= x_start + 10) || (y_end <= y_start + 10) {
        return Ok(fallback);
    }

    let inv_scale = 1.0 / scale;
    let orig_x0 = (x_start as f64 * inv_scale).clamp(0.0, orig_w as f64);
    let orig_y0 = (y_start as f64 * inv_scale).clamp(0.0, orig_h as f64);
    let orig_x1 = (x_end as f64 * inv_scale).clamp(0.0, orig_w as f64);
    let orig_y1 = (y_end as f64 * inv_scale).clamp(0.0, orig_h as f64);

    Ok(QuadPoints {
        top_left: Point2D::new(orig_x0, orig_y0),
        top_right: Point2D::new(orig_x1, orig_y0),
        bottom_right: Point2D::new(orig_x1, orig_y1),
        bottom_left: Point2D::new(orig_x0, orig_y1),
    })
}

pub fn encode_to_data_url(
    img: &DynamicImage,
    mime_type: &str,
    quality: u8,
) -> Result<String, String> {
    let mut bytes = Vec::new();
    let is_jpeg = mime_type == "image/jpeg" || mime_type == "image/jpg";

    if is_jpeg {
        let rgb_img = img.to_rgb8();
        let encoder = JpegEncoder::new_with_quality(&mut bytes, quality);
        encoder
            .write_image(
                rgb_img.as_raw(),
                rgb_img.width(),
                rgb_img.height(),
                ColorType::Rgb8.into(),
            )
            .map_err(|e| format!("Ошибка кодирования JPEG: {e}"))?;
        Ok(format!("data:image/jpeg;base64,{}", base64_encode(&bytes)))
    } else {
        let rgba_img = img.to_rgba8();
        let encoder = PngEncoder::new_with_quality(
            &mut bytes,
            CompressionType::Fast,
            FilterType::NoFilter,
        );
        encoder
            .write_image(
                rgba_img.as_raw(),
                rgba_img.width(),
                rgba_img.height(),
                ColorType::Rgba8.into(),
            )
            .map_err(|e| format!("Ошибка кодирования PNG: {e}"))?;
        Ok(format!("data:image/png;base64,{}", base64_encode(&bytes)))
    }
}

pub fn save_image_to_file(
    img: &DynamicImage,
    path: &Path,
    mime_type: &str,
    quality: u8,
) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Ошибка создания папки: {e}"))?;
    }

    let is_jpeg = mime_type == "image/jpeg" || mime_type == "image/jpg";
    let file = fs::File::create(path).map_err(|e| format!("Ошибка создания файла: {e}"))?;
    let mut writer = std::io::BufWriter::new(file);

    if is_jpeg {
        let rgb_img = img.to_rgb8();
        let encoder = JpegEncoder::new_with_quality(&mut writer, quality);
        encoder
            .write_image(
                rgb_img.as_raw(),
                rgb_img.width(),
                rgb_img.height(),
                ColorType::Rgb8.into(),
            )
            .map_err(|e| format!("Ошибка сохранения JPEG: {e}"))?;
    } else {
        let rgba_img = img.to_rgba8();
        let encoder = PngEncoder::new_with_quality(
            &mut writer,
            CompressionType::Fast,
            FilterType::NoFilter,
        );
        encoder
            .write_image(
                rgba_img.as_raw(),
                rgba_img.width(),
                rgba_img.height(),
                ColorType::Rgba8.into(),
            )
            .map_err(|e| format!("Ошибка сохранения PNG: {e}"))?;
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

    save_image_to_file(img, &dest_path, "image/png", 90)?;

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
            let options = WarpOptions {
                max_dimension,
                quality,
                mime_type: mime_type.clone(),
            };
            let warped = warp_perspective(&img, &quad, Some(&options))?;
            let q = quality.unwrap_or(88);
            let mime = mime_type.unwrap_or_else(|| "image/png".to_string());
            (DynamicImage::ImageRgba8(warped), mime, q)
        }
        ImageProcessOperation::Crop {
            rect,
            max_dimension,
            quality,
            mime_type,
        } => {
            let mut cropped = crop_image(&img, &rect)?;
            if let Some(max_dim) = max_dimension {
                let max_side = cropped.width().max(cropped.height());
                if max_side > max_dim {
                    let scale = max_dim as f64 / max_side as f64;
                    let nw = ((cropped.width() as f64 * scale).round() as u32).max(1);
                    let nh = ((cropped.height() as f64 * scale).round() as u32).max(1);
                    cropped = imageops::resize(&cropped, nw, nh, imageops::FilterType::Lanczos3);
                }
            }
            let q = quality.unwrap_or(88);
            let mime = mime_type.unwrap_or_else(|| "image/png".to_string());
            (DynamicImage::ImageRgba8(cropped), mime, q)
        }
        ImageProcessOperation::Rotate {
            angle_deg,
            quality,
            mime_type,
        } => {
            let rot = rotate_image(&img, angle_deg);
            let q = quality.unwrap_or(90);
            let mime = mime_type.unwrap_or_else(|| "image/png".to_string());
            (DynamicImage::ImageRgba8(rot), mime, q)
        }
        ImageProcessOperation::Flip {
            horizontal,
            vertical,
            quality,
            mime_type,
        } => {
            let flipped = flip_image(&img, horizontal, vertical);
            let q = quality.unwrap_or(90);
            let mime = mime_type.unwrap_or_else(|| "image/png".to_string());
            (DynamicImage::ImageRgba8(flipped), mime, q)
        }
        ImageProcessOperation::CropPolygon {
            points,
            max_dimension,
            quality,
            mime_type: _,
        } => {
            let cropped = crop_polygon(&img, &points, max_dimension)?;
            let q = quality.unwrap_or(90);
            (DynamicImage::ImageRgba8(cropped), "image/png".to_string(), q)
        }
        ImageProcessOperation::CropEllipse {
            cx,
            cy,
            rx,
            ry,
            max_dimension,
            quality,
            mime_type: _,
        } => {
            let cropped = crop_ellipse(&img, cx, cy, rx, ry, max_dimension)?;
            let q = quality.unwrap_or(90);
            (DynamicImage::ImageRgba8(cropped), "image/png".to_string(), q)
        }
        ImageProcessOperation::Resize {
            max_dimension,
            quality,
            mime_type,
        } => {
            let (w, h) = img.dimensions();
            let max_side = w.max(h);
            let q = quality.unwrap_or(88);
            let mime = mime_type.unwrap_or_else(|| "image/jpeg".to_string());

            if max_side > max_dimension {
                let scale = max_dimension as f64 / max_side as f64;
                let nw = ((w as f64 * scale).round() as u32).max(1);
                let nh = ((h as f64 * scale).round() as u32).max(1);
                let resized = img.resize(nw, nh, imageops::FilterType::Lanczos3);
                (resized, mime, q)
            } else {
                (img, mime, q)
            }
        }
    };

    let w = res_img.width();
    let h = res_img.height();

    let out_file_path = if let Some(out_p) = req.output_path {
        let p = PathBuf::from(&out_p);
        let resolved = if p.is_absolute() {
            p
        } else {
            session_cache_dir.join("images").join(p)
        };
        save_image_to_file(&res_img, &resolved, &out_mime, quality)?;
        Some(resolved.to_string_lossy().to_string())
    } else {
        None
    };

    let data_url = if out_file_path.is_none() {
        encode_to_data_url(&res_img, &out_mime, quality)?
    } else {
        String::new()
    };

    Ok(ProcessImageResponse {
        data_url,
        file_path: out_file_path,
        width: w,
        height: h,
    })
}
