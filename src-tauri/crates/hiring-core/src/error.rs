//! Error type shared by vacancy validation and pipeline exit-criteria
//! checks. Serialized straight into Tauri command errors so the UI can
//! render the list of unmet items.

use serde::Serialize;

/// A validation / exit-criteria failure carrying the exact names of the
/// unmet conditions.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ValidatorError {
    /// Machine-readable code: `EXIT_CRITERIA_UNMET` or `VALIDATION_FAILED`.
    pub code: String,
    /// Names of the missing fields / unmet exit criteria.
    pub missing: Vec<String>,
    /// Human-readable summary.
    pub message: String,
}

impl ValidatorError {
    /// A pipeline move rejected because exit criteria are unmet.
    pub fn unmet(missing: Vec<String>) -> Self {
        let message = if missing.is_empty() {
            "pipeline move rejected".to_string()
        } else {
            format!("unmet exit criteria: {}", missing.join(", "))
        };
        Self { code: "EXIT_CRITERIA_UNMET".to_string(), missing, message }
    }

    /// A vacancy (or other entity) failed required-field validation.
    pub fn validation(missing: Vec<String>) -> Self {
        let message = if missing.is_empty() {
            "validation failed".to_string()
        } else {
            format!("missing required fields: {}", missing.join(", "))
        };
        Self { code: "VALIDATION_FAILED".to_string(), missing, message }
    }
}

impl std::fmt::Display for ValidatorError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}

impl std::error::Error for ValidatorError {}

#[cfg(test)]
mod tests {
    use super::ValidatorError;

    #[test]
    fn unmet_uses_exit_criteria_unmet_code() {
        let err = ValidatorError::unmet(vec!["scorecard".into()]);
        assert_eq!(err.code, "EXIT_CRITERIA_UNMET");
        assert_eq!(err.missing, vec!["scorecard".to_string()]);
        assert!(!err.message.is_empty());
    }

    #[test]
    fn validation_uses_validation_failed_code() {
        let err = ValidatorError::validation(vec!["title".into(), "company".into()]);
        assert_eq!(err.code, "VALIDATION_FAILED");
        assert_eq!(err.missing.len(), 2);
        assert!(!err.message.is_empty());
    }

    #[test]
    fn serializes_to_json_with_code_and_missing() {
        let err = ValidatorError::unmet(vec!["contact".into(), "source".into()]);
        let json = serde_json::to_string(&err).expect("ValidatorError must serialize");
        assert!(json.contains("EXIT_CRITERIA_UNMET"), "json: {json}");
        assert!(json.contains("contact"), "json: {json}");
        assert!(json.contains("source"), "json: {json}");
    }
}
