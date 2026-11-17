//! Classic biorhythm cycles. These curves have no demonstrated predictive or
//! medical value; they are provided strictly as entertainment.

use chrono::{Duration, NaiveDate};
use serde::Serialize;
use std::f64::consts::TAU;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CycleValues {
    physical: i32,
    emotional: i32,
    intellectual: i32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelinePoint {
    date: String,
    values: CycleValues,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BiorhythmResult {
    date: String,
    days_lived: i64,
    values: CycleValues,
    timeline: Vec<TimelinePoint>,
}

fn cycle_percent(days: i64, period: f64) -> i32 {
    ((TAU * days as f64 / period).sin() * 100.0).round() as i32
}

fn values_at(days: i64) -> CycleValues {
    CycleValues {
        physical: cycle_percent(days, 23.0),
        emotional: cycle_percent(days, 28.0),
        intellectual: cycle_percent(days, 33.0),
    }
}

fn calculate(birth: NaiveDate, day: NaiveDate) -> Result<BiorhythmResult, String> {
    let days_lived = day.signed_duration_since(birth).num_days();
    if days_lived < 0 {
        return Err("The selected date is earlier than the birth date.".to_string());
    }

    let timeline = (-10..=10)
        .filter_map(|offset| day.checked_add_signed(Duration::days(offset)))
        .filter(|date| *date >= birth)
        .map(|date| TimelinePoint {
            date: date.format("%Y-%m-%d").to_string(),
            values: values_at(date.signed_duration_since(birth).num_days()),
        })
        .collect();

    Ok(BiorhythmResult {
        date: day.format("%Y-%m-%d").to_string(),
        days_lived,
        values: values_at(days_lived),
        timeline,
    })
}

#[tauri::command]
pub fn get_biorhythms(birth_date: String, target_date: String) -> Result<BiorhythmResult, String> {
    let birth = NaiveDate::parse_from_str(&birth_date, "%Y-%m-%d")
        .map_err(|_| "Invalid birth date (expected YYYY-MM-DD).".to_string())?;
    let target = NaiveDate::parse_from_str(&target_date, "%Y-%m-%d")
        .map_err(|_| "Invalid target date (expected YYYY-MM-DD).".to_string())?;
    calculate(birth, target)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn date(input: &str) -> NaiveDate {
        NaiveDate::parse_from_str(input, "%Y-%m-%d").unwrap()
    }

    #[test]
    fn all_cycles_are_zero_at_birth() {
        let result = calculate(date("2000-01-01"), date("2000-01-01")).unwrap();
        assert_eq!(result.days_lived, 0);
        assert_eq!(result.values.physical, 0);
        assert_eq!(result.values.emotional, 0);
        assert_eq!(result.values.intellectual, 0);
        assert_eq!(result.timeline.len(), 11); // No dates before birth.
    }

    #[test]
    fn cycles_return_to_zero_at_full_periods() {
        assert_eq!(values_at(23).physical, 0);
        assert_eq!(values_at(28).emotional, 0);
        assert_eq!(values_at(33).intellectual, 0);
    }

    #[test]
    fn quarter_period_is_near_peak() {
        assert!(values_at(6).physical > 99);
        assert!(values_at(7).emotional > 99);
        assert!(values_at(8).intellectual > 99);
    }

    #[test]
    fn leap_day_uses_calendar_days() {
        let result = calculate(date("2024-02-28"), date("2024-03-01")).unwrap();
        assert_eq!(result.days_lived, 2);
    }

    #[test]
    fn rejects_dates_before_birth() {
        assert!(calculate(date("2025-01-01"), date("2024-12-31")).is_err());
    }

    #[test]
    fn timeline_has_21_points_for_normal_dates() {
        let result = calculate(date("1980-01-01"), date("2026-11-17")).unwrap();
        assert_eq!(result.timeline.len(), 21);
        assert_eq!(result.timeline[10].date, "2026-11-17");
    }

    #[test]
    fn invalid_inputs_return_errors() {
        assert!(get_biorhythms("2024-02-30".into(), "2026-11-17".into()).is_err());
        assert!(get_biorhythms("2000-01-01".into(), "oops".into()).is_err());
    }
}
