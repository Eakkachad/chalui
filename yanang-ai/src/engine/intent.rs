//! Intent Router — classifies user input into navigation/POI/traffic/weather/chat/food
//! Uses keyword-based classification for speed (no extra API call needed)

/// All possible intents
#[derive(Debug, Clone, Copy, PartialEq, serde::Serialize, serde::Deserialize)]
pub enum Intent {
    Navigate,
    Poi,
    Traffic,
    Weather,
    Food,
    Chat,
}

impl Intent {
    pub fn label_th(&self) -> &'static str {
        match self {
            Intent::Navigate => "นำทาง",
            Intent::Poi => "สถานที่",
            Intent::Traffic => "จราจร",
            Intent::Weather => "อากาศ",
            Intent::Food => "อาหาร",
            Intent::Chat => "ทั่วไป",
        }
    }

    pub fn emoji(&self) -> &'static str {
        match self {
            Intent::Navigate => "🗺️",
            Intent::Poi => "📍",
            Intent::Traffic => "🚗",
            Intent::Weather => "🌤️",
            Intent::Food => "🍽️",
            Intent::Chat => "💬",
        }
    }
}

/// Classify intent from user message text
pub fn classify_intent(text: &str) -> Intent {
    let t = text.to_lowercase();

    // Navigate — route, directions, travel
    if contains_any(
        &t,
        &[
            "พาไป",
            "ไปยัง",
            "เส้นทาง",
            "ทางไป",
            "วิธีไป",
            "เดินทาง",
            "นavigate",
            "route",
            "direction",
            "ไป",
            "ถึง",
            "จาก",
            "how to go",
            "สนามบิน",
            "สถานี",
            "โรงแรม",
            "bts",
            "mrt",
            "รถไฟฟ้า",
            "ขับรถ",
            "เดิน",
            "ปั่น",
            "taxi",
        ],
    ) {
        return Intent::Navigate;
    }

    // POI — places, landmarks
    if contains_any(
        &t,
        &[
            "สถานที่",
            "ที่เที่ยว",
            " landmark",
            "tourist",
            "attraction",
            "พิพิธภัณฑ์",
            "วัด",
            "สวน",
            "ห้าง",
            "ใกล้",
            "ใกล้ฉัน",
            "แถวนี้",
            "nearby",
            "near",
            "ที่ไหน",
            "where is",
            "แนะนำที่",
        ],
    ) {
        return Intent::Poi;
    }

    // Traffic
    if contains_any(
        &t,
        &[
            "รถติด",
            "traffic",
            "จราจร",
            "ติด",
            "ชั่วโมงเร่งด่วน",
            "เส้น",
            "ถนน",
            "ทางด่วน",
            "โทลล์เวย์",
            "motorway",
            "สะพาน",
            "อุโมงค์",
        ],
    ) {
        return Intent::Traffic;
    }

    // Weather
    if contains_any(
        &t,
        &[
            "อากาศ",
            "weather",
            "ฝน",
            "ร้อน",
            "หนาว",
            "พายุ",
            "temperature",
            "อุณหภูมิ",
            "สภาพอากาศ",
            "แดด",
            "เมฆ",
            "ลม",
            "humidity",
        ],
    ) {
        return Intent::Weather;
    }

    // Food
    if contains_any(
        &t,
        &[
            "ร้านอาหาร",
            "food",
            "กิน",
            "ทาน",
            "ข้าว",
            "ร้าน",
            "cafe",
            "กาแฟ",
            "ชา",
            "ขนม",
            "dessert",
            "อาหาร",
            "ร้านดัง",
            "แนะนำร้าน",
            "อร่อย",
        ],
    ) {
        return Intent::Food;
    }

    // Default — chat
    Intent::Chat
}

fn contains_any(text: &str, keywords: &[&str]) -> bool {
    keywords.iter().any(|&kw| text.contains(kw))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_navigate_intent() {
        assert_eq!(classify_intent("พาไปสนามบินสุวรรณภูมิ"), Intent::Navigate);
        assert_eq!(classify_intent("เส้นทางไปสยาม"), Intent::Navigate);
    }

    #[test]
    fn test_poi_intent() {
        assert_eq!(classify_intent("มีที่เที่ยวใกล้ฉันไหม"), Intent::Poi);
        assert_eq!(classify_intent("วัดแถวนี้"), Intent::Poi);
    }

    #[test]
    fn test_chat_intent() {
        assert_eq!(classify_intent("สวัสดี"), Intent::Chat);
        assert_eq!(classify_intent("คุณชื่ออะไร"), Intent::Chat);
    }

    #[test]
    fn test_traffic_intent() {
        assert_eq!(classify_intent("รถติดไหม"), Intent::Traffic);
    }

    #[test]
    fn test_weather_intent() {
        assert_eq!(classify_intent("อากาศวันนี้เป็นไง"), Intent::Weather);
    }

    #[test]
    fn test_food_intent() {
        assert_eq!(classify_intent("ร้านอาหารใกล้ฉัน"), Intent::Food);
    }
}
