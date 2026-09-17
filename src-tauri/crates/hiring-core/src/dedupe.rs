//! Candidate contact normalization and dedupe
//! (DoD: `candidate_upsert` dedupes by contact). Two contacts are the same
//! person-channel when their normalized forms are equal, regardless of
//! formatting.

use crate::types::Contact;

/// Normalize one contact for comparison: emails are lowercased (and
/// trimmed), phones are reduced to digits only, other kinds are trimmed
/// verbatim.
pub fn normalize_contact(c: &Contact) -> String {
    match c.kind.as_str() {
        "email" => c.value.trim().to_lowercase(),
        "phone" => c.value.chars().filter(|ch| ch.is_ascii_digit()).collect(),
        _ => c.value.trim().to_string(),
    }
}

/// Return the index of the first existing candidate sharing any normalized
/// contact with the incoming candidate, or `None` when unique.
pub fn find_duplicate_contact(existing: &[Vec<Contact>], candidate: &[Contact]) -> Option<usize> {
    let incoming: std::collections::HashSet<String> =
        candidate.iter().map(normalize_contact).collect();
    if incoming.is_empty() {
        return None;
    }
    existing.iter().position(|contacts| {
        contacts.iter().map(normalize_contact).any(|n| incoming.contains(&n))
    })
}

#[cfg(test)]
mod tests {
    use super::{find_duplicate_contact, normalize_contact};
    use crate::types::Contact;

    fn contact(kind: &str, value: &str) -> Contact {
        Contact { kind: kind.into(), value: value.into() }
    }

    #[test]
    fn email_normalized_to_lowercase() {
        assert_eq!(normalize_contact(&contact("email", "Ivan@X.com")), "ivan@x.com");
    }

    #[test]
    fn phone_normalized_to_digits_only() {
        assert_eq!(
            normalize_contact(&contact("phone", " +38 (099) 111-22-33")),
            "380991112233"
        );
    }

    #[test]
    fn email_duplicate_found_case_insensitive() {
        // DoD-4: candidate_upsert dedupes by contact.
        let existing = vec![vec![contact("email", "Ivan@X.com")]];
        let hit = find_duplicate_contact(&existing, &[contact("email", "ivan@x.com")]);
        assert_eq!(hit, Some(0));
    }

    #[test]
    fn phone_duplicate_found_across_formats() {
        let existing = vec![vec![contact("phone", "+38 (099) 111-22-33")]];
        let hit = find_duplicate_contact(&existing, &[contact("phone", "380991112233")]);
        assert_eq!(hit, Some(0));
    }

    #[test]
    fn first_matching_index_returned_and_none_when_unique() {
        let existing = vec![
            vec![contact("email", "a@x.com")],
            vec![contact("telegram", "@ivan"), contact("phone", "380991112233")],
        ];
        assert_eq!(
            find_duplicate_contact(&existing, &[contact("phone", "+38 (099) 111-22-33")]),
            Some(1),
            "second existing candidate shares the phone"
        );
        assert_eq!(
            find_duplicate_contact(&existing, &[contact("email", "new@x.com")]),
            None,
            "fresh contact -> no duplicate"
        );
    }

    #[test]
    fn any_shared_contact_counts_as_duplicate() {
        let existing = vec![vec![
            contact("email", "old@x.com"),
            contact("linkedin", "linkedin.com/in/ivan"),
        ]];
        assert_eq!(
            find_duplicate_contact(&existing, &[contact("linkedin", "linkedin.com/in/ivan")]),
            Some(0)
        );
    }

    #[test]
    fn other_kinds_are_trimmed_verbatim() {
        assert_eq!(normalize_contact(&contact("telegram", "  @ivan ")), "@ivan");
        assert_eq!(
            normalize_contact(&contact("linkedin", "  linkedin.com/in/ivan ")),
            "linkedin.com/in/ivan"
        );
    }

    #[test]
    fn empty_existing_list_has_no_duplicate() {
        let existing: Vec<Vec<Contact>> = Vec::new();
        assert_eq!(find_duplicate_contact(&existing, &[contact("email", "a@x.com")]), None);
    }
}
