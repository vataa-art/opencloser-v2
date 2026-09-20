use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde_json::{json, Value};

#[derive(Debug, PartialEq, Eq)]
pub enum RelayFrame {
    Text(String),
    Binary(Vec<u8>),
}

pub fn is_safe_cartesia_agent_id(agent_id: &str) -> bool {
    !agent_id.is_empty()
        && agent_id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-')
}

pub fn cartesia_session_payload(config: &Value) -> Value {
    let system_prompt = config["systemPrompt"].as_str().unwrap_or("");
    let language = config["language"].as_str().unwrap_or("en-US");
    json!({
        "type": "session_create",
        "audio": {
            "input_format": "pcm_16000",
            "output_delivery": "speaking_pace"
        },
        "dynamic_variables": {
            "opencloser_context": system_prompt,
            "opencloser_language": language
        }
    })
}

pub fn cartesia_session_ready(text: &str) -> bool {
    serde_json::from_str::<Value>(text).is_ok_and(|value| value["type"] == "session_ready")
}

pub fn adapt_cartesia_client_audio(pcm: &[u8]) -> String {
    json!({
        "type": "audio_input",
        "audio": STANDARD.encode(pcm),
    })
    .to_string()
}

pub fn translate_cartesia_provider_text(text: &str) -> Vec<RelayFrame> {
    let Ok(value) = serde_json::from_str::<Value>(text) else {
        return vec![RelayFrame::Text(text.into())];
    };

    match value["type"].as_str().unwrap_or("") {
        "audio_output" => value["audio"]
            .as_str()
            .and_then(|audio| STANDARD.decode(audio).ok())
            .map(|pcm| vec![RelayFrame::Binary(pcm)])
            .unwrap_or_default(),
        "audio_output_clear" => vec![RelayFrame::Text(
            json!({
                "type": "interrupted"
            })
            .to_string(),
        )],
        "turn_ended" => {
            let event_type = match value["role"].as_str().unwrap_or("") {
                "assistant" => "transcript.model",
                "user" => "transcript.user",
                _ => return Vec::new(),
            };
            let text = value["text"].as_str().unwrap_or("");
            if text.is_empty() {
                Vec::new()
            } else {
                vec![RelayFrame::Text(
                    json!({
                        "type": event_type,
                        "text": text
                    })
                    .to_string(),
                )]
            }
        }
        "client_tool_call" => {
            if value["tool_name"] != "request_human_handoff" {
                return Vec::new();
            }
            vec![RelayFrame::Text(
                json!({
                    "type": "handoff.requested",
                    "toolCallId": value["tool_call_id"].as_str().unwrap_or(""),
                    "reason": value["parameters"]["reason"]
                        .as_str()
                        .unwrap_or("Prospect requested a human"),
                    "expectsResponse": value["expects_response"].as_bool().unwrap_or(false),
                })
                .to_string(),
            )]
        }
        "error" => vec![RelayFrame::Text(
            json!({
                "type": "error",
                "message": value["message"].as_str().unwrap_or("Cartesia agent error"),
            })
            .to_string(),
        )],
        _ => vec![RelayFrame::Text(text.into())],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn json_text(frame: &RelayFrame) -> Value {
        let RelayFrame::Text(text) = frame else {
            panic!("expected text frame, got {frame:?}");
        };
        serde_json::from_str(text).expect("frame must be valid JSON")
    }

    #[test]
    fn session_payload_uses_pcm16_and_opencloser_context() {
        let payload = cartesia_session_payload(&json!({
            "systemPrompt": "Represent innie.pro safely",
            "language": "uk"
        }));
        assert_eq!(payload["type"], "session_create");
        assert_eq!(payload["audio"]["input_format"], "pcm_16000");
        assert_eq!(payload["audio"]["output_delivery"], "speaking_pace");
        assert_eq!(
            payload["dynamic_variables"]["opencloser_context"],
            "Represent innie.pro safely"
        );
        assert_eq!(payload["dynamic_variables"]["opencloser_language"], "uk");
    }

    #[test]
    fn client_pcm_is_wrapped_as_audio_input() {
        let value: Value = serde_json::from_str(&adapt_cartesia_client_audio(&[3, 4]))
            .expect("audio_input must be valid JSON");
        assert_eq!(value["type"], "audio_input");
        assert_eq!(value["audio"], STANDARD.encode([3, 4]));
    }

    #[test]
    fn provider_audio_transcript_and_interruption_are_translated() {
        let audio = STANDARD.encode([8, 9]);
        let frames = translate_cartesia_provider_text(
            &json!({ "type": "audio_output", "audio": audio }).to_string(),
        );
        assert_eq!(frames, vec![RelayFrame::Binary(vec![8, 9])]);

        let frames = translate_cartesia_provider_text(
            &json!({
                "type": "turn_ended",
                "role": "assistant",
                "text": "Домовились"
            })
            .to_string(),
        );
        let value = json_text(&frames[0]);
        assert_eq!(value["type"], "transcript.model");
        assert_eq!(value["text"], "Домовились");

        let frames =
            translate_cartesia_provider_text(&json!({ "type": "audio_output_clear" }).to_string());
        assert_eq!(json_text(&frames[0])["type"], "interrupted");
    }

    #[test]
    fn handoff_and_provider_errors_are_translated() {
        let frames = translate_cartesia_provider_text(
            &json!({
                "type": "client_tool_call",
                "tool_call_id": "tool_123",
                "tool_name": "request_human_handoff",
                "parameters": { "reason": "Pricing approval" },
                "expects_response": true
            })
            .to_string(),
        );
        let value = json_text(&frames[0]);
        assert_eq!(value["type"], "handoff.requested");
        assert_eq!(value["toolCallId"], "tool_123");
        assert_eq!(value["reason"], "Pricing approval");
        assert_eq!(value["expectsResponse"], true);

        let frames = translate_cartesia_provider_text(
            &json!({ "type": "error", "message": "fatal" }).to_string(),
        );
        let value = json_text(&frames[0]);
        assert_eq!(value["type"], "error");
        assert_eq!(value["message"], "fatal");
    }

    #[test]
    fn session_ready_and_agent_id_validation_are_strict() {
        assert!(cartesia_session_ready(
            r#"{"type":"session_ready","call_id":"ac_test"}"#
        ));
        assert!(!cartesia_session_ready(r#"{"type":"turn_started"}"#));
        assert!(is_safe_cartesia_agent_id("agent_test-123"));
        assert!(!is_safe_cartesia_agent_id("../bad"));
        assert!(!is_safe_cartesia_agent_id(""));
    }
}
