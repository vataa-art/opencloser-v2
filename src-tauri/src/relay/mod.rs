//! Local WebSocket relay between the WebView and voice providers.
//!
//! Security model:
//! - listens on 127.0.0.1 with a per-launch random token; every client must
//!   present the token as `token` in its first (config) message;
//! - provider credentials are loaded from the OS keychain and sent only over
//!   the authenticated loopback socket, never in a URL or remote WebView;
//! - `ready` is sent only after the provider session is confirmed, not right
//!   after the socket opens;
//! - provider protocols are translated into the client's internal event
//!   format (OpenAI Realtime JSON events, ElevenLabs ConvAI JSON, Deepgram
//!   JSON) — the relay is not a raw passthrough.

use base64::Engine as _;
use futures_util::{SinkExt, StreamExt};
use log::{error, info};
use serde_json::Value;
use std::sync::Arc;
use std::time::Duration;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::Mutex;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::http::header::{HeaderValue, AUTHORIZATION};
use tokio_tungstenite::tungstenite::protocol::Message;

pub type RelayPort = u16;

const HANDSHAKE_TIMEOUT_SECS: u64 = 15;
const CARTESIA_API_VERSION: &str = "2026-08-14";

pub async fn start_relay_server(
    auth_token: String,
) -> Result<RelayPort, Box<dyn std::error::Error>> {
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let port = listener.local_addr()?.port();
    info!("Voice relay server started on ws://127.0.0.1:{}", port);

    tokio::spawn(async move {
        while let Ok((stream, _)) = listener.accept().await {
            let token = auth_token.clone();
            tokio::spawn(handle_connection(stream, token));
        }
    });

    Ok(port)
}

async fn handle_connection(stream: TcpStream, expected_token: String) {
    let ws_stream = match tokio_tungstenite::accept_async(stream).await {
        Ok(ws) => ws,
        Err(e) => {
            error!("WebSocket accept failed: {}", e);
            return;
        }
    };

    let (mut client_tx, mut client_rx) = ws_stream.split();

    // Read first client message for config
    let config = match client_rx.next().await {
        Some(Ok(Message::Text(text))) => match serde_json::from_str::<Value>(&text) {
            Ok(v) => v,
            Err(_) => {
                let _ = client_tx
                    .send(Message::Text(
                        r#"{"type":"error","message":"Invalid config JSON"}"#.into(),
                    ))
                    .await;
                return;
            }
        },
        _ => {
            let _ = client_tx
                .send(Message::Text(
                    r#"{"type":"error","message":"Expected config message"}"#.into(),
                ))
                .await;
            return;
        }
    };

    // Loopback auth: only the app process knows the per-launch token.
    if config["token"].as_str() != Some(expected_token.as_str()) {
        let _ = client_tx
            .send(Message::Text(
                r#"{"type":"error","message":"Unauthorized relay connection"}"#.into(),
            ))
            .await;
        error!("Relay connection rejected: bad token");
        return;
    }

    let provider = config["provider"].as_str().unwrap_or("openai").to_string();
    let api_key = config["apiKey"].as_str().unwrap_or("");
    let model = config["model"].as_str().unwrap_or("gpt-realtime-2.1");
    let voice = config["voice"].as_str().unwrap_or("marin");
    let system_prompt = config["systemPrompt"].as_str().unwrap_or("");

    if api_key.is_empty() {
        let _ = client_tx
            .send(Message::Text(
                r#"{"type":"error","message":"API key required"}"#.into(),
            ))
            .await;
        return;
    }

    let connect_result = match provider.as_str() {
        "deepgram" => connect_deepgram(api_key, &config).await,
        "elevenlabs" => connect_elevenlabs(api_key, &config).await,
        "cartesia" => connect_cartesia(api_key, &config).await,
        "openai" => connect_openai(api_key, model, voice, system_prompt).await,
        _ => Err(format!("Unsupported voice provider: {}", provider)),
    };

    let (provider_ws, connect_payload) = match connect_result {
        Ok(v) => v,
        Err(e) => {
            let _ = client_tx
                .send(Message::Text(
                    serde_json::json!({ "type": "error", "message": e }).to_string(),
                ))
                .await;
            return;
        }
    };

    let (mut provider_tx, mut provider_rx) = provider_ws.split();

    // Send config/session payload to provider when present
    if let Some(payload) = connect_payload {
        let _ = provider_tx.send(Message::Text(payload.to_string())).await;
    }

    // Wait for the provider to confirm its session before telling the client
    // we are ready.
    let session_confirmed =
        tokio::time::timeout(Duration::from_secs(HANDSHAKE_TIMEOUT_SECS), async {
            loop {
                match provider_rx.next().await {
                    Some(Ok(Message::Text(text))) => {
                        // Forward handshake frames; the client ignores unknown types.
                        let _ = client_tx.send(Message::Text(text.clone())).await;
                        if provider_session_ready(&provider, &text) {
                            return true;
                        }
                    }
                    Some(Ok(Message::Binary(_))) => {
                        if provider == "deepgram" {
                            return true;
                        }
                    }
                    Some(Ok(_)) => {}
                    _ => return false,
                }
            }
        })
        .await;

    match session_confirmed {
        Ok(true) => {}
        Ok(false) => {
            let _ = client_tx
                .send(Message::Text(
                    r#"{"type":"error","message":"Provider closed the session during handshake"}"#
                        .into(),
                ))
                .await;
            return;
        }
        Err(_) => {
            let _ = client_tx
                .send(Message::Text(
                    format!(
                        r#"{{"type":"error","message":"Provider handshake timed out after {}s"}}"#,
                        HANDSHAKE_TIMEOUT_SECS
                    )
                    .into(),
                ))
                .await;
            return;
        }
    }

    // Notify client we're ready
    let _ = client_tx
        .send(Message::Text(r#"{"type":"ready"}"#.into()))
        .await;

    let client_tx = Arc::new(Mutex::new(client_tx));
    let provider_tx = Arc::new(Mutex::new(provider_tx));
    let provider_name = provider.clone();

    // Forward client → provider (adapting raw PCM frames to provider protocol)
    let tx_to_provider = provider_tx.clone();
    let upstream_provider = provider.clone();
    let client_to_provider = tokio::spawn(async move {
        while let Some(msg) = client_rx.next().await {
            match msg {
                Ok(Message::Binary(data)) => {
                    let adapted = adapt_client_audio(&upstream_provider, &data);
                    let mut tx = tx_to_provider.lock().await;
                    let _ = tx.send(adapted).await;
                }
                Ok(Message::Text(text)) => {
                    // Control/JSON frames from the client pass through as-is.
                    let mut tx = tx_to_provider.lock().await;
                    let _ = tx.send(Message::Text(text)).await;
                }
                Ok(Message::Close(_)) => break,
                Err(_) => break,
                _ => {}
            }
        }
    });

    // Forward provider → client (translating provider events into our format)
    let tx_to_client = client_tx.clone();
    let provider_to_client = tokio::spawn(async move {
        while let Some(msg) = provider_rx.next().await {
            match msg {
                Ok(Message::Text(text)) => {
                    for translated in translate_provider_text(&provider_name, &text) {
                        let mut tx = tx_to_client.lock().await;
                        let _ = tx.send(translated).await;
                    }
                }
                Ok(Message::Binary(data)) => {
                    let mut tx = tx_to_client.lock().await;
                    let _ = tx.send(Message::Binary(data)).await;
                }
                Ok(Message::Close(frame)) => {
                    let mut tx = tx_to_client.lock().await;
                    let _ = tx.send(Message::Close(frame)).await;
                    break;
                }
                Err(_) => break,
                _ => {}
            }
        }
    });

    let _ = tokio::join!(client_to_provider, provider_to_client);
    info!("Voice relay connection closed");
}

fn provider_session_ready(provider: &str, text: &str) -> bool {
    if provider == "cartesia" {
        return relay_protocol::cartesia_session_ready(text);
    }
    let parsed: Result<Value, _> = serde_json::from_str(text);
    let Ok(v) = parsed else { return false };
    match provider {
        "openai" => v["type"] == "session.updated",
        "elevenlabs" => v["type"] == "conversation_initiation_metadata",
        // Deepgram: any JSON frame implies the socket is live.
        "deepgram" => true,
        _ => false,
    }
}

/// Wrap the client's raw PCM16 bytes into the provider's expected framing.
fn adapt_client_audio(provider: &str, pcm: &[u8]) -> Message {
    let engine = base64::engine::general_purpose::STANDARD;
    match provider {
        "openai" => Message::Text(
            serde_json::json!({
                "type": "input_audio_buffer.append",
                "audio": engine.encode(pcm),
            })
            .to_string(),
        ),
        "elevenlabs" => Message::Text(
            serde_json::json!({
                "type": "audio",
                "audio_event": { "audio_base_64": engine.encode(pcm) },
            })
            .to_string(),
        ),
        "cartesia" => Message::Text(relay_protocol::adapt_cartesia_client_audio(pcm)),
        _ => Message::Binary(pcm.to_vec()),
    }
}

/// Translate a provider JSON event into the client's internal event format.
fn translate_provider_text(provider: &str, text: &str) -> Vec<Message> {
    if provider == "cartesia" {
        return relay_protocol::translate_cartesia_provider_text(text)
            .into_iter()
            .map(|frame| match frame {
                relay_protocol::RelayFrame::Text(text) => Message::Text(text),
                relay_protocol::RelayFrame::Binary(data) => Message::Binary(data),
            })
            .collect();
    }

    let parsed: Result<Value, _> = serde_json::from_str(text);
    let Ok(v) = parsed else {
        return vec![Message::Text(text.into())];
    };
    let event_type = v["type"].as_str().unwrap_or("");
    let engine = base64::engine::general_purpose::STANDARD;

    match (provider, event_type) {
        ("openai", "response.output_audio.delta") => v["delta"]
            .as_str()
            .and_then(|b64| engine.decode(b64).ok())
            .map(|pcm| vec![Message::Binary(pcm)])
            .unwrap_or_default(),
        ("openai", "response.output_audio_transcript.delta") => {
            text_event("transcript.model", v["delta"].as_str().unwrap_or(""))
        }
        ("openai", "conversation.item.input_audio_transcription.completed") => {
            text_event("transcript.user", v["transcript"].as_str().unwrap_or(""))
        }
        ("openai", "input_audio_buffer.speech_started") => {
            vec![Message::Text(r#"{"type":"interrupted"}"#.into())]
        }
        ("elevenlabs", "audio") => v["audio_event"]["audio_base_64"]
            .as_str()
            .and_then(|b64| engine.decode(b64).ok())
            .map(|pcm| vec![Message::Binary(pcm)])
            .unwrap_or_default(),
        ("elevenlabs", "interruption") => {
            vec![Message::Text(r#"{"type":"interrupted"}"#.into())]
        }
        ("elevenlabs", "agent_response") => text_event(
            "transcript.model",
            v["agent_response_event"]["agent_response"]
                .as_str()
                .unwrap_or(""),
        ),
        ("elevenlabs", "user_transcript") => text_event(
            "transcript.user",
            v["user_transcription_event"]["user_transcription"]
                .as_str()
                .unwrap_or(""),
        ),
        ("deepgram", "Results") => {
            let is_final = v["is_final"].as_bool().unwrap_or(false);
            let transcript = v["channel"]["alternatives"][0]["transcript"]
                .as_str()
                .unwrap_or("");
            if is_final && !transcript.is_empty() {
                text_event("transcript.user", transcript)
            } else {
                vec![Message::Text(text.into())]
            }
        }
        _ => vec![Message::Text(text.into())],
    }
}

fn text_event(kind: &str, text: &str) -> Vec<Message> {
    if text.is_empty() {
        return Vec::new();
    }
    vec![Message::Text(
        serde_json::json!({ "type": kind, "text": text }).to_string(),
    )]
}

type ProviderWs = tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<TcpStream>>;

async fn connect_openai(
    api_key: &str,
    model: &str,
    voice: &str,
    system_prompt: &str,
) -> Result<(ProviderWs, Option<Value>), String> {
    let url = format!("wss://api.openai.com/v1/realtime?model={}", model);
    let mut request = url
        .into_client_request()
        .map_err(|e| format!("Invalid OpenAI realtime URL: {}", e))?;

    let auth = format!("Bearer {}", api_key);
    request.headers_mut().insert(
        AUTHORIZATION,
        HeaderValue::from_str(&auth).map_err(|e| format!("Invalid Authorization header: {}", e))?,
    );
    let (provider_ws, _) = tokio_tungstenite::connect_async(request)
        .await
        .map_err(|e| format!("Provider connection failed: {}", e))?;

    let payload = openai_session_payload(model, voice, system_prompt);

    Ok((provider_ws, Some(payload)))
}

fn openai_session_payload(model: &str, voice: &str, system_prompt: &str) -> Value {
    serde_json::json!({
        "type": "session.update",
        "session": {
            "type": "realtime",
            "model": model,
            "output_modalities": ["audio"],
            "instructions": system_prompt,
            "audio": {
                "input": {
                    "format": { "type": "audio/pcm", "rate": 24000 },
                    "transcription": { "model": "gpt-4o-mini-transcribe" },
                    "turn_detection": { "type": "semantic_vad" }
                },
                "output": {
                    "format": { "type": "audio/pcm", "rate": 24000 },
                    "voice": voice
                }
            }
        }
    })
}

async fn connect_deepgram(
    api_key: &str,
    config: &Value,
) -> Result<(ProviderWs, Option<Value>), String> {
    let language = match config["language"].as_str().unwrap_or("en-US") {
        "uk" => "uk",
        "en-US" => "en-US",
        _ => "en-US",
    };
    let url = format!(
        "wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000&channels=1&model=nova-2&language={}&interim_results=true&punctuate=true&smart_format=true&endpointing=300&utterance_end_ms=1000&vad_events=true",
        language
    );
    let mut request = url
        .into_client_request()
        .map_err(|e| format!("Invalid Deepgram listen URL: {}", e))?;
    let auth = format!("Token {}", api_key);
    request.headers_mut().insert(
        AUTHORIZATION,
        HeaderValue::from_str(&auth)
            .map_err(|e| format!("Invalid Deepgram authorization: {}", e))?,
    );

    let (provider_ws, _) = tokio_tungstenite::connect_async(request)
        .await
        .map_err(|e| format!("Deepgram connection failed: {}", e))?;
    Ok((provider_ws, None))
}

async fn connect_elevenlabs(
    api_key: &str,
    config: &Value,
) -> Result<(ProviderWs, Option<Value>), String> {
    let agent_id = config["agentId"].as_str().unwrap_or("");
    if agent_id.is_empty() {
        return Err("ElevenLabs agentId required".into());
    }

    let url = format!(
        "wss://api.elevenlabs.io/v1/convai/conversation?agent_id={}",
        agent_id
    );
    let mut request = url
        .into_client_request()
        .map_err(|e| format!("Invalid ElevenLabs URL: {}", e))?;

    request.headers_mut().insert(
        "xi-api-key",
        HeaderValue::from_str(api_key).map_err(|e| format!("Invalid xi-api-key header: {}", e))?,
    );

    let (provider_ws, _) = tokio_tungstenite::connect_async(request)
        .await
        .map_err(|e| format!("Provider connection failed: {}", e))?;

    // NOTE: do NOT send the system prompt as `first_message` — that field is
    // what the agent says to open the call, not its instructions. Agent
    // instructions are configured in the ElevenLabs console for the agent_id.
    let payload = serde_json::json!({
        "type": "conversation_initiation_client_data",
    });

    Ok((provider_ws, Some(payload)))
}

async fn connect_cartesia(
    api_key: &str,
    config: &Value,
) -> Result<(ProviderWs, Option<Value>), String> {
    let agent_id = config["agentId"].as_str().unwrap_or("").trim();
    if !relay_protocol::is_safe_cartesia_agent_id(agent_id) {
        return Err(
            "Cartesia agentId is required and must use only letters, digits, '_' or '-'".into(),
        );
    }

    let url = format!(
        "wss://api.cartesia.ai/v1/agents/websocket/{}?cartesia_version={}",
        agent_id, CARTESIA_API_VERSION
    );
    let mut request = url
        .into_client_request()
        .map_err(|e| format!("Invalid Cartesia agent URL: {}", e))?;
    request.headers_mut().insert(
        "X-API-Key",
        HeaderValue::from_str(api_key)
            .map_err(|e| format!("Invalid Cartesia API key header: {}", e))?,
    );

    let (provider_ws, _) = tokio_tungstenite::connect_async(request)
        .await
        .map_err(|e| format!("Cartesia connection failed: {}", e))?;

    Ok((
        provider_ws,
        Some(relay_protocol::cartesia_session_payload(config)),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn json_text(msg: &Message) -> Value {
        let Message::Text(text) = msg else {
            panic!("expected text frame, got {:?}", msg);
        };
        serde_json::from_str(text).expect("frame must be valid JSON")
    }

    fn decoded_audio(msg: &Message) -> Vec<u8> {
        let Message::Binary(data) = msg else {
            panic!("expected binary frame, got {:?}", msg);
        };
        data.clone()
    }

    #[test]
    fn openai_client_audio_is_wrapped_in_input_audio_buffer_append() {
        let frame = adapt_client_audio("openai", &[1, 2, 3, 4]);
        let v = json_text(&frame);
        assert_eq!(v["type"], "input_audio_buffer.append");
        assert_eq!(
            v["audio"],
            base64::engine::general_purpose::STANDARD.encode([1, 2, 3, 4])
        );
    }

    #[test]
    fn elevenlabs_client_audio_uses_audio_event_envelope() {
        let frame = adapt_client_audio("elevenlabs", &[9, 9]);
        let v = json_text(&frame);
        assert_eq!(v["type"], "audio");
        assert_eq!(
            v["audio_event"]["audio_base_64"],
            base64::engine::general_purpose::STANDARD.encode([9, 9])
        );
    }

    #[test]
    fn deepgram_client_audio_stays_raw_binary() {
        let frame = adapt_client_audio("deepgram", &[7, 7, 7]);
        assert_eq!(decoded_audio(&frame), vec![7, 7, 7]);
    }

    #[test]
    fn openai_audio_delta_becomes_binary_pcm() {
        let b64 = base64::engine::general_purpose::STANDARD.encode([1, 2, 3]);
        let frames = translate_provider_text(
            "openai",
            &serde_json::json!({ "type": "response.output_audio.delta", "delta": b64 }).to_string(),
        );
        assert_eq!(frames.len(), 1);
        assert_eq!(decoded_audio(&frames[0]), vec![1, 2, 3]);
    }

    #[test]
    fn openai_transcripts_and_interruptions_are_translated() {
        let frames = translate_provider_text(
            "openai",
            &serde_json::json!({
                "type": "response.output_audio_transcript.delta",
                "delta": "Hello there"
            })
            .to_string(),
        );
        assert_eq!(json_text(&frames[0])["type"], "transcript.model");

        let frames = translate_provider_text(
            "openai",
            &serde_json::json!({
                "type": "conversation.item.input_audio_transcription.completed",
                "transcript": "Hi"
            })
            .to_string(),
        );
        assert_eq!(json_text(&frames[0])["type"], "transcript.user");

        let frames = translate_provider_text(
            "openai",
            &serde_json::json!({ "type": "input_audio_buffer.speech_started" }).to_string(),
        );
        assert_eq!(json_text(&frames[0])["type"], "interrupted");
    }

    #[test]
    fn openai_session_payload_uses_the_ga_realtime_schema() {
        let payload = openai_session_payload("gpt-realtime-2.1", "marin", "Be concise");
        assert_eq!(payload["session"]["type"], "realtime");
        assert_eq!(payload["session"]["model"], "gpt-realtime-2.1");
        assert_eq!(payload["session"]["output_modalities"][0], "audio");
        assert_eq!(
            payload["session"]["audio"]["input"]["format"]["rate"],
            24000
        );
        assert_eq!(payload["session"]["audio"]["output"]["voice"], "marin");
        assert_eq!(payload["session"]["instructions"], "Be concise");
    }

    #[test]
    fn elevenlabs_events_are_translated() {
        let b64 = base64::engine::general_purpose::STANDARD.encode([5, 5]);
        let frames = translate_provider_text(
            "elevenlabs",
            &serde_json::json!({ "type": "audio", "audio_event": { "audio_base_64": b64 } })
                .to_string(),
        );
        assert_eq!(decoded_audio(&frames[0]), vec![5, 5]);

        let frames = translate_provider_text(
            "elevenlabs",
            &serde_json::json!({
                "type": "agent_response",
                "agent_response_event": { "agent_response": "Sure" }
            })
            .to_string(),
        );
        let v = json_text(&frames[0]);
        assert_eq!(v["type"], "transcript.model");
        assert_eq!(v["text"], "Sure");

        let frames = translate_provider_text(
            "elevenlabs",
            &serde_json::json!({ "type": "interruption" }).to_string(),
        );
        assert_eq!(json_text(&frames[0])["type"], "interrupted");
    }

    #[test]
    fn cartesia_audio_and_conversation_events_are_translated() {
        let client_audio = adapt_client_audio("cartesia", &[3, 4]);
        let v = json_text(&client_audio);
        assert_eq!(v["type"], "audio_input");
        assert_eq!(
            v["audio"],
            base64::engine::general_purpose::STANDARD.encode([3, 4])
        );

        let output_audio = base64::engine::general_purpose::STANDARD.encode([8, 9]);
        let frames = translate_provider_text(
            "cartesia",
            &serde_json::json!({ "type": "audio_output", "audio": output_audio }).to_string(),
        );
        assert_eq!(decoded_audio(&frames[0]), vec![8, 9]);

        let frames = translate_provider_text(
            "cartesia",
            &serde_json::json!({
                "type": "turn_ended",
                "role": "assistant",
                "text": "Домовились"
            })
            .to_string(),
        );
        let v = json_text(&frames[0]);
        assert_eq!(v["type"], "transcript.model");
        assert_eq!(v["text"], "Домовились");

        let frames = translate_provider_text(
            "cartesia",
            &serde_json::json!({ "type": "audio_output_clear" }).to_string(),
        );
        assert_eq!(json_text(&frames[0])["type"], "interrupted");

        let frames = translate_provider_text(
            "cartesia",
            &serde_json::json!({
                "type": "client_tool_call",
                "tool_call_id": "tool_123",
                "tool_name": "request_human_handoff",
                "parameters": { "reason": "Pricing approval" },
                "expects_response": true
            })
            .to_string(),
        );
        let v = json_text(&frames[0]);
        assert_eq!(v["type"], "handoff.requested");
        assert_eq!(v["toolCallId"], "tool_123");
        assert_eq!(v["reason"], "Pricing approval");
    }

    #[test]
    fn cartesia_session_payload_uses_pcm16_and_opencloser_context() {
        let payload = relay_protocol::cartesia_session_payload(&serde_json::json!({
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
        assert!(relay_protocol::is_safe_cartesia_agent_id("agent_test-123"));
        assert!(!relay_protocol::is_safe_cartesia_agent_id("../bad"));
    }

    #[test]
    fn deepgram_final_results_become_user_transcripts() {
        let frames = translate_provider_text(
            "deepgram",
            &serde_json::json!({
                "type": "Results",
                "is_final": true,
                "channel": { "alternatives": [{ "transcript": "Добрий день" }] }
            })
            .to_string(),
        );
        let v = json_text(&frames[0]);
        assert_eq!(v["type"], "transcript.user");
        assert_eq!(v["text"], "Добрий день");

        // Interim or empty transcripts must not fabricate user text.
        let frames = translate_provider_text(
            "deepgram",
            &serde_json::json!({
                "type": "Results",
                "is_final": false,
                "channel": { "alternatives": [{ "transcript": "draft" }] }
            })
            .to_string(),
        );
        assert_eq!(json_text(&frames[0])["type"], "Results");
    }

    #[test]
    fn session_ready_requires_provider_specific_handshake() {
        assert!(provider_session_ready(
            "openai",
            r#"{"type":"session.updated"}"#
        ));
        assert!(!provider_session_ready(
            "openai",
            r#"{"type":"session.created"}"#
        ));
        assert!(provider_session_ready(
            "elevenlabs",
            r#"{"type":"conversation_initiation_metadata"}"#
        ));
        assert!(!provider_session_ready("elevenlabs", r#"{"type":"ping"}"#));
        assert!(provider_session_ready("deepgram", r#"{"type":"Results"}"#));
        assert!(provider_session_ready(
            "cartesia",
            r#"{"type":"session_ready","call_id":"ac_test"}"#
        ));
        assert!(!provider_session_ready(
            "cartesia",
            r#"{"type":"turn_started"}"#
        ));
        assert!(!provider_session_ready("unknown", r#"{"type":"anything"}"#));
    }
}
