//! Deterministic markdown rendering of a vacancy card. The output is what
//! `vacancy_publish_to_kb` ingests (`doc_type="vacancy_card"`), so it must
//! be stable across renders for the same vacancy and must contain every
//! field value (retrieval ground truth).

use crate::types::Vacancy;

/// Render the vacancy card markdown. Same input -> byte-identical output.
pub fn render_vacancy_card(v: &Vacancy) -> String {
    let mut out = String::new();

    out.push_str(&format!("# Vacancy: {}\n\n", v.title));
    out.push_str(&format!("**Company:** {} ({})\n\n", v.company, v.seniority));

    out.push_str("## Stack\n");
    for item in &v.stack {
        out.push_str(&format!("- {item}\n"));
    }
    out.push('\n');

    out.push_str("## Salary\n");
    out.push_str(&format!("{}-{} {}\n\n", v.salary_min, v.salary_max, v.currency));

    out.push_str("## Details\n");
    out.push_str(&format!("- Work format: {}\n", v.work_format));
    out.push_str(&format!("- Location: {}\n", v.location));
    out.push_str(&format!("- English level: {}\n\n", v.english_level));

    out.push_str("## Must have\n");
    for item in &v.must_have {
        out.push_str(&format!("- {item}\n"));
    }
    out.push('\n');

    out.push_str("## Nice to have\n");
    for item in &v.nice_to_have {
        out.push_str(&format!("- {item}\n"));
    }
    out.push('\n');

    out.push_str(&format!("## Hiring manager\n{}\n\n", v.hiring_manager));
    out.push_str(&format!("## SLA\n{} days\n", v.sla_days));

    out
}

#[cfg(test)]
mod tests {
    use super::render_vacancy_card;
    use crate::types::Vacancy;

    fn vacancy() -> Vacancy {
        Vacancy {
            id: "v-1".into(),
            title: "Senior Rust Engineer".into(),
            company: "Acme".into(),
            seniority: "senior".into(),
            stack: vec!["rust".into(), "postgres".into()],
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
    fn card_is_deterministic() {
        assert_eq!(render_vacancy_card(&vacancy()), render_vacancy_card(&vacancy()));
    }

    #[test]
    fn card_contains_every_field_value() {
        // DoD-3 support: the card published to KB must carry the real data.
        let card = render_vacancy_card(&vacancy());
        for needle in [
            "Senior Rust Engineer", // title
            "Acme",                 // company
            "senior",               // seniority
            "rust",                 // stack item
            "postgres",             // stack item
            "5000",                 // salary fork min
            "7000",                 // salary fork max
            "USD",                  // currency
            "remote",               // work format
            "Kyiv",                 // location
            "B2+",                  // english level
            "sql",                  // must-have item
            "tauri",                // nice-to-have item
            "Olena",                // hiring manager
            "14",                   // SLA days
        ] {
            assert!(card.contains(needle), "card is missing {needle:?}\n--- card ---\n{card}");
        }
    }

    #[test]
    fn card_lists_must_have_and_nice_to_have_separately() {
        let card = render_vacancy_card(&vacancy());
        let must_pos = card.find("sql").expect("must_have item present");
        let nice_pos = card.find("tauri").expect("nice_to_have item present");
        let must_section = card.find("Must have").expect("must-have section header");
        let nice_section = card.find("Nice to have").expect("nice-to-have section header");
        assert!(must_section < must_pos && must_pos < nice_section);
        assert!(nice_section < nice_pos);
    }
}
