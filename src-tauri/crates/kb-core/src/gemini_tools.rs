//! Pure Gemini function-calling protocol helpers for the knowledge-base
//! tool round-trip.
//!
//! `objection_trainer_turn` (and later the copilot) lets the model call
//! `search_knowledge_base(query)` against the local SQLite KB. This module
//! owns the protocol pieces — detecting a tool call in a response, and
//! appending the model/tool exchange to the conversation — so the
//! round-trip can be unit-tested without HTTP.

use serde_json::{json, Value};

/// Name of the tool exposed to the model.
pub const KB_TOOL_NAME: &str = "search_knowledge_base";

/// Maximum tool round-trips before the model is forced to answer.
pub const MAX_TOOL_ROUNDS: usize = 3;

/// Tool declaration sent in the `tools` field of generateContent calls.
pub fn kb_tool_declaration() -> Value {
    json!({
        "function_declarations": [{
            "name": KB_TOOL_NAME,
            "description": "Search the local knowledge base of verified sales and recruitment training material. Use it before quoting any statistic, number, or methodology claim.",
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "query": { "type": "STRING", "description": "Free-text search query." }
                },
                "required": ["query"]
            }
        }]
    })
}

/// Extract the first `search_knowledge_base` function call from a
/// generateContent response. Returns `(name, query)` when present.
pub fn extract_tool_call(response: &Value) -> Option<(String, String)> {
    let parts = response
        .get("candidates")?
        .get(0)?
        .get("content")?
        .get("parts")?
        .as_array()?;
    for part in parts {
        if let Some(call) = part.get("functionCall") {
            let name = call.get("name").and_then(|n| n.as_str()).unwrap_or("");
            if name == KB_TOOL_NAME {
                let query = call
                    .pointer("/args/query")
                    .and_then(|q| q.as_str())
                    .unwrap_or("");
                return Some((name.to_string(), query.to_string()));
            }
        }
    }
    None
}

/// Concatenated text parts of a response, when the model answered in text.
pub fn extract_text(response: &Value) -> Option<String> {
    let parts = response
        .get("candidates")?
        .get(0)?
        .get("content")?
        .get("parts")?
        .as_array()?;
    let mut text = String::new();
    for part in parts {
        if let Some(t) = part.get("text").and_then(|t| t.as_str()) {
            text.push_str(t);
        }
    }
    if text.is_empty() { None } else { Some(text) }
}

/// Append a model response containing a function call plus our function
/// response to `contents`, in the order the Gemini API expects.
pub fn push_function_round(
    contents: &mut Vec<Value>,
    model_response: &Value,
    tool_result_json: Value,
) {
    if let Some(content) = model_response.pointer("/candidates/0/content") {
        contents.push(json!({ "role": "model", "parts": content.get("parts").cloned().unwrap_or(json!([])) }));
    }
    contents.push(json!({
        "role": "user",
        "parts": [{
            "functionResponse": {
                "name": KB_TOOL_NAME,
                "response": { "result": tool_result_json }
            }
        }]
    }));
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tool_call_response(query: &str) -> Value {
        json!({
            "candidates": [{
                "content": {
                    "role": "model",
                    "parts": [{ "functionCall": { "name": "search_knowledge_base", "args": { "query": query } } }]
                }
            }]
        })
    }

    #[test]
    fn tool_declaration_names_kb_tool() {
        let decl = kb_tool_declaration();
        assert_eq!(
            decl["function_declarations"][0]["name"].as_str(),
            Some(KB_TOOL_NAME)
        );
    }

    #[test]
    fn extracts_tool_call_query() {
        let (name, query) = extract_tool_call(&tool_call_response("price objection rebuttal")).unwrap();
        assert_eq!(name, "search_knowledge_base");
        assert_eq!(query, "price objection rebuttal");
    }

    #[test]
    fn ignores_other_tool_calls_and_text_responses() {
        let other = json!({
            "candidates": [
                { "content": { "parts": [ { "functionCall": { "name": "other_tool", "args": {} } } ] } }
            ]
        });
        assert!(extract_tool_call(&other).is_none());

        let text = json!({
            "candidates": [{ "content": { "parts": [{ "text": "{\"role\":\"ai_prospect\"}" }] } }]
        });
        assert!(extract_tool_call(&text).is_none());
        assert_eq!(extract_text(&text).as_deref(), Some("{\"role\":\"ai_prospect\"}"));
    }

    #[test]
    fn function_round_appends_model_then_tool_response() {
        let response = tool_call_response("roi proof");
        let mut contents = vec![json!({ "role": "user", "parts": [{ "text": "prompt" }] })];
        push_function_round(&mut contents, &response, json!({ "results": ["chunk"] }));

        assert_eq!(contents.len(), 3);
        assert_eq!(contents[1]["role"], "model");
        assert_eq!(
            contents[1]["parts"][0]["functionCall"]["name"],
            "search_knowledge_base"
        );
        assert_eq!(contents[2]["role"], "user");
        assert_eq!(
            contents[2]["parts"][0]["functionResponse"]["name"],
            "search_knowledge_base"
        );
        assert_eq!(
            contents[2]["parts"][0]["functionResponse"]["response"]["result"]["results"][0],
            "chunk"
        );
    }

    #[test]
    fn full_mocked_round_trip_reaches_final_text() {
        // Simulated: prompt -> tool call -> functionResponse -> final text.
        let mut contents = vec![json!({ "role": "user", "parts": [{ "text": "You are a prospect..." }] })];
        let mut rounds = 0;

        let response = tool_call_response("what is an API");
        assert!(extract_tool_call(&response).is_some());
        push_function_round(&mut contents, &response, json!({ "results": [{ "source": "vHG4m5ptmJs" }] }));
        rounds += 1;

        let final_response = json!({
            "candidates": [{ "content": { "parts": [{ "text": "{\"role\":\"ai_prospect\",\"text\":\"An API is...\"}" }] } }]
        });
        assert!(extract_tool_call(&final_response).is_none());
        let text = extract_text(&final_response).unwrap();

        assert_eq!(rounds, 1);
        assert!(rounds < MAX_TOOL_ROUNDS);
        assert!(text.contains("An API is"));
        assert_eq!(contents.len(), 3);
    }
}
