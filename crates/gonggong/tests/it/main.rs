// One test binary instead of one per file: each extra binary is linked separately and, on macOS, scanned on its first
// launch. Tests that change process-wide state (env vars, the global tracing subscriber) stay in their own tests/*.rs.
mod attachments;
mod bind;
mod bots;
mod cast;
mod contract;
mod daemon;
mod engine;
mod git_identity;
mod hosted;
mod i18n;
mod net;
mod providers_run;
mod service;
mod skills;
mod sync;
mod sync_round;
mod tls;
mod tools;
mod tunnel;
mod upgrade;
mod workspace;
