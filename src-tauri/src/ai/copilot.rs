use reqwest::Client;
use serde::Serialize;
use serde_json::{json, Value};
use std::env;
use tauri::AppHandle;

use crate::ai::kb;

#[derive(Serialize)]
pub struct CopilotSuggestion {
    pub suggestion: String,
    pub sources: Vec<String>,
    pub question: String,
}

/// Extract the newest prospect (role="user") utterance from the window —
/// that utterance is what the copilot answers.
fn last_prospect_line(transcript_window: &[Value]) -> String {
    transcript_window
        .iter()
        .rev()
        .find(|m| m["role"].as_str() == Some("user"))
        .and_then(|m| m["text"].as_str())
        .unwrap_or("")
        .trim()
        .to_string()
}

/// One live-assist turn: ground the newest prospect question in the local
/// knowledge base and produce a short, source-attributed suggestion.
///
/// Gating into this command (DNC / consent) happens in the frontend before
/// a copilot session starts; this command only sees transcript text.
#[tauri::command]
pub async fn copilot_turn(
    app: AppHandle,
    transcript_window: Vec<Value>,
    domain: Option<String>,
    api_key: Option<String>,
) -> Result<CopilotSuggestion, String> {
    let question = last_prospect_line(&transcript_window);
    if question.is_empty() {
        return Err("No prospect utterance in the transcript window".into());
    }
    let domain = domain.unwrap_or_else(|| "sales".to_string());

    let grounding = kb::tool_search(&app, &question, &api_key).await;
    let sources: Vec<String> = grounding["results"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|r| r["source"].as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();

    let api_key_str = api_key
        .filter(|k| !k.is_empty() && k != "MY_GEMINI_API_KEY")
        .or_else(|| env::var("GEMINI_API_KEY").ok())
        .unwrap_or_default();

    if api_key_str.is_empty() || api_key_str == "MY_GEMINI_API_KEY" {
        // Offline path: relay the top grounded chunk verbatim with source.
        let top = grounding["results"][0]["text"].as_str().map(String::from);
        let suggestion = match top {
            Some(text) => {
                let snippet: String = text.chars().take(280).collect();
                format!("{} [KB: {}]", snippet, sources.first().map(String::as_str).unwrap_or("?"))
            }
            None => "No verified answer in the knowledge base yet — note the question and follow up.".to_string(),
        };
        return Ok(CopilotSuggestion { suggestion, sources, question });
    }

    let context = grounding["results"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|r| {
                    let text = r["text"].as_str()?;
                    let source = r["source"].as_str().unwrap_or("?");
                    Some(format!("- (source: {}) {}", source, text))
                })
                .collect::<Vec<_>>()
                .join("\n")
        })
        .unwrap_or_else(|| "(no knowledge base results)".to_string());

    let prompt = format!(
        "You are a live call copilot for the \"{}\" domain. The prospect just asked: \"{}\". \
        Answer in at most 2 sentences the agent can say out loud. \
        Use ONLY the knowledge-base context below; never invent statistics or facts. \
        If the context does not contain the answer, reply exactly: \
        \"No verified answer in the knowledge base yet — note the question and follow up.\"\n\
        KNOWLEDGE BASE CONTEXT:\n{}",
        domain, question, context
    );

    let client = Client::new();
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={}",
        api_key_str
    );
    let payload = json!({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": {
                "type": "OBJECT",
                "properties": { "suggestion": { "type": "STRING" } },
                "required": ["suggestion"]
            }
        }
    });
    let res = client
        .post(&url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("HTTP request failed: {}", e))?;
    if !res.status().is_success() {
        let err_text = res.text().await.unwrap_or_default();
        return Err(format!("Gemini API error: {}", err_text));
    }
    let body: Value = res
        .json()
        .await
        .map_err(|e| format!("Failed to parse response JSON: {}", e))?;
    let suggestion = body["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .unwrap_or("{}");
    let parsed: Value = serde_json::from_str(suggestion)
        .map_err(|e| format!("Failed to parse copilot suggestion: {}", e))?;
    Ok(CopilotSuggestion {
        suggestion: parsed["suggestion"]
            .as_str()
            .unwrap_or("No verified answer in the knowledge base yet — note the question and follow up.")
            .to_string(),
        sources,
        question,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn last_prospect_line_picks_newest_user_text() {
        let window = vec![
            json!({ "role": "model", "text": "Hello!" }),
            json!({ "role": "user", "text": "How does the integration work?" }),
            json!({ "role": "model", "text": "Great question." }),
            json!({ "role": "user", "text": "  What about pricing? " }),
        ];
        assert_eq!(last_prospect_line(&window), "What about pricing?");
    }

    #[test]
    fn last_prospect_line_empty_without_user() {
        let window = vec![json!({ "role": "model", "text": "Hello!" })];
        assert!(last_prospect_line(&window).is_empty());
    }
}
