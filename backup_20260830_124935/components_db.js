// components_db.js - Многоуровневая база данных радиокомпонентов и геометрии платы Пиррс 1000 Люкс

const BOARD_META = {
    "dimensions": {
        "widthPx": 9955,
        "heightPx": 3766,
        "boardRect": {
            "x": 0,
            "y": 0,
            "width": 9955,
            "height": 3766
        }
    }
};

const FOOTPRINT_LIBRARY = {
    "RES-AXIAL": {
        "id": "RES-AXIAL",
        "name": "МЛТ-0.125 (0.125W)",
        "category": "Резисторы",
        "subcategory": "Выводные (THT)",
        "mountType": "tht",
        "shape": "res-axial",
        "width": 320,
        "height": 120,
        "pinCount": 2,
        "pins": [
            {
                "num": 1,
                "name": "Вывод 1",
                "shape": "circle",
                "xRatio": 0.1,
                "yRatio": 0.5
            },
            {
                "num": 2,
                "name": "Вывод 2",
                "shape": "circle",
                "xRatio": 0.9,
                "yRatio": 0.5
            }
        ]
    },
    "RES-AXIAL-025": {
        "id": "RES-AXIAL-025",
        "name": "МЛТ-0.25 (0.25W)",
        "category": "Резисторы",
        "subcategory": "Выводные (THT)",
        "mountType": "tht",
        "shape": "res-axial",
        "width": 440,
        "height": 160,
        "pinCount": 2,
        "pins": [
            {
                "num": 1,
                "name": "Вывод 1",
                "shape": "circle",
                "xRatio": 0.08,
                "yRatio": 0.5
            },
            {
                "num": 2,
                "name": "Вывод 2",
                "shape": "circle",
                "xRatio": 0.92,
                "yRatio": 0.5
            }
        ]
    },
    "RES-AXIAL-05": {
        "id": "RES-AXIAL-05",
        "name": "МЛТ-0.5 (0.5W)",
        "category": "Резисторы",
        "subcategory": "Выводные (THT)",
        "mountType": "tht",
        "shape": "res-axial",
        "width": 560,
        "height": 200,
        "pinCount": 2,
        "pins": [
            {
                "num": 1,
                "name": "Вывод 1",
                "shape": "circle",
                "xRatio": 0.08,
                "yRatio": 0.5
            },
            {
                "num": 2,
                "name": "Вывод 2",
                "shape": "circle",
                "xRatio": 0.92,
                "yRatio": 0.5
            }
        ]
    },
    "RES-AXIAL-V": {
        "id": "RES-AXIAL-V",
        "name": "Вертикальный резистор",
        "category": "Резисторы",
        "subcategory": "Выводные (THT)",
        "mountType": "tht",
        "shape": "res-axial-v",
        "width": 160,
        "height": 260,
        "pinCount": 2,
        "pins": [
            {
                "num": 1,
                "name": "Вывод 1",
                "shape": "circle",
                "xRatio": 0.5,
                "yRatio": 0.2
            },
            {
                "num": 2,
                "name": "Вывод 2",
                "shape": "circle",
                "xRatio": 0.5,
                "yRatio": 0.8
            }
        ]
    },
    "RES-TRIM-ROUND": {
        "id": "RES-TRIM-ROUND",
        "name": "Подстроечный круглый (СП3-19 / Bourns 3386)",
        "category": "Резисторы",
        "subcategory": "Подстроечные",
        "mountType": "tht",
        "shape": "res-trim-round",
        "width": 500,
        "height": 500,
        "pinCount": 3,
        "pins": [
            {
                "num": 1,
                "name": "Вывод 1 (CCW)",
                "shape": "circle",
                "xRatio": 0.22,
                "yRatio": 0.78
            },
            {
                "num": 2,
                "name": "Движок 2 (Wiper)",
                "shape": "square",
                "xRatio": 0.5,
                "yRatio": 0.22
            },
            {
                "num": 3,
                "name": "Вывод 3 (CW)",
                "shape": "circle",
                "xRatio": 0.78,
                "yRatio": 0.78
            }
        ]
    },
    "RES-TRIM-3296": {
        "id": "RES-TRIM-3296",
        "name": "Подстроечный 3296W (Многооборотный)",
        "category": "Резисторы",
        "subcategory": "Подстроечные",
        "mountType": "tht",
        "shape": "res-trim",
        "width": 480,
        "height": 320,
        "pinCount": 3,
        "pins": [
            {
                "num": 1,
                "name": "Вывод 1",
                "shape": "circle",
                "xRatio": 0.2,
                "yRatio": 0.5
            },
            {
                "num": 2,
                "name": "Движок 2",
                "shape": "square",
                "xRatio": 0.5,
                "yRatio": 0.5
            },
            {
                "num": 3,
                "name": "Вывод 3",
                "shape": "circle",
                "xRatio": 0.8,
                "yRatio": 0.5
            }
        ]
    },
    "RES-SMD-0805": {
        "id": "RES-SMD-0805",
        "name": "SMD 0805",
        "category": "Резисторы",
        "subcategory": "SMD",
        "mountType": "smd",
        "shape": "smd-chip",
        "width": 140,
        "height": 80,
        "pinCount": 2,
        "pins": [
            {
                "num": 1,
                "name": "Контакт 1",
                "shape": "rect",
                "xRatio": 0.15,
                "yRatio": 0.5
            },
            {
                "num": 2,
                "name": "Контакт 2",
                "shape": "rect",
                "xRatio": 0.85,
                "yRatio": 0.5
            }
        ]
    },
    "RES-SMD-1206": {
        "id": "RES-SMD-1206",
        "name": "SMD 1206",
        "category": "Резисторы",
        "subcategory": "SMD",
        "mountType": "smd",
        "shape": "smd-chip",
        "width": 200,
        "height": 100,
        "pinCount": 2,
        "pins": [
            {
                "num": 1,
                "name": "Контакт 1",
                "shape": "rect",
                "xRatio": 0.15,
                "yRatio": 0.5
            },
            {
                "num": 2,
                "name": "Контакт 2",
                "shape": "rect",
                "xRatio": 0.85,
                "yRatio": 0.5
            }
        ]
    },
    "RES-SMD-2512": {
        "id": "RES-SMD-2512",
        "name": "SMD 2512 (1W)",
        "category": "Резисторы",
        "subcategory": "SMD",
        "mountType": "smd",
        "shape": "smd-chip",
        "width": 360,
        "height": 180,
        "pinCount": 2,
        "pins": [
            {
                "num": 1,
                "name": "Контакт 1",
                "shape": "rect",
                "xRatio": 0.15,
                "yRatio": 0.5
            },
            {
                "num": 2,
                "name": "Контакт 2",
                "shape": "rect",
                "xRatio": 0.85,
                "yRatio": 0.5
            }
        ]
    },
    "CAP-CERAMIC": {
        "id": "CAP-CERAMIC",
        "name": "Дисковый К10-7В",
        "category": "Конденсаторы",
        "subcategory": "Керамические",
        "mountType": "tht",
        "shape": "cap-ceramic",
        "width": 320,
        "height": 200,
        "pinCount": 2,
        "pins": [
            {
                "num": 1,
                "name": "Вывод 1",
                "shape": "circle",
                "xRatio": 0.1,
                "yRatio": 0.5
            },
            {
                "num": 2,
                "name": "Вывод 2",
                "shape": "circle",
                "xRatio": 0.9,
                "yRatio": 0.5
            }
        ]
    },
    "CAP-CERAMIC-MONO": {
        "id": "CAP-CERAMIC-MONO",
        "name": "Монолитный К10-17Б",
        "category": "Конденсаторы",
        "subcategory": "Керамические",
        "mountType": "tht",
        "shape": "cap-mono",
        "width": 300,
        "height": 180,
        "pinCount": 2,
        "pins": [
            {
                "num": 1,
                "name": "Вывод 1",
                "shape": "circle",
                "xRatio": 0.15,
                "yRatio": 0.5
            },
            {
                "num": 2,
                "name": "Вывод 2",
                "shape": "circle",
                "xRatio": 0.85,
                "yRatio": 0.5
            }
        ]
    },
    "CAP-SMD-0805": {
        "id": "CAP-SMD-0805",
        "name": "SMD 0805",
        "category": "Конденсаторы",
        "subcategory": "Керамические",
        "mountType": "smd",
        "shape": "cap-smd-mlcc",
        "width": 140,
        "height": 80,
        "pinCount": 2,
        "pins": [
            {
                "num": 1,
                "name": "Контакт 1",
                "shape": "rect",
                "xRatio": 0.15,
                "yRatio": 0.5
            },
            {
                "num": 2,
                "name": "Контакт 2",
                "shape": "rect",
                "xRatio": 0.85,
                "yRatio": 0.5
            }
        ]
    },
    "CAP-SMD-1206": {
        "id": "CAP-SMD-1206",
        "name": "SMD 1206",
        "category": "Конденсаторы",
        "subcategory": "Керамические",
        "mountType": "smd",
        "shape": "cap-smd-mlcc",
        "width": 200,
        "height": 100,
        "pinCount": 2,
        "pins": [
            {
                "num": 1,
                "name": "Контакт 1",
                "shape": "rect",
                "xRatio": 0.15,
                "yRatio": 0.5
            },
            {
                "num": 2,
                "name": "Контакт 2",
                "shape": "rect",
                "xRatio": 0.85,
                "yRatio": 0.5
            }
        ]
    },
    "CAP-RADIAL": {
        "id": "CAP-RADIAL",
        "name": "К50-35 (ø6..8мм)",
        "category": "Конденсаторы",
        "subcategory": "Электролитические",
        "mountType": "tht",
        "shape": "cap-radial",
        "width": 500,
        "height": 500,
        "pinCount": 2,
        "pins": [
            {
                "num": 1,
                "name": "+ (Анод)",
                "shape": "square",
                "xRatio": 0.28,
                "yRatio": 0.5
            },
            {
                "num": 2,
                "name": "- (Катод)",
                "shape": "circle",
                "xRatio": 0.72,
                "yRatio": 0.5
            }
        ]
    },
    "CAP-RADIAL-BIG": {
        "id": "CAP-RADIAL-BIG",
        "name": "К50-35 большой (ø10..16мм)",
        "category": "Конденсаторы",
        "subcategory": "Электролитические",
        "mountType": "tht",
        "shape": "cap-radial",
        "width": 750,
        "height": 750,
        "pinCount": 2,
        "pins": [
            {
                "num": 1,
                "name": "+ (Анод)",
                "shape": "square",
                "xRatio": 0.28,
                "yRatio": 0.5
            },
            {
                "num": 2,
                "name": "- (Катод)",
                "shape": "circle",
                "xRatio": 0.72,
                "yRatio": 0.5
            }
        ]
    },
    "CAP-TANT-SMD": {
        "id": "CAP-TANT-SMD",
        "name": "SMD Тантал (EIA 3528)",
        "category": "Конденсаторы",
        "subcategory": "Танталовые и пленочные",
        "mountType": "smd",
        "shape": "cap-tant-smd",
        "width": 240,
        "height": 180,
        "pinCount": 2,
        "pins": [
            {
                "num": 1,
                "name": "+ (Анод)",
                "shape": "rect",
                "xRatio": 0.15,
                "yRatio": 0.5
            },
            {
                "num": 2,
                "name": "- (Катод)",
                "shape": "rect",
                "xRatio": 0.85,
                "yRatio": 0.5
            }
        ]
    },
    "CAP-FILM-BOX": {
        "id": "CAP-FILM-BOX",
        "name": "К73-17 (Пленочный Box)",
        "category": "Конденсаторы",
        "subcategory": "Танталовые и пленочные",
        "mountType": "tht",
        "shape": "cap-film",
        "width": 550,
        "height": 280,
        "pinCount": 2,
        "pins": [
            {
                "num": 1,
                "name": "Вывод 1",
                "shape": "circle",
                "xRatio": 0.15,
                "yRatio": 0.5
            },
            {
                "num": 2,
                "name": "Вывод 2",
                "shape": "circle",
                "xRatio": 0.85,
                "yRatio": 0.5
            }
        ]
    },
    "DIP-8": {
        "id": "DIP-8",
        "name": "DIP-8",
        "category": "Микросхемы",
        "subcategory": "DIP (THT)",
        "mountType": "tht",
        "shape": "dip",
        "width": 500,
        "height": 400,
        "pinCount": 8
    },
    "DIP-14": {
        "id": "DIP-14",
        "name": "DIP-14",
        "category": "Микросхемы",
        "subcategory": "DIP (THT)",
        "mountType": "tht",
        "shape": "dip",
        "width": 620,
        "height": 400,
        "pinCount": 14
    },
    "DIP-16": {
        "id": "DIP-16",
        "name": "DIP-16",
        "category": "Микросхемы",
        "subcategory": "DIP (THT)",
        "mountType": "tht",
        "shape": "dip",
        "width": 1200,
        "height": 440,
        "pinCount": 16
    },
    "DIP-18": {
        "id": "DIP-18",
        "name": "DIP-18",
        "category": "Микросхемы",
        "subcategory": "DIP (THT)",
        "mountType": "tht",
        "shape": "dip",
        "width": 1400,
        "height": 460,
        "pinCount": 18
    },
    "DIP-20": {
        "id": "DIP-20",
        "name": "DIP-20",
        "category": "Микросхемы",
        "subcategory": "DIP (THT)",
        "mountType": "tht",
        "shape": "dip",
        "width": 1650,
        "height": 520,
        "pinCount": 20
    },
    "DIP-28": {
        "id": "DIP-28",
        "name": "DIP-28",
        "category": "Микросхемы",
        "subcategory": "DIP (THT)",
        "mountType": "tht",
        "shape": "dip",
        "width": 2200,
        "height": 600,
        "pinCount": 28
    },
    "DIP-40": {
        "id": "DIP-40",
        "name": "DIP-40",
        "category": "Микросхемы",
        "subcategory": "DIP (THT)",
        "mountType": "tht",
        "shape": "dip",
        "width": 3466,
        "height": 1048,
        "pinCount": 40
    },
    "SOIC-8": {
        "id": "SOIC-8",
        "name": "SOIC-8",
        "category": "Микросхемы",
        "subcategory": "SOIC",
        "mountType": "smd",
        "shape": "soic",
        "width": 340,
        "height": 380,
        "pinCount": 8
    },
    "SOIC-14": {
        "id": "SOIC-14",
        "name": "SOIC-14",
        "category": "Микросхемы",
        "subcategory": "SOIC",
        "mountType": "smd",
        "shape": "soic",
        "width": 560,
        "height": 380,
        "pinCount": 14
    },
    "SOIC-16": {
        "id": "SOIC-16",
        "name": "SOIC-16",
        "category": "Микросхемы",
        "subcategory": "SOIC",
        "mountType": "smd",
        "shape": "soic",
        "width": 680,
        "height": 380,
        "pinCount": 16
    },
    "TSSOP-20": {
        "id": "TSSOP-20",
        "name": "TSSOP-20",
        "category": "Микросхемы",
        "subcategory": "SOIC",
        "mountType": "smd",
        "shape": "soic",
        "width": 440,
        "height": 360,
        "pinCount": 20
    },
    "TQFP-32": {
        "id": "TQFP-32",
        "name": "TQFP-32 (7×7мм)",
        "category": "Микросхемы",
        "subcategory": "QFP",
        "mountType": "smd",
        "shape": "qfp",
        "width": 600,
        "height": 600,
        "pinCount": 32
    },
    "TQFP-44": {
        "id": "TQFP-44",
        "name": "TQFP-44 (10×10мм)",
        "category": "Микросхемы",
        "subcategory": "QFP",
        "mountType": "smd",
        "shape": "qfp",
        "width": 750,
        "height": 750,
        "pinCount": 44
    },
    "TO-92": {
        "id": "TO-92",
        "name": "TO-92 (КТ-26)",
        "category": "Транзисторы",
        "subcategory": "TO-92",
        "mountType": "tht",
        "shape": "to92",
        "width": 460,
        "height": 460,
        "pinCount": 3,
        "pins": [
            {
                "num": 1,
                "name": "E (Эмиттер)",
                "shape": "square",
                "xRatio": 0.26,
                "yRatio": 0.56
            },
            {
                "num": 2,
                "name": "B (База)",
                "shape": "circle",
                "xRatio": 0.5,
                "yRatio": 0.56
            },
            {
                "num": 3,
                "name": "C (Коллектор)",
                "shape": "circle",
                "xRatio": 0.74,
                "yRatio": 0.56
            }
        ]
    },
    "TO-126": {
        "id": "TO-126",
        "name": "TO-126 (КТ-27)",
        "category": "Транзисторы",
        "subcategory": "TO-126",
        "mountType": "tht",
        "shape": "to126",
        "width": 420,
        "height": 520,
        "pinCount": 3,
        "pins": [
            {
                "num": 1,
                "name": "E (Эмиттер)",
                "shape": "square",
                "xRatio": 0.2,
                "yRatio": 0.92
            },
            {
                "num": 2,
                "name": "C (Коллектор)",
                "shape": "square",
                "xRatio": 0.5,
                "yRatio": 0.92
            },
            {
                "num": 3,
                "name": "B (База)",
                "shape": "square",
                "xRatio": 0.8,
                "yRatio": 0.92
            }
        ]
    },
    "TO-220": {
        "id": "TO-220",
        "name": "TO-220 (КТ-28)",
        "category": "Транзисторы",
        "subcategory": "TO-220",
        "mountType": "tht",
        "shape": "to220",
        "width": 580,
        "height": 800,
        "pinCount": 3,
        "pins": [
            {
                "num": 1,
                "name": "Вывод 1 (IN / Gate)",
                "shape": "square",
                "xRatio": 0.2,
                "yRatio": 0.92
            },
            {
                "num": 2,
                "name": "Вывод 2 (GND / Drain)",
                "shape": "square",
                "xRatio": 0.5,
                "yRatio": 0.92
            },
            {
                "num": 3,
                "name": "Вывод 3 (OUT / Source)",
                "shape": "square",
                "xRatio": 0.8,
                "yRatio": 0.92
            }
        ]
    },
    "SOT-23": {
        "id": "SOT-23",
        "name": "SOT-23",
        "category": "Транзисторы",
        "subcategory": "SMD",
        "mountType": "smd",
        "shape": "sot23",
        "width": 200,
        "height": 180,
        "pinCount": 3,
        "pins": [
            {
                "num": 1,
                "name": "1 (B / Gate)",
                "shape": "rect",
                "xRatio": 0.25,
                "yRatio": 0.85
            },
            {
                "num": 2,
                "name": "2 (E / Source)",
                "shape": "rect",
                "xRatio": 0.75,
                "yRatio": 0.85
            },
            {
                "num": 3,
                "name": "3 (C / Drain)",
                "shape": "rect",
                "xRatio": 0.5,
                "yRatio": 0.15
            }
        ]
    },
    "SOT-223": {
        "id": "SOT-223",
        "name": "SOT-223 (Стабилизатор SMD AMS1117-3.3/5.0)",
        "category": "Транзисторы",
        "subcategory": "SMD",
        "mountType": "smd",
        "shape": "sot223",
        "width": 440,
        "height": 440,
        "pinCount": 4,
        "pins": [
            {
                "num": 1,
                "name": "1 (ADJ / GND)",
                "shape": "rect",
                "xRatio": 0.18,
                "yRatio": 0.88
            },
            {
                "num": 2,
                "name": "2 (VOUT / Center)",
                "shape": "rect",
                "xRatio": 0.5,
                "yRatio": 0.88
            },
            {
                "num": 3,
                "name": "3 (VIN / Input)",
                "shape": "rect",
                "xRatio": 0.82,
                "yRatio": 0.88
            },
            {
                "num": 4,
                "name": "TAB (VOUT / Теплоотвод)",
                "shape": "rect",
                "xRatio": 0.5,
                "yRatio": 0.15
            }
        ]
    },
    "DIODE-AXIAL": {
        "id": "DIODE-AXIAL",
        "name": "Диод / Стабилитрон (DO-35 / КД522 / 1N4148 / КС...)",
        "category": "Диоды",
        "subcategory": "Выводные (THT)",
        "mountType": "tht",
        "shape": "diode",
        "width": 340,
        "height": 140,
        "pinCount": 2,
        "pins": [
            {
                "num": 1,
                "name": "K (Катод / Полоса)",
                "shape": "circle",
                "xRatio": 0.1,
                "yRatio": 0.5
            },
            {
                "num": 2,
                "name": "A (Анод)",
                "shape": "circle",
                "xRatio": 0.9,
                "yRatio": 0.5
            }
        ]
    },
    "DIODE-DO41": {
        "id": "DIODE-DO41",
        "name": "Выпрямительный диод 1A (DO-41 / 1N4007 / 1N5819)",
        "category": "Диоды",
        "subcategory": "Выводные (THT)",
        "mountType": "tht",
        "shape": "diode",
        "width": 440,
        "height": 180,
        "pinCount": 2,
        "pins": [
            {
                "num": 1,
                "name": "K (Катод / Полоса)",
                "shape": "circle",
                "xRatio": 0.1,
                "yRatio": 0.5
            },
            {
                "num": 2,
                "name": "A (Анод)",
                "shape": "circle",
                "xRatio": 0.9,
                "yRatio": 0.5
            }
        ]
    },
    "DIODE-SOD123": {
        "id": "DIODE-SOD123",
        "name": "SMD Диод SOD-123 (1N4148W / BZX84)",
        "category": "Диоды",
        "subcategory": "SMD",
        "mountType": "smd",
        "shape": "diode-smd",
        "width": 220,
        "height": 120,
        "pinCount": 2,
        "pins": [
            {
                "num": 1,
                "name": "K (Катод / Полоса)",
                "shape": "rect",
                "xRatio": 0.15,
                "yRatio": 0.5
            },
            {
                "num": 2,
                "name": "A (Анод)",
                "shape": "rect",
                "xRatio": 0.85,
                "yRatio": 0.5
            }
        ]
    },
    "DIODE-SMA": {
        "id": "DIODE-SMA",
        "name": "SMD Силовой диод SMA (DO-214AC / M7 / SS14 / SS34)",
        "category": "Диоды",
        "subcategory": "SMD",
        "mountType": "smd",
        "shape": "diode-smd",
        "width": 320,
        "height": 180,
        "pinCount": 2,
        "pins": [
            {
                "num": 1,
                "name": "K (Катод / Полоса)",
                "shape": "rect",
                "xRatio": 0.15,
                "yRatio": 0.5
            },
            {
                "num": 2,
                "name": "A (Анод)",
                "shape": "rect",
                "xRatio": 0.85,
                "yRatio": 0.5
            }
        ]
    },
    "BRIDGE-DIP4": {
        "id": "BRIDGE-DIP4",
        "name": "Диодный мост выпрямительный (DB107S / MB6S 4-pin)",
        "category": "Диоды",
        "subcategory": "Мосты",
        "mountType": "tht",
        "shape": "bridge-rect",
        "width": 520,
        "height": 420,
        "pinCount": 4,
        "pins": [
            {
                "num": 1,
                "name": "+ (Положительный выход)",
                "shape": "square",
                "xRatio": 0.2,
                "yRatio": 0.2
            },
            {
                "num": 2,
                "name": "- (Отрицательный выход)",
                "shape": "circle",
                "xRatio": 0.8,
                "yRatio": 0.2
            },
            {
                "num": 3,
                "name": "~ (Вход AC 1)",
                "shape": "circle",
                "xRatio": 0.8,
                "yRatio": 0.8
            },
            {
                "num": 4,
                "name": "~ (Вход AC 2)",
                "shape": "circle",
                "xRatio": 0.2,
                "yRatio": 0.8
            }
        ]
    },
    "LED-THT-5MM": {
        "id": "LED-THT-5MM",
        "name": "Светодиод ø5мм индикаторный (THT)",
        "category": "Оптоэлектроника",
        "subcategory": "Светодиоды",
        "mountType": "tht",
        "shape": "led-tht",
        "width": 320,
        "height": 320,
        "pinCount": 2,
        "pins": [
            {
                "num": 1,
                "name": "A (Анод / Длинная ножка)",
                "shape": "square",
                "xRatio": 0.35,
                "yRatio": 0.5
            },
            {
                "num": 2,
                "name": "K (Катод / Срез корпуса)",
                "shape": "circle",
                "xRatio": 0.65,
                "yRatio": 0.5
            }
        ]
    },
    "LED-SMD-0805": {
        "id": "LED-SMD-0805",
        "name": "SMD Светодиод 0805",
        "category": "Оптоэлектроника",
        "subcategory": "Светодиоды",
        "mountType": "smd",
        "shape": "led-smd",
        "width": 140,
        "height": 90,
        "pinCount": 2,
        "pins": [
            {
                "num": 1,
                "name": "A (Анод)",
                "shape": "rect",
                "xRatio": 0.15,
                "yRatio": 0.5
            },
            {
                "num": 2,
                "name": "K (Катод / Метка)",
                "shape": "rect",
                "xRatio": 0.85,
                "yRatio": 0.5
            }
        ]
    },
    "OPTO-DIP4": {
        "id": "OPTO-DIP4",
        "name": "Оптопара DIP-4 (PC817 / EL817)",
        "category": "Оптоэлектроника",
        "subcategory": "Оптопары",
        "mountType": "tht",
        "shape": "dip",
        "width": 400,
        "height": 360,
        "pinCount": 4,
        "pins": [
            {
                "num": 1,
                "name": "Анод светодиода (A)",
                "shape": "square",
                "xRatio": 0.25,
                "yRatio": 0.15
            },
            {
                "num": 2,
                "name": "Катод светодиода (K)",
                "shape": "circle",
                "xRatio": 0.25,
                "yRatio": 0.85
            },
            {
                "num": 3,
                "name": "Эмиттер транзистора (E)",
                "shape": "circle",
                "xRatio": 0.75,
                "yRatio": 0.85
            },
            {
                "num": 4,
                "name": "Коллектор транзистора (C)",
                "shape": "circle",
                "xRatio": 0.75,
                "yRatio": 0.15
            }
        ]
    },
    "DISP-7SEG-2": {
        "id": "DISP-7SEG-2",
        "name": "Двухразрядный 7-сегментный LED индикатор («88»)",
        "category": "Индикаторы",
        "subcategory": "7-сегментные",
        "mountType": "tht",
        "shape": "disp-7seg",
        "width": 1800,
        "height": 975,
        "pinCount": 18
    },
    "QUARTZ-HC49": {
        "id": "QUARTZ-HC49",
        "name": "Кварцевый резонатор HC-49S/U Вертикальный (THT)",
        "category": "Кварцы",
        "subcategory": "Кварцевые резонаторы",
        "mountType": "tht",
        "shape": "quartz",
        "width": 260,
        "height": 750,
        "pinCount": 2,
        "pins": [
            {
                "num": 1,
                "name": "XTAL 1",
                "shape": "circle",
                "xRatio": 0.5,
                "yRatio": 0.12
            },
            {
                "num": 2,
                "name": "XTAL 2",
                "shape": "circle",
                "xRatio": 0.5,
                "yRatio": 0.88
            }
        ]
    },
    "QUARTZ-HC49-H": {
        "id": "QUARTZ-HC49-H",
        "name": "Кварцевый резонатор HC-49S/U Горизонтальный (THT)",
        "category": "Кварцы",
        "subcategory": "Кварцевые резонаторы",
        "mountType": "tht",
        "shape": "quartz",
        "width": 750,
        "height": 260,
        "pinCount": 2,
        "pins": [
            {
                "num": 1,
                "name": "XTAL 1",
                "shape": "circle",
                "xRatio": 0.12,
                "yRatio": 0.5
            },
            {
                "num": 2,
                "name": "XTAL 2",
                "shape": "circle",
                "xRatio": 0.88,
                "yRatio": 0.5
            }
        ]
    },
    "QUARTZ-OSC-DIL8": {
        "id": "QUARTZ-OSC-DIL8",
        "name": "Кварцевый генератор активный DIL-8 / Half-size (4-pin THT)",
        "category": "Кварцы",
        "subcategory": "Кварцевые генераторы",
        "mountType": "tht",
        "shape": "quartz-osc",
        "width": 520,
        "height": 520,
        "pinCount": 4,
        "pins": [
            {
                "num": 1,
                "name": "NC / E/D (Включение генератора / Tri-state)",
                "shape": "square",
                "xRatio": 0.15,
                "yRatio": 0.15
            },
            {
                "num": 2,
                "name": "GND (Общий / Корпус)",
                "shape": "circle",
                "xRatio": 0.85,
                "yRatio": 0.15
            },
            {
                "num": 3,
                "name": "OUT (Выход тактовой частоты Freq Out)",
                "shape": "circle",
                "xRatio": 0.85,
                "yRatio": 0.85
            },
            {
                "num": 4,
                "name": "VCC (Питание +5V)",
                "shape": "circle",
                "xRatio": 0.15,
                "yRatio": 0.85
            }
        ]
    },
    "QUARTZ-OSC-DIL14": {
        "id": "QUARTZ-OSC-DIL14",
        "name": "Кварцевый генератор активный DIL-14 / Full-size (4-pin THT)",
        "category": "Кварцы",
        "subcategory": "Кварцевые генераторы",
        "mountType": "tht",
        "shape": "quartz-osc",
        "width": 820,
        "height": 520,
        "pinCount": 4,
        "pins": [
            {
                "num": 1,
                "name": "NC / E/D (Включение генератора)",
                "shape": "square",
                "xRatio": 0.12,
                "yRatio": 0.15
            },
            {
                "num": 7,
                "name": "GND (Общий / Корпус)",
                "shape": "circle",
                "xRatio": 0.88,
                "yRatio": 0.15
            },
            {
                "num": 8,
                "name": "OUT (Выход тактовой частоты Freq Out)",
                "shape": "circle",
                "xRatio": 0.88,
                "yRatio": 0.85
            },
            {
                "num": 14,
                "name": "VCC (Питание +5V)",
                "shape": "circle",
                "xRatio": 0.12,
                "yRatio": 0.85
            }
        ]
    },
    "INDUCTOR": {
        "id": "INDUCTOR",
        "name": "Дроссель индуктивности (ДМ / Аксиальный / Радиальный)",
        "category": "Индуктивности",
        "subcategory": "Дроссели",
        "mountType": "tht",
        "shape": "inductor",
        "width": 420,
        "height": 420,
        "pinCount": 2,
        "pins": [
            {
                "num": 1,
                "name": "Вывод 1",
                "shape": "circle",
                "xRatio": 0.22,
                "yRatio": 0.5
            },
            {
                "num": 2,
                "name": "Вывод 2",
                "shape": "circle",
                "xRatio": 0.78,
                "yRatio": 0.5
            }
        ]
    },
    "CONN-HEADER": {
        "id": "CONN-HEADER",
        "name": "Штыревой разъем (PLS/PBS шаг 2.54мм)",
        "category": "Разъемы",
        "subcategory": "Штыревые",
        "mountType": "tht",
        "shape": "conn",
        "width": 1200,
        "height": 250,
        "pinCount": 8
    },
    "CONN-SCREW-2P": {
        "id": "CONN-SCREW-2P",
        "name": "Винтовой клеммник 2-pin (KF301 шаг 5.0мм)",
        "category": "Разъемы",
        "subcategory": "Винтовые клеммы",
        "mountType": "tht",
        "shape": "conn-screw",
        "width": 600,
        "height": 450,
        "pinCount": 2,
        "pins": [
            {
                "num": 1,
                "name": "Клемма 1",
                "shape": "square",
                "xRatio": 0.28,
                "yRatio": 0.5
            },
            {
                "num": 2,
                "name": "Клемма 2",
                "shape": "square",
                "xRatio": 0.72,
                "yRatio": 0.5
            }
        ]
    },
    "SW-TACT-6X6": {
        "id": "SW-TACT-6X6",
        "name": "Тактовая кнопка 6×6мм (4-pin THT)",
        "category": "Коммутация",
        "subcategory": "Кнопки",
        "mountType": "tht",
        "shape": "sw-tact",
        "width": 420,
        "height": 420,
        "pinCount": 4,
        "pins": [
            {
                "num": 1,
                "name": "Контакт 1 (A1)",
                "shape": "circle",
                "xRatio": 0.2,
                "yRatio": 0.25
            },
            {
                "num": 2,
                "name": "Контакт 2 (A2)",
                "shape": "circle",
                "xRatio": 0.8,
                "yRatio": 0.25
            },
            {
                "num": 3,
                "name": "Контакт 3 (B1)",
                "shape": "circle",
                "xRatio": 0.2,
                "yRatio": 0.75
            },
            {
                "num": 4,
                "name": "Контакт 4 (B2)",
                "shape": "circle",
                "xRatio": 0.8,
                "yRatio": 0.75
            }
        ]
    },
    "RELAY-MINI": {
        "id": "RELAY-MINI",
        "name": "Электромагнитное реле (Songle SRD / 5-pin)",
        "category": "Коммутация",
        "subcategory": "Реле",
        "mountType": "tht",
        "shape": "relay",
        "width": 950,
        "height": 750,
        "pinCount": 5,
        "pins": [
            {
                "num": 1,
                "name": "Coil 1 (Обмотка катушки)",
                "shape": "circle",
                "xRatio": 0.12,
                "yRatio": 0.25
            },
            {
                "num": 2,
                "name": "Coil 2 (Обмотка катушки)",
                "shape": "circle",
                "xRatio": 0.12,
                "yRatio": 0.75
            },
            {
                "num": 3,
                "name": "COM (Общий перекидной контакт)",
                "shape": "square",
                "xRatio": 0.88,
                "yRatio": 0.5
            },
            {
                "num": 4,
                "name": "NO (Нормально разомкнутый)",
                "shape": "circle",
                "xRatio": 0.55,
                "yRatio": 0.25
            },
            {
                "num": 5,
                "name": "NC (Нормально замкнутый)",
                "shape": "circle",
                "xRatio": 0.55,
                "yRatio": 0.75
            }
        ]
    },
    "HOLE-3.6": {
        "id": "HOLE-3.6",
        "name": "Крепежное отверстие ø3.6мм",
        "category": "Механика",
        "subcategory": "Крепеж",
        "mountType": "tht",
        "shape": "hole",
        "width": 220,
        "height": 220,
        "pinCount": 1
    },
    "TESTPOINT": {
        "id": "TESTPOINT",
        "name": "Контрольная точка (Test Point TP)",
        "category": "Механика",
        "subcategory": "Тестпоинты",
        "mountType": "smd",
        "shape": "testpoint",
        "width": 120,
        "height": 120,
        "pinCount": 1
    }
};

const COMPONENT_PRESETS = {
    "TL072": {
        "name": "TL072CN / TL082 (Сдвоенный ОУ JFET)",
        "footprint": "DIP-8",
        "designatorPrefix": "D",
        "value": "TL072CN",
        "category": "Микросхемы",
        "subcategory": "Операционные усилители",
        "notes": "Сдвоенный малошумящий операционный усилитель с полевым входом (JFET). Применяется в D7 (микрофонный усилитель и фильтр) и D8 (генератор НЧ вызова и тональных сигналов).",
        "pins": {
            "1": "1OUT (Выход ОУ 1)",
            "2": "1IN- (Инвертирующий вход ОУ 1)",
            "3": "1IN+ (Неинвертирующий вход ОУ 1)",
            "4": "V- / GND (Минус питания / Общий)",
            "5": "2IN+ (Неинвертирующий вход ОУ 2)",
            "6": "2IN- (Инвертирующий вход ОУ 2)",
            "7": "2OUT (Выход ОУ 2)",
            "8": "V+ / VCC (Плюс питания)"
        }
    },
    "LM293": {
        "name": "LM293N / LM393 (Сдвоенный компаратор)",
        "footprint": "DIP-8",
        "designatorPrefix": "D",
        "value": "LM293N",
        "category": "Микросхемы",
        "subcategory": "Компараторы",
        "notes": "Сдвоенный прецизионный компаратор напряжения. Применяется в D6 для двухпорогового контроля абонентской линии (пороги 2.4В и 4.6В).",
        "pins": {
            "1": "1OUT (Выход компаратора 1)",
            "2": "1IN- (Инвертирующий вход 1)",
            "3": "1IN+ (Неинвертирующий вход 1)",
            "4": "GND (Общий)",
            "5": "2IN+ (Неинвертирующий вход 2)",
            "6": "2IN- (Инвертирующий вход 2)",
            "7": "2OUT (Выход компаратора 2)",
            "8": "VCC (Питание +5В)"
        }
    },
    "ADM1232": {
        "name": "ADM1232AN / MAX1232 (Супервизор + WDT)",
        "footprint": "DIP-8",
        "designatorPrefix": "D",
        "value": "ADM1232AN",
        "category": "Микросхемы",
        "subcategory": "Супервизоры питания",
        "notes": "Микропроцессорный супервизор питания и сторожевой таймер. Применяется в D5 для контроля питания +5В и сброса процессора D2.",
        "pins": {
            "1": "/PBRST (Вход ручного сброса)",
            "2": "TD (Выбор времени таймаута)",
            "3": "TOL (Выбор порога допуска 5/10%)",
            "4": "GND (Общий)",
            "5": "RST (Выход прямого сброса HIGH)",
            "6": "/RST (Выход инверсного сброса LOW)",
            "7": "/ST (Вход стробирования сторожевого таймера)",
            "8": "VCC (Питание +5В)"
        }
    },
    "MC34063": {
        "name": "MC34063AP1 / КР1156ЕУ5 (DC-DC Преобразователь)",
        "footprint": "DIP-8",
        "designatorPrefix": "D",
        "value": "MC34063AP1",
        "category": "Микросхемы",
        "subcategory": "DC-DC Преобразователи",
        "notes": "Универсальный импульсный контроллер DC-DC (Step-Up / Step-Down / Inverting). В домофоне повышает +18В до +30В для абонентской линии. Pin 1 внизу справа.",
        "pins": {
            "1": "Switch Collector (Коллектор силового ключа)",
            "2": "Switch Emitter (Эмиттер силового ключа)",
            "3": "Timing Capacitor (Времязадающий конденсатор CT)",
            "4": "GND (Общий провод / Земля 0 В)",
            "5": "Comparator Inverting (Инвертирующий вход ОС / 1.25V)",
            "6": "VCC (Питание микросхемы +3.0В .. +40В)",
            "7": "Ipk Sense (Вход датчика пикового тока)",
            "8": "Driver Collector (Коллектор транзистора драйвера)"
        }
    },
    "AT24C04": {
        "name": "AT24C04-10PI / 24C04 (EEPROM I2C 4K)",
        "footprint": "DIP-8",
        "designatorPrefix": "D",
        "value": "AT24C04-10PI",
        "category": "Микросхемы",
        "subcategory": "Память (EEPROM)",
        "notes": "Энергонезависимая память с интерфейсом I2C на 4 Кбит. Применяется в D4 для хранения настроек, ключей и кодов доступа.",
        "pins": {
            "1": "A0 (Адресный вход A0)",
            "2": "A1 (Адресный вход A1)",
            "3": "A2 (Адресный вход A2)",
            "4": "GND (Общий 0В)",
            "5": "SDA (Последовательные данные I2C)",
            "6": "SCL (Тактовая частота I2C)",
            "7": "WP (Защита от записи)",
            "8": "VCC (Питание +5В)"
        }
    },
    "AT89C51": {
        "name": "AT89C55WD-24PI / AT89C51 (8-бит MCU 8051)",
        "footprint": "DIP-40",
        "designatorPrefix": "D",
        "value": "AT89C55WD-24PI",
        "category": "Микросхемы",
        "notes": "Центральный микроконтроллер домофона (архитектура MCS-51). Ключ направлен вправо. Pin 1 вверху справа, Pin 20 вверху слева, Pin 21 внизу слева, Pin 40 внизу справа.",
        "pins": {
            "1": "P1.0 (T2 / Порт 1.0)",
            "2": "P1.1 (T2EX / Порт 1.1)",
            "3": "P1.2 (Порт 1.2)",
            "4": "P1.3 (Порт 1.3)",
            "5": "P1.4 (Порт 1.4)",
            "6": "P1.5 (MOSI / Порт 1.5)",
            "7": "P1.6 (MISO / Порт 1.6)",
            "8": "P1.7 (SCK / Порт 1.7)",
            "9": "RST (Вход сброса, активный HIGH)",
            "10": "P3.0 (RXD / Прием UART)",
            "11": "P3.1 (TXD / Передача UART)",
            "12": "P3.2 (INT0 / Внешнее прерывание 0)",
            "13": "P3.3 (INT1 / Внешнее прерывание 1)",
            "14": "P3.4 (T0 / Вход таймера 0)",
            "15": "P3.5 (T1 / Вход таймера 1)",
            "16": "P3.6 (WR / Запись внешней памяти)",
            "17": "P3.7 (RD / Чтение внешней памяти)",
            "18": "XTAL2 (Выход генератора кварца)",
            "19": "XTAL1 (Вход генератора кварца 11.0592 МГц)",
            "20": "GND (Общий минус питания 0 В)",
            "21": "P2.0 (A8 / Порт 2.0)",
            "22": "P2.1 (A9 / Порт 2.1)",
            "23": "P2.2 (A10 / Порт 2.2)",
            "24": "P2.3 (A11 / Порт 2.3)",
            "25": "P2.4 (A12 / Порт 2.4)",
            "26": "P2.5 (A13 / Порт 2.5)",
            "27": "P2.6 (A14 / Порт 2.6)",
            "28": "P2.7 (A15 / Порт 2.7)",
            "29": "PSEN (Чтение внешней памяти программ)",
            "30": "ALE/PROG (Строб адреса / Программирование)",
            "31": "EA/VPP (Выбор внутренней/внешней памяти / +5В)",
            "32": "P0.7 (AD7 / Порт 0.7)",
            "33": "P0.6 (AD6 / Порт 0.6)",
            "34": "P0.5 (AD5 / Порт 0.5)",
            "35": "P0.4 (AD4 / Порт 0.4)",
            "36": "P0.3 (AD3 / Порт 0.3)",
            "37": "P0.2 (AD2 / Порт 0.2)",
            "38": "P0.1 (AD1 / Порт 0.1)",
            "39": "P0.0 (AD0 / Порт 0.0)",
            "40": "VCC (Питание +5 В)"
        }
    },
    "74HC14": {
        "name": "74HC14AN / КР1564ТЛ2 (6 инверторов с триггером Шмитта)",
        "footprint": "DIP-14",
        "designatorPrefix": "D",
        "value": "74HC14AN",
        "category": "Микросхемы",
        "notes": "Шестиканальный инвертор с триггерами Шмитта. Ключ направлен вправо (к разъему X1). Pin 1 вверху справа.",
        "pins": {
            "1": "1A (Вход 1)",
            "2": "1Y (Выход 1)",
            "3": "2A (Вход 2)",
            "4": "2Y (Выход 2)",
            "5": "3A (Вход 3)",
            "6": "3Y (Выход 3)",
            "7": "GND (Общий минус питания)",
            "8": "4Y (Выход 4)",
            "9": "4A (Вход 4)",
            "10": "5Y (Выход 5)",
            "11": "5A (Вход 5)",
            "12": "6Y (Выход 6)",
            "13": "6A (Вход 6)",
            "14": "VCC (Плюс питания +2В..+6В)"
        }
    },
    "74HC164": {
        "name": "IN74HC164AN / КР1564ИР8",
        "footprint": "DIP-14",
        "designatorPrefix": "D",
        "value": "IN74HC164AN",
        "category": "Микросхемы",
        "notes": "8-разрядный сдвиговый регистр с последовательным вводом и параллельным выводом данных (управление 7-сегментными индикаторами).",
        "pins": {
            "1": "DSA (Вход данных A)",
            "2": "DSB (Вход данных B)",
            "3": "Q0 (Выход разряда 0)",
            "4": "Q1 (Выход разряда 1)",
            "5": "Q2 (Выход разряда 2)",
            "6": "Q3 (Выход разряда 3)",
            "7": "GND (Общий 0V)",
            "8": "CP (Тактовый вход Clock)",
            "9": "MR (Асинхронный сброс Master Reset)",
            "10": "Q4 (Выход разряда 4)",
            "11": "Q5 (Выход разряда 5)",
            "12": "Q6 (Выход разряда 6)",
            "13": "Q7 (Выход разряда 7)",
            "14": "VCC (Питание +5V)"
        }
    },
    "MC34119": {
        "name": "IL34119N / MC34119 (Мостовой УЗЧ низкой мощности)",
        "footprint": "DIP-8",
        "designatorPrefix": "D",
        "value": "IL34119N",
        "category": "Микросхемы",
        "notes": "Низковольтный мостовой УЗЧ громкой связи и динамика вызова домофона. Ключ направлен вправо. Pin 1 вверху справа.",
        "pins": {
            "1": "CD (Chip Disable / Вход отключения: '0'=Вкл, '1'=Mute)",
            "2": "FC2 (Частотная коррекция / Ускорение включения)",
            "3": "FC1 (Аналоговая земля / Подавление пульсаций PSRR)",
            "4": "VIN (Вход усилителя звуковой частоты)",
            "5": "VO1 (Прямой выход усилителя #1)",
            "6": "VCC (Питание микросхемы +2.0В .. +16В)",
            "7": "GND (Общий провод / Силовая земля 0 В)",
            "8": "VO2 (Инверсный противофазный выход #2)"
        }
    },
    "NE555": {
        "name": "NE555 / КР1006ВИ1 Таймер",
        "footprint": "DIP-8",
        "designatorPrefix": "D",
        "value": "NE555P",
        "category": "Микросхемы",
        "notes": "Прецизионный интегральный таймер/генератор импульсов.",
        "pins": {
            "1": "GND (Общий)",
            "2": "TRIG (Запуск)",
            "3": "OUT (Выход)",
            "4": "RESET (Сброс)",
            "5": "CTRL (Управляющее напряжение)",
            "6": "THRESH (Порог)",
            "7": "DISCH (Разряд)",
            "8": "VCC (Питание +5..15V)"
        }
    },
    "LM358": {
        "name": "LM358 / Двойной ОУ",
        "footprint": "DIP-8",
        "designatorPrefix": "D",
        "value": "LM358N",
        "category": "Микросхемы",
        "notes": "Двухканальный операционный усилитель для аналоговой обработки звука микрофона.",
        "pins": {
            "1": "OUT1 (Выход 1)",
            "2": "IN1- (Инвертирующий вход 1)",
            "3": "IN1+ (Неинвертирующий вход 1)",
            "4": "GND / V- (Общий / Питание -)",
            "5": "IN2+ (Неинвертирующий вход 2)",
            "6": "IN2- (Инвертирующий вход 2)",
            "7": "OUT2 (Выход 2)",
            "8": "VCC / V+ (Питание +)"
        }
    },
    "24C08": {
        "name": "24C08 / 24C16 (I2C EEPROM)",
        "footprint": "DIP-8",
        "designatorPrefix": "D",
        "value": "AT24C08",
        "category": "Микросхемы",
        "notes": "Энергонезависимая память настроек, паролей квартир и ключей Touch Memory.",
        "pins": {
            "1": "A0 (Адресная линия 0)",
            "2": "A1 (Адресная линия 1)",
            "3": "A2 (Адресная линия 2)",
            "4": "GND (Общий 0V)",
            "5": "SDA (Шина данных I2C)",
            "6": "SCL (Шина тактирования I2C)",
            "7": "WP (Защита от записи Write Protect)",
            "8": "VCC (Питание +5V)"
        }
    },
    "KT3102": {
        "name": "3102ГМ / КТ3102 (NPN кремниевый биполярный)",
        "footprint": "TO-92",
        "designatorPrefix": "VT",
        "value": "3102ГМ",
        "category": "Транзисторы",
        "subcategory": "Биполярные NPN",
        "notes": "Кремниевый эпитаксиально-планарный n-p-n транзистор малой мощности с низким уровнем шума (аАО.336.122 ТУ, аналоги BC547/BC548). Корпус КТ-26 (TO-92).",
        "pins": {
            "1": "E (Эмиттер)",
            "2": "B (База)",
            "3": "C (Коллектор)"
        }
    },
    "KT3107": {
        "name": "3107Г / КТ3107 (PNP кремниевый биполярный)",
        "footprint": "TO-92",
        "designatorPrefix": "VT",
        "value": "3107Г",
        "category": "Транзисторы",
        "subcategory": "Биполярные PNP",
        "notes": "Кремниевый эпитаксиально-планарный p-n-p транзистор малой мощности (комплементарная пара к КТ3102, аналоги BC557/BC558). Корпус КТ-26 (TO-92).",
        "pins": {
            "1": "E (Эмиттер)",
            "2": "B (База)",
            "3": "C (Коллектор)"
        }
    },
    "KT815": {
        "name": "КТ815 / BD139 (NPN 1.5A 40V с фланцем)",
        "footprint": "TO-126",
        "designatorPrefix": "V",
        "value": "КТ815Г",
        "category": "Транзисторы",
        "notes": "Среднемощный силовой ключ управления замком / динамиком.",
        "pins": {
            "1": "E (Эмиттер)",
            "2": "C (Коллектор / Фланец)",
            "3": "B (База)"
        }
    },
    "KT973": {
        "name": "КТ973А (PNP составной Дарлингтона, 4А 45В)",
        "footprint": "TO-126",
        "designatorPrefix": "VT",
        "value": "КТ973А",
        "category": "Транзисторы",
        "subcategory": "Составные (Дарлингтона)",
        "notes": "Кремниевый составной PNP транзистор Дарлингтона (аАО.336.453 ТУ, аналог BD876, h21э > 750, Iк = 4А, Uкэ = 45В). Силовой электронный ключ. Корпус КТ-27 (TO-126).",
        "pins": {
            "1": "E (Эмиттер)",
            "2": "C (Коллектор / Фланец)",
            "3": "B (База)"
        }
    },
    "1180EH5A": {
        "name": "1180ЕН5А / IL1180ЕН5А (+5V 1.5A Стабилизатор)",
        "footprint": "TO-220",
        "designatorPrefix": "D",
        "value": "1180ЕН5А",
        "category": "Микросхемы",
        "notes": "Линейный интегральный стабилизатор напряжения +5.0V (1180ЕН5А, Интеграл).",
        "pins": {
            "1": "IN (+12V..+15V Вход)",
            "2": "GND (Общий/Радиатор)",
            "3": "OUT (+5.0V Стабилизированный выход)"
        }
    },
    "L7805": {
        "name": "L7805CV / КР142ЕН5А (+5V 1.5A Стабилизатор)",
        "footprint": "TO-220",
        "designatorPrefix": "DA",
        "value": "L7805CV",
        "category": "Микросхемы",
        "notes": "Линейный стабилизатор основного цифрового питания процессора +5.0V.",
        "pins": {
            "1": "IN (+12V..+15V Вход)",
            "2": "GND (Общий/Радиатор)",
            "3": "OUT (+5.0V Стабилизированный выход)"
        }
    },
    "BZX55C4V7": {
        "name": "BZX55C4V7 / КС147А (Стабилитрон 4.7V, 0.5W, DO-35)",
        "footprint": "DIODE-AXIAL",
        "designatorPrefix": "VD",
        "value": "BZX55C4V7",
        "category": "Диоды",
        "subcategory": "Стабилитроны (Зенеры)",
        "notes": "Прецизионный кремниевый стабилитрон 4.7В для защиты входов и ограничения амплитуды сигналов.",
        "pins": {
            "1": "K (Катод / Черная полоса)",
            "2": "A (Анод)"
        }
    },
    "1N5819": {
        "name": "1N5819 (Диод Шоттки 1A 40V, быстрый)",
        "footprint": "DIODE-AXIAL",
        "designatorPrefix": "VD",
        "value": "1N5819",
        "category": "Диоды",
        "subcategory": "Диоды Шоттки",
        "notes": "Высокоскоростной замыкающий диод в импульсном DC/DC преобразователе MC34063 (+30 В).",
        "pins": {
            "1": "K (Катод / Полоса)",
            "2": "A (Анод)"
        }
    },
    "1N4148": {
        "name": "1N4148 / КД522Б (Импульсный диод 100V 150mA)",
        "footprint": "DIODE-AXIAL",
        "designatorPrefix": "VD",
        "value": "1N4148",
        "category": "Диоды",
        "notes": "Высокоскоростной кремниевый переключающий диод (матрица кнопок, защита входов).",
        "pins": {
            "1": "K (Катод / Черная полоса)",
            "2": "A (Анод)"
        }
    },
    "1N4007": {
        "name": "1N4007 (Выпрямительный диод 1000V 1A)",
        "footprint": "DIODE-DO41",
        "designatorPrefix": "VD",
        "value": "1N4007",
        "category": "Диоды",
        "notes": "Силовой диод защиты от переполюсовки и защиты от ЭДС самоиндукции замка.",
        "pins": {
            "1": "K (Катод / Полоса)",
            "2": "A (Анод)"
        }
    },
    "PC817": {
        "name": "PC817 / EL817 (Оптопара гальванической развязки)",
        "footprint": "OPTO-DIP4",
        "designatorPrefix": "U",
        "value": "PC817C",
        "category": "Оптоэлектроника",
        "notes": "Оптоэлектронный изолятор для безопасного сопряжения с внешней линией домофона.",
        "pins": {
            "1": "A (Анод светодиода)",
            "2": "K (Катод светодиода)",
            "3": "E (Эмиттер транзистора)",
            "4": "C (Коллектор транзистора)"
        }
    },
    "RES-TRIM-SP3-1K": {
        "name": "СП3-19А / Bourns 3386 1k (Подстроечный резистор)",
        "footprint": "RES-TRIM-ROUND",
        "designatorPrefix": "R",
        "value": "1k",
        "category": "Резисторы",
        "notes": "Круглый однооборотный подстроечный резистор регулировки громкости/тракта/баланса (R30, R40).",
        "pins": {
            "1": "Вывод 1 (Крайний CCW)",
            "2": "Вывод 2 (Движок / Wiper)",
            "3": "Вывод 3 (Крайний CW)"
        }
    },
    "RES-TRIM-SP3-10K": {
        "name": "СП3-19А / Bourns 3386 10k (Подстроечный резистор)",
        "footprint": "RES-TRIM-ROUND",
        "designatorPrefix": "R",
        "value": "10k",
        "category": "Резисторы",
        "notes": "Круглый однооборотный подстроечный резистор регулировки (СП3-19 / Bourns 3386).",
        "pins": {
            "1": "Вывод 1 (Крайний CCW)",
            "2": "Вывод 2 (Движок / Wiper)",
            "3": "Вывод 3 (Крайний CW)"
        }
    },
    "QUARTZ-11.0592": {
        "name": "Кварцевый резонатор 11.0592 MHz (HC-49S/U)",
        "footprint": "QUARTZ-HC49",
        "designatorPrefix": "B",
        "value": "11.0592 MHz",
        "category": "Кварцы",
        "notes": "Кварцевый резонатор тактирования микроконтроллера AT89C51 на скорости UART 115200/9600 бод.",
        "pins": {
            "1": "XTAL1 (Вывод 1 / Кварцевая пластина)",
            "2": "XTAL2 (Вывод 2 / Кварцевая пластина)"
        }
    },
    "QUARTZ-OSC-11.0592": {
        "name": "Кварцевый генератор активный 11.0592 MHz (DIL-8)",
        "footprint": "QUARTZ-OSC-DIL8",
        "designatorPrefix": "B",
        "value": "OSC 11.0592MHz",
        "category": "Кварцы",
        "notes": "Активный кварцевый тактовый генератор с прямоугольным выходом TTL/CMOS 5V.",
        "pins": {
            "1": "NC / E/D (Включение генератора)",
            "2": "GND (Общий/Корпус 0V)",
            "3": "OUT (Выход тактовой частоты)",
            "4": "VCC (Питание +5V)"
        }
    },
    "CAP-CER-22P": {
        "id": "CAP-CER-22P",
        "name": "К10-7В 22pF (Керамический дисковый кварца)",
        "category": "Конденсаторы",
        "subcategory": "Керамические (THT)",
        "value": "22pF",
        "footprintId": "CAP-CERAMIC",
        "description": "Керамический дисковый конденсатор кварцевого генератора"
    },
    "CAP-CER-100N": {
        "name": "К10-7В 0.1uF / 100nF (Блокировочный дисковый)",
        "footprint": "CAP-CERAMIC",
        "designatorPrefix": "C",
        "value": "0.1uF",
        "category": "Конденсаторы",
        "notes": "Керамический дисковый блокировочный конденсатор по цепям питания цифровых микросхем.",
        "pins": {
            "1": "Вывод 1",
            "2": "Вывод 2"
        }
    },
    "CAP-MONO-100N": {
        "id": "CAP-MONO-100N",
        "name": "К10-17Б 0.1uF (Монолитный керамический)",
        "category": "Конденсаторы",
        "subcategory": "Керамические (THT)",
        "value": "0.1uF",
        "footprintId": "CAP-CERAMIC-MONO",
        "description": "Керамический монолитный блокировочный конденсатор (желтая капелька)"
    },
    "KP501": {
        "name": "КП501А (N-канальный МОП / MOSFET 240В)",
        "footprint": "TO-92",
        "designatorPrefix": "VT",
        "value": "КП501А",
        "category": "Транзисторы",
        "subcategory": "Полевые (MOSFET)",
        "notes": "Кремниевый эпитаксиально-планарный полевой МОП-транзистор с изолированным затвором и индуцированным n-каналом (АДБК.432140.485 ТУ, прототип ZVN2120). Uси = 240В, Iс = 0.18А. Корпус КТ-26 (TO-92).",
        "pins": {
            "1": "S (Исток / Source)",
            "2": "D (Сток / Drain)",
            "3": "G (Затвор / Gate)"
        }
    },
    "CAP-RAD-470U-25V": {
        "id": "CAP-RAD-470U-25V",
        "name": "К50-35 470uF 25V (Электролитический фильтр выпрямителя)",
        "category": "Конденсаторы",
        "subcategory": "Электролитические (THT)",
        "value": "470uF x 25V",
        "footprintId": "CAP-RADIAL-BIG",
        "description": "Радиальный электролитический конденсатор фильтра питания"
    },
    "CAP-RAD-220U-16V": {
        "id": "CAP-RAD-220U-16V",
        "name": "К50-35 220uF 16V (Электролитический фильтр +5В)",
        "category": "Конденсаторы",
        "subcategory": "Электролитические (THT)",
        "value": "220uF x 16V",
        "footprintId": "CAP-RADIAL",
        "description": "Радиальный электролитический конденсатор фильтра шины +5В"
    },
    "CAP-RAD-100U-16V": {
        "id": "CAP-RAD-100U-16V",
        "name": "К50-35 100uF 16V (Электролитический фильтр питания)",
        "category": "Конденсаторы",
        "subcategory": "Электролитические (THT)",
        "value": "100uF x 16V",
        "footprintId": "CAP-RADIAL",
        "description": "Радиальный электролитический конденсатор фильтра питания"
    },
    "CAP-RAD-47U-16V": {
        "id": "CAP-RAD-47U-16V",
        "name": "К50-35 47uF 16V (Электролитический фильтр УНЧ)",
        "category": "Конденсаторы",
        "subcategory": "Электролитические (THT)",
        "value": "47uF x 16V",
        "footprintId": "CAP-RADIAL",
        "description": "Радиальный электролитический конденсатор опорного питания УНЧ"
    },
    "CAP-RAD-10U-16V": {
        "id": "CAP-RAD-10U-16V",
        "name": "К50-35 10uF 16V (Электролитический фильтр тракта)",
        "category": "Конденсаторы",
        "subcategory": "Электролитические (THT)",
        "value": "10uF x 16V",
        "footprintId": "CAP-RADIAL",
        "description": "Радиальный электролитический конденсатор фильтра тракта/микрофона"
    }
};

const COMPONENT_CATALOG_TREE = [
    {
        "id": "resistors",
        "name": "Резисторы",
        "icon": "⚡",
        "subcategories": [
            {
                "name": "Выводные (THT)",
                "footprints": [
                    "RES-AXIAL",
                    "RES-AXIAL-025",
                    "RES-AXIAL-05",
                    "RES-AXIAL-V"
                ]
            },
            {
                "name": "SMD Чип-резисторы",
                "footprints": [
                    "RES-SMD-0805",
                    "RES-SMD-1206",
                    "RES-SMD-2512"
                ]
            },
            {
                "name": "Подстроечные и переменные",
                "footprints": [
                    "RES-TRIM-ROUND",
                    "RES-TRIM-3296"
                ]
            }
        ]
    },
    {
        "id": "capacitors",
        "name": "Конденсаторы",
        "icon": "🔋",
        "subcategories": [
            {
                "name": "Керамические (THT и SMD)",
                "footprints": [
                    "CAP-CERAMIC",
                    "CAP-CERAMIC-MONO",
                    "CAP-SMD-0805",
                    "CAP-SMD-1206"
                ]
            },
            {
                "name": "Электролитические радиальные",
                "footprints": [
                    "CAP-RADIAL",
                    "CAP-RADIAL-BIG"
                ]
            },
            {
                "name": "Танталовые и пленочные",
                "footprints": [
                    "CAP-TANT-SMD",
                    "CAP-FILM-BOX"
                ]
            }
        ]
    },
    {
        "id": "microchips",
        "name": "Микросхемы (IC)",
        "icon": "🔲",
        "subcategories": [
            {
                "name": "Корпуса DIP (Выводные)",
                "footprints": [
                    "DIP-8",
                    "DIP-14",
                    "DIP-16",
                    "DIP-18",
                    "DIP-20",
                    "DIP-28",
                    "DIP-40"
                ]
            },
            {
                "name": "Корпуса SOIC / SOP / TSSOP (SMD)",
                "footprints": [
                    "SOIC-8",
                    "SOIC-14",
                    "SOIC-16",
                    "TSSOP-20"
                ]
            },
            {
                "name": "Корпуса QFP / TQFP",
                "footprints": [
                    "TQFP-32",
                    "TQFP-44"
                ]
            }
        ]
    },
    {
        "id": "transistors",
        "name": "Транзисторы и стабилизаторы",
        "icon": "🔺",
        "subcategories": [
            {
                "name": "Выводные (THT: TO-92, TO-126, TO-220)",
                "footprints": [
                    "TO-92",
                    "TO-126",
                    "TO-220"
                ]
            },
            {
                "name": "SMD (SOT-23, SOT-223)",
                "footprints": [
                    "SOT-23",
                    "SOT-223"
                ]
            }
        ]
    },
    {
        "id": "diodes",
        "name": "Диоды и мосты",
        "icon": "🔻",
        "subcategories": [
            {
                "name": "Выводные диоды (DO-35, DO-41)",
                "footprints": [
                    "DIODE-AXIAL",
                    "DIODE-DO41",
                    "BRIDGE-DIP4"
                ]
            },
            {
                "name": "SMD Диоды (SOD-123, SMA)",
                "footprints": [
                    "DIODE-SOD123",
                    "DIODE-SMA"
                ]
            }
        ]
    },
    {
        "id": "opto",
        "name": "Оптоэлектроника",
        "icon": "💡",
        "subcategories": [
            {
                "name": "Светодиоды (THT и SMD)",
                "footprints": [
                    "LED-THT-5MM",
                    "LED-SMD-0805"
                ]
            },
            {
                "name": "Оптопары (Optocouplers)",
                "footprints": [
                    "OPTO-DIP4"
                ]
            }
        ]
    },
    {
        "id": "crystals_inductors",
        "name": "Кварцы и индуктивности",
        "icon": "💎",
        "subcategories": [
            {
                "name": "Кварцевые резонаторы HC-49",
                "footprints": [
                    "QUARTZ-HC49",
                    "QUARTZ-HC49-H"
                ]
            },
            {
                "name": "Кварцевые генераторы (DIL-8 / DIL-14)",
                "footprints": [
                    "QUARTZ-OSC-DIL8",
                    "QUARTZ-OSC-DIL14"
                ]
            },
            {
                "name": "Дроссели и катушки",
                "footprints": [
                    "INDUCTOR"
                ]
            }
        ]
    },
    {
        "id": "connectors_switches",
        "name": "Разъемы и коммутация",
        "icon": "🔌",
        "subcategories": [
            {
                "name": "Штыревые разъемы и клеммники",
                "footprints": [
                    "CONN-HEADER",
                    "CONN-SCREW-2P"
                ]
            },
            {
                "name": "Кнопки и электромагнитные реле",
                "footprints": [
                    "SW-TACT-6X6",
                    "RELAY-MINI"
                ]
            },
            {
                "name": "Индикаторы дисплея",
                "footprints": [
                    "DISP-7SEG-2"
                ]
            }
        ]
    },
    {
        "id": "hardware",
        "name": "Механика и контрольные точки",
        "icon": "⚙️",
        "subcategories": [
            {
                "name": "Крепежные отверстия",
                "footprints": [
                    "HOLE-3.6"
                ]
            },
            {
                "name": "Контрольные площадки",
                "footprints": [
                    "TESTPOINT"
                ]
            }
        ]
    }
];

const INITIAL_COMPONENTS = [
    {
        "id": "H1",
        "designator": "H1",
        "value": "ø3.6",
        "footprint": "HOLE-3.6",
        "x": 116,
        "y": 1801,
        "width": 220,
        "height": 220,
        "rotation": 0,
        "layer": "top",
        "notes": "Левое крепежное отверстие ø3.6",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "B1",
        "designator": "B1",
        "value": "Кварц 11.0592MHz",
        "footprint": "QUARTZ-HC49",
        "x": 497,
        "y": 248,
        "width": 260,
        "height": 750,
        "rotation": 0,
        "layer": "bottom",
        "notes": "Установлен с обратной стороны платы",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "C8",
        "designator": "C8",
        "value": "22pF",
        "footprint": "CAP-CERAMIC",
        "x": 73,
        "y": 272,
        "width": 363,
        "height": 159,
        "rotation": 270,
        "layer": "top",
        "notes": "Нагрузочный конденсатор кварца ZQ1 (XTAL1 MCU D2)",
        "showValue": true,
        "showDesignator": true,
        "name": "К10-7В 22пФ (Кварцевый резонатор XTAL1)"
    },
    {
        "id": "C9",
        "designator": "C9",
        "value": "22pF",
        "footprint": "CAP-CERAMIC",
        "x": 52,
        "y": 859,
        "width": 363,
        "height": 159,
        "rotation": 270,
        "layer": "top",
        "notes": "Нагрузочный конденсатор кварца ZQ1 (XTAL2 MCU D2)",
        "showValue": true,
        "showDesignator": true,
        "name": "К10-7В 22пФ (Кварцевый резонатор XTAL2)"
    },
    {
        "id": "C10",
        "designator": "C10",
        "value": "0.1uF",
        "footprint": "CAP-CERAMIC-MONO",
        "x": 506,
        "y": 1100,
        "width": 363,
        "height": 159,
        "rotation": 0,
        "layer": "top",
        "notes": "Цепь сброса RESET и фильтрации питания микроконтроллера D2",
        "showValue": true,
        "showDesignator": true,
        "name": "К10-17Б 0.1мкФ (Цепь сброса RESET / фильтр D2)"
    },
    {
        "id": "D2",
        "designator": "D2",
        "value": "AT89C51",
        "footprint": "DIP-40",
        "x": 1005,
        "y": 249,
        "width": 2918,
        "height": 760,
        "rotation": 180,
        "layer": "top",
        "notes": "Основной 8-битный микроконтроллер архитектуры MCS-51. Управляет индикацией, сканированием клавиатуры и протоколом линии.",
        "locked": false,
        "customPins": {
            "1": "P1.0 (I/O)",
            "2": "P1.1 (I/O)",
            "3": "P1.2 (I/O)",
            "4": "P1.3 (I/O)",
            "5": "P1.4 (I/O)",
            "6": "P1.5 (I/O)",
            "7": "P1.6 (I/O)",
            "8": "P1.7 (I/O)",
            "9": "RST (Сброс / Активный HIGH)",
            "10": "RXD / P3.0 (UART Прием)",
            "11": "TXD / P3.1 (UART Передача)",
            "12": "INT0 / P3.2 (Внешнее прерывание 0)",
            "13": "INT1 / P3.3 (Внешнее прерывание 1)",
            "14": "T0 / P3.4 (Таймер 0)",
            "15": "T1 / P3.5 (Таймер 1)",
            "16": "WR / P3.6 (Запись памяти)",
            "17": "RD / P3.7 (Чтение памяти)",
            "18": "XTAL2 (Выход генератора кварца)",
            "19": "XTAL1 (Вход генератора кварца 11.0592MHz)",
            "20": "GND (Общий провод / Питание 0V)",
            "21": "P2.0 / A8 (Шина адреса)",
            "22": "P2.1 / A9",
            "23": "P2.2 / A10",
            "24": "P2.3 / A11",
            "25": "P2.4 / A12",
            "26": "P2.5 / A13",
            "27": "P2.6 / A14",
            "28": "P2.7 / A15",
            "29": "PSEN (Разрешение чтения ПЗУ)",
            "30": "ALE / PROG (Строб адреса)",
            "31": "EA / VPP (+5V выбор внутренней памяти)",
            "32": "P0.7 / AD7 (Шина данных/адреса)",
            "33": "P0.6 / AD6",
            "34": "P0.5 / AD5",
            "35": "P0.4 / AD4",
            "36": "P0.3 / AD3",
            "37": "P0.2 / AD2",
            "38": "P0.1 / AD1",
            "39": "P0.0 / AD0",
            "40": "VCC (Питание +5.0V)"
        },
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "D4",
        "designator": "D4",
        "value": "AT24C08",
        "footprint": "DIP-8",
        "x": 4254,
        "y": 199,
        "width": 500,
        "height": 400,
        "rotation": 180,
        "layer": "top",
        "notes": "Энергонезависимая память настроек, паролей квартир и ключей Touch Memory.",
        "customPins": {
            "1": "A0 (Адресная линия 0)",
            "2": "A1 (Адресная линия 1)",
            "3": "A2 (Адресная линия 2)",
            "4": "GND (Общий 0V)",
            "5": "SDA (Шина данных I2C)",
            "6": "SCL (Шина тактирования I2C)",
            "7": "WP (Защита от записи Write Protect)",
            "8": "VCC (Питание +5V)"
        },
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "D5",
        "designator": "D5",
        "value": "ADM1232AN",
        "footprint": "DIP-8",
        "x": 5012,
        "y": 209,
        "width": 500,
        "height": 400,
        "rotation": 180,
        "layer": "top",
        "notes": "Микропроцессорный супервизор питания и сторожевой таймер. Применяется в D5 для контроля питания +5В и сброса процессора D2.",
        "customPins": {
            "1": "/PBRST (Вход ручного сброса)",
            "2": "TD (Выбор времени таймаута)",
            "3": "TOL (Выбор порога допуска 5/10%)",
            "4": "GND (Общий)",
            "5": "RST (Выход прямого сброса HIGH)",
            "6": "/RST (Выход инверсного сброса LOW)",
            "7": "/ST (Вход стробирования сторожевого таймера)",
            "8": "VCC (Питание +5В)"
        },
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "D8",
        "designator": "D8",
        "value": "TL072CN",
        "footprint": "DIP-8",
        "x": 6009,
        "y": 814,
        "width": 500,
        "height": 400,
        "rotation": 180,
        "layer": "top",
        "notes": "Сдвоенный малошумящий операционный усилитель с полевым входом (JFET). Применяется в D7 (микрофонный усилитель и фильтр) и D8 (генератор НЧ вызова и тональных сигналов).",
        "customPins": {
            "1": "1OUT (Выход ОУ 1)",
            "2": "1IN- (Инвертирующий вход ОУ 1)",
            "3": "1IN+ (Неинвертирующий вход ОУ 1)",
            "4": "V- / GND (Минус питания / Общий)",
            "5": "2IN+ (Неинвертирующий вход ОУ 2)",
            "6": "2IN- (Инвертирующий вход ОУ 2)",
            "7": "2OUT (Выход ОУ 2)",
            "8": "V+ / VCC (Плюс питания)"
        },
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "D7",
        "designator": "D7",
        "value": "TL072CN",
        "footprint": "DIP-8",
        "x": 7152,
        "y": 798,
        "width": 500,
        "height": 400,
        "rotation": 180,
        "layer": "top",
        "notes": "Сдвоенный малошумящий операционный усилитель с полевым входом (JFET). Применяется в D7 (микрофонный усилитель и фильтр) и D8 (генератор НЧ вызова и тональных сигналов).",
        "customPins": {
            "1": "1OUT (Выход ОУ 1)",
            "2": "1IN- (Инвертирующий вход ОУ 1)",
            "3": "1IN+ (Неинвертирующий вход ОУ 1)",
            "4": "V- / GND (Минус питания / Общий)",
            "5": "2IN+ (Неинвертирующий вход ОУ 2)",
            "6": "2IN- (Инвертирующий вход ОУ 2)",
            "7": "2OUT (Выход ОУ 2)",
            "8": "V+ / VCC (Плюс питания)"
        },
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "D6",
        "designator": "D6",
        "value": "LM293N",
        "footprint": "DIP-8",
        "x": 6709,
        "y": 2041,
        "width": 500,
        "height": 400,
        "rotation": 180,
        "layer": "top",
        "notes": "Сдвоенный прецизионный компаратор напряжения. Применяется в D6 для двухпорогового контроля абонентской линии (пороги 2.4В и 4.6В).",
        "customPins": {
            "1": "1OUT (Выход компаратора 1)",
            "2": "1IN- (Инвертирующий вход 1)",
            "3": "1IN+ (Неинвертирующий вход 1)",
            "4": "GND (Общий)",
            "5": "2IN+ (Неинвертирующий вход 2)",
            "6": "2IN- (Инвертирующий вход 2)",
            "7": "2OUT (Выход компаратора 2)",
            "8": "VCC (Питание +5В)"
        },
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "D12",
        "designator": "D12",
        "value": "MC34119",
        "footprint": "DIP-8",
        "x": 6695,
        "y": 3032,
        "width": 500,
        "height": 400,
        "rotation": 180,
        "layer": "top",
        "notes": "Низковольтный мостовой усилитель звуковой частоты. Формирует сигналы зуммера, тонального вызова и громкой связи.",
        "customPins": {
            "1": "CD (Chip Disable / Отключение)",
            "2": "FC2 (Фильтрация питания/Смещение)",
            "3": "FC1 (Фильтрация питания/Смещение)",
            "4": "IN- (Инвертирующий вход)",
            "5": "VO1 (Мостовой выход 1)",
            "6": "VCC (Питание +2..16V)",
            "7": "GND (Общий 0V)",
            "8": "VO2 (Мостовой выход 2)"
        },
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "D3",
        "designator": "D3",
        "value": "1180ЕН5А",
        "footprint": "TO-220",
        "x": 7586,
        "y": 3346,
        "width": 580,
        "height": 450,
        "rotation": 180,
        "layer": "top",
        "notes": "Интегральный линейный стабилизатор напряжения +5.0V (1180ЕН5А / IL1180ЕН5А, Интеграл). Обеспечивает основное стабилизированное питание +5V процессора D2, цифровой логики и дисплея.",
        "customPins": {
            "1": "IN (Вход +12V...+15V)",
            "2": "GND (Общий 0V / Теплоотвод)",
            "3": "OUT (Выход +5.0V)"
        },
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "D1",
        "designator": "D1",
        "value": "74HC14N",
        "footprint": "DIP-14",
        "x": 3441,
        "y": 3070,
        "width": 1043,
        "height": 316,
        "rotation": 180,
        "layer": "top",
        "notes": "6 инверторов с триггерами Шмитта. Формирование крутых фронтов сигналов линии и клавиш, подавление дребезга контактов.",
        "customPins": {
            "1": "1A (Вход инвертора 1)",
            "2": "1Y (Выход инвертора 1)",
            "3": "2A (Вход инвертора 2)",
            "4": "2Y (Выход инвертора 2)",
            "5": "3A (Вход инвертора 3)",
            "6": "3Y (Выход инвертора 3)",
            "7": "GND (Общий 0V)",
            "8": "4Y (Выход инвертора 4)",
            "9": "4A (Вход инвертора 4)",
            "10": "5Y (Выход инвертора 5)",
            "11": "5A (Вход инвертора 5)",
            "12": "6Y (Выход инвертора 6)",
            "13": "6A (Вход инвертора 6)",
            "14": "VCC (Питание +5V)"
        },
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "D11",
        "designator": "D11",
        "value": "IN74HC164AN",
        "footprint": "DIP-14",
        "x": -89,
        "y": 2862,
        "width": 1060,
        "height": 297,
        "rotation": 90,
        "layer": "top",
        "notes": "8-разрядный сдвиговый регистр с последовательным вводом и параллельным выводом данных (управление 7-сегментными индикаторами).",
        "customPins": {
            "1": "DSA (Вход данных A)",
            "2": "DSB (Вход данных B)",
            "3": "Q0 (Выход разряда 0)",
            "4": "Q1 (Выход разряда 1)",
            "5": "Q2 (Выход разряда 2)",
            "6": "Q3 (Выход разряда 3)",
            "7": "GND (Общий 0V)",
            "8": "CP (Тактовый вход Clock)",
            "9": "MR (Асинхронный сброс Master Reset)",
            "10": "Q4 (Выход разряда 4)",
            "11": "Q5 (Выход разряда 5)",
            "12": "Q6 (Выход разряда 6)",
            "13": "Q7 (Выход разряда 7)",
            "14": "VCC (Питание +5V)"
        },
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "D13",
        "designator": "D13",
        "value": "MC34063AP1",
        "footprint": "DIP-8",
        "x": 9220,
        "y": 893,
        "width": 500,
        "height": 400,
        "rotation": 270,
        "layer": "top",
        "notes": "Универсальный импульсный регулятор/преобразователь напряжения. Применяется в D13 (повышающий DC-DC +18В -> +30В абонентской линии).",
        "customPins": {
            "1": "SWC (Коллектор выходного ключа)",
            "2": "SWE (Эмиттер выходного ключа)",
            "3": "TC (Вход времязадающего конденсатора)",
            "4": "GND (Общий)",
            "5": "CII (Инвертирующий вход компаратора ОС)",
            "6": "VCC (Входное напряжение питания)",
            "7": "IS (Вход токоограничения Ipk)",
            "8": "DC (Коллектор предвыходного драйвера)"
        },
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "D9",
        "designator": "D9",
        "value": "LED Display 2-dig",
        "footprint": "DISP-7SEG-2",
        "x": 1082,
        "y": 1783,
        "width": 1408,
        "height": 912,
        "rotation": 0,
        "layer": "bottom",
        "notes": "Индикатор старших разрядов квартиры",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "D10",
        "designator": "D10",
        "value": "LED Display 2-dig",
        "footprint": "DISP-7SEG-2",
        "x": 2570,
        "y": 1783,
        "width": 1408,
        "height": 912,
        "rotation": 0,
        "layer": "bottom",
        "notes": "Индикатор младших разрядов квартиры",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "VT13",
        "designator": "VT13",
        "value": "3107Г",
        "footprint": "TO-92",
        "x": 1178,
        "y": 1392,
        "width": 319,
        "height": 229,
        "rotation": 0,
        "layer": "top",
        "notes": "Кремниевый эпитаксиально-планарный p-n-p транзистор малой мощности (комплементарная пара к КТ3102, аналоги BC557/BC558). Корпус КТ-26 (TO-92).",
        "showValue": true,
        "showDesignator": true,
        "preset": "KT3107",
        "customPins": {
            "1": "E (Эмиттер)",
            "2": "B (База)",
            "3": "C (Коллектор)"
        }
    },
    {
        "id": "VT14",
        "designator": "VT14",
        "value": "3107Г",
        "footprint": "TO-92",
        "x": 1624,
        "y": 1367,
        "width": 319,
        "height": 229,
        "rotation": 180,
        "layer": "top",
        "notes": "Кремниевый эпитаксиально-планарный p-n-p транзистор малой мощности (комплементарная пара к КТ3102, аналоги BC557/BC558). Корпус КТ-26 (TO-92).",
        "showValue": true,
        "showDesignator": true,
        "preset": "KT3107",
        "customPins": {
            "1": "E (Эмиттер)",
            "2": "B (База)",
            "3": "C (Коллектор)"
        }
    },
    {
        "id": "VT15",
        "designator": "VT15",
        "value": "3107Г",
        "footprint": "TO-92",
        "x": 2793,
        "y": 1388,
        "width": 319,
        "height": 229,
        "rotation": 0,
        "layer": "top",
        "notes": "Кремниевый эпитаксиально-планарный p-n-p транзистор малой мощности (комплементарная пара к КТ3102, аналоги BC557/BC558). Корпус КТ-26 (TO-92).",
        "showValue": true,
        "showDesignator": true,
        "preset": "KT3107",
        "customPins": {
            "1": "E (Эмиттер)",
            "2": "B (База)",
            "3": "C (Коллектор)"
        }
    },
    {
        "id": "VT16",
        "designator": "VT16",
        "value": "3107Г",
        "footprint": "TO-92",
        "x": 3231,
        "y": 1327,
        "width": 319,
        "height": 229,
        "rotation": 180,
        "layer": "top",
        "notes": "Кремниевый эпитаксиально-планарный p-n-p транзистор малой мощности (комплементарная пара к КТ3102, аналоги BC557/BC558). Корпус КТ-26 (TO-92).",
        "showValue": true,
        "showDesignator": true,
        "preset": "KT3107",
        "customPins": {
            "1": "E (Эмиттер)",
            "2": "B (База)",
            "3": "C (Коллектор)"
        }
    },
    {
        "id": "VT1",
        "designator": "VT1",
        "value": "КП501А",
        "footprint": "TO-92",
        "x": 4530,
        "y": 2334,
        "width": 319,
        "height": 229,
        "rotation": 180,
        "layer": "top",
        "notes": "Кремниевый эпитаксиально-планарный полевой МОП-транзистор с изолированным затвором и индуцированным n-каналом (АДБК.432140.485 ТУ, прототип ZVN2120). Uси = 240В, Iс = 0.18А. Корпус КТ-26 (TO-92).",
        "showValue": true,
        "showDesignator": true,
        "preset": "KP501",
        "customPins": {
            "1": "S (Исток / Source)",
            "2": "D (Сток / Drain)",
            "3": "G (Затвор / Gate)"
        }
    },
    {
        "id": "VT3",
        "designator": "VT3",
        "value": "3102ГМ",
        "footprint": "TO-92",
        "x": 5416,
        "y": 1622,
        "width": 319,
        "height": 229,
        "rotation": 270,
        "layer": "bottom",
        "notes": "Кремниевый эпитаксиально-планарный n-p-n транзистор малой мощности с низким уровнем шума (аАО.336.122 ТУ, аналоги BC547/BC548). Корпус КТ-26 (TO-92).",
        "customPins": {
            "1": "E (Эмиттер)",
            "2": "B (База)",
            "3": "C (Коллектор)"
        },
        "showValue": true,
        "showDesignator": true,
        "preset": "KT3102"
    },
    {
        "id": "VT5",
        "designator": "VT5",
        "value": "КТ3102",
        "footprint": "TO-92",
        "x": 5133,
        "y": 2248,
        "width": 319,
        "height": 229,
        "rotation": 0,
        "layer": "top",
        "notes": "Транзистор V5",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "VT6",
        "designator": "VT6",
        "value": "КТ3102",
        "footprint": "TO-92",
        "x": 5490,
        "y": 2090,
        "width": 319,
        "height": 229,
        "rotation": 270,
        "layer": "top",
        "notes": "Транзистор V6",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "VT11",
        "designator": "VT11",
        "value": "КТ973А",
        "footprint": "TO-126",
        "x": 8227,
        "y": 2548,
        "width": 230,
        "height": 612,
        "rotation": 0,
        "layer": "bottom",
        "notes": "Мощный составной кремниевый PNP транзистор Дарлингтона (КТ973А, h21э > 750, 4A 45V). Силовой электронный ключ цепей коммутации / управления нагрузкой.",
        "customPins": {
            "1": "E (Эмиттер)",
            "2": "C (Коллектор / Фланец)",
            "3": "B (База)"
        },
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "VD18",
        "designator": "VD18",
        "value": "1N4148",
        "footprint": "DIODE-AXIAL",
        "x": 1889,
        "y": 3087,
        "width": 340,
        "height": 140,
        "rotation": 0,
        "layer": "top",
        "notes": "1N4148 (Диод развязки клавиатуры A1 X1.2 pin 2, на плате: V18)",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "VD19",
        "designator": "VD19",
        "value": "1N4148",
        "footprint": "DIODE-AXIAL",
        "x": 1890,
        "y": 2937,
        "width": 340,
        "height": 140,
        "rotation": 0,
        "layer": "top",
        "notes": "1N4148 (Диод развязки клавиатуры A2 X1.2 pin 3, на плате: V19)",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "VT20",
        "designator": "VT20",
        "value": "3107Г",
        "footprint": "TO-92",
        "x": 4842,
        "y": 1769,
        "width": 319,
        "height": 229,
        "rotation": 270,
        "layer": "top",
        "notes": "Кремниевый эпитаксиально-планарный p-n-p транзистор малой мощности (комплементарная пара к КТ3102, аналоги BC557/BC558). Корпус КТ-26 (TO-92).",
        "showValue": true,
        "showDesignator": true,
        "preset": "KT3107",
        "customPins": {
            "1": "E (Эмиттер)",
            "2": "B (База)",
            "3": "C (Коллектор)"
        }
    },
    {
        "id": "VT21",
        "designator": "VT21",
        "value": "3102ГМ",
        "footprint": "TO-92",
        "x": 6052,
        "y": 2170,
        "width": 319,
        "height": 229,
        "rotation": 90,
        "layer": "top",
        "notes": "Кремниевый эпитаксиально-планарный n-p-n транзистор малой мощности с низким уровнем шума (аАО.336.122 ТУ, аналоги BC547/BC548). Корпус КТ-26 (TO-92).",
        "showValue": true,
        "showDesignator": true,
        "preset": "KT3102",
        "customPins": {
            "1": "E (Эмиттер)",
            "2": "B (База)",
            "3": "C (Коллектор)"
        }
    },
    {
        "id": "VD22",
        "designator": "VD22",
        "value": "1N4007",
        "footprint": "DIODE-AXIAL",
        "x": 9565,
        "y": 3248,
        "width": 340,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "1N4007 (Выпрямительный защитный диод питания +18В X3.1 pin 1, на плате: V22)",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "VD23",
        "designator": "VD23",
        "value": "1N5819",
        "footprint": "DIODE-AXIAL",
        "x": 9668,
        "y": 932,
        "width": 340,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "1N5819 (Диод Шоттки 1A 40V для step-up преобразователя MC34063, на плате: V23)",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "VD4",
        "designator": "VD4",
        "value": "BZX55C4V7",
        "footprint": "DIODE-AXIAL",
        "x": 5554,
        "y": 3019,
        "width": 340,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "BZX55C4V7 (Стабилитрон 4.7V линии RxD, на плате: U4)",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "VD5",
        "designator": "VD12",
        "value": "1N4148",
        "footprint": "DIODE-AXIAL",
        "x": 950,
        "y": 1576,
        "width": 340,
        "height": 140,
        "rotation": 0,
        "layer": "top",
        "notes": "1N4148 (Диод анодного питания индикаторов D9/D10, на плате: U12 / V12)",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "VT7",
        "designator": "VT7",
        "value": "3102ГМ",
        "footprint": "TO-92",
        "x": 5560,
        "y": 664,
        "width": 319,
        "height": 229,
        "rotation": 90,
        "layer": "top",
        "notes": "Кремниевый эпитаксиально-планарный n-p-n транзистор малой мощности с низким уровнем шума (аАО.336.122 ТУ, аналоги BC547/BC548). Корпус КТ-26 (TO-92).",
        "showValue": true,
        "showDesignator": true,
        "preset": "KT3102",
        "customPins": {
            "1": "E (Эмиттер)",
            "2": "B (База)",
            "3": "C (Коллектор)"
        }
    },
    {
        "id": "VD8",
        "designator": "VD8",
        "value": "BZX55C4V7",
        "footprint": "DIODE-AXIAL",
        "x": 7437,
        "y": 1566,
        "width": 340,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "BZX55C4V7 (Стабилитрон 4.7V ограничения ОУ D7.1, на плате: U8)",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "VD9",
        "designator": "VD9",
        "value": "BZX55C4V7",
        "footprint": "DIODE-AXIAL",
        "x": 7026,
        "y": 321,
        "width": 340,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "BZX55C4V7 (Стабилитрон 4.7V тракта микрофона, на плате: U9)",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "VT10",
        "designator": "VT10",
        "value": "КП501А",
        "footprint": "TO-92",
        "x": 7673,
        "y": 2098,
        "width": 319,
        "height": 229,
        "rotation": 90,
        "layer": "top",
        "notes": "Кремниевый эпитаксиально-планарный полевой МОП-транзистор с изолированным затвором и индуцированным n-каналом (АДБК.432140.485 ТУ, прототип ZVN2120). Uси = 240В, Iс = 0.18А. Корпус КТ-26 (TO-92).",
        "showValue": true,
        "showDesignator": true,
        "preset": "KP501",
        "customPins": {
            "1": "S (Исток / Source)",
            "2": "D (Сток / Drain)",
            "3": "G (Затвор / Gate)"
        }
    },
    {
        "id": "VD17",
        "designator": "VD17",
        "value": "1N4148",
        "footprint": "DIODE-AXIAL",
        "x": 851,
        "y": 3168,
        "width": 340,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "1N4148 (Диод развязки клавиатуры A0 X1.2 pin 1, на плате: U17)",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "VD2",
        "designator": "VD2",
        "value": "BZX55C4V7",
        "footprint": "DIODE-AXIAL",
        "x": 4821,
        "y": 3026,
        "width": 340,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "BZX55C4V7 (Стабилитрон 4.7V входа X2.1, на плате: U2)",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "C1",
        "designator": "C1",
        "value": "470uF x 25V",
        "footprint": "CAP-RADIAL-BIG",
        "x": 9343,
        "y": 2319,
        "width": 525,
        "height": 477,
        "rotation": 180,
        "layer": "bottom",
        "notes": "Сглаживающий фильтр выпрямителя/питания. Установлен с обратной стороны платы",
        "showValue": true,
        "showDesignator": true,
        "name": "К50-35 470мкФ 25В (Электролитический фильтр выпрямителя)"
    },
    {
        "id": "C2",
        "designator": "C2",
        "value": "0.1uF",
        "footprint": "CAP-CERAMIC-MONO",
        "x": 9233,
        "y": 595,
        "width": 363,
        "height": 159,
        "rotation": 0,
        "layer": "top",
        "notes": "Входной блокировочный фильтр стабилизатора D3 1180ЕН5А",
        "showValue": true,
        "showDesignator": true,
        "name": "К10-17Б 0.1мкФ (Входной блокировочный фильтр +5В)"
    },
    {
        "id": "C3",
        "designator": "C3",
        "value": "220uF x 16V",
        "footprint": "CAP-RADIAL",
        "x": 8776,
        "y": 121,
        "width": 432,
        "height": 477,
        "rotation": 0,
        "layer": "bottom",
        "notes": "Выходной фильтр шины +5В стабилизатора D3. Установлен с обратной стороны платы",
        "showValue": true,
        "showDesignator": true,
        "name": "К50-35 220мкФ 16В (Электролитический фильтр +5В)"
    },
    {
        "id": "C4",
        "designator": "C4",
        "value": "100uF x 16V",
        "footprint": "CAP-RADIAL",
        "x": 7960,
        "y": 866,
        "width": 601,
        "height": 470,
        "rotation": 0,
        "layer": "bottom",
        "notes": "Фильтр питания аналогового узла и УНЧ. Установлен с обратной стороны платы",
        "showValue": true,
        "showDesignator": true,
        "name": "К50-35 100мкФ 16В (Электролитический фильтр питания)"
    },
    {
        "id": "C12",
        "designator": "C12",
        "value": "47uF x 16V",
        "footprint": "CAP-RADIAL",
        "x": 7222,
        "y": 2847,
        "width": 297,
        "height": 322,
        "rotation": 90,
        "layer": "bottom",
        "notes": "Опорный фильтр средней точки VCC/2 УНЧ D12 (IL34119). Установлен с обратной стороны платы",
        "showValue": true,
        "showDesignator": true,
        "name": "К50-35 47мкФ 16В (Электролитический фильтр УНЧ)"
    },
    {
        "id": "C17",
        "designator": "C17",
        "value": "10uF x 16V",
        "footprint": "CAP-RADIAL",
        "x": 7901,
        "y": 1514,
        "width": 528,
        "height": 309,
        "rotation": 90,
        "layer": "bottom",
        "notes": "Фильтр частотной коррекции звукового тракта. Установлен с обратной стороны платы",
        "showValue": true,
        "showDesignator": true,
        "name": "К50-35 10мкФ 16В (Электролитический фильтр коррекции)"
    },
    {
        "id": "C18",
        "designator": "C18",
        "value": "10uF x 16V",
        "footprint": "CAP-RADIAL",
        "x": 7443,
        "y": 1217,
        "width": 479,
        "height": 276,
        "rotation": 0,
        "layer": "bottom",
        "notes": "Разделительный фильтр звукового тракта. Установлен с обратной стороны платы",
        "showValue": true,
        "showDesignator": true,
        "name": "К50-35 10мкФ 16В (Электролитический разделительный фильтр)"
    },
    {
        "id": "C19",
        "designator": "C19",
        "value": "10uF x 16V",
        "footprint": "CAP-RADIAL",
        "x": 8374,
        "y": 1648,
        "width": 581,
        "height": 291,
        "rotation": 0,
        "layer": "bottom",
        "notes": "Фильтр полосового детектора D7. Установлен с обратной стороны платы",
        "showValue": true,
        "showDesignator": true,
        "name": "К50-35 10мкФ 16В (Электролитический фильтр детектора)"
    },
    {
        "id": "C34",
        "designator": "C34",
        "value": "10uF x 16V",
        "footprint": "CAP-RADIAL",
        "x": 6556,
        "y": 2634,
        "width": 285,
        "height": 285,
        "rotation": 180,
        "layer": "bottom",
        "notes": "Фильтр питания электретного микрофона. Установлен с обратной стороны платы",
        "showValue": true,
        "showDesignator": true,
        "name": "К50-35 10мкФ 16В (Электролитический фильтр микрофона)"
    },
    {
        "id": "C7",
        "designator": "C7",
        "value": "0.1uF",
        "footprint": "CAP-CERAMIC-MONO",
        "x": 4700,
        "y": 254,
        "width": 363,
        "height": 159,
        "rotation": 270,
        "layer": "top",
        "notes": "Блокировочный фильтр регистров D5/D6",
        "showValue": true,
        "showDesignator": true,
        "name": "К10-17Б 0.1мкФ (Блокировочный по питанию D5/D6)"
    },
    {
        "id": "C13",
        "designator": "C13",
        "value": "0.1uF",
        "footprint": "CAP-CERAMIC-MONO",
        "x": 7881,
        "y": 74,
        "width": 363,
        "height": 159,
        "rotation": 0,
        "layer": "top",
        "notes": "Разделительный конденсатор входа УНЧ D12 (IL34119)",
        "showValue": true,
        "showDesignator": true,
        "name": "К10-17Б 0.1мкФ (Разделительный конденсатор входа УНЧ)"
    },
    {
        "id": "C14",
        "designator": "C14",
        "value": "0.1uF",
        "footprint": "CAP-CERAMIC-MONO",
        "x": 8347,
        "y": 559,
        "width": 363,
        "height": 159,
        "rotation": 270,
        "layer": "top",
        "notes": "Фильтр вывода FC (управление усилением) УНЧ D12",
        "showValue": true,
        "showDesignator": true,
        "name": "К10-17Б 0.1мкФ (Фильтр FC УНЧ D12)"
    },
    {
        "id": "C15",
        "designator": "C15",
        "value": "0.1uF",
        "footprint": "CAP-CERAMIC-MONO",
        "x": 7278,
        "y": 1628,
        "width": 363,
        "height": 159,
        "rotation": 270,
        "layer": "top",
        "notes": "Частотная коррекция тракта УНЧ D12",
        "showValue": true,
        "showDesignator": true,
        "name": "К10-17Б 0.1мкФ (Частотная коррекция УНЧ D12)"
    },
    {
        "id": "C16",
        "designator": "C16",
        "value": "0.1uF",
        "footprint": "CAP-CERAMIC-MONO",
        "x": 6850,
        "y": 1487,
        "width": 363,
        "height": 159,
        "rotation": 270,
        "layer": "top",
        "notes": "Разделительный конденсатор звукового тракта",
        "showValue": true,
        "showDesignator": true,
        "name": "К10-17Б 0.1мкФ (Разделительный конденсатор)"
    },
    {
        "id": "C20",
        "designator": "C20",
        "value": "0.1uF",
        "footprint": "CAP-CERAMIC-MONO",
        "x": 8327,
        "y": 1401,
        "width": 363,
        "height": 159,
        "rotation": 0,
        "layer": "top",
        "notes": "Полосовой фильтр D7 (TL072)",
        "showValue": true,
        "showDesignator": true,
        "name": "К10-17Б 0.1мкФ (Полосовой фильтр D7)"
    },
    {
        "id": "C22",
        "designator": "C22",
        "value": "0.1uF",
        "footprint": "CAP-CERAMIC-MONO",
        "x": 5364,
        "y": 1357,
        "width": 363,
        "height": 159,
        "rotation": 0,
        "layer": "top",
        "notes": "Полосовой фильтр D8 (TL072)",
        "showValue": true,
        "showDesignator": true,
        "name": "К10-17Б 0.1мкФ (Полосовой фильтр D8)"
    },
    {
        "id": "C23",
        "designator": "C23",
        "value": "0.1uF",
        "footprint": "CAP-CERAMIC-MONO",
        "x": 5356,
        "y": 1168,
        "width": 363,
        "height": 159,
        "rotation": 0,
        "layer": "top",
        "notes": "Полосовой фильтр D8 (TL072)",
        "showValue": true,
        "showDesignator": true,
        "name": "К10-17Б 0.1мкФ (Полосовой фильтр D8)"
    },
    {
        "id": "C24",
        "designator": "C24",
        "value": "0.1uF",
        "footprint": "CAP-CERAMIC-MONO",
        "x": 6445,
        "y": 395,
        "width": 363,
        "height": 159,
        "rotation": 270,
        "layer": "top",
        "notes": "Развязка входа операционного усилителя D8",
        "showValue": true,
        "showDesignator": true,
        "name": "К10-17Б 0.1мкФ (Развязка входа ОУ D8)"
    },
    {
        "id": "C25",
        "designator": "C25",
        "value": "0.1uF",
        "footprint": "CAP-CERAMIC-MONO",
        "x": 5856,
        "y": 244,
        "width": 363,
        "height": 159,
        "rotation": 270,
        "layer": "top",
        "notes": "Коррекция АЧХ операционного усилителя D8",
        "showValue": true,
        "showDesignator": true,
        "name": "К10-17Б 0.1мкФ (Коррекция АЧХ ОУ D8)"
    },
    {
        "id": "C26",
        "designator": "C26",
        "value": "0.1uF",
        "footprint": "CAP-CERAMIC-MONO",
        "x": 5696,
        "y": 1066,
        "width": 363,
        "height": 159,
        "rotation": 270,
        "layer": "top",
        "notes": "Фильтр питания операционного усилителя D8",
        "showValue": true,
        "showDesignator": true,
        "name": "К10-17Б 0.1мкФ (Фильтр питания ОУ D8)"
    },
    {
        "id": "C29",
        "designator": "C29",
        "value": "0.1uF",
        "footprint": "CAP-CERAMIC-MONO",
        "x": 6018,
        "y": 1508,
        "width": 363,
        "height": 159,
        "rotation": 270,
        "layer": "top",
        "notes": "Входной фильтр компаратора тонов D9 (LM293)",
        "showValue": true,
        "showDesignator": true,
        "name": "К10-17Б 0.1мкФ (Входной фильтр компаратора D9)"
    },
    {
        "id": "C30",
        "designator": "C30",
        "value": "0.1uF",
        "footprint": "CAP-CERAMIC-MONO",
        "x": 6191,
        "y": 1502,
        "width": 363,
        "height": 159,
        "rotation": 270,
        "layer": "top",
        "notes": "Интегрирующая цепь детектора тональных сигналов D9",
        "showValue": true,
        "showDesignator": true,
        "name": "К10-17Б 0.1мкФ (Интегрирующая цепь детектора D9)"
    },
    {
        "id": "C31",
        "designator": "C31",
        "value": "0.1uF",
        "footprint": "CAP-CERAMIC-MONO",
        "x": 7124,
        "y": 2536,
        "width": 363,
        "height": 159,
        "rotation": 270,
        "layer": "top",
        "notes": "Фильтр компаратора тонов D9",
        "showValue": true,
        "showDesignator": true,
        "name": "К10-17Б 0.1мкФ (Фильтр компаратора D9)"
    },
    {
        "id": "C32",
        "designator": "C32",
        "value": "0.1uF",
        "footprint": "CAP-CERAMIC-MONO",
        "x": 7420,
        "y": 2097,
        "width": 363,
        "height": 159,
        "rotation": 270,
        "layer": "top",
        "notes": "Выходной фильтр детектора тональных сигналов",
        "showValue": true,
        "showDesignator": true,
        "name": "К10-17Б 0.1мкФ (Выходной фильтр детектора)"
    },
    {
        "id": "C33",
        "designator": "C33",
        "value": "0.1uF",
        "footprint": "CAP-CERAMIC-MONO",
        "x": 6335,
        "y": 3150,
        "width": 363,
        "height": 159,
        "rotation": 270,
        "layer": "top",
        "notes": "Разделительный конденсатор микрофонного тракта",
        "showValue": true,
        "showDesignator": true,
        "name": "К10-17Б 0.1мкФ (Разделительный микрофонного тракта)"
    },
    {
        "id": "C5",
        "designator": "C5",
        "value": "0.1uF",
        "footprint": "CAP-CERAMIC-MONO",
        "x": 8164,
        "y": 3402,
        "width": 363,
        "height": 159,
        "rotation": 270,
        "layer": "top",
        "notes": "Блокировочный фильтр питания D1 (74HC14)",
        "showValue": true,
        "showDesignator": true,
        "name": "К10-17Б 0.1мкФ (Блокировочный по питанию D1)"
    },
    {
        "id": "C6",
        "designator": "C6",
        "value": "0.1uF",
        "footprint": "CAP-CERAMIC-MONO",
        "x": 7257,
        "y": 3398,
        "width": 363,
        "height": 159,
        "rotation": 270,
        "layer": "top",
        "notes": "Блокировочный фильтр питания дешифратора D4",
        "showValue": true,
        "showDesignator": true,
        "name": "К10-17Б 0.1мкФ (Блокировочный по питанию D4)"
    },
    {
        "id": "L1",
        "designator": "L1",
        "value": "100uH",
        "footprint": "INDUCTOR",
        "x": 8977,
        "y": 1881,
        "width": 420,
        "height": 420,
        "rotation": 0,
        "layer": "bottom",
        "notes": "Установлен с обратной стороны платы",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "L2",
        "designator": "L2",
        "value": "100uH",
        "footprint": "INDUCTOR",
        "x": 9494,
        "y": 122,
        "width": 420,
        "height": 420,
        "rotation": 0,
        "layer": "bottom",
        "notes": "Установлен с обратной стороны платы",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R49",
        "designator": "R49",
        "value": "1k",
        "footprint": "RES-AXIAL",
        "x": 1083,
        "y": 1193,
        "width": 380,
        "height": 140,
        "rotation": 0,
        "layer": "top",
        "notes": "Базовый ключ анода 1 разряда (V13)",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R50",
        "designator": "R50",
        "value": "1k",
        "footprint": "RES-AXIAL",
        "x": 1661,
        "y": 1190,
        "width": 380,
        "height": 140,
        "rotation": 0,
        "layer": "top",
        "notes": "Базовый ключ анода 2 разряда (V14)",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R51",
        "designator": "R51",
        "value": "1k",
        "footprint": "RES-AXIAL",
        "x": 2131,
        "y": 1415,
        "width": 380,
        "height": 140,
        "rotation": 0,
        "layer": "top",
        "notes": "Базовый ключ анода 3 разряда (V15)",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R52",
        "designator": "R52",
        "value": "1k",
        "footprint": "RES-AXIAL",
        "x": 2274,
        "y": 1258,
        "width": 380,
        "height": 140,
        "rotation": 0,
        "layer": "top",
        "notes": "Базовый ключ анода 4 разряда (V16)",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R53",
        "designator": "R53",
        "value": "470R",
        "footprint": "RES-AXIAL",
        "x": 709,
        "y": 2078,
        "width": 380,
        "height": 140,
        "rotation": 0,
        "layer": "top",
        "notes": "Токоограничение сегмента A (HDSP5521)",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R54",
        "designator": "R54",
        "value": "470R",
        "footprint": "RES-AXIAL",
        "x": 709,
        "y": 2201,
        "width": 380,
        "height": 140,
        "rotation": 0,
        "layer": "top",
        "notes": "Токоограничение сегмента B (HDSP5521)",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R58",
        "designator": "R58",
        "value": "470R",
        "footprint": "RES-AXIAL",
        "x": 709,
        "y": 2325,
        "width": 380,
        "height": 140,
        "rotation": 0,
        "layer": "top",
        "notes": "Токоограничение сегмента F (HDSP5521)",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R59",
        "designator": "R59",
        "value": "470R",
        "footprint": "RES-AXIAL",
        "x": 996,
        "y": 2784,
        "width": 380,
        "height": 140,
        "rotation": 0,
        "layer": "top",
        "notes": "Токоограничение сегмента G (HDSP5521)",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R57",
        "designator": "R57",
        "value": "470R",
        "footprint": "RES-AXIAL",
        "x": 982,
        "y": 3166,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Токоограничение сегмента E (HDSP5521)",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R55",
        "designator": "R55",
        "value": "470R",
        "footprint": "RES-AXIAL",
        "x": 1126,
        "y": 3163,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Токоограничение сегмента C (HDSP5521)",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R56",
        "designator": "R56",
        "value": "470R",
        "footprint": "RES-AXIAL",
        "x": 1270,
        "y": 3163,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Токоограничение сегмента D (HDSP5521)",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R2",
        "designator": "R2",
        "value": "47k",
        "footprint": "RES-AXIAL",
        "x": 2652,
        "y": 3165,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Входная подтяжка линии I0 (D1 74HC14)",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R3",
        "designator": "R3",
        "value": "47k",
        "footprint": "RES-AXIAL",
        "x": 2806,
        "y": 3165,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Входная подтяжка линии I1 (D1 74HC14)",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R4",
        "designator": "R4",
        "value": "47k",
        "footprint": "RES-AXIAL",
        "x": 2959,
        "y": 3164,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Входная подтяжка линии I2 (D1 74HC14)",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R5",
        "designator": "R5",
        "value": "47k",
        "footprint": "RES-AXIAL",
        "x": 3100,
        "y": 3163,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Входная подтяжка линии I3 (D1 74HC14)",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R1",
        "designator": "R1",
        "value": "2k",
        "footprint": "RES-AXIAL",
        "x": 4508,
        "y": 3014,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Входной ключ / согласование индикатора U2",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R60",
        "designator": "R60",
        "value": "1k",
        "footprint": "RES-AXIAL",
        "x": 4952,
        "y": 2953,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Ограничение тока светодиода U2",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R8",
        "designator": "R8",
        "value": "10k",
        "footprint": "RES-AXIAL",
        "x": 5252,
        "y": 3011,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Входная цепь IN1 (через оптрон U1)",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R9",
        "designator": "R9",
        "value": "1k",
        "footprint": "RES-AXIAL",
        "x": 5392,
        "y": 3015,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Входная цепь IN2 (через оптрон U1)",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R11",
        "designator": "R11",
        "value": "10k",
        "footprint": "RES-AXIAL",
        "x": 5675,
        "y": 3010,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Защитный резистор линии TxD",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R12",
        "designator": "R12",
        "value": "2k",
        "footprint": "RES-AXIAL",
        "x": 5816,
        "y": 3014,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Ограничение тока линии RxD",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R63",
        "designator": "R63",
        "value": "2k",
        "footprint": "RES-AXIAL",
        "x": 5679,
        "y": 2177,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Подтяжка к +5V выхода оптопары U20",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R13",
        "designator": "R13",
        "value": "10k",
        "footprint": "RES-AXIAL",
        "x": 5825,
        "y": 2167,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Подтяжка к GND линии RxD",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R46",
        "designator": "R46",
        "value": "20k",
        "footprint": "RES-AXIAL",
        "x": 6142,
        "y": 2568,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Входной аттенюатор УНЧ D12",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R47",
        "designator": "R47",
        "value": "10k",
        "footprint": "RES-AXIAL",
        "x": 6290,
        "y": 2568,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Фильтр цепи питания каскада УНЧ",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R48",
        "designator": "R48",
        "value": "10k",
        "footprint": "RES-AXIAL",
        "x": 6164,
        "y": 3172,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Блокировочный резистор",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R6",
        "designator": "R6",
        "value": "240R",
        "footprint": "RES-AXIAL",
        "x": 4234,
        "y": 2188,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Токоограничение общей шины входов D1",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R10",
        "designator": "R10",
        "value": "10k",
        "footprint": "RES-AXIAL",
        "x": 4378,
        "y": 1873,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Базовый делитель ключа оптрона U1",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R61",
        "designator": "R61",
        "value": "2k",
        "footprint": "RES-AXIAL",
        "x": 4671,
        "y": 1880,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Выход P16 микроконтроллера D2",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R65",
        "designator": "R65",
        "value": "10k",
        "footprint": "RES-AXIAL",
        "x": 4172,
        "y": 1333,
        "width": 380,
        "height": 140,
        "rotation": 0,
        "layer": "top",
        "notes": "Делитель компаратора (вход P05)",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R67",
        "designator": "R67",
        "value": "10k",
        "footprint": "RES-AXIAL",
        "x": 4751,
        "y": 1340,
        "width": 380,
        "height": 140,
        "rotation": 0,
        "layer": "top",
        "notes": "Делитель компаратора (вход P04)",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R66",
        "designator": "R66",
        "value": "10k",
        "footprint": "RES-AXIAL",
        "x": 4975,
        "y": 1747,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Подтяжка +5V компаратора (вход P05)",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R14",
        "designator": "R14",
        "value": "2k",
        "footprint": "RES-AXIAL",
        "x": 5122,
        "y": 1886,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Токоограничение светодиода оптопары U5",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R18",
        "designator": "R18",
        "value": "100k",
        "footprint": "RES-AXIAL",
        "x": 5203,
        "y": 868,
        "width": 380,
        "height": 140,
        "rotation": 0,
        "layer": "top",
        "notes": "Входная цепь УНЧ D12 (IL34119)",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R62",
        "designator": "R62",
        "value": "2k",
        "footprint": "RES-AXIAL",
        "x": 5194,
        "y": 1031,
        "width": 380,
        "height": 140,
        "rotation": 0,
        "layer": "top",
        "notes": "Выход P15 микроконтроллера D2",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R23",
        "designator": "R23",
        "value": "100k",
        "footprint": "RES-AXIAL",
        "x": 5696,
        "y": 316,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Входной делитель ОУ D8.1",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R22",
        "designator": "R22",
        "value": "100k",
        "footprint": "RES-AXIAL",
        "x": 5991,
        "y": 322,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Активный фильтр ОУ D8.1",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R25",
        "designator": "R25",
        "value": "100R",
        "footprint": "RES-AXIAL",
        "x": 6141,
        "y": 320,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Развязка выхода ОУ D8.1",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R27",
        "designator": "R27",
        "value": "10k",
        "footprint": "RES-AXIAL",
        "x": 5696,
        "y": 1562,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Входной резистор ОУ D8.2",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R28",
        "designator": "R28",
        "value": "100k",
        "footprint": "RES-AXIAL",
        "x": 5833,
        "y": 1566,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Цепь обратной связи ОУ D8.2",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R64",
        "designator": "R64",
        "value": "10k",
        "footprint": "RES-AXIAL",
        "x": 6210,
        "y": 1950,
        "width": 380,
        "height": 140,
        "rotation": 0,
        "layer": "top",
        "notes": "Входная цепь ключа U21",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R69",
        "designator": "R69",
        "value": "47k",
        "footprint": "RES-AXIAL",
        "x": 6702,
        "y": 934,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Нагрузка транзистора VT3",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R26",
        "designator": "R26",
        "value": "4.7k",
        "footprint": "RES-AXIAL",
        "x": 6419,
        "y": 1551,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Смещение второго каскада ОУ D8.2",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R17",
        "designator": "R17",
        "value": "75k",
        "footprint": "RES-AXIAL",
        "x": 6559,
        "y": 1486,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Обратная связь аудиофильтра УНЧ D12",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R68",
        "designator": "R68",
        "value": "2k",
        "footprint": "RES-AXIAL",
        "x": 6695,
        "y": 1549,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Базовый резистор транзистора VT3",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R21",
        "designator": "R21",
        "value": "100k",
        "footprint": "RES-AXIAL",
        "x": 7146,
        "y": 318,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Фильтр первого каскада ОУ D7.1 (TL072)",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R29",
        "designator": "R29",
        "value": "47k",
        "footprint": "RES-AXIAL",
        "x": 7282,
        "y": 321,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Полосовой фильтр D7.1",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R20",
        "designator": "R20",
        "value": "10k",
        "footprint": "RES-AXIAL",
        "x": 7432,
        "y": 317,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Смещение полевого транзистора V7",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R19",
        "designator": "R19",
        "value": "4.7k",
        "footprint": "RES-AXIAL",
        "x": 7578,
        "y": 315,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Входной фильтр микрофонного тракта",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R33",
        "designator": "R33",
        "value": "75k",
        "footprint": "RES-AXIAL",
        "x": 6988,
        "y": 1552,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Вход детектора D7.2",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R34",
        "designator": "R34",
        "value": "10k",
        "footprint": "RES-AXIAL",
        "x": 7134,
        "y": 1551,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Нагрузочный резистор компаратора",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R31",
        "designator": "R31",
        "value": "100k",
        "footprint": "RES-AXIAL",
        "x": 7567,
        "y": 1576,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Фильтр каскада D7.2",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R32",
        "designator": "R32",
        "value": "2k",
        "footprint": "RES-AXIAL",
        "x": 7716,
        "y": 1556,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Выход D7.1 на детектор амплитуды",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R30",
        "designator": "R30",
        "value": "47k",
        "footprint": "RES-TRIM-ROUND",
        "x": 7865,
        "y": 391,
        "width": 401,
        "height": 403,
        "rotation": 0,
        "layer": "top",
        "notes": "Подстроечный резистор СП3-19 (настройка полосы фильтра)",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R73",
        "designator": "R73",
        "value": "4.7k",
        "footprint": "RES-AXIAL",
        "x": 8731,
        "y": 790,
        "width": 380,
        "height": 140,
        "rotation": 0,
        "layer": "top",
        "notes": "Входной делитель высоковольтной линии (+18V)",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R72",
        "designator": "R72",
        "value": "200R",
        "footprint": "RES-AXIAL",
        "x": 8728,
        "y": 946,
        "width": 380,
        "height": 140,
        "rotation": 0,
        "layer": "top",
        "notes": "Токоизмерительный шунт стабилизатора D13",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R71",
        "designator": "R71",
        "value": "200k",
        "footprint": "RES-AXIAL",
        "x": 8725,
        "y": 1099,
        "width": 380,
        "height": 140,
        "rotation": 0,
        "layer": "top",
        "notes": "Делитель обратной связи стабилизатора D13",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R45",
        "designator": "R45",
        "value": "10k",
        "footprint": "RES-AXIAL",
        "x": 7856,
        "y": 2165,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Межкаскадное согласование",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R36",
        "designator": "R36",
        "value": "8.2k",
        "footprint": "RES-AXIAL",
        "x": 8009,
        "y": 2173,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Базовый делитель VT11 (КТ973)",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R38",
        "designator": "R38",
        "value": "100R",
        "footprint": "RES-AXIAL",
        "x": 8164,
        "y": 2105,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Нагрузка генератора вызова",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R39",
        "designator": "R39",
        "value": "1k",
        "footprint": "RES-AXIAL",
        "x": 8709,
        "y": 1630,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Коллекторная нагрузка VT11",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R40",
        "designator": "R40",
        "value": "10k",
        "footprint": "RES-TRIM-ROUND",
        "x": 8455,
        "y": 2087,
        "width": 412,
        "height": 370,
        "rotation": 180,
        "layer": "top",
        "notes": "Подстроечный резистор СП3-19 (регулировка громкости)",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R37",
        "designator": "R37",
        "value": "200R",
        "footprint": "RES-AXIAL",
        "x": 8655,
        "y": 2650,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Эмиттерный токоограничитель VT11",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R70",
        "designator": "R70",
        "value": "1.5k",
        "footprint": "RES-AXIAL",
        "x": 8987,
        "y": 2656,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Делитель импульсного стабилизатора D13",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R16",
        "designator": "R16",
        "value": "1k",
        "footprint": "RES-AXIAL",
        "x": 7262,
        "y": 2235,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Нагрузка выхода P26 микроконтроллера D2",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R15",
        "designator": "R15",
        "value": "15k",
        "footprint": "RES-AXIAL",
        "x": 7405,
        "y": 2849,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Делитель опорного напряжения LM293 (pin 2)",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R35",
        "designator": "R35",
        "value": "4.7k",
        "footprint": "RES-AXIAL",
        "x": 7559,
        "y": 2853,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Смещение каскада D7.2",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R42",
        "designator": "R42",
        "value": "75k",
        "footprint": "RES-AXIAL",
        "x": 7701,
        "y": 2771,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Делитель смещения",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R41",
        "designator": "R41",
        "value": "200k",
        "footprint": "RES-AXIAL",
        "x": 7850,
        "y": 2844,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Времязадающая цепочка",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "R43",
        "designator": "R43",
        "value": "10k",
        "footprint": "RES-AXIAL",
        "x": 8397,
        "y": 2860,
        "width": 380,
        "height": 140,
        "rotation": 270,
        "layer": "top",
        "notes": "Подтяжка базовой цепи транзистора",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "X1",
        "designator": "X1",
        "value": "Шлейф клавиатуры (7-pin)",
        "footprint": "CONN-HEADER",
        "pinCount": 7,
        "x": 1594,
        "y": 3554,
        "width": 1175,
        "height": 150,
        "rotation": 0,
        "layer": "top",
        "notes": "Места для пайки плоского шлейфа матричной клавиатуры 3×4 (7 контактных площадок)",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "X2",
        "designator": "X2",
        "value": "Межплатный шлейф + динамик (13-pin)",
        "footprint": "CONN-HEADER",
        "pinCount": 13,
        "x": 4533,
        "y": 3562,
        "width": 2222,
        "height": 150,
        "rotation": 0,
        "layer": "top",
        "notes": "Места для пайки: 13 контактов (11 контактов — межплатный разъем и подсветка клавиатуры, 2 контакта справа — подключение динамика)",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "X3",
        "designator": "X3",
        "value": "Питание и линия (4-pin)",
        "footprint": "CONN-HEADER",
        "pinCount": 4,
        "x": 8963,
        "y": 3560,
        "width": 685,
        "height": 150,
        "rotation": 0,
        "layer": "top",
        "notes": "Места для пайки: 4 контактные площадки (питание и линия связи)",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "X4",
        "designator": "X4",
        "value": "Микрофон (2-pin)",
        "footprint": "CONN-HEADER",
        "pinCount": 2,
        "x": 8248,
        "y": 51,
        "width": 462,
        "height": 150,
        "rotation": 0,
        "layer": "top",
        "notes": "Места для пайки микрофона (2 контактные площадки)",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "X5",
        "designator": "X5",
        "value": "Штыревой разъем (2-pin PLS)",
        "footprint": "CONN-HEADER",
        "pinCount": 2,
        "x": 5529,
        "y": 174,
        "width": 303,
        "height": 165,
        "rotation": 90,
        "layer": "top",
        "notes": "Штыревой контакт (2-pin вилка PLS, сервисный разъем / джампер)",
        "showValue": true,
        "showDesignator": true
    },
    {
        "id": "C_1788038902658",
        "designator": "H2",
        "value": "Крепежное отверстие ø3.6мм",
        "footprint": "HOLE-3.6",
        "x": 9637,
        "y": 1790,
        "width": 220,
        "height": 220,
        "rotation": 0,
        "layer": "top",
        "notes": "Добавлен вручную",
        "customPins": {},
        "showValue": true,
        "showDesignator": true
    }
];

window.BOARD_META = BOARD_META;
const FOOTPRINT_TEMPLATES = FOOTPRINT_LIBRARY;
window.FOOTPRINT_LIBRARY = FOOTPRINT_LIBRARY;
window.FOOTPRINT_TEMPLATES = FOOTPRINT_TEMPLATES;
window.COMPONENT_PRESETS = COMPONENT_PRESETS;
window.COMPONENT_CATALOG_TREE = COMPONENT_CATALOG_TREE;
window.INITIAL_COMPONENTS = INITIAL_COMPONENTS;
