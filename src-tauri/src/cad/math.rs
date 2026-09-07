use serde::{Deserialize, Serialize};
use crate::models::PinItem;

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

// Parametric pad generators (units: mm)
pub fn generate_chip_pads(pad_width: f64, pad_height: f64, pitch: f64) -> Vec<PinItem> {
    vec![
        PinItem {
            id: "pin_1".into(),
            pin_number: 1,
            name: Some("1".into()),
            rel_x: -pitch / 2.0,
            rel_y: 0.0,
            shape: "rect".into(),
            width: pad_width,
            height: pad_height,
            drill_diameter: None,
            net_id: None,
            electrical_type: Some("passive".into()),
        },
        PinItem {
            id: "pin_2".into(),
            pin_number: 2,
            name: Some("2".into()),
            rel_x: pitch / 2.0,
            rel_y: 0.0,
            shape: "rect".into(),
            width: pad_width,
            height: pad_height,
            drill_diameter: None,
            net_id: None,
            electrical_type: Some("passive".into()),
        },
    ]
}

pub fn generate_soic_pads(pin_count: usize, pitch: f64, span: f64, pad_w: f64, pad_h: f64) -> Vec<PinItem> {
    let mut pins = Vec::new();
    let pins_per_side = pin_count / 2;
    let y_start = -((pins_per_side as f64 - 1.0) * pitch) / 2.0;

    // Left side: pin 1 .. pins_per_side (top to bottom)
    for i in 0..pins_per_side {
        let pin_num = (i + 1) as i32;
        pins.push(PinItem {
            id: format!("pin_{}", pin_num),
            pin_number: pin_num,
            name: Some(format!("{}", pin_num)),
            rel_x: -span / 2.0,
            rel_y: y_start + i as f64 * pitch,
            shape: "round_rect".into(),
            width: pad_w,
            height: pad_h,
            drill_diameter: None,
            net_id: None,
            electrical_type: None,
        });
    }

    // Right side: pin_count .. pins_per_side+1 (bottom to top - JEDEC U-numbering)
    for i in 0..pins_per_side {
        let pin_num = (pin_count - i) as i32;
        pins.push(PinItem {
            id: format!("pin_{}", pin_num),
            pin_number: pin_num,
            name: Some(format!("{}", pin_num)),
            rel_x: span / 2.0,
            rel_y: y_start + i as f64 * pitch,
            shape: "round_rect".into(),
            width: pad_w,
            height: pad_h,
            drill_diameter: None,
            net_id: None,
            electrical_type: None,
        });
    }

    pins.sort_by_key(|p| p.pin_number);
    pins
}

pub fn generate_qfp_pads(pins_per_side: usize, pitch: f64, span: f64, pad_w: f64, pad_h: f64) -> Vec<PinItem> {
    let total_pins = pins_per_side * 4;
    let mut pins = Vec::with_capacity(total_pins);
    let offset_start = -((pins_per_side as f64 - 1.0) * pitch) / 2.0;
    let half_span = span / 2.0;

    let mut pin_num = 1;

    // Side 1: Left (x = -half_span, y from top to bottom)
    for i in 0..pins_per_side {
        pins.push(PinItem {
            id: format!("pin_{}", pin_num),
            pin_number: pin_num,
            name: Some(format!("{}", pin_num)),
            rel_x: -half_span,
            rel_y: offset_start + i as f64 * pitch,
            shape: "rect".into(),
            width: pad_w,
            height: pad_h,
            drill_diameter: None,
            net_id: None,
            electrical_type: None,
        });
        pin_num += 1;
    }

    // Side 2: Bottom (y = half_span, x from left to right)
    for i in 0..pins_per_side {
        pins.push(PinItem {
            id: format!("pin_{}", pin_num),
            pin_number: pin_num,
            name: Some(format!("{}", pin_num)),
            rel_x: offset_start + i as f64 * pitch,
            rel_y: half_span,
            shape: "rect".into(),
            width: pad_h,
            height: pad_w,
            drill_diameter: None,
            net_id: None,
            electrical_type: None,
        });
        pin_num += 1;
    }

    // Side 3: Right (x = half_span, y from bottom to top)
    for i in 0..pins_per_side {
        let idx = pins_per_side - 1 - i;
        pins.push(PinItem {
            id: format!("pin_{}", pin_num),
            pin_number: pin_num,
            name: Some(format!("{}", pin_num)),
            rel_x: half_span,
            rel_y: offset_start + idx as f64 * pitch,
            shape: "rect".into(),
            width: pad_w,
            height: pad_h,
            drill_diameter: None,
            net_id: None,
            electrical_type: None,
        });
        pin_num += 1;
    }

    // Side 4: Top (y = -half_span, x from right to left)
    for i in 0..pins_per_side {
        let idx = pins_per_side - 1 - i;
        pins.push(PinItem {
            id: format!("pin_{}", pin_num),
            pin_number: pin_num,
            name: Some(format!("{}", pin_num)),
            rel_x: offset_start + idx as f64 * pitch,
            rel_y: -half_span,
            shape: "rect".into(),
            width: pad_h,
            height: pad_w,
            drill_diameter: None,
            net_id: None,
            electrical_type: None,
        });
        pin_num += 1;
    }

    pins
}
