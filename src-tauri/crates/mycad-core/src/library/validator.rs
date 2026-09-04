//! Валидация целостности данных библиотеки компонентов

use super::model::{DeviceDefinition, PackageDefinition};
use std::collections::HashSet;
use thiserror::Error;

#[derive(Debug, Error, PartialEq)]
pub enum ValidationError {
    #[error("Поле '{0}' не может быть пустым")]
    EmptyField(&'static str),

    #[error("Некорректный размер '{field}': значение {val} должно быть > 0")]
    InvalidDimension { field: &'static str, val: f64 },

    #[error("Дубликат номера контактной площадки: padNum={0}")]
    DuplicatePadNum(u32),

    #[error("Дубликат логического вывода: pinId='{0}'")]
    DuplicatePinId(String),

    #[error("Вариант исполнения по умолчанию '{0}' отсутствует в списке вариантов")]
    MissingDefaultVariant(String),

    #[error("Привязка вывода '{pin_id}' ссылается на несуществующую площадку padNum={pad_num}")]
    DanglingPinMapping { pin_id: String, pad_num: u32 },

    #[error("Привязка корпуса '{package_id}' ссылается на неизвестный вывод '{pin_id}'")]
    UnknownPinInMapping { package_id: String, pin_id: String },
}

pub fn validate_package(pkg: &PackageDefinition) -> Result<(), ValidationError> {
    if pkg.id.trim().is_empty() {
        return Err(ValidationError::EmptyField("id"));
    }
    if pkg.name.trim().is_empty() {
        return Err(ValidationError::EmptyField("name"));
    }
    if pkg.body_width <= 0.0 {
        return Err(ValidationError::InvalidDimension {
            field: "bodyWidth",
            val: pkg.body_width,
        });
    }
    if pkg.body_height <= 0.0 {
        return Err(ValidationError::InvalidDimension {
            field: "bodyHeight",
            val: pkg.body_height,
        });
    }

    let mut pad_nums = HashSet::new();
    for pad in &pkg.pads {
        if pad.width <= 0.0 {
            return Err(ValidationError::InvalidDimension {
                field: "pad.width",
                val: pad.width,
            });
        }
        if pad.height <= 0.0 {
            return Err(ValidationError::InvalidDimension {
                field: "pad.height",
                val: pad.height,
            });
        }
        if !pad_nums.insert(pad.pad_num) {
            return Err(ValidationError::DuplicatePadNum(pad.pad_num));
        }
    }

    if !pkg.variants.is_empty()
        && !pkg.variants.iter().any(|v| v.id == pkg.default_variant_id)
    {
        return Err(ValidationError::MissingDefaultVariant(
            pkg.default_variant_id.clone(),
        ));
    }

    Ok(())
}

pub fn validate_device(
    device: &DeviceDefinition,
    package_lookup: Option<&dyn Fn(&str) -> Option<PackageDefinition>>,
) -> Result<(), ValidationError> {
    if device.id.trim().is_empty() {
        return Err(ValidationError::EmptyField("id"));
    }
    if device.name.trim().is_empty() {
        return Err(ValidationError::EmptyField("name"));
    }
    if device.category.trim().is_empty() {
        return Err(ValidationError::EmptyField("category"));
    }
    if device.designator_prefix.trim().is_empty() {
        return Err(ValidationError::EmptyField("designatorPrefix"));
    }

    let mut pin_ids = HashSet::new();
    for pin in &device.logical_pins {
        if !pin_ids.insert(&pin.id) {
            return Err(ValidationError::DuplicatePinId(pin.id.clone()));
        }
    }

    // Если передан lookup корпусов, проверяем корректность маппинга
    for mapping in &device.supported_packages {
        // Проверяем, что все ключи в pinMap — это существующие логические выводы
        for pin_id in mapping.pin_map.keys() {
            if !pin_ids.contains(pin_id) {
                return Err(ValidationError::UnknownPinInMapping {
                    package_id: mapping.package_id.clone(),
                    pin_id: pin_id.clone(),
                });
            }
        }

        if let Some(lookup) = package_lookup {
            if let Some(pkg) = lookup(&mapping.package_id) {
                let existing_pads: HashSet<u32> = pkg.pads.iter().map(|p| p.pad_num).collect();
                for (pin_id, &pad_num) in &mapping.pin_map {
                    if !existing_pads.contains(&pad_num) {
                        return Err(ValidationError::DanglingPinMapping {
                            pin_id: pin_id.clone(),
                            pad_num,
                        });
                    }
                }
            }
        }
    }

    Ok(())
}
