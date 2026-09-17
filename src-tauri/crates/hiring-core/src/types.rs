//! Domain types for the hiring vertical (P1-RECRUITMENT-HIRING.md §1).
//! JSON-shaped mirrors of the SQLite rows: vector columns are `Vec<String>`
//! in Rust and `'[]'` JSON TEXT in SQLite; DNC / consent are `bool` in Rust
//! and 0/1 INTEGER in SQLite.

use serde::{Deserialize, Serialize};

/// A vacancy as filled in by the VacancyIntake wizard.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Vacancy {
    pub id: String,
    pub title: String,
    pub company: String,
    pub seniority: String,
    pub stack: Vec<String>,
    pub salary_min: i64,
    pub salary_max: i64,
    pub currency: String,
    pub work_format: String,
    pub location: String,
    pub english_level: String,
    pub must_have: Vec<String>,
    pub nice_to_have: Vec<String>,
    pub hiring_manager: String,
    pub sla_days: i64,
    /// Defaults to `"intake"` — the first stage of the vacancy lifecycle.
    pub status: String,
}

impl Default for Vacancy {
    fn default() -> Self {
        Self {
            id: String::new(),
            title: String::new(),
            company: String::new(),
            seniority: String::new(),
            stack: Vec::new(),
            salary_min: 0,
            salary_max: 0,
            currency: String::new(),
            work_format: String::new(),
            location: String::new(),
            english_level: String::new(),
            must_have: Vec::new(),
            nice_to_have: Vec::new(),
            hiring_manager: String::new(),
            sla_days: 0,
            status: "intake".to_string(),
        }
    }
}

/// One candidate contact channel. `kind` is one of
/// `"email" | "phone" | "linkedin" | "telegram"`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Contact {
    pub kind: String,
    pub value: String,
}

/// A candidate profile. `contacts` is a JSON array column in SQLite.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub struct Candidate {
    pub id: String,
    pub full_name: String,
    pub contacts: Vec<Contact>,
    pub source: String,
    pub current_role: String,
    pub years_exp: f64,
    pub stack: Vec<String>,
    pub salary_expectation: String,
    pub notice_period: String,
    pub work_format_pref: String,
    pub english_level: String,
    pub dnc: bool,
    pub consent_recording: bool,
    pub consent_data_at: Option<String>,
}

/// Scorecard grade. A 13-15, B 10-12, C 6-9, D 0-5 (max 15; submitted needs A/B).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Grade {
    A,
    B,
    C,
    D,
}

impl Grade {
    /// Map a 0-15 total to its grade band.
    pub fn from_total(total: i64) -> Grade {
        match total {
            13..=15 => Grade::A,
            10..=12 => Grade::B,
            6..=9 => Grade::C,
            _ => Grade::D,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Grade::A => "A",
            Grade::B => "B",
            Grade::C => "C",
            Grade::D => "D",
        }
    }

    /// Only A and B may be submitted to the hiring manager.
    pub fn is_submittable(&self) -> bool {
        matches!(self, Grade::A | Grade::B)
    }
}

/// Completed screening scorecard: five criteria 0-3 each, max 15.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Scorecard {
    pub total: i64,
    pub grade: Grade,
}

#[cfg(test)]
mod tests {
    use super::{Contact, Grade, Scorecard};

    #[test]
    fn grade_from_total_boundaries() {
        assert_eq!(Grade::from_total(15), Grade::A);
        assert_eq!(Grade::from_total(13), Grade::A);
        assert_eq!(Grade::from_total(12), Grade::B);
        assert_eq!(Grade::from_total(10), Grade::B);
        assert_eq!(Grade::from_total(9), Grade::C);
        assert_eq!(Grade::from_total(6), Grade::C);
        assert_eq!(Grade::from_total(5), Grade::D);
        assert_eq!(Grade::from_total(0), Grade::D);
    }

    #[test]
    fn grade_as_str_labels() {
        assert_eq!(Grade::A.as_str(), "A");
        assert_eq!(Grade::B.as_str(), "B");
        assert_eq!(Grade::C.as_str(), "C");
        assert_eq!(Grade::D.as_str(), "D");
    }

    #[test]
    fn contact_roundtrips_through_json() {
        let c = Contact { kind: "email".into(), value: "a@b.com".into() };
        let json = serde_json::to_string(&c).unwrap();
        let back: Contact = serde_json::from_str(&json).unwrap();
        assert_eq!(back, c);
    }

    #[test]
    fn scorecard_holds_total_and_grade() {
        let sc = Scorecard { total: 14, grade: Grade::from_total(14) };
        assert_eq!(sc.grade, Grade::A);
        assert_eq!(sc.total, 14);
    }
}
