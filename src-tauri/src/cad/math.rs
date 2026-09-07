use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegistrationResult {
    pub offset_x: f64,
    pub offset_y: f64,
    pub rotation_deg: f64,
    pub scale_factor: f64,
}

pub fn calculate_scale_px_per_mm(p1: (f64, f64), p2: (f64, f64), real_mm: f64) -> Result<f64, String> {
    if real_mm <= 0.0 {
        return Err("Реальный размер в мм должен быть больше нуля".to_string());
    }
    let dx = p2.0 - p1.0;
    let dy = p2.1 - p1.1;
    let dist_px = (dx * dx + dy * dy).sqrt();
    if dist_px < 1.0 {
        return Err("Точки находятся слишком близко друг к другу".to_string());
    }
    Ok(dist_px / real_mm)
}

pub fn calculate_level_angle_deg(p1: (f64, f64), p2: (f64, f64)) -> f64 {
    let dx = p2.0 - p1.0;
    let dy = p2.1 - p1.1;
    let angle_rad = dy.atan2(dx);
    let mut angle_deg = angle_rad.to_degrees();

    // Snap near horizontal (-180, 0, 180)
    if angle_deg > 90.0 {
        angle_deg -= 180.0;
    } else if angle_deg < -90.0 {
        angle_deg += 180.0;
    }
    angle_deg
}

pub fn calculate_affine_registration(
    top1: (f64, f64),
    top2: (f64, f64),
    bot1: (f64, f64),
    bot2: (f64, f64),
) -> Result<RegistrationResult, String> {
    let dx_top = top2.0 - top1.0;
    let dy_top = top2.1 - top1.1;
    let dist_top = (dx_top * dx_top + dy_top * dy_top).sqrt();

    let dx_bot = bot2.0 - bot1.0;
    let dy_bot = bot2.1 - bot1.1;
    let dist_bot = (dx_bot * dx_bot + dy_bot * dy_bot).sqrt();

    if dist_top < 1e-3 || dist_bot < 1e-3 {
        return Err("Опорные точки вырождены (нулевое расстояние)".to_string());
    }

    let scale_factor = dist_top / dist_bot;
    let angle_top = dy_top.atan2(dx_top);
    let angle_bot = dy_bot.atan2(dx_bot);
    let rotation_rad = angle_top - angle_bot;
    let rotation_deg = rotation_rad.to_degrees();

    // Calculate offset: top1 = bot1 rotated & scaled + offset
    let cos_a = rotation_rad.cos() * scale_factor;
    let sin_a = rotation_rad.sin() * scale_factor;

    let bot1_rx = bot1.0 * cos_a - bot1.1 * sin_a;
    let bot1_ry = bot1.0 * sin_a + bot1.1 * cos_a;

    let offset_x = top1.0 - bot1_rx;
    let offset_y = top1.1 - bot1_ry;

    Ok(RegistrationResult {
        offset_x,
        offset_y,
        rotation_deg,
        scale_factor,
    })
}
