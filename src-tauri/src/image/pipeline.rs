use image::{DynamicImage, ImageBuffer, Rgba};
use rayon::prelude::*;
use std::fs;
use std::path::{Path, PathBuf};
use uuid::Uuid;

pub fn calculate_homography_matrix(
    src: &[(f64, f64); 4],
    dst: &[(f64, f64); 4],
) -> Result<[f64; 9], String> {
    // 8x8 linear system A * h = b for homography
    // h33 = 1
    // For each pair: x' = (h00*x + h01*y + h02)/(h20*x + h21*y + 1)
    //                y' = (h10*x + h11*y + h12)/(h20*x + h21*y + 1)
    let mut a = [[0.0f64; 8]; 8];
    let mut b = [0.0f64; 8];

    for i in 0..4 {
        let (x, y) = src[i];
        let (u, v) = dst[i];

        // Row 2*i
        a[2 * i][0] = x;
        a[2 * i][1] = y;
        a[2 * i][2] = 1.0;
        a[2 * i][3] = 0.0;
        a[2 * i][4] = 0.0;
        a[2 * i][5] = 0.0;
        a[2 * i][6] = -x * u;
        a[2 * i][7] = -y * u;
        b[2 * i] = u;

        // Row 2*i + 1
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

    // Solve using Gaussian elimination with partial pivoting
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

    // Parallel row computation via Rayon
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
                        // Bilinear interpolation
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

pub fn detect_board_corners(img: &DynamicImage) -> [(f64, f64); 4] {
    let w = img.width() as f64;
    let h = img.height() as f64;

    // Intelligent default corners with 5% margin
    [
        (w * 0.05, h * 0.05),
        (w * 0.95, h * 0.05),
        (w * 0.95, h * 0.95),
        (w * 0.05, h * 0.95),
    ]
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
