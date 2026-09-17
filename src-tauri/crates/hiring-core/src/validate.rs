//! Vacancy intake validation (P1-RECRUITMENT-HIRING.md §2, Intake stage):
//! `must_have` + salary fork + work_format filled, else block. All missing
//! fields are collected so the UI can show one complete list.

use crate::error::ValidatorError;
use crate::types::Vacancy;

/// Validate a vacancy at intake. Returns `VALIDATION_FAILED` with the full
/// list of missing required fields.
pub fn validate_vacancy(v: &Vacancy) -> Result<(), ValidatorError> {
    let mut missing: Vec<String> = Vec::new();

    for (name, value) in [
        ("title", v.title.as_str()),
        ("company", v.company.as_str()),
        ("work_format", v.work_format.as_str()),
        ("location", v.location.as_str()),
        ("hiring_manager", v.hiring_manager.as_str()),
    ] {
        if value.trim().is_empty() {
            missing.push(name.to_string());
        }
    }

    if v.must_have.is_empty() {
        missing.push("must_have".to_string());
    }
    if v.salary_min <= 0 {
        missing.push("salary_min".to_string());
    }
    if v.salary_max < v.salary_min {
        missing.push("salary_max".to_string());
    }
    if v.sla_days <= 0 {
        missing.push("sla_days".to_string());
    }

    if missing.is_empty() {
        Ok(())
    } else {
        Err(ValidatorError::validation(missing))
    }
}

#[cfg(test)]
mod tests {
    use super::validate_vacancy;
    use crate::types::Vacancy;

    fn vacancy() -> Vacancy {
        Vacancy {
            id: "v-1".into(),
            title: "Senior Rust Engineer".into(),
            company: "Acme".into(),
            seniority: "senior".into(),
            stack: vec!["rust".into()],
            salary_min: 5000,
            salary_max: 7000,
            currency: "USD".into(),
            work_format: "remote".into(),
            location: "Kyiv".into(),
            english_level: "B2+".into(),
            must_have: vec!["rust".into(), "sql".into()],
            nice_to_have: vec!["tauri".into()],
            hiring_manager: "Olena".into(),
            sla_days: 14,
            status: "intake".into(),
        }
    }

    #[test]
    fn valid_vacancy_passes() {
        assert!(validate_vacancy(&vacancy()).is_ok());
    }

    #[test]
    fn empty_required_fields_are_all_listed() {
        // DoD: vacancy_create rejects empty required fields with a list.
        let mut v = vacancy();
        v.title = String::new();
        v.company = "   ".into(); // whitespace-only counts as empty
        v.work_format = String::new();
        v.must_have = Vec::new();
        let err = validate_vacancy(&v).expect_err("vacancy with empty required fields must fail");
        assert_eq!(err.code, "VALIDATION_FAILED");
        for field in ["title", "company", "work_format", "must_have"] {
            assert!(
                err.missing.iter().any(|m| m == field),
                "missing must contain {field}, got {:?}",
                err.missing
            );
        }
    }

    #[test]
    fn inverted_salary_fork_and_zero_sla_listed() {
        let mut v = vacancy();
        v.salary_min = 7000;
        v.salary_max = 5000; // max < min
        v.sla_days = 0;
        let err = validate_vacancy(&v).expect_err("bad salary fork must fail");
        assert!(err.missing.contains(&"salary_max".to_string()), "{:?}", err.missing);
        assert!(err.missing.contains(&"sla_days".to_string()), "{:?}", err.missing);
        assert!(!err.missing.contains(&"salary_min".to_string()), "{:?}", err.missing);
    }

    #[test]
    fn non_positive_salary_min_listed() {
        let mut v = vacancy();
        v.salary_min = 0;
        v.salary_max = 7000;
        let err = validate_vacancy(&v).expect_err("zero salary_min must fail");
        assert!(err.missing.contains(&"salary_min".to_string()), "{:?}", err.missing);
    }

    #[test]
    fn vacancy_status_defaults_to_intake() {
        let v = Vacancy::default();
        assert_eq!(v.status, "intake");
    }
}
