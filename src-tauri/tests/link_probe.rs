// Linker probe: proves integration-test binaries link on windows-gnu
// (the lib test harness hits the 64K export ordinal limit of PE).
#[test]
fn linker_probe_smoke() {
    assert_eq!(2 + 2, 4);
}
