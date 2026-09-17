//! Candidate pipeline stages and their exit criteria
//! (P1-RECRUITMENT-HIRING.md §2). `pipeline_move` must reject with the list
//! of unmet exit criteria — never a generic error.

use crate::error::ValidatorError;
use crate::types::Scorecard;

/// Kanban stages for one (candidate, vacancy) pipeline row.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Stage {
    Sourced,
    Contacted,
    Screening,
    Scorecard,
    Submitted,
    Interview,
    Offer,
    Rejected,
    OnHold,
}

impl Stage {
    pub fn as_str(&self) -> &'static str {
        match self {
            Stage::Sourced => "sourced",
            Stage::Contacted => "contacted",
            Stage::Screening => "screening",
            Stage::Scorecard => "scorecard",
            Stage::Submitted => "submitted",
            Stage::Interview => "interview",
            Stage::Offer => "offer",
            Stage::Rejected => "rejected",
            Stage::OnHold => "on_hold",
        }
    }

    /// Parse the canonical lowercase snake_case stage string.
    pub fn from_str(s: &str) -> Option<Stage> {
        match s {
            "sourced" => Some(Stage::Sourced),
            "contacted" => Some(Stage::Contacted),
            "screening" => Some(Stage::Screening),
            "scorecard" => Some(Stage::Scorecard),
            "submitted" => Some(Stage::Submitted),
            "interview" => Some(Stage::Interview),
            "offer" => Some(Stage::Offer),
            "rejected" => Some(Stage::Rejected),
            "on_hold" => Some(Stage::OnHold),
            _ => None,
        }
    }
}

/// Everything the exit-criteria check needs to judge one proposed move.
/// Flags describe the state gathered so far for the pipeline row.
#[derive(Debug, Clone)]
pub struct MoveContext {
    pub from: Stage,
    pub to: Stage,
    pub has_contact: bool,
    pub has_source: bool,
    pub reply_received: bool,
    pub contact_attempts: u32,
    pub required_flow_steps_done: bool,
    pub call_finished: bool,
    pub scorecard: Option<Scorecard>,
    pub slot_confirmed: bool,
    pub reject_reason: Option<String>,
}

/// Check the exit criteria for `ctx.to`. Returns `EXIT_CRITERIA_UNMET` with
/// only the absent criteria listed, or `Ok(())` when the move may proceed.
pub fn validate_move(ctx: &MoveContext) -> Result<(), ValidatorError> {
    let missing: Vec<String> = match ctx.to {
        Stage::Sourced => {
            let mut m = Vec::new();
            if !ctx.has_contact {
                m.push("contact".to_string());
            }
            if !ctx.has_source {
                m.push("source".to_string());
            }
            m
        }
        Stage::Contacted => {
            if ctx.reply_received || ctx.contact_attempts >= 3 {
                Vec::new()
            } else {
                vec!["reply_or_3_attempts".to_string()]
            }
        }
        Stage::Screening => {
            if ctx.required_flow_steps_done {
                Vec::new()
            } else {
                vec!["flow_steps".to_string()]
            }
        }
        Stage::Scorecard => {
            if ctx.call_finished {
                Vec::new()
            } else {
                vec!["call_finished".to_string()]
            }
        }
        Stage::Submitted => match &ctx.scorecard {
            None => vec!["scorecard".to_string(), "grade_gte_B".to_string()],
            Some(sc) if sc.grade.is_submittable() => Vec::new(),
            Some(_) => vec!["grade_gte_B".to_string()],
        },
        Stage::Interview => {
            if ctx.slot_confirmed {
                Vec::new()
            } else {
                vec!["interview_slot".to_string()]
            }
        }
        Stage::Rejected => {
            let has_reason = ctx
                .reject_reason
                .as_deref()
                .map(|r| !r.trim().is_empty())
                .unwrap_or(false);
            if has_reason {
                Vec::new()
            } else {
                vec!["reject_reason".to_string()]
            }
        }
        Stage::Offer | Stage::OnHold => Vec::new(),
    };

    if missing.is_empty() {
        Ok(())
    } else {
        Err(ValidatorError::unmet(missing))
    }
}

#[cfg(test)]
mod tests {
    use super::{validate_move, MoveContext, Stage};
    use crate::types::{Grade, Scorecard};

    fn scorecard(total: i64) -> Scorecard {
        Scorecard { total, grade: Grade::from_total(total) }
    }

    /// A context that satisfies every stage's exit criteria; individual
    /// tests turn off the one flag under test.
    fn ctx(to: Stage) -> MoveContext {
        MoveContext {
            from: Stage::Sourced,
            to,
            has_contact: true,
            has_source: true,
            reply_received: true,
            contact_attempts: 1,
            required_flow_steps_done: true,
            call_finished: true,
            scorecard: Some(scorecard(11)),
            slot_confirmed: true,
            reject_reason: Some("no fit for this role".into()),
        }
    }

    #[test]
    fn stage_str_roundtrip() {
        let all = [
            Stage::Sourced,
            Stage::Contacted,
            Stage::Screening,
            Stage::Scorecard,
            Stage::Submitted,
            Stage::Interview,
            Stage::Offer,
            Stage::Rejected,
            Stage::OnHold,
        ];
        for s in all {
            assert_eq!(Stage::from_str(s.as_str()), Some(s), "roundtrip for {}", s.as_str());
        }
        assert_eq!(Stage::Sourced.as_str(), "sourced");
        assert_eq!(Stage::OnHold.as_str(), "on_hold");
        assert_eq!(Stage::Submitted.as_str(), "submitted");
        assert_eq!(Stage::from_str("bogus"), None);
    }

    #[test]
    fn submitted_without_scorecard_is_rejected() {
        // DoD-1: cannot move to submitted without a filled scorecard.
        let mut c = ctx(Stage::Submitted);
        c.scorecard = None;
        let err = validate_move(&c).expect_err("submitted without scorecard must be rejected");
        assert_eq!(err.code, "EXIT_CRITERIA_UNMET");
        assert!(err.missing.contains(&"scorecard".to_string()), "{:?}", err.missing);
        assert!(err.missing.contains(&"grade_gte_B".to_string()), "{:?}", err.missing);
    }

    #[test]
    fn submitted_grade_b_ok_grade_c_rejected() {
        let mut c = ctx(Stage::Submitted);
        c.scorecard = Some(scorecard(11)); // B
        assert!(validate_move(&c).is_ok(), "grade B must be allowed to submit");

        c.scorecard = Some(scorecard(8)); // C
        let err = validate_move(&c).expect_err("grade C must be blocked from submit");
        assert!(err.missing.contains(&"grade_gte_B".to_string()), "{:?}", err.missing);
        assert!(
            !err.missing.contains(&"scorecard".to_string()),
            "scorecard is present, only grade unmet: {:?}",
            err.missing
        );

        c.scorecard = Some(scorecard(3)); // D
        assert!(validate_move(&c).is_err(), "grade D must be blocked from submit");
    }

    #[test]
    fn sourced_requires_contact_and_source_only_absent_listed() {
        let mut c = ctx(Stage::Sourced);
        c.has_contact = false;
        c.has_source = false;
        let err = validate_move(&c).expect_err("sourced without contact+source must fail");
        assert_eq!(err.missing, vec!["contact".to_string(), "source".to_string()]);

        c.has_source = true;
        let err = validate_move(&c).expect_err("sourced without contact must still fail");
        assert_eq!(err.missing, vec!["contact".to_string()], "only absent criteria listed");

        c.has_contact = true;
        assert!(validate_move(&c).is_ok());
    }

    #[test]
    fn contacted_requires_reply_or_three_attempts() {
        let mut c = ctx(Stage::Contacted);
        c.reply_received = false;
        c.contact_attempts = 2;
        let err = validate_move(&c).expect_err("2 attempts without reply must fail");
        assert_eq!(err.missing, vec!["reply_or_3_attempts".to_string()]);

        c.contact_attempts = 3;
        assert!(validate_move(&c).is_ok(), "3 attempts satisfy the gate");

        c.contact_attempts = 0;
        c.reply_received = true;
        assert!(validate_move(&c).is_ok(), "a reply satisfies the gate");
    }

    #[test]
    fn screening_needs_flow_steps_and_scorecard_needs_finished_call() {
        let mut c = ctx(Stage::Screening);
        c.required_flow_steps_done = false;
        let err = validate_move(&c).expect_err("screening without flow steps must fail");
        assert_eq!(err.missing, vec!["flow_steps".to_string()]);

        let mut c = ctx(Stage::Scorecard);
        c.call_finished = false;
        let err = validate_move(&c).expect_err("scorecard stage before call finished must fail");
        assert_eq!(err.missing, vec!["call_finished".to_string()]);
    }

    #[test]
    fn interview_requires_confirmed_slot() {
        let mut c = ctx(Stage::Interview);
        c.slot_confirmed = false;
        let err = validate_move(&c).expect_err("interview without slot must fail");
        assert_eq!(err.missing, vec!["interview_slot".to_string()]);
    }

    #[test]
    fn rejected_requires_reason_offer_and_hold_are_free() {
        let mut c = ctx(Stage::Rejected);
        c.reject_reason = None;
        let err = validate_move(&c).expect_err("rejected without reason must fail");
        assert_eq!(err.missing, vec!["reject_reason".to_string()]);

        c.reject_reason = Some("   ".into());
        assert!(validate_move(&c).is_err(), "blank reject_reason is not a reason");

        assert!(validate_move(&ctx(Stage::Offer)).is_ok());
        assert!(validate_move(&ctx(Stage::OnHold)).is_ok());
    }
}
