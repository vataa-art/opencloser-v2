//! Call-compliance gates: DNC / opt-out / consent.
//!
//! Pure functions so the contract can be unit-tested without a Tauri AppHandle.

pub fn assert_callable(dnc: i32, opted_out_at: Option<&str>) -> Result<(), String> {
    if dnc != 0 {
        return Err("Lead is on the Do Not Call list".into());
    }
    if opted_out_at.is_some_and(|value| !value.trim().is_empty()) {
        return Err("Lead has opted out".into());
    }
    Ok(())
}

pub fn assert_live_callable(
    dnc: i32,
    opted_out_at: Option<&str>,
    consent_at: Option<&str>,
) -> Result<(), String> {
    assert_callable(dnc, opted_out_at)?;
    if !consent_at.is_some_and(|value| !value.trim().is_empty()) {
        return Err("Record consent before a live provider call".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn demo_call_allowed_without_consent() {
        assert!(assert_callable(0, None).is_ok());
        assert!(assert_callable(0, Some("")).is_ok());
    }

    #[test]
    fn dnc_blocks_demo_and_live() {
        let err = assert_callable(1, None).unwrap_err();
        assert!(err.contains("Do Not Call"));
        assert!(assert_live_callable(1, None, Some("2026-01-01T00:00:00Z")).is_err());
    }

    #[test]
    fn opt_out_timestamp_blocks() {
        let err = assert_callable(0, Some("2026-01-01T00:00:00Z")).unwrap_err();
        assert!(err.contains("opted out"));
    }

    #[test]
    fn live_call_requires_consent() {
        let err = assert_live_callable(0, None, None).unwrap_err();
        assert!(err.contains("consent"));
        assert!(assert_live_callable(0, None, Some("2026-01-01T00:00:00Z")).is_ok());
    }
}
