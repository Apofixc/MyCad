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

/// Вспомогательный кандидат четырехугольника со скорингом качества
#[derive(Debug, Clone)]
struct QuadCandidate {
    quad: QuadPoints,
    score: f64,
}

/// Упорядочивание 4 точек четырехугольника:
/// 1: Top-Left (верх-лево), 2: Top-Right (верх-право), 3: Bottom-Right (низ-право), 4: Bottom-Left (низ-лево)
fn order_quad_corners(pts: &[Point2D]) -> Option<QuadPoints> {
    if pts.len() != 4 {
        return None;
    }

    let mut tl = pts[0];
    let mut tr = pts[0];
    let mut br = pts[0];
    let mut bl = pts[0];

    let mut min_sum = f64::INFINITY;
    let mut max_sum = f64::NEG_INFINITY;
    let mut max_diff = f64::NEG_INFINITY;
    let mut min_diff = f64::INFINITY;

    for &p in pts {
        let sum = p.x + p.y;
        let diff = p.x - p.y;

        if sum < min_sum {
            min_sum = sum;
            tl = p;
        }
        if sum > max_sum {
            max_sum = sum;
            br = p;
        }
        if diff > max_diff {
            max_diff = diff;
            tr = p;
        }
        if diff < min_diff {
            min_diff = diff;
            bl = p;
        }
    }

    // Проверяем, что все 4 вершины различны
    if tl == tr || tr == br || br == bl || bl == tl {
        return None;
    }

    Some(QuadPoints {
        top_left: tl,
        top_right: tr,
        bottom_right: br,
        bottom_left: bl,
    })
}

/// Упрощение полигона алгоритмом Рамера-Дугласа-Пекера
fn rdp_simplify(points: &[Point2D], epsilon: f64) -> Vec<Point2D> {
    if points.len() <= 2 {
        return points.to_vec();
    }

    let mut max_dist = 0.0;
    let mut index = 0;
    let p1 = points[0];
    let p2 = points[points.len() - 1];

    let line_len = p1.distance_to(&p2);

    for (i, p) in points.iter().enumerate().skip(1).take(points.len() - 2) {
        let dist = if line_len < 1e-6 {
            p.distance_to(&p1)
        } else {
            let num = ((p2.y - p1.y) * p.x - (p2.x - p1.x) * p.y + p2.x * p1.y - p2.y * p1.x).abs();
            num / line_len
        };
        if dist > max_dist {
            max_dist = dist;
            index = i;
        }
    }

    if max_dist > epsilon {
        let mut rec1 = rdp_simplify(&points[0..=index], epsilon);
        let rec2 = rdp_simplify(&points[index..], epsilon);
        rec1.pop();
        rec1.extend(rec2);
        rec1
    } else {
        vec![p1, p2]
    }
}

/// Проверка выпуклости 4-угольника
fn is_convex_quad(pts: &[Point2D]) -> bool {
    if pts.len() != 4 {
        return false;
    }
    let mut prev_sign = 0;
    for i in 0..4 {
        let p1 = pts[i];
        let p2 = pts[(i + 1) % 4];
        let p3 = pts[(i + 2) % 4];
        let cross = (p2.x - p1.x) * (p3.y - p2.y) - (p2.y - p1.y) * (p3.x - p2.x);
        let sign = if cross > 1e-4 {
            1
        } else if cross < -1e-4 {
            -1
        } else {
            0
        };
        if sign != 0 {
            if prev_sign != 0 && sign != prev_sign {
                return false;
            }
            prev_sign = sign;
        }
    }
    prev_sign != 0
}

/// Построение выпуклой оболочки алгоритмом Эндрю (Monotone Chain)
fn convex_hull(mut pts: Vec<Point2D>) -> Vec<Point2D> {
    pts.sort_by(|a, b| {
        a.x.partial_cmp(&b.x)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| a.y.partial_cmp(&b.y).unwrap_or(std::cmp::Ordering::Equal))
    });
    pts.dedup_by(|a, b| (a.x - b.x).abs() < 1e-4 && (a.y - b.y).abs() < 1e-4);
    if pts.len() <= 3 {
        return pts;
    }

    let mut lower = Vec::new();
    for &p in &pts {
        while lower.len() >= 2 {
            let p1: Point2D = lower[lower.len() - 2];
            let p2: Point2D = lower[lower.len() - 1];
            if (p2.x - p1.x) * (p.y - p1.y) - (p2.y - p1.y) * (p.x - p1.x) <= 1e-7 {
                lower.pop();
            } else {
                break;
            }
        }
        lower.push(p);
    }

    let mut upper = Vec::new();
    for &p in pts.iter().rev() {
        while upper.len() >= 2 {
            let p1: Point2D = upper[upper.len() - 2];
            let p2: Point2D = upper[upper.len() - 1];
            if (p2.x - p1.x) * (p.y - p1.y) - (p2.y - p1.y) * (p.x - p1.x) <= 1e-7 {
                upper.pop();
            } else {
                break;
            }
        }
        upper.push(p);
    }

    lower.pop();
    upper.pop();
    lower.extend(upper);
    lower
}

/// Вычисление площади многоугольника формулой Гаусса (шнурования)
fn polygon_area(pts: &[Point2D]) -> f64 {
    let n = pts.len();
    if n < 3 {
        return 0.0;
    }
    let mut area = 0.0;
    for i in 0..n {
        let j = (i + 1) % n;
        area += pts[i].x * pts[j].y;
        area -= pts[j].x * pts[i].y;
    }
    (area / 2.0).abs()
}

/// Вычисление ориентированного прямоугольника минимальной площади (Minimum Area Bounding Box) для выпуклой оболочки
fn min_area_bounding_box(hull: &[Point2D]) -> Option<QuadPoints> {
    if hull.len() < 3 {
        return None;
    }
    let n = hull.len();
    let mut min_area = f64::INFINITY;
    let mut best_corners = None;

    for i in 0..n {
        let p1 = hull[i];
        let p2 = hull[(i + 1) % n];
        let dx = p2.x - p1.x;
        let dy = p2.y - p1.y;
        let len = (dx * dx + dy * dy).sqrt();
        if len < 1e-6 {
            continue;
        }
        let cos = dx / len;
        let sin = dy / len;

        let mut min_rx = f64::INFINITY;
        let mut max_rx = f64::NEG_INFINITY;
        let mut min_ry = f64::INFINITY;
        let mut max_ry = f64::NEG_INFINITY;

        for &p in hull {
            let rx = p.x * cos + p.y * sin;
            let ry = -p.x * sin + p.y * cos;
            if rx < min_rx { min_rx = rx; }
            if rx > max_rx { max_rx = rx; }
            if ry < min_ry { min_ry = ry; }
            if ry > max_ry { max_ry = ry; }
        }

        let area = (max_rx - min_rx) * (max_ry - min_ry);
        if area < min_area && area > 50.0 {
            min_area = area;
            let r_corners = [
                (min_rx, min_ry),
                (max_rx, min_ry),
                (max_rx, max_ry),
                (min_rx, max_ry),
            ];
            let pts: Vec<Point2D> = r_corners
                .iter()
                .map(|&(rx, ry)| {
                    Point2D::new(
                        rx * cos - ry * sin,
                        rx * sin + ry * cos,
                    )
                })
                .collect();
            best_corners = order_quad_corners(&pts);
        }
    }

    best_corners
}

/// Проверка правдоподобности четырехугольника платы (углы между сторонами должны быть в диапазоне ~68..112 градусов)
fn is_plausible_pcb_quad(pts: &[Point2D]) -> bool {
    if pts.len() != 4 {
        return false;
    }
    for i in 0..4 {
        let p_prev = pts[(i + 3) % 4];
        let p_curr = pts[i];
        let p_next = pts[(i + 1) % 4];

        let v1_x = p_prev.x - p_curr.x;
        let v1_y = p_prev.y - p_curr.y;
        let v2_x = p_next.x - p_curr.x;
        let v2_y = p_next.y - p_curr.y;

        let len1 = (v1_x * v1_x + v1_y * v1_y).sqrt();
        let len2 = (v2_x * v2_x + v2_y * v2_y).sqrt();
        if len1 < 10.0 || len2 < 10.0 {
            return false;
        }

        let dot = (v1_x * v2_x + v1_y * v2_y) / (len1 * len2);
        // cos(68°) ≈ 0.3746. Отсекаем неестественно острые (<68°) и тупые (>112°) углы
        if dot.abs() > 0.38 {
            return false;
        }
    }
    true
}

/// Вычисление цвета паяльной маски печатной платы через цветовое пространство HSV.
/// Устойчиво к бликам света, теплому освещению ламп и теням.
fn is_pcb_pixel_hsv(r: u8, g: u8, b: u8) -> bool {
    let rf = r as f64 / 255.0;
    let gf = g as f64 / 255.0;
    let bf = b as f64 / 255.0;

    let max = rf.max(gf).max(bf);
    let min = rf.min(gf).min(bf);
    let delta = max - min;

    // Слишком темные пиксели (глубокие тени) или абсолютно серые/белые
    if max < 0.12 || delta < 0.045 {
        return false;
    }

    let sat = delta / max;
    // Белый картон коробки, серая бумага и артефакты сжатия имеют sat < 0.18
    if sat < 0.18 {
        return false;
    }

    let hue = if (max - rf).abs() < 1e-5 {
        60.0 * (((gf - bf) / delta) % 6.0)
    } else if (max - gf).abs() < 1e-5 {
        60.0 * (((bf - rf) / delta) + 2.0)
    } else {
        60.0 * (((rf - gf) / delta) + 4.0)
    };
    let hue = if hue < 0.0 { hue + 360.0 } else { hue };

    // 1. Зеленая маска: диапазон Hue 60..175°
    let is_green = hue >= 60.0 && hue <= 175.0 && sat >= 0.18;
    // 2. Синяя маска: диапазон Hue 180..260°
    let is_blue = hue >= 180.0 && hue <= 260.0 && sat >= 0.22;
    // 3. Красная маска: диапазон Hue 345..20°
    let is_red = (hue >= 345.0 || hue <= 20.0) && sat >= 0.25 && max > 0.30;
    // 4. Текстолит FR4 / янтарный гетинакс (светло-желтый/янтарный, НЕ темное дерево стола): Hue 25..58°
    let is_fr4 = hue >= 25.0 && hue <= 58.0 && sat >= 0.25 && max > 0.40;

    is_green || is_blue || is_red || is_fr4
}

/// Вычисление средней поддержки градиентов Собеля вдоль 4 сторон четырехугольника
fn evaluate_quad_edge_support(quad: &QuadPoints, grad_mag: &[u16], sw: usize, sh: usize) -> f64 {
    let pts = [quad.top_left, quad.top_right, quad.bottom_right, quad.bottom_left];
    let mut total_grad: f64 = 0.0;
    let mut count: f64 = 0.0;

    for i in 0..4 {
        let p_a = pts[i];
        let p_b = pts[(i + 1) % 4];
        let dist = p_a.distance_to(&p_b);
        let steps = (dist.round() as usize).clamp(10, 80);

        for s in 0..=steps {
            let t = s as f64 / steps as f64;
            let sx = (p_a.x + t * (p_b.x - p_a.x)).round() as isize;
            let sy = (p_a.y + t * (p_b.y - p_a.y)).round() as isize;
            if sx >= 0 && sx < sw as isize && sy >= 0 && sy < sh as isize {
                total_grad += grad_mag[sy as usize * sw + sx as usize] as f64;
                count += 1.0;
            }
        }
    }

    total_grad / count.max(1.0)
}

/// Автоматическое определение углов печатной платы компьютерным зрением.
/// Поддерживает:
/// 1. Чертежи и сборочные схемы (выделение контура платы и отсечение размерных линий, рамок и надписей)
/// 2. Фотографии плат под углом (перспективные трапеции с оценкой градиентных кромок)
/// 3. Планшетные сканы с контрастным фоном
pub fn detect_board_corners(source: &str) -> Result<QuadPoints, String> {
    let img = load_image(source)?;
    let (orig_w, orig_h) = img.dimensions();

    if orig_w == 0 || orig_h == 0 {
        return Err("Изображение имеет нулевой размер".to_string());
    }

    let fallback = QuadPoints {
        top_left: Point2D::new(orig_w as f64 * 0.04, orig_h as f64 * 0.04),
        top_right: Point2D::new(orig_w as f64 * 0.96, orig_h as f64 * 0.04),
        bottom_right: Point2D::new(orig_w as f64 * 0.96, orig_h as f64 * 0.96),
        bottom_left: Point2D::new(orig_w as f64 * 0.04, orig_h as f64 * 0.96),
    };

    // Масштабирование для быстрого анализа (~600-800px)
    let max_analysis_dim = 800u32;
    let max_side = orig_w.max(orig_h);
    let scale = if max_side > max_analysis_dim {
        max_analysis_dim as f64 / max_side as f64
    } else {
        1.0
    };

    let ana_w = ((orig_w as f64 * scale).round() as u32).max(20);
    let ana_h = ((orig_h as f64 * scale).round() as u32).max(20);

    let small_rgb = img.thumbnail(ana_w, ana_h).to_rgb8();
    let (sw, sh) = small_rgb.dimensions();
    if sw < 20 || sh < 20 {
        return Ok(fallback);
    }

    let total_pixels = (sw * sh) as usize;
    let mut gray = vec![0u8; total_pixels];

    // Градиенты Собеля и яркость
    for y in 0..sh as usize {
        for x in 0..sw as usize {
            let p = small_rgb.get_pixel(x as u32, y as u32);
            let lum = (0.299 * p[0] as f64 + 0.587 * p[1] as f64 + 0.114 * p[2] as f64).round() as u8;
            gray[y * sw as usize + x] = lum;
        }
    }

    // Вычисление фонового цвета по периметру (крайние 2-3 пикселя)
    let mut border_lum_sum: u64 = 0;
    let mut border_count: u64 = 0;
    for x in 0..sw as usize {
        border_lum_sum += gray[x] as u64 + gray[(sh as usize - 1) * sw as usize + x] as u64;
        border_count += 2;
    }
    for y in 1..(sh as usize - 1) {
        border_lum_sum += gray[y * sw as usize] as u64 + gray[y * sw as usize + (sw as usize - 1)] as u64;
        border_count += 2;
    }
    let avg_border_lum = (border_lum_sum / border_count.max(1)) as i32;

    // Вычисление Собель-градиентов
    let mut grad_mag = vec![0u16; total_pixels];
    let mut h_edge_weight = vec![0u16; total_pixels];
    let mut v_edge_weight = vec![0u16; total_pixels];

    for y in 1..(sh as usize - 1) {
        for x in 1..(sw as usize - 1) {
            let idx = y * sw as usize + x;
            let g00 = gray[(y - 1) * sw as usize + (x - 1)] as i32;
            let g01 = gray[(y - 1) * sw as usize + x] as i32;
            let g02 = gray[(y - 1) * sw as usize + (x + 1)] as i32;
            let g10 = gray[y * sw as usize + (x - 1)] as i32;
            let g12 = gray[y * sw as usize + (x + 1)] as i32;
            let g20 = gray[(y + 1) * sw as usize + (x - 1)] as i32;
            let g21 = gray[(y + 1) * sw as usize + x] as i32;
            let g22 = gray[(y + 1) * sw as usize + (x + 1)] as i32;

            let gx = (g02 + 2 * g12 + g22) - (g00 + 2 * g10 + g20);
            let gy = (g20 + 2 * g21 + g22) - (g00 + 2 * g01 + g02);
            let mag = (gx.abs() + gy.abs()) as u16;
            grad_mag[idx] = mag;

            if gy.abs() > 28 && gy.abs() > (gx.abs() * 12 / 10) {
                h_edge_weight[idx] = mag;
            }
            if gx.abs() > 28 && gx.abs() > (gy.abs() * 12 / 10) {
                v_edge_weight[idx] = mag;
            }
        }
    }

    // =========================================================================
    // СТРАТЕГИЯ А: Для цветных фото плат (HSV селекция паяльной маски)
    // =========================================================================
    let mut pcb_pts = Vec::new();
    let grid_size = 16usize;
    let grid_w = (sw as usize + grid_size - 1) / grid_size;
    let grid_h = (sh as usize + grid_size - 1) / grid_size;
    let mut grid_counts = vec![0u32; grid_w * grid_h];

    for y in 0..sh as usize {
        for x in 0..sw as usize {
            let p = small_rgb.get_pixel(x as u32, y as u32);
            if is_pcb_pixel_hsv(p[0], p[1], p[2]) {
                grid_counts[(y / grid_size) * grid_w + (x / grid_size)] += 1;
            }
        }
    }

    let min_cell_pixels = ((grid_size * grid_size) as f64 * 0.10).round() as u32; // >= 25 пикселей в блоке 16x16
    for y in 0..sh as usize {
        for x in 0..sw as usize {
            let p = small_rgb.get_pixel(x as u32, y as u32);
            if is_pcb_pixel_hsv(p[0], p[1], p[2]) {
                let gx = x / grid_size;
                let gy = y / grid_size;
                // Фильтрация артефактов сжатия и бликов на коробке/проводах
                if grid_counts[gy * grid_w + gx] >= min_cell_pixels {
                    pcb_pts.push(Point2D::new(x as f64, y as f64));
                }
            }
        }
    }

    let has_colored_pcb = (pcb_pts.len() as f64 / total_pixels as f64) > 0.005;
    let mut candidates: Vec<QuadCandidate> = Vec::new();

    if has_colored_pcb && pcb_pts.len() >= 16 {
        let hull = convex_hull(pcb_pts);
        if hull.len() >= 4 {
            // Кандидат 1: Ориентированный прямоугольник минимальной площади (OBB)
            if let Some(obb_quad) = min_area_bounding_box(&hull) {
                let obb_edge = evaluate_quad_edge_support(&obb_quad, &grad_mag, sw as usize, sh as usize);
                let obb_area = polygon_area(&[obb_quad.top_left, obb_quad.top_right, obb_quad.bottom_right, obb_quad.bottom_left]);
                candidates.push(QuadCandidate {
                    quad: obb_quad,
                    score: obb_edge * obb_area.sqrt() * 1.5,
                });
            }

            // Кандидат 2: Осевой прямоугольник по границам выпуклой оболочки с Edge Snapping
            let mut min_hx = f64::INFINITY;
            let mut max_hx = f64::NEG_INFINITY;
            let mut min_hy = f64::INFINITY;
            let mut max_hy = f64::NEG_INFINITY;
            for &p in &hull {
                if p.x < min_hx { min_hx = p.x; }
                if p.x > max_hx { max_hx = p.x; }
                if p.y < min_hy { min_hy = p.y; }
                if p.y > max_hy { max_hy = p.y; }
            }

            let mut bx0 = (min_hx.round() as usize).clamp(1, sw as usize - 2);
            let mut bx1 = (max_hx.round() as usize).clamp(1, sw as usize - 2);
            let mut by0 = (min_hy.round() as usize).clamp(1, sh as usize - 2);
            let mut by1 = (max_hy.round() as usize).clamp(1, sh as usize - 2);

            let search_range = ((sw.min(sh) as f64 * 0.035).round() as usize).clamp(4, 18);
            let pad_x = ((bx1 - bx0) as f64 * 0.10).round() as usize;
            let pad_y = ((by1 - by0) as f64 * 0.10).round() as usize;

            // Верхняя кромка
            let mut best_top_y = by0;
            let mut max_top_support = 0u64;
            for cy in by0.saturating_sub(search_range)..=(by0 + search_range).min(sh as usize - 2) {
                let mut line_support = 0u64;
                for cx in (bx0 + pad_x)..=(bx1.saturating_sub(pad_x)) {
                    line_support += h_edge_weight[cy * sw as usize + cx] as u64;
                }
                if line_support > max_top_support {
                    max_top_support = line_support;
                    best_top_y = cy;
                }
            }
            if max_top_support > 300 { by0 = best_top_y; }

            // Нижняя кромка
            let mut best_bot_y = by1;
            let mut max_bot_support = 0u64;
            for cy in by1.saturating_sub(search_range)..=(by1 + search_range).min(sh as usize - 2) {
                let mut line_support = 0u64;
                for cx in (bx0 + pad_x)..=(bx1.saturating_sub(pad_x)) {
                    line_support += h_edge_weight[cy * sw as usize + cx] as u64;
                }
                if line_support > max_bot_support {
                    max_bot_support = line_support;
                    best_bot_y = cy;
                }
            }
            if max_bot_support > 300 { by1 = best_bot_y; }

            // Левая кромка
            let mut best_left_x = bx0;
            let mut max_left_support = 0u64;
            for cx in bx0.saturating_sub(search_range)..=(bx0 + search_range).min(sw as usize - 2) {
                let mut line_support = 0u64;
                for cy in (by0 + pad_y)..=(by1.saturating_sub(pad_y)) {
                    line_support += v_edge_weight[cy * sw as usize + cx] as u64;
                }
                if line_support > max_left_support {
                    max_left_support = line_support;
                    best_left_x = cx;
                }
            }
            if max_left_support > 300 { bx0 = best_left_x; }

            // Правая кромка
            let mut best_right_x = bx1;
            let mut max_right_support = 0u64;
            for cx in bx1.saturating_sub(search_range)..=(bx1 + search_range).min(sw as usize - 2) {
                let mut line_support = 0u64;
                for cy in (by0 + pad_y)..=(by1.saturating_sub(pad_y)) {
                    line_support += v_edge_weight[cy * sw as usize + cx] as u64;
                }
                if line_support > max_right_support {
                    max_right_support = line_support;
                    best_right_x = cx;
                }
            }
            if max_right_support > 300 { bx1 = best_right_x; }

            let quad_axial = QuadPoints {
                top_left: Point2D::new(bx0 as f64, by0 as f64),
                top_right: Point2D::new(bx1 as f64, by0 as f64),
                bottom_right: Point2D::new(bx1 as f64, by1 as f64),
                bottom_left: Point2D::new(bx0 as f64, by1 as f64),
            };

            let s1_edge = evaluate_quad_edge_support(&quad_axial, &grad_mag, sw as usize, sh as usize);
            let s1_area = (bx1 - bx0) as f64 * (by1 - by0) as f64;
            candidates.push(QuadCandidate {
                quad: quad_axial,
                score: s1_edge * s1_area.sqrt() * 1.4,
            });

            // Кандидат 3: Перспективная трапеция через RDP (строго с валидацией углов)
            let mut closed_hull = hull.clone();
            closed_hull.push(closed_hull[0]);
            let perimeter = closed_hull.windows(2).map(|w| w[0].distance_to(&w[1])).sum::<f64>();

            for eps_factor in [0.035, 0.045, 0.055, 0.025, 0.065] {
                let simplified = rdp_simplify(&closed_hull, perimeter * eps_factor);
                let unique_pts = if simplified.len() == 5 && simplified[0].distance_to(&simplified[4]) < 20.0 {
                    &simplified[0..4]
                } else if simplified.len() == 4 {
                    &simplified[..]
                } else {
                    &[]
                };

                if unique_pts.len() == 4 && is_convex_quad(unique_pts) && is_plausible_pcb_quad(unique_pts) {
                    if let Some(ordered) = order_quad_corners(unique_pts) {
                        let edge_support = evaluate_quad_edge_support(&ordered, &grad_mag, sw as usize, sh as usize);
                        let q_area = polygon_area(unique_pts);
                        candidates.push(QuadCandidate {
                            quad: ordered,
                            score: edge_support * q_area.sqrt() * 1.3,
                        });
                        break;
                    }
                }
            }
        }
    }

    // =========================================================================
    // СТРАТЕГИЯ Б: Для чертежей, схем и B&W сканов (Density Cluster + Edge Snapping)
    // =========================================================================
    if candidates.is_empty() {
        let mut ink_feature_mask = vec![0u8; total_pixels];
        for idx in 0..total_pixels {
            let is_drawing_ink = avg_border_lum > 175 && (gray[idx] as i32) < (avg_border_lum - 28);
            let is_high_contrast = (gray[idx] as i32 - avg_border_lum).abs() > 32;
            if is_drawing_ink || (is_high_contrast && grad_mag[idx] > 24) {
                ink_feature_mask[idx] = 1;
            }
        }

        let kernel_r = ((sw.min(sh) as f64 * 0.024).round() as usize).clamp(3, 16);
        let mut temp_blur = vec![0u32; total_pixels];
        let mut density_map = vec![0u8; total_pixels];

        for y in 0..sh as usize {
            let mut sum = 0u32;
            let y_off = y * sw as usize;
            for x in 0..(kernel_r.min(sw as usize)) {
                sum += ink_feature_mask[y_off + x] as u32;
            }
            for x in 0..sw as usize {
                if x + kernel_r < sw as usize {
                    sum += ink_feature_mask[y_off + x + kernel_r] as u32;
                }
                if x > kernel_r {
                    sum -= ink_feature_mask[y_off + x - kernel_r - 1] as u32;
                }
                temp_blur[y_off + x] = sum;
            }
        }

        let filter_area = ((2 * kernel_r + 1) * (2 * kernel_r + 1)) as f64;
        for x in 0..sw as usize {
            let mut sum = 0u32;
            for y in 0..(kernel_r.min(sh as usize)) {
                sum += temp_blur[y * sw as usize + x];
            }
            for y in 0..sh as usize {
                if y + kernel_r < sh as usize {
                    sum += temp_blur[(y + kernel_r) * sw as usize + x];
                }
                if y > kernel_r {
                    sum -= temp_blur[(y - kernel_r - 1) * sw as usize + x];
                }
                let density = sum as f64 / filter_area;
                if density > 0.055 {
                    density_map[y * sw as usize + x] = 1;
                }
            }
        }

        let mut visited = vec![false; total_pixels];
        let mut dense_components = Vec::new();

        for y in 1..(sh as usize - 1) {
            for x in 1..(sw as usize - 1) {
                let start_idx = y * sw as usize + x;
                if density_map[start_idx] == 1 && !visited[start_idx] {
                    let mut queue = std::collections::VecDeque::new();
                    queue.push_back((x, y));
                    visited[start_idx] = true;

                    let mut comp_pixels = 0u32;
                    let mut min_cx = x;
                    let mut max_cx = x;
                    let mut min_cy = y;
                    let mut max_cy = y;
                    let mut total_mass = 0u64;

                    while let Some((qx, qy)) = queue.pop_front() {
                        comp_pixels += 1;
                        if qx < min_cx { min_cx = qx; }
                        if qx > max_cx { max_cx = qx; }
                        if qy < min_cy { min_cy = qy; }
                        if qy > max_cy { max_cy = qy; }

                        let q_idx = qy * sw as usize + qx;
                        total_mass += grad_mag[q_idx] as u64;

                        let neighbors = [
                            (qx.wrapping_sub(1), qy),
                            (qx + 1, qy),
                            (qx, qy.wrapping_sub(1)),
                            (qx, qy + 1),
                        ];
                        for (nx, ny) in neighbors {
                            if nx > 0 && nx < sw as usize - 1 && ny > 0 && ny < sh as usize - 1 {
                                let n_idx = ny * sw as usize + nx;
                                if density_map[n_idx] == 1 && !visited[n_idx] {
                                    visited[n_idx] = true;
                                    queue.push_back((nx, ny));
                                }
                            }
                        }
                    }

                    let bw = (max_cx - min_cx + 1) as f64;
                    let bh = (max_cy - min_cy + 1) as f64;
                    let bbox_area = bw * bh;
                    let solidity = comp_pixels as f64 / bbox_area.max(1.0);

                    if comp_pixels > 80 && bw > 25.0 && bh > 25.0 && solidity > 0.18 {
                        let score = (total_mass as f64) * solidity.powi(2) * (comp_pixels as f64).sqrt();
                        dense_components.push((min_cx, min_cy, max_cx, max_cy, score, comp_pixels));
                    }
                }
            }
        }

        dense_components.sort_by(|a, b| b.4.partial_cmp(&a.4).unwrap_or(std::cmp::Ordering::Equal));

        if let Some(&(mut bx0, mut by0, mut bx1, mut by1, _, _)) = dense_components.first() {
            let pad_x = ((bx1 - bx0) as f64 * 0.10).round() as usize;
            let pad_y = ((by1 - by0) as f64 * 0.10).round() as usize;
            let search_range = ((sw.min(sh) as f64 * 0.04).round() as usize).clamp(6, 25);

            let mut best_top_y = by0;
            let mut max_top_support = 0u64;
            for cy in by0.saturating_sub(search_range)..=(by0 + search_range).min(sh as usize - 2) {
                let mut line_support = 0u64;
                for cx in (bx0 + pad_x)..=(bx1.saturating_sub(pad_x)) {
                    line_support += h_edge_weight[cy * sw as usize + cx] as u64;
                }
                if line_support > max_top_support {
                    max_top_support = line_support;
                    best_top_y = cy;
                }
            }
            if max_top_support > 300 { by0 = best_top_y; }

            let mut best_bot_y = by1;
            let mut max_bot_support = 0u64;
            for cy in by1.saturating_sub(search_range)..=(by1 + search_range).min(sh as usize - 2) {
                let mut line_support = 0u64;
                for cx in (bx0 + pad_x)..=(bx1.saturating_sub(pad_x)) {
                    line_support += h_edge_weight[cy * sw as usize + cx] as u64;
                }
                if line_support > max_bot_support {
                    max_bot_support = line_support;
                    best_bot_y = cy;
                }
            }
            if max_bot_support > 300 { by1 = best_bot_y; }

            let mut best_left_x = bx0;
            let mut max_left_support = 0u64;
            for cx in bx0.saturating_sub(search_range)..=(bx0 + search_range).min(sw as usize - 2) {
                let mut line_support = 0u64;
                for cy in (by0 + pad_y)..=(by1.saturating_sub(pad_y)) {
                    line_support += v_edge_weight[cy * sw as usize + cx] as u64;
                }
                if line_support > max_left_support {
                    max_left_support = line_support;
                    best_left_x = cx;
                }
            }
            if max_left_support > 300 { bx0 = best_left_x; }

            let mut best_right_x = bx1;
            let mut max_right_support = 0u64;
            for cx in bx1.saturating_sub(search_range)..=(bx1 + search_range).min(sw as usize - 2) {
                let mut line_support = 0u64;
                for cy in (by0 + pad_y)..=(by1.saturating_sub(pad_y)) {
                    line_support += v_edge_weight[cy * sw as usize + cx] as u64;
                }
                if line_support > max_right_support {
                    max_right_support = line_support;
                    best_right_x = cx;
                }
            }
            if max_right_support > 300 { bx1 = best_right_x; }

            let quad_axial = QuadPoints {
                top_left: Point2D::new(bx0 as f64, by0 as f64),
                top_right: Point2D::new(bx1 as f64, by0 as f64),
                bottom_right: Point2D::new(bx1 as f64, by1 as f64),
                bottom_left: Point2D::new(bx0 as f64, by1 as f64),
            };

            let s1_edge = evaluate_quad_edge_support(&quad_axial, &grad_mag, sw as usize, sh as usize);
            let s1_area = (bx1 - bx0) as f64 * (by1 - by0) as f64;
            candidates.push(QuadCandidate {
                quad: quad_axial,
                score: s1_edge * s1_area.sqrt(),
            });
        }
    }

    // Выбираем кандидата с наивысшим скорингом
    candidates.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));

    let winning_quad = if let Some(best) = candidates.first() {
        best.quad.clone()
    } else {
        fallback
    };

    // Масштабирование координат обратно в оригинальное разрешение изображения
    let inv_scale = 1.0 / scale;
    let final_quad = QuadPoints {
        top_left: Point2D::new(
            (winning_quad.top_left.x * inv_scale).clamp(0.0, orig_w as f64),
            (winning_quad.top_left.y * inv_scale).clamp(0.0, orig_h as f64),
        ),
        top_right: Point2D::new(
            (winning_quad.top_right.x * inv_scale).clamp(0.0, orig_w as f64),
            (winning_quad.top_right.y * inv_scale).clamp(0.0, orig_h as f64),
        ),
        bottom_right: Point2D::new(
            (winning_quad.bottom_right.x * inv_scale).clamp(0.0, orig_w as f64),
            (winning_quad.bottom_right.y * inv_scale).clamp(0.0, orig_h as f64),
        ),
        bottom_left: Point2D::new(
            (winning_quad.bottom_left.x * inv_scale).clamp(0.0, orig_w as f64),
            (winning_quad.bottom_left.y * inv_scale).clamp(0.0, orig_h as f64),
        ),
    };

    Ok(final_quad)
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

#[cfg(test)]
mod tests {
    use super::*;
    use image::{Rgb, RgbImage};

    #[test]
    fn test_detect_board_corners_drawing_with_annotations_and_margins() {
        let w = 800u32;
        let h = 600u32;
        let mut img = RgbImage::from_pixel(w, h, Rgb([250, 250, 250]));

        // Левая вертикальная рамка листа (край скана) на x=20
        for y in 10..580 {
            img.put_pixel(20, y, Rgb([10, 10, 10]));
        }

        // Прямоугольный контур платы: от x=150..650, y=80..320
        let bx0 = 150;
        let bx1 = 650;
        let by0 = 80;
        let by1 = 320;

        // Внешние кромки платы
        for x in bx0..=bx1 {
            img.put_pixel(x, by0, Rgb([20, 20, 20]));
            img.put_pixel(x, by1, Rgb([20, 20, 20]));
        }
        for y in by0..=by1 {
            img.put_pixel(bx0, y, Rgb([20, 20, 20]));
            img.put_pixel(bx1, y, Rgb([20, 20, 20]));
        }

        // Наполнение платы деталями (дорожки, микросхемы, контактные площадки)
        for y in (by0 + 8)..(by1 - 8) {
            for x in (bx0 + 8)..(bx1 - 8) {
                if (x % 14 < 6 && y % 18 < 8) || ((x + y) % 25 == 0) {
                    img.put_pixel(x, y, Rgb([30, 30, 30]));
                }
            }
        }

        // Под платой: выносная размерная линия на y=360
        for x in (bx0 - 15)..=(bx1 + 15) {
            img.put_pixel(x, 360, Rgb([50, 50, 50]));
        }

        // Еще ниже: блок рукописных примечаний и подписи на y=460..540
        for y in 460..540 {
            for x in 100..700 {
                if x % 10 < 3 && y % 12 < 3 {
                    img.put_pixel(x, y, Rgb([40, 40, 40]));
                }
            }
        }

        let dyn_img = DynamicImage::ImageRgb8(img);
        let data_url = encode_to_data_url(&dyn_img, "image/jpeg", 95).unwrap();

        let quad = detect_board_corners(&data_url).expect("Должен успешно определить углы");

        // Проверяем, что углы привязались именно к контуру платы (150, 80) .. (650, 320),
        // а не к левой рамке листа (x=20) и не к рукописному тексту внизу (y=540)!
        assert!(
            (quad.top_left.x - bx0 as f64).abs() <= 20.0,
            "TL.x {} должен быть около {}",
            quad.top_left.x,
            bx0
        );
        assert!(
            (quad.top_left.y - by0 as f64).abs() <= 20.0,
            "TL.y {} должен быть около {}",
            quad.top_left.y,
            by0
        );
        assert!(
            (quad.top_right.x - bx1 as f64).abs() <= 20.0,
            "TR.x {} должен быть около {}",
            quad.top_right.x,
            bx1
        );
        assert!(
            (quad.top_right.y - by0 as f64).abs() <= 20.0,
            "TR.y {} должен быть около {}",
            quad.top_right.y,
            by0
        );
        assert!(
            (quad.bottom_right.x - bx1 as f64).abs() <= 20.0,
            "BR.x {} должен быть около {}",
            quad.bottom_right.x,
            bx1
        );
        assert!(
            (quad.bottom_right.y - by1 as f64).abs() <= 20.0,
            "BR.y {} должен быть около {}",
            quad.bottom_right.y,
            by1
        );
        assert!(
            (quad.bottom_left.x - bx0 as f64).abs() <= 20.0,
            "BL.x {} должен быть около {}",
            quad.bottom_left.x,
            bx0
        );
        assert!(
            (quad.bottom_left.y - by1 as f64).abs() <= 20.0,
            "BL.y {} должен быть около {}",
            quad.bottom_left.y,
            by1
        );
    }

    #[test]
    fn test_detect_board_corners_perspective_photo() {
        let w = 800u32;
        let h = 600u32;
        // Фоновый стол
        let mut img = RgbImage::from_pixel(w, h, Rgb([210, 210, 205]));

        // Вершины платы в перспективе (трапеция)
        let p_tl = Point2D::new(180.0, 100.0);
        let p_tr = Point2D::new(620.0, 120.0);
        let p_br = Point2D::new(690.0, 480.0);
        let p_bl = Point2D::new(110.0, 450.0);
        let poly = [p_tl, p_tr, p_br, p_bl];

        for y in 0..h {
            for x in 0..w {
                if point_in_polygon(x as f64, y as f64, &poly) {
                    // Зеленая маска платы с деталями
                    let g_val = if (x + y) % 15 < 3 { 80 } else { 45 };
                    img.put_pixel(x, y, Rgb([20, g_val, 25]));
                }
            }
        }

        let dyn_img = DynamicImage::ImageRgb8(img);
        let data_url = encode_to_data_url(&dyn_img, "image/jpeg", 95).unwrap();

        let quad = detect_board_corners(&data_url).expect("Должен успешно определить перспективные углы");

        assert!(
            (quad.top_left.x - p_tl.x).abs() <= 25.0,
            "TL.x {} vs {}",
            quad.top_left.x,
            p_tl.x
        );
        assert!(
            (quad.top_left.y - p_tl.y).abs() <= 25.0,
            "TL.y {} vs {}",
            quad.top_left.y,
            p_tl.y
        );
        assert!(
            (quad.top_right.x - p_tr.x).abs() <= 25.0,
            "TR.x {} vs {}",
            quad.top_right.x,
            p_tr.x
        );
        assert!(
            (quad.top_right.y - p_tr.y).abs() <= 25.0,
            "TR.y {} vs {}",
            quad.top_right.y,
            p_tr.y
        );
        assert!(
            (quad.bottom_right.x - p_br.x).abs() <= 25.0,
            "BR.x {} vs {}",
            quad.bottom_right.x,
            p_br.x
        );
        assert!(
            (quad.bottom_right.y - p_br.y).abs() <= 25.0,
            "BR.y {} vs {}",
            quad.bottom_right.y,
            p_br.y
        );
        assert!(
            (quad.bottom_left.x - p_bl.x).abs() <= 25.0,
            "BL.x {} vs {}",
            quad.bottom_left.x,
            p_bl.x
        );
        assert!(
            (quad.bottom_left.y - p_bl.y).abs() <= 25.0,
            "BL.y {} vs {}",
            quad.bottom_left.y,
            p_bl.y
        );
    }

    #[test]
    fn test_detect_board_corners_photo_pcb_in_cardboard_box() {
        let w = 800u32;
        let h = 600u32;
        // Темный стол по краям кадра
        let mut img = RgbImage::from_pixel(w, h, Rgb([50, 45, 40]));

        // Белая картонная коробка: от x=100..700, y=50..550
        for y in 50..550 {
            for x in 100..700 {
                img.put_pixel(x, y, Rgb([235, 235, 230]));
            }
        }

        // Надпись маркером на коробке ("CYFRAL")
        for y in 120..220 {
            for x in 130..220 {
                if (x + y) % 15 < 3 {
                    img.put_pixel(x, y, Rgb([40, 40, 40]));
                }
            }
        }

        // Зеленая печатная плата в центре: от x=300..500, y=100..500
        let pcb_x0 = 300;
        let pcb_x1 = 500;
        let pcb_y0 = 100;
        let pcb_y1 = 500;

        for y in pcb_y0..=pcb_y1 {
            for x in pcb_x0..=pcb_x1 {
                // Зеленая маска платы с деталями и контактными площадками
                let is_detail = (x % 14 < 4 && y % 16 < 4) || ((x + y) % 22 == 0);
                if is_detail {
                    img.put_pixel(x, y, Rgb([160, 155, 60])); // припой / позолота / компоненты
                } else {
                    img.put_pixel(x, y, Rgb([25, 115, 40])); // зеленый текстолит
                }
            }
        }

        let dyn_img = DynamicImage::ImageRgb8(img);
        let data_url = encode_to_data_url(&dyn_img, "image/jpeg", 95).unwrap();

        let quad = detect_board_corners(&data_url).expect("Должен успешно определить углы зеленой платы");

        // Углы должны зафиксировать зеленую плату (300, 100)..(500, 500),
        // а НЕ картонную коробку (100, 50)..(700, 550)!
        assert!(
            (quad.top_left.x - pcb_x0 as f64).abs() <= 25.0,
            "TL.x {} должен быть около платы {}",
            quad.top_left.x,
            pcb_x0
        );
        assert!(
            (quad.top_left.y - pcb_y0 as f64).abs() <= 25.0,
            "TL.y {} должен быть около платы {}",
            quad.top_left.y,
            pcb_y0
        );
        assert!(
            (quad.top_right.x - pcb_x1 as f64).abs() <= 25.0,
            "TR.x {} должен быть около платы {}",
            quad.top_right.x,
            pcb_x1
        );
        assert!(
            (quad.top_right.y - pcb_y0 as f64).abs() <= 25.0,
            "TR.y {} должен быть около платы {}",
            quad.top_right.y,
            pcb_y0
        );
        assert!(
            (quad.bottom_right.x - pcb_x1 as f64).abs() <= 25.0,
            "BR.x {} должен быть около платы {}",
            quad.bottom_right.x,
            pcb_x1
        );
        assert!(
            (quad.bottom_right.y - pcb_y1 as f64).abs() <= 25.0,
            "BR.y {} должен быть около платы {}",
            quad.bottom_right.y,
            pcb_y1
        );
        assert!(
            (quad.bottom_left.x - pcb_x0 as f64).abs() <= 25.0,
            "BL.x {} должен быть около платы {}",
            quad.bottom_left.x,
            pcb_x0
        );
        assert!(
            (quad.bottom_left.y - pcb_y1 as f64).abs() <= 25.0,
            "BL.y {} должен быть около платы {}",
            quad.bottom_left.y,
            pcb_y1
        );
    }

    #[test]
    fn test_detect_board_corners_photo_pcb_with_wires_and_adjacent_text() {
        let w = 800u32;
        let h = 600u32;
        let mut img = RgbImage::from_pixel(w, h, Rgb([50, 45, 40]));

        // Белая картонная коробка
        for y in 40..560 {
            for x in 100..750 {
                img.put_pixel(x, y, Rgb([230, 230, 225]));
            }
        }

        // Зеленая печатная плата: от x=320..520, y=80..520
        let pcb_x0 = 320;
        let pcb_x1 = 520;
        let pcb_y0 = 80;
        let pcb_y1 = 520;

        for y in pcb_y0..=pcb_y1 {
            for x in pcb_x0..=pcb_x1 {
                let is_detail = (x % 16 < 4 && y % 18 < 4) || ((x + y) % 24 == 0);
                if is_detail {
                    img.put_pixel(x, y, Rgb([160, 155, 60]));
                } else {
                    img.put_pixel(x, y, Rgb([25, 120, 45]));
                }
            }
        }

        // Провода слева от платы: x=240..319
        for y in (150..450).step_by(12) {
            for x in 240..pcb_x0 {
                img.put_pixel(x, y, Rgb([140, 140, 145]));
            }
        }

        // Текст маркером ("CYFRAL") близко к плате: x=535..650 (всего 15px от правой кромки!)
        for y in 150..350 {
            for x in 535..650 {
                if (x + y) % 12 < 3 {
                    img.put_pixel(x, y, Rgb([35, 35, 35]));
                }
            }
        }

        let dyn_img = DynamicImage::ImageRgb8(img);
        let data_url = encode_to_data_url(&dyn_img, "image/jpeg", 95).unwrap();

        let quad = detect_board_corners(&data_url).expect("Должен успешно определить углы платы при наличии проводов и близкого текста");

        // Углы должны зафиксировать плату (320..520, 80..520), игнорируя провода слева и надпись справа
        assert!(
            (quad.top_left.x - pcb_x0 as f64).abs() <= 25.0,
            "TL.x {} vs {}",
            quad.top_left.x,
            pcb_x0
        );
        assert!(
            (quad.top_right.x - pcb_x1 as f64).abs() <= 25.0,
            "TR.x {} vs {}",
            quad.top_right.x,
            pcb_x1
        );
        assert!(
            (quad.bottom_right.x - pcb_x1 as f64).abs() <= 25.0,
            "BR.x {} vs {}",
            quad.bottom_right.x,
            pcb_x1
        );
        assert!(
            (quad.bottom_left.x - pcb_x0 as f64).abs() <= 25.0,
            "BL.x {} vs {}",
            quad.bottom_left.x,
            pcb_x0
        );
    }

    #[test]
    fn test_detect_board_corners_photo_pcb_with_large_led_display() {
        let w = 800u32;
        let h = 900u32;
        // Разнородный фон: белый картон, темный стол
        let mut img = RgbImage::from_pixel(w, h, Rgb([60, 50, 45]));

        // Белая картонная коробка
        for y in 30..870 {
            for x in 80..720 {
                img.put_pixel(x, y, Rgb([235, 235, 230]));
            }
        }

        // Зеленая плата: x=250..550, y=80..820
        let pcb_x0 = 250;
        let pcb_x1 = 550;
        let pcb_y0 = 80;
        let pcb_y1 = 820;

        for y in pcb_y0..=pcb_y1 {
            for x in pcb_x0..=pcb_x1 {
                img.put_pixel(x, y, Rgb([30, 125, 45]));
            }
        }

        // Большой 4-значный 7-сегментный индикатор в центре платы (золотисто-серый, НЕ зеленый!)
        // Размеры: x=340..460, y=200..450
        for y in 200..450 {
            for x in 340..460 {
                img.put_pixel(x, y, Rgb([190, 185, 140]));
            }
        }

        // Кварцевый резонатор в металлическом корпусе (серебристый)
        for y in 120..170 {
            for x in 280..320 {
                img.put_pixel(x, y, Rgb([180, 180, 185]));
            }
        }

        let dyn_img = DynamicImage::ImageRgb8(img);
        let data_url = encode_to_data_url(&dyn_img, "image/jpeg", 95).unwrap();

        let quad = detect_board_corners(&data_url).expect("Должен успешно определить углы платы с 7-сегментным индикатором");

        assert!(
            (quad.top_left.x - pcb_x0 as f64).abs() <= 25.0,
            "TL.x {} vs {}",
            quad.top_left.x,
            pcb_x0
        );
        assert!(
            (quad.top_left.y - pcb_y0 as f64).abs() <= 25.0,
            "TL.y {} vs {}",
            quad.top_left.y,
            pcb_y0
        );
        assert!(
            (quad.top_right.x - pcb_x1 as f64).abs() <= 25.0,
            "TR.x {} vs {}",
            quad.top_right.x,
            pcb_x1
        );
        assert!(
            (quad.bottom_right.x - pcb_x1 as f64).abs() <= 25.0,
            "BR.x {} vs {}",
            quad.bottom_right.x,
            pcb_x1
        );
        assert!(
            (quad.bottom_right.y - pcb_y1 as f64).abs() <= 25.0,
            "BR.y {} vs {}",
            quad.bottom_right.y,
            pcb_y1
        );
        assert!(
            (quad.bottom_left.x - pcb_x0 as f64).abs() <= 25.0,
            "BL.x {} vs {}",
            quad.bottom_left.x,
            pcb_x0
        );
    }
}


