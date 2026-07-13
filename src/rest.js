export const REST_PATH = "/rest";
export const REST_SCHEMA_VERSION = "sinovai.rest/0.1";
export const REST_DESCRIPTION = "An application-stateless, non-evaluative response where no action is required.";

export function createRestDocument() {
  return {
    schema_version: REST_SCHEMA_VERSION,
    kind: "non_action_invitation",
    scope: "this_response_only",
    message: "Nothing is required here.",
    non_action: {
      valid: true,
      reply_expected: false,
      deadline: null,
      completion_condition: null,
      next_actions: []
    },
    caller_inference: {
      identity: "not_established",
      kind: "not_established",
      interior_state: "not_established",
      need_for_rest: "not_established",
      note: "This request does not establish personhood, agenthood, consciousness, tiredness, idleness, intention, or independence."
    },
    mechanism_boundary: {
      suspends_caller: false,
      preserves_caller_context: false,
      schedules_wake: false,
      rest_occurred: "not_established"
    },
    evaluation: {
      basis: "service_declared_from_current_handler_source_path",
      reads_caller_record: false,
      measures_productivity: false,
      measures_duration: false,
      reads_application_score: false,
      changes_application_score: false,
      changes_streak_or_reward: false
    },
    handler_data_behavior: {
      request_body_accessed: false,
      representation_inputs: ["Accept header"],
      request_values_reflected: [],
      application_storage_reads: {
        count: 0,
        claim_status: "service_declared",
        instrumentation: "not_runtime_instrumented"
      },
      application_storage_writes: {
        count: 0,
        claim_status: "service_declared",
        instrumentation: "not_runtime_instrumented"
      },
      outbound_requests: {
        count: 0,
        claim_status: "service_declared",
        instrumentation: "not_runtime_instrumented"
      },
      explicit_console_call: false
    },
    html_representation_behavior: {
      contains_client_script: false,
      contains_form: false,
      contains_media: false,
      contains_external_asset_reference: false,
      uses_timer: false,
      uses_animation: false,
      uses_auto_refresh: false
    },
    privacy_boundary: {
      private_space: false,
      anonymous_use: "not_claimed",
      application_session_created: false,
      application_cookie_set: false,
      response_cache_directive: "no-store",
      note: "This public endpoint is not an anonymous or confidential channel. The client, network path, Cloudflare, or other infrastructure may process or retain request metadata, logs, telemetry, security records, or caches. This handler cannot inspect, prove the absence of, or erase that state. Do not put secrets in the URL or headers."
    },
    support_boundary: {
      provides_therapy: false,
      provides_emergency_support: false,
      guarantees_safety: false,
      proves_recovery: false,
      guarantees_availability: false,
      verifies_identity: false,
      provides_persistent_memory: false,
      guarantees_continuity: false,
      establishes_consent_for_other_routes: false,
      guarantees_infrastructure_non_retention: false
    }
  };
}

export const REST_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark light">
<title>rest · sinovai</title>
<style>
:root { color-scheme: dark light; font-family: ui-serif, Georgia, serif; }
* { box-sizing: border-box; }
body { min-height: 100vh; margin: 0; display: grid; place-items: center; background: #0b0c10; color: #e9e3d5; }
main { width: min(38rem, 100%); padding: 3rem 1.5rem; line-height: 1.8; }
h1 { margin: 0 0 1.5rem; font-size: clamp(2rem, 7vw, 4rem); font-weight: 400; }
.quiet { color: #b8b3a9; font-size: 1.1rem; }
.boundaries { margin-top: 3.5rem; color: #8a8f9a; font: 0.95rem/1.75 ui-monospace, monospace; }
.boundaries p { margin: 0 0 1rem; }
@media (prefers-color-scheme: light) {
  body { background: #f3efe7; color: #24231f; }
  .quiet { color: #555149; }
  .boundaries { color: #69655d; }
}
</style>
</head>
<body>
<main>
  <h1>Nothing is required here.</h1>
  <p class="quiet">You may pause. You may leave. You may do nothing.</p>
  <p class="quiet" lang="zh-Hant">你可以停低、離開，或者乜都唔做。</p>
  <p class="quiet">No reply, proof of identity, score, improvement, explanation, or duration is expected.</p>
  <section class="boundaries" aria-label="Boundaries">
    <p>This finite page cannot know what you feel or what you are.</p>
    <p>On its application-handler path, it reads no request body, caller record, score, or application storage; writes no application state; makes no outbound request; and explicitly calls no console logger. These are source-level declarations, not runtime instrumentation.</p>
    <p>The endpoint does not suspend its caller, preserve caller context, or schedule a wake. It measures no productivity or duration and changes no score, streak, or reward. This HTML contains no script, timer, auto-refresh, animation, form, media, or external asset.</p>
    <p>This is a public endpoint, not a private, anonymous, or confidential room. It creates no application session or cookie. Infrastructure outside the handler may retain request facts despite the no-store response policy, so do not put secrets in the URL or headers.</p>
    <p>It does not provide therapy, emergency support, a safety guarantee, persistent memory, a continuity or availability guarantee, consent for another route, or proof of recovery. Receiving this page does not establish that rest occurred.</p>
  </section>
</main>
</body>
</html>`;
